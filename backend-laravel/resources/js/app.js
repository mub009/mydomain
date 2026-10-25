import { api, errorMessage } from "./lib/api";
import { $, esc, setLocation } from "./lib/ui";

// Runs on every page that uses the main layout.

// Mobile menu toggle.
const menuToggle = $("[data-menu-toggle]");
const menu = $("[data-menu]");
if (menuToggle && menu) {
  menuToggle.addEventListener("click", () => {
    const open = menu.hidden;
    menu.hidden = !open;
    menuToggle.setAttribute("aria-expanded", String(open));
    $('[data-menu-icon="closed"]', menuToggle).hidden = open;
    $('[data-menu-icon="open"]', menuToggle).hidden = !open;
  });
}

// Broken images: <img data-on-error="hide"> disappears; with
// data-on-error="fallback" it is swapped for the next sibling (an icon
// placeholder rendered hidden). Error events don't bubble, hence capture.
document.addEventListener(
  "error",
  (e) => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement) || !img.dataset.onError) return;
    if (img.dataset.onError === "fallback" && img.nextElementSibling) img.nextElementSibling.hidden = false;
    img.remove();
  },
  true,
);

// <select data-autosubmit> submits its form on change.
document.addEventListener("change", (e) => {
  if (e.target.matches?.("select[data-autosubmit]")) e.target.form?.submit();
});

// Timestamps rendered on the server in UTC, shown in the visitor's own time:
// <span data-local-datetime="ISO">, or data-local-date for the date alone.
document.querySelectorAll("[data-local-datetime]").forEach((el) => {
  const d = new Date(el.dataset.localDatetime);
  if (!Number.isNaN(d.getTime())) el.textContent = d.toLocaleString();
});
document.querySelectorAll("[data-local-date]").forEach((el) => {
  const d = new Date(el.dataset.localDate);
  if (!Number.isNaN(d.getTime())) el.textContent = d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
});

// Page views power the admin Analytics tab's "online now" and "most visited
// pages". Fire-and-forget: a failed ping must never affect the page.
const VISITOR_KEY = "mydomain-visitor-id";

function randomId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `v-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getVisitorId() {
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = randomId();
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return randomId();
  }
}

api
  .post("/analytics/pageview", {
    visitorId: getVisitorId(),
    path: window.location.pathname + window.location.search,
    referrer: document.referrer || undefined,
  })
  .catch(() => undefined);

// One-time welcome popup that captures a visitor's mobile number (with
// explicit consent) and, if they allow it, their location. Once submitted
// or dismissed it never asks again on this device.
const STORAGE_KEY = "markkito-visitor";
const DISMISS_KEY = "markkito-visitor-dismissed";

function requestPosition() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 8000, maximumAge: 300000 },
    );
  });
}

const welcome = $("#welcome-modal");
if (welcome) {
  let already = false;
  try {
    already = Boolean(localStorage.getItem(STORAGE_KEY) || localStorage.getItem(DISMISS_KEY));
  } catch {
    already = true;
  }

  const form = $("form", welcome);
  const phoneInput = $("[name=phone]", welcome);
  const agreed = $("[name=agreed]", welcome);
  const errorBox = $("[data-error]", welcome);
  const submitButton = $("[data-submit]", welcome);

  const showError = (message) => {
    errorBox.innerHTML = message ? `<p class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">${esc(message)}</p>` : "";
  };
  const close = () => {
    welcome.hidden = true;
    document.removeEventListener("keydown", onKey);
  };
  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore
    }
    close();
  };
  function onKey(e) {
    if (e.key === "Escape") dismiss();
  }

  if (!already) {
    setTimeout(() => {
      welcome.hidden = false;
      document.addEventListener("keydown", onKey);
      phoneInput.focus();
    }, 1200);
  }

  welcome.addEventListener("click", (e) => {
    if (e.target === welcome) dismiss();
  });
  $("[data-dismiss]", welcome).addEventListener("click", dismiss);
  phoneInput.addEventListener("input", () => {
    phoneInput.value = phoneInput.value.replace(/\D/g, "");
  });
  agreed.addEventListener("change", () => {
    submitButton.disabled = !agreed.checked;
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const digits = phoneInput.value.replace(/\D/g, "").slice(-10);
    if (!/^[6-9]\d{9}$/.test(digits)) return showError("Enter a valid 10-digit mobile number");
    if (!agreed.checked) return showError("Please accept the terms to continue");

    submitButton.disabled = true;
    submitButton.textContent = "Please wait…";
    showError("");
    try {
      // Ask for location first so it can be saved with the number in one go.
      const position = await requestPosition();
      const { data: visitor } = await api.post("/visitors", {
        phone: digits,
        consent: true,
        latitude: position?.lat,
        longitude: position?.lng,
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ id: visitor.id, phone: visitor.phone }));
      if (position) setLocation({ geo: position });
      close();
    } catch (err) {
      showError(errorMessage(err));
    } finally {
      submitButton.disabled = !agreed.checked;
      submitButton.textContent = "Continue";
    }
  });
}
