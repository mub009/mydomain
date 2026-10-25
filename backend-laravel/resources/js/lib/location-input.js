import { api } from "./api";
import { $, esc } from "./ui";

const RECENTS_KEY = "mydomain-recent-locations";
const MAX_RECENTS = 5;

function loadRecents() {
  try {
    return JSON.parse(localStorage.getItem(RECENTS_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveRecents(list) {
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(list));
  } catch {
    // localStorage unavailable — recents just won't persist
  }
}

let trendingPromise = null;
const trending = () => (trendingPromise ??= api.get("/search/cities").then((r) => r.data).catch(() => []));

/**
 * Wires one <x-location-input>. `onCommit(city)` fires when a city is
 * typed (on change) or picked; `onDetect(lat, lng, label)` when the
 * browser's location is used.
 */
export function initLocationInput(root, { onCommit, onDetect, onInput } = {}) {
  const field = $("[data-location-field]", root);
  const menu = $("[data-location-menu]", root);
  const detectLabel = $("[data-detect-label]", root);
  const detectIcon = $("[data-detect] svg", root);
  const detectError = $("[data-detect-error]", root);
  let recents = loadRecents();
  let cities = [];
  let closeTimer;

  function render() {
    $("[data-recents]", root).hidden = recents.length === 0;
    $("[data-recents-list]", root).innerHTML = recents
      .map((r) => `<button type="button" data-city="${esc(r)}" class="w-full text-left px-4 py-2 text-sm text-ink-800 hover:bg-gray-50 transition-colors">${esc(r)}</button>`)
      .join("");
    $("[data-trending]", root).hidden = cities.length === 0;
    $("[data-trending-list]", root).innerHTML = cities
      .map(
        (t) =>
          `<button type="button" data-city="${esc(t.city)}" class="w-full text-left px-4 py-2 text-sm text-ink-800 hover:bg-gray-50 transition-colors flex items-center justify-between"><span>${esc(t.city)}, ${esc(t.state)}</span><span class="text-xs text-ink-500">${t.businessCount}</span></button>`,
      )
      .join("");
    $("[data-location-empty]", root).hidden = recents.length > 0 || cities.length > 0 || !detectError.hidden;
  }

  trending().then((list) => {
    cities = list || [];
    render();
  });
  render();

  function commit(city) {
    field.value = city;
    if (city.trim()) {
      recents = [city, ...recents.filter((r) => r.toLowerCase() !== city.toLowerCase())].slice(0, MAX_RECENTS);
      saveRecents(recents);
      render();
    }
    menu.hidden = true;
    onCommit?.(city);
  }

  const open = () => {
    clearTimeout(closeTimer);
    menu.hidden = false;
  };
  field.addEventListener("focus", open);
  field.addEventListener("click", open);
  field.addEventListener("blur", () => {
    closeTimer = setTimeout(() => (menu.hidden = true), 150);
  });
  field.addEventListener("input", () => onInput?.(field.value));
  field.addEventListener("change", () => onCommit?.(field.value));
  field.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && root.closest("form") === null) {
      e.preventDefault();
      commit(field.value);
    }
  });

  // Keep focus in the field while clicking inside the menu.
  menu.addEventListener("mousedown", (e) => e.preventDefault());
  menu.addEventListener("click", (e) => {
    const cityButton = e.target.closest("[data-city]");
    if (cityButton) return commit(cityButton.dataset.city);
    if (e.target.closest("[data-clear-recents]")) {
      e.stopPropagation();
      recents = [];
      saveRecents([]);
      render();
      return;
    }
    if (e.target.closest("[data-detect]")) detect();
  });

  function detect() {
    detectError.hidden = true;
    if (!navigator.geolocation) {
      detectError.textContent = "Geolocation isn't supported by this browser.";
      detectError.hidden = false;
      return render();
    }
    detectLabel.textContent = "Detecting your location…";
    detectIcon?.classList.add("animate-pulse");
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        let label = "Current location";
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 4000);
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10`,
            { signal: controller.signal, headers: { Accept: "application/json" } },
          );
          clearTimeout(timeout);
          if (res.ok) {
            const addr = (await res.json())?.address ?? {};
            label = addr.city || addr.town || addr.village || addr.county || label;
          }
        } catch {
          // reverse geocoding is best-effort; fall back to a generic label
        }
        detectLabel.textContent = "Detect my location";
        detectIcon?.classList.remove("animate-pulse");
        field.value = label;
        menu.hidden = true;
        onDetect?.(latitude, longitude, label);
      },
      (err) => {
        detectLabel.textContent = "Detect my location";
        detectIcon?.classList.remove("animate-pulse");
        detectError.textContent = err.code === err.PERMISSION_DENIED ? "Location access denied." : "Couldn't detect your location.";
        detectError.hidden = false;
        render();
      },
      { enableHighAccuracy: false, timeout: 8000 },
    );
  }
}
