"""Placing the replacement logo.

Given a cleaned background and the box the old logo occupied, this module
fits a transparent PNG into that box: aspect ratio preserved, centred (or
aligned to an edge), optional soft drop shadow, alpha-composited so
semi-transparent pixels blend properly instead of showing a matte fringe.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from PIL import Image

from config import Config
from utils import (
    AssetError,
    BBox,
    apply_opacity,
    drop_shadow,
    fit_within,
    get_logger,
    load_image,
    paste_rgba,
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

        result = background.convert("RGBA")
        if cfg.shadow and cfg.shadow_opacity > 0:
            result = self._draw_shadow(result, resized, (x, y))
        result = paste_rgba(result, resized, (x, y))

        placement = Placement(
            box=BBox(x, y, x + size[0], y + size[1]),
            size=size,
            scale=size[0] / logo.width,
        )
        get_logger().debug("placed logo %s (scale %.2fx)", placement.describe(), placement.scale)
        return result.convert("RGB"), placement

    def _draw_shadow(self, canvas: Image.Image, logo: Image.Image, position: tuple[int, int]) -> Image.Image:
        """Soft shadow under the logo, sized relative to the logo itself."""
        cfg = self._config.overlay
        reference = max(logo.size)
        blur = max(1, int(round(reference * cfg.shadow_blur)))
        offset = int(round(reference * cfg.shadow_offset))
        layer, (pad_x, pad_y) = drop_shadow(
            logo,
            blur=blur,
            offset=(offset, offset),
            opacity=cfg.shadow_opacity,
            color=cfg.shadow_color,
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
