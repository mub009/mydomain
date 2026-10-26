import { api, errorMessage } from "../lib/api";
import {
  DETAILS,
  PURITIES,
  detailText,
  drawBox,
  drawField,
  drawPoster,
  ensureFonts,
  fieldWithDefaults,
  loadImage,
  posterBlob,
  posterFileName,
  qrTarget,
  renderPoster,
  saveBlob,
} from "../lib/gold-rate-render";
import { PRESETS, PRESET_GROUPS } from "../lib/gold-rate-presets";
import { icon } from "../lib/icons";
import { $, $$, esc, openModal, pageData } from "../lib/ui";
import { reloadWithFlash, showError, showFlash } from "../lib/widgets";

// The gold-rate template editor. The master PNG is drawn on a canvas at its
// own size (scaled on screen by the zoom); the logo and rate boxes are
// outlined on a layer above it that never reaches the export. Every box is
// kept in the master's pixels, as the server stores it.

const boot = pageData("gold-rate-editor-data");
const { template, fonts, weights } = boot;
const W = template.imageWidth;
const H = template.imageHeight;
const MIN_SIZE = 4;
// Business details and the QR code come from the linked business.
const BUSINESS_ELEMENTS = [...DETAILS, "qr"];
const ELEMENTS = ["logo", ...PURITIES, ...BUSINESS_ELEMENTS];
const BUSINESS_NAMES = {
  name: "Business name",
  phone: "Phone",
  address: "Address",
  website: "Website",
  page: "Markkito page",
  instagram: "Instagram",
  facebook: "Facebook",
  tagline: "Tagline",
  hours: "Today's hours",
  qr: "QR code",
};
const isBusiness = (key) => BUSINESS_ELEMENTS.includes(key);

const errorBox = $("[data-error]");
const fail = (err) => showError(errorBox, errorMessage(err));
showFlash();

// --- State and history ------------------------------------------------------
// `doc` is what Save stores and what undo/redo steps through. Rates are
// shared by every template, so they sit outside the history.
let doc = { name: template.name, businessId: template.businessId, layout: structuredClone(template.layout) };
// Layouts saved before the style keys existed get their defaults.
for (const p of PURITIES) doc.layout.fields[p] = fieldWithDefaults(doc.layout.fields[p]);
for (const k of DETAILS) doc.layout.details[k] = fieldWithDefaults(doc.layout.details[k]);
// Linked businesses' details (BusinessCard on the server), by id.
const cards = new Map(template.businessCard ? [[template.businessId, template.businessCard]] : []);
let rates = { ...boot.rates.rates };
let savedRates = JSON.stringify(rates);
const snapshot = () => JSON.stringify(doc);
let savedDoc = snapshot();
let history = [savedDoc];
let at = 0;
let selected = null;
let zoom = 1;
let background = null;
// Loaded logo images, by URL.
const logoImages = new Map();

const box = (key) => (key === "logo" ? doc.layout.logo : isBusiness(key) ? doc.layout.details[key] : doc.layout.fields[key]);
const card = () => (doc.businessId ? cards.get(doc.businessId) ?? null : null);
// The logo drawn is always the linked business's own.
const logoUrl = () => card()?.logoUrl ?? null;
const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
const round = (v) => Math.round(v * 100) / 100;
const dirty = () => snapshot() !== savedDoc || JSON.stringify(rates) !== savedRates;

// Records the current state as one undo step.
function commit() {
  const s = snapshot();
  if (s === history[at]) return;
  history = [...history.slice(0, at + 1), s].slice(-200);
  at = history.length - 1;
  changed();
}

function restore(index) {
  at = index;
  doc = JSON.parse(history[at]);
  $("[data-name]").value = doc.name;
  ensureCard(doc.businessId).catch(fail);
  loadLogo(logoUrl());
  changed();
  renderProps();
}
const undo = () => at > 0 && restore(at - 1);
const redo = () => at < history.length - 1 && restore(at + 1);

// After any change: redraw, move the outlines, refresh the controls.
function changed() {
  draw();
  drawPresetPreviews();
  ensureFonts(doc.layout, rates).then(draw);
  syncOverlay();
  syncElements();
  syncProps();
  $("[data-undo]").disabled = at === 0;
  $("[data-redo]").disabled = at === history.length - 1;
  const status = $("[data-status]");
  status.textContent = dirty() ? "Unsaved changes" : "All changes saved";
  status.className = `text-xs font-semibold ${dirty() ? "text-amber-600" : "text-emerald-700"}`;
}

// --- Canvas -----------------------------------------------------------------
const canvas = $("[data-canvas]");
canvas.width = W;
canvas.height = H;
const ctx = canvas.getContext("2d");
let frame = 0;

function draw() {
  if (frame || !background) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    drawPoster(ctx, { background, logo: logoImages.get(logoUrl()) ?? null, layout: doc.layout, rates, business: card() });
  });
}
document.fonts?.addEventListener?.("loadingdone", () => {
  draw();
  drawPresetPreviews();
});

function loadLogo(url) {
  if (!url || logoImages.has(url)) return;
  logoImages.set(url, null);
  loadImage(url)
    .then((img) => {
      logoImages.set(url, img);
      draw();
    })
    .catch(() => {
      logoImages.delete(url);
      showError(errorBox, "Could not load the logo. A business logo can only be used if it is stored on this site.");
    });
}

// Fetches a business's poster details once.
async function ensureCard(id) {
  if (!id || cards.has(id)) return;
  const { data } = await api.get(`/admin/gold-rates/businesses/${id}/card`);
  cards.set(id, data);
  if (doc.businessId === id) {
    loadLogo(logoUrl());
    changed();
  }
}

// --- Zoom -------------------------------------------------------------------
const viewport = $("[data-viewport]");
const stage = $("[data-stage]");

function setZoom(value) {
  zoom = clamp(value, 0.05, 4);
  stage.style.width = `${W * zoom}px`;
  stage.style.height = `${H * zoom}px`;
  // Centred when smaller than the viewport, scrollable when larger.
  stage.style.marginTop = `${Math.max(0, (viewport.clientHeight - H * zoom) / 2)}px`;
  $("[data-zoom-label]").textContent = `${Math.round(zoom * 100)}%`;
  syncOverlay();
}
const fit = () => setZoom(Math.min((viewport.clientWidth - 32) / W, (viewport.clientHeight - 32) / H, 1));

$("[data-zoom-in]").addEventListener("click", () => setZoom(zoom * 1.25));
$("[data-zoom-out]").addEventListener("click", () => setZoom(zoom / 1.25));
$("[data-zoom-fit]").addEventListener("click", fit);
viewport.addEventListener(
  "wheel",
  (e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    setZoom(zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
  },
  { passive: false },
);
window.addEventListener("resize", () => setZoom(zoom));

// --- Outlines and handles ---------------------------------------------------
// Drawn in HTML over the canvas, so they never end up in the PNG.
const overlay = $("[data-overlay]");
const HANDLES = {
  nw: "left:-6px;top:-6px;cursor:nwse-resize",
  n: "left:50%;top:-6px;margin-left:-6px;cursor:ns-resize",
  ne: "right:-6px;top:-6px;cursor:nesw-resize",
  e: "right:-6px;top:50%;margin-top:-6px;cursor:ew-resize",
  se: "right:-6px;bottom:-6px;cursor:nwse-resize",
  s: "left:50%;bottom:-6px;margin-left:-6px;cursor:ns-resize",
  sw: "left:-6px;bottom:-6px;cursor:nesw-resize",
  w: "left:-6px;top:50%;margin-top:-6px;cursor:ew-resize",
};
// Business boxes only show once a business is linked.
const shown = (key) => box(key).visible && (!isBusiness(key) || Boolean(card()));
const elementName = (key) => (key === "logo" ? "Logo" : isBusiness(key) ? BUSINESS_NAMES[key] : `${key} rate`);
const outlineName = (key) => (key === "logo" ? (logoUrl() ? "Logo area" : "Logo area (no logo)") : elementName(key));
let overlayKey = "";

function renderOverlay() {
  overlay.innerHTML = ELEMENTS.filter(shown)
    .map((key) => {
      const active = key === selected;
      const handles = active
        ? Object.entries(HANDLES)
            .map(([dir, css]) => `<span data-handle="${dir}" class="absolute h-3 w-3 rounded-sm border-2 border-brand-600 bg-white" style="${css}"></span>`)
            .join("")
        : "";
      return `<div data-box="${key}" class="absolute cursor-move touch-none" style="outline:${active ? "2px solid #0f9e68" : "1px dashed rgba(15,158,104,.75)"}">
        <span class="pointer-events-none absolute -top-5 left-0 whitespace-nowrap rounded px-1.5 text-[10px] font-semibold leading-4 ${
          active ? "bg-brand-600 text-white" : "bg-white/90 text-brand-700"
        }">${outlineName(key)}</span>${handles}</div>`;
    })
    .join("");
  overlayKey = overlayState();
  positionBoxes();
}

function positionBoxes() {
  $$("[data-box]", overlay).forEach((el) => {
    const b = box(el.dataset.box);
    Object.assign(el.style, { left: `${b.x * zoom}px`, top: `${b.y * zoom}px`, width: `${b.width * zoom}px`, height: `${b.height * zoom}px` });
  });
}

const overlayState = () => `${selected}|${logoUrl()}|${ELEMENTS.filter(shown).join(",")}`;

function syncOverlay() {
  if (overlayKey !== overlayState()) renderOverlay();
  else positionBoxes();
}

function select(key) {
  if (key === selected) return;
  if (drawMode && key !== "logo") cancelDraw();
  selected = key;
  renderOverlay();
  syncElements();
  renderProps();
}

// --- Dragging and resizing --------------------------------------------------
function moveBox(start, dx, dy) {
  return { x: round(clamp(start.x + dx, 0, W - start.width)), y: round(clamp(start.y + dy, 0, H - start.height)) };
}

function resizeBox(start, dir, dx, dy, keepShape) {
  const right = start.x + start.width;
  const bottom = start.y + start.height;
  let { x, y, width, height } = start;
  if (dir.includes("e")) width = clamp(start.width + dx, MIN_SIZE, W - start.x);
  if (dir.includes("w")) {
    x = clamp(start.x + dx, 0, right - MIN_SIZE);
    width = right - x;
  }
  if (dir.includes("s")) height = clamp(start.height + dy, MIN_SIZE, H - start.y);
  if (dir.includes("n")) {
    y = clamp(start.y + dy, 0, bottom - MIN_SIZE);
    height = bottom - y;
  }
  if (keepShape) {
    // Follow whichever side moved more, then scale both, inside the image.
    const sx = width / start.width;
    const sy = height / start.height;
    const maxScale = Math.min((dir.includes("w") ? right : W - start.x) / start.width, (dir.includes("n") ? bottom : H - start.y) / start.height);
    const scale = clamp(Math.abs(sx - 1) >= Math.abs(sy - 1) ? sx : sy, MIN_SIZE / Math.min(start.width, start.height), maxScale);
    width = start.width * scale;
    height = start.height * scale;
    x = dir.includes("w") ? right - width : start.x;
    y = dir.includes("n") ? bottom - height : start.y;
  }
  return { x: round(x), y: round(y), width: round(width), height: round(height) };
}

// "Draw logo area": the next drag on the image marks where the logo goes.
let drawMode = false;
function setDrawMode(on) {
  drawMode = on;
  stage.style.cursor = on ? "crosshair" : "";
  stage.style.touchAction = on ? "none" : "";
  overlay.style.pointerEvents = on ? "none" : "";
  const button = $("[data-logo-draw]", props);
  if (button) {
    button.classList.toggle("!bg-brand-50", on);
    button.lastElementChild.textContent = on ? "Drag on the image… (Esc cancels)" : "Draw logo area";
  }
}

function imagePoint(e) {
  const r = stage.getBoundingClientRect();
  return { x: clamp((e.clientX - r.left) / zoom, 0, W), y: clamp((e.clientY - r.top) / zoom, 0, H) };
}

function cancelDraw() {
  if (drag?.draw) {
    Object.assign(doc.layout.logo, drag.before);
    drag = null;
    changed();
  }
  setDrawMode(false);
}

let drag = null;
stage.addEventListener("pointerdown", (e) => {
  if (drawMode) {
    e.preventDefault();
    select("logo");
    drag = { draw: true, from: imagePoint(e), x: e.clientX, y: e.clientY, before: { ...doc.layout.logo } };
    stage.setPointerCapture(e.pointerId);
    return;
  }
  const el = e.target.closest("[data-box]");
  if (!el) {
    select(null);
    return;
  }
  e.preventDefault();
  const key = el.dataset.box;
  select(key);
  drag = { key, dir: e.target.dataset.handle ?? null, x: e.clientX, y: e.clientY, start: { ...box(key) } };
  // On the stage, which stays put while the outlines are redrawn.
  stage.setPointerCapture(e.pointerId);
});
stage.addEventListener("pointermove", (e) => {
  if (!drag) return;
  if (drag.draw) {
    const to = imagePoint(e);
    const width = Math.max(Math.abs(to.x - drag.from.x), MIN_SIZE);
    const height = Math.max(Math.abs(to.y - drag.from.y), MIN_SIZE);
    Object.assign(doc.layout.logo, {
      visible: true,
      x: round(Math.min(drag.from.x, to.x, W - width)),
      y: round(Math.min(drag.from.y, to.y, H - height)),
      width: round(width),
      height: round(height),
    });
    changed();
    return;
  }
  const dx = (e.clientX - drag.x) / zoom;
  const dy = (e.clientY - drag.y) / zoom;
  // Shift keeps the box's proportions while resizing.
  Object.assign(box(drag.key), drag.dir ? resizeBox(drag.start, drag.dir, dx, dy, e.shiftKey) : moveBox(drag.start, dx, dy));
  changed();
});
const endDrag = (e) => {
  if (!drag) return;
  // A click without a drag leaves the area as it was.
  if (drag.draw && Math.abs(e.clientX - drag.x) < 4 && Math.abs(e.clientY - drag.y) < 4) {
    cancelDraw();
    return;
  }
  const drew = drag.draw;
  drag = null;
  if (drew) setDrawMode(false);
  commit();
};
stage.addEventListener("pointerup", endDrag);
stage.addEventListener("pointercancel", endDrag);

// --- Elements list ----------------------------------------------------------
const elementsList = $("[data-elements]");
const elementRow = (key) => `<div data-element="${key}" class="flex items-center gap-2 rounded-lg px-2 py-1.5">
    <input type="checkbox" data-element-visible="${key}" class="h-4 w-4 rounded border-gray-300 text-brand-600 disabled:opacity-40" aria-label="Show ${elementName(key)}" />
    <button type="button" data-element-select="${key}" class="flex-1 text-left text-sm font-semibold text-ink-800">${elementName(key)}</button>
    <span data-element-note="${key}" class="text-[11px] text-ink-400"></span>
  </div>`;
elementsList.innerHTML = `${["logo", ...PURITIES].map(elementRow).join("")}
  <div class="mt-3 border-t border-gray-100 pt-3">
    <div class="mb-1 flex items-center justify-between gap-2 px-2">
      <span class="text-[11px] font-bold uppercase tracking-wide text-ink-500">Business</span>
      <span class="flex gap-1">
        <button type="button" data-business-link class="rounded px-1.5 py-0.5 text-[11px] font-semibold text-brand-700 hover:bg-brand-50"></button>
        <button type="button" data-business-unlink class="rounded px-1.5 py-0.5 text-[11px] font-semibold text-ink-500 hover:bg-red-50 hover:text-red-700">Unlink</button>
      </span>
    </div>
    <p data-business-name class="mb-1 truncate px-2 text-xs text-ink-600"></p>
    ${BUSINESS_ELEMENTS.map(elementRow).join("")}
  </div>`;

function syncElements() {
  const c = card();
  for (const key of ELEMENTS) {
    const input = $(`[data-element-visible="${key}"]`);
    input.checked = box(key).visible;
    input.disabled = isBusiness(key) && !c;
    $(`[data-element="${key}"]`).classList.toggle("bg-brand-50", key === selected);
    $(`[data-element-note="${key}"]`).textContent =
      key === "logo"
        ? c
          ? c.logoUrl
            ? "business logo"
            : "business has none"
          : "link a business"
        : isBusiness(key) && !c
          ? ""
          : box(key).visible
            ? ""
            : "hidden";
  }
  $("[data-business-name]").textContent = c ? `${c.name}${c.city ? ` · ${c.city}` : ""}` : "Link a business to place its details and QR code.";
  $("[data-business-link]").textContent = c ? "Change" : "Link a business";
  $("[data-business-unlink]").hidden = !doc.businessId;
}
$$("[data-element-visible]").forEach((input) =>
  input.addEventListener("change", () => {
    box(input.dataset.elementVisible).visible = input.checked;
    if (input.checked) select(input.dataset.elementVisible);
    commit();
  }),
);
$$("[data-element-select]").forEach((button) => button.addEventListener("click", () => select(button.dataset.elementSelect)));
$("[data-business-link]").addEventListener("click", businessModal);
$("[data-business-unlink]").addEventListener("click", () => {
  doc.businessId = null;
  commit();
  renderProps();
});

// --- Business -----------------------------------------------------------------
function businessModal() {
  const modal = openModal(
    "Link a business",
    `<div class="space-y-3">
      <p class="text-sm text-ink-600">The poster can then show this business's logo, name, phone, address, website, opening hours and a QR code to its page — always its current details.</p>
      <input data-business-search class="input" placeholder="Search by name or city" autocomplete="off" />
      <div data-business-results class="max-h-80 space-y-1 overflow-y-auto"></div>
    </div>`,
  );
  const input = $("[data-business-search]", modal.body);
  const results = $("[data-business-results]", modal.body);
  let timer = 0;
  let latest = 0;
  const search = async () => {
    const mine = ++latest;
    results.innerHTML = `<p class="px-1 text-sm text-ink-500">Searching…</p>`;
    try {
      const { data } = await api.get("/admin/businesses", { search: input.value.trim(), pageSize: 20 });
      if (mine !== latest) return;
      results.innerHTML = data.length
        ? data
            .map(
              (b) => `<button type="button" data-business-pick="${b.id}" class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-brand-50 ${
                b.id === doc.businessId ? "bg-brand-50" : ""
              }">
              <span class="min-w-0 flex-1"><span class="block truncate text-sm font-semibold text-ink-900">${esc(b.name)}</span>
              <span class="block truncate text-xs text-ink-500">${esc([b.city, b.status === "PUBLISHED" ? "" : b.status.replace("_", " ").toLowerCase()].filter(Boolean).join(" · "))}</span></span>
            </button>`,
            )
            .join("")
        : `<p class="px-1 text-sm text-ink-500">No businesses match.</p>`;
      $$("[data-business-pick]", results).forEach((button) =>
        button.addEventListener("click", async () => {
          try {
            await ensureCard(button.dataset.businessPick);
          } catch (err) {
            showError(errorBox, errorMessage(err));
            return;
          }
          modal.close();
          doc.businessId = button.dataset.businessPick;
          loadLogo(logoUrl());
          commit();
          renderProps();
        }),
      );
    } catch (err) {
      results.innerHTML = `<p class="px-1 text-sm text-red-700">${esc(errorMessage(err))}</p>`;
    }
  };
  input.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(search, 250);
  });
  input.focus();
  search();
}

// --- Properties -------------------------------------------------------------
const props = $("[data-props]");
const label = (text, control) => `<label class="block"><span class="mb-1 block text-[11px] font-semibold text-ink-600">${text}</span>${control}</label>`;
const numberInput = (prop, attrs = "") => `<input type="number" data-prop="${prop}" step="1" ${attrs} class="input px-2.5 py-1.5" />`;
const iconButton = (attrs, name, title) =>
  `<button type="button" ${attrs} title="${title}" class="btn-secondary h-8 flex-1 px-0 text-sm">${icon(name, { size: 15 })}</button>`;

function positionControls() {
  return `<div class="grid grid-cols-4 gap-2">
      ${label("X", numberInput("x", 'min="0"'))}${label("Y", numberInput("y", 'min="0"'))}
      ${label("Width", numberInput("width", 'min="1"'))}${label("Height", numberInput("height", 'min="1"'))}
    </div>
    <div>
      <span class="mb-1 block text-[11px] font-semibold text-ink-600">Place on the image</span>
      <div class="flex gap-1">
        ${iconButton('data-place="left"', "align-start-vertical", "Left edge")}
        ${iconButton('data-place="center"', "align-center-vertical", "Centre horizontally")}
        ${iconButton('data-place="right"', "align-end-vertical", "Right edge")}
        ${iconButton('data-place="top"', "align-start-horizontal", "Top edge")}
        ${iconButton('data-place="middle"', "align-center-horizontal", "Centre vertically")}
        ${iconButton('data-place="bottom"', "align-end-horizontal", "Bottom edge")}
      </div>
    </div>`;
}

function logoControls() {
  const c = card();
  return `<h3 class="text-sm font-bold text-ink-900">Logo</h3>
    <p class="rounded-lg border border-gray-200 bg-gray-50/60 p-2.5 text-[11px] text-ink-600">${
      c
        ? c.logoUrl
          ? `Shows <strong>${esc(c.name)}</strong>'s own logo, so the poster stays in step with the business.`
          : `<strong>${esc(c.name)}</strong> has no logo yet. Add one from the business's dashboard and it shows here.`
        : "Link a business under Elements — its logo is placed here."
    }</p>
    <div>
      <span class="mb-1 block text-[11px] font-semibold text-ink-600">Logo area</span>
      <div class="flex gap-2">
        <button type="button" data-logo-draw class="btn-secondary flex-1 px-3 py-1.5 text-sm">${icon("pencil", { size: 14 })}<span>Draw logo area</span></button>
        <button type="button" data-logo-fit class="btn-secondary px-3 py-1.5 text-sm" title="Shrink the area to the logo's own shape">Fit to logo</button>
      </div>
      <p class="mt-1 text-[11px] text-ink-400">Drag a rectangle on the image to mark where the logo goes. The business's logo is fitted inside it, centred, keeping its shape and transparency — changing the logo never moves the area.</p>
    </div>
    ${positionControls()}`;
}

// --- Style presets ----------------------------------------------------------
// Ready-made looks for a rate box (resources/js/lib/gold-rate-presets.js),
// shown one group at a time. Sizes follow the box's height so a preset
// suits any box; position and size are left alone.
let presetGroup = PRESET_GROUPS[0].id;

// The admin's own presets ("Save as preset"), stored on the server and
// listed after the built-in ones.
let customPresets = boot.presets.map((p) => ({ ...p, group: "mine", custom: true }));
const allPresets = () => [...PRESETS, ...customPresets];

// A preset's style for a box `height` tall. `radius`, `border` and
// `fontScale` are fractions of the height. Built-in presets leave the font
// family alone; saved ones bring their own.
function presetStyle(id, height) {
  const { radius, border = 0, fontScale = 0.48, ...style } = allPresets().find((p) => p.id === id).style;
  return {
    labelBackground: null,
    shape: "rect",
    gradientDirection: "vertical",
    labelBackground2: null,
    glowColor: null,
    uppercase: false,
    ...style,
    labelColor: style.labelColor ?? style.color,
    radius: round(radius * height),
    borderWidth: style.borderColor ? round(Math.max(1, border * height)) : 0,
    fontSize: round(height * fontScale),
  };
}

// The selected box's look as a preset, sized relative to its height.
function presetFromBox(b) {
  return {
    design: b.design,
    background: b.background,
    background2: b.background2,
    radius: clamp(b.radius / b.height, 0, 1),
    borderColor: b.borderColor,
    border: b.borderColor ? clamp(b.borderWidth / b.height, 0, 0.5) : 0,
    shadow: b.shadow,
    color: b.color,
    labelColor: b.labelColor ?? b.color,
    labelBackground: b.labelBackground,
    splitRatio: b.splitRatio,
    fontFamily: b.fontFamily,
    fontWeight: b.fontWeight,
    fontScale: clamp(b.fontSize / b.height, 0.05, 3),
    text: b.text,
    align: b.align,
    shape: b.shape,
    gradientDirection: b.gradientDirection,
    labelBackground2: b.labelBackground2,
    glowColor: b.glowColor,
    uppercase: b.uppercase,
  };
}

function savePresetModal() {
  const modal = openModal(
    "Save as preset",
    `<form class="space-y-3">
      <p class="text-sm text-ink-600">Saves this ${selected} rate's look — colours, font, border, corners, shadow and text format — so you can apply it to any rate on any template. Sizes scale with each box.</p>
      ${label("Preset name", `<input name="name" required maxlength="60" class="input" placeholder="e.g. Diwali gold" />`)}
      <p class="text-sm text-red-700 bg-red-50 rounded-md px-3 py-2" data-preset-error hidden></p>
      <div class="flex justify-end gap-2">
        <button type="button" data-close class="btn-secondary px-4 py-2 text-sm">Cancel</button>
        <button class="btn-primary px-4 py-2 text-sm" data-preset-save>${icon("save", { size: 14 })} Save preset</button>
      </div>
    </form>`,
  );
  const form = $("form", modal.body);
  form.name.focus();
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const { data } = await busy($("[data-preset-save]", form), "Saving…", () =>
        api.post("/admin/gold-rates/presets", { name: form.name.value.trim(), style: presetFromBox(box(selected)) }),
      );
      customPresets = [...customPresets, { ...data, group: "mine", custom: true }];
      presetGroup = "mine";
      modal.close();
      renderProps();
      flash(`Saved preset “${data.name}”. It's in Design presets on every template.`);
    } catch (err) {
      showError($("[data-preset-error]", form), errorMessage(err));
    }
  });
}

function deletePresetModal(preset) {
  const modal = openModal(
    "Delete preset",
    `<p class="text-sm text-ink-700">Delete the preset <strong>${esc(preset.name)}</strong>? Rates already styled with it keep their look.</p>
    <p class="mt-3 text-sm text-red-700 bg-red-50 rounded-md px-3 py-2" data-preset-error hidden></p>
    <div class="mt-4 flex justify-end gap-2">
      <button type="button" data-close class="btn-secondary px-4 py-2 text-sm">Keep it</button>
      <button type="button" data-confirm class="btn-primary !bg-red-600 hover:!bg-red-700 px-4 py-2 text-sm">Delete preset</button>
    </div>`,
  );
  const confirm = $("[data-confirm]", modal.body);
  confirm.addEventListener("click", async () => {
    try {
      await busy(confirm, "Deleting…", () => api.delete(`/admin/gold-rates/presets/${preset.id}`));
      customPresets = customPresets.filter((p) => p.id !== preset.id);
      modal.close();
      renderProps();
    } catch (err) {
      showError($("[data-preset-error]", modal.body), errorMessage(err));
    }
  });
}

function presetPicker() {
  const groups = [...PRESET_GROUPS, { id: "mine", name: `My presets (${customPresets.length})` }];
  const shownPresets = allPresets().filter((p) => p.group === presetGroup);
  return `<div>
    <span class="mb-1 block text-[11px] font-semibold text-ink-600">Design presets <span class="font-normal text-ink-400">· ${PRESETS.length} built in</span></span>
    <div class="mb-2 flex flex-wrap gap-1">${groups
      .map(
        (g) => `<button type="button" data-preset-group="${g.id}" class="rounded-full px-2.5 py-1 text-[11px] font-semibold ${
          g.id === presetGroup ? "bg-brand-600 text-white" : "bg-gray-100 text-ink-600 hover:bg-gray-200"
        }">${esc(g.name)}</button>`,
      )
      .join("")}</div>
    ${
      presetGroup === "mine" && shownPresets.length === 0
        ? `<p class="rounded-lg bg-gray-50 px-3 py-4 text-center text-[11px] text-ink-500">No presets of your own yet. Style a rate, then click “Save this style as a preset”.</p>`
        : ""
    }
    <div class="grid grid-cols-2 gap-2">${shownPresets
      .map(
        (p) => `<div class="relative">
        <button type="button" data-preset="${p.id}" class="${p.onDark ? "bg-ink-900" : "gold-checker"} w-full rounded-lg border ${p.custom ? "border-brand-200" : "border-gray-200"} p-1.5 text-left hover:border-brand-500">
          <canvas data-preset-preview="${p.id}" width="300" height="76" class="block h-auto w-full"></canvas>
          <span class="mt-1 block truncate pr-4 text-[11px] font-semibold ${p.onDark ? "text-white" : "text-ink-700"}">${esc(p.name)}</span></button>
        ${
          p.custom
            ? `<button type="button" data-preset-delete="${p.id}" title="Delete preset" class="absolute bottom-1 right-1 rounded p-0.5 text-ink-400 hover:bg-red-50 hover:text-red-700">${icon("trash-2", { size: 12 })}</button>`
            : ""
        }
      </div>`,
      )
      .join("")}</div>
    <label class="mt-2 flex items-center gap-1.5 text-[11px] text-ink-600"><input type="checkbox" data-preset-all class="h-3.5 w-3.5 rounded border-gray-300" /> ${
      isBusiness(selected) ? "Apply to every business detail" : "Apply to every rate"
    } (each keeps its place and size)</label>
    <button type="button" data-preset-new class="btn-secondary mt-2 w-full px-3 py-1.5 text-sm">${icon("save", { size: 14 })} Save this style as a preset</button>
  </div>`;
}

// A business box's usual one-line text (TemplateLayout::DETAILS).
const LINE_TEXT = { phone: "Call {phone}", instagram: "Instagram {instagram}" };
const lineText = (key) => LINE_TEXT[key] ?? `{${key}}`;

// A preset on a business box: a label | value design shows just the value,
// since its label already says "Call"; a one-line design keeps the box's
// own text (or gets the usual one back if it was only the value).
function stylePatch(key, presetId, height) {
  const style = presetStyle(presetId, height);
  if (isBusiness(key)) {
    const current = box(key).text;
    style.text = style.design === "split" ? `{${key}}` : current === `{${key}}` ? lineText(key) : current;
  }
  return style;
}

// Each preset drawn with the selected box's own label, font and value.
function drawPresetPreviews() {
  if (!selected || selected === "logo" || selected === "qr") return;
  $$("[data-preset-preview]", props).forEach((canvas) => {
    const c = canvas.getContext("2d");
    c.clearRect(0, 0, canvas.width, canvas.height);
    const pad = 8;
    const height = canvas.height - pad * 2;
    const field = { ...box(selected), ...stylePatch(selected, canvas.dataset.presetPreview, height), x: pad, y: pad, width: canvas.width - pad * 2, height };
    if (isBusiness(selected)) drawBox(c, field, detailText(field, card()) || BUSINESS_NAMES[selected]);
    else drawField(c, selected, field, rates[selected]);
  });
}

const NULLABLE_COLORS = {
  background: "#ffffff",
  background2: "#d4a017",
  borderColor: "#c9a227",
  labelBackground: "#c9a227",
  labelBackground2: "#a87b0f",
  glowColor: "#ffcc4d",
};
const colorInput = (prop) =>
  `<input type="color" data-prop="${prop}" class="h-8 w-full cursor-pointer rounded-lg border border-gray-300 bg-white p-1 disabled:opacity-40" />`;
const colorToggle = (prop, text) => `<div>
    <label class="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-ink-600"><input type="checkbox" data-color-toggle="${prop}" class="h-3.5 w-3.5 rounded border-gray-300" /> ${text}</label>
    ${colorInput(prop)}
  </div>`;

function styleControls() {
  return `<details class="rounded-lg border border-gray-200 p-3" data-style-details>
    <summary class="cursor-pointer text-[11px] font-semibold text-ink-700">Style details</summary>
    <div class="mt-3 space-y-3">
      <div class="grid grid-cols-2 gap-2">
        ${label("Design", `<select data-prop="design" class="input px-2.5 py-1.5"><option value="plain">One line</option><option value="split">Label | price</option></select>`)}
        ${label("Shape", `<select data-prop="shape" class="input px-2.5 py-1.5"><option value="rect">Box</option><option value="ribbon">Ribbon</option><option value="chamfer">Cut corners</option></select>`)}
      </div>
      ${label("Corner radius / cut size", numberInput("radius", 'min="0"'))}
      <div class="grid grid-cols-2 gap-2">
        ${colorToggle("background", "Background")}
        ${colorToggle("background2", "Gradient to")}
      </div>
      ${label("Gradient direction", `<select data-prop="gradientDirection" class="input px-2.5 py-1.5"><option value="vertical">Top to bottom</option><option value="horizontal">Left to right</option><option value="diagonal">Diagonal</option></select>`)}
      <div class="grid grid-cols-2 gap-2">
        ${colorToggle("borderColor", "Border")}
        ${label("Border width", numberInput("borderWidth", 'min="0"'))}
      </div>
      <div class="grid grid-cols-2 gap-2">
        ${colorToggle("glowColor", "Text glow")}
        <div class="space-y-1.5 pt-1">
          <label class="flex items-center gap-1.5 text-[11px] font-semibold text-ink-600"><input type="checkbox" data-prop="shadow" class="h-3.5 w-3.5 rounded border-gray-300" /> Soft shadow</label>
          <label class="flex items-center gap-1.5 text-[11px] font-semibold text-ink-600"><input type="checkbox" data-prop="uppercase" class="h-3.5 w-3.5 rounded border-gray-300" /> CAPITALS</label>
        </div>
      </div>
      <div class="space-y-2 border-t border-gray-100 pt-3" data-split-only>
        <div class="grid grid-cols-2 gap-2">
          ${label("Label colour", `<input type="color" data-prop="labelColor" class="h-8 w-full cursor-pointer rounded-lg border border-gray-300 bg-white p-1" />`)}
          ${colorToggle("labelBackground", "Label background")}
        </div>
        ${colorToggle("labelBackground2", "Label gradient to")}
        ${label("Label width (% of the box)", numberInput("splitRatio", 'min="15" max="85"'))}
      </div>
    </div>
  </details>`;
}

function fieldControls(key) {
  const business = isBusiness(key);
  return `<h3 class="text-sm font-bold text-ink-900">${elementName(key)}</h3>
    ${business && !card() ? `<p class="rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-800">Link a business under Elements to fill this in.</p>` : ""}
    ${presetPicker()}
    ${
      business
        ? label("Label (for label | value designs)", `<input data-prop="label" maxlength="40" class="input px-2.5 py-1.5" />`)
        : `<div class="grid grid-cols-2 gap-2">
      ${label("Label", `<input data-prop="label" maxlength="40" class="input px-2.5 py-1.5" />`)}
      ${label("Currency", `<input data-prop="currency" maxlength="8" class="input px-2.5 py-1.5" />`)}
    </div>`
    }
    ${label("Displayed text", `<input data-prop="text" maxlength="120" class="input px-2.5 py-1.5 font-mono text-xs" />`)}
    <p class="-mt-1 text-[11px] text-ink-400">${
      business
        ? "Use {name}, {phone}, {address}, {city}, {website}, {page}, {instagram}, {facebook}, {tagline} or {hours}, e.g. “Call {phone}”."
        : "Use {label}, {currency} and {rate}, e.g. “{label}: {currency}{rate}/g”."
    }</p>
    ${label("Font", `<select data-prop="fontFamily" class="input px-2.5 py-1.5">${fonts.map((f) => `<option style="font-family:'${f}'">${f}</option>`).join("")}</select>`)}
    <div class="grid grid-cols-3 gap-2">
      ${label("Size", numberInput("fontSize", 'min="4" max="2000"'))}
      ${label("Weight", `<select data-prop="fontWeight" class="input px-2.5 py-1.5">${weights.map((w) => `<option value="${w}">${w}</option>`).join("")}</select>`)}
      ${label("Colour", `<input type="color" data-prop="color" class="h-[34px] w-full cursor-pointer rounded-lg border border-gray-300 bg-white p-1" />`)}
    </div>
    <div>
      <span class="mb-1 block text-[11px] font-semibold text-ink-600">Text alignment</span>
      <div class="flex gap-1">
        ${iconButton('data-align="left"', "align-left", "Align left")}
        ${iconButton('data-align="center"', "align-center", "Align centre")}
        ${iconButton('data-align="right"', "align-right", "Align right")}
      </div>
    </div>
    ${styleControls()}
    ${positionControls()}`;
}

function qrControls() {
  return `<h3 class="text-sm font-bold text-ink-900">QR code</h3>
    ${!card() ? `<p class="rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-800">Link a business under Elements to make the QR code.</p>` : ""}
    ${label("Scanning opens", `<select data-prop="target" class="input px-2.5 py-1.5"><option value="page">The business's Markkito page</option><option value="website">The business's own website</option></select>`)}
    <p data-qr-url class="-mt-1 break-all text-[11px] text-ink-400"></p>
    <div class="grid grid-cols-2 gap-2">
      ${label("Colour", `<input type="color" data-prop="color" class="h-8 w-full cursor-pointer rounded-lg border border-gray-300 bg-white p-1" />`)}
      ${colorToggle("background", "Background")}
    </div>
    <p class="text-[11px] text-ink-400">Keep strong contrast (dark on light) so phones can scan it. The code is drawn as large as fits the box.</p>
    ${positionControls()}`;
}

function renderProps() {
  if (!selected) {
    props.innerHTML = `<p class="text-sm text-ink-500">Click the logo, a rate or a business detail on the image — or pick one under Elements — to change it.</p>`;
    return;
  }
  props.innerHTML = `<div class="space-y-3">${selected === "logo" ? logoControls() : selected === "qr" ? qrControls() : fieldControls(selected)}</div>`;
  bindProps();
  syncProps();
  drawPresetPreviews();
  if (drawMode) setDrawMode(true);
}

const NUMBERS = ["x", "y", "width", "height", "fontSize", "radius", "borderWidth", "splitRatio"];

// Puts a typed value into the selected box, kept inside the image.
function setProp(prop, raw) {
  const b = box(selected);
  if (NUMBERS.includes(prop)) {
    const value = Number(raw);
    if (raw === "" || !Number.isFinite(value)) return;
    if (prop === "x") b.x = round(clamp(value, 0, W - b.width));
    if (prop === "y") b.y = round(clamp(value, 0, H - b.height));
    if (prop === "fontSize") b.fontSize = round(clamp(value, 4, 2000));
    if (prop === "radius") b.radius = round(clamp(value, 0, 5000));
    if (prop === "borderWidth") b.borderWidth = round(clamp(value, 0, 500));
    // Typed as a percentage.
    if (prop === "splitRatio") b.splitRatio = round(clamp(value / 100, 0.15, 0.85));
    if (prop === "width" || prop === "height") {
      if (prop === "width") b.width = round(clamp(value, MIN_SIZE, W - b.x));
      else b.height = round(clamp(value, MIN_SIZE, H - b.y));
    }
  } else if (prop === "fontWeight") {
    b.fontWeight = Number(raw);
  } else if (prop === "shadow" || prop === "uppercase") {
    b[prop] = Boolean(raw);
  } else {
    b[prop] = raw;
  }
}

function bindProps() {
  $$("[data-prop]", props).forEach((input) => {
    const value = () => (input.type === "checkbox" ? input.checked : input.value);
    input.addEventListener("input", () => {
      setProp(input.dataset.prop, value());
      changed();
    });
    input.addEventListener("change", () => {
      setProp(input.dataset.prop, value());
      commit();
      syncProps(true);
    });
  });
  $$("[data-place]", props).forEach((button) =>
    button.addEventListener("click", () => {
      const b = box(selected);
      const place = button.dataset.place;
      if (place === "left") b.x = 0;
      if (place === "center") b.x = round((W - b.width) / 2);
      if (place === "right") b.x = round(W - b.width);
      if (place === "top") b.y = 0;
      if (place === "middle") b.y = round((H - b.height) / 2);
      if (place === "bottom") b.y = round(H - b.height);
      commit();
    }),
  );
  $$("[data-align]", props).forEach((button) =>
    button.addEventListener("click", () => {
      box(selected).align = button.dataset.align;
      commit();
    }),
  );
  // A colour that can be switched off (no background, border, …).
  $$("[data-color-toggle]", props).forEach((toggle) =>
    toggle.addEventListener("change", () => {
      const b = box(selected);
      const prop = toggle.dataset.colorToggle;
      b[prop] = toggle.checked ? NULLABLE_COLORS[prop] : null;
      if (prop === "borderColor" && toggle.checked && !b.borderWidth) b.borderWidth = round(Math.max(1, b.height * 0.04));
      commit();
    }),
  );
  $$("[data-preset]", props).forEach((button) =>
    button.addEventListener("click", () => {
      const all = $("[data-preset-all]", props).checked;
      const keys = all ? (isBusiness(selected) ? DETAILS : PURITIES) : [selected];
      for (const key of keys) Object.assign(box(key), stylePatch(key, button.dataset.preset, box(key).height));
      commit();
      syncProps(true);
    }),
  );
  $("[data-preset-new]", props)?.addEventListener("click", savePresetModal);
  $$("[data-preset-group]", props).forEach((button) =>
    button.addEventListener("click", () => {
      presetGroup = button.dataset.presetGroup;
      const details = $("[data-style-details]", props)?.open;
      renderProps();
      if (details) $("[data-style-details]", props).open = true;
    }),
  );
  $$("[data-preset-delete]", props).forEach((button) =>
    button.addEventListener("click", () => deletePresetModal(customPresets.find((p) => p.id === button.dataset.presetDelete))),
  );
  $("[data-logo-fit]", props)?.addEventListener("click", () => {
    fitLogoBox();
    commit();
  });
  $("[data-logo-draw]", props)?.addEventListener("click", () => (drawMode ? cancelDraw() : setDrawMode(true)));
}

// Fills the controls from the state, leaving alone whatever is being typed
// in (unless `all`, after a change is finished).
function syncProps(all = false) {
  if (!selected) return;
  const b = box(selected);
  $$("[data-prop]", props).forEach((input) => {
    if (!all && input === document.activeElement) return;
    const prop = input.dataset.prop;
    const value = b[prop];
    if (prop in NULLABLE_COLORS) {
      input.disabled = !value;
      if (value) input.value = value;
    } else if (input.type === "checkbox") {
      input.checked = Boolean(value);
    } else if (prop === "splitRatio") {
      input.value = String(Math.round(value * 100));
    } else {
      input.value = NUMBERS.includes(prop) ? String(Math.round(value * 10) / 10) : String(value ?? "");
    }
  });
  $$("[data-align]", props).forEach((button) => button.classList.toggle("!bg-brand-50", button.dataset.align === b.align));
  $$("[data-color-toggle]", props).forEach((toggle) => (toggle.checked = Boolean(b[toggle.dataset.colorToggle])));
  const splitOnly = $("[data-split-only]", props);
  if (splitOnly) splitOnly.hidden = b.design !== "split";
  const fitButton = $("[data-logo-fit]", props);
  if (fitButton) fitButton.disabled = !logoUrl();
  const qrUrl = $("[data-qr-url]", props);
  if (qrUrl) qrUrl.textContent = card() ? `Scans to ${qrTarget(b, card())}` : "";
}

// --- Logo -------------------------------------------------------------------
// Reshapes the logo box to the logo's proportions, keeping its width where
// it fits.
function fitLogoBox() {
  const img = logoImages.get(logoUrl());
  const ratio = img ? img.naturalWidth / img.naturalHeight : null;
  if (!ratio) return;
  const b = doc.layout.logo;
  let width = b.width;
  let height = width / ratio;
  if (height > H - b.y) {
    height = H - b.y;
    width = height * ratio;
  }
  width = Math.min(width, W - b.x);
  Object.assign(b, { width: round(Math.max(width, MIN_SIZE)), height: round(Math.max(width / ratio, MIN_SIZE)) });
}

// --- Rates ------------------------------------------------------------------
const ratesBox = $("[data-rates]");
ratesBox.innerHTML = PURITIES.map(
  (p) => `<label class="block"><span class="mb-1 block text-[11px] font-semibold text-ink-600">${p}</span>
    <input type="number" data-rate="${p}" min="0" step="0.01" inputmode="decimal" placeholder="—" class="input px-2.5 py-1.5" /></label>`,
).join("");
$$("[data-rate]", ratesBox).forEach((input) => {
  input.value = rates[input.dataset.rate] ?? "";
  input.addEventListener("input", () => {
    rates[input.dataset.rate] = input.value.trim() === "" ? null : Number(input.value);
    changed();
  });
});

// --- Keyboard ---------------------------------------------------------------
const ARROWS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
let nudging = false;
document.addEventListener("keydown", (e) => {
  const key = e.key.toLowerCase();
  const mod = e.ctrlKey || e.metaKey;
  if (mod && key === "s") {
    e.preventDefault();
    save();
    return;
  }
  // Typing in a field keeps the browser's own undo and arrow keys.
  if (e.target.closest("input, textarea, select") || document.querySelector("[data-close]")) return;
  if (mod && key === "z") {
    e.preventDefault();
    if (e.shiftKey) redo();
    else undo();
  } else if (mod && key === "y") {
    e.preventDefault();
    redo();
  } else if (key === "escape") {
    if (drawMode) cancelDraw();
    else select(null);
  } else if (selected && ARROWS[e.key]) {
    e.preventDefault();
    const step = e.shiftKey ? 10 : 1;
    const b = box(selected);
    Object.assign(b, moveBox(b, ARROWS[e.key][0] * step, ARROWS[e.key][1] * step));
    nudging = true;
    changed();
  }
});
document.addEventListener("keyup", (e) => {
  if (nudging && ARROWS[e.key]) {
    nudging = false;
    commit();
  }
});

// --- Name -------------------------------------------------------------------
const nameInput = $("[data-name]");
nameInput.addEventListener("input", () => {
  doc.name = nameInput.value;
  changed();
});
nameInput.addEventListener("change", () => commit());

// --- Save, preview, download ------------------------------------------------
async function busy(button, text, work) {
  const before = button.innerHTML;
  button.disabled = true;
  button.textContent = text;
  try {
    return await work();
  } finally {
    button.disabled = false;
    button.innerHTML = before;
  }
}

let saving = false;
async function save() {
  if (saving) return;
  saving = true;
  showError(errorBox, "");
  try {
    await busy($("[data-save]"), "Saving…", async () => {
      // Anything changed while the requests are out stays unsaved.
      const sent = snapshot();
      const sentRates = JSON.stringify(rates);
      await api.patch(`/admin/gold-rates/templates/${template.id}`, { name: doc.name.trim(), businessId: doc.businessId, layout: doc.layout });
      savedDoc = sent;
      if (sentRates !== savedRates) {
        await api.put("/admin/gold-rates/rates", { rates: JSON.parse(sentRates) });
        savedRates = sentRates;
      }
    });
    flash("Saved.");
  } catch (err) {
    fail(err);
  } finally {
    saving = false;
    changed();
  }
}
$("[data-save]").addEventListener("click", save);

function flash(message) {
  const el = $("[data-flash]");
  el.textContent = message;
  el.hidden = false;
  clearTimeout(flash.timer);
  flash.timer = setTimeout(() => (el.hidden = true), 2500);
}

// The real export, so the preview is exactly the downloaded file.
async function exportBlob() {
  if (!background) throw new Error("The template is still loading.");
  const url = logoUrl();
  const logo = url ? logoImages.get(url) ?? (await loadImage(url)) : null;
  return posterBlob(await renderPoster({ width: W, height: H, background, logo, layout: doc.layout, rates, business: card() }));
}

async function download(button) {
  showError(errorBox, "");
  try {
    const blob = await busy(button, "Rendering…", exportBlob);
    saveBlob(blob, posterFileName(doc.name));
  } catch (err) {
    fail(err);
  }
}
$("[data-download]").addEventListener("click", (e) => download(e.currentTarget));

$("[data-preview]").addEventListener("click", async (e) => {
  showError(errorBox, "");
  let blob;
  try {
    blob = await busy(e.currentTarget, "Rendering…", exportBlob);
  } catch (err) {
    fail(err);
    return;
  }
  const url = URL.createObjectURL(blob);
  const modal = openModal(
    "Preview",
    `<div class="gold-checker flex items-center justify-center rounded-lg border border-gray-200 p-2">
      <img src="${url}" alt="Final poster" class="max-h-[65vh] max-w-full object-contain" />
    </div>
    <p class="mt-2 text-xs text-ink-500">This is the exact PNG that downloads — ${W}×${H} px, ${(blob.size / 1024 / 1024).toFixed(2)} MB.</p>
    <div class="mt-3 flex justify-end gap-2">
      <button type="button" data-close class="btn-secondary px-4 py-2 text-sm">Close</button>
      <button type="button" data-preview-download class="btn-primary px-4 py-2 text-sm">${icon("download", { size: 15 })} Download Final PNG</button>
    </div>`,
    { wide: true, onClose: () => URL.revokeObjectURL(url) },
  );
  $("[data-preview-download]", modal.body).addEventListener("click", () => saveBlob(blob, posterFileName(doc.name)));
});

// --- Change the master image ------------------------------------------------
// The new PNG becomes the background; the logo, rates and styles stay
// (scaled on the server if it's another size). Unsaved edits are saved
// first so they come along.
$("[data-change-image]").addEventListener("click", () => {
  const modal = openModal(
    "Change master image",
    `<form class="space-y-3">
      <p class="text-sm text-ink-600">Pick a new PNG for this template's background. Your logo, rates and styles stay where they are${
        dirty() ? ", and your unsaved changes are saved first" : ""
      }. If the new image is a different size (now ${W}×${H} px), everything is scaled to match — check the positions afterwards.</p>
      <p class="text-xs text-ink-500">The current image is replaced. To keep both, duplicate this template from the template list first.</p>
      <input type="file" name="file" required accept="image/png" class="block w-full text-sm text-ink-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-brand-700" />
      <p class="text-sm text-red-700 bg-red-50 rounded-md px-3 py-2" data-image-error hidden></p>
      <div class="flex justify-end gap-2">
        <button type="button" data-close class="btn-secondary px-4 py-2 text-sm">Cancel</button>
        <button class="btn-primary px-4 py-2 text-sm" data-image-save>${icon("upload", { size: 14 })} Replace image</button>
      </div>
    </form>`,
  );
  const form = $("form", modal.body);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorEl = $("[data-image-error]", form);
    showError(errorEl, "");
    try {
      await busy($("[data-image-save]", form), "Uploading…", async () => {
        if (dirty()) {
          await save();
          if (dirty()) throw new Error("Your changes could not be saved, so the image was not changed.");
        }
        const body = new FormData();
        body.append("file", form.file.files[0]);
        const { data } = await api.post(`/admin/gold-rates/templates/${template.id}/image`, body);
        const resized = data.imageWidth !== W || data.imageHeight !== H;
        reloadWithFlash(
          resized
            ? `Image changed to ${data.imageWidth}×${data.imageHeight} px. The logo and rates were scaled to match — check their positions.`
            : "Image changed. The logo and rates are where they were.",
        );
      });
    } catch (err) {
      showError(errorEl, errorMessage(err));
    }
  });
});

window.addEventListener("beforeunload", (e) => {
  if (!dirty()) return;
  e.preventDefault();
  e.returnValue = "";
});

$("[data-undo]").addEventListener("click", undo);
$("[data-redo]").addEventListener("click", redo);

// --- Start ------------------------------------------------------------------
renderProps();
changed();
loadImage(template.imageUrl)
  .then((img) => {
    background = img;
    loadLogo(logoUrl());
    $("[data-loading]").remove();
    fit();
    renderOverlay();
    draw();
  })
  .catch(() => {
    $("[data-loading]").textContent = "Could not load the template image.";
  });
