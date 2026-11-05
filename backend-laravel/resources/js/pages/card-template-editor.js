import { api, errorMessage } from "../lib/api";
import { initHotspotEditor } from "../lib/hotspot-editor";
import { initSearchableSelects } from "../lib/searchable-select";
import { $, pageData } from "../lib/ui";
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
  onChange: () => schedulePreview(),
  onError: fail,
  fullScreen: true, // the whole editor as a Photoshop-like workspace
  onSave: () => $("[data-save]")?.click(),
});

function values() {
  const f = new FormData(form);
  return {
    name: f.get("name")?.trim(),
    categoryId: f.get("categoryId") || null,
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
    const body = { ...values(), ...imageEditor.payload() };
    const { data } = id ? await api.patch(`/admin/card-templates/${id}`, body) : await api.post("/admin/card-templates", body);
    imageEditor.markClean();
    reloadWithFlash(id ? "Template saved." : "Template created.", `/admin/card-templates/${data.id}`);
  } catch (err) {
    button.disabled = false;
    showError(errorBox, errorMessage(err));
  }
});

window.addEventListener("beforeunload", (e) => {
  if (imageEditor.dirty) {
    e.preventDefault();
    e.returnValue = "";
  }
});
