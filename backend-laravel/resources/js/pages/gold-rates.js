import { api, errorMessage } from "../lib/api";
import { PURITIES, downloadSavedTemplate } from "../lib/gold-rate-render";
import { $, $$, esc, openModal, pageData } from "../lib/ui";
import { reloadWithFlash, showError } from "../lib/widgets";

// The admin "Gold Rates" tab: today's rates, uploading templates,
// and the per-template actions. Editing happens on the template's own page
// (gold-rate-editor.js).

const data = pageData("gold-rates-data") ?? { templates: [], rates: {} };
const pageError = $("[data-error]");

// Runs an API call with the button showing a busy label.
async function busy(button, label, work) {
  const before = button.innerHTML;
  button.disabled = true;
  button.textContent = label;
  try {
    return await work();
  } finally {
    button.disabled = false;
    button.innerHTML = before;
  }
}

function confirmModal(title, message, action, run) {
  const modal = openModal(
    title,
    `<p class="text-sm text-ink-700">${message}</p>
    <p class="mt-3 text-sm text-red-700 bg-red-50 rounded-md px-3 py-2" data-modal-error hidden></p>
    <div class="mt-4 flex justify-end gap-2">
      <button type="button" data-close class="btn-secondary px-4 py-2 text-sm">Keep it</button>
      <button type="button" data-confirm class="btn-primary !bg-red-600 hover:!bg-red-700 px-4 py-2 text-sm">${esc(action)}</button>
    </div>`,
  );
  const confirm = $("[data-confirm]", modal.body);
  confirm.addEventListener("click", async () => {
    try {
      await busy(confirm, "Deleting…", run);
    } catch (err) {
      showError($("[data-modal-error]", modal.body), errorMessage(err));
    }
  });
}

// --- Rates --------------------------------------------------------------------
const ratesForm = $("[data-gold-rates-form]");
ratesForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const rates = Object.fromEntries(PURITIES.map((p) => [p, ratesForm[p].value.trim() === "" ? null : Number(ratesForm[p].value)]));
  try {
    await busy($("[data-save-rates]", ratesForm), "Saving…", () => api.put("/admin/gold-rates/rates", { rates }));
    reloadWithFlash("Gold rates saved. Every template now shows them.");
  } catch (err) {
    showError($("[data-rates-error]", ratesForm), errorMessage(err));
  }
});

// --- Templates ----------------------------------------------------------------
const templateForm = $("[data-new-template]");
templateForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const body = new FormData(templateForm);
  try {
    const { data: created } = await busy($("[data-upload-template]", templateForm), "Uploading…", () =>
      api.post("/admin/gold-rates/templates", body),
    );
    reloadWithFlash("Template uploaded. Link a business for its logo, drag the logo and rates into place, then save.", `/admin/gold-rates/templates/${created.id}`);
  } catch (err) {
    showError($("[data-template-error]"), errorMessage(err));
  }
});

$$("[data-download-template]").forEach((button) =>
  button.addEventListener("click", async () => {
    const template = data.templates.find((t) => t.id === button.dataset.downloadTemplate);
    if (!template) return;
    showError(pageError, "");
    try {
      await busy(button, "Rendering…", () => downloadSavedTemplate(template, data.rates));
    } catch (err) {
      showError(pageError, errorMessage(err));
    }
  }),
);

$$("[data-duplicate-template]").forEach((button) =>
  button.addEventListener("click", async () => {
    try {
      const { data: copy } = await busy(button, "…", () => api.post(`/admin/gold-rates/templates/${button.dataset.duplicateTemplate}/duplicate`));
      reloadWithFlash(`Duplicated as “${copy.name}”.`);
    } catch (err) {
      showError(pageError, errorMessage(err));
    }
  }),
);

$$("[data-delete-template]").forEach((button) =>
  button.addEventListener("click", () => {
    const template = JSON.parse(button.dataset.deleteTemplate);
    confirmModal(
      "Delete template",
      `Delete <strong>${esc(template.name)}</strong>? Its master PNG and saved layout are removed for good.`,
      "Delete template",
      async () => {
        await api.delete(`/admin/gold-rates/templates/${template.id}`);
        reloadWithFlash(`Deleted “${template.name}”.`);
      },
    );
  }),
);

