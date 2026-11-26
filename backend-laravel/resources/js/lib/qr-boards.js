// QR boards: the printable sheet (each QR with its own Download, Download all
// as a ZIP, and a share link for WhatsApp), the PNG buttons on the list, and
// "Generate boards". Used by the admin's QR Boards tab and a dealer's.
import { api, errorMessage } from "./api";
import { boardHeadline, boardUrl, downloadDataUrl, renderQrDataUrl } from "./channels";
import { icon } from "./icons";
import { $, $$, alertBox, esc, openModal } from "./ui";
import { reloadWithFlash } from "./widgets";

// A printable sheet of boards, each showing its QR and the code beneath it so a
// shop can still type it in if the camera struggles.
export function printSheet(codes, purpose, onClose) {
  const list = encodeURIComponent(codes.join(","));
  const modal = openModal(
    `${codes.length} QR ${codes.length === 1 ? "board" : "boards"} ready to print`,
    `<p class="mb-3 text-sm text-ink-600">Print these and hand them out. Each board waits until it is attached to a shop; then a scan opens what it was set to (Google review, AI review, social media…).</p>
    <a href="/qr-codes.zip?codes=${list}" class="btn-secondary mb-3 w-full py-2.5" data-download-all>${icon("download", { size: 15 })} Download all (ZIP of ${codes.length} QR ${codes.length === 1 ? "image" : "images"})</a>
    <div class="mb-3 rounded-xl border border-green-200 bg-green-50 p-3 print:hidden" data-share-box>
      <p class="text-xs font-semibold text-green-900">Share these QR codes as a link</p>
      <p class="mb-2 text-[11px] text-green-800">Whoever opens the link sees every QR and can download each one.</p>
      <input class="input mb-2 bg-white font-mono text-[11px]" readonly data-share-url value="Making the link…" />
      <div class="grid grid-cols-3 gap-2">
        <a class="btn-primary !bg-green-600 py-2 text-xs hover:!bg-green-700" target="_blank" rel="noopener" data-share-whatsapp>${icon("share-2", { size: 13 })} WhatsApp</a>
        <button type="button" class="btn-secondary py-2 text-xs" data-share-copy>${icon("copy", { size: 13 })} <span>Copy link</span></button>
        <a class="btn-secondary py-2 text-xs" target="_blank" rel="noopener" data-share-open>${icon("external-link", { size: 13 })} Open</a>
      </div>
    </div>
    <div id="qr-board" class="grid grid-cols-2 gap-4"><p class="col-span-2 py-6 text-center text-sm text-ink-500">Rendering codes…</p></div>
    <button type="button" data-print class="btn-primary mt-4 w-full py-2.5">${icon("printer", { size: 15 })} Print sheet</button>`,
    { onClose },
  );
  // The shareable link for these boards (signed by the server), for WhatsApp.
  const shareBox = $("[data-share-box]", modal.body);
  fetch(`/qr-codes/share-link?codes=${list}`, { headers: { Accept: "application/json" } })
    .then((r) => (r.ok ? r.json() : Promise.reject(r)))
    .then(({ url }) => {
      $("[data-share-url]", shareBox).value = url;
      const text = `Markkito QR boards (${codes.length}): open the link to see and download each QR code ${url}`;
      $("[data-share-whatsapp]", shareBox).href = `https://wa.me/?text=${encodeURIComponent(text)}`;
      $("[data-share-open]", shareBox).href = url;
      $("[data-share-copy]", shareBox).addEventListener("click", async (e) => {
        const label = $("span", e.currentTarget);
        try {
          await navigator.clipboard.writeText(url);
        } catch {
          $("[data-share-url]", shareBox).select();
          document.execCommand("copy");
        }
        label.textContent = "Copied";
        setTimeout(() => (label.textContent = "Copy link"), 2000);
      });
    })
    .catch(() => ($("[data-share-url]", shareBox).value = "Couldn't make the link — try again."));
  Promise.all(codes.map((code) => renderQrDataUrl(boardUrl(code), 320).then((dataUrl) => ({ code, dataUrl }))))
    .then((images) => {
      $("#qr-board", modal.body).innerHTML = images
        .map(
          (item) => `<div class="rounded-xl border-2 border-dashed border-gray-200 p-3 text-center">
          <p class="text-[9px] font-bold uppercase tracking-widest text-brand-600">Loved your visit?</p>
          <p class="text-[11px] font-semibold text-ink-700">${esc(boardHeadline(purpose))}</p>
          <img src="${item.dataUrl}" alt="${esc(item.code)}" class="mx-auto my-1.5 h-28 w-28" />
          <p class="font-mono text-xs font-bold text-ink-900">${esc(item.code)}</p>
          <p class="text-[8px] uppercase tracking-wider text-ink-400">Powered by Markkito</p>
          <button type="button" class="mt-1.5 inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-brand-700 hover:bg-brand-50 print:hidden" data-download-one="${esc(item.code)}">${icon("download", { size: 12 })} Download</button>
        </div>`,
        )
        .join("");
      // Each QR on its own, as a large PNG named by its code.
      $$("[data-download-one]", modal.body).forEach((b) =>
        b.addEventListener("click", () =>
          renderQrDataUrl(boardUrl(b.dataset.downloadOne))
            .then((d) => downloadDataUrl(d, `${b.dataset.downloadOne}-qr.png`))
            .catch(() => undefined),
        ),
      );
    })
    .catch(() => undefined);
  $("[data-print]", modal.body).addEventListener("click", () => window.print());
}

// batchUrl: where "Generate boards" posts; max: the most boards in one batch.
export function initQrBoards({ batchUrl, max, onError }) {
  $$("[data-print-codes]").forEach((button) =>
    button.addEventListener("click", () => printSheet(JSON.parse(button.dataset.printCodes), button.dataset.purpose || null)),
  );
  $$("[data-qr-png]").forEach((button) =>
    button.addEventListener("click", () =>
      renderQrDataUrl(boardUrl(button.dataset.qrPng))
        .then((d) => downloadDataUrl(d, `${button.dataset.qrPng}-qr.png`))
        .catch(() => onError?.("Could not generate that QR image.")),
    ),
  );
  $("[data-generate-boards]")?.addEventListener("click", () => {
    const modal = openModal(
      "Generate QR boards",
      `<form class="space-y-3">
        <div data-form-error></div>
        <p class="text-sm text-ink-600">Each board gets its own number (MK-100001, MK-100002…). Print them and hand them out — what a board opens (Google review, AI review, social media…) is chosen when it is attached to a shop.</p>
        <div>
          <label class="mb-1 block text-xs font-semibold text-ink-700">How many boards? (max ${max})</label>
          <input required type="number" min="1" max="${max}" class="input" name="count" value="${Math.min(20, max)}" />
        </div>
        <div>
          <label class="mb-1 block text-xs font-semibold text-ink-700">Batch label (optional)</label>
          <input class="input" name="batchLabel" placeholder="e.g. Kochi run 1" />
        </div>
        <button class="btn-primary w-full py-2.5" data-submit>Generate ${Math.min(20, max)} boards</button>
      </form>`,
    );
    const form = $("form", modal.body);
    const submit = $("[data-submit]", form);
    form.count.addEventListener("input", () => (submit.textContent = `Generate ${form.count.value || 0} boards`));
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      submit.disabled = true;
      submit.textContent = "Generating…";
      $("[data-form-error]", form).innerHTML = "";
      try {
        // No purpose is set here: a blank board works for any shop, and what it
        // points at is chosen by the dealer or shop when they attach it.
        const { data: result } = await api.post(batchUrl, {
          count: Number(form.count.value),
          batchLabel: form.batchLabel.value || undefined,
        });
        modal.close();
        // The new boards print straight away; the list refreshes once the
        // sheet is closed.
        printSheet(result.codes, null, () => reloadWithFlash(`Generated ${result.created} new QR boards.`));
      } catch (err) {
        $("[data-form-error]", form).innerHTML = alertBox(errorMessage(err));
        submit.disabled = false;
        submit.textContent = `Generate ${form.count.value || 0} boards`;
      }
    });
  });
}
