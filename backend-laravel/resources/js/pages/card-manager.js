import { api, errorMessage } from "../lib/api";
import { cardPreviewModal } from "../lib/card-preview";
import { downloadDataUrl, renderQrDataUrl } from "../lib/channels";
import { initHotspotEditor } from "../lib/hotspot-editor";
import { $, $$, pageData } from "../lib/ui";
import { reloadWithFlash, showError } from "../lib/widgets";

// The "Visiting Card" section of a business's Manage page
// (pages/dashboard/sections/card.blade.php): the card image with its
// actions (lib/hotspot-editor.js), ready-made designs from the admin,
// publishing, and the card link's QR code.

const biz = pageData("manage-data");
const card = pageData("card-data");
const root = $("[data-card-manager]");
const errorBox = $("[data-error]");

if (root && card) {
  const base = `/businesses/${biz.id}/card`;
  const fail = (err) => {
    showError(errorBox, !err ? "" : typeof err === "string" ? err : errorMessage(err));
    if (err) errorBox?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  // --- The image and its actions --------------------------------------------
  const saveBtn = $("[data-save-card]", root);
  const dirtyNote = $("[data-dirty-note]", root);
  const editor = initHotspotEditor($("[data-hotspot-editor]", root), {
    actions: card.actions,
    fonts: card.fonts,
    defaults: card.listingDefaults,
    fallbackPrefix: "Leave empty to use your listing's: ",
    missingHint: "Your listing has none — enter one, or add it in Contact.",
    imageUrl: card.imageUrl,
    imageWidth: card.imageWidth,
    imageHeight: card.imageHeight,
    hotspots: card.hotspots,
    onChange: () => {
      saveBtn.disabled = false;
      dirtyNote.classList.remove("hidden");
    },
    onError: fail,
  });

  async function save({ reload = true } = {}) {
    const problem = editor.check();
    if (problem) {
      fail(problem);
      return false;
    }
    const body = editor.payload();
    fail("");
    saveBtn.disabled = true;
    const label = $("span", saveBtn);
    label.textContent = "Saving…";
    try {
      await api.put(base, body);
      editor.markClean();
      if (reload) reloadWithFlash("Your card is saved.");
      return true;
    } catch (err) {
      saveBtn.disabled = false;
      fail(err);
      return false;
    } finally {
      label.textContent = "Save card";
    }
  }
  saveBtn.addEventListener("click", () => save());

  window.addEventListener("beforeunload", (e) => {
    if (editor.dirty) {
      e.preventDefault();
      e.returnValue = "";
    }
  });

  // --- Ready-made designs ----------------------------------------------------
  // Picking one drops the card's own image copy, so the design's image shows.
  async function useTemplate(id, message, button) {
    if (editor.dirty && !window.confirm("Discard your unsaved changes to this card?")) return;
    fail("");
    if (button) button.disabled = true;
    try {
      await api.put(base, { templateId: id });
      editor.markClean();
      reloadWithFlash(message);
    } catch (err) {
      if (button) button.disabled = false;
      fail(err);
    }
  }
  $$("[data-use-template]", root).forEach((btn) =>
    btn.addEventListener("click", () => useTemplate(btn.dataset.useTemplate, `Your card now uses ${btn.dataset.name}.`, btn)),
  );
  $("[data-reset-image]", root)?.addEventListener("click", (e) =>
    useTemplate(card.templateId, "Your card is back to the original design.", e.currentTarget),
  );

  // --- Publish, preview, link, QR -------------------------------------------
  $$("[data-publish-card]", root).forEach((btn) =>
    btn.addEventListener("click", async () => {
      const publish = btn.dataset.publishCard === "1";
      if (publish && editor.dirty && !(await save({ reload: false }))) return;
      fail("");
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

  // The card as it is in the editor right now, saved or not, with your real details.
  $("[data-preview-card]", root)?.addEventListener("click", async (e) => {
    const body = editor.payload();
    if (!body.imageUrl) return fail("Upload your card image first.");
    fail("");
    const btn = e.currentTarget;
    btn.disabled = true;
    try {
      const { data } = await api.post(`${base}/preview`, body);
      cardPreviewModal("Your card", data.html, {
        footer: `<p class="text-center text-xs text-ink-500">Tap an action to try it — it opens in a new tab.${editor.dirty ? " Your changes aren't saved yet." : ""}</p>`,
      });
    } catch (err) {
      fail(err);
    } finally {
      btn.disabled = false;
    }
  });

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

  const qr = $("[data-card-qr]", root);
  renderQrDataUrl(card.publicUrl, 640).then((dataUrl) => {
    qr.src = dataUrl;
    $("[data-download-qr]", root)?.addEventListener("click", () => downloadDataUrl(dataUrl, `${card.slug}-card-qr.png`));
  });
}
