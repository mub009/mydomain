import { initAiDescription } from "../lib/ai-describe";
import { api, errorMessage } from "../lib/api";
import { icon } from "../lib/icons";
import { $, $$, esc, pageData } from "../lib/ui";
import { copyField, generatePassword, initCloneButtons, initLiveSearch, reloadWithFlash, resetPasswordModal, showError, showFlash, statusBadgeClass } from "../lib/widgets";

const data = pageData("dashboard-data") ?? {};
showFlash();
initCloneButtons();
// The Listings and Business logins search boxes.
initLiveSearch();

// --- Add business -----------------------------------------------------------
const form = $("[data-create-business]");
const toggle = $("[data-toggle-create]");

function setCreateOpen(open) {
  form.hidden = !open;
  toggle.classList.toggle("btn-primary", !open);
  toggle.classList.toggle("btn-secondary", open);
  $('[data-when="closed"]', toggle).hidden = open;
  $('[data-when="open"]', toggle).hidden = !open;
  $("[data-empty-listings]")?.toggleAttribute("hidden", open);
  showError($("[data-create-error]", form), "");
  // Out of points only blocks opening the form, never closing it.
  if (open) toggle.disabled = false;
}
toggle?.addEventListener("click", () => setCreateOpen(form.hidden));

const withOwner = form ? $("[data-with-owner]", form) : null;
function syncOwnerFields() {
  if (!withOwner) return;
  $("[data-owner-fields]", form).hidden = !withOwner.checked;
  $("[data-owner-off]", form).hidden = withOwner.checked;
  $$("[data-owner-required]", form).forEach((input) => (input.required = withOwner.checked));
}
withOwner?.addEventListener("change", syncOwnerFields);
syncOwnerFields();
$("[data-generate-password]", form ?? document)?.addEventListener("click", () => (form.ownerPassword.value = generatePassword()));

// The page link is made from the business name on the server; preview it
// here. If the name is taken the server adds -2, -3, ... to keep it unique.
const slugSource = form ? $("[data-slug-source]", form) : null;
slugSource?.addEventListener("input", () => {
  const slug = slugSource.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  $("[data-slug-preview]", form).hidden = !slug;
  $("[data-slug-value]", form).textContent = slug;
});

initAiDescription(form);

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = Object.fromEntries(new FormData(form));
  const assignOwner = data.canAssignOwner && withOwner?.checked;
  const errorBox = $("[data-create-error]", form);
  showError(errorBox, "");
  try {
    const { data: created } = await api.post("/businesses", {
      name: f.name,
      categoryId: f.categoryId,
      businessType: f.businessType,
      description: f.description?.trim() || undefined,
      phone: f.phone,
      website: f.website || undefined,
      addressLine1: f.addressLine1,
      city: f.city,
      state: f.state,
      postalCode: f.postalCode,
      latitude: Number(f.latitude),
      longitude: Number(f.longitude),
      country: "IN",
      ...(assignOwner
        ? {
            owner: {
              firstName: f.ownerFirstName,
              lastName: f.ownerLastName,
              username: f.ownerUsername,
              phone: f.ownerPhone || undefined,
              password: f.ownerPassword,
            },
          }
        : {}),
    });

    if (assignOwner) {
      // The listing belongs to the business team's account now — show the
      // login so the dealer can hand it over. It rides along in this tab's
      // sessionStorage for the one reload and is removed as soon as it's read.
      const creds = {
        businessName: created.name,
        username: created.ownerAccount?.username ?? f.ownerUsername,
        password: f.ownerPassword,
        created: created.ownerAccount?.created ?? true,
      };
      try {
        sessionStorage.setItem("mk-owner-creds", JSON.stringify(creds));
      } catch {
        // storage unavailable — the login is still in the welcome email
      }
      reloadWithFlash("Business created, published, and assigned to the business team's account. Their login has also been emailed to them.");
    } else {
      reloadWithFlash(
        "Business created. Manage its details, hours, services, and photos below.",
        `/dashboard/businesses/${created.id}`,
      );
    }
  } catch (err) {
    showError(errorBox, errorMessage(err));
  }
});

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
