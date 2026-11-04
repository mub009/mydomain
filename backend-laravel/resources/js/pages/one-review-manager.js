import { api, errorMessage } from "../lib/api";
import { downloadDataUrl, renderQrDataUrl } from "../lib/channels";
import { $, $$, pageData } from "../lib/ui";
import { showError } from "../lib/widgets";

// The "One Review" section of a business's Manage page
// (pages/dashboard/sections/one-review.blade.php): the page's link and QR
// code, and its style.

const biz = pageData("manage-data");
const data = pageData("one-review-data");
const root = $("[data-one-review]");

if (root && data) {
  const qrImg = $("[data-qr]", root);
  renderQrDataUrl(data.url, 512).then((url) => {
    qrImg.src = url;
  });
  $("[data-download-qr]", root)?.addEventListener("click", async () => {
    downloadDataUrl(await renderQrDataUrl(data.url, 1024), `${biz.slug}-one-review-qr.png`);
  });
  $("[data-copy-url]", root)?.addEventListener("click", async (e) => {
    const label = $("span", e.currentTarget);
    try {
      await navigator.clipboard.writeText(data.url);
      label.textContent = "Copied";
    } catch {
      label.textContent = "Copy failed";
    }
    setTimeout(() => (label.textContent = "Copy"), 1600);
  });

  // Page style: Save turns on once a different style is picked.
  const form = $("[data-one-style]", root);
  if (form) {
    const save = $("[data-style-save]", form);
    const saved = $("[data-style-saved]", form);
    const picked = () => $('input[name="style"]:checked', form)?.value;
    let current = picked();
    $$('input[name="style"]', form).forEach((input) =>
      input.addEventListener("change", () => {
        saved.textContent = "";
        save.disabled = picked() === current;
      }),
    );
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      showError($("[data-error]"), "");
      save.disabled = true;
      try {
        await api.put(`/businesses/${biz.id}/one-review`, { style: picked() });
        current = picked();
        saved.textContent = "Style saved.";
      } catch (err) {
        showError($("[data-error]"), errorMessage(err));
        save.disabled = false;
      }
    });
  }
}
