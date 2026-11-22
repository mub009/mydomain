import grapesjs from "grapesjs";
import presetWebpage from "grapesjs-preset-webpage";
import "grapesjs/dist/css/grapes.min.css";
import { api, errorMessage } from "../lib/api";
import { icon } from "../lib/icons";
import { $, esc, formatDateTime, pageData } from "../lib/ui";

// Website builder for a single business. The first draft is generated
// server-side from the data the owner already entered in their listing; from
// then on their saved document is the source of truth.

const { business, site } = pageData("site-builder-data");
const root = $("[data-site-builder]");
const base = `/businesses/${business.id}/site`;

// The two things a business's site can be. A website is authored in the
// builder; a shop is rendered by the app so its cart and checkout can run.
const SITE_TYPES = [
  { id: "WEBSITE", name: "Website", blurb: "A page that shows off your business — photos, services, hours, map and an enquiry form.", icon: "globe" },
  { id: "ECOMMERCE", name: "eCommerce", blurb: "An online shop. Customers add products to a cart, check out, and your orders land in this dashboard.", icon: "shopping-bag" },
];

const rupees = (cents) => (cents / 100).toString();

const state = {
  // A shop opens with its own button; a website is live whenever the
  // listing is, with saves going straight to it.
  isPublished: site.isPublished,
  listingLive: site.listingLive,
  savedAt: site.updatedAt,
  siteType: site.siteType,
  templates: site.templates,
  templateId: site.templateId,
  productCount: site.storefront.productCount,
  delivery: {
    fee: rupees(site.storefront.deliveryFeeCents),
    freeAbove: site.storefront.freeDeliveryAboveCents == null ? "" : rupees(site.storefront.freeDeliveryAboveCents),
  },
  // Whatever design the editor was last seeded from — it also backs Reset,
  // so resetting keeps the design the owner chose rather than the default.
  draft: { templateId: site.renderedTemplateId, html: site.starterHtml, css: site.starterCss },
  // The drag-and-drop editor is heavy, so it stays closed until asked for —
  // the default view is just the website's status and its template.
  editorOpen: false,
  // The template dropdown's current pick, which may differ from templateId
  // until "Change" is pressed.
  selectedTemplate: site.templateId,
  busyTemplate: "",
  saving: false,
  publishing: false,
  switching: false,
  savingDelivery: false,
  notice: "",
  error: "",
};

let editor = null;

// --- Layout -------------------------------------------------------------------
// The editor's container must survive re-renders, so the page is built once
// with fixed slots and each slot is redrawn on its own.
root.innerHTML = `
  <div class="card p-4" data-slot="header"></div>
  <div class="card p-4" data-slot="types"></div>
  <div data-slot="shop"></div>
  <div class="card flex flex-wrap items-center justify-between gap-2 p-3" data-slot="editor-toolbar"></div>
  <div class="overflow-hidden rounded-xl border border-gray-200 bg-white" data-slot="editor-wrap"><div data-editor></div></div>`;
const slot = (name) => $(`[data-slot="${name}"]`, root);

function headerView() {
  const isShop = state.siteType === "ECOMMERCE";
  // The business's subdomain when configured, else /site/<slug>.
  const publicUrl = site.publicUrl;
  const isLive = isShop ? state.isPublished : state.listingLive;
  return `<div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 class="flex items-center gap-1.5 font-bold text-ink-900">${icon(isShop ? "shopping-bag" : "globe", { size: 16, className: "text-brand-600" })} ${isShop ? "Your online shop" : "Your website"}</h3>
        <p class="mt-0.5 text-xs text-ink-500">${
          isShop
            ? "Customers browse your products, add them to a cart and check out. Orders arrive in the Orders tab."
            : `Starts from the details you entered for ${esc(business.name)}. Open the editor to make it your own — every save goes straight to your website.`
        }</p>
        ${state.savedAt ? `<p class="mt-1 text-[11px] text-ink-400">Last saved ${esc(formatDateTime(state.savedAt))}</p>` : ""}
      </div>
      <span class="badge ${isLive ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600"}">${isShop ? (isLive ? "Open" : "Closed") : isLive ? "Live" : "Not live yet"}</span>
    </div>
    ${state.notice ? `<p class="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">${esc(state.notice)}</p>` : ""}
    ${state.error ? `<p class="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">${esc(state.error)}</p>` : ""}
    <div class="mt-4 flex flex-wrap items-center gap-2">
      ${
        isLive
          ? `<a href="${esc(publicUrl)}" target="_blank" rel="noreferrer" class="btn-secondary px-3 py-2 text-sm">${icon("external-link", { size: 14 })} ${isShop ? "Open shop" : "View page"}</a>`
          : `<span class="text-xs text-ink-500">${isShop ? "" : "Goes live once your listing is published."}</span>`
      }
      ${
        isShop
          ? `<button type="button" data-action="publish" ${state.publishing ? "disabled" : ""} class="px-3 py-2 text-sm ${state.isPublished ? "btn-secondary" : "btn-primary"} disabled:opacity-50">${icon("upload", { size: 14 })} ${
              state.publishing ? "Working…" : state.isPublished ? "Close shop" : "Open shop"
            }</button>`
          : ""
      }
      <label class="flex items-center gap-1.5 text-sm">
        <span class="text-xs font-semibold text-ink-700">Template</span>
        <select data-template-select class="input w-auto py-1.5 text-sm">${state.templates.map((t) => `<option value="${esc(t.id)}" ${t.id === state.selectedTemplate ? "selected" : ""}>${esc(t.name)}</option>`).join("")}</select>
      </label>
      ${isShop ? "" : `<button type="button" data-action="preview-template" ${state.busyTemplate ? "disabled" : ""} class="btn-secondary px-2.5 py-2 text-sm disabled:opacity-50" title="Preview this template">${icon("eye", { size: 14 })}</button>`}
      <button type="button" data-action="change-template" ${state.selectedTemplate === state.templateId || state.busyTemplate ? "disabled" : ""} class="btn-secondary px-3 py-2 text-sm disabled:opacity-50">${state.busyTemplate ? "…" : "Change"}</button>
      ${
        isShop
          ? ""
          : state.editorOpen
            ? `<button type="button" data-action="close-editor" class="btn-secondary px-3 py-2 text-sm">${icon("x", { size: 14 })} Close editor</button>`
            : `<button type="button" data-action="open-editor" class="btn-primary px-3 py-2 text-sm">${icon("layout-template", { size: 14 })} Open website editor</button>`
      }
    </div>`;
}

function typesView() {
  return `<h4 class="text-sm font-bold text-ink-900">Website type</h4>
    <p class="mt-0.5 text-xs text-ink-500">Choose what this site is for. Switching keeps everything — your builder page and your products both stay put.</p>
    <div class="mt-3 grid gap-3 sm:grid-cols-2">${SITE_TYPES.map((option) => {
      const active = option.id === state.siteType;
      return `<button type="button" data-site-type="${option.id}" ${state.switching ? "disabled" : ""} class="flex items-start gap-3 rounded-lg border p-3 text-left transition-colors disabled:opacity-60 ${
        active ? "border-brand-500 bg-brand-50/50 ring-1 ring-brand-500" : "border-gray-200 hover:border-gray-300"
      }">
        <span class="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-lg ${active ? "bg-brand-600 text-white" : "bg-gray-100 text-ink-500"}">${icon(option.icon, { size: 17 })}</span>
        <span>
          <span class="flex items-center gap-1.5 text-sm font-bold text-ink-900">${option.name}${active ? icon("check", { size: 13, className: "text-brand-600" }) : ""}</span>
          <span class="mt-0.5 block text-xs leading-relaxed text-ink-500">${option.blurb}</span>
        </span>
      </button>`;
    }).join("")}</div>`;
}

// Shown above the editor only once it is open: drag-and-drop instructions
// plus Reset/Save, kept out of the default (closed-editor) view.
function editorToolbarView() {
  return `<p class="text-xs text-ink-500">Drag blocks onto the page to make it yours.</p>
    <div class="flex gap-2">
      <button type="button" data-action="reset" class="btn-secondary px-3 py-2 text-sm">${icon("rotate-ccw", { size: 14 })} Reset</button>
      <button type="button" data-action="save" ${state.saving ? "disabled" : ""} class="btn-primary px-3 py-2 text-sm disabled:opacity-50">${icon("save", { size: 14 })} ${state.saving ? "Saving…" : "Save"}</button>
    </div>`;
}

function shopView() {
  const count = state.productCount;
  return `<div class="space-y-3">
    <div class="card p-4">
      <h4 class="flex items-center gap-1.5 text-sm font-bold text-ink-900">${icon("package", { size: 15, className: "text-brand-600" })} Your catalogue</h4>
      <p class="mt-1 text-sm text-ink-600">${
        count === 0
          ? "You have no products yet. Add them under the Products tab — your shop needs at least one before it can open."
          : `${count} product${count === 1 ? "" : "s"} in your catalogue. Manage them under the Products tab.`
      }</p>
    </div>
    <form class="card space-y-3 p-4" data-delivery-form>
      <div>
        <h4 class="text-sm font-bold text-ink-900">Delivery charges</h4>
        <p class="mt-0.5 text-xs text-ink-500">Added to every order at checkout. Leave the free-delivery box blank if you always charge.</p>
      </div>
      <div class="grid gap-3 sm:grid-cols-2">
        <label class="block"><span class="mb-1 block text-xs font-semibold text-ink-700">Delivery fee (₹)</span>
          <input type="number" min="0" step="1" name="fee" class="input" value="${esc(state.delivery.fee)}" /></label>
        <label class="block"><span class="mb-1 block text-xs font-semibold text-ink-700">Free delivery on orders over (₹)</span>
          <input type="number" min="0" step="1" name="freeAbove" class="input" placeholder="No free delivery" value="${esc(state.delivery.freeAbove)}" /></label>
      </div>
      <button ${state.savingDelivery ? "disabled" : ""} class="btn-primary px-4 py-2 text-sm disabled:opacity-50">${icon("save", { size: 14 })} ${state.savingDelivery ? "Saving…" : "Save delivery settings"}</button>
    </form>
  </div>`;
}

function render() {
  const isShop = state.siteType === "ECOMMERCE";
  slot("header").innerHTML = headerView();
  slot("types").innerHTML = typesView();
  // The delivery form keeps what's typed, so it is only drawn on entering
  // shop mode, not on every render.
  if (isShop && !$("[data-delivery-form]", slot("shop"))) slot("shop").innerHTML = shopView();
  if (!isShop) slot("shop").innerHTML = "";
  // The editor is heavy, so it only mounts once opened.
  const showEditor = !isShop && state.editorOpen;
  slot("editor-toolbar").hidden = !showEditor;
  if (showEditor) {
    slot("editor-toolbar").innerHTML = editorToolbarView();
    mountEditor();
  }
  slot("editor-wrap").hidden = !showEditor;
}

function setMessage(notice = "", error = "") {
  state.notice = notice;
  state.error = error;
}

// --- Editor -------------------------------------------------------------------
// A storefront is not authored in the builder, so it never gets mounted for one.
function mountEditor() {
  if (editor) return;
  editor = grapesjs.init({
    container: $("[data-editor]", root),
    height: "70vh",
    width: "auto",
    // We persist explicitly via the Save button, not on every keystroke.
    storageManager: false,
    plugins: [presetWebpage],
    pluginsOpts: { [presetWebpage]: { modalImportTitle: "Import HTML" } },
    assetManager: {
      // Offer the shop's own photos as ready-to-drop assets. File uploads
      // are off — images are added by URL, same as elsewhere in the app.
      assets: business.photos,
      upload: false,
    },
    deviceManager: {
      devices: [
        { id: "desktop", name: "Desktop", width: "" },
        { id: "tablet", name: "Tablet", width: "768px", widthMedia: "992px" },
        { id: "mobile", name: "Mobile", width: "375px", widthMedia: "575px" },
      ],
    },
  });

  if (site.liveHtml) {
    // The saved page with the parts drawn from the listing (contact details,
    // slider, photos, hours…) brought up to date, as visitors see it.
    editor.setComponents(site.liveHtml);
    editor.setStyle(site.liveCss);
  } else if (site.projectData) {
    editor.loadProjectData(site.projectData);
  } else {
    // First visit: seed from the starter built out of their account data.
    editor.setComponents(site.starterHtml);
    editor.setStyle(site.starterCss);
  }
}

// --- Actions ------------------------------------------------------------------
async function save() {
  if (!editor) return false;
  state.saving = true;
  setMessage();
  render();
  try {
    const { data: result } = await api.put(base, {
      projectData: editor.getProjectData(),
      html: editor.getHtml(),
      css: editor.getCss(),
      templateId: state.templateId || undefined,
    });
    state.savedAt = result.savedAt;
    state.templateId = result.templateId;
    setMessage(state.listingLive ? "Saved — your website is updated." : "Saved.");
    return true;
  } catch (err) {
    setMessage("", errorMessage(err));
    return false;
  } finally {
    state.saving = false;
    render();
  }
}

// Opening or closing the shop. (A website needs no publishing.)
async function togglePublish() {
  state.publishing = true;
  state.error = "";
  render();
  try {
    const { data: result } = await api.post(`${base}/publish`, { isPublished: !state.isPublished });
    state.isPublished = result.isPublished;
    setMessage(result.isPublished ? "Your shop is open and taking orders." : "Your shop is closed.");
  } catch (err) {
    setMessage("", errorMessage(err));
  } finally {
    state.publishing = false;
    render();
  }
}

async function changeSiteType(next) {
  if (next === state.siteType) return;
  state.switching = true;
  setMessage();
  render();
  try {
    const { data: result } = await api.patch(`${base}/type`, { siteType: next });
    state.siteType = result.siteType;
    setMessage(
      next === "ECOMMERCE"
        ? "Switched to eCommerce. Add products under the Products tab, then publish to open your shop."
        : "Switched to a website. Your builder page is exactly as you left it.",
    );
  } catch (err) {
    setMessage("", errorMessage(err));
  } finally {
    state.switching = false;
    render();
  }
}

// Asks before replacing what is in the builder.
function confirmBox(message, confirmLabel) {
  return new Promise((resolve) => {
    const wrap = document.createElement("div");
    wrap.className = "fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4";
    wrap.innerHTML = `<div class="w-full max-w-md rounded-2xl bg-white p-5 shadow-popover">
      <p class="text-sm text-ink-700">${esc(message)}</p>
      <div class="mt-4 flex justify-end gap-2">
        <button type="button" data-no class="btn-secondary px-4 py-2 text-sm">Cancel</button>
        <button type="button" data-yes class="btn-primary px-4 py-2 text-sm">${esc(confirmLabel)}</button>
      </div>
    </div>`;
    document.body.appendChild(wrap);
    const done = (answer) => {
      wrap.remove();
      resolve(answer);
    };
    $("[data-yes]", wrap).addEventListener("click", () => done(true));
    $("[data-no]", wrap).addEventListener("click", () => done(false));
    wrap.addEventListener("click", (e) => e.target === wrap && done(false));
  });
}

// Apply a template. For a website this replaces the page in the builder, so
// it asks first; for a shop it only re-themes the storefront, which is safe.
async function applyTemplate(choice, rendered) {
  if (state.siteType === "ECOMMERCE") {
    state.busyTemplate = choice.id;
    setMessage();
    render();
    try {
      const { data: result } = await api.put(base, { templateId: choice.id });
      state.templateId = result.templateId;
      state.savedAt = result.savedAt;
      setMessage(`Your shop now uses the ${choice.name} theme.`);
    } catch (err) {
      setMessage("", errorMessage(err));
    } finally {
      state.busyTemplate = "";
      render();
    }
    return;
  }

  if (!(await confirmBox(`Rebuild your page with the "${choice.name}" design? Any changes you made in the builder will be replaced.`, "Use this design"))) return;
  // The editor is lazy — opening it here mounts it if it isn't already.
  if (!state.editorOpen) {
    state.editorOpen = true;
    render();
  }
  state.busyTemplate = choice.id;
  setMessage();
  render();
  try {
    const next = rendered ?? (await api.get(`${base}/templates/${choice.id}`)).data;
    editor.setComponents(next.html);
    editor.setStyle(next.css);
    state.draft = next;
    state.templateId = next.templateId;
    state.selectedTemplate = next.templateId;
    closePreview();
    setMessage(`Switched to the ${choice.name} design. Save to keep it.`);
  } catch (err) {
    setMessage("", errorMessage(err));
  } finally {
    state.busyTemplate = "";
    render();
  }
}

// Discard edits and rebuild the page from the listing's current data, using
// the design that is currently selected.
async function resetToAccountData() {
  if (!editor || !state.draft) return;
  if (!(await confirmBox("Replace the current design with a fresh page built from your business details?", "Rebuild page"))) return;
  editor.setComponents(state.draft.html);
  editor.setStyle(state.draft.css);
  setMessage("Rebuilt from your business details. Save to keep it.");
  render();
}

// --- Template preview -----------------------------------------------------------
// A template rendered into a standalone document, so the preview frame shows
// exactly what a visitor would see. Sandboxed with no same-origin access —
// scripts are allowed only so the embedded Google map works.
function previewDocument(draft) {
  return `<!doctype html><html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
*{box-sizing:border-box}
body{margin:0}
#mk-site-root{display:block;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#1a1a1a;line-height:1.5;background:#fff}
#mk-site-root img{max-width:100%}
${draft.css}
</style></head><body><div id="mk-site-root">${draft.html}</div></body></html>`;
}

let previewEl = null;
function closePreview() {
  previewEl?.remove();
  previewEl = null;
  document.removeEventListener("keydown", onPreviewKey);
}
function onPreviewKey(e) {
  if (e.key === "Escape") closePreview();
}

async function openPreview(choice) {
  state.busyTemplate = choice.id;
  state.error = "";
  render();
  let draft;
  try {
    draft = (await api.get(`${base}/templates/${choice.id}`)).data;
  } catch (err) {
    setMessage("", errorMessage(err));
    return;
  } finally {
    state.busyTemplate = "";
    render();
  }

  closePreview();
  previewEl = document.createElement("div");
  previewEl.className = "fixed inset-0 z-50 flex flex-col bg-black/70 p-3 sm:p-6";
  previewEl.innerHTML = `<div class="mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
      <div class="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-4 py-3">
        <div class="flex items-center gap-2">
          <span class="h-6 w-6 flex-none rounded-full" style="background:${esc(choice.accent)}"></span>
          <div>
            <p class="text-sm font-bold text-ink-900">${esc(choice.name)}</p>
            <p class="text-[11px] text-ink-500">Previewing with ${esc(business.name)}'s own content</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          ${choice.id !== state.templateId ? `<button type="button" data-use class="btn-primary px-3 py-2 text-sm">${icon("check", { size: 14 })} Use this template</button>` : ""}
          <button type="button" data-close-preview class="btn-secondary px-3 py-2 text-sm">${icon("x", { size: 14 })} Close</button>
        </div>
      </div>
      <iframe title="Website preview" class="h-full w-full flex-1 border-0 bg-white" sandbox="allow-scripts allow-popups"></iframe>
    </div>`;
  // No same-origin: the frame cannot reach back into the app.
  $("iframe", previewEl).srcdoc = previewDocument(draft);
  document.body.appendChild(previewEl);
  document.addEventListener("keydown", onPreviewKey);
  $("[data-close-preview]", previewEl).addEventListener("click", closePreview);
  $("[data-use]", previewEl)?.addEventListener("click", () => applyTemplate(choice, draft));
}

// --- Events -------------------------------------------------------------------
const findTemplate = (id) => state.templates.find((t) => t.id === id);

root.addEventListener("click", (e) => {
  const target = e.target.closest("button");
  if (!target || target.disabled) return;
  const action = target.dataset.action;
  if (action === "open-editor") {
    state.editorOpen = true;
    return render();
  }
  if (action === "close-editor") {
    state.editorOpen = false;
    return render();
  }
  if (action === "reset") return resetToAccountData();
  if (action === "save") return save();
  if (action === "publish") return togglePublish();
  if (action === "preview-template") return openPreview(findTemplate(state.selectedTemplate));
  if (action === "change-template") return applyTemplate(findTemplate(state.selectedTemplate));
  if (target.dataset.siteType) return changeSiteType(target.dataset.siteType);
});

root.addEventListener("change", (e) => {
  if (!e.target.matches("[data-template-select]")) return;
  state.selectedTemplate = e.target.value;
  render();
});

root.addEventListener("submit", async (e) => {
  if (!e.target.matches("[data-delivery-form]")) return;
  e.preventDefault();
  const form = e.target;
  state.delivery = { fee: form.fee.value, freeAbove: form.freeAbove.value };
  state.savingDelivery = true;
  setMessage();
  render();
  try {
    const freeAbove = state.delivery.freeAbove.trim();
    await api.patch(`${base}/type`, {
      deliveryFeeCents: Math.round(Number(state.delivery.fee || 0) * 100),
      freeDeliveryAboveCents: freeAbove === "" ? null : Math.round(Number(freeAbove) * 100),
    });
    setMessage("Delivery settings saved.");
  } catch (err) {
    setMessage("", errorMessage(err));
  } finally {
    state.savingDelivery = false;
    slot("shop").innerHTML = "";
    render();
  }
});

render();
