"""logo_replace_ai — detect a logo, erase it, put a new one in its place.

Examples
--------
Batch over ``input/`` with a trained YOLO model and SDXL inpainting::

    python app.py --logo input/new_logo.png

One poster, fast CPU preview, no model download::

    python app.py --input input/poster.png --inpaint classical

No trained detector yet? Give the box directly (pixels or 0-1 fractions)::

    python app.py --input input/poster.png --boxes 0.08,0.05,0.24,0.12

Run ``python app.py --help`` for the full list of flags.
"""

from __future__ import annotations

import argparse
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path

from PIL import Image

from config import Config, load_config
from detect import Detection, build_detector
from inpaint import build_inpainter
from overlay import LogoOverlay, Placement
from palette import accent_colour, brand_colour, describe_palettes, extract_palette, retint
from utils import (
    LogoReplaceError,
    build_mask,
    describe_device,
    draw_debug_boxes,
    ensure_dir,
    get_logger,
    human_size,
    iter_input_images,
    load_image,
    resolve_device,
    save_image,
    setup_logging,
    split_for,
    to_yolo_label,
)

EXIT_OK = 0
EXIT_FAILED = 1
EXIT_USAGE = 2


# --------------------------------------------------------------------------
# results
# --------------------------------------------------------------------------
def _shorten(text: str, limit: int) -> str:
    return text if len(text) <= limit else text[: limit - 1] + "…"


@dataclass
class ImageResult:
    """What happened to a single input image."""

    source: Path
    status: str = "pending"  # ok | labelled | skipped | no-detection | failed
    output: Path | None = None
    detections: list[Detection] = field(default_factory=list)
    placements: list[Placement] = field(default_factory=list)
    error: str | None = None
    seconds: float = 0.0

    @property
    def ok(self) -> bool:
        return self.status in {"ok", "labelled", "skipped"}

    def summary_line(self) -> str:
        icon = {"ok": "✓", "labelled": "✓", "skipped": "·", "no-detection": "!", "failed": "✗"}.get(self.status, "?")
        detail = ""
        if self.status == "labelled":
            detail = f"{len(self.detections)} box → {self.output}"
        elif self.status == "ok":
            detail = f"{len(self.placements)} logo(s) → {self.output}"
        elif self.status == "skipped":
            detail = "output exists (use --overwrite)"
        elif self.status == "no-detection":
            detail = "no logo found"
        elif self.status == "failed":
            # multi-line hints are useful in the log, not in a summary table
            detail = _shorten((self.error or "unknown error").splitlines()[0], 88)
        return f"  {icon} {self.source.name:<32} {detail}  [{self.seconds:.1f}s]"


@dataclass
class ColourOptions:
    """What to do about colour, gathered from the CLI."""

    report: bool = False
    match_poster: bool = False
    tint_logo: bool = False
    accent: tuple[int, int, int] | None = None
    brand: tuple[int, int, int] | None = None
    tolerance: float = 35.0

    @classmethod
    def from_args(cls, args: argparse.Namespace) -> "ColourOptions":
        return cls(
            report=args.palette,
            match_poster=args.match_poster,
            tint_logo=args.tint_logo,
            accent=_parse_hex(args.accent, "--accent"),
            brand=_parse_hex(args.brand, "--brand"),
            tolerance=args.hue_tolerance if args.hue_tolerance is not None else 35.0,
        )


def _parse_hex(value: str | None, flag: str) -> tuple[int, int, int] | None:
    """Parse ``#rrggbb`` or ``rrggbb``."""
    if not value:
        return None
    text = value.strip().lstrip("#")
    if len(text) != 6:
        raise ValueError(f"{flag} must be a 6-digit hex colour, got {value!r}")
    try:
        return tuple(int(text[index : index + 2], 16) for index in (0, 2, 4))  # type: ignore[return-value]
    except ValueError as exc:
        raise ValueError(f"{flag} must be a 6-digit hex colour, got {value!r}") from exc


# --------------------------------------------------------------------------
# pipeline
# --------------------------------------------------------------------------
class LogoReplacePipeline:
    """Detect → mask → inpaint → overlay, over one image or a whole folder."""

    def __init__(
        self,
        config: Config,
        manual_boxes: str | None = None,
        logo: Path | None = None,
        skip_overlay: bool = False,
        auto: bool = False,
        slots: bool = False,
        export_dir: Path | None = None,
        colour: "ColourOptions | None" = None,
    ) -> None:
        config.validate()
        self.config = config
        self.log = get_logger()
        self.detector = build_detector(config, manual_boxes, auto=auto, slots=slots)
        self.inpainter = build_inpainter(config)
        self.overlay = LogoOverlay(config, logo)
        self.skip_overlay = skip_overlay
        self.export_dir = export_dir
        self.colour = colour or ColourOptions()

    # -- single image -----------------------------------------------------
    def process_image(self, source: Path, output: Path) -> ImageResult:
        started = time.perf_counter()
        result = ImageResult(source=source)
        cfg = self.config

        if output.exists() and not cfg.paths.overwrite:
            result.status = "skipped"
            result.output = output
            result.seconds = time.perf_counter() - started
            return result

        image = load_image(source, mode="RGB")
        self.log.info("Processing %s (%s)", source.name, human_size(image.size))

        detections = self.detector.detect(image)
        result.detections = detections

        if self.export_dir is not None:
            return self._export_label(source, image, detections, result, started)

        if not detections:
            result.status = "no-detection"
            result.seconds = time.perf_counter() - started
            self.log.warning("No logo detected in %s — nothing to replace", source.name)
            self._dump_debug(source, image=image)
            return result

        self.log.info(
            "Found %d logo region(s): %s",
            len(detections),
            ", ".join(f"{d.box.width}x{d.box.height}@({d.box.x1},{d.box.y1}) {d.confidence:.2f}" for d in detections),
        )

        boxes = [d.box for d in detections]
        mask = build_mask(
            image.size,
            boxes,
            dilate=cfg.inpaint.mask_dilate,
            feather=cfg.inpaint.mask_feather,
        )

        if cfg.runtime.dry_run:
            result.status = "ok"
            result.output = output
            result.seconds = time.perf_counter() - started
            self.log.info("Dry run — would write %s", output)
            # Report on the original: nothing was cleaned, so say so rather
            # than pretending the numbers come from a finished poster.
            self._apply_colour(image)
            self._dump_debug(source, image=image, mask=mask, detections=detections)
            return result

        cleaned = self.inpainter.fill(image, mask, boxes)
        cleaned = self._apply_colour(cleaned)

        composed = cleaned
        placements: list[Placement] = []
        if not self.skip_overlay:
            self._tinted_logo(cleaned)
            for box in boxes:
                composed, placement = self.overlay.place(composed, box)
                placements.append(placement)

        result.output = save_image(composed, output)
        result.placements = placements
        result.status = "ok"
        result.seconds = time.perf_counter() - started
        self._dump_debug(source, image=image, mask=mask, detections=detections, cleaned=cleaned)
        self.log.info("Wrote %s in %.1fs", output, result.seconds)
        return result

    # -- colour -----------------------------------------------------------
    def _apply_colour(self, poster: Image.Image) -> Image.Image:
        """Report the two palettes, and tie them together if asked.

        Runs on the *cleaned* plate, after the old logo is gone: the colours
        of a mark that is about to be removed are not the poster's palette.
        """
        options = self.colour
        if not (options.report or options.match_poster or options.tint_logo):
            return poster
        if options.match_poster and not self.config.runtime.dry_run:
            self.log.warning(
                "Retinting moves every pixel near the accent hue — including any third-party mark that "
                "happens to share it (a Google badge, a payment logo, a map pin). Check those before publishing."
            )

        logo = None if self.skip_overlay else self.overlay.load()
        if options.report:
            print(
                describe_palettes(
                    extract_palette(poster, count=4, alpha_threshold=0),
                    extract_palette(logo, count=4) if logo is not None else [],
                )
            )

        if not options.match_poster:
            return poster

        source = options.accent or self._swatch_rgb(accent_colour(poster), "poster accent")
        target = options.brand or self._swatch_rgb(brand_colour(logo) if logo else None, "logo brand colour")
        if source is None or target is None:
            self.log.warning("--match-poster needs a detectable accent in both images; leaving colours alone")
            return poster

        if self.config.runtime.dry_run:
            # Saying "Retinting" while writing nothing reads as a silent
            # failure. Name the colours it *would* use instead.
            self.log.info(
                "Dry run — would retint #%02x%02x%02x → #%02x%02x%02x", *source, *target
            )
            return poster

        self.log.info("Retinting poster #%02x%02x%02x → #%02x%02x%02x", *source, *target)
        return retint(poster, source, target, tolerance=options.tolerance).convert("RGB")

    def _swatch_rgb(self, swatch, label: str) -> tuple[int, int, int] | None:
        if swatch is None:
            self.log.debug("no %s found", label)
            return None
        return swatch.rgb

    def _tinted_logo(self, poster: Image.Image) -> None:
        """Recolour the logo towards the poster's accent, if asked.

        Separate from ``_apply_colour`` because it mutates the loaded logo and
        must happen once, before any placement.
        """
        options = self.colour
        if not options.tint_logo or self.skip_overlay:
            return
        logo = self.overlay.load()
        source = options.brand or self._swatch_rgb(brand_colour(logo), "logo brand colour")
        target = options.accent or self._swatch_rgb(accent_colour(poster), "poster accent")
        if source is None or target is None:
            self.log.warning("--tint-logo needs a detectable colour in both images; leaving the logo alone")
            return
        self.log.warning(
            "Recolouring the logo #%02x%02x%02x → #%02x%02x%02x. This changes someone's brand colours — "
            "fine for a single-colour ornament, wrong for a real identity. --match-poster is usually the "
            "right direction instead.",
            *source,
            *target,
        )
        self.overlay.replace_logo(retint(logo, source, target, tolerance=options.tolerance))

    # -- dataset export ---------------------------------------------------
    def _export_label(
        self,
        source: Path,
        image: Image.Image,
        detections: list[Detection],
        result: ImageResult,
        started: float,
    ) -> ImageResult:
        """Write one image + YOLO label into the dataset tree.

        The point is to bootstrap a training set: run this over your posters,
        correct the boxes in a labelling tool, then train. Correcting a
        roughly-right box is far quicker than drawing every one by hand.

        Images with no detection still get an empty label file — YOLO reads
        that as "nothing here", which is a genuinely useful negative example,
        not a gap in the dataset.
        """
        assert self.export_dir is not None
        split = split_for(source.name)
        images_dir = ensure_dir(self.export_dir / "images" / split)
        labels_dir = ensure_dir(self.export_dir / "labels" / split)

        save_image(image, images_dir / f"{source.stem}.png")
        lines = [to_yolo_label(d.box, image.size) for d in detections]
        (labels_dir / f"{source.stem}.txt").write_text("\n".join(lines) + ("\n" if lines else ""), encoding="utf-8")

        result.status = "labelled"
        result.output = labels_dir / f"{source.stem}.txt"
        result.seconds = time.perf_counter() - started
        self.log.info("Labelled %s → %s/%s (%d box)", source.name, split, source.stem, len(lines))
        self._dump_debug(source, image=image, detections=detections)
        return result

    # -- batch ------------------------------------------------------------
    def run(self, sources: list[Path], output_dir: Path, input_root: Path | None = None) -> list[ImageResult]:
        results: list[ImageResult] = []
        total = len(sources)
        for index, source in enumerate(sources, start=1):
            self.log.info("[%d/%d] %s", index, total, source)
            output = self._output_path(source, output_dir, input_root)
            try:
                results.append(self.process_image(source, output))
            except LogoReplaceError as exc:
                results.append(ImageResult(source=source, status="failed", error=str(exc)))
                self.log.error("%s: %s", source.name, exc)
                if not self.config.runtime.continue_on_error:
                    break
            except Exception as exc:  # unexpected: keep the batch alive, keep the detail
                results.append(ImageResult(source=source, status="failed", error=f"{type(exc).__name__}: {exc}"))
                self.log.exception("Unexpected failure on %s", source.name)
                if not self.config.runtime.continue_on_error:
                    break
        return results

    def _output_path(self, source: Path, output_dir: Path, input_root: Path | None) -> Path:
        """Mirror the input tree under ``output_dir``; always write PNG."""
        relative = Path(source.name)
        if input_root is not None and input_root.is_dir():
            try:
                relative = source.relative_to(input_root)
            except ValueError:
                relative = Path(source.name)
        return output_dir / relative.with_suffix(".png")

    # -- debug ------------------------------------------------------------
    def _dump_debug(
        self,
        source: Path,
        image: Image.Image | None = None,
        mask: Image.Image | None = None,
        detections: list[Detection] | None = None,
        cleaned: Image.Image | None = None,
    ) -> None:
        debug_dir = self.config.paths.debug_dir
        if debug_dir is None or image is None:
            return
        target = ensure_dir(debug_dir / source.stem)
        try:
            if detections:
                boxes = [d.box for d in detections]
                labels = [d.label() for d in detections]
                save_image(draw_debug_boxes(image, boxes, labels), target / "01-detections.png")
            else:
                save_image(image, target / "01-detections.png")
            if mask is not None:
                save_image(mask, target / "02-mask.png")
            if cleaned is not None:
                save_image(cleaned, target / "03-inpainted.png")
        except LogoReplaceError as exc:  # debug output must never break a run
            self.log.warning("Could not write debug output for %s: %s", source.name, exc)


# --------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------
def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="logo_replace_ai",
        description="Detect a logo with YOLO, erase it with Stable Diffusion, and blend a new one in.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )

    io_group = parser.add_argument_group("input / output")
    io_group.add_argument("--input", type=Path, help="image file or folder (default: input/)")
    io_group.add_argument("--output", type=Path, help="output folder (default: output/)")
    io_group.add_argument("--logo", type=Path, help="transparent PNG to paste in (default: input/new_logo.png)")
    io_group.add_argument("--recursive", action="store_true", help="recurse into sub-folders of the input folder")
    io_group.add_argument("--no-overwrite", action="store_true", help="skip images whose output already exists")
    io_group.add_argument("--debug-dir", type=Path, help="write detections, masks and the cleaned plate here")

    det_group = parser.add_argument_group("detection")
    det_group.add_argument("--weights", type=Path, help="YOLO weights (default: models/best.pt)")
    det_group.add_argument("--conf", type=float, help="confidence threshold")
    det_group.add_argument("--iou", type=float, help="NMS IoU threshold")
    det_group.add_argument("--imgsz", type=int, help="YOLO inference size")
    det_group.add_argument("--max-det", type=int, help="maximum logos per image")
    det_group.add_argument(
        "--auto-max",
        type=int,
        help="how many regions --auto may return (default 1 — see README)",
    )
    det_group.add_argument("--classes", help="comma-separated class ids to keep, e.g. 0,2")
    det_group.add_argument(
        "--auto",
        action="store_true",
        help="find logos by image analysis instead of YOLO — no weights needed",
    )
    det_group.add_argument(
        "--slots",
        action="store_true",
        help="find the empty logo box in a template (dashed guide frame) — no model needed",
    )
    det_group.add_argument(
        "--export-labels",
        type=Path,
        metavar="DIR",
        help="write a YOLO training dataset here instead of replacing logos",
    )
    det_group.add_argument(
        "--boxes",
        help="skip YOLO and use these boxes: 'x,y,w,h' in pixels or 0-1 fractions, ';' separated",
    )

    inp_group = parser.add_argument_group("inpainting")
    inp_group.add_argument("--inpaint", choices=("sdxl", "classical", "none"), help="background fill backend")
    inp_group.add_argument("--model-id", help="diffusers model id for SDXL inpainting")
    inp_group.add_argument("--prompt", help="inpainting prompt")
    inp_group.add_argument("--negative-prompt", help="inpainting negative prompt")
    inp_group.add_argument("--steps", type=int, help="diffusion steps")
    inp_group.add_argument("--guidance", type=float, help="classifier-free guidance scale")
    inp_group.add_argument("--work-size", type=int, help="diffusion working resolution")
    inp_group.add_argument("--dilate", type=int, help="grow the mask by N px before filling")
    inp_group.add_argument("--feather", type=int, help="blur the mask edge by N px")
    inp_group.add_argument("--seed", type=int, help="random seed (-1 for random)")
    inp_group.add_argument("--cpu-offload", action="store_true", help="offload SDXL submodules to CPU (low VRAM)")
    inp_group.add_argument(
        "--classical-method",
        choices=("pillow", "telea", "ns"),
        help="fill used by --inpaint classical; pillow needs no OpenCV",
    )
    inp_group.add_argument(
        "--classical-max-span",
        type=int,
        help="holes wider than this are filled on a downscaled copy (classical backend)",
    )

    ov_group = parser.add_argument_group("logo placement")
    ov_group.add_argument("--scale", type=float, help="fraction of the detected box the logo fills")
    ov_group.add_argument("--align-x", choices=("left", "center", "right"), help="horizontal alignment in the box")
    ov_group.add_argument("--align-y", choices=("top", "center", "bottom"), help="vertical alignment in the box")
    ov_group.add_argument("--opacity", type=float, help="logo opacity, 0-1")
    ov_group.add_argument("--no-shadow", action="store_true", help="disable the drop shadow")
    ov_group.add_argument("--shadow-opacity", type=float, help="drop shadow opacity, 0-1")
    ov_group.add_argument("--no-overlay", action="store_true", help="only erase the old logo, do not add a new one")
    ov_group.add_argument(
        "--no-realistic",
        action="store_true",
        help="paste the logo flat: no grain matching, no contrast halo",
    )
    ov_group.add_argument("--min-contrast", type=float, help="contrast ratio below which a halo is added")
    ov_group.add_argument("--no-sharpen", action="store_true", help="do not sharpen a logo that had to be enlarged")
    ov_group.add_argument("--max-upscale", type=float, help="never enlarge the logo beyond this multiple")

    col_group = parser.add_argument_group("colour")
    col_group.add_argument(
        "--palette",
        action="store_true",
        help="report the poster's and the logo's dominant colours, and whether they clash",
    )
    col_group.add_argument(
        "--match-poster",
        action="store_true",
        help="retint the poster's accent colour to the logo's brand colour",
    )
    col_group.add_argument(
        "--tint-logo",
        action="store_true",
        help="recolour the logo to the poster's accent — alters brand colours, use with care",
    )
    col_group.add_argument("--accent", help="source colour to retint from, e.g. 0a46c8 (default: detected)")
    col_group.add_argument("--brand", help="target colour to retint to, e.g. 10847a (default: the logo's)")
    col_group.add_argument("--hue-tolerance", type=float, help="degrees of hue either side of the accent to move")

    rt_group = parser.add_argument_group("runtime")
    rt_group.add_argument("--device", help="auto, cpu, cuda, cuda:0 or mps")
    rt_group.add_argument("--dtype", choices=("auto", "fp16", "bf16", "fp32"), help="model precision")
    rt_group.add_argument("--fail-fast", action="store_true", help="stop the batch at the first failure")
    rt_group.add_argument("--dry-run", action="store_true", help="detect and report without writing images")
    rt_group.add_argument("-v", "--verbose", action="store_true", help="debug logging")
    return parser


def apply_args(config: Config, args: argparse.Namespace) -> Config:
    """Overlay CLI flags on top of the env/default config."""
    paths, detect, inpaint, overlay, runtime = (
        config.paths,
        config.detect,
        config.inpaint,
        config.overlay,
        config.runtime,
    )

    if args.input:
        paths.input_dir = args.input.expanduser()
    if args.output:
        paths.output_dir = args.output.expanduser()
    if args.logo:
        paths.logo = args.logo.expanduser()
    if args.debug_dir:
        paths.debug_dir = args.debug_dir.expanduser()
    paths.recursive = paths.recursive or args.recursive
    if args.no_overwrite:
        paths.overwrite = False

    if args.weights:
        detect.weights = args.weights.expanduser()
    if args.conf is not None:
        detect.confidence = args.conf
    if args.iou is not None:
        detect.iou = args.iou
    if args.imgsz is not None:
        detect.image_size = args.imgsz
    if args.max_det is not None:
        detect.max_detections = args.max_det
    if args.auto_max is not None:
        detect.auto_max_detections = args.auto_max
    if args.classes:
        detect.classes = tuple(int(p) for p in args.classes.replace(" ", "").split(",") if p)

    if args.inpaint:
        inpaint.backend = args.inpaint
    if args.model_id:
        inpaint.model_id = args.model_id
    if args.prompt:
        inpaint.prompt = args.prompt
    if args.negative_prompt:
        inpaint.negative_prompt = args.negative_prompt
    if args.steps is not None:
        inpaint.steps = args.steps
    if args.guidance is not None:
        inpaint.guidance_scale = args.guidance
    if args.work_size is not None:
        inpaint.work_size = args.work_size
    if args.dilate is not None:
        inpaint.mask_dilate = args.dilate
    if args.feather is not None:
        inpaint.mask_feather = args.feather
    if args.seed is not None:
        inpaint.seed = args.seed
    if args.cpu_offload:
        inpaint.cpu_offload = True
    if args.classical_method:
        inpaint.classical_method = args.classical_method
    if args.classical_max_span is not None:
        inpaint.classical_max_span = args.classical_max_span

    if args.scale is not None:
        overlay.scale = args.scale
    if args.align_x:
        overlay.align_x = args.align_x
    if args.align_y:
        overlay.align_y = args.align_y
    if args.opacity is not None:
        overlay.opacity = args.opacity
    if args.no_shadow:
        overlay.shadow = False
    if args.shadow_opacity is not None:
        overlay.shadow_opacity = args.shadow_opacity
    if args.no_realistic:
        overlay.realistic = False
    if args.min_contrast is not None:
        overlay.min_contrast = args.min_contrast
    if args.no_sharpen:
        overlay.sharpen_upscale = False
    if args.max_upscale is not None:
        overlay.max_upscale = args.max_upscale

    if args.device:
        runtime.device = args.device
    if args.dtype:
        runtime.dtype = args.dtype
    if args.fail_fast:
        runtime.continue_on_error = False
    if args.dry_run:
        runtime.dry_run = True
    if args.verbose:
        runtime.verbose = True

    return config


def print_summary(results: list[ImageResult], elapsed: float) -> None:
    counts: dict[str, int] = {}
    for result in results:
        counts[result.status] = counts.get(result.status, 0) + 1

    print("\nSummary")
    print("-------")
    for result in results:
        print(result.summary_line())
    tally = ", ".join(f"{count} {status}" for status, count in sorted(counts.items()))
    print(f"\n{len(results)} image(s) in {elapsed:.1f}s — {tally or 'nothing to do'}")


def _detector_name(args: argparse.Namespace, config: Config) -> str:
    if args.boxes:
        return "manual boxes"
    if args.slots:
        return "template slots (--slots)"
    if args.auto:
        return "heuristic (--auto)"
    return config.detect.weights.name


def write_dataset_yaml(root: Path, results: list[ImageResult]) -> None:
    """Write the data.yaml ultralytics needs, and say what to do next."""
    root = root.resolve()
    (root / "data.yaml").write_text(
        "\n".join(
            [
                f"path: {root.as_posix()}",
                "train: images/train",
                "val: images/val",
                "",
                "names:",
                "  0: logo",
                "",
            ]
        ),
        encoding="utf-8",
    )
    labelled = sum(1 for r in results if r.status == "labelled")
    boxes = sum(len(r.detections) for r in results if r.status == "labelled")
    print(
        f"\nDataset: {labelled} image(s), {boxes} box(es) → {root}\n"
        "  1. Correct the boxes (labelImg, Label Studio, or import the folder into Roboflow).\n"
        f"  2. yolo detect train model=yolov8s.pt data={(root / 'data.yaml').as_posix()} epochs=100 imgsz=960\n"
        "  3. Copy runs/detect/train/weights/best.pt to models/best.pt, then drop --auto."
    )


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    logger = setup_logging(args.verbose)

    try:
        config = apply_args(load_config(), args)
        config.validate()
        # Parsed here, with the rest of the argument checking, so a typo'd
        # hex colour is a usage error rather than a traceback mid-run.
        colour = ColourOptions.from_args(args)
    except (ValueError, OSError) as exc:
        logger.error("%s", exc)
        return EXIT_USAGE

    logger.debug("config: %s", config.to_dict())

    try:
        source_root = config.paths.input_dir
        sources = iter_input_images(source_root, recursive=config.paths.recursive)
        if not sources:
            logger.error("No images found in %s", source_root)
            return EXIT_USAGE

        pipeline = LogoReplacePipeline(
            config,
            manual_boxes=args.boxes,
            logo=config.paths.logo,
            skip_overlay=args.no_overlay,
            auto=args.auto,
            slots=args.slots,
            export_dir=args.export_labels,
            colour=colour,
        )
        if not args.no_overlay and not config.runtime.dry_run and not args.export_labels:
            pipeline.overlay.load()  # fail before loading a multi-GB model

        if config.inpaint.backend == "sdxl" and not config.runtime.dry_run:
            # Informational only — a missing torch is reported by the backend
            # itself, with the install line, at the point it is actually needed.
            try:
                logger.info("Device: %s", describe_device(resolve_device(config.runtime.device)))
            except LogoReplaceError as exc:
                logger.debug("device probe skipped: %s", exc)
        logger.info(
            "%d image(s) · detector: %s · inpaint: %s · logo: %s",
            len(sources),
            _detector_name(args, config),
            config.inpaint.backend,
            "none" if args.no_overlay else config.paths.logo.name,
        )

        if args.auto:
            logger.info(
                "Heuristic detection is best-effort (~71%% top-1 on a synthetic benchmark) — "
                "review the results, or add --debug-dir to see what it picked."
            )

        started = time.perf_counter()
        results = pipeline.run(sources, config.paths.output_dir, source_root)
        print_summary(results, time.perf_counter() - started)
        if args.export_labels:
            write_dataset_yaml(args.export_labels, results)
    except LogoReplaceError as exc:
        logger.error("%s", exc)
        return EXIT_FAILED
    except KeyboardInterrupt:
        logger.warning("Interrupted")
        return EXIT_FAILED

    return EXIT_OK if all(result.ok for result in results) else EXIT_FAILED


if __name__ == "__main__":
    sys.exit(main())
