"""Logo detection.

Wraps an Ultralytics YOLO model behind a small interface, plus a manual
detector used when the boxes are already known (``--boxes``) — that path also
lets the rest of the pipeline be exercised without any weights on disk.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

import numpy as np
from PIL import Image, ImageFilter

from config import Config
from utils import (
    BBox,
    DetectionError,
    ModelLoadError,
    connected_components,
    get_logger,
    merge_boxes,
    parse_boxes,
    require_module,
    resolve_device,
    timed,
)


@dataclass(frozen=True)
class Detection:
    """One detected logo."""

    box: BBox
    confidence: float
    class_id: int = 0
    class_name: str = "logo"

    def label(self) -> str:
        return f"{self.class_name} {self.confidence:.2f}"


class Detector(Protocol):
    """Anything that can find logos in an image."""

    def detect(self, image: Image.Image) -> list[Detection]: ...


class YoloLogoDetector:
    """Ultralytics YOLO detector.

    The model is loaded on first use, not in ``__init__``, so building the
    pipeline stays instant and a bad path is reported next to the image it
    affects rather than at import time.
    """

    def __init__(self, config: Config) -> None:
        self._config = config
        self._model = None
        self._names: dict[int, str] = {}

    # -- model ------------------------------------------------------------
    @property
    def weights(self) -> Path:
        return self._config.detect.weights

    def load(self) -> None:
        if self._model is not None:
            return
        weights = self.weights
        if not weights.exists():
            raise ModelLoadError(
                f"YOLO weights not found at {weights}.\n"
                "  Put your trained logo model there (models/best.pt), or pass --weights /path/to/best.pt.\n"
                "  No trained model yet? Use --auto to find logos by image analysis,\n"
                "  or --boxes x,y,w,h to place them manually."
            )
        ultralytics = require_module(
            "ultralytics",
            "ultralytics",
            extra="(this also pulls in torch — see requirements.txt)",
        )
        device = resolve_device(self._config.runtime.device)
        get_logger().info("Loading YOLO weights %s on %s", weights.name, device)
        try:
            with timed("yolo load"):
                model = ultralytics.YOLO(str(weights))
                model.to(device)
        except Exception as exc:
            raise ModelLoadError(f"could not load YOLO weights {weights}: {exc}") from exc
        self._model = model
        raw_names = getattr(model, "names", {}) or {}
        self._names = {int(k): str(v) for k, v in dict(raw_names).items()}

    # -- inference --------------------------------------------------------
    def detect(self, image: Image.Image) -> list[Detection]:
        """Run YOLO and return filtered, merged, confidence-sorted detections."""
        self.load()
        assert self._model is not None
        cfg = self._config.detect
        width, height = image.size

        try:
            with timed("yolo inference"):
                results = self._model.predict(
                    source=image,
                    conf=cfg.confidence,
                    iou=cfg.iou,
                    imgsz=cfg.image_size,
                    max_det=max(cfg.max_detections * 4, cfg.max_detections),
                    classes=list(cfg.classes) or None,
                    verbose=False,
                )
        except Exception as exc:
            raise DetectionError(f"YOLO inference failed: {exc}") from exc

        detections: list[Detection] = []
        for result in results:
            boxes = getattr(result, "boxes", None)
            if boxes is None:
                continue
            for row in boxes:
                x1, y1, x2, y2 = (float(v) for v in row.xyxy[0].tolist())
                class_id = int(row.cls[0]) if row.cls is not None else 0
                detections.append(
                    Detection(
                        box=BBox.from_floats(x1, y1, x2, y2).clamp(width, height),
                        confidence=float(row.conf[0]) if row.conf is not None else 0.0,
                        class_id=class_id,
                        class_name=self._names.get(class_id, "logo"),
                    )
                )

        return postprocess(detections, (width, height), self._config)


class HeuristicLogoDetector:
    """Finds logo-like regions with image analysis instead of a trained model.

    There is no notion of "logo" without training data, so this looks for what
    logos physically are on a poster: a small, busy, colour-distinct island
    surrounded by calm background. Six signals are scored per candidate —

    * **saliency** — local edge density plus distance from a heavily blurred
      version of the image, i.e. detail that departs from its surroundings;
    * **isolation** — how much calmer the ring around the candidate is than
      the candidate itself. Body copy sits inside busy text blocks; a logo
      sits in space;
    * **size** — logos occupy a small but not tiny share of a poster;
    * **aspect** — a logo is a block, a line of type is a long thin strip;
    * **colour** — logos carry a brand hue, type is usually flat ink;
    * **placement** — a mild preference for corners, where logos usually go.

    Aspect and colour exist because without them an isolated subtitle word
    outranks the real logo — that single change took the benchmark from 11/16
    to 13/16.

    Measured on synthetic posters with known logo positions (varied
    backgrounds, seven placements, with and without a card behind the logo):
    **71% top-1 hit, 15% partial, 15% miss** across three held-out seeds. Good
    enough to drive a batch you will review; not good enough to trust blind.
    It cannot tell a logo from any other isolated graphic — a QR code, a
    badge, a stylised headline. Check ``--debug-dir`` output, and use
    ``--boxes`` or a trained model when accuracy has to be higher.
    """

    #: Longest side of the downscaled image all the analysis runs on. Small
    #: enough to be fast, large enough to keep a logo several pixels wide.
    ANALYSIS_SIZE = 512

    def __init__(self, config: Config) -> None:
        self._config = config

    # -- public -----------------------------------------------------------
    def detect(self, image: Image.Image) -> list[Detection]:
        cfg = self._config.detect
        small, scale = self._downscale(image)
        saliency = self._saliency(small)
        chroma = _chroma(small)
        binary = self._binarise(saliency)

        min_pixels = max(4, int(binary.size * cfg.min_area_ratio))
        components = connected_components(binary, min_pixels=min_pixels)
        if not components:
            get_logger().debug("heuristic detector: no candidate regions")
            return []

        width, height = image.size
        candidates: list[Detection] = []
        for box, pixels in components:
            score = self._score(box, pixels, saliency, chroma, binary.shape)
            if score <= 0:
                continue
            full = BBox.from_floats(box.x1 / scale, box.y1 / scale, box.x2 / scale, box.y2 / scale)
            candidates.append(Detection(box=full.clamp(width, height), confidence=score, class_name="auto"))

        candidates.sort(key=lambda d: d.confidence, reverse=True)
        get_logger().debug(
            "heuristic detector: %d candidate(s), best scores %s",
            len(candidates),
            [round(d.confidence, 2) for d in candidates[:5]],
        )
        limit = min(cfg.auto_max_detections, cfg.max_detections)
        kept = [d for d in candidates if d.confidence >= cfg.confidence][:limit]
        if not kept and candidates:
            get_logger().debug(
                "heuristic detector: best score %.2f is below --conf %.2f",
                candidates[0].confidence,
                cfg.confidence,
            )
        return postprocess(kept, (width, height), self._config)

    # -- steps ------------------------------------------------------------
    def _downscale(self, image: Image.Image) -> tuple[Image.Image, float]:
        longest = max(image.size)
        scale = min(1.0, self.ANALYSIS_SIZE / longest)
        if scale >= 1.0:
            return image.convert("RGB"), 1.0
        size = (max(16, int(round(image.width * scale))), max(16, int(round(image.height * scale))))
        return image.convert("RGB").resize(size, Image.LANCZOS), size[0] / image.width

    def _saliency(self, image: Image.Image) -> np.ndarray:
        """Per-pixel "this does not belong to the background" score, 0-1."""
        rgb = np.asarray(image, dtype=np.float32)
        reference = max(image.size)

        gray = np.asarray(image.convert("L"), dtype=np.float32)
        gradient = np.zeros_like(gray)
        gradient[:, :-1] += np.abs(np.diff(gray, axis=1))
        gradient[:-1, :] += np.abs(np.diff(gray, axis=0))
        edge_density = _blur(gradient, max(1.0, reference * 0.012))

        background = np.asarray(
            image.filter(ImageFilter.GaussianBlur(max(2.0, reference * 0.06))),
            dtype=np.float32,
        )
        colour_distance = np.sqrt(((rgb - background) ** 2).sum(axis=2))
        colour_distance = _blur(colour_distance, max(1.0, reference * 0.012))

        return np.clip(0.6 * _normalise(edge_density) + 0.4 * _normalise(colour_distance), 0.0, 1.0)

    def _binarise(self, saliency: np.ndarray) -> np.ndarray:
        """Keep the busiest areas, then close gaps so strokes become blobs.

        A wordmark is a row of disconnected letters; without the closing step
        every letter would be its own candidate.
        """
        cutoff = max(0.22, float(np.percentile(saliency, 86)))
        mask = Image.fromarray(((saliency >= cutoff) * 255).astype(np.uint8), mode="L")
        radius = max(3, int(round(max(mask.size) * 0.02)) | 1)  # MaxFilter needs odd
        mask = mask.filter(ImageFilter.MaxFilter(radius)).filter(ImageFilter.MinFilter(radius))
        return np.asarray(mask) > 127

    #: Signal weights, tuned against a benchmark of synthetic posters with
    #: known logo positions. They sum to 1 so the score reads as 0-1.
    WEIGHTS = {
        "saliency": 0.26,
        "isolation": 0.20,
        "size": 0.16,
        "placement": 0.10,
        "aspect": 0.14,
        "colour": 0.14,
    }

    def _score(self, box: BBox, pixels: int, saliency: np.ndarray, chroma: np.ndarray, shape: tuple[int, int]) -> float:
        signals = self._signals(box, pixels, saliency, chroma, shape)
        if signals is None:
            return 0.0
        return float(np.clip(sum(self.WEIGHTS[key] * value for key, value in signals.items()), 0.0, 1.0))

    def _signals(
        self, box: BBox, pixels: int, saliency: np.ndarray, chroma: np.ndarray, shape: tuple[int, int]
    ) -> dict[str, float] | None:
        """Per-candidate signals in 0-1, or ``None`` if it fails a hard filter."""
        height, width = shape
        area_ratio = box.area / float(width * height)
        cfg = self._config.detect

        if area_ratio < cfg.min_area_ratio or area_ratio > min(cfg.max_area_ratio, 0.25):
            return None
        aspect = box.width / max(1, box.height)
        if not 0.12 <= aspect <= 9.0:
            return None
        if pixels / max(1, box.area) < 0.12:  # a sparse scatter, not an object
            return None

        inside = saliency[box.y1 : box.y2, box.x1 : box.x2]
        inside_mean = float(inside.mean()) if inside.size else 0.0
        if inside_mean <= 0:
            return None

        # Ring: the band just outside the box. Calm ring = isolated object.
        margin = max(2, int(round(max(box.width, box.height) * 0.35)))
        outer = box.expand(margin).clamp(width, height)
        ring_sum = float(saliency[outer.y1 : outer.y2, outer.x1 : outer.x2].sum()) - float(inside.sum())
        ring_pixels = max(1, outer.area - box.area)
        isolation = float(np.clip(1.0 - (ring_sum / ring_pixels) / inside_mean, 0.0, 1.0))

        # Logos are typically a few percent of a poster; taper off outside that.
        size_score = float(np.exp(-((np.log(max(area_ratio, 1e-6) / 0.035)) ** 2) / (2 * 1.1**2)))

        # A logo is a block; a line of body copy is a long thin strip. This is
        # what stops an isolated subtitle word from outranking the real logo.
        aspect_score = float(np.exp(-((np.log(aspect / 1.9)) ** 2) / (2 * 0.75**2)))

        # Logos carry colour — a mark, a brand hue. Type is usually flat ink.
        patch = chroma[box.y1 : box.y2, box.x1 : box.x2]
        colour_score = float(np.clip(patch.mean() / max(float(chroma.mean()), 1e-3) / 2.0, 0.0, 1.0))

        cx, cy = box.center
        corner_distance = min(
            np.hypot(cx, cy),
            np.hypot(width - cx, cy),
            np.hypot(cx, height - cy),
            np.hypot(width - cx, height - cy),
        )
        placement = float(np.clip(1.0 - corner_distance / (0.5 * np.hypot(width, height)), 0.0, 1.0))

        return {
            "saliency": inside_mean,
            "isolation": isolation,
            "size": size_score,
            "placement": placement,
            "aspect": aspect_score,
            "colour": colour_score,
        }


def _chroma(image: Image.Image) -> np.ndarray:
    """Per-pixel colourfulness: how far a pixel is from neutral grey, 0-1."""
    rgb = np.asarray(image.convert("RGB"), dtype=np.float32)
    return (rgb.max(axis=2) - rgb.min(axis=2)) / 255.0


def _blur(array: np.ndarray, radius: float) -> np.ndarray:
    """Gaussian-blur a float map.

    Pillow cannot blur an ``F`` mode image, so the map is carried through an
    8-bit buffer scaled by its own peak — plenty of precision for a score
    that is about to be normalised anyway.
    """
    peak = float(array.max())
    if peak <= 1e-6:
        return np.zeros_like(array, dtype=np.float32)
    scaled = np.clip(array / peak * 255.0, 0, 255).astype(np.uint8)
    blurred = Image.fromarray(scaled, mode="L").filter(ImageFilter.GaussianBlur(radius))
    return np.asarray(blurred, dtype=np.float32) / 255.0 * peak


def _normalise(array: np.ndarray) -> np.ndarray:
    """Scale to roughly 0-1 using the 99th percentile, ignoring outliers."""
    peak = float(np.percentile(array, 99))
    if peak <= 1e-6:
        return np.zeros_like(array)
    return np.clip(array / peak, 0.0, 1.0)


class ManualDetector:
    """Returns boxes supplied on the command line.

    Useful for posters with a fixed logo slot, for correcting a miss, and for
    running the pipeline before a model has been trained.
    """

    def __init__(self, spec: str) -> None:
        self._spec = spec

    def detect(self, image: Image.Image) -> list[Detection]:
        width, height = image.size
        try:
            boxes = parse_boxes(self._spec, width, height)
        except ValueError as exc:
            raise DetectionError(str(exc)) from exc
        return [Detection(box=box, confidence=1.0, class_name="manual") for box in boxes]


def postprocess(detections: list[Detection], size: tuple[int, int], config: Config) -> list[Detection]:
    """Drop implausible boxes, merge overlapping ones, cap the count."""
    cfg = config.detect
    width, height = size
    image_area = float(width * height)
    logger = get_logger()

    kept: list[Detection] = []
    for detection in detections:
        if detection.box.area <= 0:
            continue
        ratio = detection.box.area / image_area
        if ratio < cfg.min_area_ratio:
            logger.debug("dropping tiny detection %s (%.4f%% of image)", detection.box.as_tuple(), ratio * 100)
            continue
        if ratio > cfg.max_area_ratio:
            logger.debug("dropping oversized detection %s (%.1f%% of image)", detection.box.as_tuple(), ratio * 100)
            continue
        kept.append(detection)

    if not kept:
        return []

    kept.sort(key=lambda d: d.confidence, reverse=True)

    # Merge overlaps, keeping the best confidence and label of the group.
    merged_boxes = merge_boxes((d.box for d in kept), cfg.merge_iou)
    merged: list[Detection] = []
    for box in merged_boxes:
        members = [d for d in kept if d.box.iou(box) > 0 or _contains(box, d.box)]
        best = max(members, key=lambda d: d.confidence) if members else kept[0]
        merged.append(Detection(box=box, confidence=best.confidence, class_id=best.class_id, class_name=best.class_name))

    merged.sort(key=lambda d: d.confidence, reverse=True)
    if len(merged) > cfg.max_detections:
        logger.debug("keeping the top %d of %d detections", cfg.max_detections, len(merged))
        merged = merged[: cfg.max_detections]
    return merged


def _contains(outer: BBox, inner: BBox) -> bool:
    return outer.x1 <= inner.x1 and outer.y1 <= inner.y1 and outer.x2 >= inner.x2 and outer.y2 >= inner.y2


def build_detector(config: Config, manual_boxes: str | None = None, auto: bool = False) -> Detector:
    """Pick the detector implied by the configuration.

    Explicit boxes win over everything, then the heuristic if it was asked
    for, then YOLO.
    """
    if manual_boxes:
        return ManualDetector(manual_boxes)
    if auto:
        return HeuristicLogoDetector(config)
    return YoloLogoDetector(config)
