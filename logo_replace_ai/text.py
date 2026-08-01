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


def match_line(lines: list[TextLine], key: str) -> TextLine | None:
    """Find the line a ``--set-text`` key refers to: an index, or its text."""
    if key.isdigit():
        position = int(key) - 1
        return lines[position] if 0 <= position < len(lines) else None
    for line in lines:
        if line.key == key:
            return line
    for line in lines:  # substring, so @CLINIC_NAME@ can be given as CLINICNAME
        if key and key in line.key:
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


def fit_font(text: str, box: BBox, font_path: str | None, max_size: int = 400) -> ImageFont.FreeTypeFont:
    """Largest font size whose rendering of ``text`` still fits ``box``."""
    low, high, best = 4, max(6, min(max_size, box.height * 3)), None
    while low <= high:
        middle = (low + high) // 2
        font = load_font(font_path, middle)
        left, top, right, bottom = font.getbbox(text)
        if (right - left) <= box.width and (bottom - top) <= box.height:
            best, low = font, middle + 1
        else:
            high = middle - 1
    return best or load_font(font_path, 8)


def draw_replacement(
    image: Image.Image,
    line: TextLine,
    replacement: str,
    font_path: str | None = None,
    align: str = "auto",
) -> Image.Image:
    """Draw ``replacement`` where ``line`` was, matched to its size and colour.

    The caller is expected to have erased the original first; this only draws.
    """
    canvas = image.convert("RGB").copy()
    draw = ImageDraw.Draw(canvas)
    font = fit_font(replacement, line.box, font_path)
    left, top, right, bottom = font.getbbox(replacement)
    width, height = right - left, bottom - top

    if align == "auto":
        # Centre it only if the original was centred on the page; otherwise
        # keep the left edge, which is what almost every layout wants.
        page_centre = canvas.width / 2
        line_centre = (line.box.x1 + line.box.x2) / 2
        align = "center" if abs(line_centre - page_centre) < canvas.width * 0.06 else "left"

    if align == "center":
        x = line.box.x1 + (line.box.width - width) // 2
    elif align == "right":
        x = line.box.x2 - width
    else:
        x = line.box.x1
    y = line.box.y1 + (line.box.height - height) // 2

    draw.text((x - left, y - top), replacement, font=font, fill=line.colour)
    get_logger().debug(
        "drew %r at %dpt, %s-aligned, in #%02x%02x%02x",
        replacement,
        font.size,
        align,
        *line.colour,
    )
    return canvas
