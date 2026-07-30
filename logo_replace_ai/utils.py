"""Shared helpers: errors, logging, image IO, geometry, masks and shadows.

Only Pillow, NumPy and OpenCV are imported here — the heavyweight ML stacks
stay behind lazy imports in ``detect.py`` / ``inpaint.py`` so that ``--help``,
config validation and the classical pipeline all work on a bare install.
"""

from __future__ import annotations

import logging
import sys
import time
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Iterator

import numpy as np
from PIL import Image, ImageFilter

from config import IMAGE_SUFFIXES

LOGGER_NAME = "logo_replace_ai"


# --------------------------------------------------------------------------
# errors
# --------------------------------------------------------------------------
class LogoReplaceError(Exception):
    """Base class for every error this pipeline raises on purpose.

    ``app.py`` catches this and prints a single readable line instead of a
    traceback; anything else escaping is a genuine bug and keeps its traceback.
    """


class DependencyError(LogoReplaceError):
    """An optional dependency (torch, diffusers, ultralytics) is missing."""


class ModelLoadError(LogoReplaceError):
    """Weights could not be found or loaded."""


class DetectionError(LogoReplaceError):
    """Detection ran but produced nothing usable."""


class InpaintError(LogoReplaceError):
    """The inpainting backend failed."""


class AssetError(LogoReplaceError):
    """An input image or logo is missing or unreadable."""


# --------------------------------------------------------------------------
# logging
# --------------------------------------------------------------------------
def setup_logging(verbose: bool = False) -> logging.Logger:
    """Configure and return the package logger.

    Safe to call more than once — handlers are not duplicated.
    """
    logger = logging.getLogger(LOGGER_NAME)
    logger.setLevel(logging.DEBUG if verbose else logging.INFO)
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stderr)
        handler.setFormatter(logging.Formatter("%(asctime)s  %(levelname)-7s %(message)s", datefmt="%H:%M:%S"))
        logger.addHandler(handler)
    logger.propagate = False
    return logger


def get_logger() -> logging.Logger:
    return logging.getLogger(LOGGER_NAME)


@contextmanager
def timed(label: str) -> Iterator[None]:
    """Log how long a block took, at debug level."""
    started = time.perf_counter()
    try:
        yield
    finally:
        get_logger().debug("%s took %.2fs", label, time.perf_counter() - started)


# --------------------------------------------------------------------------
# geometry
# --------------------------------------------------------------------------
@dataclass(frozen=True)
class BBox:
    """An axis-aligned box in pixel coordinates, ``x2``/``y2`` exclusive."""

    x1: int
    y1: int
    x2: int
    y2: int

    @classmethod
    def from_xywh(cls, x: float, y: float, w: float, h: float) -> "BBox":
        return cls(int(round(x)), int(round(y)), int(round(x + w)), int(round(y + h)))

    @classmethod
    def from_floats(cls, x1: float, y1: float, x2: float, y2: float) -> "BBox":
        return cls(int(round(x1)), int(round(y1)), int(round(x2)), int(round(y2)))

    @property
    def width(self) -> int:
        return max(0, self.x2 - self.x1)

    @property
    def height(self) -> int:
        return max(0, self.y2 - self.y1)

    @property
    def area(self) -> int:
        return self.width * self.height

    @property
    def center(self) -> tuple[float, float]:
        return (self.x1 + self.x2) / 2.0, (self.y1 + self.y2) / 2.0

    @property
    def longest_side(self) -> int:
        return max(self.width, self.height)

    def as_tuple(self) -> tuple[int, int, int, int]:
        return self.x1, self.y1, self.x2, self.y2

    def clamp(self, width: int, height: int) -> "BBox":
        """Clip the box to an image of ``width`` x ``height``."""
        x1 = min(max(0, self.x1), width)
        y1 = min(max(0, self.y1), height)
        x2 = min(max(x1, self.x2), width)
        y2 = min(max(y1, self.y2), height)
        return BBox(x1, y1, x2, y2)

    def expand(self, pixels: int) -> "BBox":
        return BBox(self.x1 - pixels, self.y1 - pixels, self.x2 + pixels, self.y2 + pixels)

    def union(self, other: "BBox") -> "BBox":
        return BBox(
            min(self.x1, other.x1),
            min(self.y1, other.y1),
            max(self.x2, other.x2),
            max(self.y2, other.y2),
        )

    def iou(self, other: "BBox") -> float:
        """Intersection over union with ``other``; 0.0 when they do not touch."""
        ix1, iy1 = max(self.x1, other.x1), max(self.y1, other.y1)
        ix2, iy2 = min(self.x2, other.x2), min(self.y2, other.y2)
        inter = max(0, ix2 - ix1) * max(0, iy2 - iy1)
        if inter == 0:
            return 0.0
        return inter / float(self.area + other.area - inter)

    def to_square(self, width: int, height: int, padding: float = 0.0) -> "BBox":
        """Smallest square containing this box (plus padding), kept in bounds.

        Diffusion models want a square, and a square crop keeps the aspect
        ratio honest so the fill is not stretched when it is pasted back.
        """
        cx, cy = self.center
        side = self.longest_side * (1.0 + 2.0 * padding)
        side = min(max(side, 1.0), float(min(width, height)))
        half = side / 2.0
        x1, y1 = cx - half, cy - half
        # shift rather than clip, so the crop stays square at the edges
        x1 = min(max(0.0, x1), width - side)
        y1 = min(max(0.0, y1), height - side)
        return BBox.from_floats(x1, y1, x1 + side, y1 + side).clamp(width, height)


def merge_boxes(boxes: Iterable[BBox], iou_threshold: float) -> list[BBox]:
    """Fold overlapping boxes together.

    Two detections on the same logo (a mark and its wordmark, say) should be
    cleared and refilled as one region, otherwise the seam between two
    separate inpaints shows.
    """
    remaining = list(boxes)
    merged: list[BBox] = []
    while remaining:
        current = remaining.pop(0)
        changed = True
        while changed:
            changed = False
            for other in list(remaining):
                if current.iou(other) >= iou_threshold:
                    current = current.union(other)
                    remaining.remove(other)
                    changed = True
        merged.append(current)
    return merged


def connected_components(binary: np.ndarray, min_pixels: int = 1) -> list[tuple[BBox, int]]:
    """Label 8-connected blobs in a boolean array; return ``(box, pixels)``.

    Two-pass union-find, written out because neither Pillow nor NumPy ships a
    labeller and this project refuses to require SciPy or OpenCV for it. Only
    ever called on a downscaled analysis image, where the Python loop over set
    pixels costs milliseconds.
    """
    height, width = binary.shape
    labels = np.zeros((height, width), dtype=np.int32)
    parent: list[int] = [0]

    def find(node: int) -> int:
        while parent[node] != node:
            parent[node] = parent[parent[node]]  # path compression
            node = parent[node]
        return node

    def union(left: int, right: int) -> None:
        root_a, root_b = find(left), find(right)
        if root_a != root_b:
            parent[max(root_a, root_b)] = min(root_a, root_b)

    next_label = 1
    for y in range(height):
        for x in np.flatnonzero(binary[y]):
            neighbours = []
            if y > 0:
                for dx in (-1, 0, 1):
                    nx = x + dx
                    if 0 <= nx < width and labels[y - 1, nx]:
                        neighbours.append(int(labels[y - 1, nx]))
            if x > 0 and labels[y, x - 1]:
                neighbours.append(int(labels[y, x - 1]))
            if neighbours:
                smallest = min(neighbours)
                labels[y, x] = smallest
                for other in neighbours:
                    union(smallest, other)
            else:
                parent.append(next_label)
                labels[y, x] = next_label
                next_label += 1

    if next_label == 1:
        return []

    roots = np.array([find(index) for index in range(next_label)], dtype=np.int32)
    resolved = roots[labels]
    counts = np.bincount(resolved.ravel())

    components: list[tuple[BBox, int]] = []
    for label in np.flatnonzero(counts):
        if label == 0 or counts[label] < min_pixels:
            continue
        rows = np.flatnonzero((resolved == label).any(axis=1))
        cols = np.flatnonzero((resolved == label).any(axis=0))
        box = BBox(int(cols[0]), int(rows[0]), int(cols[-1]) + 1, int(rows[-1]) + 1)
        components.append((box, int(counts[label])))
    return components


def parse_boxes(spec: str, width: int, height: int) -> list[BBox]:
    """Parse ``"x,y,w,h; x,y,w,h"`` into boxes.

    Values in ``[0, 1]`` are read as fractions of the image so the same spec
    works across differently sized posters; anything larger is pixels.
    """
    boxes: list[BBox] = []
    for chunk in spec.split(";"):
        chunk = chunk.strip()
        if not chunk:
            continue
        parts = [p for p in chunk.replace(" ", "").split(",") if p]
        if len(parts) != 4:
            raise ValueError(f"box {chunk!r} must have four values: x,y,w,h")
        try:
            x, y, w, h = (float(p) for p in parts)
        except ValueError as exc:
            raise ValueError(f"box {chunk!r} must contain numbers") from exc
        if max(x, y, w, h) <= 1.0:
            x, y, w, h = x * width, y * height, w * width, h * height
        if w <= 0 or h <= 0:
            raise ValueError(f"box {chunk!r} has a non-positive size")
        boxes.append(BBox.from_xywh(x, y, w, h).clamp(width, height))
    if not boxes:
        raise ValueError("no boxes parsed from --boxes")
    return boxes


def snap_to_multiple(value: int, multiple: int = 8) -> int:
    """Round up to a multiple — diffusion VAEs need dimensions divisible by 8."""
    return int(np.ceil(value / multiple) * multiple)


# --------------------------------------------------------------------------
# image IO
# --------------------------------------------------------------------------
def load_image(path: Path, mode: str = "RGB") -> Image.Image:
    """Open an image, apply EXIF rotation and convert to ``mode``."""
    if not path.exists():
        raise AssetError(f"image not found: {path}")
    try:
        with Image.open(path) as handle:
            handle.load()
            image = handle
            try:  # EXIF orientation — phone photos are commonly rotated
                from PIL import ImageOps

                image = ImageOps.exif_transpose(image) or image
            except Exception:  # pragma: no cover - EXIF is best effort
                pass
            return image.convert(mode)
    except AssetError:
        raise
    except Exception as exc:
        raise AssetError(f"could not read image {path}: {exc}") from exc


def save_image(image: Image.Image, path: Path, quality: int = 95) -> Path:
    """Write an image, creating parent directories as needed."""
    ensure_dir(path.parent)
    try:
        if path.suffix.lower() in {".jpg", ".jpeg"}:
            image.convert("RGB").save(path, quality=quality, subsampling=0)
        else:
            image.save(path)
    except Exception as exc:
        raise AssetError(f"could not write image {path}: {exc}") from exc
    return path


def ensure_dir(path: Path) -> Path:
    path.mkdir(parents=True, exist_ok=True)
    return path


def iter_input_images(root: Path, recursive: bool = False) -> list[Path]:
    """List readable images under ``root`` (or ``[root]`` if it is a file)."""
    if root.is_file():
        return [root]
    if not root.exists():
        raise AssetError(f"input path does not exist: {root}")
    pattern = "**/*" if recursive else "*"
    found = [
        candidate
        for candidate in sorted(root.glob(pattern))
        if candidate.is_file() and candidate.suffix.lower() in IMAGE_SUFFIXES
    ]
    return found


# --------------------------------------------------------------------------
# masks
# --------------------------------------------------------------------------
def build_mask(
    size: tuple[int, int],
    boxes: Iterable[BBox],
    dilate: int = 0,
    feather: int = 0,
) -> Image.Image:
    """Render an 8-bit mask: white where the pipeline may repaint.

    ``dilate`` grows each box so anti-aliased logo edges are swallowed by the
    fill instead of leaving a ghost outline; ``feather`` blurs the border so
    the fill fades into the untouched pixels.

    The feather ramps *outwards*: the box plus its dilation stays fully white
    and the blur is added around it. Blurring the box itself would leave the
    outermost ring of the old logo showing through at partial opacity — on a
    bright logo over a dark background that reads as a ghost outline.
    """
    width, height = size
    boxes = list(boxes)
    pixels = np.zeros((height, width), dtype=np.uint8)
    for box in boxes:
        grown = box.expand(dilate + feather).clamp(width, height)
        if grown.area > 0:
            pixels[grown.y1 : grown.y2, grown.x1 : grown.x2] = 255

    mask = Image.fromarray(pixels, mode="L")
    if feather > 0:
        mask = mask.filter(ImageFilter.GaussianBlur(radius=feather))
        core = np.asarray(mask).copy()
        for box in boxes:
            grown = box.expand(dilate).clamp(width, height)
            if grown.area > 0:
                core[grown.y1 : grown.y2, grown.x1 : grown.x2] = 255
        mask = Image.fromarray(core, mode="L")
    return mask


def mask_bounds(mask: Image.Image) -> BBox | None:
    """Bounding box of the non-zero region, or ``None`` for an empty mask."""
    bbox = mask.getbbox()
    if bbox is None:
        return None
    return BBox(*bbox)


# --------------------------------------------------------------------------
# compositing
# --------------------------------------------------------------------------
def trim_transparent(image: Image.Image, threshold: int = 8) -> Image.Image:
    """Crop fully transparent margins so the visible art defines the bounds.

    Logo files routinely ship with generous empty padding; measuring the file
    instead of the artwork makes the logo land small and off-centre.
    """
    if image.mode != "RGBA":
        return image
    alpha = np.array(image.getchannel("A"))
    rows = np.where(alpha.max(axis=1) > threshold)[0]
    cols = np.where(alpha.max(axis=0) > threshold)[0]
    if rows.size == 0 or cols.size == 0:
        return image  # fully transparent: nothing to measure, leave it alone
    return image.crop((int(cols[0]), int(rows[0]), int(cols[-1]) + 1, int(rows[-1]) + 1))


def fit_within(
    source: tuple[int, int],
    target: tuple[int, int],
    scale: float = 1.0,
    max_upscale: float = 4.0,
) -> tuple[int, int]:
    """Largest size that keeps ``source``'s aspect ratio inside ``target``."""
    src_w, src_h = source
    box_w, box_h = target
    if src_w <= 0 or src_h <= 0 or box_w <= 0 or box_h <= 0:
        raise ValueError("fit_within needs positive dimensions")
    factor = min(box_w / src_w, box_h / src_h) * scale
    factor = min(factor, max_upscale)
    return max(1, int(round(src_w * factor))), max(1, int(round(src_h * factor)))


def apply_opacity(image: Image.Image, opacity: float) -> Image.Image:
    """Scale an RGBA image's alpha channel by ``opacity``."""
    if opacity >= 1.0:
        return image
    rgba = image.convert("RGBA")
    alpha = np.array(rgba.getchannel("A"), dtype=np.float32) * max(0.0, opacity)
    rgba.putalpha(Image.fromarray(alpha.astype(np.uint8), mode="L"))
    return rgba


def drop_shadow(
    image: Image.Image,
    blur: int,
    offset: tuple[int, int],
    opacity: float,
    color: str = "#000000",
) -> tuple[Image.Image, tuple[int, int]]:
    """Return ``(shadow_layer, top_left_delta)`` for an RGBA image.

    The layer is larger than the logo (it has to hold the blur), so the caller
    gets back the offset to subtract when positioning it.
    """
    rgba = image.convert("RGBA")
    pad = blur * 2 + max(abs(offset[0]), abs(offset[1])) + 1
    layer = Image.new("RGBA", (rgba.width + pad * 2, rgba.height + pad * 2), (0, 0, 0, 0))

    silhouette = Image.new("RGBA", rgba.size, color)
    alpha = np.array(rgba.getchannel("A"), dtype=np.float32) * max(0.0, min(1.0, opacity))
    silhouette.putalpha(Image.fromarray(alpha.astype(np.uint8), mode="L"))

    layer.paste(silhouette, (pad + offset[0], pad + offset[1]), silhouette)
    if blur > 0:
        layer = layer.filter(ImageFilter.GaussianBlur(radius=blur))
    return layer, (pad, pad)


def paste_rgba(base: Image.Image, overlay: Image.Image, position: tuple[int, int]) -> Image.Image:
    """Alpha-composite ``overlay`` onto a copy of ``base`` at ``position``.

    Unlike ``Image.paste``, this composites correctly when the overlay hangs
    off the canvas edge and when the base itself has an alpha channel.
    """
    canvas = base.convert("RGBA").copy()
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    layer.paste(overlay.convert("RGBA"), position, overlay.convert("RGBA"))
    return Image.alpha_composite(canvas, layer)


def draw_debug_boxes(image: Image.Image, boxes: Iterable[BBox], labels: Iterable[str] | None = None) -> Image.Image:
    """Annotated copy of ``image`` — used only when ``--debug-dir`` is set."""
    from PIL import ImageDraw

    annotated = image.convert("RGB").copy()
    draw = ImageDraw.Draw(annotated)
    width = max(2, int(round(min(annotated.size) * 0.004)))
    label_list = list(labels) if labels is not None else []
    for index, box in enumerate(boxes):
        draw.rectangle(box.as_tuple(), outline=(255, 32, 96), width=width)
        if index < len(label_list):
            draw.text((box.x1 + width + 2, max(0, box.y1 - 14)), label_list[index], fill=(255, 32, 96))
    return annotated


def human_size(size: tuple[int, int]) -> str:
    return f"{size[0]}x{size[1]}"


# --------------------------------------------------------------------------
# torch device resolution (lazy — torch is optional)
# --------------------------------------------------------------------------
def require_module(name: str, package: str, extra: str = ""):
    """Import an optional dependency, or explain precisely what went wrong.

    "Not installed" and "installed but broken" need different fixes, and a
    package installed into a *different* interpreter looks exactly like the
    first while no amount of ``pip install`` fixes it — so the interpreter
    path is part of the message, and the install line uses ``python -m pip``,
    which cannot target the wrong environment.
    """
    hint = f"\n  {extra}" if extra else ""
    try:
        return __import__(name)
    except ImportError as exc:
        missing = (getattr(exc, "name", None) or "").split(".")[0]
        if isinstance(exc, ModuleNotFoundError) and missing == name:
            raise DependencyError(
                f"{name} is required for this step but is not installed in this interpreter.\n"
                f"  python: {sys.executable}\n"
                f"  Install it with:\n  python -m pip install {package}{hint}"
            ) from exc
        # Importable but unusable: a broken wheel, a missing system library
        # (the classic one on Windows is "DLL load failed" from cv2), or a
        # half-installed dependency. Telling the user to pip install here
        # sends them in circles, so surface the real error instead.
        raise DependencyError(
            f"{name} is installed but failed to import:\n"
            f"  {type(exc).__name__}: {exc}\n"
            f"  python: {sys.executable}\n"
            f"  Try: python -m pip install --force-reinstall {package}{hint}"
        ) from exc


def resolve_device(preference: str = "auto") -> str:
    """Turn ``auto`` into a concrete torch device string.

    Falls back to CPU (with a warning) when a specific accelerator was asked
    for but is not present, so a CUDA config still runs on a laptop.
    """
    torch = require_module("torch", "torch --index-url https://download.pytorch.org/whl/cu121")
    if preference != "auto":
        if preference.startswith("cuda") and not torch.cuda.is_available():
            get_logger().warning("CUDA requested but unavailable — falling back to CPU")
            return "cpu"
        if preference == "mps":
            mps = getattr(torch.backends, "mps", None)
            if mps is None or not mps.is_available():
                get_logger().warning("MPS requested but unavailable — falling back to CPU")
                return "cpu"
        return preference
    if torch.cuda.is_available():
        return "cuda"
    mps = getattr(torch.backends, "mps", None)
    if mps is not None and mps.is_available():
        return "mps"
    return "cpu"


def resolve_dtype(preference: str, device: str):
    """Pick a torch dtype: fp16 on CUDA, fp32 elsewhere, unless overridden."""
    torch = require_module("torch", "torch")
    if preference == "fp16":
        return torch.float16
    if preference == "bf16":
        return torch.bfloat16
    if preference == "fp32":
        return torch.float32
    return torch.float16 if device.startswith("cuda") else torch.float32


def describe_device(device: str) -> str:
    """Human-readable device line for the startup log."""
    try:
        torch = __import__("torch")
    except ImportError:
        return device
    if device.startswith("cuda") and torch.cuda.is_available():
        index = int(device.split(":")[1]) if ":" in device else 0
        name = torch.cuda.get_device_name(index)
        total = torch.cuda.get_device_properties(index).total_memory / (1024**3)
        return f"{device} ({name}, {total:.1f} GB)"
    return device
