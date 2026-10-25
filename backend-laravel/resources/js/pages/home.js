import { initLocationInput } from "../lib/location-input";
import { $, $$, pageData, setLocation } from "../lib/ui";
import { initPromoCarousel } from "../lib/promo-carousel";

const data = pageData("home-data") ?? { placeholderTerms: [] };

// Rotating placeholder examples in the search box.
const searchField = $("[data-search-field]");
if (searchField && data.placeholderTerms.length > 0) {
  let index = 0;
  setInterval(() => {
    index += 1;
    searchField.placeholder = `Search for ${data.placeholderTerms[index % data.placeholderTerms.length]}…`;
  }, 2200);
}

// A typed or picked city is remembered so listing pages open filtered to
// it; detecting the browser's location re-ranks this page by distance.
const locationRoot = $("[data-location-input]");
if (locationRoot) {
  initLocationInput(locationRoot, {
    onCommit: (city) => setLocation({ city: city.trim(), geo: null }),
    onDetect: (lat, lng) => {
      setLocation({ geo: { lat, lng } });
      window.location.reload();
    },
  });
}

// Remember whatever is in the city box when the search is submitted. An
// empty box leaves a saved "near me" point alone.
$("[data-home-search]")?.addEventListener("submit", (e) => {
  const city = $("[data-location-field]", e.currentTarget)?.value.trim() ?? "";
  setLocation({ city });
  // Drop an empty q so the URL stays clean.
  if (searchField && !searchField.value.trim()) searchField.disabled = true;
});

$$("[data-promo]").forEach(initPromoCarousel);
