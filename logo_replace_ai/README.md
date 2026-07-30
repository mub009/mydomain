# logo_replace_ai

Swap the logo on a poster: **YOLO** finds the old one, **Stable Diffusion XL
inpainting** erases it, and your transparent PNG is blended into the space it
left — scaled, centred and shadowed automatically. Runs on one file or a
whole folder.

```
input/poster.png  ──►  detect  ──►  mask  ──►  inpaint  ──►  overlay  ──►  output/poster.png
                       YOLO         dilate     SDXL          fit + shadow
                                    feather    (or OpenCV)
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

pip install -r requirements.txt
```

**NVIDIA GPU?** Install the CUDA build of torch *before* the rest, otherwise
pip hands you the CPU-only wheel and SDXL will take minutes per image:

```bash
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121
pip install -r requirements.txt
```

Only need the fast CPU path (`--inpaint classical`, `--boxes`)? Three packages
are enough:

```bash
pip install pillow numpy opencv-python
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

`models/best.pt` is **not** included — logo detection is dataset-specific and
a generic COCO model has no "logo" class.

* **Train one.** Label a few hundred posters (Roboflow, CVAT, Label Studio),
  export in YOLO format, then:

  ```bash
  yolo detect train model=yolov8s.pt data=logos.yaml epochs=100 imgsz=960
  cp runs/detect/train/weights/best.pt models/best.pt
  ```

* **Or skip detection.** If the logo always sits in the same slot — which is
  the normal case for a poster template — pass the box directly:

  ```bash
  python app.py --boxes 0.08,0.05,0.24,0.12      # x,y,w,h as fractions
  python app.py --boxes 80,90,300,150            # …or pixels
  python app.py --boxes "80,90,300,150; 700,1200,220,90"   # two logos
  ```

  Values ≤ 1 are read as fractions of the image, so one spec works across
  poster sizes.

---

## How it works

| Step | File | What happens |
|------|------|--------------|
| Detect | `detect.py` | YOLO runs, boxes below `--conf` are dropped, absurdly small/large ones too, overlapping boxes are merged so one logo is filled once. |
| Mask | `utils.py` | Each box is grown by `--dilate` (swallows anti-aliased edges) and feathered *outward* by `--feather`, so the core is fully repainted and the border fades. |
| Inpaint | `inpaint.py` | SDXL fills a square crop around each region at 1024 px and the patch is composited back — pixels outside the mask stay bit-for-bit identical. |
| Overlay | `overlay.py` | Transparent margins are trimmed, the logo is scaled to fit the box (aspect preserved, `--scale` leaves breathing room), aligned, shadowed and alpha-composited. |

### Inpainting backends

| `--inpaint` | Needs | Speed | Use it when |
|-------------|-------|-------|-------------|
| `sdxl` *(default)* | GPU + ~7 GB download | seconds/image on GPU | Final renders; textured or photographic backgrounds. |
| `classical` | opencv only | milliseconds | Previews, CI, flat or gradient backgrounds. |
| `none` | — | instant | The new logo fully covers the old one anyway. |

`classical` fills wide holes on a downscaled copy and scales the patch back
up. Telea and Navier-Stokes both fan colour in from the rim, which smears
visibly on a hole more than ~100 px wide; filling small and enlarging gives a
smooth continuation instead. Tune with `--classical-max-span` via
`LOGO_AI_CLASSICAL_MAX_SPAN`.

---

## Common flags

```
--input PATH            image or folder            --recursive
--output DIR            output folder              --no-overwrite
--logo PATH             transparent PNG            --debug-dir DIR

--weights models/best.pt   --conf 0.35   --max-det 8   --classes 0,2
--boxes "x,y,w,h; …"       bypass YOLO entirely

--inpaint sdxl|classical|none    --steps 30   --guidance 7.0
--prompt "…"  --negative-prompt "…"  --seed 42
--dilate 10   --feather 6    --work-size 1024   --cpu-offload

--scale 0.92  --align-x center  --align-y center
--opacity 1.0 --no-shadow  --shadow-opacity 0.35  --no-overlay

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
* No symlinks or `fork()` are used anywhere.
