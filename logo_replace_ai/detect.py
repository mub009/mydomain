"""Logo detection.

Wraps an Ultralytics YOLO model behind a small interface, plus a manual
detector used when the boxes are already known (``--boxes``) — that path also
lets the rest of the pipeline be exercised without any weights on disk.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

from PIL import Image

from config import Config
from utils import (
    BBox,
    DetectionError,
    ModelLoadError,
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
                "  No trained model yet? Run with --boxes x,y,w,h to place logos manually."
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


def build_detector(config: Config, manual_boxes: str | None = None) -> Detector:
    """Pick the detector implied by the configuration."""
    if manual_boxes:
        return ManualDetector(manual_boxes)
    return YoloLogoDetector(config)
