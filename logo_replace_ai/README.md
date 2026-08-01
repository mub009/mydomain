# logo_replace_ai

Swap the logo on a poster: **YOLO** finds the old one, **Stable Diffusion XL
inpainting** erases it, and your transparent PNG is blended into the space it
left — scaled, centred and shadowed automatically. Runs on one file or a
whole folder.

```
input/poster.png  ──►  detect  ──►  mask  ──►  inpaint  ──►  overlay  ──►  output/poster.png
                       YOLO         dilate     SDXL          fit + shadow
                                    feather    (or NumPy fill)
```

---

## Install

Python 3.10+ (tested on 3.11), Windows / Linux / macOS.

```bash
cd logo_replace_ai
python -m venv .venv

# Windows
.venv\Scripts\activate
# Linux / macOS
source .venv/bin/activate

python -m pip install -r requirements.txt
```

**NVIDIA GPU?** Install the CUDA build of torch *before* the rest, otherwise
pip hands you the CPU-only wheel and SDXL will take minutes per image:

```bash
python -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121
python -m pip install -r requirements.txt
```

Only need the fast CPU path (`--inpaint classical`, `--boxes`)? Two packages
are enough:

```bash
python -m pip install pillow numpy
```

---

## Quick start

Try it on the bundled sample poster — no weights, no downloads, about a second:

```bash
python app.py --input input/poster.png --boxes 80,90,300,150 --inpaint classical
```

That writes `output/poster.png` with the ACME logo replaced by
`input/new_logo.png`.

The real thing, with a trained detector and diffusion fill:

```bash
python app.py                       # every image in input/, logo = input/new_logo.png
python app.py --logo brand/acme.png --debug-dir output/_debug -v
```

---

## Getting a detector

Four ways to locate the old logo, in increasing order of effort and accuracy.

* **`--slots` — for templates with an empty logo box.** If the poster is a
  designer's template that marks the logo position with a guide frame, often
  labelled `@LOGO@`, this finds that box directly:

  ```bash
  python app.py --input input/poster.png --slots --inpaint classical
  ```

  It is pure geometry — mark the thin strokes, close the dashes into a solid
  outline, then keep blobs whose four sides are inked and, crucially, whose
  *inside is the same colour as the page outside*. That last test is what
  separates a guide frame from a filled card: paper shows through a frame.
  An empty middle does **not** work as a test, because the slot legitimately
  holds a placeholder icon and caption.

  On replica templates it locates the slot every time at 0.94 confidence with
  no false positives — the review card, the pills and the circular badges are
  all correctly rejected. Far more reliable than `--auto`, because a slot has
  a definite shape whereas a logo does not.

  **If you still have the template as SVG, do it there instead.** Slot
  coordinates are exact and there is no guide frame to erase. This is for
  flattened PNG and JPEG exports, where that information is gone.

* **`--auto` — no model at all.** Finds logo-like regions by image analysis:

  ```bash
  python app.py --input input/poster.png --auto --inpaint classical
  ```

  It scores every isolated, busy, colour-distinct region on six signals
  (saliency, isolation from its surroundings, size, aspect, colourfulness,
  corner placement) and returns the best one. On a synthetic benchmark of
  posters with known logo positions — varied backgrounds, seven placements,
  with and without a card behind the logo — it gets **71% top-1 hits, 15%
  partial, 15% misses** on held-out seeds.

  That is useful for driving a batch you intend to review, and not safe to
  trust blind: a miss does not merely skip the logo, it erases the wrong part
  of the poster. It returns **one** region by default (`--auto-max N` for
  more) precisely because a false positive is destructive. Always check
  `--debug-dir` output on a new kind of poster before running a batch.

  It cannot tell a logo from any other isolated graphic — QR codes, badges
  and stylised headlines all look logo-like to it.

* **`--boxes` — exact, when the layout is fixed.** If the logo always sits in
  the same slot, this is more accurate than any detector and costs nothing:

  ```bash
  python app.py --boxes 0.08,0.05,0.24,0.12      # x,y,w,h as fractions
  ```

* **A trained YOLO model — the accurate option.** `models/best.pt` is **not**
  included; logo detection is dataset-specific and a generic COCO model has
  no "logo" class.

* **Train one.** Label a few hundred posters (Roboflow, CVAT, Label Studio),
  export in YOLO format, then:

  ```bash
  yolo detect train model=yolov8s.pt data=logos.yaml epochs=100 imgsz=960
  cp runs/detect/train/weights/best.pt models/best.pt
  ```

Box syntax, for `--boxes`: `x,y,w,h` from the top-left corner, semicolons
between boxes. Values ≤ 1 are read as fractions of the image, so one spec
works across poster sizes.

```bash
python app.py --boxes 80,90,300,150                       # pixels
python app.py --boxes "80,90,300,150; 700,1200,220,90"    # two logos
```

---

## How it works

| Step | File | What happens |
|------|------|--------------|
| Detect | `detect.py` | YOLO, the `--auto` heuristic, or `--boxes`. Boxes below `--conf` are dropped, absurdly small/large ones too, and overlapping boxes are merged so one logo is filled once. |
| Mask | `utils.py` | Each box is grown by `--dilate` (swallows anti-aliased edges) and feathered *outward* by `--feather`, so the core is fully repainted and the border fades. |
| Inpaint | `inpaint.py` | SDXL fills a square crop around each region at 1024 px and the patch is composited back — pixels outside the mask stay bit-for-bit identical. |
| Overlay | `overlay.py` | Transparent margins are trimmed, the logo is scaled to fit the box (aspect preserved, `--scale` leaves breathing room), aligned, shadowed and alpha-composited. |

### Making the result look real

Two things give away a pasted logo, and both are handled automatically
(`--no-realistic` turns them off):

* **It is too clean.** A vector logo has no grain; a photograph or a scanned
  print does. The backdrop's fine-detail level is measured inside the landing
  area and matched onto the logo. On flat artwork the measurement is zero and
  nothing is added.
* **It disappears.** A white logo on a white page is the least realistic
  outcome there is. The contrast of every visible logo pixel is measured
  against the surface behind it, and if more than 15% of them fall below
  `--min-contrast` (default 2.0:1) the logo is lifted off the page with a halo
  toned against the *page* — dark on light, light on dark — and a warning
  tells you a proper logo variant would look better.

  Measuring the logo's *average* colour is not enough: a mark with a dark
  symbol and white type averages to mid-grey and passes while its wordmark is
  invisible.

### Logo quality

Enlarging cannot invent detail. If the logo file is smaller than the slot it
has to fill, the result will be soft no matter what any tool does — so the
pipeline tells you, with the numbers:

```
WARNING logo.png is only 97x48 and this slot needs 200x99 — enlarging 2.1x,
        so it will look soft. Supply the logo at 200 px wide or more
        (an SVG or the vector original is better still).
```

What it does do when it must enlarge: LANCZOS resampling, then an unsharp
mask and a tightened alpha edge, both ramped with the enlargement factor and
capped before they start ringing. That recovers some of the crispness
interpolation costs. It does not recover JPEG artefacts, a fuzzy scan, or
detail that was never in the file. `--no-sharpen` turns it off.

In order of what actually fixes a poor logo:

1. **The vector original** — SVG, AI, EPS or PDF. Export a PNG from it at the
   size you need and the problem disappears permanently.
2. **A large PNG with real transparency**, at least as wide as the biggest
   slot you will fill.
3. **A JPEG on a white background** — the common case, and the worst. It has
   no alpha, so it lands as a solid rectangle (the tool warns), and JPEG rings
   every edge. Usable on a white poster, visibly wrong anywhere else.

`--max-upscale` (default 4.0) caps enlargement; when it bites, the logo will
not fill its slot and you get told that too.

## Text

The same problem as the logo: a template carries `@CLINIC_NAME@` where a
shop's own name belongs, and once it is exported to PNG that placeholder is
just pixels. See what is there:

```bash
python app.py --input poster.png --slots --find-text --dry-run
```

```
Text
----
  [1] token '@CLINIC NAME@'
        box=411x43@(41,276)  colour=#0c2878  conf=59  key=CLINICNAME
  [2] text  'Your Smile, Our Priority'
        box=277x23@(44,327)  colour=#2359ce  conf=96  key=YOURSMILEOURPRIORITY

  2 line(s), 1 placeholder token(s).
```

### A token map, for a template you fill repeatedly

A template has the same handful of placeholders every time, so name them once
in a file rather than repeating flags:

```
# tokens.txt — blank lines and # comments ignored
@CLINIC_NAME@   = Smile Dental Care
@BUSINESS_NAME@ = Smile Dental Care
@PHONE@         = +966 11 555 0123
@ADDRESS@       = 42 Olaya Street, Riyadh
@CITY@          = Riyadh
```

```bash
python app.py --input poster.png --slots --inpaint classical --text-map tokens.txt
```

JSON works too (`{"@PHONE@": "+966 …"}`). Any `--set-text` on the command
line overrides the file for that token.

Tokens that are not in this particular poster are reported, not silently
skipped — the same distinction `fillSvgTemplate` draws between filled and
unfilled slots:

```
WARNING 4 token(s) not found in this poster: @BUSINESS_NAME@, @PHONE@,
        @ADDRESS@, @CITY@. Run --find-text to see what OCR actually read.
```

**Writing a key as a token means the token.** `@ADDRESS@` matches only a
placeholder; it will not touch the word "Address" used as a label, even
though both reduce to the same letters. To replace ordinary text, give the
text's own key (`ADDRESS`) or its `[n]` index.

### Replacing individual lines

```bash
python app.py --input poster.png --slots --inpaint classical \
  --set-text "CLINICNAME=Smile Dental Care" \
  --set-text "2=Gentle care, every visit" \
  --font "C:/Windows/Fonts/Montserrat-Bold.ttf"
```

Each replaced line is erased with the same fill the logo uses — on a
template's flat page that reproduces the paper exactly — and the new words are
drawn at the size and colour of the words they replace. Padding around the
erase is scaled to the line height, not the logo default, because lines of
type sit a few pixels apart and a logo-sized mask washes out the line below.

`--find-text` and `--set-text` need **Tesseract**, which is a separate program,
not a Python package:

* Windows: <https://github.com/UB-Mannheim/tesseract/wiki> — tick "Add to PATH"
* Debian/Ubuntu: `sudo apt install tesseract-ocr`
* then `python -m pip install pytesseract`

### What this cannot do

* **Match the font.** Pixels do not record which typeface drew them. The
  replacement is rendered in the font *you* pass with `--font`; give it the
  template's own font and the result is convincing, give it anything else and
  the poster looks subtly wrong.
* **Read perfectly.** Tesseract reads `@CLINIC_NAME@` as `@CLINIC` + `NAME@` —
  the underscore is lost — so keys are matched on letters and digits only,
  case-insensitively. Check `--find-text` before running a batch.
* **Read every script.** Malayalam, Arabic and similar need their language
  pack installed (`tesseract-ocr-mal`, `tesseract-ocr-ara`). Latin placeholder
  tokens read fine without them.

**With the SVG template, do it there.** `fillSvgTemplate` in the posters module
already substitutes tokens in the designer's own font, at the right size, in
the right colour. Nothing is guessed and nothing is erased. This is only for
flattened exports.

## Colour

A logo dropped onto a poster whose colours fight it looks wrong however well
it is placed. Start by looking at both palettes:

```bash
python app.py --input poster.png --slots --logo brand.png --palette --dry-run
```

```
Colour
------
  poster: #4678be (23%), #0a46c8 (21%), #d2aa96 (8%), #0c2878 (5%)
  logo:   #10847a (40%), #122a60 (33%), #5a6e8c (8%)
  closest logo-to-poster distance: ΔE 53 — different families; --match-poster would tie them together
```

Neutrals are deliberately excluded. A poster is mostly white paper and black
type; the accent covering 6% of the page is the colour that matters. ΔE is
CIE76 perceptual distance — under 12 the colours are the same, over 60 they
clash.

### Changing the combination

**Retint the poster to the brand** — almost always the right direction. The
brand colour is fixed; the template is yours:

```bash
python app.py --input poster.png --slots --logo brand.png --match-poster
```

Hue rotates, **lightness does not**, which is what keeps gradients, shading,
white paper and black type intact through the change. Only pixels near the
accent hue move (`--hue-tolerance`, default 35°), weighted smoothly by hue
distance and saturation so there are no hard edges or fringes. On the dental
template this takes every blue — panels, headline, pills, icon outlines,
bottom band — to the logo's teal, and leaves the skin tones in the photograph
alone: measured (210,170,150) before, (210,169,151) after.

Override either end when the detection is not what you want:

```bash
python app.py --match-poster --accent 0a46c8 --brand c2185b   # blue → pink
```

**Two things to watch.** A retint moves *every* pixel near the accent hue,
including third-party marks that share it — a Google badge, a payment logo, a
map pin. The tool warns; check those before publishing. And if the accent hue
is orange or red, skin tones sit in the same part of the wheel and a photo
will shift with it. Lower `--hue-tolerance` or set an explicit `--accent`.

**Retint the logo to the poster** (`--tint-logo`) goes the other way. It
alters someone's brand colours, so it warns every time. Defensible for a
single-colour mark used as an ornament, wrong for a real identity.

### Doing this in the Markkito backend instead

`backend/src/modules/posters/palettes.ts` already drives poster colour through
named palettes with roles (`bg`, `bgAlt`, `ink`, `muted`, `accent`,
`onAccent`). For per-shop brand colour the clean move is to derive a `Palette`
from the shop's logo — take the brand colour as `accent`, pick `bg`/`ink` for
contrast against it — and hand that to the existing layout machinery. That
recolours the poster at design time, in vector, with no hue rotation and no
risk to photographs. `--match-poster` here is for flattened images, where that
option is gone.

### Inpainting backends

| `--inpaint` | Needs | Speed | Use it when |
|-------------|-------|-------|-------------|
| `sdxl` *(default)* | GPU + ~7 GB download | seconds/image on GPU | Final renders; textured or photographic backgrounds. |
| `classical` | pillow + numpy | milliseconds | Previews, CI, flat or gradient backgrounds. |
| `none` | — | instant | The new logo fully covers the old one anyway. |

`classical` has three implementations, chosen with `--classical-method`:

* `pillow` *(default)* — a pull-push pyramid fill in pure NumPy. It halves the
  image repeatedly while tracking how much real pixel data backs each sample,
  then walks back up filling holes from the coarser level. Smooth
  extrapolation of the surrounding colour and gradient, no extra dependency.
* `telea` / `ns` — OpenCV's algorithms, if `opencv-python` is installed. They
  fall back to `pillow` with a warning when cv2 cannot be imported, which on
  Windows is common: the wheel installs fine and then fails with "DLL load
  failed" because the Visual C++ runtime is missing.

Whichever runs, wide holes are filled on a downscaled copy and the patch is
scaled back up — the OpenCV algorithms fan colour in from the rim and smear
visibly on a hole more than ~100 px wide. Tune with `--classical-max-span`.

---

## Common flags

```
--input PATH            image or folder            --recursive
--output DIR            output folder              --no-overwrite
--logo PATH             transparent PNG            --debug-dir DIR

--weights models/best.pt   --conf 0.35   --max-det 8   --classes 0,2
--slots                    find a template's empty logo box
--auto                     heuristic detection, no model needed
--auto-max 1               how many regions --auto may return
--boxes "x,y,w,h; …"       bypass detection entirely

--inpaint sdxl|classical|none    --steps 30   --guidance 7.0
--classical-method pillow|telea|ns   --classical-max-span 96
--prompt "…"  --negative-prompt "…"  --seed 42
--dilate 10   --feather 6    --work-size 1024   --cpu-offload

--scale 0.92  --align-x center  --align-y center
--opacity 1.0 --no-shadow  --shadow-opacity 0.35  --no-overlay
--no-realistic             skip grain matching and the contrast halo
--min-contrast 2.0         contrast ratio below which a halo is added

--find-text                list every line of text with box, colour and key
--set-text "KEY=words"     replace a line (repeatable)
--text-map tokens.txt      read TOKEN=value pairs from a file
--font path.ttf            font for replacement text  --text-align auto

--palette                  report both palettes and their ΔE distance
--match-poster             retint the poster to the logo's brand colour
--tint-logo                recolour the logo to the poster's accent
--accent RRGGBB  --brand RRGGBB  --hue-tolerance 35

--device auto|cpu|cuda|cuda:0|mps   --dtype auto|fp16|bf16|fp32
--dry-run   --fail-fast   -v
```

Every setting also reads from the environment with a `LOGO_AI_` prefix
(`LOGO_AI_CONFIDENCE=0.5`, `LOGO_AI_INPAINT_BACKEND=classical`, …), which is
the easy way to configure a container. Precedence: CLI flag → env var →
default in `config.py`.

---

## Batch processing

```bash
python app.py --input posters/ --recursive --logo brand/new.png --fail-fast
```

* The model loads once and is reused for every image.
* The input tree is mirrored under `output/`; everything is written as PNG.
* One bad image does not kill the run — it is logged, counted and skipped
  (use `--fail-fast` for the opposite).
* A summary table prints at the end.

```
Summary
-------
  ✓ poster.png                     1 logo(s) → output/poster.png  [4.2s]
  ! flyer.png                      no logo found                  [0.4s]
  ✗ broken.png                     could not read image           [0.0s]

3 image(s) in 8.8s — 1 failed, 1 no-detection, 1 ok
```

Exit code is `0` only when every image produced output; `1` if any failed or
had no detection, `2` for bad usage or configuration.

---

## Tuning

| Symptom | Fix |
|---------|-----|
| Ghost outline of the old logo | raise `--dilate` (12–20) |
| Visible seam around the patch | raise `--feather` (8–12) |
| Logo touches the box edges | lower `--scale` (0.8–0.85) |
| Fill invents text or texture | strengthen `--negative-prompt`, raise `--steps` |
| Same input, different result each run | set `--seed 42` |
| CUDA out of memory | `--cpu-offload`, or `--work-size 768` |
| Logo looks pasted on | keep the shadow, or `--shadow-opacity 0.2` for flat art |
| Nothing detected | lower `--conf 0.2`, check `--debug-dir` output |
| `--auto` picks the wrong thing | use `--boxes` for that poster, or raise `--auto-max` and pick |
| Poster is a template with an empty box | use `--slots`, not `--auto` |
| Logo barely visible on the page | heed the contrast warning — supply a light/dark logo variant |
| Logo looks soft or blocky | it is being enlarged; supply it at the px width the warning names |
| Logo clashes with the poster | `--palette` to see the numbers, `--match-poster` to fix |
| Retint changed a photo or a third-party badge | lower `--hue-tolerance`, or set `--accent` explicitly |

`--debug-dir` writes three files per image: the detections drawn on the
input, the mask, and the cleaned plate before the new logo goes on. That is
usually enough to tell a detection problem from an inpainting one.

---

## Project layout

```
logo_replace_ai/
├── app.py            CLI, batch loop, error handling, summary
├── detect.py         YOLO wrapper + manual-box detector
├── inpaint.py        SDXL / OpenCV / no-op backends
├── overlay.py        fit, align, shadow, alpha composite
├── palette.py        palette extraction, ΔE distance, retinting
├── text.py           OCR, line grouping, text replacement
├── utils.py          errors, logging, geometry, masks, image IO
├── config.py         every setting, with env overrides and validation
├── requirements.txt
├── models/           best.pt goes here (not committed)
├── input/            poster.png + new_logo.png samples
└── output/           results (git-ignored)
```

Heavy dependencies are imported lazily, so `--help`, configuration errors and
the classical path all work without torch installed — and a missing package
reports the exact `pip install` line rather than a traceback.

---

## Windows notes

* Paths are handled with `pathlib`; forward and back slashes both work.
* Long HuggingFace cache paths can trip the 260-character limit — set
  `HF_HOME=C:\hf` if a download fails with a path error.
* `import cv2` failing with "DLL load failed" means the Visual C++ runtime is
  missing. Nothing needs fixing — the default `pillow` fill does not use
  OpenCV. Install [vc_redist.x64.exe](https://aka.ms/vs/17/release/vc_redist.x64.exe)
  only if you specifically want `--classical-method telea`.
* Use `python -m pip install …` rather than `pip install …`. A bare `pip` can
  belong to a different interpreter than the one running the script, which
  installs the package somewhere your venv will never look.
* No symlinks or `fork()` are used anywhere.
