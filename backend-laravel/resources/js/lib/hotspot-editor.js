import { uploadImage, uploadImageFull } from "./api";
import { icon } from "./icons";
import { $, $$, esc } from "./ui";

// The image-card editor (markup: components/hotspot-editor.blade.php):
// upload the card artwork, drag actions onto it from the palette, move and
// resize them, and set what each does. Used by a business's Visiting Card
// section and by the admin's card-template editor.
//
// Each action ("hotspot") is a rectangle in percent of the image —
// { id, action, x, y, w, h, value, label, style } — so it sits on the same
// spot at any screen size (App\Support\Cards\ImageCard on the server).
//
// options:
//   actions         [{ key, label, icon, value }] — what a hotspot can do
//   fonts           the Google Fonts a drawn action's text may use
//   defaults        { action: text } — what an empty value falls back to
//   fallbackPrefix  hint before a default, e.g. "Leave empty to use your listing's: "
//   missingHint     hint when there's no default
//   imageUrl, imageWidth, imageHeight, hotspots — the starting state
//   onChange()      after every edit
//   onError(msg|err)
//   canReplaceImage false: once there's an image, a new one can't be dropped on it
//   canDelete       false: no "Remove" for placed boxes
//   canMove         false: placed boxes can't be dragged, resized or nudged —
//                   except the logo, which still drags (and sizes by its slider)

const MAX_SPOTS = 40;
const MIN_SIZE = 3; // percent
const LOGO_SCALE_MIN = 0.4; // the logo-size slider's range, relative to the box's size when first selected
const LOGO_SCALE_MAX = 2.5;
const STYLES = [
  ["invisible", "Invisible", "A clear tap area over a button in the design"],
  ["icon", "Icon", "A round icon drawn on top"],
  ["button", "Button", "An icon and label drawn on top"],
];
const DEFAULT_FONT_SIZE = 13; // px at the card's full 480px width; scales with the card

// Google Fonts load on demand, the first time an action uses one.
const loadedFonts = new Set();
function ensureFont(name) {
  if (!name || loadedFonts.has(name)) return;
  loadedFonts.add(name);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name).replace(/%20/g, "+")}:wght@400;700&display=swap`;
  document.head.appendChild(link);
}

// The same text style the public card gives a drawn action (ImageCard::textStyle).
function textStyle(h) {
  const hex = /^#[0-9a-f]{6}$/i;
  let css = `font-size:calc(${h.fontSize || DEFAULT_FONT_SIZE} * 100cqw / 480);`;
  if (h.font) css += `font-family:'${h.font.replace(/[^A-Za-z ]/g, "")}',system-ui,sans-serif;`;
  if (h.bold) css += "font-weight:700;";
  if (h.italic) css += "font-style:italic;";
  if (hex.test(h.color || "")) css += `color:${h.color};`;
  if (hex.test(h.bg || "")) css += `background:${h.bg};`;
  return css;
}
const VALUE_HELP = {
  phone: { label: "Phone number", placeholder: "+91 98765 43210", type: "tel" },
  email: { label: "Email address", placeholder: "you@example.com", type: "email" },
  url: { label: "Web address", placeholder: "https://…", type: "url" },
  place: { label: "Address or Google Maps link", placeholder: "Shop address or https://maps…", type: "text" },
  text: { label: "Text", placeholder: "", type: "text" },
};
// The palette's groups, by kind.
const GROUPS = [
  ["action", "Actions"],
  ["text", "Business details"],
  ["image", "Logo & QR code"],
];

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const round = (v) => Math.round(v * 100) / 100;

export function initHotspotEditor(editor, options) {
  const {
    defaults = {},
    fallbackPrefix = "Leave empty to use: ",
    missingHint = "Nothing to fall back on — enter one.",
    onChange = () => {},
    onError = () => {},
    canReplaceImage = true, // false where the editor offers no "Replace image" (a business's card)
    canDelete = true, // false: placed actions and details can't be removed (a business's card)
    canMove = true, // false: placed boxes keep their position and size (a business's card)
  } = options;
  const actionList = options.actions;
  const fonts = options.fonts || [];
  const actions = Object.fromEntries(actionList.map((a) => [a.key, a]));

  const stage = $("[data-stage]", editor);
  const stageImage = $("[data-stage-image]", editor);
  const spotsLayer = $("[data-stage-spots]", editor);
  const dropzone = $("[data-dropzone]", editor);
  const uploading = $("[data-uploading]", editor);
  const imageTools = $("[data-image-tools]", editor);
  const palette = $("[data-palette]", editor);
  const inspector = $("[data-inspector]", editor);
  const list = $("[data-spot-list]", editor);
  stage.style.containerType = "inline-size"; // font sizes scale with the card, as on the public page

  const state = {
    imageUrl: options.imageUrl || null,
    imageWidth: options.imageWidth || null,
    imageHeight: options.imageHeight || null,
    hotspots: (options.hotspots || []).map((h) => ({ ...h })),
    selected: null,
  };
  let dirty = false;
  let removeLogoBg = true; // the server clears a logo's plain background (LogoCleaner)
  let logoNote = "";

  function markDirty() {
    dirty = true;
    onChange();
  }

  const newId = () => `h${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const spotById = (id) => state.hotspots.find((h) => h.id === id);
  const textOf = (h) => h.label || actions[h.action]?.label || "Action";
  const kindOf = (h) => actions[h.action]?.kind || "action";

  // What a box shows or where it leads: its own value, or the fallback; null = nothing yet.
  function targetOf(h) {
    if (kindOf(h) === "image") {
      if (h.action === "qr") return "A QR code that opens the card";
      return h.value ? "Your uploaded logo" : defaults.logo ? "The logo from the listing" : null;
    }
    const kind = actions[h.action]?.value;
    if (!kind) return h.action === "share" ? "Shares the card link" : "Downloads the contact";
    if (h.value) return h.value;
    return defaults[h.action] || null;
  }

  // The logo can always be dragged into place — even where other boxes are fixed
  // (a dealer on a business's card). Its size there comes from the Logo size slider.
  const canDrag = (h) => canMove || h.action === "logo";

  const handlesHtml = () =>
    !canMove ? "" :
    Object.entries({
      nw: "-left-1.5 -top-1.5 cursor-nwse-resize",
      ne: "-right-1.5 -top-1.5 cursor-nesw-resize",
      sw: "-bottom-1.5 -left-1.5 cursor-nesw-resize",
      se: "-bottom-1.5 -right-1.5 cursor-nwse-resize",
    })
      .map(([d, cls]) => `<span data-handle="${d}" class="absolute h-3.5 w-3.5 rounded-full border-2 border-white bg-brand-600 shadow ${cls}"></span>`)
      .join("");

  // A business detail or picture, drawn as the card will show it.
  function detailHtml(h) {
    const selected = h.id === state.selected;
    const shown = targetOf(h);
    const ring = !shown ? "ring-amber-500" : selected ? "ring-brand-600 ring-[3px] z-10" : "ring-brand-500/50";
    let inner;
    if (kindOf(h) === "image") {
      const src = h.action === "logo" ? h.value || defaults.logo || "" : "";
      const logo = /^https?:/.test(src) ? src : null;
      const radius = h.action === "logo" ? h.radius || 0 : 0;
      inner = logo
        ? `<img src="${esc(logo)}" alt="" class="pointer-events-none h-full w-full ${radius ? "object-cover" : "object-contain"}" style="border-radius:${radius}%" />`
        : `<span class="pointer-events-none flex h-full w-full flex-col items-center justify-center gap-0.5 bg-white/80 text-[10px] font-semibold text-ink-700">${icon(actions[h.action].icon, { size: 22 })}${esc(actions[h.action].label)}</span>`;
    } else {
      ensureFont(h.font);
      inner = `<span class="pointer-events-none line-clamp-6 whitespace-pre-line">${esc(shown || actions[h.action].label)}</span>`;
    }
    const align = { left: "justify-start text-left", center: "justify-center text-center", right: "justify-end text-right" }[h.align || "left"];
    return `<div data-spot="${esc(h.id)}" tabindex="0" role="button" aria-label="${esc(actions[h.action].label)} — drag to move"
        class="absolute flex ${canDrag(h) ? "cursor-move" : "cursor-pointer"} touch-none items-center overflow-visible rounded ${kindOf(h) === "text" ? `${align} px-[0.15em] leading-tight text-white` : ""} ring-2 ${ring} focus:outline-none"
        style="left:${h.x}%;top:${h.y}%;width:${h.w}%;height:${h.h}%;${kindOf(h) === "text" ? esc(textStyle(h)) : ""}">
        ${inner}
        ${!shown ? `<span class="pointer-events-none absolute -top-2.5 left-1 rounded bg-amber-500 px-1 text-[9px] text-white">${h.action === "logo" ? "upload a logo" : h.action === "custom_text" ? "type your text" : "not on your listing"}</span>` : ""}
        ${selected ? handlesHtml() : ""}
      </div>`;
  }

  // --- Rendering -------------------------------------------------------------
  function spotHtml(h) {
    if (kindOf(h) !== "action") return detailHtml(h);
    const a = actions[h.action] || { icon: "link-2", label: "Link" };
    const selected = h.id === state.selected;
    const missing = !targetOf(h);
    const fill =
      h.style === "invisible"
        ? "bg-brand-500/15"
        : h.style === "icon"
          ? "rounded-full bg-gray-900/75 text-white"
          : "bg-gray-900/75 text-white";
    const drawn = h.style !== "invisible";
    if (drawn) ensureFont(h.font);
    const ring = missing ? "ring-amber-500" : selected ? "ring-brand-600" : "ring-brand-500/70";
    const corners = {
      nw: "-left-1.5 -top-1.5 cursor-nwse-resize",
      ne: "-right-1.5 -top-1.5 cursor-nesw-resize",
      sw: "-bottom-1.5 -left-1.5 cursor-nesw-resize",
      se: "-bottom-1.5 -right-1.5 cursor-nwse-resize",
    };
    const handles = selected && canMove
      ? Object.entries(corners)
          .map(([d, cls]) => `<span data-handle="${d}" class="absolute h-3.5 w-3.5 rounded-full border-2 border-white bg-brand-600 shadow ${cls}"></span>`)
          .join("")
      : "";
    return `<div data-spot="${esc(h.id)}" tabindex="0" role="button" aria-label="${esc(textOf(h))} — drag to move"
        class="absolute flex ${canMove ? "cursor-move" : "cursor-pointer"} touch-none items-center justify-center gap-1 overflow-visible rounded-lg ${drawn ? "" : "text-[11px] font-semibold"} ring-2 ${ring} ${fill} ${selected ? "z-10 ring-[3px]" : ""} focus:outline-none"
        style="left:${h.x}%;top:${h.y}%;width:${h.w}%;height:${h.h}%;${drawn ? esc(textStyle(h)) : ""}">
        <span class="pointer-events-none flex min-w-0 items-center gap-1 rounded px-1 ${drawn ? "" : "bg-white/85 text-brand-800"}">
          ${icon(a.icon, { size: 13, className: drawn ? "h-[1.35em] w-[1.35em] shrink-0" : "shrink-0" })}<span class="truncate ${h.style === "icon" ? "sr-only" : ""}">${esc(textOf(h))}</span>
        </span>
        ${missing ? `<span class="pointer-events-none absolute -top-2.5 left-1 rounded bg-amber-500 px-1 text-[9px] text-white">needs details</span>` : ""}
        ${handles}
      </div>`;
  }

  function renderStage() {
    const has = !!state.imageUrl;
    stageImage.classList.toggle("hidden", !has);
    dropzone.classList.toggle("hidden", has);
    imageTools.classList.toggle("hidden", !has);
    imageTools.classList.toggle("flex", has);
    stage.classList.toggle("border-dashed", !has);
    stage.classList.toggle("border-gray-300", !has);
    stage.classList.toggle("border-transparent", has);
    if (has && stageImage.getAttribute("src") !== state.imageUrl) stageImage.src = state.imageUrl;
    spotsLayer.classList.toggle("hidden", !has);
    spotsLayer.innerHTML = has ? state.hotspots.map(spotHtml).join("") : "";
  }

  function renderPalette() {
    if (!palette) return; // the business card editor has no palette: boxes are added by clicking the image
    palette.innerHTML = GROUPS.map(([kind, title]) => {
      const items = actionList.filter((a) => (a.kind || "action") === kind);
      if (!items.length) return "";
      return `<div class="w-full">
          <p class="mb-1 mt-1 text-[11px] font-semibold text-ink-600">${esc(title)}</p>
          <div class="flex flex-wrap gap-1.5">
            ${items
              .map(
                (a) =>
                  `<button type="button" data-palette-action="${esc(a.key)}" class="flex touch-none items-center gap-1.5 rounded-full border ${
                    kind === "action" ? "border-gray-300 bg-white" : "border-sky-200 bg-sky-50"
                  } px-3 py-1.5 text-xs font-semibold text-ink-700 shadow-sm transition hover:border-brand-400 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50" ${state.imageUrl ? "" : "disabled"}>
                    ${icon(a.icon, { size: 13 })} ${esc(a.label)}
                  </button>`,
              )
              .join("")}
          </div>
        </div>`;
    }).join("");
  }

  function renderInspector() {
    const h = spotById(state.selected);
    if (!h) {
      inspector.innerHTML = `<p class="py-3 text-center text-xs text-ink-500">${
        state.imageUrl
          ? state.hotspots.length
            ? "Click a box on the card, or pick one under “On the card”, to edit it. Click an empty spot on the image to add a new one."
            : "Click anywhere on the image to add an action or business detail there."
          : "Upload the card image to start placing actions."
      }</p>`;
      return;
    }
    const a = actions[h.action];
    const kind = kindOf(h);
    const help = a.value ? VALUE_HELP[a.value] : null;
    const fallback = defaults[h.action];
    const isDetail = kind !== "action";
    const optionsHtml = GROUPS.map(
      ([k, title]) =>
        `<optgroup label="${esc(title)}">${actionList
          .filter((o) => (o.kind || "action") === k)
          .map((o) => `<option value="${esc(o.key)}" ${o.key === h.action ? "selected" : ""}>${esc(o.label)}</option>`)
          .join("")}</optgroup>`,
    ).join("");
    const textStyleHtml = `<div class="space-y-2 rounded-lg bg-gray-50 p-2.5">
        <p class="text-xs font-semibold text-ink-700">Text style</p>
        <div class="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2">
          <select class="input py-1.5 text-xs" data-field="font" aria-label="Font">
            <option value="">Default font</option>
            ${fonts.map((f) => `<option value="${esc(f)}" ${f === h.font ? "selected" : ""}>${esc(f)}</option>`).join("")}
          </select>
          <button type="button" data-field="bold" aria-pressed="${h.bold ? "true" : "false"}" title="Bold" class="rounded-lg border px-3 text-sm font-bold ${h.bold ? "border-brand-500 bg-brand-50 text-brand-800" : "border-gray-300 bg-white text-ink-700"}">B</button>
          <button type="button" data-field="italic" aria-pressed="${h.italic ? "true" : "false"}" title="Italic" class="rounded-lg border px-3 font-serif text-sm italic ${h.italic ? "border-brand-500 bg-brand-50 text-brand-800" : "border-gray-300 bg-white text-ink-700"}">I</button>
        </div>
        <label class="block">
          <span class="mb-0.5 flex justify-between text-[11px] text-ink-600">Size <span data-size-label>${h.fontSize || DEFAULT_FONT_SIZE}px</span></span>
          <input type="range" min="8" max="48" step="1" value="${h.fontSize || DEFAULT_FONT_SIZE}" class="w-full" data-field="fontSize" />
        </label>
        ${
          kind === "text"
            ? `<div class="grid grid-cols-3 gap-1.5" role="group" aria-label="Alignment">
                ${[
                  ["left", "align-left"],
                  ["center", "align-center"],
                  ["right", "align-right"],
                ]
                  .map(
                    ([v, ic]) =>
                      `<button type="button" data-align="${v}" title="Align ${v}" class="flex justify-center rounded-lg border py-1 ${
                        (h.align || "left") === v ? "border-brand-500 bg-brand-50 text-brand-800" : "border-gray-300 bg-white text-ink-600"
                      }">${icon(ic, { size: 14 })}</button>`,
                  )
                  .join("")}
              </div>`
            : ""
        }
        <div class="grid grid-cols-2 gap-2">
          <label class="flex items-center gap-2 text-[11px] text-ink-600">
            <input type="color" value="${esc(h.color || "#ffffff")}" class="h-7 w-9 cursor-pointer rounded border border-gray-300 bg-white p-0.5" data-field="color" /> Text colour
          </label>
          <label class="flex items-center gap-2 text-[11px] text-ink-600">
            <input type="color" value="${esc(h.bg || (kind === "text" ? "#ffffff" : "#111827"))}" class="h-7 w-9 cursor-pointer rounded border border-gray-300 bg-white p-0.5" data-field="bg" /> ${kind === "text" ? "Background" : "Button colour"}
          </label>
        </div>
        <button type="button" class="text-[11px] font-semibold text-ink-500 hover:underline" data-field="resetText">Reset text style</button>
      </div>`;
    inspector.innerHTML = `
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <p class="text-sm font-bold text-ink-900">${isDetail ? "Edit detail" : "Edit action"}</p>
          ${canDelete ? `<button type="button" class="flex items-center gap-1 text-xs font-semibold text-red-700 hover:underline" data-delete-spot>${icon("trash-2", { size: 13 })} Remove</button>` : ""}
        </div>
        <label class="block">
          <span class="mb-1 block text-xs font-semibold text-ink-700">${isDetail ? "Shows" : "Action"}</span>
          <select class="input py-2" data-field="action">${optionsHtml}</select>
        </label>
        ${
          // In a template the box shows each business's own logo (defaults.logo is a description, not a picture).
          h.action === "logo" && defaults.logo && !/^https?:/.test(defaults.logo) && !h.value
            ? `<p class="rounded-md bg-gray-50 px-2.5 py-2 text-[11px] text-ink-500">Each business's own logo shows here.</p>`
            : h.action === "logo"
            ? `<div class="space-y-2 rounded-lg bg-gray-50 p-2.5">
                <p class="text-xs font-semibold text-ink-700">Logo picture</p>
                <p class="text-[11px] ${targetOf(h) ? "text-ink-500" : "text-amber-700"}">${esc(
                  h.value ? "Your uploaded logo." : defaults.logo ? "Showing the logo from the listing. Upload another to use it on this card only." : "No logo yet — upload one, or drop a picture on the box.",
                )}</p>
                <div class="flex flex-wrap gap-2">
                  <button type="button" class="btn-secondary px-3 py-1.5 text-xs" data-logo-upload>${icon("upload", { size: 13 })} ${h.value || defaults.logo ? "Upload a different logo" : "Upload logo"}</button>
                  ${h.value && defaults.logo ? `<button type="button" class="text-[11px] font-semibold text-ink-500 hover:underline" data-logo-reset>Use the listing's logo</button>` : ""}
                  ${h.value && !defaults.logo ? `<button type="button" class="text-[11px] font-semibold text-red-700 hover:underline" data-logo-reset>Remove picture</button>` : ""}
                </div>
                <label class="flex items-center gap-1.5 text-[11px] text-ink-600">
                  <input type="checkbox" class="rounded border-gray-300" ${removeLogoBg ? "checked" : ""} data-logo-remove-bg /> Remove background &amp; make high quality with AI
                </label>
                <p class="text-[11px] text-ink-400" data-logo-note>${esc(logoNote || "JPG, PNG or WebP. A plain background is cleared automatically.")}</p>
              </div>`
            : help
            ? `<label class="block">
                <span class="mb-1 block text-xs font-semibold text-ink-700">${esc(h.action === "custom_text" ? "Your text" : help.label)}${h.action === "link" || h.action === "custom_text" ? "" : ` <span class="font-normal text-ink-400">(optional)</span>`}</span>
                ${
                  a.value === "text"
                    ? `<textarea class="input py-2" rows="2" maxlength="300" data-field="value" placeholder="${esc(fallback || (h.action === "custom_text" ? "e.g. Free home delivery" : ""))}">${esc(h.value || "")}</textarea>`
                    : `<input class="input py-2" type="${help.type}" maxlength="300" data-field="value" value="${esc(h.value || "")}" placeholder="${esc(fallback || help.placeholder)}" />`
                }
                <span class="mt-1 block text-[11px] ${!h.value && !fallback && h.action !== "link" && h.action !== "custom_text" ? "text-amber-700" : "text-ink-500"}">${
                  h.action === "link" ? "Where this button leads." : h.action === "custom_text" ? "Type anything — a slogan, an offer, a note. Press Enter for a new line." : fallback ? esc(fallbackPrefix + fallback) : esc(missingHint)
                }</span>
              </label>`
            : `<p class="rounded-md bg-gray-50 px-2.5 py-2 text-[11px] ${targetOf(h) ? "text-ink-500" : "text-amber-700"}">${esc(
                targetOf(h) || (h.action === "logo" ? "Your listing has no logo yet — add one in your listing's photos." : ""),
              )}.</p>`
        }
        ${
          // The logo's size: scales its box about its centre. Works even where boxes can't be dragged (a dealer on a business's card).
          h.action === "logo"
            ? `<label class="block">
                <span class="mb-0.5 flex justify-between text-xs font-semibold text-ink-700">Logo size <span class="font-normal text-ink-500" data-logo-size-label>${Math.round(logoScale(h) * 100)}%</span></span>
                <input type="range" min="${LOGO_SCALE_MIN * 100}" max="${LOGO_SCALE_MAX * 100}" step="5" value="${Math.round(logoScale(h) * 100)}" class="w-full" data-field="logoSize" aria-label="Logo size" />
                <span class="mt-0.5 flex justify-between text-[11px] text-ink-400"><span>Smaller</span><button type="button" class="font-semibold text-ink-500 hover:underline" data-logo-size-reset>Reset</button><span>Bigger</span></span>
              </label>
              <label class="block">
                <span class="mb-0.5 flex justify-between text-xs font-semibold text-ink-700">Round corners <span class="font-normal text-ink-500" data-logo-radius-label>${h.radius || 0}%</span></span>
                <input type="range" min="0" max="50" step="1" value="${h.radius || 0}" class="w-full" data-field="logoRadius" aria-label="Logo corner rounding" />
                <span class="mt-0.5 flex justify-between text-[11px] text-ink-400">
                  <button type="button" class="hover:underline" data-logo-radius="0">Square</button>
                  <button type="button" class="hover:underline" data-logo-radius="15">Rounded</button>
                  <button type="button" class="hover:underline" data-logo-radius="50">Circle</button>
                </span>
              </label>`
            : ""
        }
        ${
          isDetail
            ? `${kind === "text" ? textStyleHtml : ""}`
            : `<label class="block">
          <span class="mb-1 block text-xs font-semibold text-ink-700">Label <span class="font-normal text-ink-400">(read aloud, and shown on buttons)</span></span>
          <input class="input py-2" maxlength="60" data-field="label" value="${esc(h.label || "")}" placeholder="${esc(a.label)}" />
        </label>
        <div>
          <span class="mb-1 block text-xs font-semibold text-ink-700">Look</span>
          <div class="grid grid-cols-3 gap-1.5">
            ${STYLES.map(
              ([v, l, d]) =>
                `<button type="button" title="${esc(d)}" data-style="${v}" class="rounded-lg border px-2 py-1.5 text-xs font-semibold ${
                  (h.style || "invisible") === v ? "border-brand-500 bg-brand-50 text-brand-800" : "border-gray-300 text-ink-700 hover:bg-gray-50"
                }">${l}</button>`,
            ).join("")}
          </div>
          <p class="mt-1 text-[11px] text-ink-500">${esc(STYLES.find(([v]) => v === (h.style || "invisible"))[2])}.</p>
        </div>
        ${(h.style || "invisible") === "invisible" ? "" : textStyleHtml}`
        }
      </div>`;

    $('[data-field="font"]', inspector)?.addEventListener("change", (e) => {
      h.font = e.target.value || null;
      changed();
    });
    $('[data-field="bold"]', inspector)?.addEventListener("click", () => {
      h.bold = !h.bold;
      changed({ inspector: true });
    });
    $('[data-field="italic"]', inspector)?.addEventListener("click", () => {
      h.italic = !h.italic;
      changed({ inspector: true });
    });
    $('[data-field="fontSize"]', inspector)?.addEventListener("input", (e) => {
      h.fontSize = Number(e.target.value);
      $("[data-size-label]", inspector).textContent = `${h.fontSize}px`;
      changed();
    });
    $('[data-field="color"]', inspector)?.addEventListener("input", (e) => {
      h.color = e.target.value;
      changed();
    });
    $('[data-field="bg"]', inspector)?.addEventListener("input", (e) => {
      h.bg = e.target.value;
      changed();
    });
    $('[data-field="resetText"]', inspector)?.addEventListener("click", () => {
      Object.assign(h, { font: null, fontSize: null, bold: false, italic: false, color: null, bg: null, align: null });
      changed({ inspector: true });
    });
    $$("[data-align]", inspector).forEach((b) =>
      b.addEventListener("click", () => {
        h.align = b.dataset.align;
        changed({ inspector: true });
      }),
    );

    const logoSize = $('[data-field="logoSize"]', inspector);
    logoSize?.addEventListener("input", (e) => {
      scaleLogo(h, Number(e.target.value) / 100);
      $("[data-logo-size-label]", inspector).textContent = `${Math.round(logoScale(h) * 100)}%`;
      changed();
    });
    $("[data-logo-size-reset]", inspector)?.addEventListener("click", () => {
      scaleLogo(h, 1);
      logoSize.value = 100;
      $("[data-logo-size-label]", inspector).textContent = "100%";
      changed();
    });

    const logoRadius = $('[data-field="logoRadius"]', inspector);
    const setRadius = (r) => {
      h.radius = r || null;
      logoRadius.value = r;
      $("[data-logo-radius-label]", inspector).textContent = `${r}%`;
      changed();
    };
    logoRadius?.addEventListener("input", (e) => setRadius(Number(e.target.value)));
    $$("[data-logo-radius]", inspector).forEach((b) => b.addEventListener("click", () => setRadius(Number(b.dataset.logoRadius))));

    $("[data-logo-remove-bg]", inspector)?.addEventListener("change", (e) => (removeLogoBg = e.target.checked));
    $("[data-logo-upload]", inspector)?.addEventListener("click", () => pickLogo(h.id));
    $("[data-logo-reset]", inspector)?.addEventListener("click", () => {
      h.value = null;
      changed({ inspector: true });
    });

    $('[data-field="action"]', inspector).addEventListener("change", (e) => {
      const wasKind = kindOf(h);
      const wasValue = actions[h.action].value;
      h.action = e.target.value;
      // A value only carries over between boxes that take the same kind (an uploaded logo isn't a phone number).
      if (actions[h.action].value !== wasValue) h.value = null;
      // Switching between an action and a detail: actions have a look, details don't.
      if (kindOf(h) !== wasKind) h.style = kindOf(h) === "action" ? "invisible" : null;
      changed({ inspector: true });
    });
    $('[data-field="value"]', inspector)?.addEventListener("input", (e) => {
      h.value = e.target.value.trim() || null;
      changed();
    });
    $('[data-field="label"]', inspector)?.addEventListener("input", (e) => {
      h.label = e.target.value.trim() || null;
      changed();
    });
    $$("[data-style]", inspector).forEach((b) =>
      b.addEventListener("click", () => {
        h.style = b.dataset.style;
        changed({ inspector: true });
      }),
    );
    $("[data-delete-spot]", inspector)?.addEventListener("click", () => removeSpot(h.id));
  }

  function renderList() {
    $("[data-spot-count]", editor).textContent = state.hotspots.length ? `(${state.hotspots.length})` : "";
    list.innerHTML = state.hotspots.length
      ? state.hotspots
          .map((h) => {
            const a = actions[h.action];
            const target = targetOf(h);
            return `<li>
              <button type="button" data-select-spot="${esc(h.id)}" class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs ${
                h.id === state.selected ? "bg-brand-50 text-brand-900" : "hover:bg-gray-50"
              }">
                <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-ink-700">${icon(a.icon, { size: 12 })}</span>
                <span class="min-w-0 flex-1">
                  <span class="block truncate font-semibold">${esc(textOf(h))}</span>
                  <span class="block truncate ${target ? "text-ink-500" : "text-amber-700"}">${esc(target || (h.action === "custom_text" ? "Type your text" : "Needs a phone/address/link"))}</span>
                </span>
              </button>
            </li>`;
          })
          .join("")
      : `<li class="text-xs text-ink-400">Nothing yet.</li>`;
  }

  function renderAll() {
    renderStage();
    renderPalette();
    renderInspector();
    renderList();
  }

  // After an edit: redraw what it affects (the inspector only when its own shape changes, so typing keeps focus).
  // --- The logo's size --------------------------------------------------------
  // The slider scales a logo box about its centre, relative to the size it had
  // when first selected in this session, so sliding back and forth never drifts.
  const logoBase = new Map(); // id -> { w, h, cx, cy }
  function logoBaseOf(h) {
    if (!logoBase.has(h.id)) logoBase.set(h.id, { w: h.w, h: h.h, cx: h.x + h.w / 2, cy: h.y + h.h / 2 });
    return logoBase.get(h.id);
  }
  function moveLogoBase(h, dx, dy) {
    const base = logoBase.get(h.id);
    if (base) Object.assign(base, { cx: base.cx + dx, cy: base.cy + dy });
  }
  const logoScale = (h) => h.w / logoBaseOf(h).w;
  function scaleLogo(h, scale) {
    const base = logoBaseOf(h);
    // Keep the box's shape; never larger than the card, never smaller than MIN_SIZE.
    const s = clamp(scale, Math.max(MIN_SIZE / base.w, MIN_SIZE / base.h), Math.min(100 / base.w, 100 / base.h));
    h.w = round(base.w * s);
    h.h = round(base.h * s);
    h.x = round(clamp(base.cx - h.w / 2, 0, 100 - h.w));
    h.y = round(clamp(base.cy - h.h / 2, 0, 100 - h.h));
  }

  function changed({ inspector: redrawInspector = false } = {}) {
    markDirty();
    renderStage();
    renderList();
    if (redrawInspector) renderInspector();
  }

  function select(id) {
    state.selected = id;
    renderStage();
    renderInspector();
    renderList();
  }

  function removeSpot(id) {
    if (!canDelete) return;
    state.hotspots = state.hotspots.filter((h) => h.id !== id);
    if (state.selected === id) state.selected = null;
    markDirty();
    renderAll();
  }

  // A new action centred on (cx, cy) in percent, sized to suit a phone-card button.
  function addSpot(action, cx = 50, cy = 50) {
    if (state.hotspots.length >= MAX_SPOTS) return onError(`A card can have up to ${MAX_SPOTS} items.`);
    const rect = stage.getBoundingClientRect();
    const kind = actions[action]?.kind || "action";
    const px = (n) => (n / 480) * rect.width; // editor sizes are px at a 480px-wide card
    let w = 26;
    let h = clamp(((rect.width * 0.11) / rect.height) * 100, MIN_SIZE, 40);
    let extra = { style: "invisible" };
    if (kind === "text") {
      const size = action === "name" ? 26 : action === "about" ? 13 : 15;
      const lines = action === "about" ? 3 : action === "address" ? 2 : 1;
      w = action === "name" ? 70 : 60;
      h = clamp(((px(size) * 1.35 * lines + px(6)) / rect.height) * 100, MIN_SIZE, 40);
      extra = { style: null, fontSize: size, bold: action === "name", color: "#111827", align: "left" };
    } else if (kind === "image") {
      w = action === "qr" ? 24 : 22;
      h = clamp(((rect.width * w) / 100 / rect.height) * 100, MIN_SIZE, 60); // square
      extra = { style: null };
    }
    const spot = {
      id: newId(),
      action,
      x: round(clamp(cx - w / 2, 0, 100 - w)),
      y: round(clamp(cy - h / 2, 0, 100 - h)),
      w,
      h: round(h),
      value: null,
      label: null,
      ...extra,
    };
    state.hotspots.push(spot);
    state.selected = spot.id;
    markDirty();
    renderAll();
    $(`[data-spot="${CSS.escape(spot.id)}"]`, spotsLayer)?.focus();
    if (action === "logo" && !defaults.logo) pickLogo(spot.id);
  }

  // --- The logo's own picture -------------------------------------------------
  const logoInput = Object.assign(document.createElement("input"), { type: "file", accept: "image/jpeg,image/png,image/webp", hidden: true });
  editor.append(logoInput);
  let logoFor = null;
  function pickLogo(id) {
    logoFor = id;
    logoInput.click();
  }
  logoInput.addEventListener("change", () => {
    useLogo(logoFor, logoInput.files[0]);
    logoInput.value = "";
  });

  async function useLogo(id, file) {
    if (!file || !spotById(id)) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return onError("Choose a JPG, PNG or WebP image.");
    onError("");
    uploading.classList.replace("hidden", "flex");
    try {
      const result = await uploadImageFull(file, "card-logos", { removeBackground: removeLogoBg });
      const h = spotById(id);
      if (!h) return;
      h.value = result.url;
      logoNote = !removeLogoBg
        ? "Uploaded as it is, quality enhanced."
        : result.method === "ai"
          ? "Background removed and redrawn in high quality by AI. Check it matches your logo — untick the box and upload again to keep the original."
          : result.backgroundRemoved
            ? "Background removed and quality enhanced (AI wasn't available)."
            : "Quality enhanced. The background couldn't be removed.";
      state.selected = id;
      markDirty();
      renderAll();
    } catch (err) {
      onError(err);
    } finally {
      uploading.classList.replace("flex", "hidden");
    }
  }

  // Pointer position as percent of the stage, and whether it's over it.
  function toStage(e) {
    const r = stage.getBoundingClientRect();
    const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    return { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100, inside };
  }

  function track(move, up) {
    const end = (ev) => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", end);
      document.removeEventListener("pointercancel", end);
      up(ev);
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", end);
    document.addEventListener("pointercancel", end);
  }

  // --- Drag from the palette onto the card ------------------------------------
  palette?.addEventListener("pointerdown", (e) => {
    const chip = e.target.closest("[data-palette-action]");
    if (!chip || chip.disabled || e.button > 0) return;
    e.preventDefault();
    const action = chip.dataset.paletteAction;
    const startX = e.clientX;
    const startY = e.clientY;
    let ghost = null;

    track(
      (ev) => {
        if (!ghost && Math.hypot(ev.clientX - startX, ev.clientY - startY) > 5) {
          ghost = chip.cloneNode(true);
          ghost.className += " pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 shadow-lg ring-2 ring-brand-500";
          document.body.appendChild(ghost);
        }
        if (ghost) {
          ghost.style.left = `${ev.clientX}px`;
          ghost.style.top = `${ev.clientY}px`;
          const over = toStage(ev).inside;
          stage.classList.toggle("ring-4", over);
          stage.classList.toggle("ring-brand-300", over);
        }
      },
      (ev) => {
        stage.classList.remove("ring-4", "ring-brand-300");
        if (!ghost) return addSpot(action); // a tap: drop it in the middle
        ghost.remove();
        const p = toStage(ev);
        if (p.inside && ev.type === "pointerup") addSpot(action, p.x, p.y);
      },
    );
  });
  // Keyboard (Enter/Space on a chip) adds it in the middle; pointer taps are handled above.
  palette?.addEventListener("click", (e) => {
    const chip = e.target.closest("[data-palette-action]");
    if (chip && !chip.disabled && e.detail === 0) addSpot(chip.dataset.paletteAction);
  });

  // --- Move and resize placed actions ----------------------------------------
  spotsLayer.addEventListener("pointerdown", (e) => {
    const el = e.target.closest("[data-spot]");
    if (!el || e.button > 0) return;
    e.preventDefault();
    const h = spotById(el.dataset.spot);
    if (state.selected !== h.id) select(h.id);
    const target = $(`[data-spot="${CSS.escape(h.id)}"]`, spotsLayer);
    target.focus({ preventScroll: true });
    // Where positions are fixed, a press only selects the box (the logo still drags).
    if (!canDrag(h)) return;
    const handle = canMove ? e.target.closest("[data-handle]")?.dataset.handle : null;
    const start = toStage(e);
    const orig = { x: h.x, y: h.y, w: h.w, h: h.h };
    let moved = false;

    track(
      (ev) => {
        const p = toStage(ev);
        const dx = p.x - start.x;
        const dy = p.y - start.y;
        if (!moved && Math.abs(dx) + Math.abs(dy) < 0.3) return;
        moved = true;
        if (!handle) {
          h.x = round(clamp(orig.x + dx, 0, 100 - h.w));
          h.y = round(clamp(orig.y + dy, 0, 100 - h.h));
        } else {
          let { x, y, w, h: hh } = orig;
          if (handle.includes("e")) w = clamp(orig.w + dx, MIN_SIZE, 100 - orig.x);
          if (handle.includes("s")) hh = clamp(orig.h + dy, MIN_SIZE, 100 - orig.y);
          if (handle.includes("w")) {
            x = clamp(orig.x + dx, 0, orig.x + orig.w - MIN_SIZE);
            w = orig.w + orig.x - x;
          }
          if (handle.includes("n")) {
            y = clamp(orig.y + dy, 0, orig.y + orig.h - MIN_SIZE);
            hh = orig.h + orig.y - y;
          }
          Object.assign(h, { x: round(x), y: round(y), w: round(w), h: round(hh) });
        }
        Object.assign(target.style, { left: `${h.x}%`, top: `${h.y}%`, width: `${h.w}%`, height: `${h.h}%` });
      },
      () => {
        if (!moved) return;
        // Resized by hand: that's the logo slider's new 100%. Moved: the slider scales about the new centre.
        if (handle) logoBase.delete(h.id);
        else moveLogoBase(h, h.x - orig.x, h.y - orig.y);
        changed({ inspector: h.action === "logo" });
      },
    );
  });

  // Arrow keys nudge (Shift: further; Alt: resize), Delete removes.
  spotsLayer.addEventListener("keydown", (e) => {
    const el = e.target.closest("[data-spot]");
    if (!el) return;
    const h = spotById(el.dataset.spot);
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      return removeSpot(h.id);
    }
    const step = e.shiftKey ? 2 : 0.5;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (!d || !canDrag(h) || (e.altKey && !canMove)) return;
    e.preventDefault();
    const was = { x: h.x, y: h.y };
    if (e.altKey) {
      h.w = round(clamp(h.w + d[0], MIN_SIZE, 100 - h.x));
      h.h = round(clamp(h.h + d[1], MIN_SIZE, 100 - h.y));
    } else {
      h.x = round(clamp(h.x + d[0], 0, 100 - h.w));
      h.y = round(clamp(h.y + d[1], 0, 100 - h.h));
    }
    state.selected = h.id;
    if (e.altKey) logoBase.delete(h.id);
    else moveLogoBase(h, h.x - was.x, h.y - was.y);
    changed({ inspector: h.action === "logo" });
    $(`[data-spot="${CSS.escape(h.id)}"]`, spotsLayer)?.focus();
  });

  // --- Click the image to add an action there --------------------------------
  // A click (or tap) on the bare image deselects and opens a menu of actions
  // at that spot; picking one places it centred on the click.
  let menu = null;
  function closeMenu() {
    menu?.remove();
    menu = null;
  }
  function openMenu(x, y) {
    closeMenu();
    menu = document.createElement("div");
    menu.dataset.spotMenu = "";
    menu.setAttribute("role", "menu");
    menu.className = "absolute z-20 max-h-72 w-48 overflow-y-auto rounded-xl bg-white p-1 text-left shadow-xl ring-1 ring-black/10";
    // Open toward the middle so the menu stays on the image.
    Object.assign(menu.style, x > 55 ? { right: `${100 - x}%` } : { left: `${x}%` }, y > 55 ? { bottom: `${100 - y}%` } : { top: `${y}%` });
    menu.innerHTML = GROUPS.map(
      ([kind, title]) => `<p class="px-2 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-500">${esc(title)}</p>
      ${actionList
        .filter((a) => (a.kind || "action") === kind)
        .map(
          (a) => `<button type="button" role="menuitem" data-menu-action="${esc(a.key)}" class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-ink-800 hover:bg-brand-50 focus:bg-brand-50 focus:outline-none">
            ${icon(a.icon, { size: 15, className: "text-brand-600" })} ${esc(a.label)}
          </button>`,
        )
        .join("")}`,
    ).join("");
    menu.addEventListener("click", (e) => {
      e.stopPropagation();
      const b = e.target.closest("[data-menu-action]");
      if (!b) return;
      closeMenu();
      addSpot(b.dataset.menuAction, x, y);
    });
    menu.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeMenu();
    });
    menu.addEventListener("pointerdown", (e) => e.stopPropagation());
    stage.appendChild(menu);
    $("[data-menu-action]", menu)?.focus({ preventScroll: true });
  }
  stage.addEventListener("click", (e) => {
    if (!state.imageUrl || e.target.closest("[data-spot], [data-spot-menu]")) return;
    const p = toStage(e);
    if (state.selected) select(null);
    openMenu(clamp(p.x, 0, 100), clamp(p.y, 0, 100));
  });
  // Clicking anywhere else, or Escape, closes it.
  document.addEventListener("pointerdown", (e) => {
    if (menu && !stage.contains(e.target)) closeMenu();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMenu();
  });
  spotsLayer.addEventListener("pointerdown", (e) => {
    if (e.target.closest("[data-spot]")) closeMenu();
  });
  list.addEventListener("click", (e) => {
    const b = e.target.closest("[data-select-spot]");
    if (b) select(b.dataset.selectSpot);
  });

  // --- The image -------------------------------------------------------------
  function naturalSize(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => reject(new Error("The uploaded image could not be loaded"));
      img.src = url;
    });
  }

  async function useFile(file) {
    if (!file) return;
    // Where the image can't be replaced, a file dropped on it is ignored.
    if (state.imageUrl && !canReplaceImage) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return onError("Choose a JPG, PNG or WebP image.");
    onError("");
    uploading.classList.replace("hidden", "flex");
    try {
      const url = await uploadImage(file, "card-images");
      const size = await naturalSize(url);
      Object.assign(state, { imageUrl: url, imageWidth: size.width, imageHeight: size.height });
      markDirty();
      renderAll();
    } catch (err) {
      onError(err);
    } finally {
      uploading.classList.replace("flex", "hidden");
    }
  }

  $$("[data-image-file]", editor).forEach((input) =>
    input.addEventListener("change", () => {
      useFile(input.files[0]);
      input.value = "";
    }),
  );
  // Dropping an image file anywhere on the stage uploads it.
  stage.addEventListener("dragover", (e) => {
    if ([...(e.dataTransfer?.types || [])].includes("Files")) {
      e.preventDefault();
      stage.classList.add("ring-4", "ring-brand-300");
    }
  });
  stage.addEventListener("dragleave", () => stage.classList.remove("ring-4", "ring-brand-300"));
  stage.addEventListener("drop", (e) => {
    e.preventDefault();
    stage.classList.remove("ring-4", "ring-brand-300");
    const file = e.dataTransfer?.files?.[0];
    const onLogo = spotById(e.target.closest?.("[data-spot]")?.dataset.spot);
    if (onLogo?.action === "logo") useLogo(onLogo.id, file);
    else useFile(file);
  });

  $("[data-remove-image]", editor)?.addEventListener("click", () => {
    closeMenu();
    Object.assign(state, { imageUrl: null, imageWidth: null, imageHeight: null, selected: null });
    markDirty();
    renderAll();
  });

  // Open with a box already selected, so its settings show right away:
  // the first one that still needs details, else the first one.
  if (state.imageUrl && state.hotspots.length) {
    state.selected = (state.hotspots.find((h) => !targetOf(h)) || state.hotspots[0]).id;
  }
  renderAll();

  return {
    get dirty() {
      return dirty;
    },
    markClean() {
      dirty = false;
    },
    // Before saving: a message (and the action selected) when something must be fixed first.
    check() {
      const missingLink = state.hotspots.find((h) => h.action === "link" && !h.value);
      if (missingLink) {
        select(missingLink.id);
        return "A custom link needs a web address.";
      }
      return null;
    },
    // The image and actions as they are now, for saving or a live preview.
    payload() {
      return {
        imageUrl: state.imageUrl,
        imageWidth: state.imageWidth,
        imageHeight: state.imageHeight,
        hotspots: state.hotspots.map(({ id, action, x, y, w, h, value, label, style, font, fontSize, bold, italic, color, bg, align }) => ({
          id,
          action,
          x,
          y,
          w,
          h,
          value,
          label,
          style,
          font: font || null,
          fontSize: fontSize || null,
          bold: !!bold,
          italic: !!italic,
          color: color || null,
          bg: bg || null,
          align: align || null,
        })),
      };
    },
  };
}
