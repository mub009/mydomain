import { api, errorMessage } from "../lib/api";
import { CHANNEL_LABELS, MARKKITO_CHANNELS, channelOptions } from "../lib/channels";
import { icon } from "../lib/icons";
import { $, esc, pageData, spinner } from "../lib/ui";

const data = pageData("qr-claim-data");
const root = $("[data-qr-claim]");

const state = {
  code: data.code ?? "",
  lookup: null,
  businesses: [],
  businessId: "",
  channel: "",
  claimed: null,
  loading: Boolean(data.code),
  saving: false,
  error: data.unknown ? "That QR board was not recognised." : "",
};

async function runLookup(raw) {
  if (!raw.trim()) return;
  Object.assign(state, { loading: true, error: "", lookup: null });
  render();
  try {
    const { data: found } = await api.get(`/qr-codes/lookup/${encodeURIComponent(raw.trim())}`);
    state.lookup = found;
    state.channel = found.channel ?? "";
  } catch (err) {
    state.error = errorMessage(err);
  } finally {
    state.loading = false;
    render();
  }
}

async function claim() {
  if (!state.businessId) {
    state.error = "Choose which business this board belongs to";
    return render();
  }
  state.saving = true;
  state.error = "";
  render();
  try {
    const { data: claimed } = await api.post("/qr-codes/claim", {
      code: state.lookup?.code ?? state.code,
      businessId: state.businessId,
      channel: state.channel || undefined,
    });
    state.claimed = claimed;
  } catch (err) {
    state.error = errorMessage(err);
  } finally {
    state.saving = false;
    render();
  }
}

function successView(c) {
  return `<div class="card p-7 text-center">
    <span class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">${icon("check-circle-2", { size: 30 })}</span>
    <h1 class="mt-4 text-xl font-extrabold text-ink-900">QR board activated</h1>
    <p class="mt-1 text-sm text-ink-600"><span class="font-mono font-semibold">${esc(c.code)}</span> is now attached to <span class="font-semibold text-ink-900">${esc(c.business?.name)}</span>.</p>
    ${
      c.needsReviewLinks
        ? `<div class="mt-4 rounded-lg bg-amber-50 p-3 text-left">
            <p class="flex items-center gap-1.5 text-sm font-bold text-amber-800">${icon("alert-triangle", { size: 15 })} One step left</p>
            <p class="mt-1 text-xs text-amber-800/90">Add your Google, Instagram or Facebook review page so scans land on the right place. Until then, scans open your Markkito listing.</p>
          </div>`
        : `<div class="mt-4 rounded-lg bg-emerald-50 px-3 py-2.5 text-left">
            <p class="text-xs font-semibold text-emerald-800">Scans now open ${esc(c.effectiveChannel ? CHANNEL_LABELS[c.effectiveChannel] : "your default channel")}</p>
            ${c.effectiveUrl ? `<p class="mt-0.5 break-all text-[11px] text-emerald-700/80">${esc(c.effectiveUrl)}</p>` : ""}
          </div>`
    }
    <div class="mt-5 flex gap-2">
      <a href="/dashboard" class="btn-primary flex-1 py-2.5">Go to dashboard</a>
      <a href="/qr" class="btn-secondary flex-1 py-2.5">Activate another</a>
    </div>
  </div>`;
}

function claimForm() {
  if (!data.canClaim) {
    return `<div class="mt-3 rounded-md bg-brand-50 px-3 py-2 text-sm text-brand-800">Sign in with your business account to attach this board.
      <a href="/login?next=${encodeURIComponent(window.location.pathname)}" class="ml-1 font-semibold underline">Log in</a></div>`;
  }
  if (state.businesses.length === 0) {
    return `<div class="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">${
      data.role === "DEALER"
        ? "You have not registered any businesses yet. Register one first, then attach this board."
        : "You don't have a business listing yet. Create one first, then attach this board."
    }</div>`;
  }
  const hint =
    state.channel && MARKKITO_CHANNELS.includes(state.channel)
      ? "Sends customers to this shop's own Markkito page — nothing to set up first."
      : "Uses your own link for that platform. You can change this later from your dashboard.";
  return `<div class="mt-4 space-y-3">
    <div>
      <label class="mb-1 block text-xs font-semibold text-ink-700">${icon("store", { size: 12, className: "mr-1 inline -mt-0.5" })}Attach to which business?</label>
      <select class="input" data-business>
        <option value="">Select a business</option>
        ${state.businesses.map((b) => `<option value="${esc(b.id)}" ${b.id === state.businessId ? "selected" : ""}>${esc(b.name)} — ${esc(b.city)}</option>`).join("")}
      </select>
    </div>
    <div>
      <label class="mb-1 block text-xs font-semibold text-ink-700">Where should a scan send customers?</label>
      <select class="input" data-channel>${channelOptions(state.channel)}</select>
      <p class="mt-1 text-[11px] text-ink-400" data-channel-hint>${hint}</p>
    </div>
    <button data-claim ${state.saving || !state.businessId ? "disabled" : ""} class="btn-primary w-full py-2.5 disabled:opacity-50">${state.saving ? "Activating…" : "Confirm &amp; activate board"}</button>
  </div>`;
}

function lookupView(l) {
  let status = "";
  if (l.status === "ASSIGNED")
    status = `<p class="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">This board is already attached to <span class="font-semibold">${esc(l.business?.name)}</span>. Contact the admin if it needs to be moved.</p>`;
  else if (l.status === "DISABLED")
    status = '<p class="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">This board has been disabled. Please ask the admin for a replacement.</p>';
  else if (l.status === "UNASSIGNED") status = claimForm();

  return `<div class="mt-4">
    <div class="rounded-lg border border-gray-200 bg-gray-50 p-3">
      <p class="text-xs text-ink-500">Board code</p>
      <p class="font-mono text-lg font-bold text-ink-900">${esc(l.code)}</p>
      <p class="mt-1 text-xs text-ink-600">Purpose: <span class="font-semibold text-ink-900">${esc(l.channel ? CHANNEL_LABELS[l.channel] : "Your default channel")}</span></p>
      ${l.batchLabel ? `<p class="mt-0.5 text-xs text-ink-400">Batch: ${esc(l.batchLabel)}</p>` : ""}
    </div>
    ${status}
  </div>`;
}

function render() {
  if (state.claimed) {
    root.innerHTML = successView(state.claimed);
    return;
  }
  const focused = document.activeElement?.matches?.("[data-code]");
  root.innerHTML = `<div class="card p-7">
    <span class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600">${icon("qr-code", { size: 30 })}</span>
    <h1 class="mt-4 text-center text-xl font-extrabold text-ink-900">Activate your review QR board</h1>
    <p class="mt-1 text-center text-sm text-ink-600">Scan the board with your camera, or type the code printed on it.</p>
    <div class="mt-5">
      <label class="mb-1 block text-xs font-semibold text-ink-700">Board code</label>
      <div class="flex gap-2">
        <input class="input font-mono uppercase" placeholder="MK-XXXXXX" value="${esc(state.code)}" data-code />
        <button type="button" data-check class="btn-secondary whitespace-nowrap px-3 py-2">Check</button>
      </div>
    </div>
    ${state.error ? `<p class="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">${esc(state.error)}</p>` : ""}
    ${state.loading ? spinner("Checking code…") : ""}
    ${state.lookup && !state.loading ? lookupView(state.lookup) : ""}
  </div>`;
  if (focused) $("[data-code]", root).focus();
}

root.addEventListener("input", (e) => {
  if (e.target.matches("[data-code]")) {
    e.target.value = e.target.value.toUpperCase();
    state.code = e.target.value;
  }
});
root.addEventListener("keydown", (e) => {
  if (e.target.matches("[data-code]") && e.key === "Enter") {
    e.preventDefault();
    runLookup(state.code);
  }
});
root.addEventListener("change", (e) => {
  if (e.target.matches("[data-business]")) {
    state.businessId = e.target.value;
    $("[data-claim]", root).disabled = !state.businessId;
  }
  if (e.target.matches("[data-channel]")) {
    state.channel = e.target.value;
    $("[data-channel-hint]", root).textContent =
      state.channel && MARKKITO_CHANNELS.includes(state.channel)
        ? "Sends customers to this shop's own Markkito page — nothing to set up first."
        : "Uses your own link for that platform. You can change this later from your dashboard.";
  }
});
root.addEventListener("click", (e) => {
  if (e.target.closest("[data-check]")) runLookup(state.code);
  if (e.target.closest("[data-claim]")) claim();
});

// Only owners/dealers/admins can attach a board, so only they need the list.
// This is deliberately not "my businesses": a dealer must also see the shops
// they registered, whose listings belong to the shops' own accounts.
if (data.canClaim) {
  api
    .get("/qr-codes/assignable-businesses")
    .then(({ data: list }) => {
      state.businesses = list;
      if (list.length === 1) state.businessId = list[0].id;
      render();
    })
    .catch(() => undefined);
}

render();
if (data.code) runLookup(data.code);
