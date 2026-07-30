"""Placing the replacement logo.

Given a cleaned background and the box the old logo occupied, this module
fits a transparent PNG into that box: aspect ratio preserved, centred (or
aligned to an edge), optional soft drop shadow, alpha-composited so
semi-transparent pixels blend properly instead of showing a matte fringe.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image

from config import Config
from utils import (
    AssetError,
    BBox,
    add_grain,
    alpha_weighted_colour,
    apply_opacity,
    drop_shadow,
    estimate_grain,
    fit_within,
    get_logger,
    load_image,
    luminance_map,
    paste_rgba,
    relative_luminance,
    trim_transparent,
)


@dataclass(frozen=True)
class Placement:
    """Where a logo actually landed, for logging and debug overlays."""

    box: BBox
    size: tuple[int, int]
    scale: float

    def describe(self) -> str:
        return f"{self.size[0]}x{self.size[1]} at ({self.box.x1}, {self.box.y1})"


class LogoOverlay:
    """Loads a logo once and stamps it into as many boxes as needed."""

    def __init__(self, config: Config, logo_path: Path | None = None) -> None:
        self._config = config
        self._path = logo_path or config.paths.logo
        self._logo: Image.Image | None = None

    # -- asset ------------------------------------------------------------
    @property
    def path(self) -> Path:
        return self._path

    def load(self) -> Image.Image:
        """Read the logo, warn if it is opaque, and trim empty margins."""
        if self._logo is not None:
            return self._logo
        if not self._path.exists():
            raise AssetError(
                f"logo not found at {self._path}.\n"
                "  Pass --logo /path/to/new_logo.png, or drop the file in input/new_logo.png."
            )
        logo = load_image(self._path, mode="RGBA")
        alpha = logo.getchannel("A")
        if alpha.getextrema() == (255, 255):
            get_logger().warning(
                "%s has no transparency — it will be pasted as a solid rectangle. "
                "Export a PNG with an alpha channel for a clean result.",
                self._path.name,
            )
        if self._config.overlay.trim_transparent:
            trimmed = trim_transparent(logo)
            if trimmed.size != logo.size:
                get_logger().debug("trimmed logo padding: %s -> %s", logo.size, trimmed.size)
            logo = trimmed
        if logo.width < 2 or logo.height < 2:
            raise AssetError(f"logo {self._path} has no visible pixels")
        self._logo = logo
        return logo

    # -- placement --------------------------------------------------------
    def place(self, background: Image.Image, box: BBox) -> tuple[Image.Image, Placement]:
        """Composite the logo into ``box`` and return the result plus placement."""
        cfg = self._config.overlay
        logo = self.load()
        canvas_w, canvas_h = background.size

        target = box.clamp(canvas_w, canvas_h)
        if target.width < 2 or target.height < 2:
            raise AssetError(f"target box {box.as_tuple()} is too small to hold a logo")

        size = fit_within(logo.size, (target.width, target.height), cfg.scale, cfg.max_upscale)
        resized = logo.resize(size, Image.LANCZOS)
        resized = apply_opacity(resized, cfg.opacity)

        x = _align(target.x1, target.width, size[0], cfg.align_x, ("left", "center", "right"))
        y = _align(target.y1, target.height, size[1], cfg.align_y, ("top", "center", "bottom"))
        # Keep the logo on the canvas even if the box hugs an edge.
        x = min(max(0, x), max(0, canvas_w - size[0]))
        y = min(max(0, y), max(0, canvas_h - size[1]))

        landing = BBox(x, y, x + size[0], y + size[1]).clamp(canvas_w, canvas_h)
        shadow_colour, shadow_opacity = cfg.shadow_color, cfg.shadow_opacity
        if cfg.realistic:
            resized = self._match_texture(background, resized, landing)
            shadow_colour, shadow_opacity = self._separation(background, resized, landing)

        result = background.convert("RGBA")
        if cfg.shadow and shadow_opacity > 0:
            result = self._draw_shadow(result, resized, (x, y), shadow_colour, shadow_opacity)
        result = paste_rgba(result, resized, (x, y))

        placement = Placement(
            box=BBox(x, y, x + size[0], y + size[1]),
            size=size,
            scale=size[0] / logo.width,
        )
        get_logger().debug("placed logo %s (scale %.2fx)", placement.describe(), placement.scale)
        return result.convert("RGB"), placement

    # -- realism ----------------------------------------------------------
    def _match_texture(self, background: Image.Image, logo: Image.Image, landing: BBox) -> Image.Image:
        """Give the logo the same fine texture as the page it lands on.

        A vector logo is perfectly clean. Dropped onto a photograph or a
        scanned print it reads as pasted precisely because it is cleaner than
        everything around it. Matching the measured grain removes that tell,
        and costs nothing on flat artwork where the measurement is zero.
        """
        if not self._config.overlay.match_grain or landing.area <= 0:
            return logo
        patch = background.convert("RGB").crop(landing.as_tuple())
        sigma = estimate_grain(patch)
        if sigma <= 0.35:
            return logo
        get_logger().debug("matching backdrop grain σ=%.1f", sigma)
        return add_grain(logo, sigma, seed=landing.x1 * 7919 + landing.y1)

    def _separation(self, background: Image.Image, logo: Image.Image, landing: BBox) -> tuple[str, float]:
        """Pick a shadow tone and strength that keep the logo readable.

        A white logo on a white page is invisible, which is the least
        realistic outcome there is. Rather than alter the brand colours, this
        measures the contrast between the logo's ink and the surface behind
        it and, when that is too low, lifts the logo off the page with a halo
        in the opposite tone — dark under light art, light under dark art.
        """
        cfg = self._config.overlay
        ink = alpha_weighted_colour(logo)
        if ink is None or landing.area <= 0:
            return cfg.shadow_color, cfg.shadow_opacity

        patch = background.convert("RGB").crop(landing.as_tuple())
        backdrop = np.asarray(patch, dtype=np.float32).reshape(-1, 3).mean(axis=0)
        backdrop_luminance = relative_luminance(backdrop)

        # Per pixel, not on the average. A mark with a dark symbol and white
        # type averages to mid-grey and looks fine by the numbers while its
        # wordmark is invisible — measured 1.8:1 on a logo whose text had no
        # contrast at all.
        rgba = np.asarray(logo.convert("RGBA"), dtype=np.float32)
        visible = rgba[..., 3] > 128
        if not visible.any():
            return cfg.shadow_color, cfg.shadow_opacity
        luminances = luminance_map(rgba[..., :3][visible])
        ratios = (np.maximum(luminances, backdrop_luminance) + 0.05) / (
            np.minimum(luminances, backdrop_luminance) + 0.05
        )
        lost = float((ratios < cfg.min_contrast).mean())

        # The halo separates ink from page, so it is toned against the *page*.
        # Toning it against the ink puts a white halo behind white type on a
        # white background, which is exactly no help at all.
        colour = "#000000" if backdrop_luminance > 0.5 else "#ffffff"

        if lost < 0.15:
            dark_ink = float(luminances.mean()) <= 0.5
            return (cfg.shadow_color if dark_ink else colour), cfg.shadow_opacity

        opacity = float(np.clip(cfg.shadow_opacity + lost * 0.55, 0.0, 0.9))
        get_logger().warning(
            "%.0f%% of the logo has less than %.1f:1 contrast against this backdrop — adding a %s halo so it "
            "stays legible. A logo variant made for a %s background would look better.",
            lost * 100,
            cfg.min_contrast,
            "dark" if colour == "#000000" else "light",
            "light" if backdrop_luminance > 0.5 else "dark",
        )
        return colour, opacity

    def _draw_shadow(
        self,
        canvas: Image.Image,
        logo: Image.Image,
        position: tuple[int, int],
        colour: str,
        opacity: float,
    ) -> Image.Image:
        """Soft shadow under the logo, sized relative to the logo itself."""
        cfg = self._config.overlay
        reference = max(logo.size)
        blur = max(1, int(round(reference * cfg.shadow_blur)))
        offset = int(round(reference * cfg.shadow_offset))
        # A halo sits centred; a shadow is thrown. Offsetting a halo just looks
        # like a mistake, so only the true shadow gets displaced.
        if opacity > cfg.shadow_opacity:
            offset = 0
            blur = max(2, int(round(reference * cfg.shadow_blur * 1.6)))
        layer, (pad_x, pad_y) = drop_shadow(
            logo,
            blur=blur,
            offset=(offset, offset),
            opacity=opacity,
            color=colour,
        )
        return paste_rgba(canvas, layer, (position[0] - pad_x, position[1] - pad_y))


def _align(origin: int, available: int, size: int, mode: str, modes: tuple[str, str, str]) -> int:
    """Position ``size`` inside ``available`` starting at ``origin``."""
    start, center, _end = modes
    if mode == start:
        return origin
    if mode == center:
        return origin + (available - size) // 2
    return origin + available - size
