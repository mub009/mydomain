import { api, errorMessage } from "../lib/api";
import { downloadDataUrl, renderQrDataUrl } from "../lib/channels";
import { $, $$, pageData } from "../lib/ui";
import { showError } from "../lib/widgets";

// The "AI Google Review" section of a business's Manage page
// (pages/dashboard/sections/ai-review.blade.php): the review page's link
// and QR code, what the AI's reviews mention, and a sample review.

const biz = pageData("manage-data");
const data = pageData("ai-review-data");
const root = $("[data-ai-review]");

if (root && data) {
  const base = `/businesses/${biz.id}/ai-review`;
  const errorBox = $("[data-error]", root);
  const fail = (err) => showError(errorBox, err ? errorMessage(err) : "");

  // The link and its QR code.
  const qrImg = $("[data-qr]", root);
  renderQrDataUrl(data.url, 512).then((url) => {
    qrImg.src = url;
  });
  $("[data-download-qr]", root)?.addEventListener("click", async () => {
    downloadDataUrl(await renderQrDataUrl(data.url, 1024), `${biz.slug}-google-review-qr.png`);
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

  // Settings.
  const form = $("[data-ai-settings]", root);
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    fail(null);
    const languages = $$('input[name="languages"]:checked', form).map((i) => i.value);
    if (!languages.length) return showError(errorBox, "Choose at least one language.");
    const button = $('button[type="submit"]', form);
    button.disabled = true;
    try {
      const res = await api.put(base, {
        highlights: form.highlights.value.trim(),
        languages,
        tone: form.tone.value,
        length: form.length.value,
        keywords: form.keywords.value.trim(),
        staff: form.staff.value.trim(),
        avoid: form.avoid.value.trim(),
        emoji: form.emoji.checked,
      });
      // The sample's language list follows what is offered.
      const select = $("[data-sample-language]", root);
      const options = res.data.languageOptions.filter((l) => res.data.languages.includes(l.code));
      select.innerHTML = options.map((l) => `<option value="${l.code}">${l.name}</option>`).join("");
      $("[data-saved]", form).textContent = "Saved";
      setTimeout(() => ($("[data-saved]", form).textContent = ""), 2000);
    } catch (err) {
      fail(err);
    } finally {
      button.disabled = false;
    }
  });

  // Try it.
  const go = $("[data-sample-go]", root);
  const out = $("[data-sample-text]", root);
  go?.addEventListener("click", async () => {
    fail(null);
    go.disabled = true;
    $("span", go).textContent = "Writing…";
    try {
      const res = await api.post(`${base}/sample`, {
        rating: Number($("[data-sample-rating]", root).value),
        language: $("[data-sample-language]", root).value,
      });
      out.textContent = res.data.review;
      out.classList.remove("hidden");
    } catch (err) {
      fail(err);
    } finally {
      go.disabled = false;
      $("span", go).textContent = "Write another";
    }
  });
}
