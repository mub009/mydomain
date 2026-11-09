import { api, errorMessage } from "../lib/api";
import { cardPreviewModal } from "../lib/card-preview";
import { applyToImage, COLOUR_DEFAULTS, isChanged, isPartial } from "../lib/card-colour";
import { openColourAreas } from "../lib/colour-areas";
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
        // Admins arrange the card freely (move, resize, remove) in a full-screen workspace;
        // dealers fill in what the design has, and just place and resize a free image.
        canDelete: !!card.imageAreaTools,
        canMove: !!card.imageAreaTools,
        freeImageEditor: !!card.imageAreaTools,
        fullScreen: !!card.imageAreaTools,
        onSave: () => save({ reload: false }),
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
  // One tap on a swatch recolours the card image and saves it — for the
  // whole business team. "Fine-tune" adjusts how strong the colour is and the
  // brightness. Shown live: on the editor's image, or (for an owner) by
  // redrawing the read-only preview.
  let colour = { ...COLOUR_DEFAULTS, ...(card.imageColourDefaults || {}), ...(card.imageColour || {}) };
  const panel = $("[data-colour-panel]", root);
  if (panel) {
    // Everything that shows the card takes the colour the instant it's picked:
    // the owner's card (its image, buttons and text — the public card is
    // coloured the same way), or the editor's image with its actions and the
    // small copy beside the colours.
    const targets = [
      readonlyPreview,
      $("[data-stage-image]", root),
      $("[data-stage-spots]", root),
      $("[data-colour-thumb]", panel),
    ].filter(Boolean);
    let previewTimer = null;
    let previewRequest = 0;
    const paint = () => {
      targets.forEach((el) => applyToImage(el, colour));
      if (!readonlyPreview) return;
      clearTimeout(previewTimer);
      if (!(isPartial(colour) && isChanged(colour))) {
        if (readonlyPreview.srcdoc !== card.previewHtml) readonlyPreview.srcdoc = card.previewHtml;
        return;
      }
      // The owner's card is a sandboxed page: a colour in marked areas only is drawn into it by the server.
      previewTimer = setTimeout(async () => {
        const request = ++previewRequest;
        try {
          const res = await api.post(`${base}/preview`, {
            imageUrl: card.imageUrl,
            imageWidth: card.imageWidth,
            imageHeight: card.imageHeight,
            hotspots: card.hotspots,
            imageColour: colour,
          });
          if (request === previewRequest) readonlyPreview.srcdoc = res.data.html;
        } catch {
          // the colour is still saved; the preview just isn't redrawn
        }
      }, 400);
    };
    const statusEl = $("[data-colour-status]", panel);
    const swatches = $$("[data-swatch]", panel);
    const customInput = $("[data-colour-custom]", panel);
    const customDot = $("[data-custom-dot]", panel);
    const slider = (name) => $(`[data-colour="${name}"]`, panel);

    // Which swatch the current colour is.
    const current = () => {
      if (!colour.tint) return colour.saturation === 0 ? "mono" : "original";
      const preset = swatches.find((s) => s.dataset.tint && s.dataset.tint.toLowerCase() === colour.tint.toLowerCase());
      return preset ? preset.dataset.swatch : "custom";
    };

    const fill = () => {
      const on = current();
      swatches.forEach((s) => s.setAttribute("aria-checked", String(s.dataset.swatch === on)));
      // The "own colour" dot shows the picked colour once there is one.
      const own = on === "custom" ? colour.tint : null;
      customDot.style.background = own || "";
      customDot.classList.toggle("border-dashed", !own);
      customDot.classList.toggle("text-ink-500", !own);
      customDot.classList.toggle("text-transparent", !!own);
      if (own) customInput.value = own;
      $("[data-strength-row]", panel).hidden = !colour.tint;
      const where = $("[data-colour-where]", panel);
      if (where) {
        const marked = (colour.areas || []).filter((a) => !a.erase).length;
        const erased = (colour.areas || []).length - marked;
        $("[data-areas-summary]", where).textContent = !isChanged(colour)
          ? "Pick a colour first, then choose where it goes."
          : isPartial(colour)
            ? `Only ${marked} marked ${marked === 1 ? "area" : "areas"}${erased ? `, ${erased} erased` : ""}`
            : "The whole card";
        $("[data-areas-clear]", where).hidden = !isPartial(colour);
        $("[data-areas-edit] span", where).textContent = isPartial(colour) ? "Change areas" : "Colour only part";
        $("[data-areas-edit]", where).disabled = !isChanged(colour);
      }
      for (const key of ["strength", "brightness"]) {
        slider(key).value = colour[key];
        $(`[data-colour-label="${key}"]`, panel).textContent = `${colour[key]}%`;
      }
    };

    // Saved a moment after the last change, so dragging a slider is one save.
    let saveTimer = null;
    let saveRequest = 0;
    const saveColour = () => {
      clearTimeout(saveTimer);
      statusEl.textContent = "Saving…";
      statusEl.className = "text-xs font-semibold text-ink-500";
      saveTimer = setTimeout(async () => {
        const request = ++saveRequest;
        try {
          await api.put(base, { imageColour: isChanged(colour) ? colour : null });
          if (request !== saveRequest) return;
          statusEl.textContent = "✓ Saved";
          statusEl.className = "text-xs font-semibold text-emerald-700";
        } catch (err) {
          statusEl.textContent = "Not saved";
          statusEl.className = "text-xs font-semibold text-red-700";
          fail(err);
        }
      }, 500);
    };

    const changed = () => {
      fill();
      paint();
      saveColour();
    };

    swatches.forEach((s) => {
      if (s.dataset.swatch === "custom") return; // the colour input inside it handles it
      s.addEventListener("click", () => {
        const tint = s.dataset.tint || null;
        // A fresh pick starts from the plain image, keeping any brightness the person chose.
        colour = {
          ...COLOUR_DEFAULTS,
          areas: colour.areas || [],
          brightness: colour.brightness,
          strength: colour.tint ? colour.strength : 60,
          tint,
          saturation: Number(s.dataset.saturation),
        };
        changed();
      });
    });
    customInput.addEventListener("input", (e) => {
      colour = { ...colour, tint: e.target.value, hue: 0, saturation: 100 };
      changed();
    });
    for (const key of ["strength", "brightness"]) {
      slider(key).addEventListener("input", (e) => {
        colour[key] = Number(e.target.value);
        changed();
      });
    }

    $("[data-areas-edit]", panel)?.addEventListener("click", () =>
      openColourAreas({
        imageUrl: card.imageUrl,
        ratio: card.imageWidth && card.imageHeight ? card.imageWidth / card.imageHeight : 0.6,
        colour,
        onDone: (areas) => {
          colour = { ...colour, areas };
          changed();
        },
      }),
    );
    $("[data-areas-clear]", panel)?.addEventListener("click", () => {
      colour = { ...colour, areas: [] };
      changed();
    });

    fill();
    paint();
  }

  // --- Missing details, typed in here ---------------------------------------
  // Saved to the listing (or its social links); the card then shows them.
  $$("[data-missing-form]", root).forEach((form) =>
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const input = $("input", form);
      const button = $("[data-missing-save]", form);
      const value = input.value.trim();
      if (!value) return input.focus();
      // Unsaved changes in the card editor go first, so the reload keeps them.
      if (editor?.dirty && !(await save({ reload: false }))) return;
      fail("");
      button.disabled = true;
      button.textContent = "Saving…";
      try {
        const path = form.dataset.via === "links" ? `/businesses/${biz.id}/review-links` : `/businesses/${biz.id}`;
        await api.patch(path, { [input.name]: value });
        reloadWithFlash(`${$("label", form).textContent.trim()} saved — it's on your card now.`);
      } catch (err) {
        button.disabled = false;
        button.textContent = "Save";
        fail(err);
      }
    }),
  );

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
      if (!card.imageUrl) return fail("Your card design isn't set up yet.");
      const btn = e.currentTarget;
      btn.disabled = true;
      try {
        const { data } = await api.post(`${base}/preview`, {
          imageUrl: card.imageUrl,
          imageWidth: card.imageWidth,
          imageHeight: card.imageHeight,
          hotspots: card.hotspots,
          imageColour: colour,
        });
        cardPreviewModal("Your card", data.html, {
          footer: `<p class="text-center text-xs text-ink-500">Tap an action to try it — it opens in a new tab.</p>`,
        });
      } catch (err) {
        fail(err);
      } finally {
        btn.disabled = false;
      }
      return;
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

  // --- Multi card view ---------------------------------------------------------
  // The card link shows the card, then the designs ticked here, as a slider.
  // Saved on each change; all ticked is sent as null (= every design, new ones too).
  const multi = $("[data-multi-view]", root);
  if (multi) {
    const toggle = $("[data-multi-toggle]", multi);
    const grid = $("[data-multi-designs]", multi);
    const boxes = $$("[data-multi-design]", multi);
    const status = $("[data-multi-status]", multi);
    const setStatus = (text, tone) => {
      status.textContent = text;
      status.className = `mt-2 text-xs font-semibold ${tone}`;
    };
    let request = 0;
    const saveMulti = async () => {
      const picked = boxes.filter((b) => b.checked).map((b) => b.value);
      if (toggle.checked && !picked.length) return setStatus("Pick at least one design.", "text-red-700");
      const mine = ++request;
      setStatus("Saving…", "text-ink-500");
      try {
        await api.put(base, {
          multiView: toggle.checked,
          extraTemplateIds: picked.length === boxes.length ? null : picked,
        });
        if (mine === request) setStatus("✓ Saved", "text-emerald-700");
      } catch (err) {
        if (mine === request) setStatus("Not saved", "text-red-700");
        fail(err);
      }
    };
    toggle.addEventListener("change", () => {
      grid.hidden = !toggle.checked;
      saveMulti();
    });
    boxes.forEach((b) => b.addEventListener("change", saveMulti));
  }

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
