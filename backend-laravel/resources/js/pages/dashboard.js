import { api, errorMessage } from "../lib/api";
import { initCommissionCharts } from "../lib/commission-charts";
import { icon } from "../lib/icons";
import { $, $$, esc } from "../lib/ui";
import { copyField, initCloneButtons, initLiveSearch, resetPasswordModal, showFlash, statusBadgeClass, whatsappShareButton } from "../lib/widgets";

showFlash();
initCloneButtons();
// The Listings and Business logins search boxes.
initLiveSearch();

// Credentials of a business login created just before this page load.
(function ownerCreds() {
  let creds = null;
  try {
    creds = JSON.parse(sessionStorage.getItem("mk-owner-creds") || "null");
    sessionStorage.removeItem("mk-owner-creds");
  } catch {
    creds = null;
  }
  const target = $("[data-owner-creds]");
  if (!creds || !target) return;
  target.innerHTML = `<div class="rounded-xl border border-emerald-200 bg-emerald-50 p-4 mb-4">
    <div class="flex items-start justify-between gap-3">
      <p class="min-w-0 break-words font-bold text-emerald-800 flex items-start gap-1.5"><span class="mt-0.5 shrink-0">${icon("key-round", { size: 16 })}</span> <span class="min-w-0">Login for “${esc(creds.businessName)}”</span></p>
      <button type="button" data-dismiss-creds class="shrink-0 text-xs text-emerald-700/70 hover:text-emerald-900 underline">Dismiss</button>
    </div>
    <p class="text-xs text-emerald-700/90 mt-1 mb-3">${
      creds.created
        ? "A welcome email with these login details has been sent to the owner. You can also share them directly — the password won't be shown here again."
        : "This listing was linked to an existing account — the business team signs in with the username below and their existing password. A welcome email has been sent."
    }</p>
    <div class="space-y-2.5">
      ${copyField("Username", creds.username)}
      ${creds.created ? copyField("Password", creds.password) : ""}
      ${whatsappShareButton({
        businessName: creds.businessName,
        username: creds.username,
        password: creds.created ? creds.password : "",
        phone: creds.phone,
      })}
    </div>
  </div>`;
  $("[data-dismiss-creds]", target).addEventListener("click", () => (target.innerHTML = ""));
})();

// --- Created accounts -------------------------------------------------------
$$("[data-reset-password]").forEach((button) =>
  button.addEventListener("click", () => resetPasswordModal(JSON.parse(button.dataset.resetPassword))),
);

// --- Lead / booking status --------------------------------------------------
$$("[data-status-update]").forEach((select) => {
  let previous = select.value;
  select.addEventListener("change", async () => {
    try {
      await api.patch(select.dataset.statusUpdate, { status: select.value });
      select.className = `badge border-0 shrink-0 ${statusBadgeClass(select.value)}`;
      previous = select.value;
    } catch (err) {
      select.value = previous;
      select.title = errorMessage(err);
    }
  });
});

// Commission charts (Commission tab).
initCommissionCharts();
