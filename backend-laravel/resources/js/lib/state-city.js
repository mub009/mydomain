import { api } from "./api";
import { searchableSelect } from "./searchable-select";
import { $, $$, esc } from "./ui";

// State and City drop-downs (resources/views/components/state-city.blade.php,
// or stateCityFields() for forms built in JS). States and their cities come
// from /locations once per page; the city list follows the chosen state,
// and "Other" swaps in a text box for a town that isn't listed. Whichever
// of the city select / text box is in use carries name="city", so forms
// read it as before (FormData or form.city).

const OTHER = "__other";
let loading = null;
const loadLocations = () =>
  (loading ??= api
    .get("/locations")
    .then((res) => res.data)
    .catch((err) => {
      loading = null;
      throw err;
    }));

const option = (value, label = value, selected = false) =>
  `<option value="${esc(value)}"${selected ? " selected" : ""}>${esc(label)}</option>`;

// The same markup as the Blade component, for forms built in JS.
export function stateCityFields({ state = "", city = "", required = true } = {}) {
  const req = required ? " required" : "";
  return `<div class="contents" data-state-city data-state="${esc(state ?? "")}" data-city="${esc(city ?? "")}">
    <div class="min-w-0">
      <select name="state" class="input min-w-0" data-state-select${req}>
        ${option("", "Select state")}${state ? option(state, state, true) : ""}
      </select>
    </div>
    <div class="min-w-0">
      <select name="city" class="input min-w-0" data-city-select${req}>
        ${option("", "Select city")}${city ? option(city, city, true) : ""}
      </select>
      <input class="input mt-2 min-w-0" maxlength="100" placeholder="Type your city / town" data-city-other hidden />
    </div>
  </div>`;
}

export function initStateCity(root = document) {
  $$("[data-state-city]", root).forEach(async (box) => {
    if (box.dataset.wired) return;
    box.dataset.wired = "1";
    const stateSelect = $("[data-state-select]", box);
    const citySelect = $("[data-city-select]", box);
    const other = $("[data-city-other]", box);
    const required = citySelect.required;

    let states;
    try {
      states = await loadLocations();
    } catch {
      return; // Keeps the saved values as the only options.
    }

    const savedState = box.dataset.state || "";
    const savedCity = box.dataset.city || "";
    const names = states.map((s) => s.name);
    stateSelect.innerHTML =
      option("", "Select state") +
      (savedState && !names.includes(savedState) ? option(savedState, savedState, true) : "") +
      names.map((name) => option(name, name, name === savedState)).join("");

    // Drop-downs with a search box (the selects stay in the form).
    searchableSelect(stateSelect, { placeholder: "Search state…" });
    const cityPicker = searchableSelect(citySelect, { placeholder: "Search city…" });

    const useOther = (on, value = "") => {
      other.hidden = !on;
      other.required = on && required;
      if (on) {
        citySelect.removeAttribute("name");
        other.name = "city";
        other.value = value;
      } else {
        other.removeAttribute("name");
        citySelect.name = "city";
      }
    };

    const fillCities = (selected) => {
      const cities = states.find((s) => s.name === stateSelect.value)?.cities ?? [];
      const listed = !selected || cities.includes(selected);
      citySelect.disabled = !stateSelect.value;
      citySelect.innerHTML =
        option("", stateSelect.value ? "Select city" : "Select state first") +
        cities.map((name) => option(name, name, name === selected)).join("") +
        `<option value="${OTHER}" data-pinned="1"${listed ? "" : " selected"}>Other — type it</option>`;
      useOther(!listed, listed ? "" : selected);
      cityPicker.refresh();
    };

    stateSelect.addEventListener("change", () => fillCities(""));
    citySelect.addEventListener("change", () => {
      const on = citySelect.value === OTHER;
      useOther(on);
      if (on) other.focus();
    });
    fillCities(savedCity);
  });
}
