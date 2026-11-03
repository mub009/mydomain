import { api, errorMessage } from "../lib/api";
import { cardPreviewModal } from "../lib/card-preview";
import { applyToImage, COLOUR_DEFAULTS, isChanged } from "../lib/card-colour";
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
  // Only dealers and admins edit the design; a business owner sees it read-only.
  const saveBtn = $("[data-save-card]", root);
  const dirtyNote = $("[data-dirty-note]", root);
  const editorEl = card.canEdit ? $("[data-hotspot-editor]", root) : null;
  const editor = editorEl
    ? initHotspotEditor(editorEl, {
        actions: card.actions,
        fonts: card.fonts,
        defaults: card.listingDefaults,
        fallbackPrefix: "Leave empty to use your listing's: ",
        missingHint: "Your listing has none — enter one, or add it in Contact.",
        imageUrl: card.imageUrl,
        imageWidth: card.imageWidth,
        imageHeight: card.imageHeight,
        hotspots: card.hotspots,
        canReplaceImage: false,
        canDelete: false,
        onChange: () => {
          saveBtn.disabled = false;
          dirtyNote.classList.remove("hidden");
        },
        onError: fail,
      })
    : null;
  const readonlyPreview = $("[data-card-readonly-preview]", root);
  if (readonlyPreview && card.previewHtml) readonlyPreview.srcdoc = card.previewHtml; // a property, never innerHTML

  async function save({ reload = true } = {}) {
    if (!editor) return true;
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
  saveBtn?.addEventListener("click", () => save());

  window.addEventListener("beforeunload", (e) => {
    if (editor?.dirty) {
      e.preventDefault();
      e.returnValue = "";
    }
  });

  // --- Ready-made designs ----------------------------------------------------
  // Picking one drops the card's own image copy, so the design's image shows.
  async function useTemplate(id, message, button) {
    if (editor?.dirty && !window.confirm("Discard your unsaved changes to this card?")) return;
    fail("");
    if (button) button.disabled = true;
    try {
      await api.put(base, { templateId: id });
      editor?.markClean();
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

  // --- Card colour -----------------------------------------------------------
  // Tint, hue, brightness and saturation of the card image, for the whole
  // business team. Shown live: on the editor's image, or (for an owner) by
  // redrawing the read-only preview.
  let colour = { ...COLOUR_DEFAULTS, ...(card.imageColourDefaults || {}), ...(card.imageColour || {}) };
  const panel = $("[data-colour-panel]", root);
  if (panel) {
    const field = (name) => $(`[data-colour="${name}"]`, panel);
    const colourSave = $("[data-colour-save]", panel);
    const colourDirty = $("[data-colour-dirty]", panel);
    const stageImage = $("[data-stage-image]", root);
    let lastTint = colour.tint || "#2563eb";

    const fill = () => {
      field("useTint").checked = !!colour.tint;
      field("tint").value = lastTint;
      field("tint").disabled = !colour.tint;
      field("strength").disabled = !colour.tint;
      for (const key of ["strength", "hue", "brightness", "saturation"]) {
        field(key).value = colour[key];
        const label = $(`[data-colour-label="${key}"]`, panel);
        label.textContent = `${key === "hue" && colour.hue > 0 ? "+" : ""}${colour[key]}${label.dataset.unit || "%"}`;
      }
    };

    let previewTimer = null;
    let previewRequest = 0;
    const show = () => {
      if (stageImage) applyToImage(stageImage, colour);
      if (!readonlyPreview || !card.imageUrl) return;
      clearTimeout(previewTimer);
      previewTimer = setTimeout(async () => {
        const request = ++previewRequest;
        try {
          const { data } = await api.post(`${base}/preview`, {
            imageUrl: card.imageUrl,
            imageWidth: card.imageWidth,
            imageHeight: card.imageHeight,
            hotspots: card.hotspots,
            imageColour: colour,
          });
          if (request === previewRequest) {
            readonlyPreview.srcdoc = data.html;
            card.previewHtml = data.html; // the Preview button shows it too
          }
        } catch (err) {
          fail(err);
        }
      }, 250);
    };

    const changedColour = () => {
      fill();
      show();
      colourSave.disabled = false;
      colourDirty.classList.remove("hidden");
    };

    field("useTint").addEventListener("change", (e) => {
      colour.tint = e.target.checked ? lastTint : null;
      changedColour();
    });
    field("tint").addEventListener("input", (e) => {
      lastTint = e.target.value;
      colour.tint = lastTint;
      changedColour();
    });
    for (const key of ["strength", "hue", "brightness", "saturation"]) {
      field(key).addEventListener("input", (e) => {
        colour[key] = Number(e.target.value);
        changedColour();
      });
    }
    $("[data-colour-reset]", panel).addEventListener("click", () => {
      colour = { ...COLOUR_DEFAULTS };
      changedColour();
    });

    colourSave.addEventListener("click", async () => {
      fail("");
      colourSave.disabled = true;
      const label = $("span", colourSave);
      label.textContent = "Saving…";
      try {
        await api.put(base, { imageColour: isChanged(colour) ? colour : null });
        colourDirty.classList.add("hidden");
        label.textContent = "Saved";
        setTimeout(() => (label.textContent = "Save colour"), 1500);
      } catch (err) {
        colourSave.disabled = false;
        label.textContent = "Save colour";
        fail(err);
      }
    });

    fill();
    if (stageImage) applyToImage(stageImage, colour);
  }

  // --- Publish, preview, link, QR -------------------------------------------
  $$("[data-publish-card]", root).forEach((btn) =>
    btn.addEventListener("click", async () => {
      const publish = btn.dataset.publishCard === "1";
      if (publish && editor?.dirty && !(await save({ reload: false }))) return;
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
    if (!editor) {
      if (!card.previewHtml) return fail("Your card design isn't set up yet.");
      return cardPreviewModal("Your card", card.previewHtml, {
        footer: `<p class="text-center text-xs text-ink-500">Tap an action to try it — it opens in a new tab.</p>`,
      });
    }
    const body = { ...editor.payload(), imageColour: colour };
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
