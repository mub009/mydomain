import { api, errorMessage } from "../lib/api";

// The page's contact form is plain markup with no action (the sanitizer
// strips those), so submissions are handled here and delivered to the
// business's Leads inbox.
const root = document.getElementById("mk-site-root");
const businessId = root?.dataset.businessId;

root?.addEventListener("submit", async (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  event.preventDefault();

  const data = new FormData(form);
  const value = (key) => String(data.get(key) ?? "").trim();
  const name = value("name");
  const phone = value("phone");
  const email = value("email");
  const subject = value("subject");
  const body = value("message");

  let status = form.querySelector("[data-mk-status]");
  if (!status) {
    status = document.createElement("p");
    status.setAttribute("data-mk-status", "");
    status.style.cssText = "margin:10px 0 0;font-size:14px";
    form.appendChild(status);
  }

  // The lead API needs a phone number; fall back to the email when the form
  // has no phone field so the enquiry is still deliverable.
  if (!name || !(phone || email)) {
    status.style.color = "#b91626";
    status.textContent = "Please add your name and a phone number or email.";
    return;
  }

  status.style.color = "#555";
  status.textContent = "Sending…";
  try {
    await api.post(`/businesses/${businessId}/leads`, {
      name,
      phone: phone || "0000000000",
      email: email || undefined,
      message: [subject, body].filter(Boolean).join(" — ") || undefined,
      source: "BUSINESS_PROFILE",
    });
    form.reset();
    status.style.color = "#0f7a3d";
    status.textContent = "Thank you! We have received your message and will get back to you.";
  } catch (err) {
    status.style.color = "#b91626";
    status.textContent = errorMessage(err);
  }
});
