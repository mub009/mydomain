import { api, errorMessage } from "../lib/api";
import { cardPreviewModal } from "../lib/card-preview";
import { downloadDataUrl, renderQrDataUrl } from "../lib/channels";
import { $, $$, pageData } from "../lib/ui";
import { reloadWithFlash, showError } from "../lib/widgets";

// The "Visiting Card" section of a business's Manage page
// (pages/dashboard/sections/card.blade.php): switch designs, preview,
// publish, and the card link's QR code.

const biz = pageData("manage-data");
const card = pageData("card-data");
const root = $("[data-card-manager]");
const errorBox = $("[data-error]");

if (root && card) {
  const base = `/businesses/${biz.id}/card`;
  const fail = (err) => {
    showError(errorBox, errorMessage(err));
    errorBox.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  async function useTemplate(id, button) {
    showError(errorBox, "");
    if (button) {
      button.disabled = true;
      button.textContent = "Applying…";
    }
    try {
      await api.put(base, { templateId: id });
      const name = card.templates.find((t) => t.id === id)?.name ?? "the new design";
      reloadWithFlash(`Your card now uses ${name}. Your details are unchanged.`);
    } catch (err) {
      if (button) {
        button.disabled = false;
        button.textContent = "Use this";
      }
      fail(err);
    }
  }

  $$("[data-use-template]", root).forEach((btn) => btn.addEventListener("click", () => useTemplate(btn.dataset.useTemplate, btn)));

  // Full-size preview, with "Use this design" when it isn't the current one.
  $$("[data-preview-template]", root).forEach((btn) =>
    btn.addEventListener("click", () => {
      const id = btn.dataset.previewTemplate;
      const template = card.templates.find((t) => t.id === id);
      const html = $(`[data-template-frame="${id}"]`, root)?.srcdoc;
      if (!template || !html) return;
      const canUse = id !== card.templateId && !template.locked;
      const footer = canUse
        ? `<div class="flex justify-center"><button type="button" class="btn-primary px-5 py-2.5 text-sm" data-modal-use>Use this design</button></div>`
        : template.locked
          ? `<p class="text-center text-sm text-amber-700">This premium design needs a paid plan.</p>`
          : "";
      const modal = cardPreviewModal(template.name, html, { footer });
      $("[data-modal-use]", modal.body)?.addEventListener("click", (e) => useTemplate(id, e.currentTarget));
    }),
  );

  $$("[data-publish-card]", root).forEach((btn) =>
    btn.addEventListener("click", async () => {
      const publish = btn.dataset.publishCard === "1";
      showError(errorBox, "");
      btn.disabled = true;
      try {
        const { data } = await api.post(`${base}/publish`, { isPublished: publish });
        reloadWithFlash(
          !publish
            ? "Your card is no longer public."
            : data.live
              ? "Your card is live. Share the link or print the QR code."
              : "Card published. It goes live as soon as your listing is approved.",
        );
      } catch (err) {
        btn.disabled = false;
        fail(err);
      }
    }),
  );

  $("[data-copy-card]", root)?.addEventListener("click", async (e) => {
    const label = $("span", e.currentTarget);
    try {
      await navigator.clipboard.writeText(card.publicUrl);
      label.textContent = "Copied";
    } catch {
      $("[data-card-url]", root).select();
      label.textContent = "Press Ctrl+C";
    }
    setTimeout(() => (label.textContent = "Copy"), 2000);
  });

  // --- AI background ---------------------------------------------------------
  // Generated for this business (not saved yet): previewed on the card in
  // use, then kept with "Use this background".
  const generateBtn = $("[data-generate-background]", root);
  const hintInput = $("[data-ai-hint]", root);
  async function generateBackground() {
    showError(errorBox, "");
    const label = $("span", generateBtn);
    const before = label.textContent;
    generateBtn.disabled = true;
    label.textContent = "Painting… (up to a minute)";
    try {
      const { data } = await api.post(`${base}/background`, {
        templateId: card.templateId,
        hint: hintInput.value.trim() || undefined,
        style: $('[name="aiStyle"]:checked', root)?.value,
      });
      const note = data.source === "builtin" ? `<p class="text-center text-xs text-ink-500">Made with the built-in generator.</p>` : "";
      const modal = cardPreviewModal("Your new background", data.previewHtml, {
        footer: `${note}<div class="flex flex-wrap justify-center gap-2">
            <button type="button" class="btn-secondary px-4 py-2 text-sm" data-again>Try another</button>
            <button type="button" class="btn-primary px-5 py-2 text-sm" data-keep>Use this background</button>
          </div>`,
      });
      $("[data-again]", modal.body).addEventListener("click", () => {
        modal.close();
        generateBackground();
      });
      $("[data-keep]", modal.body).addEventListener("click", async (e) => {
        e.currentTarget.disabled = true;
        try {
          await api.put(base, { backgroundImageUrl: data.url });
          reloadWithFlash("New background saved on your card.");
        } catch (err) {
          modal.close();
          fail(err);
        }
      });
    } catch (err) {
      fail(err);
    } finally {
      generateBtn.disabled = false;
      label.textContent = before;
    }
  }
  generateBtn?.addEventListener("click", generateBackground);

  $("[data-remove-background]", root)?.addEventListener("click", async () => {
    try {
      await api.put(base, { backgroundImageUrl: null });
      reloadWithFlash("Background removed. Your card uses its design's own background again.");
    } catch (err) {
      fail(err);
    }
  });

  // The QR code holds the card link, so a scan opens the card.
  const qr = $("[data-card-qr]", root);
  renderQrDataUrl(card.publicUrl, 640).then((dataUrl) => {
    qr.src = dataUrl;
    $("[data-download-qr]", root)?.addEventListener("click", () => downloadDataUrl(dataUrl, `${card.slug}-card-qr.png`));
  });
}
