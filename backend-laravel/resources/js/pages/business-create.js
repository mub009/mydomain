import { initAiDescription } from "../lib/ai-describe";
import { api, errorMessage } from "../lib/api";
import { cardPreviewModal } from "../lib/card-preview";
import { initSearchableSelects } from "../lib/searchable-select";
import { initStateCity } from "../lib/state-city";
import { $, $$, currentUser, esc, pageData } from "../lib/ui";
import { generatePassword, initDetectLocation, initUploadFields, reloadWithFlash, showError } from "../lib/widgets";

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
initUploadFields(form ?? document);

// --- Visiting card design ---------------------------------------------------
// Once a category is picked, its 3–5 card designs appear as small previews
// (drawn with the name typed so far). Tapping one selects it and opens it
// full size. A new listing is on the free plan, so premium designs are shown
// locked — except to admins.
const picker = form ? $("[data-card-picker]", form) : null;
const pickerOptions = picker ? $("[data-card-options]", picker) : null;
const pickedInput = picker ? $("[data-card-template]", picker) : null;
const isAdmin = currentUser()?.role === "ADMIN";
let cardTemplates = [];
let cardRequest = 0;

function renderCardOptions() {
  pickerOptions.innerHTML = cardTemplates
    .map((t) => {
      const locked = t.isPremium && !isAdmin;
      const selected = t.id === pickedInput.value;
      return `<button type="button" data-card-option="${esc(t.id)}" ${locked ? 'data-locked="1"' : ""}
          class="group overflow-hidden rounded-lg border bg-white text-left transition ${selected ? "border-brand-500 ring-2 ring-brand-200" : "border-gray-200 hover:border-gray-300"}">
          <span class="relative block h-40 overflow-hidden bg-gray-100">
            <iframe sandbox="" tabindex="-1" aria-hidden="true" loading="lazy" class="pointer-events-none absolute left-0 top-0 origin-top-left border-0" style="width:300%;height:300%;transform:scale(.3333)" data-srcdoc-index="${cardTemplates.indexOf(t)}"></iframe>
            ${t.isPremium ? `<span class="badge absolute left-1 top-1 bg-amber-100 text-amber-800 !text-[10px]">Premium</span>` : ""}
            ${selected ? `<span class="badge absolute right-1 top-1 bg-brand-600 text-white !text-[10px]">Selected</span>` : ""}
          </span>
          <span class="block truncate px-2 py-1.5 text-xs font-semibold text-ink-900">${esc(t.name)}</span>
        </button>`;
    })
    .join("");
  // srcdoc set as a property, so the card HTML never passes through innerHTML.
  $$("[data-srcdoc-index]", pickerOptions).forEach((frame) => (frame.srcdoc = cardTemplates[Number(frame.dataset.srcdocIndex)].previewHtml));
}

async function loadCardTemplates() {
  if (!picker) return;
  const categoryId = form.categoryId.value;
  if (!categoryId) {
    picker.hidden = true;
    cardTemplates = [];
    pickedInput.value = "";
    return;
  }
  const request = ++cardRequest;
  try {
    const { data } = await api.get("/card-templates", { categoryId, name: slugSource?.value.trim() || undefined });
    if (request !== cardRequest) return;
    cardTemplates = data;
    // Keep the pick if the new category still offers it; else its default.
    if (!data.some((t) => t.id === pickedInput.value)) {
      pickedInput.value = data.find((t) => !(t.isPremium && !isAdmin))?.id ?? "";
    }
    picker.hidden = data.length === 0;
    renderCardOptions();
  } catch {
    picker.hidden = true;
  }
}

form?.categoryId.addEventListener("change", loadCardTemplates);
// Redrawn with the business's own name once it's typed.
slugSource?.addEventListener("change", () => cardTemplates.length && loadCardTemplates());

pickerOptions?.addEventListener("click", (e) => {
  const option = e.target.closest("[data-card-option]");
  if (!option) return;
  const template = cardTemplates.find((t) => t.id === option.dataset.cardOption);
  const locked = Boolean(option.dataset.locked);
  if (!locked) {
    pickedInput.value = template.id;
    renderCardOptions();
  }
  cardPreviewModal(template.name, template.previewHtml, {
    footer: locked
      ? `<p class="text-center text-sm text-amber-700">Premium design — available after upgrading your plan.</p>`
      : `<p class="text-center text-sm text-ink-500">Selected. Your own details and logo are filled in once the business is created.</p>`,
  });
});

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
      // Not on the dealer's form (added later from Manage).
      description: f.description?.trim() || undefined,
      phone: f.phone?.trim() || undefined,
      whatsappNumber: f.whatsappNumber?.trim() || undefined,
      logoUrl: f.logoUrl?.trim() || undefined,
      website: f.website || undefined,
      addressLine1: f.addressLine1?.trim() || undefined,
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

    // The card design picked above. Not fatal: the card falls back to the
    // category's default design, and can be changed from Manage.
    if (f.cardTemplateId) {
      await api.put(`/businesses/${created.id}/card`, { templateId: f.cardTemplateId }).catch(() => {});
    }

    if (assignOwner) {
      // The listing belongs to the business team's account now — show the
      // login so the dealer can hand it over. It rides along in this tab's
      // sessionStorage for the one reload and is removed as soon as it's read.
      const creds = {
        businessName: created.name,
        username: created.ownerAccount?.username ?? f.ownerUsername,
        password: f.ownerPassword,
        phone: f.ownerPhone || "",
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
      // On to the card's preview, where it's published and its link and QR code appear.
      reloadWithFlash(
        "Business created. Here is your digital visiting card — check the preview, then publish it.",
        `/dashboard/businesses/${created.id}?section=${encodeURIComponent("Visiting Card")}`,
      );
    }
  } catch (err) {
    showError(errorBox, errorMessage(err));
  }
});

