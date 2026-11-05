import { api, errorMessage, uploadImageFull } from "./api";
import { boardHeadline, boardUrl, downloadDataUrl, renderQrDataUrl } from "./channels";
import { icon } from "./icons";
import { $, $$, alertBox, esc, openModal, spinner } from "./ui";

// Widgets shared by the dashboard pages.

// --- Live search ------------------------------------------------------------
// Typing in an <input data-live-search> reloads its list after a short pause,
// with no Enter needed. The form is a plain GET, so any change starts again
// from page 1 (the form drops `page`).
export function initLiveSearch() {
  $$("[data-live-search]").forEach((input) => {
    let timer;
    let last = input.value.trim();
    input.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (input.value.trim() === last) return;
        last = input.value.trim();
        input.form.submit();
      }, 400);
    });
    // After the reload, carry on typing where you left off.
    if (input.value && document.activeElement === document.body && new URL(window.location.href).searchParams.has("search")) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  });
}

// --- Flash notices that survive a reload ----------------------------------
// Most dashboard actions save through the API and then reload the page so
// it re-renders from the server; the message to show goes along for the ride.
const FLASH_KEY = "mk-flash";

export function reloadWithFlash(message, url) {
  try {
    sessionStorage.setItem(FLASH_KEY, message);
  } catch {
    // ignore
  }
  if (url) window.location.href = url;
  else window.location.reload();
}

export function showFlash(target = $("[data-flash]")) {
  let message = null;
  try {
    message = sessionStorage.getItem(FLASH_KEY);
    sessionStorage.removeItem(FLASH_KEY);
  } catch {
    // ignore
  }
  if (message && target) {
    target.textContent = message;
    target.hidden = false;
    setTimeout(() => (target.hidden = true), 4000);
  }
}

export function showError(target, message) {
  if (!target) return;
  target.textContent = message;
  target.hidden = !message;
}

// --- Image upload fields --------------------------------------------------
export function initUploadFields(root = document) {
  $$("[data-upload-field]", root).forEach((field) => {
    if (field.dataset.wired) return;
    field.dataset.wired = "1";
    const url = $("[data-upload-url]", field);
    const button = $("[data-upload-button]", field);
    const file = $("[data-upload-file]", field);
    const error = $("[data-upload-error]", field);
    button.addEventListener("click", () => file.click());
    // Optional "Remove" button: empties the field and tells the page,
    // which may save the removal straight away (see manage.js).
    const clear = $("[data-upload-clear]", field);
    if (clear) {
      const syncClear = () => (clear.hidden = !url.value.trim());
      url.addEventListener("input", syncClear);
      clear.addEventListener("click", () => {
        url.value = "";
        error.hidden = true;
        url.dispatchEvent(new Event("input", { bubbles: true }));
        field.dispatchEvent(new CustomEvent("upload:cleared"));
      });
    }
    file.addEventListener("change", async () => {
      const picked = file.files?.[0];
      if (!picked) return;
      error.hidden = true;
      button.disabled = true;
      $("span", button).textContent = $("[data-upload-remove-bg]", field)?.checked ? "Enhancing with AI…" : "Uploading…";
      try {
        const removeBg = $("[data-upload-remove-bg]", field);
        const result = await uploadImageFull(picked, field.dataset.uploadField, removeBg ? { removeBackground: removeBg.checked } : {});
        url.value = result.url;
        url.dispatchEvent(new Event("input", { bubbles: true }));
        if (removeBg?.checked) {
          // Shown until the page's own "saved" note replaces it.
          const note = $("[data-upload-saved]", field);
          note.textContent =
            result.method === "ai"
              ? "Background removed and redrawn in high quality by AI. Check it matches your logo."
              : result.backgroundRemoved
                ? "Background removed and quality enhanced (AI wasn't available)."
                : "Quality enhanced. The background couldn't be removed.";
          note.hidden = false;
        }
        // Lets a page save the new image straight away (see manage.js).
        field.dispatchEvent(new CustomEvent("upload:done", { detail: { url: url.value } }));
      } catch (err) {
        error.textContent = errorMessage(err);
        error.hidden = false;
      } finally {
        button.disabled = false;
        $("span", button).textContent = "Upload";
        // Cleared so picking the same file again still fires change.
        file.value = "";
      }
    });
  });
}

// --- Passwords --------------------------------------------------------------
// A readable, reasonably strong default password that can be handed over.
export function generatePassword() {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const digits = "23456789";
  const all = upper + lower + digits;
  const pick = (set) => set[Math.floor(Math.random() * set.length)];
  let out = pick(upper) + pick(lower) + pick(digits);
  for (let i = 0; i < 7; i++) out += pick(all);
  return out
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
}

export function copyField(label, value) {
  return `<div>
    <label class="block text-[11px] font-medium text-emerald-700/80 mb-1">${esc(label)}</label>
    <div class="flex items-center gap-2">
      <code class="flex-1 min-w-0 truncate rounded-md border border-emerald-200 bg-white px-3 py-2 text-sm font-mono text-ink-900">${esc(value)}</code>
      <button type="button" class="btn-secondary px-3 py-2 text-sm whitespace-nowrap" data-copy="${esc(value)}">${icon("copy", { size: 14 })} <span>Copy</span></button>
    </div>
  </div>`;
}

// Copy buttons anywhere on the page: <button data-copy="text">…<span>Copy</span></button>
document.addEventListener("click", (e) => {
  const button = e.target.closest("[data-copy]");
  if (!button) return;
  navigator.clipboard?.writeText(button.dataset.copy).then(
    () => {
      const label = $("span", button);
      if (!label) return;
      const before = label.textContent;
      label.textContent = "Copied";
      setTimeout(() => (label.textContent = before), 1500);
    },
    () => undefined,
  );
});

// Reset a user's password on their behalf (admin: anyone; dealer: accounts
// they created). Shows the new login to hand over after a successful reset.
export function resetPasswordModal(user) {
  const modal = openModal(
    `Reset password — ${user.firstName} ${user.lastName}`,
    `<form class="space-y-3">
      <div data-error></div>
      <p class="text-sm text-ink-600">Set a new login password for <span class="font-semibold text-ink-900">${esc(user.email ?? user.phone)}</span>. Their current password stops working immediately.</p>
      <div>
        <label class="block text-xs font-semibold text-ink-700 mb-1">New password (min 8 chars)</label>
        <div class="flex gap-2">
          <input required minlength="8" type="text" name="password" class="input font-mono" value="${esc(generatePassword())}" />
          <button type="button" data-generate class="btn-secondary px-3 py-2 text-sm whitespace-nowrap">${icon("refresh-cw", { size: 14 })} Generate</button>
        </div>
      </div>
      <button class="btn-primary w-full py-2.5" data-submit>Reset password</button>
    </form>`,
  );
  const form = $("form", modal.body);
  $("[data-generate]", form).addEventListener("click", () => (form.password.value = generatePassword()));
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const password = form.password.value;
    const submit = $("[data-submit]", form);
    submit.disabled = true;
    submit.textContent = "Resetting…";
    try {
      await api.patch(`/users/${user.id}/password`, { password });
      modal.body.innerHTML = `<div class="space-y-3">
        <p class="text-sm text-emerald-800 bg-emerald-50 rounded-md px-3 py-2">Password reset. Their old sessions are signed out — share the new login below. The password won't be shown again.</p>
        ${copyField("Username", user.email ?? user.phone)}
        ${copyField("New password", password)}
        ${whatsappShareButton({
          businessName: [user.firstName, user.lastName].filter(Boolean).join(" "),
          username: user.email ?? user.phone,
          password,
          phone: user.phone,
          reset: true,
        })}
        <button type="button" class="btn-secondary w-full py-2.5" data-close>Done</button>
      </div>`;
    } catch (err) {
      $("[data-error]", form).innerHTML = alertBox(errorMessage(err));
      submit.disabled = false;
      submit.textContent = "Reset password";
    }
  });
}

// --- QR board preview -------------------------------------------------------
// Full-size, printable view of one issued board: its QR, the code beneath it
// (so it can be typed if a camera struggles), and download/print actions.
export function boardPreviewModal(code, businessName, channel) {
  const target = boardUrl(code);
  const modal = openModal(
    `QR board ${code}`,
    `<div id="qr-board" class="rounded-xl border-2 border-dashed border-gray-200 bg-white p-6 text-center">
      <p class="text-xs font-bold uppercase tracking-widest text-brand-600">Loved your visit?</p>
      <h4 class="mt-1 text-xl font-extrabold text-ink-900">${esc(businessName)}</h4>
      <p class="mt-0.5 text-sm text-ink-500">${esc(boardHeadline(channel))}</p>
      <div class="mx-auto mt-3 flex h-52 w-52 items-center justify-center" data-qr>${spinner("")}</div>
      <p class="mt-2 font-mono text-sm font-bold text-ink-900">${esc(code)}</p>
      <p class="mt-0.5 text-xs text-ink-400">Point your camera at the code</p>
      <p class="mt-3 text-[10px] font-semibold uppercase tracking-wider text-ink-400">Powered by Markkito</p>
    </div>
    <p class="mt-2 break-all text-[11px] text-ink-400">${esc(target)}</p>
    <div class="mt-3 flex flex-wrap gap-2">
      <button type="button" disabled data-download class="btn-primary flex-1 py-2.5 disabled:opacity-50">${icon("download", { size: 15 })} Download PNG</button>
      <button type="button" data-print class="btn-secondary flex-1 py-2.5">${icon("printer", { size: 15 })} Print</button>
      <button type="button" data-copy="${esc(target)}" class="btn-secondary flex-1 py-2.5">${icon("copy", { size: 15 })} <span>Copy link</span></button>
    </div>`,
  );
  let dataUrl = "";
  renderQrDataUrl(target)
    .then((url) => {
      dataUrl = url;
      $("[data-qr]", modal.body).outerHTML = `<img src="${url}" alt="QR code ${esc(code)}" class="mx-auto mt-3 h-52 w-52" />`;
      $("[data-download]", modal.body).disabled = false;
    })
    .catch(() => undefined);
  $("[data-download]", modal.body).addEventListener("click", () => dataUrl && downloadDataUrl(dataUrl, `${code}-qr.png`));
  $("[data-print]", modal.body).addEventListener("click", () => window.print());
}

// --- Status badges ----------------------------------------------------------
const STATUS_BADGES = {
  PUBLISHED: "bg-emerald-50 text-emerald-700",
  CONFIRMED: "bg-emerald-50 text-emerald-700",
  CONVERTED: "bg-emerald-50 text-emerald-700",
  COMPLETED: "bg-emerald-50 text-emerald-700",
  PENDING_APPROVAL: "bg-amber-50 text-amber-700",
  PENDING: "bg-amber-50 text-amber-700",
  NEW: "bg-brand-50 text-brand-700",
  CONTACTED: "bg-sky-50 text-sky-700",
  QUALIFIED: "bg-violet-50 text-violet-700",
  DRAFT: "bg-gray-100 text-gray-600",
  SUSPENDED: "bg-red-50 text-red-700",
  CANCELLED: "bg-red-50 text-red-700",
  LOST: "bg-red-50 text-red-700",
  NO_SHOW: "bg-red-50 text-red-700",
};

export function statusBadgeClass(status) {
  return STATUS_BADGES[status] ?? "bg-gray-100 text-gray-600";
}

// --- Clone a business (dealers only) ---------------------------------------
// Buttons carry data-clone-business='{"id":…,"name":…}'. The copy is a
// separate business, so the dealer sets up its team's login here; once it
// is made, the login is shown for handing over and the dealer moves on to
// the new draft.
export function initCloneButtons() {
  $$("[data-clone-business]").forEach((button) =>
    button.addEventListener("click", () => {
      const business = JSON.parse(button.dataset.cloneBusiness);
      let copy = null;
      const modal = openModal(
        "Clone business",
        `<form class="space-y-3" data-clone-form>
          <div>
            <p class="text-sm text-ink-700">Make a copy of <strong>${esc(business.name)}</strong>.</p>
            <p class="mt-1 text-xs text-ink-500">The copy gets its details, hours, services, photos, slider, gallery, products and website, starts as a draft under the name you give it and uses 1 point. Reviews, leads, bookings, orders and QR boards stay with the original.</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-ink-700 mb-1">Business name</label>
            <input class="input" name="businessName" minlength="2" maxlength="150" placeholder="Name of the new business" autocomplete="off" required />
          </div>
          <div class="rounded-lg border border-gray-200 p-3 space-y-2">
            <p class="text-sm font-semibold text-ink-900 flex items-center gap-1.5">${icon("key-round", { size: 14 })} Login for the copy</p>
            <p class="text-[11px] text-ink-500">The copy is assigned to this account so its business team can sign in. If the username already has an account, the copy is linked to it and the password is ignored.</p>
            <div>
              <label class="block text-[11px] font-medium text-ink-600 mb-1">Username (email or mobile number)</label>
              <input class="input" name="username" placeholder="owner@business.com or 9876543210" autocomplete="off" required />
            </div>
            <div>
              <label class="block text-[11px] font-medium text-ink-600 mb-1">Password (min 8 characters)</label>
              <div class="flex gap-2">
                <input class="input font-mono" name="password" minlength="8" maxlength="72" autocomplete="off" required />
                <button type="button" class="btn-secondary px-3 py-2 text-sm whitespace-nowrap" data-clone-generate>${icon("refresh-cw", { size: 14 })} Generate</button>
              </div>
            </div>
            <input class="input" name="phone" minlength="7" maxlength="20" placeholder="Contact phone (optional)" />
          </div>
          <p class="text-sm text-red-700 bg-red-50 rounded-md px-3 py-2" data-clone-error hidden></p>
          <div class="flex justify-end gap-2">
            <button type="button" class="btn-secondary px-4 py-2 text-sm" data-close>Cancel</button>
            <button class="btn-primary px-4 py-2 text-sm" data-clone-confirm>${icon("copy", { size: 14 })} Clone</button>
          </div>
        </form>`,
        // Once the copy exists, closing the dialog goes to it.
        { onClose: () => copy && reloadWithFlash(`This is the copy, “${copy.name}” — change what you need, then publish it.`, `/dashboard/businesses/${copy.id}`) },
      );
      const form = $("[data-clone-form]", modal.body);
      form.password.value = generatePassword();
      form.businessName.focus();
      $("[data-clone-generate]", form).addEventListener("click", () => (form.password.value = generatePassword()));

      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const confirm = $("[data-clone-confirm]", form);
        confirm.disabled = true;
        confirm.textContent = "Cloning…";
        const owner = {
          username: form.username.value.trim(),
          password: form.password.value,
          phone: form.phone.value.trim() || undefined,
        };
        try {
          ({ data: copy } = await api.post(`/businesses/${business.id}/clone`, { name: form.businessName.value.trim(), owner }));
        } catch (err) {
          showError($("[data-clone-error]", form), errorMessage(err));
          confirm.disabled = false;
          confirm.innerHTML = `${icon("copy", { size: 14 })} Clone`;
          return;
        }
        const account = copy.ownerAccount;
        modal.body.innerHTML = `<div class="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p class="font-bold text-emerald-800 flex items-center gap-1.5">${icon("check-circle-2", { size: 16 })} Cloned “${esc(copy.name)}”</p>
            <p class="text-xs text-emerald-700/90 mt-1 mb-3">${
              account.created
                ? "Share this login with the business team. The password won't be shown again."
                : "The copy was linked to an existing account — its team signs in with this username and their existing password."
            }</p>
            <div class="space-y-2.5">
              ${copyField("Username", account.username)}
              ${account.created ? copyField("Password", owner.password) : ""}
              ${whatsappShareButton({
                businessName: copy.name.replace(/ \(Copy\)$/, ""),
                username: account.username,
                password: account.created ? owner.password : "",
                phone: owner.phone,
              })}
            </div>
          </div>
          <div class="mt-4 flex justify-end">
            <button type="button" class="btn-primary px-4 py-2 text-sm" data-close>${icon("arrow-right", { size: 14 })} Open the copy</button>
          </div>`;
      });
    }),
  );
}

// --- Location ---------------------------------------------------------------
// "Use my current location" next to a form's latitude/longitude boxes: fills
// them from the device's GPS (handy for a dealer standing at the shop).
// Expects [data-detect-location] and [data-location-error] inside the form.
export function initDetectLocation(form) {
  const button = form && $("[data-detect-location]", form);
  if (!button || button.dataset.wired) return;
  button.dataset.wired = "1";
  const errorBox = $("[data-location-error]", form);
  const label = $("span", button);
  const idle = label.textContent;
  const done = (text = idle) => {
    button.disabled = false;
    label.textContent = text;
  };
  button.addEventListener("click", () => {
    showError(errorBox, "");
    if (!navigator.geolocation) return showError(errorBox, "Location isn't supported by this browser.");
    if (!window.isSecureContext) return showError(errorBox, "Location only works on an https:// address.");
    button.disabled = true;
    label.textContent = "Fetching location…";
    navigator.geolocation.getCurrentPosition(
      (position) => {
        form.latitude.value = position.coords.latitude.toFixed(6);
        form.longitude.value = position.coords.longitude.toFixed(6);
        form.latitude.dispatchEvent(new Event("input", { bubbles: true }));
        done("Location updated ✓");
        setTimeout(() => (label.textContent = idle), 2500);
      },
      (err) => {
        done();
        showError(
          errorBox,
          err.code === err.PERMISSION_DENIED
            ? "Location access is blocked. Allow location for this site in the browser, then try again."
            : "Couldn't fetch your location. Turn on GPS / location and try again.",
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });
}

// --- Share a login on WhatsApp --------------------------------------------
// A "Share on WhatsApp" link with the login page, username and password
// written out, for a dealer handing a new (or reset) login to the business.
// Opens a chat with the business's mobile number when there is one (the
// username itself, or the contact phone); otherwise WhatsApp asks whom to
// send it to.
function whatsappNumber(...candidates) {
  for (const value of candidates) {
    const digits = String(value ?? "").replace(/\D/g, "");
    if (/^[6-9]\d{9}$/.test(digits)) return `91${digits}`;
    if (/^91[6-9]\d{9}$/.test(digits)) return digits;
  }
  return "";
}

export function whatsappLoginUrl({ businessName, username, password, phone, reset = false }) {
  const lines = [
    reset
      ? `Hello! The Markkito login password${businessName ? ` for *${businessName}*` : ""} has been reset.`
      : `Hello! Your business${businessName ? ` *${businessName}*` : ""} is now listed on Markkito.`,
    "",
    `Login: ${window.location.origin}/login`,
    `Username: ${username}`,
    password ? `Password: ${password}` : "Password: your existing Markkito password",
    "",
    reset
      ? "Please sign in with the new password."
      : "Sign in to update your phone, address, photos, opening hours and more.",
  ];
  const number = whatsappNumber(username, phone);
  return `https://wa.me/${number}?text=${encodeURIComponent(lines.join("\n"))}`;
}

export function whatsappShareButton(details) {
  return `<a href="${esc(whatsappLoginUrl(details))}" target="_blank" rel="noopener" class="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1ebe5b]">
    ${icon("message-square", { size: 16 })} Share login on WhatsApp
  </a>`;
}
