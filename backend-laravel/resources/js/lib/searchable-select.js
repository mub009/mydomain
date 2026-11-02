import { icon } from "./icons";
import { esc } from "./ui";

// Turns a native <select> into a drop-down with a search box. The select
// stays in the form (invisible, under the button) so it still submits its
// value and shows the browser's "please select" bubble when required.
// Call refresh() after changing the select's options or disabled state.

export function searchableSelect(select, { placeholder = "Search…" } = {}) {
  const wrap = document.createElement("div");
  wrap.className = "relative min-w-0";
  select.parentNode.insertBefore(wrap, select);
  wrap.append(select);
  select.tabIndex = -1;
  select.setAttribute("aria-hidden", "true");
  select.classList.add("pointer-events-none", "absolute", "inset-0", "opacity-0");

  wrap.insertAdjacentHTML(
    "beforeend",
    `<button type="button" class="input flex w-full min-w-0 items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:opacity-60" aria-haspopup="listbox" aria-expanded="false" data-ss-trigger>
      <span class="truncate" data-ss-label></span>
      ${icon("chevron-down", { size: 16, className: "shrink-0 text-ink-400" })}
    </button>
    <div class="absolute left-0 right-0 z-50 mt-1 rounded-lg border border-gray-200 bg-white shadow-lg" data-ss-panel hidden>
      <div class="flex items-center gap-2 border-b border-gray-100 px-3">
        ${icon("search", { size: 15, className: "shrink-0 text-ink-400" })}
        <input type="text" class="w-full py-2 text-sm focus:outline-none" placeholder="${esc(placeholder)}" autocomplete="off" data-ss-search />
      </div>
      <ul class="max-h-60 overflow-y-auto py-1 text-sm" role="listbox" data-ss-list></ul>
    </div>`,
  );
  const trigger = wrap.querySelector("[data-ss-trigger]");
  const label = wrap.querySelector("[data-ss-label]");
  const panel = wrap.querySelector("[data-ss-panel]");
  const search = wrap.querySelector("[data-ss-search]");
  const list = wrap.querySelector("[data-ss-list]");
  let shown = [];
  let active = 0;

  // The empty "Select …" option is the prompt, not a choice.
  const choices = () => [...select.options].filter((o) => o.value !== "");
  const prompt = () => [...select.options].find((o) => o.value === "")?.textContent ?? "Select";

  function refresh() {
    const current = select.selectedOptions[0];
    const chosen = current && current.value !== "";
    label.textContent = chosen ? current.textContent : prompt();
    label.classList.toggle("text-ink-400", !chosen);
    trigger.disabled = select.disabled;
    if (select.disabled) close();
  }

  function render() {
    const term = search.value.trim().toLowerCase();
    const all = choices();
    // Names that start with the search first, then ones that contain it;
    // "Other" style entries (non-listed values) always stay at the end.
    shown = term
      ? [
          ...all.filter((o) => o.textContent.toLowerCase().startsWith(term)),
          ...all.filter((o) => !o.textContent.toLowerCase().startsWith(term) && o.textContent.toLowerCase().includes(term)),
        ]
      : all;
    const pinned = all.filter((o) => o.dataset.pinned && !shown.includes(o));
    shown = [...shown, ...pinned];
    active = Math.max(0, shown.findIndex((o) => o.value === select.value));
    list.innerHTML = shown.length
      ? shown
          .map(
            (o, i) =>
              `<li role="option" data-i="${i}" aria-selected="${o.value === select.value}" class="flex cursor-pointer items-center justify-between gap-2 px-3 py-2 ${i === active ? "bg-brand-50 text-brand-700" : "text-ink-700"} ${o.dataset.pinned ? "border-t border-gray-100 font-medium" : ""}">
                <span class="truncate">${esc(o.textContent)}</span>
                ${o.value === select.value ? icon("check", { size: 14, className: "shrink-0 text-brand-600" }) : ""}
              </li>`,
          )
          .join("")
      : `<li class="px-3 py-3 text-ink-400">No matches</li>`;
    list.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }

  function highlight(i) {
    if (!shown.length) return;
    active = (i + shown.length) % shown.length;
    list.querySelectorAll("[data-i]").forEach((li) => {
      const on = Number(li.dataset.i) === active;
      li.classList.toggle("bg-brand-50", on);
      li.classList.toggle("text-brand-700", on);
      li.classList.toggle("text-ink-700", !on);
      if (on) li.scrollIntoView({ block: "nearest" });
    });
  }

  function open(initial = "") {
    if (select.disabled || !panel.hidden) return;
    panel.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    search.value = initial;
    render();
    search.focus();
  }

  function close() {
    if (panel.hidden) return;
    panel.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
  }

  function choose(option) {
    close();
    trigger.focus();
    if (!option || option.value === select.value) return;
    select.value = option.value;
    refresh();
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }

  trigger.addEventListener("click", () => (panel.hidden ? open() : close()));
  trigger.addEventListener("keydown", (e) => {
    if (["Enter", " ", "ArrowDown"].includes(e.key)) {
      e.preventDefault();
      open();
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // Typing on the closed drop-down starts a search with that letter.
      e.preventDefault();
      open(e.key);
    }
  });
  search.addEventListener("input", render);
  search.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      highlight(active + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      highlight(active - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(shown[active]);
    } else if (e.key === "Escape") {
      // Closes just the list, not a pop-up form it sits in.
      e.preventDefault();
      e.stopPropagation();
      close();
      trigger.focus();
    } else if (e.key === "Tab") {
      close();
    }
  });
  // mousedown, so the pick lands before the search box loses focus.
  list.addEventListener("mousedown", (e) => {
    const li = e.target.closest("[data-i]");
    if (!li) return;
    e.preventDefault();
    choose(shown[Number(li.dataset.i)]);
  });
  document.addEventListener("mousedown", (e) => {
    if (!wrap.contains(e.target)) close();
  });
  // The browser's "required" bubble points at the hidden select; send the
  // owner to the button instead.
  select.addEventListener("invalid", () => trigger.focus());
  select.addEventListener("change", refresh);

  refresh();
  return { refresh };
}
