import { api, errorMessage } from "../lib/api";
import { cardPreviewModal } from "../lib/card-preview";
import { downloadDataUrl, renderQrDataUrl } from "../lib/channels";
import { $, $$, pageData } from "../lib/ui";
import { reloadWithFlash, showError } from "../lib/widgets";

// The "Visiting Card" section of a business's Manage page
// (pages/dashboard/sections/card.blade.php): the card as it looks,
// ready-made designs from the admin, publishing, and (under "More details")
// the card link and its QR code.

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

  // --- The card as it looks (read-only; its colour is changed on the card page) ---
  const readonlyPreview = $("[data-card-readonly-preview]", root);
  if (readonlyPreview && card.previewHtml) readonlyPreview.srcdoc = card.previewHtml; // a property, never innerHTML
  const colour = card.imageColour || null;

  // --- Ready-made designs ----------------------------------------------------
  // Picking one drops the card's own image copy, so the design's image shows.
  async function useTemplate(id, message, button) {
    fail("");
    if (button) button.disabled = true;
    try {
      await api.put(base, { templateId: id });
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

  // --- Missing details, typed in here ---------------------------------------
  // Saved to the listing (or its social links); the card then shows them.
  $$("[data-missing-form]", root).forEach((form) =>
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      // A textbox, a textarea, or the link box of the logo upload.
      const input = $("[data-upload-url], textarea[name], input[name]", form);
      const button = $("[data-missing-save]", form);
      const value = input.value.trim();
      if (!value) return input.focus();
      fail("");
      button.disabled = true;
      button.textContent = "Saving…";
      try {
        if (form.dataset.via === "spot") {
          // A free-image spot: the picture goes on the card itself.
          await api.put(base, { spotImage: { id: form.dataset.spot, url: value } });
        } else {
          const path = form.dataset.via === "links" ? `/businesses/${biz.id}/review-links` : `/businesses/${biz.id}`;
          await api.patch(path, { [input.name]: value });
        }
        reloadWithFlash(`${$("label", form).textContent.trim()} saved — it's on your card now.`);
      } catch (err) {
        button.disabled = false;
        button.textContent = "Save";
        fail(err);
      }
    }),
  );
  // An uploaded logo is saved at once — no need to press Save.
  $$("[data-missing-form] [data-upload-field]", root).forEach((field) =>
    field.addEventListener("upload:done", () => field.closest("form").requestSubmit()),
  );

  // --- Publish, preview, link, QR -------------------------------------------
  $$("[data-publish-card]", root).forEach((btn) =>
    btn.addEventListener("click", async () => {
      const publish = btn.dataset.publishCard === "1";
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

  // The card with your real details, in a pop-up.
  $("[data-preview-card]", root)?.addEventListener("click", async (e) => {
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
