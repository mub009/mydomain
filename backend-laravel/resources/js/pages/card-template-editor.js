import { api, errorMessage, uploadImage } from "../lib/api";
import { openColourAreas } from "../lib/colour-areas";
import { initHotspotEditor } from "../lib/hotspot-editor";
import { initSearchableSelects } from "../lib/searchable-select";
import { $, esc, pageData } from "../lib/ui";
import { reloadWithFlash, showError, showFlash } from "../lib/widgets";

// The admin's card-template editor (pages/admin/card-template-editor.blade.php).
// Every change redraws the preview from the server's own renderer
// (POST /admin/card-templates/preview), so what you see is exactly what a
// business's card will look like.

const templateData = pageData("card-template-data") ?? {};
const { id } = templateData;
const form = $("[data-template-form]");
const frame = $("[data-preview]");
const sampleName = $("[data-sample-name]");
const errorBox = $("[data-error]");

showFlash();
initSearchableSelects(form);

// The card image with its actions (an image template); redraws the preview on every change.
const fail = (err) => showError(errorBox, !err ? "" : typeof err === "string" ? err : errorMessage(err));
const imageEditor = initHotspotEditor($("[data-hotspot-editor]"), {
  actions: templateData.actions,
  fonts: templateData.fonts,
  defaults: templateData.actionDefaults,
  fallbackPrefix: "Leave empty to use ",
  imageUrl: templateData.imageUrl,
  imageWidth: templateData.imageWidth,
  imageHeight: templateData.imageHeight,
  hotspots: templateData.hotspots,
  onChange: () => {
    schedulePreview();
    if (areasBox) showAreas();
    if (variantsBox) showVariants();
  },
  onError: fail,
  fullScreen: true, // the whole editor as a Photoshop-like workspace
  onSave: () => $("[data-save]")?.click(),
});

// --- Colour areas: where a business's colour may go on this design -----------
let colourAreas = templateData.colourAreas || [];
let areasDirty = false;
const areasBox = $("[data-template-areas]");
function showAreas() {
  const hasImage = !!imageEditor.payload().imageUrl;
  const n = colourAreas.length;
  $("[data-areas-status]", areasBox).textContent = !hasImage
    ? "Upload the card image first, then mark the parts a business's colour may change."
    : n
      ? `${n} ${n === 1 ? "area" : "areas"} marked — every card using this design changes colour only there.${areasDirty ? " Save to keep it." : ""}`
      : `Nothing marked — a business's colour changes the whole card.${areasDirty ? " Save to keep it." : ""}`;
  $("[data-areas-edit]", areasBox).disabled = !hasImage;
  $("[data-areas-edit] span", areasBox).textContent = n ? "Change areas" : "Mark areas";
  $("[data-areas-clear]", areasBox).hidden = !n;
}
$("[data-areas-edit]", areasBox).addEventListener("click", () => {
  const img = imageEditor.payload();
  openColourAreas({
    imageUrl: img.imageUrl,
    ratio: img.imageWidth && img.imageHeight ? img.imageWidth / img.imageHeight : 0.6,
    // A sample colour shows where it goes while marking.
    colour: { tint: "#db2777", strength: 70, hue: 0, brightness: 100, saturation: 100, areas: colourAreas },
    onDone: (areas) => {
      colourAreas = areas;
      areasDirty = true;
      showAreas();
    },
  });
});
$("[data-areas-clear]", areasBox).addEventListener("click", () => {
  colourAreas = [];
  areasDirty = true;
  showAreas();
});
showAreas();

// --- Colour versions: the same design in other colours, each its own image ---
let variants = (templateData.colourVariants || []).map((v) => ({ ...v }));
let variantsDirty = false;
let pickedColour = "#dc2626";
let replacing = null; // a version whose image is being changed
const variantsBox = $("[data-template-variants]");
const variantFile = $("[data-variant-file]", variantsBox);

// A picture's own width and height, read by loading it.
const sizeOf = (url) =>
  new Promise((done) => {
    const img = new Image();
    img.onload = () => done({ imageWidth: img.naturalWidth || null, imageHeight: img.naturalHeight || null });
    img.onerror = () => done({ imageWidth: null, imageHeight: null });
    img.src = url;
  });

function showVariants() {
  const n = variants.length;
  $("[data-variants-status]", variantsBox).textContent = !imageEditor.payload().imageUrl
    ? "Upload the card image first — it is the master; colour versions are the same design in other colours."
    : n
      ? `${n} colour ${n === 1 ? "version" : "versions"} — businesses pick one on their open card.${variantsDirty ? " Save to keep them." : ""}`
      : `None yet — businesses can still recolour the master image.${variantsDirty ? " Save to keep it." : ""}`;
  $("[data-variants-list]", variantsBox).innerHTML = variants
    .map(
      (v, i) => `<li class="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <img src="${esc(v.imageUrl)}" alt="" class="aspect-[3/5] w-full object-cover object-top" />
        <div class="space-y-1.5 border-t border-gray-100 p-2">
          <div class="flex items-center gap-2">
            <label class="relative h-6 w-6 shrink-0 cursor-pointer rounded-full border border-white shadow ring-1 ring-gray-300" style="background:${esc(v.colour)}" title="Change this colour">
              <input type="color" value="${esc(v.colour)}" class="absolute inset-0 h-full w-full cursor-pointer opacity-0" aria-label="Colour of ${esc(v.colour)}" data-variant-edit="${i}" />
            </label>
            <span class="font-mono text-[11px] text-ink-600">${esc(v.colour)}</span>
            <span class="text-[10px] text-ink-400">(tap to change)</span>
          </div>
          <div class="flex items-center justify-between gap-2">
            <button type="button" class="text-[11px] font-semibold text-brand-700 hover:underline" data-variant-replace="${i}">Change image</button>
            <button type="button" class="text-[11px] font-semibold text-red-700 hover:underline" data-variant-remove="${i}" aria-label="Remove ${esc(v.colour)}">Delete</button>
          </div>
        </div>
      </li>`,
    )
    .join("");
  $("[data-variant-preview]", variantsBox).style.background = pickedColour;
  $("[data-variant-hex]", variantsBox).textContent = pickedColour;
  $("[data-variant-upload]", variantsBox).disabled = !imageEditor.payload().imageUrl || variants.length >= 12;
}
variantsBox.addEventListener("click", (e) => {
  const t = e.target.closest("[data-variant-remove], [data-variant-replace], [data-variant-upload]");
  if (!t) return;
  if (t.dataset.variantRemove !== undefined) {
    variants.splice(Number(t.dataset.variantRemove), 1);
    variantsDirty = true;
  }
  if (t.dataset.variantReplace !== undefined || t.hasAttribute("data-variant-upload")) {
    replacing = t.dataset.variantReplace !== undefined ? Number(t.dataset.variantReplace) : null;
    return variantFile.click();
  }
  showVariants();
});
variantsBox.addEventListener("input", (e) => {
  if (e.target.matches("[data-variant-custom]")) {
    pickedColour = e.target.value;
    showVariants();
  }
  // A version's colour edited in place (its image stays).
  if (e.target.matches("[data-variant-edit]")) {
    const v = variants[Number(e.target.dataset.variantEdit)];
    if (v) {
      v.colour = e.target.value;
      variantsDirty = true;
      const row = e.target.closest("li");
      e.target.parentElement.style.background = v.colour;
      row.querySelector(".font-mono").textContent = v.colour;
      $("[data-variants-status]", variantsBox).textContent = `${variants.length} colour ${variants.length === 1 ? "version" : "versions"} — businesses pick one on their open card. Save to keep them.`;
    }
  }
});
variantFile.addEventListener("change", async () => {
  const file = variantFile.files?.[0];
  variantFile.value = "";
  if (!file) return;
  const status = $("[data-variants-status]", variantsBox);
  status.textContent = "Uploading…";
  try {
    const imageUrl = await uploadImage(file, "card-images");
    const size = await sizeOf(imageUrl);
    if (replacing !== null && variants[replacing]) variants[replacing] = { ...variants[replacing], imageUrl, ...size };
    else variants.push({ colour: pickedColour, imageUrl, ...size });
    variantsDirty = true;
    showVariants();
  } catch (err) {
    showVariants();
    fail(err);
  }
});
showVariants();

function values() {
  const f = new FormData(form);
  return {
    name: f.get("name")?.trim(),
    // "common": no category of its own, offered to every category.
    categoryId: f.get("categoryId") && f.get("categoryId") !== "common" ? f.get("categoryId") : null,
    isCommon: f.get("categoryId") === "common",
    layout: f.get("layout") || "classic",
    sortOrder: f.get("sortOrder") === "" ? undefined : Number(f.get("sortOrder")),
    isActive: form.isActive.checked,
    isDefault: form.isDefault.checked,
  };
}

let timer = null;
let request = 0;
async function refreshPreview() {
  const v = values();
  const mine = ++request;
  try {
    const { data } = await api.post("/admin/card-templates/preview", {
      ...imageEditor.payload(),
      layout: v.layout,
      categoryId: v.categoryId,
      name: sampleName.value.trim() || undefined,
    });
    if (mine === request) {
      frame.srcdoc = data.html;
      showError(errorBox, "");
    }
  } catch (err) {
    if (mine === request) showError(errorBox, errorMessage(err));
  }
}
const schedulePreview = () => {
  clearTimeout(timer);
  timer = setTimeout(refreshPreview, 250);
};

form.addEventListener("input", (e) => {
  schedulePreview();
});
form.addEventListener("change", schedulePreview);
sampleName.addEventListener("input", schedulePreview);
refreshPreview();

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const problem = imageEditor.check();
  if (problem) return showError(errorBox, problem);
  showError(errorBox, "");
  const button = $("[data-save]", form);
  button.disabled = true;
  try {
    const body = { ...values(), ...imageEditor.payload(), colourAreas, colourVariants: variants };
    const { data } = id ? await api.patch(`/admin/card-templates/${id}`, body) : await api.post("/admin/card-templates", body);
    imageEditor.markClean();
    areasDirty = false;
    variantsDirty = false;
    reloadWithFlash(id ? "Template saved." : "Template created.", `/admin/card-templates/${data.id}`);
  } catch (err) {
    button.disabled = false;
    showError(errorBox, errorMessage(err));
  }
});

window.addEventListener("beforeunload", (e) => {
  if (imageEditor.dirty || areasDirty || variantsDirty) {
    e.preventDefault();
    e.returnValue = "";
  }
});
