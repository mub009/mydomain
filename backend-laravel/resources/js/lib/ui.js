import { icon } from "./icons";

// Small DOM helpers shared by the page scripts.

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

export function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Reads JSON a Blade view embedded with <script type="application/json" id="…">.
export function pageData(id) {
  const el = document.getElementById(id);
  if (!el) return null;
  try {
    return JSON.parse(el.textContent || "null");
  } catch {
    return null;
  }
}

export function currentUser() {
  const meta = document.querySelector('meta[name="auth-user"]');
  if (!meta) return null;
  try {
    return JSON.parse(meta.content);
  } catch {
    return null;
  }
}

function ratingColor(rating) {
  if (rating >= 4) return "bg-emerald-600";
  if (rating >= 3) return "bg-amber-500";
  if (rating > 0) return "bg-red-500";
  return "bg-gray-400";
}

// Same markup as the Blade <x-star-rating> component.
export function starRating(rating, count, size = "md") {
  const value = Number(rating) || 0;
  const pad = size === "sm" ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-1 text-xs";
  return `<span class="inline-flex items-center gap-1.5">
    <span class="badge text-white ${pad} ${ratingColor(value)}">${value.toFixed(1)}${icon("star", { size: size === "sm" ? 11 : 13, fill: "currentColor", strokeWidth: 0 })}</span>
    ${count !== undefined && count !== null ? `<span class="text-xs text-ink-500">(${count})</span>` : ""}
  </span>`;
}

export function starRow(rating, size = 16) {
  const filled = Math.round(Number(rating) || 0);
  let html = '<span class="inline-flex items-center gap-0.5 text-gold-400">';
  for (let i = 0; i < 5; i++) {
    html += icon("star", {
      size,
      fill: i < filled ? "currentColor" : "none",
      strokeWidth: i < filled ? 0 : 1.5,
      className: i < filled ? "text-gold-400" : "text-gray-300",
    });
  }
  return `${html}</span>`;
}

// Compact pager: « Prev · 1 … n · Next ». Buttons carry data-page; the
// caller listens for clicks. Empty when there's only one page.
export function pagination(page, totalPages, className = "") {
  if (!totalPages || totalPages <= 1) return "";
  const pages = [];
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || Math.abs(p - page) <= 1) pages.push(p);
    else if (pages[pages.length - 1] !== "…") pages.push("…");
  }
  const btn = "btn-secondary px-2.5 py-1.5 text-sm disabled:opacity-40 disabled:cursor-not-allowed";
  return `<div class="flex items-center justify-center gap-1 mt-4 ${className}">
    <button type="button" class="${btn}" data-page="${page - 1}" ${page <= 1 ? "disabled" : ""} aria-label="Previous page">${icon("chevron-left", { size: 15 })}</button>
    ${pages
      .map((p) =>
        p === "…"
          ? '<span class="px-1.5 text-sm text-ink-400">…</span>'
          : `<button type="button" data-page="${p}" class="min-w-[34px] rounded-lg px-2.5 py-1.5 text-sm font-semibold transition-colors ${
              p === page ? "bg-brand-600 text-white" : "text-ink-600 hover:bg-brand-50 hover:text-brand-700"
            }">${p}</button>`,
      )
      .join("")}
    <button type="button" class="${btn}" data-page="${page + 1}" ${page >= totalPages ? "disabled" : ""} aria-label="Next page">${icon("chevron-right", { size: 15 })}</button>
  </div>`;
}

// Wires a container's pager buttons to a callback.
export function onPage(container, callback) {
  container.addEventListener("click", (e) => {
    const button = e.target.closest("[data-page]");
    if (!button || button.disabled) return;
    callback(Number(button.dataset.page));
  });
}

export function spinner(label = "Loading…", className = "") {
  return `<div class="flex items-center justify-center gap-2 py-8 text-sm text-ink-500 ${className}" aria-live="polite">${icon("loader-2", { size: 16, className: "animate-spin" })}${esc(label)}</div>`;
}

export function listSkeleton(rows = 4, className = "") {
  let html = `<div class="card divide-y divide-gray-100 ${className}" aria-busy="true">`;
  for (let i = 0; i < rows; i++) {
    html += `<div class="p-4 flex items-center gap-3">
      <div class="h-9 w-9 shrink-0 rounded-full bg-gray-200 animate-pulse"></div>
      <div class="flex-1 space-y-2"><div class="h-3.5 w-1/3 rounded bg-gray-200 animate-pulse"></div><div class="h-3 w-1/2 rounded bg-gray-100 animate-pulse"></div></div>
      <div class="h-7 w-20 rounded-lg bg-gray-200 animate-pulse"></div>
    </div>`;
  }
  return `${html}<span class="sr-only">Loading…</span></div>`;
}

export function cardSkeleton(count = 4, className = "") {
  let html = `<div class="${className}" aria-busy="true">`;
  for (let i = 0; i < count; i++) {
    html += `<div class="card p-4 space-y-3"><div class="h-4 w-2/3 rounded bg-gray-200 animate-pulse"></div><div class="h-3 w-1/2 rounded bg-gray-100 animate-pulse"></div><div class="h-8 w-full rounded-lg bg-gray-100 animate-pulse"></div></div>`;
  }
  return `${html}<span class="sr-only">Loading…</span></div>`;
}

export function alertBox(message, tone = "error") {
  if (!message) return "";
  const cls = tone === "error" ? "text-red-700 bg-red-50" : "text-emerald-700 bg-emerald-50";
  return `<p class="text-sm ${cls} rounded-md px-3 py-2">${esc(message)}</p>`;
}

// A modal dialog built on demand: returns { body, close }. The shell
// matches the old <Modal>: backdrop click / Escape close it.
export function openModal(title, contentHtml, { wide = false, onClose } = {}) {
  const root = document.createElement("div");
  root.className = "fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-6 overflow-y-auto";
  root.innerHTML = `<div class="fixed inset-0 bg-black/40" data-close></div>
    <div class="relative w-full ${wide ? "max-w-4xl" : "max-w-lg"} bg-white rounded-2xl shadow-popover my-8">
      <div class="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <h3 class="font-bold text-ink-900">${esc(title)}</h3>
        <button type="button" class="text-ink-400 hover:text-ink-700 p-1" aria-label="Close" data-close>${icon("x", { size: 18 })}</button>
      </div>
      <div class="p-5" data-body>${contentHtml}</div>
    </div>`;
  document.body.appendChild(root);
  document.body.style.overflow = "hidden";

  function close() {
    if (!root.isConnected) return;
    root.remove();
    document.body.style.overflow = "";
    document.removeEventListener("keydown", onKey);
    onClose?.();
  }
  function onKey(e) {
    if (e.key === "Escape") close();
  }
  document.addEventListener("keydown", onKey);
  root.addEventListener("click", (e) => {
    if (e.target.closest("[data-close]")) close();
  });

  return { root, body: root.querySelector("[data-body]"), close };
}

export function formatDate(value, options = { day: "numeric", month: "short", year: "numeric" }) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, options);
}

export function formatDateTime(value) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function rupees(cents, currency = "INR") {
  const amount = (Number(cents) || 0) / 100;
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: amount % 1 ? 2 : 0 }).format(amount);
  } catch {
    return `₹${amount.toFixed(2)}`;
  }
}

// The visitor's chosen location, remembered across pages: a city name, or
// a "near me" point — never both. It lives in a cookie (not localStorage)
// so the server can render search results already filtered to it; see
// App\Support\VisitorLocation.
const LOCATION_COOKIE = "mk_loc";

export function getLocation() {
  const match = document.cookie.match(/(?:^|;\s*)mk_loc=([^;]*)/);
  if (!match) return { city: "", geo: null };
  try {
    const state = JSON.parse(decodeURIComponent(match[1]));
    return { city: state.city ?? "", geo: state.geo ?? null };
  } catch {
    return { city: "", geo: null };
  }
}

export function setLocation(patch) {
  const next = { ...getLocation(), ...patch };
  if (patch.city) next.geo = null;
  if (patch.geo) next.city = "";
  const value = encodeURIComponent(JSON.stringify({ city: next.city || "", geo: next.geo || null }));
  document.cookie = `${LOCATION_COOKIE}=${value}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  return next;
}
