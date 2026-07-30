"""Configuration for the logo replacement pipeline.

Every knob lives here as a dataclass field. Values can be overridden three
ways, in increasing order of priority:

1. the defaults below,
2. environment variables prefixed with ``LOGO_AI_`` (handy for Docker/CI),
3. command line flags parsed by ``app.py``.

Nothing in this module imports torch, diffusers or ultralytics, so it stays
cheap to import from tests and from the CLI's ``--help`` path.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field, fields, is_dataclass
from pathlib import Path
from typing import Any

ENV_PREFIX = "LOGO_AI_"

#: Repository-relative root of this project. All default paths hang off it so
#: the tool behaves the same regardless of the current working directory.
PROJECT_ROOT = Path(__file__).resolve().parent

#: Image suffixes we are willing to read in batch mode.
IMAGE_SUFFIXES = (".png", ".jpg", ".jpeg", ".webp", ".bmp")


# --------------------------------------------------------------------------
# env helpers
# --------------------------------------------------------------------------
def _env(name: str) -> str | None:
    raw = os.environ.get(ENV_PREFIX + name.upper())
    if raw is None:
        return None
    raw = raw.strip()
    return raw or None


def _env_str(name: str, default: str) -> str:
    return _env(name) or default


def _env_path(name: str, default: Path) -> Path:
    raw = _env(name)
    return Path(raw).expanduser() if raw else default


def _env_int(name: str, default: int) -> int:
    raw = _env(name)
    if raw is None:
        return default
    try:
        return int(raw)
    except ValueError as exc:
        raise ValueError(f"{ENV_PREFIX}{name.upper()} must be an integer, got {raw!r}") from exc


def _env_float(name: str, default: float) -> float:
    raw = _env(name)
    if raw is None:
        return default
    try:
        return float(raw)
    except ValueError as exc:
        raise ValueError(f"{ENV_PREFIX}{name.upper()} must be a number, got {raw!r}") from exc


def _env_bool(name: str, default: bool) -> bool:
    raw = _env(name)
    if raw is None:
        return default
    return raw.lower() in {"1", "true", "yes", "on"}


# --------------------------------------------------------------------------
# config sections
# --------------------------------------------------------------------------
@dataclass
class PathsConfig:
    """Where the pipeline reads from and writes to."""

    input_dir: Path = field(default_factory=lambda: _env_path("INPUT_DIR", PROJECT_ROOT / "input"))
    output_dir: Path = field(default_factory=lambda: _env_path("OUTPUT_DIR", PROJECT_ROOT / "output"))
    #: Transparent PNG that replaces whatever the detector found.
    logo: Path = field(default_factory=lambda: _env_path("LOGO", PROJECT_ROOT / "input" / "new_logo.png"))
    #: Optional directory for masks/crops/annotated frames; ``None`` disables it.
    debug_dir: Path | None = field(default_factory=lambda: _env_path("DEBUG_DIR", Path()) if _env("DEBUG_DIR") else None)
    #: Skip an image when its output already exists.
    overwrite: bool = field(default_factory=lambda: _env_bool("OVERWRITE", True))
    #: Recurse into sub-directories of ``input_dir`` in batch mode.
    recursive: bool = field(default_factory=lambda: _env_bool("RECURSIVE", False))


@dataclass
class DetectConfig:
    """YOLO detection settings."""

    weights: Path = field(default_factory=lambda: _env_path("WEIGHTS", PROJECT_ROOT / "models" / "best.pt"))
    confidence: float = field(default_factory=lambda: _env_float("CONFIDENCE", 0.35))
    #: IoU threshold handed to YOLO's own NMS.
    iou: float = field(default_factory=lambda: _env_float("IOU", 0.45))
    #: Inference resolution; YOLO letterboxes to this internally.
    image_size: int = field(default_factory=lambda: _env_int("IMAGE_SIZE", 960))
    #: Keep at most this many boxes per image (highest confidence first).
    max_detections: int = field(default_factory=lambda: _env_int("MAX_DETECTIONS", 8))
    #: Drop boxes smaller than this fraction of the image area — usually noise.
    min_area_ratio: float = field(default_factory=lambda: _env_float("MIN_AREA_RATIO", 0.0004))
    #: Drop boxes larger than this fraction; a "logo" covering the poster is a
    #: mis-detection, and inpainting it would destroy the artwork.
    max_area_ratio: float = field(default_factory=lambda: _env_float("MAX_AREA_RATIO", 0.5))
    #: Restrict to specific class ids, e.g. ``"0,2"``. Empty means all classes.
    classes: tuple[int, ...] = ()
    #: Boxes overlapping by more than this are merged into one region.
    merge_iou: float = field(default_factory=lambda: _env_float("MERGE_IOU", 0.3))
    #: How many regions ``--auto`` may return. Deliberately 1: the heuristic
    #: ranks well but cannot tell a logo from any other isolated graphic, and
    #: a false positive does not just add a logo — it erases real artwork.
    auto_max_detections: int = field(default_factory=lambda: _env_int("AUTO_MAX_DETECTIONS", 1))


@dataclass
class InpaintConfig:
    """Diffusion (or classical) hole-filling settings."""

    #: One of ``sdxl``, ``classical``, ``none``.
    backend: str = field(default_factory=lambda: _env_str("INPAINT_BACKEND", "sdxl"))
    model_id: str = field(
        default_factory=lambda: _env_str("MODEL_ID", "diffusers/stable-diffusion-xl-1.0-inpainting-0.1")
    )
    prompt: str = field(
        default_factory=lambda: _env_str(
            "PROMPT",
            "clean empty background, seamless continuation of the surrounding "
            "surface, consistent lighting and texture, no text, no logo, no watermark",
        )
    )
    negative_prompt: str = field(
        default_factory=lambda: _env_str(
            "NEGATIVE_PROMPT",
            "text, letters, words, logo, watermark, signature, artifacts, blurry, distorted",
        )
    )
    steps: int = field(default_factory=lambda: _env_int("STEPS", 30))
    guidance_scale: float = field(default_factory=lambda: _env_float("GUIDANCE_SCALE", 7.0))
    #: 1.0 replaces the masked pixels outright, which is what we want here.
    strength: float = field(default_factory=lambda: _env_float("STRENGTH", 0.99))
    #: Diffusion works on a square crop around the mask at this resolution.
    work_size: int = field(default_factory=lambda: _env_int("WORK_SIZE", 1024))
    #: Context kept around the mask, as a fraction of the box's longest side.
    context_padding: float = field(default_factory=lambda: _env_float("CONTEXT_PADDING", 0.6))
    #: Grow the mask before filling so anti-aliased logo edges disappear.
    mask_dilate: int = field(default_factory=lambda: _env_int("MASK_DILATE", 10))
    #: Soften the mask border so the fill blends into untouched pixels.
    mask_feather: int = field(default_factory=lambda: _env_int("MASK_FEATHER", 6))
    #: ``-1`` means "new noise every run".
    seed: int = field(default_factory=lambda: _env_int("SEED", -1))
    #: Halve the working resolution and retry once when CUDA runs out of memory.
    retry_on_oom: bool = field(default_factory=lambda: _env_bool("RETRY_ON_OOM", True))
    #: Move submodules to CPU between steps — slower, but fits in ~6 GB VRAM.
    cpu_offload: bool = field(default_factory=lambda: _env_bool("CPU_OFFLOAD", False))
    #: Fill used when ``backend == "classical"``. ``pillow`` is the built-in
    #: NumPy pyramid fill (no extra dependency); ``telea`` and ``ns`` are
    #: OpenCV's, and fall back to ``pillow`` if cv2 cannot be imported.
    classical_method: str = field(default_factory=lambda: _env_str("CLASSICAL_METHOD", "pillow"))
    classical_radius: int = field(default_factory=lambda: _env_int("CLASSICAL_RADIUS", 7))
    #: Holes wider than this are filled on a downscaled copy — see
    #: ``ClassicalInpainter``. Larger keeps more detail, smaller smears less.
    classical_max_span: int = field(default_factory=lambda: _env_int("CLASSICAL_MAX_SPAN", 96))


@dataclass
class OverlayConfig:
    """How the replacement logo is fitted into the cleared region."""

    #: Fraction of the detected box the logo may occupy (leaves breathing room).
    scale: float = field(default_factory=lambda: _env_float("LOGO_SCALE", 0.92))
    #: ``left`` / ``center`` / ``right``.
    align_x: str = field(default_factory=lambda: _env_str("ALIGN_X", "center"))
    #: ``top`` / ``center`` / ``bottom``.
    align_y: str = field(default_factory=lambda: _env_str("ALIGN_Y", "center"))
    #: Crop fully transparent margins off the logo before measuring it, so
    #: centering is based on the visible artwork rather than the file's canvas.
    trim_transparent: bool = field(default_factory=lambda: _env_bool("TRIM_TRANSPARENT", True))
    #: Never upscale a small logo beyond this multiple of its native size.
    max_upscale: float = field(default_factory=lambda: _env_float("MAX_UPSCALE", 4.0))
    opacity: float = field(default_factory=lambda: _env_float("LOGO_OPACITY", 1.0))
    shadow: bool = field(default_factory=lambda: _env_bool("SHADOW", True))
    shadow_opacity: float = field(default_factory=lambda: _env_float("SHADOW_OPACITY", 0.35))
    #: Blur radius and offset are fractions of the logo's longest side, so the
    #: shadow looks the same on a 400 px poster and a 4000 px one.
    shadow_blur: float = field(default_factory=lambda: _env_float("SHADOW_BLUR", 0.035))
    shadow_offset: float = field(default_factory=lambda: _env_float("SHADOW_OFFSET", 0.018))
    shadow_color: str = field(default_factory=lambda: _env_str("SHADOW_COLOR", "#000000"))
    #: Blend the logo into the page: match its grain, and keep it legible
    #: against whatever it lands on.
    realistic: bool = field(default_factory=lambda: _env_bool("REALISTIC", True))
    #: Add the backdrop's measured film grain to the logo. Zero on flat art.
    match_grain: bool = field(default_factory=lambda: _env_bool("MATCH_GRAIN", True))
    #: WCAG contrast ratio below which the logo gets a separating halo.
    min_contrast: float = field(default_factory=lambda: _env_float("MIN_CONTRAST", 2.0))


@dataclass
class RuntimeConfig:
    """Process-wide behaviour."""

    #: ``auto`` resolves to cuda → mps → cpu.
    device: str = field(default_factory=lambda: _env_str("DEVICE", "auto"))
    #: ``auto`` picks fp16 on CUDA and fp32 everywhere else.
    dtype: str = field(default_factory=lambda: _env_str("DTYPE", "auto"))
    verbose: bool = field(default_factory=lambda: _env_bool("VERBOSE", False))
    #: Keep going when one image in a batch fails.
    continue_on_error: bool = field(default_factory=lambda: _env_bool("CONTINUE_ON_ERROR", True))
    #: Report what would happen without writing anything.
    dry_run: bool = field(default_factory=lambda: _env_bool("DRY_RUN", False))


@dataclass
class Config:
    """The full configuration tree."""

    paths: PathsConfig = field(default_factory=PathsConfig)
    detect: DetectConfig = field(default_factory=DetectConfig)
    inpaint: InpaintConfig = field(default_factory=InpaintConfig)
    overlay: OverlayConfig = field(default_factory=OverlayConfig)
    runtime: RuntimeConfig = field(default_factory=RuntimeConfig)

    # -- validation -------------------------------------------------------
    def validate(self) -> None:
        """Fail loudly on nonsense values before any model is loaded.

        Model downloads take minutes; a typo'd ``--scale`` should not cost that.
        """
        errors: list[str] = []

        if not 0.0 < self.detect.confidence <= 1.0:
            errors.append("detect.confidence must be in (0, 1]")
        if not 0.0 <= self.detect.iou <= 1.0:
            errors.append("detect.iou must be in [0, 1]")
        if self.detect.image_size < 64:
            errors.append("detect.image_size must be at least 64")
        if self.detect.max_detections < 1:
            errors.append("detect.max_detections must be at least 1")
        if self.detect.auto_max_detections < 1:
            errors.append("detect.auto_max_detections must be at least 1")
        if not 0.0 <= self.detect.min_area_ratio < self.detect.max_area_ratio <= 1.0:
            errors.append("detect.min_area_ratio must be below max_area_ratio, both within [0, 1]")

        if self.inpaint.backend not in {"sdxl", "classical", "none"}:
            errors.append("inpaint.backend must be one of: sdxl, classical, none")
        if self.inpaint.classical_method not in {"pillow", "telea", "ns"}:
            errors.append("inpaint.classical_method must be 'pillow', 'telea' or 'ns'")
        if self.inpaint.classical_max_span < 16:
            errors.append("inpaint.classical_max_span must be at least 16")
        if self.inpaint.classical_radius < 1:
            errors.append("inpaint.classical_radius must be at least 1")
        if self.inpaint.steps < 1:
            errors.append("inpaint.steps must be at least 1")
        if not 0.0 < self.inpaint.strength <= 1.0:
            errors.append("inpaint.strength must be in (0, 1]")
        if self.inpaint.work_size < 256:
            errors.append("inpaint.work_size must be at least 256")
        if self.inpaint.mask_dilate < 0 or self.inpaint.mask_feather < 0:
            errors.append("inpaint.mask_dilate and mask_feather must be >= 0")

        if not 0.0 < self.overlay.scale <= 1.0:
            errors.append("overlay.scale must be in (0, 1]")
        if not 0.0 <= self.overlay.opacity <= 1.0:
            errors.append("overlay.opacity must be in [0, 1]")
        if self.overlay.align_x not in {"left", "center", "right"}:
            errors.append("overlay.align_x must be left, center or right")
        if self.overlay.align_y not in {"top", "center", "bottom"}:
            errors.append("overlay.align_y must be top, center or bottom")
        if self.overlay.max_upscale < 1.0:
            errors.append("overlay.max_upscale must be at least 1.0")
        if not 1.0 <= self.overlay.min_contrast <= 21.0:
            errors.append("overlay.min_contrast must be in [1, 21] (WCAG contrast ratio)")

        if self.runtime.device not in {"auto", "cpu", "cuda", "mps"} and not self.runtime.device.startswith("cuda:"):
            errors.append("runtime.device must be auto, cpu, mps, cuda or cuda:N")
        if self.runtime.dtype not in {"auto", "fp16", "fp32", "bf16"}:
            errors.append("runtime.dtype must be auto, fp16, bf16 or fp32")

        if errors:
            raise ValueError("Invalid configuration:\n  - " + "\n  - ".join(errors))

    # -- introspection ----------------------------------------------------
    def to_dict(self) -> dict[str, Any]:
        """Plain-data view of the config, for logging and debug dumps."""
        return _as_plain(self)


def _as_plain(value: Any) -> Any:
    if is_dataclass(value) and not isinstance(value, type):
        return {f.name: _as_plain(getattr(value, f.name)) for f in fields(value)}
    if isinstance(value, Path):
        return str(value)
    if isinstance(value, tuple):
        return list(value)
    return value


def load_config() -> Config:
    """Build a config from defaults plus ``LOGO_AI_*`` environment variables."""
    config = Config()
    raw_classes = _env("CLASSES")
    if raw_classes:
        config.detect.classes = tuple(int(part) for part in raw_classes.replace(" ", "").split(",") if part)
    return config
