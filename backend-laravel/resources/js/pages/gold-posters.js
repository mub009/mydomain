import { errorMessage } from "../lib/api";
import { downloadSavedTemplate } from "../lib/gold-rate-render";
import { $, $$, pageData } from "../lib/ui";
import { showError } from "../lib/widgets";

// Manage → Gold Rate (pages/dashboard/sections/gold-rate.blade.php): each
// poster the admin made for this business, drawn with today's rates and its
// logo and downloaded as a PNG — the same drawing as the admin's editor.

const data = pageData("gold-posters-data");
const errorBox = $("[data-error]");

$$("[data-download-poster]").forEach((button) =>
  button.addEventListener("click", async () => {
    const template = data?.templates.find((t) => t.id === button.dataset.downloadPoster);
    if (!template) return;
    showError(errorBox, "");
    const label = $("span", button);
    button.disabled = true;
    label.textContent = "Drawing…";
    try {
      await downloadSavedTemplate(template, data.rates);
    } catch (err) {
      showError(errorBox, errorMessage(err));
    } finally {
      button.disabled = false;
      label.textContent = "Download";
    }
  }),
);
