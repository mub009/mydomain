import { api, errorMessage } from "../lib/api";
import { initLocationInput } from "../lib/location-input";
import { $, $$, alertBox, esc, openModal, setLocation } from "../lib/ui";

// Filters reload the page with the new value (any change restarts at page 1,
// which the form's GET naturally does).
const filters = $("[data-filters]");
filters?.addEventListener("change", (e) => {
  if (e.target.matches("select")) {
    // Leave default values out of the URL.
    $$("select", filters).forEach((s) => (s.disabled = !s.value || (s.name === "sort" && s.value === "relevance")));
    filters.submit();
  }
});

// Location lives in a cookie, so changing it is set-and-reload.
const reloadFirstPage = () => {
  const url = new URL(window.location.href);
  url.searchParams.delete("page");
  window.location.href = url.toString();
};

$$("[data-clear-location]").forEach((button) =>
  button.addEventListener("click", () => {
    setLocation({ city: "", geo: null });
    reloadFirstPage();
  }),
);

const panel = $("[data-location-panel]");
const toggle = $("[data-toggle-location]");
toggle?.addEventListener("click", () => {
  panel.hidden = !panel.hidden;
  toggle.classList.toggle("border-brand-500", !panel.hidden);
  toggle.classList.toggle("bg-brand-50", !panel.hidden);
  toggle.classList.toggle("text-brand-700", !panel.hidden);
});

const locationRoot = $("[data-location-input]", panel ?? document);
if (locationRoot) {
  initLocationInput(locationRoot, {
    onCommit: (city) => {
      setLocation({ city: city.trim(), geo: null });
      reloadFirstPage();
    },
    onDetect: (lat, lng) => {
      setLocation({ geo: { lat, lng } });
      reloadFirstPage();
    },
  });
}

// "Show Number" reveals the phone in place.
$$("[data-show-number]").forEach((button) =>
  button.addEventListener("click", () => {
    $("span", button).textContent = button.dataset.showNumber;
  }),
);

// Enquiry form shown from a listing row, so users can send a lead without
// leaving the results page.
$$("[data-enquiry]").forEach((button) =>
  button.addEventListener("click", () => openEnquiry(button.dataset.enquiry, button.dataset.enquiryName)),
);

function openEnquiry(businessId, businessName) {
  const modal = openModal(
    `Send enquiry to ${businessName}`,
    `<form class="space-y-3">
      <div data-error></div>
      <input required name="name" class="input" placeholder="Your name" />
      <input required name="phone" minlength="7" maxlength="20" class="input" placeholder="Your phone" />
      <input type="email" name="email" class="input" placeholder="Email (optional)" />
      <textarea name="message" class="input min-h-[90px]" placeholder="What do you need?"></textarea>
      <button class="btn-primary w-full py-2.5" data-submit>Send enquiry</button>
    </form>`,
  );
  const form = $("form", modal.body);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submit = $("[data-submit]", form);
    submit.disabled = true;
    submit.textContent = "Sending…";
    const fields = Object.fromEntries(new FormData(form));
    try {
      await api.post(`/businesses/${businessId}/leads`, {
        name: fields.name,
        phone: fields.phone,
        email: fields.email || undefined,
        message: fields.message || undefined,
        source: "SEARCH",
      });
      modal.body.innerHTML = `<div class="space-y-3">
        <p class="text-sm text-emerald-800 bg-emerald-50 rounded-md px-3 py-2">Enquiry sent. ${esc(businessName)} will get in touch with you shortly.</p>
        <button type="button" class="btn-primary w-full py-2.5" data-close>Done</button>
      </div>`;
    } catch (err) {
      $("[data-error]", form).innerHTML = alertBox(errorMessage(err));
      submit.disabled = false;
      submit.textContent = "Send enquiry";
    }
  });
}
