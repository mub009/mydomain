import { api, errorMessage } from "../lib/api";
import { $, pageData } from "../lib/ui";

// An admin's CSS override for one website template — a full-screen editor:
// a CSS textarea on the left, a live preview (a real business's page,
// rendered with the draft CSS) on the right. Saving is explicit; the
// preview refreshes as you type, debounced, without saving anything.

const { templateId } = pageData("site-template-editor-data");
const base = `/admin/site-templates/${templateId}`;
const root = $("[data-template-editor]");
const textarea = $("[data-css]", root);
const iframe = $("[data-preview]", root);
const status = $("[data-status]", root);
const errorBox = $("[data-error]", root);

function setStatus(text) {
  status.textContent = text;
}

function showError(message) {
  errorBox.textContent = message;
  errorBox.hidden = !message;
}

// A template rendered into a standalone document — the same shell the
// per-business builder's own preview uses, so this shows exactly what a
// visitor would see.
function previewDocument(draft) {
  return `<!doctype html><html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
*{box-sizing:border-box}
body{margin:0}
#mk-site-root{display:block;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#1a1a1a;line-height:1.5;background:#fff}
#mk-site-root img{max-width:100%}
${draft.css}
</style></head><body><div id="mk-site-root">${draft.html}</div></body></html>`;
}

let previewTimer = null;
async function refreshPreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(async () => {
    try {
      const { data } = await api.post(`${base}/preview`, { customCss: textarea.value });
      iframe.srcdoc = previewDocument(data);
      showError("");
    } catch (err) {
      showError(errorMessage(err));
    }
  }, 400);
}

textarea.addEventListener("input", refreshPreview);

$("[data-save]", root).addEventListener("click", async () => {
  setStatus("Saving…");
  try {
    const { data } = await api.put(base, { customCss: textarea.value });
    setStatus(`Saved${data.updatedAt ? " · " + new Date(data.updatedAt).toLocaleString() : ""}`);
    showError("");
  } catch (err) {
    setStatus("");
    showError(errorMessage(err));
  }
});

(async function init() {
  try {
    const { data } = await api.get(base);
    textarea.value = data.customCss || "";
    setStatus(data.updatedAt ? `Last saved ${new Date(data.updatedAt).toLocaleString()}` : "Never saved");
  } catch (err) {
    showError(errorMessage(err));
  }
  refreshPreview();
})();
