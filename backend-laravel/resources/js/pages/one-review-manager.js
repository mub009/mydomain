import { downloadDataUrl, renderQrDataUrl } from "../lib/channels";
import { $, pageData } from "../lib/ui";

// The "One Review" section of a business's Manage page
// (pages/dashboard/sections/one-review.blade.php): the page's link and QR code.

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
}
