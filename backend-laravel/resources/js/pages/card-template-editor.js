import { api, errorMessage } from "../lib/api";
import { initSearchableSelects } from "../lib/searchable-select";
import { $, $$, pageData } from "../lib/ui";
import { initUploadFields, reloadWithFlash, showError, showFlash } from "../lib/widgets";

// The admin's card-template editor (pages/admin/card-template-editor.blade.php).
// Every change redraws the preview from the server's own renderer
// (POST /admin/card-templates/preview), so what you see is exactly what a
// business's card will look like.

const { id } = pageData("card-template-data") ?? {};
const form = $("[data-template-form]");
const frame = $("[data-preview]");
const sampleName = $("[data-sample-name]");
const errorBox = $("[data-error]");

showFlash();
initUploadFields(form);
initSearchableSelects(form);

function values() {
  const f = new FormData(form);
  const colors = {};
  $$('input[type="color"]', form).forEach((input) => (colors[input.name.replace("color_", "")] = input.value));
  return {
    name: f.get("name")?.trim(),
    categoryId: f.get("categoryId") || null,
    layout: f.get("layout"),
    backgroundImageUrl: f.get("backgroundImageUrl")?.trim() || null,
    sortOrder: f.get("sortOrder") === "" ? undefined : Number(f.get("sortOrder")),
    isActive: form.isActive.checked,
    isDefault: form.isDefault.checked,
    isPremium: form.isPremium.checked,
    design: {
      colors,
      fonts: { heading: f.get("font_heading"), body: f.get("font_body") },
      buttonStyle: f.get("buttonStyle"),
      overlay: Number(f.get("overlay")),
    },
  };
}

let timer = null;
let request = 0;
async function refreshPreview() {
  const v = values();
  const mine = ++request;
  try {
    const { data } = await api.post("/admin/card-templates/preview", {
      layout: v.layout,
      backgroundImageUrl: v.backgroundImageUrl,
      categoryId: v.categoryId,
      name: sampleName.value.trim() || undefined,
      design: v.design,
    });
    if (mine === request) frame.srcdoc = data.html;
  } catch (err) {
    if (mine === request) showError(errorBox, errorMessage(err));
  }
}
const schedulePreview = () => {
  clearTimeout(timer);
  timer = setTimeout(refreshPreview, 250);
};

form.addEventListener("input", (e) => {
  if (e.target.type === "color") $(`[data-color-value="${e.target.name.replace("color_", "")}"]`, form).textContent = e.target.value;
  if (e.target.name === "overlay") $("[data-overlay-label]", form).textContent = `${Math.round(Number(e.target.value) * 100)}%`;
  schedulePreview();
});
form.addEventListener("change", schedulePreview);
sampleName.addEventListener("input", schedulePreview);
refreshPreview();

// "Generate with AI": a background from the category, layout and colours,
// dropped into the background field (saved with the template).
const generateBtn = $("[data-generate-background]", form);
generateBtn?.addEventListener("click", async () => {
  const v = values();
  const label = $("span", generateBtn);
  showError(errorBox, "");
  generateBtn.disabled = true;
  label.textContent = "Painting…";
  try {
    const { data } = await api.post("/admin/card-templates/background", {
      layout: v.layout,
      categoryId: v.categoryId,
      design: v.design,
      hint: $("[data-ai-hint]", form).value.trim() || undefined,
    });
    const field = form.backgroundImageUrl;
    field.value = data.url;
    field.dispatchEvent(new Event("input", { bubbles: true }));
  } catch (err) {
    showError(errorBox, errorMessage(err));
  } finally {
    generateBtn.disabled = false;
    label.textContent = "Generate with AI";
  }
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  showError(errorBox, "");
  const button = $("[data-save]", form);
  button.disabled = true;
  try {
    const body = values();
    const { data } = id ? await api.patch(`/admin/card-templates/${id}`, body) : await api.post("/admin/card-templates", body);
    reloadWithFlash(id ? "Template saved." : "Template created.", `/admin/card-templates/${data.id}`);
  } catch (err) {
    button.disabled = false;
    showError(errorBox, errorMessage(err));
  }
});
