"""Removing the old logo.

Three backends share one interface:

``sdxl``       Stable Diffusion XL inpainting — best quality, needs a GPU and
               a few GB of downloaded weights.
``classical``  A NumPy pyramid fill (or OpenCV, if installed) — instant,
               CPU-only, good enough for flat or lightly textured backgrounds.
``none``       Leave the pixels alone; the new logo is pasted straight on top.

The diffusion backend works on a square crop around each masked region rather
than on the whole poster: a 4000 px poster squeezed into 1024 px would come
back soft everywhere, whereas a crop keeps full detail where it matters and
leaves every pixel outside the mask bit-for-bit identical.
"""

from __future__ import annotations

from typing import Protocol, Sequence

import numpy as np
from PIL import Image, ImageFilter

from config import Config
from utils import (
    BBox,
    DependencyError,
    InpaintError,
    ModelLoadError,
    get_logger,
    mask_bounds,
    require_module,
    resolve_device,
    resolve_dtype,
    snap_to_multiple,
    timed,
)


class Inpainter(Protocol):
    """Fills the white areas of ``mask`` in ``image``."""

    name: str

    def fill(self, image: Image.Image, mask: Image.Image, regions: Sequence[BBox]) -> Image.Image: ...


# --------------------------------------------------------------------------
# shared helpers
# --------------------------------------------------------------------------
def _composite(base: Image.Image, filled: Image.Image, mask: Image.Image) -> Image.Image:
    """Blend ``filled`` over ``base`` weighted by ``mask``.

    Doing this by hand rather than with ``Image.paste`` keeps the feathered
    edge smooth and guarantees that a zero mask changes nothing at all.
    """
    base_arr = np.asarray(base.convert("RGB"), dtype=np.float32)
    fill_arr = np.asarray(filled.convert("RGB").resize(base.size, Image.LANCZOS), dtype=np.float32)
    alpha = np.asarray(mask.convert("L").resize(base.size, Image.LANCZOS), dtype=np.float32)[..., None] / 255.0
    blended = base_arr * (1.0 - alpha) + fill_arr * alpha
    return Image.fromarray(np.clip(blended, 0, 255).astype(np.uint8), mode="RGB")


def _regions_from(mask: Image.Image, regions: Sequence[BBox]) -> list[BBox]:
    """Use the caller's regions, or fall back to the mask's own bounds."""
    if regions:
        return list(regions)
    bounds = mask_bounds(mask)
    return [bounds] if bounds is not None else []


# --------------------------------------------------------------------------
# backends
# --------------------------------------------------------------------------
class NoOpInpainter:
    """Returns the image untouched — the new logo simply covers the old one."""

    name = "none"

    def fill(self, image: Image.Image, mask: Image.Image, regions: Sequence[BBox]) -> Image.Image:
        get_logger().debug("inpaint backend 'none': leaving background as-is")
        return image.convert("RGB")


def _downsample(array: np.ndarray) -> np.ndarray:
    """Average 2x2 blocks, repeating the last row/column on odd sizes."""
    if array.shape[0] % 2:
        array = np.concatenate([array, array[-1:]], axis=0)
    if array.shape[1] % 2:
        array = np.concatenate([array, array[:, -1:]], axis=1)
    height, width = array.shape[:2]
    return array.reshape(height // 2, 2, width // 2, 2, array.shape[2]).mean(axis=(1, 3))


def _upsample(array: np.ndarray, shape: tuple[int, int]) -> np.ndarray:
    """Bilinear resize to ``shape``, channel by channel.

    Nearest-neighbour is the textbook choice here and it is visibly wrong:
    every pyramid level stamps its own 2x2 blocks into the hole, and the
    upscale back to full resolution turns them into a quilt.
    """
    height, width, channels = array.shape
    if (height, width) == shape:
        return array
    out = np.empty((shape[0], shape[1], channels), dtype=np.float32)
    for channel in range(channels):
        plane = Image.fromarray(array[..., channel].astype(np.float32), mode="F")
        out[..., channel] = np.asarray(plane.resize((shape[1], shape[0]), Image.BILINEAR), dtype=np.float32)
    return out


def _pull_push_fill(rgb: np.ndarray, known: np.ndarray, eps: float = 1e-6) -> np.ndarray:
    """Fill holes with a weighted image pyramid — the pull-push algorithm.

    Pull: repeatedly halve the image, carrying a weight channel that records
    how much real pixel data went into each sample, until the hole is smaller
    than a pixel and every sample is backed by something real. Push: walk back
    down, using the coarse level to fill wherever the fine level has no data.

    The result is a smooth extrapolation of the surrounding colour and
    gradient into the hole — which is what a poster background usually is —
    and it needs nothing but NumPy.
    """
    weights = known[..., None].astype(np.float32)
    pyramid = [(rgb.astype(np.float32) * weights, weights)]
    while min(pyramid[-1][0].shape[:2]) > 2:
        image_level, weight_level = pyramid[-1]
        pyramid.append((_downsample(image_level), _downsample(weight_level)))

    # Coarsest level: normalise so it holds colours rather than colour x weight.
    image_level, weight_level = pyramid[-1]
    coarse = image_level / np.maximum(weight_level, eps)

    for index in range(len(pyramid) - 2, -1, -1):
        image_level, weight_level = pyramid[index]
        shape = image_level.shape[:2]
        parent = _upsample(coarse, shape)
        # Where this level has data, keep it; elsewhere take the parent's.
        alpha = np.clip(weight_level, 0.0, 1.0)
        here = image_level / np.maximum(weight_level, eps)
        coarse = alpha * here + (1.0 - alpha) * parent

    return _relax(np.clip(coarse, 0.0, 255.0), rgb.astype(np.float32), known)


def _flat_backdrop(image: Image.Image, hard: Image.Image, tolerance: float = 14.0) -> np.ndarray | None:
    """The single colour surrounding the hole, or ``None`` if it is not plain.

    Judged on the ring's *modal* colour rather than its median. Erasing a line
    of type puts its neighbours in the ring, so 30-40% of the samples are ink;
    a median survives that but the "how much of the ring sits near it" test
    does not — measured on a real contact block, text lines scored 0.68 and a
    gradient 0.60, which is no separation at all. Against the mode the same
    cases score 0.60-0.93 and 0.26.
    """
    mask = np.asarray(hard.convert("L")) > 127
    if not mask.any():
        return None
    margin = max(3, int(round(min(image.size) * 0.03)) | 1)
    grown = np.asarray(hard.convert("L").filter(ImageFilter.MaxFilter(margin))) > 127
    ring = grown & ~mask
    if ring.sum() < 40:
        return None

    rgb = np.asarray(image.convert("RGB"), dtype=np.float32)
    samples = rgb[ring]

    bucket = 12.0
    quantised = np.round(samples / bucket).astype(np.int32)
    keys, counts = np.unique(quantised, axis=0, return_counts=True)
    mode = keys[counts.argmax()].astype(np.float32) * bucket

    inliers = np.linalg.norm(samples - mode, axis=1) <= tolerance
    if inliers.mean() < 0.45:
        return None
    return samples[inliers].mean(axis=0)


def _relax(filled: np.ndarray, original: np.ndarray, known: np.ndarray, passes: int = 2) -> np.ndarray:
    """Settle the fill against the pixels immediately around the hole.

    The pyramid's coarse levels average colour from far away, so a hole in a
    white margin next to a blue panel comes back faintly blue. Repeatedly
    blurring and re-imposing the known pixels is a discrete Laplace solve: the
    inside of the hole converges on the colours at its own edge instead.

    Each blur moves colour about its own radius, so the radii have to start
    at the scale of the hole itself and halve from there — fixed constants
    leave the middle of a wide hole holding whatever the pyramid guessed
    (measured: 222,227,237 in a hole that should have come back white).
    """
    weight = known[..., None].astype(np.float32)
    out = filled

    hole = known < 0.5
    if not hole.any():
        return filled
    rows = np.flatnonzero(hole.any(axis=1))
    cols = np.flatnonzero(hole.any(axis=0))
    span = float(max(rows[-1] - rows[0], cols[-1] - cols[0]) + 1)

    radii: list[float] = []
    radius = max(2.0, span / 2.0)
    while radius >= 1.0:
        radii.append(radius)
        radius /= 2.0
    radii.append(1.0)

    for radius in radii:
        for _ in range(passes):
            blurred = np.asarray(
                Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).filter(
                    ImageFilter.GaussianBlur(radius)
                ),
                dtype=np.float32,
            )
            out = weight * original + (1.0 - weight) * blurred
    return np.clip(out, 0.0, 255.0)


class ClassicalInpainter:
    """Fast, model-free background fill.

    No download, no GPU, milliseconds per image. Two implementations:

    * **pillow** (default) — a pull-push pyramid fill in pure NumPy. Smooth
      extrapolation of the surrounding colour, no extra dependency.
    * **telea / ns** — OpenCV's edge-propagating algorithms, used when
      ``opencv-python`` is importable and asked for.

    Either way, wide holes are filled on a downscaled copy and the patch is
    scaled back up. Both OpenCV algorithms fan colour in from the hole's rim
    and smear visibly on anything wider than ~100 px; filling small and
    enlarging gives a smooth continuation instead. Small holes are filled at
    full resolution, where the rim really does carry the right detail.
    """

    name = "classical"

    def __init__(self, config: Config) -> None:
        self._config = config
        self._warned_about_cv2 = False

    def fill(self, image: Image.Image, mask: Image.Image, regions: Sequence[BBox]) -> Image.Image:
        cfg = self._config.inpaint
        rgb = image.convert("RGB")
        # The fill wants a hard mask; the feathered one is kept for the final
        # composite so the repaired patch still blends at its border.
        hard = Image.fromarray((np.asarray(mask.convert("L")) > 16).astype(np.uint8) * 255, mode="L")
        bounds = mask_bounds(hard)
        if bounds is None:
            return rgb

        span = max(1, bounds.longest_side)
        factor = min(1.0, cfg.classical_max_span / span)

        work_image, work_hard = rgb, hard
        if factor < 1.0:
            size = (max(32, int(round(rgb.width * factor))), max(32, int(round(rgb.height * factor))))
            get_logger().debug("classical fill: %dpx hole → working at %s", span, size)
            work_image = rgb.resize(size, Image.LANCZOS)
            # BOX + "any coverage" keeps the shrunken mask at least as wide as
            # the hole; a nearest-neighbour resize would drop thin edges and
            # leave slivers of the old logo behind.
            work_hard = hard.resize(size, Image.BOX).point(lambda v: 255 if v > 0 else 0)

        filled = self._fill_patch(work_image, work_hard, factor)
        return _composite(rgb, filled, mask)

    # -- implementations --------------------------------------------------
    def _fill_patch(self, image: Image.Image, hard: Image.Image, factor: float) -> Image.Image:
        flat = _flat_backdrop(image, hard)
        if flat is not None:
            # The hole sits on plain paper — a template's white margin, a solid
            # panel. Any diffusion here is strictly worse than the right
            # answer: it drags in the nearest headline and leaves a faint grey
            # rectangle (measured 239,241,247 where the page is pure white).
            get_logger().debug("classical fill: flat backdrop rgb%s", tuple(int(v) for v in flat))
            return Image.new("RGB", image.size, tuple(int(v) for v in flat))

        method = self._config.inpaint.classical_method
        if method in {"telea", "ns"}:
            cv2 = self._try_opencv()
            if cv2 is not None:
                return self._fill_opencv(cv2, image, hard, factor)
        return self._fill_pyramid(image, hard)

    def _try_opencv(self):
        """Import cv2, or fall back with one warning per run.

        A broken OpenCV install — a missing system DLL is the usual cause on
        Windows — should not stop a fill that NumPy can do perfectly well.
        """
        try:
            return require_module("cv2", "opencv-python")
        except DependencyError as exc:
            if not self._warned_about_cv2:
                get_logger().warning(
                    "%s\n  Falling back to the built-in NumPy fill "
                    "(--classical-method pillow to silence this).",
                    exc,
                )
                self._warned_about_cv2 = True
            return None

    def _fill_opencv(self, cv2, image: Image.Image, hard: Image.Image, factor: float) -> Image.Image:
        cfg = self._config.inpaint
        algorithm = cv2.INPAINT_TELEA if cfg.classical_method == "telea" else cv2.INPAINT_NS
        radius = max(3, int(round(cfg.classical_radius * (factor if factor < 1.0 else 1.0))))
        try:
            with timed("classical inpaint (opencv)"):
                filled = cv2.inpaint(np.asarray(image)[:, :, ::-1].copy(), np.asarray(hard), radius, algorithm)
        except Exception as exc:
            raise InpaintError(f"OpenCV inpainting failed: {exc}") from exc
        return Image.fromarray(filled[:, :, ::-1])

    def _fill_pyramid(self, image: Image.Image, hard: Image.Image) -> Image.Image:
        rgb = np.asarray(image, dtype=np.float32)
        known = 1.0 - (np.asarray(hard, dtype=np.float32) / 255.0)
        if not known.any():
            raise InpaintError("the mask covers the whole image — nothing left to fill from")
        with timed("classical inpaint (pyramid)"):
            filled = _pull_push_fill(rgb, known)
        result = Image.fromarray(filled.astype(np.uint8), mode="RGB")
        # The pyramid's nearest-neighbour upsampling leaves faint 2x2 steps;
        # a sub-pixel blur removes them without touching real detail, which
        # the composite restores outside the mask anyway.
        return result.filter(ImageFilter.GaussianBlur(radius=0.8))


class SDXLInpainter:
    """Stable Diffusion XL inpainting via ``diffusers``.

    The pipeline is loaded once and reused across a batch — loading it costs
    far more than running it, which is the whole reason batch mode exists.
    """

    name = "sdxl"

    def __init__(self, config: Config) -> None:
        self._config = config
        self._pipe = None
        self._device = "cpu"

    # -- model ------------------------------------------------------------
    def load(self) -> None:
        if self._pipe is not None:
            return
        cfg = self._config.inpaint
        diffusers = require_module("diffusers", "diffusers transformers accelerate safetensors")
        torch = require_module("torch", "torch")

        device = resolve_device(self._config.runtime.device)
        dtype = resolve_dtype(self._config.runtime.dtype, device)
        logger = get_logger()
        logger.info("Loading inpainting model %s on %s (%s)", cfg.model_id, device, str(dtype).replace("torch.", ""))
        if device == "cpu":
            logger.warning("Running SDXL on CPU — expect minutes per image. Use --inpaint classical for a fast preview.")

        kwargs = {"torch_dtype": dtype}
        if dtype == torch.float16:
            # Most SDXL repos ship an fp16 branch; fall back if this one doesn't.
            kwargs["variant"] = "fp16"
        try:
            with timed("sdxl load"):
                try:
                    pipe = diffusers.AutoPipelineForInpainting.from_pretrained(cfg.model_id, **kwargs)
                except (OSError, ValueError):
                    kwargs.pop("variant", None)
                    pipe = diffusers.AutoPipelineForInpainting.from_pretrained(cfg.model_id, **kwargs)
        except Exception as exc:
            raise ModelLoadError(
                f"could not load inpainting model {cfg.model_id!r}: {exc}\n"
                "  Check the model id, your internet connection, and the HF cache location (HF_HOME)."
            ) from exc

        pipe.set_progress_bar_config(disable=not self._config.runtime.verbose)
        if cfg.cpu_offload and device.startswith("cuda"):
            pipe.enable_model_cpu_offload()
        else:
            pipe.to(device)
        # Cheap memory wins that cost a few percent of speed.
        for enable in ("enable_attention_slicing", "enable_vae_slicing", "enable_vae_tiling"):
            hook = getattr(pipe, enable, None)
            if callable(hook):
                try:
                    hook()
                except Exception:  # pragma: no cover - optional optimisation
                    pass

        self._pipe = pipe
        self._device = device

    # -- inference --------------------------------------------------------
    def fill(self, image: Image.Image, mask: Image.Image, regions: Sequence[BBox]) -> Image.Image:
        targets = _regions_from(mask, regions)
        if not targets:
            return image.convert("RGB")
        self.load()
        result = image.convert("RGB")
        for index, region in enumerate(targets, start=1):
            get_logger().debug("inpainting region %d/%d %s", index, len(targets), region.as_tuple())
            result = self._fill_region(result, mask, region)
        return result

    def _fill_region(self, image: Image.Image, mask: Image.Image, region: BBox) -> Image.Image:
        cfg = self._config.inpaint
        width, height = image.size
        crop_box = region.to_square(width, height, padding=cfg.context_padding)
        if crop_box.area <= 0:
            return image

        image_crop = image.crop(crop_box.as_tuple())
        mask_crop = mask.crop(crop_box.as_tuple())
        if not np.asarray(mask_crop).any():
            return image

        work = snap_to_multiple(min(cfg.work_size, max(crop_box.width, crop_box.height, 512)), 8)
        filled_crop = self._run_pipeline(image_crop, mask_crop, work)

        merged_crop = _composite(image_crop, filled_crop, mask_crop)
        output = image.copy()
        output.paste(merged_crop, (crop_box.x1, crop_box.y1))
        return output

    def _run_pipeline(self, image_crop: Image.Image, mask_crop: Image.Image, work: int) -> Image.Image:
        """Run diffusion at ``work`` px, halving once if CUDA runs out of memory."""
        cfg = self._config.inpaint
        torch = require_module("torch", "torch")
        assert self._pipe is not None

        generator = None
        if cfg.seed >= 0:
            generator = torch.Generator(device="cpu" if self._device == "mps" else self._device)
            generator.manual_seed(cfg.seed)

        attempts = [work]
        if cfg.retry_on_oom and work > 512:
            attempts.append(snap_to_multiple(work // 2, 8))

        last_error: Exception | None = None
        for size in attempts:
            small_image = image_crop.resize((size, size), Image.LANCZOS)
            small_mask = mask_crop.resize((size, size), Image.LANCZOS)
            try:
                with timed(f"sdxl {size}px"):
                    out = self._pipe(
                        prompt=cfg.prompt,
                        negative_prompt=cfg.negative_prompt,
                        image=small_image,
                        mask_image=small_mask,
                        num_inference_steps=cfg.steps,
                        guidance_scale=cfg.guidance_scale,
                        strength=cfg.strength,
                        height=size,
                        width=size,
                        generator=generator,
                    )
                return out.images[0].resize(image_crop.size, Image.LANCZOS)
            except Exception as exc:  # noqa: BLE001 - re-raised below
                last_error = exc
                if not _is_oom(exc) or size == attempts[-1]:
                    break
                get_logger().warning("Out of memory at %dpx — retrying at %dpx", size, attempts[-1])
                _empty_cache()

        raise InpaintError(f"SDXL inpainting failed: {last_error}") from last_error


def _is_oom(exc: Exception) -> bool:
    text = str(exc).lower()
    return "out of memory" in text or exc.__class__.__name__ == "OutOfMemoryError"


def _empty_cache() -> None:
    try:
        import torch

        if torch.cuda.is_available():
            torch.cuda.empty_cache()
    except Exception:  # pragma: no cover - best effort
        pass


def build_inpainter(config: Config) -> Inpainter:
    """Instantiate the backend named in the configuration."""
    backend = config.inpaint.backend
    if backend == "sdxl":
        return SDXLInpainter(config)
    if backend == "classical":
        return ClassicalInpainter(config)
    if backend == "none":
        return NoOpInpainter()
    raise InpaintError(f"unknown inpaint backend {backend!r}")
