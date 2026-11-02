import { initAiDescription } from "../lib/ai-describe";
import { api, errorMessage } from "../lib/api";
import { initSearchableSelects } from "../lib/searchable-select";
import { initStateCity } from "../lib/state-city";
import { $, $$, pageData } from "../lib/ui";
import { generatePassword, initDetectLocation, reloadWithFlash, showError } from "../lib/widgets";

// The "Add a business" page (/dashboard/businesses/new).

const data = pageData("dashboard-data") ?? {};
initStateCity();
initSearchableSelects();

const form = $("[data-create-business]");
initDetectLocation(form);

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
      postalCode: f.postalCode?.trim() || null,
      latitude: Number(f.latitude),
      longitude: Number(f.longitude),
      country: "IN",
      ...(assignOwner
        ? {
            owner: {
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
      // Back to the dashboard, which shows the login (see dashboard.js).
      reloadWithFlash("Business created, published, and assigned to the business team's account. Their login has also been emailed to them.", "/dashboard");
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

