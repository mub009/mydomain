"""Colour: reading a poster's palette, and making the two agree.

A logo dropped onto a poster whose colours fight it looks wrong however well
it is placed, so this module does three things:

* **read** the dominant colours of a poster or a logo, ignoring the neutrals
  that dominate by area but say nothing about the design;
* **compare** them, in a space where distance means what the eye means;
* **retint** one to the other, rotating hue while leaving lightness alone, so
  shading, gradients and photographs survive the change.

Which direction to retint is a real decision, not a detail. Recolouring the
*poster* to the logo's brand colour is almost always right: the brand is
fixed and the template is yours. Recolouring the *logo* alters someone's
identity and is only defensible for a single-colour mark used as an
ornament — so it is available, and it warns.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from PIL import Image

from utils import get_logger


@dataclass(frozen=True)
class Swatch:
    """One colour in a palette, with the share of the image it covers."""

    rgb: tuple[int, int, int]
    share: float

    @property
    def hex(self) -> str:
        return "#{:02x}{:02x}{:02x}".format(*self.rgb)

    @property
    def hsv(self) -> tuple[float, float, float]:
        """Hue in degrees, saturation and value in 0-1."""
        red, green, blue = (channel / 255.0 for channel in self.rgb)
        high, low = max(red, green, blue), min(red, green, blue)
        spread = high - low
        if spread == 0:
            hue = 0.0
        elif high == red:
            hue = (60 * ((green - blue) / spread)) % 360
        elif high == green:
            hue = 60 * ((blue - red) / spread) + 120
        else:
            hue = 60 * ((red - green) / spread) + 240
        return hue, (spread / high if high else 0.0), high

    def describe(self) -> str:
        return f"{self.hex} ({self.share * 100:.0f}%)"


# --------------------------------------------------------------------------
# perceptual distance
# --------------------------------------------------------------------------
def _to_lab(rgb: np.ndarray) -> np.ndarray:
    """sRGB 0-255 to CIE Lab (D65), for arrays shaped (..., 3)."""
    channels = np.asarray(rgb, dtype=np.float64) / 255.0
    linear = np.where(channels <= 0.04045, channels / 12.92, ((channels + 0.055) / 1.055) ** 2.4)
    matrix = np.array(
        [
            [0.4124564, 0.3575761, 0.1804375],
            [0.2126729, 0.7151522, 0.0721750],
            [0.0193339, 0.1191920, 0.9503041],
        ]
    )
    xyz = linear @ matrix.T / np.array([0.95047, 1.00000, 1.08883])
    delta = 6.0 / 29.0
    f = np.where(xyz > delta**3, np.cbrt(xyz), xyz / (3 * delta**2) + 4.0 / 29.0)
    return np.stack(
        [116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])],
        axis=-1,
    )


def delta_e(first: tuple[int, int, int], second: tuple[int, int, int]) -> float:
    """CIE76 colour difference. Under ~2.3 is imperceptible; over ~30 clashes."""
    lab = _to_lab(np.array([first, second], dtype=np.float64))
    return float(np.linalg.norm(lab[0] - lab[1]))


# --------------------------------------------------------------------------
# reading a palette
# --------------------------------------------------------------------------
def extract_palette(
    image: Image.Image,
    count: int = 5,
    min_saturation: float = 0.18,
    alpha_threshold: int = 128,
) -> list[Swatch]:
    """The dominant *coloured* tones, most-used first.

    Neutrals are dropped on purpose. A poster is mostly white paper and black
    type, and reporting those as "the palette" tells you nothing about the
    design — the accent that covers 6% of the page is the colour that matters.
    """
    rgba = image.convert("RGBA")
    quantised = rgba.convert("RGB").quantize(colors=32, method=Image.MEDIANCUT)
    table = np.array(quantised.getpalette()[: 32 * 3], dtype=np.uint8).reshape(-1, 3)
    indices = np.asarray(quantised)

    if alpha_threshold > 0:
        visible = np.asarray(rgba.getchannel("A")) >= alpha_threshold
        indices = indices[visible]
    counts = np.bincount(indices.ravel(), minlength=len(table)).astype(np.float64)
    total = counts.sum()
    if total <= 0:
        return []

    swatches: list[Swatch] = []
    for index, weight in enumerate(counts):
        if weight <= 0:
            continue
        candidate = Swatch(tuple(int(v) for v in table[index]), float(weight / total))
        _hue, saturation, value = candidate.hsv
        if saturation < min_saturation or value < 0.12:
            continue  # white, black, grey: present, but not the palette
        swatches.append(candidate)

    swatches.sort(key=lambda s: s.share, reverse=True)
    return _merge_similar(swatches)[:count]


def _merge_similar(swatches: list[Swatch], threshold: float = 12.0) -> list[Swatch]:
    """Fold near-identical swatches together — quantising splits gradients."""
    merged: list[Swatch] = []
    for swatch in swatches:
        for index, kept in enumerate(merged):
            if delta_e(swatch.rgb, kept.rgb) < threshold:
                merged[index] = Swatch(kept.rgb, kept.share + swatch.share)
                break
        else:
            merged.append(swatch)
    return merged


def brand_colour(logo: Image.Image) -> Swatch | None:
    """The colour a logo would be described by.

    Not simply the most common one: a mark with a large pale wash and a small
    saturated symbol is known by the symbol. Area and saturation are weighed
    together.
    """
    swatches = extract_palette(logo, count=6, min_saturation=0.22)
    if not swatches:
        return None
    return max(swatches, key=lambda s: s.share ** 0.5 * (0.4 + s.hsv[1]))


def accent_colour(poster: Image.Image) -> Swatch | None:
    """The poster's leading accent — the colour a designer would name."""
    swatches = extract_palette(poster, count=5, alpha_threshold=0)
    return swatches[0] if swatches else None


# --------------------------------------------------------------------------
# retinting
# --------------------------------------------------------------------------
def retint(
    image: Image.Image,
    source: tuple[int, int, int],
    target: tuple[int, int, int],
    tolerance: float = 35.0,
    min_saturation: float = 0.20,
    keep_alpha: bool = True,
) -> Image.Image:
    """Rotate pixels near ``source``'s hue onto ``target``'s.

    Value is left untouched, which is what keeps gradients, shading and the
    text drawn on a coloured panel intact — only the hue and the saturation
    move. Pixels are weighted by how close their hue is to the source and how
    saturated they are, so neutrals and unrelated colours stay exactly as they
    were, and the boundary between changed and unchanged pixels is smooth
    rather than a hard edge with a fringe.

    Anything far from the source hue is untouched, which is why a photograph
    on the poster survives a blue-to-teal swap. It will *not* survive a swap
    whose source hue is the same as the skin in it — check the result when the
    accent is orange or red.
    """
    source_swatch, target_swatch = Swatch(source, 1.0), Swatch(target, 1.0)
    source_hue, source_sat, _ = source_swatch.hsv
    target_hue, target_sat, _ = target_swatch.hsv

    rgba = image.convert("RGBA")
    hsv = np.asarray(rgba.convert("RGB").convert("HSV"), dtype=np.float32)
    hue = hsv[..., 0] * (360.0 / 255.0)
    saturation = hsv[..., 1] / 255.0

    # Circular hue distance, then a smooth falloff over the tolerance window.
    distance = np.abs(((hue - source_hue + 180.0) % 360.0) - 180.0)
    hue_weight = np.clip(1.0 - distance / max(tolerance, 1e-6), 0.0, 1.0)
    hue_weight = hue_weight * hue_weight * (3.0 - 2.0 * hue_weight)  # smoothstep

    span = max(min_saturation, 1e-6)
    sat_weight = np.clip((saturation - min_saturation * 0.5) / span, 0.0, 1.0)
    weight = hue_weight * sat_weight

    rotation = ((target_hue - source_hue + 180.0) % 360.0) - 180.0
    new_hue = (hue + rotation * weight) % 360.0
    ratio = (target_sat + 1e-6) / (source_sat + 1e-6)
    new_sat = np.clip(saturation * (1.0 + weight * (ratio - 1.0)), 0.0, 1.0)

    hsv[..., 0] = new_hue * (255.0 / 360.0)
    hsv[..., 1] = new_sat * 255.0
    recoloured = Image.fromarray(hsv.astype(np.uint8), mode="HSV").convert("RGB")

    changed = float((weight > 0.05).mean())
    get_logger().debug(
        "retint %s → %s: %.1f%% of pixels moved",
        source_swatch.hex,
        target_swatch.hex,
        changed * 100,
    )
    if keep_alpha and image.mode in {"RGBA", "LA", "P"}:
        recoloured = recoloured.convert("RGBA")
        recoloured.putalpha(rgba.getchannel("A"))
    return recoloured


def describe_palettes(poster: list[Swatch], logo: list[Swatch]) -> str:
    """A short report on whether the two sets of colours get along."""
    lines = ["", "Colour", "------"]
    lines.append("  poster: " + (", ".join(s.describe() for s in poster) or "no saturated colours"))
    lines.append("  logo:   " + (", ".join(s.describe() for s in logo) or "no saturated colours"))

    if poster and logo:
        nearest = min(delta_e(logo[0].rgb, s.rgb) for s in poster)
        if nearest < 12:
            verdict = "already matched"
        elif nearest < 30:
            verdict = "related — no change needed"
        elif nearest < 60:
            verdict = "different families; --match-poster would tie them together"
        else:
            verdict = "clashing; retint the poster with --match-poster"
        lines.append(f"  closest logo-to-poster distance: ΔE {nearest:.0f} — {verdict}")
    return "\n".join(lines)
