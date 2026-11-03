import { openModal } from "./ui";

// Full-size preview of a digital visiting card (CardEngine::render's HTML),
// in a phone-shaped frame with a switch to a wider screen. The HTML is
// rendered in a sandboxed iframe, so its links do nothing here.
export function cardPreviewModal(title, html, { footer = "" } = {}) {
  const modal = openModal(
    title,
    `<div class="space-y-3">
      <div class="flex justify-center gap-1 text-xs font-semibold" data-frame-sizes>
        <button type="button" class="rounded-full bg-ink-900 px-3 py-1 text-white" data-size="phone">Phone</button>
        <button type="button" class="rounded-full bg-gray-100 px-3 py-1 text-ink-700" data-size="wide">Wide screen</button>
      </div>
      <div class="flex justify-center">
        <iframe sandbox="allow-popups allow-popups-to-escape-sandbox" title="Card preview" class="h-[640px] w-[390px] max-w-full rounded-[28px] border-[6px] border-ink-900 bg-white shadow-lg transition-all" data-preview-frame></iframe>
      </div>
      ${footer}
    </div>`,
    { wide: true },
  );
  const frame = modal.body.querySelector("[data-preview-frame]");
  frame.srcdoc = html;
  modal.body.querySelectorAll("[data-size]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const wide = btn.dataset.size === "wide";
      frame.className = wide
        ? "h-[600px] w-full rounded-xl border border-gray-200 bg-white transition-all"
        : "h-[640px] w-[390px] max-w-full rounded-[28px] border-[6px] border-ink-900 bg-white shadow-lg transition-all";
      modal.body.querySelectorAll("[data-size]").forEach((b) => {
        b.className = `rounded-full px-3 py-1 ${b === btn ? "bg-ink-900 text-white" : "bg-gray-100 text-ink-700"}`;
      });
    }),
  );
  return modal;
}
