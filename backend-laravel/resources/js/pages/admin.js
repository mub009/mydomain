import { api, errorMessage } from "../lib/api";
import { boardHeadline, boardUrl, downloadDataUrl, renderQrDataUrl } from "../lib/channels";
import { icon } from "../lib/icons";
import { $, $$, alertBox, esc, formatDateTime, openModal, pageData } from "../lib/ui";
import { reloadWithFlash, resetPasswordModal, showError, showFlash } from "../lib/widgets";

// The admin console. Lists are server-rendered per tab; these handlers run
// the actions through /api/v1/admin and reload to show the result.

const ROLES = ["CUSTOMER", "BUSINESS_OWNER", "DEALER", "ADMIN"];
const STATUSES = ["ACTIVE", "SUSPENDED", "PENDING_VERIFICATION"];
const BIZ_STATUSES = ["DRAFT", "PENDING_APPROVAL", "PUBLISHED", "SUSPENDED"];
const PRIVILEGES = { MANAGE_LISTINGS: "Manage listings", MANAGE_LEADS: "Manage leads", MANAGE_BOOKINGS: "Manage bookings" };
const label = (value) => value.replace("_", " ");

const errorBox = $("[data-error]");
const fail = (err) => showError(errorBox, errorMessage(err));
showFlash();

// --- Filters ------------------------------------------------------------------
// Typing in a search box reloads the list after a short pause, the way the
// old live search did. Any filter change starts again from page 1 (the form
// GET drops `page`).
$$("[data-live-search]").forEach((input) => {
  let timer;
  input.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(() => input.form.submit(), 400);
  });
  // Keep the caret where it was after the reload.
  if (input.value && document.activeElement === document.body && new URL(window.location.href).searchParams.has("search")) {
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }
});
$$("[data-autosubmit-check]").forEach((box) => box.addEventListener("change", () => box.form.submit()));

// --- Shared form bits ---------------------------------------------------------
function options(list, selected) {
  return list.map((v) => `<option value="${v}" ${v === selected ? "selected" : ""}>${label(v)}</option>`).join("");
}

function privilegeSelector(selected) {
  return `<div data-privileges>
    <label class="block text-xs font-semibold text-ink-700 mb-1">Dealer privileges</label>
    <div class="space-y-1.5 rounded-lg border border-gray-200 bg-gray-50/60 p-3">
      ${Object.entries(PRIVILEGES)
        .map(
          ([value, text]) =>
            `<label class="flex items-center gap-2 text-sm text-ink-700 cursor-pointer"><input type="checkbox" name="privileges" value="${value}" ${
              selected.includes(value) ? "checked" : ""
            } /> ${text}</label>`,
        )
        .join("")}
      <p class="text-xs text-ink-400 pt-1">Controls which dashboard features this dealer can access.</p>
    </div>
  </div>`;
}

// Shows the privilege picker only while the role is DEALER.
function wireRolePrivileges(form) {
  const sync = () => ($("[data-privileges]", form).hidden = form.role.value !== "DEALER");
  form.role.addEventListener("change", sync);
  sync();
}

async function submitModalForm(form, button, busyLabel, work) {
  const before = button.textContent;
  button.disabled = true;
  button.textContent = busyLabel;
  $("[data-form-error]", form).innerHTML = "";
  try {
    await work();
  } catch (err) {
    $("[data-form-error]", form).innerHTML = alertBox(errorMessage(err));
    button.disabled = false;
    button.textContent = before;
  }
}

// --- Users ----------------------------------------------------------------------
$("[data-create-user]")?.addEventListener("click", () => {
  const modal = openModal(
    "Add a user",
    `<form class="space-y-3">
      <div data-form-error></div>
      <div class="flex gap-3">
        <input required class="input" name="firstName" placeholder="First name" />
        <input required class="input" name="lastName" placeholder="Last name" />
      </div>
      <input required class="input" type="email" name="email" placeholder="Email" />
      <input required class="input" type="password" name="password" placeholder="Password (min 8 chars)" />
      <div>
        <label class="block text-xs font-semibold text-ink-700 mb-1">Role</label>
        <select class="input" name="role">${options(ROLES, "DEALER")}</select>
        <p class="text-xs text-ink-500 mt-1">Dealers can add and manage stores on behalf of businesses.</p>
      </div>
      ${privilegeSelector(["MANAGE_LISTINGS"])}
      <button class="btn-primary w-full py-2.5" data-submit>Create user</button>
    </form>`,
  );
  const form = $("form", modal.body);
  wireRolePrivileges(form);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(form));
    const privileges = new FormData(form).getAll("privileges");
    submitModalForm(form, $("[data-submit]", form), "Creating…", async () => {
      await api.post("/admin/users", {
        firstName: f.firstName,
        lastName: f.lastName,
        email: f.email,
        password: f.password,
        role: f.role,
        ...(f.role === "DEALER" ? { privileges } : {}),
      });
      reloadWithFlash("User created.");
    });
  });
});

$$("[data-edit-user]").forEach((button) =>
  button.addEventListener("click", () => {
    const user = JSON.parse(button.dataset.editUser);
    const modal = openModal(
      `Edit ${user.firstName} ${user.lastName}`,
      `<form class="space-y-3">
        <div data-form-error></div>
        <div class="flex gap-3">
          <input class="input" name="firstName" value="${esc(user.firstName)}" placeholder="First name" />
          <input class="input" name="lastName" value="${esc(user.lastName)}" placeholder="Last name" />
        </div>
        <input class="input" type="email" name="email" value="${esc(user.email)}" placeholder="Email" />
        <div class="flex gap-3">
          <div class="w-1/2">
            <label class="block text-xs font-semibold text-ink-700 mb-1">Role</label>
            <select class="input" name="role">${options(ROLES, user.role)}</select>
          </div>
          <div class="w-1/2">
            <label class="block text-xs font-semibold text-ink-700 mb-1">Status</label>
            <select class="input" name="status">${options(STATUSES, user.status)}</select>
          </div>
        </div>
        ${privilegeSelector(user.privileges ?? [])}
        <button class="btn-primary w-full py-2.5" data-submit>Save changes</button>
      </form>`,
    );
    const form = $("form", modal.body);
    wireRolePrivileges(form);
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(form));
      const privileges = new FormData(form).getAll("privileges");
      submitModalForm(form, $("[data-submit]", form), "Saving…", async () => {
        await api.patch(`/admin/users/${user.id}`, {
          firstName: f.firstName,
          lastName: f.lastName,
          email: f.email,
          role: f.role,
          status: f.status,
          ...(f.role === "DEALER" ? { privileges } : {}),
        });
        reloadWithFlash("User updated.");
      });
    });
  }),
);

$$("[data-reset-password]").forEach((button) =>
  button.addEventListener("click", () => resetPasswordModal(JSON.parse(button.dataset.resetPassword))),
);

// Admin tops up (or deducts) a dealer's registration points and reviews the
// ledger of past movements.
const POINT_TYPES = {
  ADMIN_GRANT: ["Granted", "bg-emerald-50 text-emerald-700"],
  ADMIN_DEDUCTION: ["Deducted", "bg-red-50 text-red-700"],
  BUSINESS_CREATED: ["Business registered", "bg-brand-50 text-brand-700"],
};

$$("[data-points]").forEach((button) =>
  button.addEventListener("click", () => {
    const user = JSON.parse(button.dataset.points);
    let balance = user.points ?? 0;
    let mode = "grant";
    let changed = false;
    const modal = openModal(
      `Points — ${user.firstName} ${user.lastName}`,
      `<div class="space-y-4">
        <div class="rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 px-4 py-4 text-white">
          <p class="text-white/80 text-xs flex items-center gap-1.5">${icon("coins", { size: 14 })} Current balance</p>
          <p class="text-3xl font-extrabold mt-0.5" data-balance></p>
          <p class="text-white/80 text-xs mt-1" data-balance-note></p>
        </div>
        <form class="space-y-3">
          <div data-form-error></div>
          <div class="flex gap-2">
            <button type="button" data-mode="grant" class="flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors">${icon("plus", { size: 14, className: "inline -mt-0.5 mr-1" })} Add points</button>
            <button type="button" data-mode="deduct" class="flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors">${icon("minus", { size: 14, className: "inline -mt-0.5 mr-1" })} Deduct</button>
          </div>
          <div>
            <label class="block text-xs font-semibold text-ink-700 mb-1">Amount</label>
            <input required type="number" min="1" class="input" name="amount" value="10" />
            <div class="flex gap-2 mt-2">${[5, 10, 25, 50]
              .map((q) => `<button type="button" data-quick="${q}" class="badge bg-gray-100 text-gray-600 hover:bg-brand-50 hover:text-brand-700"></button>`)
              .join("")}</div>
          </div>
          <input class="input" name="note" placeholder="Note (optional, e.g. payment received)" />
          <button class="btn-primary w-full py-2.5" data-submit></button>
        </form>
        <div data-history></div>
      </div>`,
      // A changed balance shows in the list once the modal is closed.
      { onClose: () => changed && window.location.reload() },
    );
    const body = modal.body;
    const form = $("form", body);

    function paint() {
      $("[data-balance]", body).textContent = String(balance);
      $("[data-balance-note]", body).textContent = `Can register ${balance} more ${balance === 1 ? "business" : "businesses"} (1 point each).`;
      $$("[data-mode]", body).forEach((b) => {
        const on = b.dataset.mode === mode;
        b.className = `flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${
          on ? (mode === "grant" ? "bg-emerald-600 text-white border-emerald-600" : "bg-red-600 text-white border-red-600") : "border-gray-300 text-ink-600 hover:bg-gray-50"
        }`;
      });
      $$("[data-quick]", body).forEach((b) => (b.textContent = `${mode === "grant" ? "+" : "−"}${b.dataset.quick}`));
      $("[data-submit]", body).textContent = `${mode === "grant" ? "Add" : "Deduct"} ${form.amount.value || 0} points`;
    }

    async function loadHistory() {
      try {
        const { data: history } = await api.get(`/admin/users/${user.id}/points/transactions`, { pageSize: 8 });
        $("[data-history]", body).innerHTML = history.length
          ? `<p class="text-xs font-bold uppercase tracking-wide text-ink-500 mb-2">Recent activity</p>
            <div class="border border-gray-100 rounded-lg divide-y divide-gray-100 max-h-56 overflow-y-auto">${history
              .map((t) => {
                const [text, tint] = POINT_TYPES[t.type] ?? [t.type, "bg-gray-100 text-gray-600"];
                return `<div class="px-3 py-2 flex items-center justify-between gap-2">
                  <div class="min-w-0">
                    <span class="badge ${tint}">${esc(text)}</span>
                    ${t.note ? `<p class="text-xs text-ink-500 truncate mt-1">${esc(t.note)}</p>` : ""}
                    <p class="text-[11px] text-ink-400">${esc(formatDateTime(t.createdAt))}</p>
                  </div>
                  <div class="text-right shrink-0">
                    <p class="font-bold text-sm ${t.amount > 0 ? "text-emerald-700" : "text-red-600"}">${t.amount > 0 ? `+${t.amount}` : t.amount}</p>
                    <p class="text-[11px] text-ink-400">bal ${t.balanceAfter}</p>
                  </div>
                </div>`;
              })
              .join("")}</div>`
          : "";
      } catch {
        // history is a nicety; the balance still updates
      }
    }

    $$("[data-mode]", body).forEach((b) =>
      b.addEventListener("click", () => {
        mode = b.dataset.mode;
        paint();
      }),
    );
    $$("[data-quick]", body).forEach((b) =>
      b.addEventListener("click", () => {
        form.amount.value = b.dataset.quick;
        paint();
      }),
    );
    form.amount.addEventListener("input", paint);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const value = Number(form.amount.value);
      const errors = $("[data-form-error]", form);
      if (!Number.isFinite(value) || value <= 0) {
        errors.innerHTML = alertBox("Enter a number greater than zero");
        return;
      }
      const submit = $("[data-submit]", form);
      submit.disabled = true;
      submit.textContent = "Saving…";
      errors.innerHTML = "";
      try {
        const { data: updated } = await api.patch(`/admin/users/${user.id}/points`, {
          amount: mode === "grant" ? value : -value,
          note: form.note.value || undefined,
        });
        balance = updated.points ?? 0;
        changed = true;
        form.note.value = "";
        loadHistory();
      } catch (err) {
        errors.innerHTML = alertBox(errorMessage(err));
      } finally {
        submit.disabled = false;
        paint();
      }
    });

    paint();
    loadHistory();
  }),
);

// --- Businesses -------------------------------------------------------------------
$$("[data-business-action]").forEach((button) =>
  button.addEventListener("click", async () => {
    button.disabled = true;
    try {
      await api.post(`/admin/businesses/${button.dataset.id}/${button.dataset.businessAction}`);
      window.location.reload();
    } catch (err) {
      button.disabled = false;
      fail(err);
    }
  }),
);

$$("[data-edit-business]").forEach((button) =>
  button.addEventListener("click", () => {
    const b = JSON.parse(button.dataset.editBusiness);
    const categories = pageData("admin-categories") ?? [];
    const modal = openModal(
      `Edit ${b.name}`,
      `<form class="space-y-3">
        <div data-form-error></div>
        <input class="input" name="name" value="${esc(b.name)}" placeholder="Business name" />
        <select class="input" name="categoryId">
          <option value="">Select category</option>
          ${categories.map((c) => `<option value="${esc(c.id)}" ${c.id === b.category?.id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}
        </select>
        <div class="flex gap-3">
          <input class="input" name="city" value="${esc(b.city)}" placeholder="City" />
          <input class="input" name="state" value="${esc(b.state)}" placeholder="State" />
        </div>
        <input class="input" name="phone" value="${esc(b.phone)}" placeholder="Phone" />
        <div class="flex gap-3">
          <div class="w-1/2">
            <label class="block text-xs font-semibold text-ink-700 mb-1">Status</label>
            <select class="input" name="status">${options(BIZ_STATUSES, b.status)}</select>
          </div>
          <label class="w-1/2 flex items-end gap-2 pb-2.5 text-sm text-ink-700">
            <input type="checkbox" name="isVerified" ${b.isVerified ? "checked" : ""} /> Verified business
          </label>
        </div>
        <button class="btn-primary w-full py-2.5" data-submit>Save changes</button>
      </form>`,
    );
    const form = $("form", modal.body);
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      submitModalForm(form, $("[data-submit]", form), "Saving…", async () => {
        await api.patch(`/admin/businesses/${b.id}`, {
          name: form.name.value,
          categoryId: form.categoryId.value,
          city: form.city.value,
          state: form.state.value,
          phone: form.phone.value,
          status: form.status.value,
          isVerified: form.isVerified.checked,
        });
        reloadWithFlash("Business updated.");
      });
    });
  }),
);

$$("[data-reassign]").forEach((button) =>
  button.addEventListener("click", () => {
    const b = JSON.parse(button.dataset.reassign);
    const modal = openModal(
      `Reassign “${b.name}”`,
      `<p class="text-sm text-ink-500 mb-3">Current owner: <span class="font-medium text-ink-800">${esc(b.owner ? `${b.owner.firstName} ${b.owner.lastName}` : "—")}</span>. Choose a new owner (business owner, dealer, or admin).</p>
      <div data-form-error></div>
      <div class="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 mb-3">
        ${icon("search", { size: 16, className: "text-gray-400" })}
        <input data-owner-search placeholder="Search owners/dealers…" class="w-full py-2.5 text-sm focus:outline-none" />
      </div>
      <div class="max-h-72 overflow-y-auto divide-y divide-gray-100 border border-gray-100 rounded-lg" data-candidates></div>`,
    );
    const list = $("[data-candidates]", modal.body);
    const roleBadge = (role) =>
      ({ ADMIN: "bg-brand-50 text-brand-700", DEALER: "bg-violet-50 text-violet-700", BUSINESS_OWNER: "bg-sky-50 text-sky-700" })[role] ?? "bg-gray-100 text-gray-600";

    async function search(term) {
      list.innerHTML = `<div class="flex items-center justify-center gap-2 py-8 text-sm text-ink-500">${icon("loader-2", { size: 16, className: "animate-spin" })} Searching…</div>`;
      try {
        const { data } = await api.get("/admin/users", { search: term || undefined });
        const candidates = data.filter((u) => ["BUSINESS_OWNER", "DEALER", "ADMIN"].includes(u.role) && u.id !== b.owner?.id);
        list.innerHTML = candidates.length
          ? candidates
              .map(
                (u) => `<div class="p-3 flex items-center justify-between gap-2">
                <div class="min-w-0">
                  <p class="text-sm font-medium text-ink-900 truncate">${esc(u.firstName)} ${esc(u.lastName)} <span class="badge ${roleBadge(u.role)} !px-1.5 !py-0">${label(u.role)}</span></p>
                  <p class="text-xs text-ink-500 truncate">${esc(u.email ?? u.phone ?? "")}</p>
                </div>
                <button type="button" data-assign="${esc(u.id)}" class="btn-primary px-3 py-1.5 text-sm shrink-0">Assign</button>
              </div>`,
              )
              .join("")
          : '<div class="p-6 text-center text-sm text-ink-500">No eligible owners found.</div>';
      } catch (err) {
        list.innerHTML = alertBox(errorMessage(err));
      }
    }

    let timer;
    $("[data-owner-search]", modal.body).addEventListener("input", (e) => {
      clearTimeout(timer);
      timer = setTimeout(() => search(e.target.value), 250);
    });
    list.addEventListener("click", async (e) => {
      const assign = e.target.closest("[data-assign]");
      if (!assign) return;
      $$("[data-assign]", list).forEach((x) => (x.disabled = true));
      assign.textContent = "…";
      try {
        await api.post(`/admin/businesses/${b.id}/reassign`, { ownerId: assign.dataset.assign });
        reloadWithFlash("Business reassigned.");
      } catch (err) {
        $("[data-form-error]", modal.body).innerHTML = alertBox(errorMessage(err));
        $$("[data-assign]", list).forEach((x) => (x.disabled = false));
        assign.textContent = "Assign";
      }
    });
    search("");
  }),
);

// --- QR boards ----------------------------------------------------------------------
// A printable sheet of boards, each showing its QR and the code beneath it so a
// shop can still type it in if the camera struggles.
function printSheet(codes, purpose, onClose) {
  const modal = openModal(
    `${codes.length} QR ${codes.length === 1 ? "board" : "boards"} ready to print`,
    `<p class="mb-3 text-sm text-ink-600">Print these and hand them out. A shop scans one, confirms the code, and attaches it to their listing.</p>
    <div id="qr-board" class="grid grid-cols-2 gap-4"><p class="col-span-2 py-6 text-center text-sm text-ink-500">Rendering codes…</p></div>
    <button type="button" data-print class="btn-primary mt-4 w-full py-2.5">${icon("printer", { size: 15 })} Print sheet</button>`,
    { onClose },
  );
  Promise.all(codes.map((code) => renderQrDataUrl(boardUrl(code), 320).then((dataUrl) => ({ code, dataUrl }))))
    .then((images) => {
      $("#qr-board", modal.body).innerHTML = images
        .map(
          (item) => `<div class="rounded-xl border-2 border-dashed border-gray-200 p-3 text-center">
          <p class="text-[9px] font-bold uppercase tracking-widest text-brand-600">Loved your visit?</p>
          <p class="text-[11px] font-semibold text-ink-700">${esc(boardHeadline(purpose))}</p>
          <img src="${item.dataUrl}" alt="${esc(item.code)}" class="mx-auto my-1.5 h-28 w-28" />
          <p class="font-mono text-xs font-bold text-ink-900">${esc(item.code)}</p>
          <p class="text-[8px] uppercase tracking-wider text-ink-400">Powered by Markkito</p>
        </div>`,
        )
        .join("");
    })
    .catch(() => undefined);
  $("[data-print]", modal.body).addEventListener("click", () => window.print());
}

$$("[data-print-codes]").forEach((button) =>
  button.addEventListener("click", () => printSheet(JSON.parse(button.dataset.printCodes), button.dataset.purpose || null)),
);
$$("[data-qr-png]").forEach((button) =>
  button.addEventListener("click", () =>
    renderQrDataUrl(boardUrl(button.dataset.qrPng))
      .then((d) => downloadDataUrl(d, `${button.dataset.qrPng}-qr.png`))
      .catch(() => showError(errorBox, "Could not generate that QR image.")),
  ),
);
$$("[data-qr-update]").forEach((button) =>
  button.addEventListener("click", async () => {
    try {
      await api.patch(`/admin/qr-codes/${button.dataset.qrUpdate}`, JSON.parse(button.dataset.payload));
      reloadWithFlash(button.dataset.message);
    } catch (err) {
      fail(err);
    }
  }),
);

$("[data-generate-boards]")?.addEventListener("click", () => {
  const modal = openModal(
    "Generate QR boards",
    `<form class="space-y-3">
      <div data-form-error></div>
      <p class="text-sm text-ink-600">Each board gets a unique code. Print them and hand them out — the dealer or shop chooses what the board points at when they attach it to a listing.</p>
      <div>
        <label class="mb-1 block text-xs font-semibold text-ink-700">How many boards? (max 500)</label>
        <input required type="number" min="1" max="500" class="input" name="count" value="20" />
      </div>
      <div>
        <label class="mb-1 block text-xs font-semibold text-ink-700">Batch label (optional)</label>
        <input class="input" name="batchLabel" placeholder="e.g. Kochi run 1" />
      </div>
      <button class="btn-primary w-full py-2.5" data-submit>Generate 20 boards</button>
    </form>`,
  );
  const form = $("form", modal.body);
  const submit = $("[data-submit]", form);
  form.count.addEventListener("input", () => (submit.textContent = `Generate ${form.count.value || 0} boards`));
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    submitModalForm(form, submit, "Generating…", async () => {
      // No purpose is set here: a blank board works for any shop, and what it
      // points at is chosen by the dealer or shop when they attach it.
      const { data: result } = await api.post("/admin/qr-codes/batch", {
        count: Number(form.count.value),
        batchLabel: form.batchLabel.value || undefined,
      });
      modal.close();
      // The new boards print straight away; the list refreshes once the
      // sheet is closed.
      printSheet(result.codes, null, () => reloadWithFlash(`Generated ${result.created} new QR boards.`));
    });
  });
});

// --- Analytics ----------------------------------------------------------------------
function timeAgo(iso) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}
const paintTimes = (root = document) => $$("[data-time-ago]", root).forEach((el) => (el.textContent = timeAgo(el.dataset.timeAgo)));

const onlineList = $("[data-online-list]");
if (onlineList) {
  paintTimes(onlineList);
  setInterval(async () => {
    try {
      const res = await fetch("/admin/online", { headers: { Accept: "text/html" }, credentials: "same-origin" });
      if (!res.ok) return;
      onlineList.innerHTML = await res.text();
      $("[data-online-count]").textContent = `${res.headers.get("X-Online-Count") ?? 0} active`;
      paintTimes(onlineList);
    } catch {
      // keep showing the last list
    }
  }, 15000);
}
