"""Finding text in a flattened poster, and putting different words there.

The same shape as the logo problem: a template carries ``@CLINIC_NAME@``
where a shop's own name belongs, and once the poster is exported to PNG that
placeholder is just pixels. This reads the text back with OCR, erases the
line, and draws a replacement in its place.

Two limits worth knowing before you rely on it:

* **The font cannot be recovered from a raster.** Pixels do not say which
  typeface drew them, so a replacement is rendered in a font *you* supply.
  Give it the one the template uses and the result is convincing; give it
  anything else and the poster will look subtly off.
* **OCR is not exact.** Tesseract reads ``@CLINIC_NAME@`` as ``@CLINIC`` plus
  ``NAME@`` — the underscore is lost — so matching is deliberately loose:
  letters and digits only, case-insensitive. Always check ``--find-text``
  output before running a batch.

If the template still exists as SVG, replace the text there instead. The
designer's font, size, tracking and colour are all still known at that point,
and none of them have to be guessed.
"""

from __future__ import annotations

import json
import pathlib
import re
from dataclasses import dataclass, field

import numpy as np
from PIL import Image, ImageDraw, ImageFont

from utils import BBox, LogoReplaceError, get_logger, require_module

#: A designer's placeholder: ``@LOGO@``, ``@CLINIC_NAME@``, ``{{business}}``.
TOKEN_PATTERN = re.compile(r"^\s*(@.+@|\{\{.+\}\})\s*$")


class TextError(LogoReplaceError):
    """Text could not be read or replaced."""


@dataclass
class TextLine:
    """One line of text found in the image."""

    text: str
    box: BBox
    confidence: float
    #: Colour of the strokes themselves, sampled from the darkest ink.
    colour: tuple[int, int, int] = (0, 0, 0)
    words: list[str] = field(default_factory=list)

    @property
    def key(self) -> str:
        """Letters and digits only, uppercased — what ``--set-text`` matches.

        OCR drops punctuation unpredictably, so the key ignores it entirely:
        ``@CLINIC_NAME@`` and ``@CLINIC NAME@`` both key as ``CLINICNAME``.
        """
        return re.sub(r"[^A-Za-z0-9]", "", self.text).upper()

    @property
    def is_token(self) -> bool:
        return bool(TOKEN_PATTERN.match(self.text))

    def describe(self, index: int) -> str:
        marker = "token" if self.is_token else "text "
        return (
            f"  [{index}] {marker} {self.text!r}\n"
            f"        box={self.box.width}x{self.box.height}@({self.box.x1},{self.box.y1})  "
            f"colour=#{self.colour[0]:02x}{self.colour[1]:02x}{self.colour[2]:02x}  "
            f"conf={self.confidence:.0f}  key={self.key}"
        )


# --------------------------------------------------------------------------
# reading
# --------------------------------------------------------------------------
def find_text_lines(image: Image.Image, min_confidence: float = 45.0) -> list[TextLine]:
    """OCR the image and return whole lines, not loose words.

    Tesseract reports one row per word; grouping them back into lines by its
    own block/paragraph/line numbers is what makes ``@CLINIC_NAME@`` a single
    replaceable thing rather than two fragments.
    """
    pytesseract = require_module(
        "pytesseract",
        "pytesseract",
        extra=(
            "and the Tesseract engine itself — it is a separate program, not a Python package.\n"
            "  Windows: https://github.com/UB-Mannheim/tesseract/wiki (tick 'Add to PATH')\n"
            "  Debian/Ubuntu: sudo apt install tesseract-ocr"
        ),
    )
    get_logger().info("Reading text with OCR (a few seconds on a full-size poster)…")
    try:
        data = pytesseract.image_to_data(image, output_type=pytesseract.Output.DICT)
    except Exception as exc:  # the engine is missing, or the language pack is
        raise TextError(
            f"OCR failed: {exc}\n"
            "  If this says 'tesseract is not installed or it's not in your PATH', install the engine:\n"
            "  Windows: https://github.com/UB-Mannheim/tesseract/wiki"
        ) from exc

    grouped: dict[tuple[int, int, int], list[int]] = {}
    for index, text in enumerate(data["text"]):
        if not text.strip():
            continue
        try:
            confidence = float(data["conf"][index])
        except (TypeError, ValueError):
            continue
        if confidence < min_confidence:
            continue
        key = (data["block_num"][index], data["par_num"][index], data["line_num"][index])
        grouped.setdefault(key, []).append(index)

    lines: list[TextLine] = []
    for indices in grouped.values():
        for segment in _split_columns(data, indices):
            words = [data["text"][i].strip() for i in segment]
            box = BBox(
                min(data["left"][i] for i in segment),
                min(data["top"][i] for i in segment),
                max(data["left"][i] + data["width"][i] for i in segment),
                max(data["top"][i] + data["height"][i] for i in segment),
            )
            lines.append(
                TextLine(
                    text=" ".join(words),
                    box=box.clamp(*image.size),
                    confidence=float(np.mean([float(data["conf"][i]) for i in segment])),
                    colour=ink_colour(image, box),
                    words=words,
                )
            )

    lines.sort(key=lambda line: (line.box.y1, line.box.x1))
    get_logger().debug("OCR found %d line(s)", len(lines))
    return lines


def _split_columns(data: dict, indices: list[int], gap_factor: float = 1.2) -> list[list[int]]:
    """Break one OCR "line" apart where it crosses a column gutter.

    Tesseract reads a row of the page as a single line, so a two-column
    address block comes back as "Address Call Us" — replace that and you
    overwrite both columns with one string. Splitting on any horizontal gap
    wider than the text is tall separates the columns and leaves ordinary word
    spacing alone.
    """
    ordered = sorted(indices, key=lambda i: data["left"][i])
    if len(ordered) < 2:
        return [ordered]
    heights = [data["height"][i] for i in ordered]
    threshold = max(8.0, float(np.median(heights)) * gap_factor)

    segments: list[list[int]] = [[ordered[0]]]
    for previous, current in zip(ordered, ordered[1:]):
        gap = data["left"][current] - (data["left"][previous] + data["width"][previous])
        if gap > threshold:
            segments.append([current])
        else:
            segments[-1].append(current)
    return segments


def ink_colour(image: Image.Image, box: BBox) -> tuple[int, int, int]:
    """The colour of the strokes inside ``box``.

    Text is a minority of the pixels in its own bounding box — the rest is
    background — so the average is mostly paper. Taking the quarter of pixels
    furthest from the box's most common colour gets the ink instead.
    """
    patch = np.asarray(image.convert("RGB").crop(box.as_tuple()), dtype=np.float32)
    if patch.size == 0:
        return (0, 0, 0)
    flat = patch.reshape(-1, 3)
    background = np.median(flat, axis=0)
    distance = np.linalg.norm(flat - background, axis=1)
    if not distance.any():
        return tuple(int(v) for v in background)  # type: ignore[return-value]
    cutoff = np.quantile(distance, 0.75)
    ink = flat[distance >= cutoff]
    return tuple(int(v) for v in np.median(ink, axis=0))  # type: ignore[return-value]


def describe_lines(lines: list[TextLine]) -> str:
    """The ``--find-text`` report."""
    if not lines:
        return "\nText\n----\n  nothing readable found"
    body = "\n".join(line.describe(index) for index, line in enumerate(lines, start=1))
    tokens = sum(1 for line in lines if line.is_token)
    return (
        f"\nText\n----\n{body}\n"
        f"\n  {len(lines)} line(s), {tokens} placeholder token(s).\n"
        '  Replace with --set-text "KEY=new words" (KEY is the key= shown above, or the [n] index).'
    )


# --------------------------------------------------------------------------
# writing
# --------------------------------------------------------------------------
def parse_assignment(raw: str) -> tuple[str, str]:
    """Split ``KEY=value``, keeping any ``=`` inside the value."""
    if "=" not in raw:
        raise ValueError(f'--set-text needs KEY=value, got {raw!r}')
    key, value = raw.split("=", 1)
    key = key.strip()
    if not key:
        raise ValueError(f'--set-text needs a non-empty key, got {raw!r}')
    return re.sub(r"[^A-Za-z0-9]", "", key).upper(), value


def load_text_map(path: str) -> list[tuple[str, str]]:
    """Read ``@TOKEN@ = value`` pairs from a JSON or plain-text file.

    A template has the same handful of tokens every time, so naming them once
    in a file beats repeating five ``--set-text`` flags for every shop.
    """
    file = pathlib.Path(path).expanduser()
    if not file.exists():
        raise TextError(f"text map not found: {file}")
    raw = file.read_text(encoding="utf-8-sig")

    if raw.lstrip().startswith("{"):
        try:
            data = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise TextError(f"{file} is not valid JSON: {exc}") from exc
        if not isinstance(data, dict):
            raise TextError(f"{file} must hold an object of token: value pairs")
        return [(str(key), str(value)) for key, value in data.items()]

    pairs: list[tuple[str, str]] = []
    for number, line in enumerate(raw.splitlines(), start=1):
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if "=" not in stripped:
            raise TextError(f"{file}:{number}: expected TOKEN=value, got {stripped!r}")
        key, value = stripped.split("=", 1)
        pairs.append((key.strip(), value.strip()))
    return pairs


def match_line(lines: list[TextLine], key: str, token_only: bool = False) -> TextLine | None:
    """Find the line a ``--set-text`` key refers to: an index, or its text.

    ``token_only`` is set when the caller wrote the key as a placeholder, and
    it is what keeps the tool honest about intent. ``@ADDRESS@`` strips to
    ``ADDRESS``, which is also what the *label* "Address" on a contact block
    strips to — so without it, asking to fill the address placeholder
    overwrote the word "Address" instead. Someone who writes a token means the
    token; someone who writes plain text means that text.
    """
    if key.isdigit():
        position = int(key) - 1
        return lines[position] if 0 <= position < len(lines) else None
    if not key:
        return None

    candidates = [line for line in lines if line.is_token] if token_only else lines
    for line in candidates:
        if line.key == key:
            return line
    for line in candidates:  # a fragment may name a token: CLINICNAME for @CLINIC_NAME@
        if line.is_token and key in line.key:
            return line
    return None


def load_font(path: str | None, size: int) -> ImageFont.FreeTypeFont:
    """Load a TrueType font, falling back to whatever the system has.

    Pillow's built-in bitmap font cannot scale, so a missing font file would
    silently render tiny text — better to look for a real one and say what
    happened.
    """
    candidates = [path] if path else []
    candidates += [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "C:/Windows/Fonts/arialbd.ttf",
        "C:/Windows/Fonts/arial.ttf",
    ]
    for candidate in candidates:
        if not candidate:
            continue
        try:
            return ImageFont.truetype(candidate, size)
        except OSError:
            continue
    raise TextError(
        "no usable font found. Pass --font C:/path/to/YourFont.ttf — ideally the one the template uses, "
        "since a raster image does not record which typeface drew it."
    )


def match_original_size(original: str, box: BBox, font_path: str | None) -> int:
    """The point size at which ``original`` fills ``box``'s height.

    The replacement should be set at the size the designer chose, not at
    whatever happens to fill the placeholder's bounding box. Measuring the
    size that reproduces the *original* words at their observed height
    recovers that intent, so a short value does not balloon and a long one
    starts from the right place before any shrinking.
    """
    low, high, best = 4, max(8, box.height * 3), max(6, box.height)
    while low <= high:
        middle = (low + high) // 2
        left, top, right, bottom = load_font(font_path, middle).getbbox(original or "Xg")
        if (bottom - top) <= box.height:
            best, low = middle, middle + 1
        else:
            high = middle - 1
    return best


def measure_free_space(
    image: Image.Image,
    box: BBox,
    align: str,
    tolerance: float = 20.0,
    step: int = 4,
) -> BBox:
    """How far the plain background extends around ``box``.

    The placeholder's own width is not the constraint that matters — a name
    set in a wide empty margin can run past it, and one boxed in by an icon
    cannot. Growing outward while the pixels stay the colour of the page
    measures the room that is actually there, so long values wrap or shrink
    only when they genuinely have to.

    Expects the plate *after* the original text is erased; otherwise it
    measures up against the very words it is replacing.
    """
    rgb = np.asarray(image.convert("RGB"), dtype=np.float32)
    height, width = rgb.shape[:2]
    inner = box.clamp(width, height)
    if inner.area <= 0:
        return box

    page = np.median(rgb[inner.y1 : inner.y2, inner.x1 : inner.x2].reshape(-1, 3), axis=0)

    def uniform(y1: int, y2: int, x1: int, x2: int) -> bool:
        if x2 <= x1 or y2 <= y1:
            return False
        strip = rgb[y1:y2, x1:x2].reshape(-1, 3)
        return bool((np.linalg.norm(strip - page, axis=1) <= tolerance).mean() > 0.97)

    limit = int(max(box.width, box.height) * 2.5)

    right = box.x2
    if align in {"left", "center", "auto"}:
        while right + step <= width and right - box.x2 < limit and uniform(box.y1, box.y2, right, right + step):
            right += step

    left = box.x1
    if align in {"right", "center"}:
        while left - step >= 0 and box.x1 - left < limit and uniform(box.y1, box.y2, left - step, left):
            left -= step

    bottom = box.y2
    while bottom + step <= height and bottom - box.y2 < box.height * 2 and uniform(bottom, bottom + step, box.x1, box.x2):
        bottom += step

    return BBox(left, box.y1, right, bottom)


def wrap_to_width(text: str, font: ImageFont.FreeTypeFont, width: int) -> list[str]:
    """Greedy word wrap. A single word too wide for the line is left alone."""
    words = text.split()
    if not words:
        return [text]
    lines: list[str] = []
    current = words[0]
    for word in words[1:]:
        candidate = f"{current} {word}"
        left, _top, right, _bottom = font.getbbox(candidate)
        if (right - left) <= width:
            current = candidate
        else:
            lines.append(current)
            current = word
    lines.append(current)
    return lines


@dataclass
class Layout:
    """A planned rendering of replacement text."""

    lines: list[str]
    font: ImageFont.FreeTypeFont
    size: int
    #: The space the text may occupy — the placeholder plus any clear room
    #: found around it.
    area: BBox
    shrunk_from: int | None = None


def plan_text(
    image: Image.Image,
    line: "TextLine",
    replacement: str,
    font_path: str | None,
    align: str,
    max_lines: int = 3,
    min_scale: float = 0.55,
) -> Layout:
    """Decide the size, wrapping and area for a replacement string.

    Order of preference: keep the designer's size on one line; then wrap onto
    as many lines as the clear space below allows; only then shrink. Shrinking
    last is what stops a long business name from being set in type half the
    height of everything around it when there was room to wrap instead.
    """
    area = measure_free_space(image, line.box, align)
    target = match_original_size(line.text, line.box, font_path)

    # Search well below the comfortable floor before giving up. Type that is
    # smaller than intended is a compromise; type printed over the line below
    # it is a broken poster, so the hard limit is legibility, not taste.
    hard_floor = max(7, int(target * 0.30))
    for size in range(target, hard_floor - 1, -1):
        font = load_font(font_path, size)
        lines = wrap_to_width(replacement, font, area.width)
        if len(lines) > max_lines:
            continue
        line_height = font.getbbox("Xg")[3] - font.getbbox("Xg")[1]
        spacing = int(round(line_height * 0.22))
        total = len(lines) * line_height + (len(lines) - 1) * spacing
        widest = max((font.getbbox(text)[2] - font.getbbox(text)[0]) for text in lines)
        # ``area`` always starts at the placeholder and only grows, so its
        # height is the real ceiling — there is no reason to fall back to the
        # box's own height, and doing so let a block overrun into the line
        # below.
        if widest <= area.width and total <= area.height:
            return Layout(lines, font, size, area, None if size == target else target)

    # Not even the hard floor fitted: this value cannot be set in this space.
    # Use the floor, and let the caller warn that it will overlap.
    font = load_font(font_path, hard_floor)
    return Layout(wrap_to_width(replacement, font, area.width), font, hard_floor, area, target)


def draw_replacement(
    image: Image.Image,
    line: "TextLine",
    replacement: str,
    font_path: str | None = None,
    align: str = "auto",
) -> Image.Image:
    """Draw ``replacement`` where ``line`` was, at the original's size and colour.

    The caller is expected to have erased the original first; this only draws.
    """
    canvas = image.convert("RGB").copy()
    draw = ImageDraw.Draw(canvas)

    if align == "auto":
        # Centre it only if the original was centred on the page; otherwise
        # keep the left edge, which is what almost every layout wants.
        centre = (line.box.x1 + line.box.x2) / 2
        align = "center" if abs(centre - canvas.width / 2) < canvas.width * 0.06 else "left"

    plan = plan_text(canvas, line, replacement, font_path, align)
    font = plan.font
    metrics = font.getbbox("Xg")
    line_height = metrics[3] - metrics[1]
    spacing = int(round(line_height * 0.22))

    total = len(plan.lines) * line_height + (len(plan.lines) - 1) * spacing
    # A single line is centred in the space the original occupied. A wrapped
    # block starts at the top of it and grows down into the room that was
    # measured — centring the *first* line and then growing pushed the last
    # line past the free space and into the tagline below it.
    if total <= line.box.height:
        top = line.box.y1 + (line.box.height - line_height) // 2
    else:
        top = line.box.y1

    for index, text in enumerate(plan.lines):
        left, top_offset, right, _bottom = font.getbbox(text)
        width = right - left
        if align == "center":
            x = plan.area.x1 + (plan.area.width - width) // 2
        elif align == "right":
            x = plan.area.x2 - width
        else:
            x = line.box.x1
        y = top + index * (line_height + spacing)
        draw.text((x - left, y - top_offset), text, font=font, fill=line.colour)

    if plan.shrunk_from and total > plan.area.height:
        get_logger().warning(
            "%r does not fit the space at any readable size (%d lines at %dpt need %dpx, only %dpx are "
            "clear) and will overlap what is below it. Shorten the value or redesign the slot.",
            replacement,
            len(plan.lines),
            plan.size,
            total,
            plan.area.height,
        )
    elif plan.shrunk_from:
        get_logger().warning(
            "%r did not fit at the original %dpt — set at %dpt%s. Shorten the value, or give the "
            "placeholder more room in the template.",
            replacement,
            plan.shrunk_from,
            plan.size,
            f" over {len(plan.lines)} lines" if len(plan.lines) > 1 else "",
        )
    else:
        get_logger().debug(
            "drew %r at %dpt over %d line(s), %s-aligned",
            replacement,
            plan.size,
            len(plan.lines),
            align,
        )
    return canvas
