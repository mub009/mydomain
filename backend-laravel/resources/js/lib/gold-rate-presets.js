// The built-in looks for a gold-rate box, in groups, for the editor's
// "Design presets". A preset only sets how a box looks — never where it is
// or how big. Sizes are fractions of the box height (radius, border,
// fontScale), so each preset suits a box of any size. Keys left out take
// BASE; colours are #rrggbb (see TemplateLayout on the server).

export const PRESET_GROUPS = [
  { id: "gold", name: "Classic Gold" },
  { id: "royal", name: "Royal Maroon" },
  { id: "dark", name: "Dark Luxury" },
  { id: "minimal", name: "Minimal" },
  { id: "festive", name: "Festive" },
  { id: "modern", name: "Modern Colour" },
  { id: "ribbons", name: "Ribbons & Tags" },
];

const BASE = {
  design: "plain",
  background: null,
  background2: null,
  gradientDirection: "vertical",
  radius: 0,
  borderColor: null,
  border: 0,
  shadow: false,
  color: "#111111",
  labelColor: null,
  labelBackground: null,
  labelBackground2: null,
  splitRatio: 0.45,
  fontWeight: 700,
  text: "{label}: {currency}{rate}",
  align: "center",
  shape: "rect",
  glowColor: null,
  uppercase: false,
  fontScale: 0.48,
};
// Label | price designs show only the price in the price part.
const SPLIT = { design: "split", text: "{currency}{rate}" };

// `onDark` marks a look meant for a dark photo; its thumbnail is shown on dark.
const preset = (group, id, name, style, onDark = false) => ({ group, id, name, onDark, style: { ...BASE, ...style } });

export const PRESETS = [
  // --- Classic Gold ---------------------------------------------------------
  preset("gold", "gold-pill", "Gold pill", { background: "#f9e08b", background2: "#d4a017", radius: 0.5, shadow: true, color: "#3b2300", fontWeight: 800, text: "{label}  {currency}{rate}" }),
  preset("gold", "gold-bar", "Gold bar", { background: "#fbe7a1", background2: "#c9971c", radius: 0.12, borderColor: "#8a6400", border: 0.03, shadow: true, color: "#3b2300", fontWeight: 800, text: "{label}  {currency}{rate}" }),
  preset("gold", "gold-foil", "Gold foil", { background: "#fff3c4", background2: "#d4a017", gradientDirection: "diagonal", radius: 0.5, borderColor: "#fff7da", border: 0.04, shadow: true, color: "#4a2c00", fontWeight: 800, uppercase: true }),
  preset("gold", "gold-split", "Gold split", { ...SPLIT, background: "#fffaf0", labelBackground: "#e0b23a", labelBackground2: "#a87b0f", labelColor: "#ffffff", color: "#7a5200", radius: 0.2, borderColor: "#d4a017", border: 0.03, shadow: true, fontWeight: 800 }),
  preset("gold", "gold-outline", "Gold outline", { radius: 0.5, borderColor: "#f2c94c", border: 0.05, color: "#f2c94c", shadow: true, fontWeight: 800 }, true),
  preset("gold", "gold-glow", "Gold glow", { color: "#ffd778", glowColor: "#ffb300", fontWeight: 800, uppercase: true }, true),
  preset("gold", "antique-gold", "Antique gold", { ...SPLIT, background: "#f5ecd7", labelBackground: "#8c6a1f", labelColor: "#f5ecd7", color: "#5b4310", borderColor: "#8c6a1f", border: 0.03, fontFamily: "Playfair Display" }),
  preset("gold", "gold-coin", "Gold coin", { background: "#ffe083", background2: "#b8860b", radius: 0.5, borderColor: "#8a6400", border: 0.06, shadow: true, color: "#3b2300", fontWeight: 900 }),

  // --- Royal Maroon ---------------------------------------------------------
  preset("royal", "ribbon", "Maroon ribbon", { background: "#7a1f2b", background2: "#4a0f18", borderColor: "#ffd778", border: 0.035, shadow: true, color: "#ffd778", text: "{label} · {currency}{rate}" }),
  preset("royal", "two-tone", "Two-tone", { ...SPLIT, background: "#fff1cc", radius: 0.14, shadow: true, color: "#7a1f2b", labelColor: "#ffffff", labelBackground: "#7a1f2b", fontWeight: 800 }),
  preset("royal", "royal-velvet", "Royal velvet", { background: "#6d0f1f", background2: "#3a0610", radius: 0.15, borderColor: "#d4a017", border: 0.04, shadow: true, color: "#ffd778", fontFamily: "Playfair Display" }),
  preset("royal", "maharaja", "Maharaja", { ...SPLIT, background: "#3a0610", labelBackground: "#e0b23a", labelBackground2: "#b8860b", labelColor: "#3a0610", color: "#ffd778", radius: 0.5, shadow: true, fontFamily: "Playfair Display", fontWeight: 800 }),
  preset("royal", "maroon-card", "Maroon card", { ...SPLIT, background: "#fff6e9", labelBackground: "#7a1f2b", labelColor: "#ffd778", color: "#7a1f2b", radius: 0.12, borderColor: "#7a1f2b", border: 0.03 }),
  preset("royal", "temple", "Temple", { shape: "chamfer", radius: 0.3, background: "#7a1f2b", borderColor: "#ffd778", border: 0.05, color: "#ffd778", uppercase: true, fontFamily: "Playfair Display" }),
  preset("royal", "crimson-pill", "Crimson pill", { background: "#b3122e", background2: "#7a0c1f", radius: 0.5, shadow: true, color: "#ffffff", fontWeight: 800 }),

  // --- Dark Luxury ----------------------------------------------------------
  preset("dark", "dark-badge", "Dark badge", { ...SPLIT, background: "#1a1a1a", radius: 0.18, borderColor: "#d4a017", border: 0.04, shadow: true, color: "#ffd778", labelColor: "#1a1a1a", labelBackground: "#d4a017", splitRatio: 0.42, fontWeight: 800 }),
  preset("dark", "black-gold", "Black & gold", { background: "#2a2a2a", background2: "#000000", radius: 0.14, borderColor: "#d4a017", border: 0.035, shadow: true, color: "#ffd778", glowColor: "#b8860b" }),
  preset("dark", "onyx-split", "Onyx", { ...SPLIT, background: "#111111", labelBackground: "#2b2b2b", labelColor: "#d4a017", color: "#ffffff", radius: 0.2, borderColor: "#3a3a3a", border: 0.03, uppercase: true }),
  preset("dark", "midnight", "Midnight", { background: "#0f1b3d", background2: "#060b1c", radius: 0.5, borderColor: "#c9a227", border: 0.04, shadow: true, color: "#ffd778" }),
  preset("dark", "emerald-lux", "Emerald luxe", { ...SPLIT, background: "#0b3d2e", labelBackground: "#d4a017", labelColor: "#0b3d2e", color: "#ffe9a8", radius: 0.16, shadow: true, fontFamily: "Playfair Display" }),
  preset("dark", "noir-glow", "Noir glow", { background: "#000000", radius: 0.08, color: "#fff2c2", glowColor: "#ffcc4d", uppercase: true, fontWeight: 800 }),
  preset("dark", "carbon", "Carbon tag", { ...SPLIT, shape: "chamfer", radius: 0.25, background: "#222222", background2: "#111111", labelBackground: "#e0b23a", labelBackground2: "#9c7410", labelColor: "#111111", color: "#ffd778", fontWeight: 800 }),
  preset("dark", "royal-blue-gold", "Royal blue", { background: "#13225c", background2: "#0a1436", radius: 0.14, borderColor: "#d4a017", border: 0.04, shadow: true, color: "#ffd778", fontFamily: "Playfair Display" }),

  // --- Minimal --------------------------------------------------------------
  preset("minimal", "plain", "Plain text", {}),
  preset("minimal", "outlined", "Outlined card", { ...SPLIT, background: "#fffdf5", radius: 0.22, borderColor: "#c9a227", border: 0.05, color: "#111111", labelColor: "#8a6400", align: "right" }),
  preset("minimal", "white-card", "White card", { ...SPLIT, background: "#ffffff", radius: 0.2, shadow: true, color: "#111827", labelColor: "#6b7280", align: "right" }),
  preset("minimal", "soft-cream", "Soft cream", { background: "#fff8e7", radius: 0.5, borderColor: "#f0dfb4", border: 0.03, color: "#5b4310" }),
  preset("minimal", "slate", "Slate", { ...SPLIT, background: "#f1f5f9", labelBackground: "#334155", labelColor: "#ffffff", color: "#0f172a", radius: 0.14 }),
  preset("minimal", "mono-dark", "Mono dark", { background: "#111827", radius: 0.2, color: "#ffffff", fontWeight: 600 }),
  preset("minimal", "white-shadow", "White on photo", { color: "#ffffff", shadow: true, fontWeight: 800 }, true),

  // --- Festive --------------------------------------------------------------
  preset("festive", "diwali", "Diwali", { background: "#ff9933", background2: "#c2410c", radius: 0.5, borderColor: "#ffd700", border: 0.04, shadow: true, color: "#fff8dc", glowColor: "#ffcc00", fontWeight: 800 }),
  preset("festive", "onam", "Onam", { ...SPLIT, background: "#fff9e6", labelBackground: "#2e7d32", labelColor: "#ffe082", color: "#1b5e20", radius: 0.2, borderColor: "#f9a825", border: 0.04, fontWeight: 800 }),
  preset("festive", "akshaya", "Akshaya Tritiya", { background: "#fff1b8", background2: "#f5b700", radius: 0.18, borderColor: "#c2185b", border: 0.035, shadow: true, color: "#880e4f", fontFamily: "Playfair Display", fontWeight: 800 }),
  preset("festive", "wedding-pink", "Wedding", { ...SPLIT, background: "#fff0f5", labelBackground: "#c2185b", labelColor: "#ffffff", color: "#880e4f", radius: 0.5, shadow: true }),
  preset("festive", "marigold", "Marigold", { background: "#ffb300", background2: "#ff6f00", gradientDirection: "horizontal", radius: 0.5, shadow: true, color: "#4e1a00", fontWeight: 800 }),
  preset("festive", "eid-green", "Eid green", { background: "#0b5d3b", background2: "#063d26", radius: 0.14, borderColor: "#e9c46a", border: 0.04, shadow: true, color: "#f8e7b0", fontFamily: "Playfair Display" }),
  preset("festive", "christmas", "Christmas", { ...SPLIT, background: "#ffffff", labelBackground: "#c62828", labelColor: "#ffffff", color: "#c62828", radius: 0.14, borderColor: "#2e7d32", border: 0.04, fontWeight: 800 }),

  // --- Modern Colour --------------------------------------------------------
  preset("modern", "teal-gold", "Teal", { ...SPLIT, background: "#e6fffa", labelBackground: "#0f766e", labelColor: "#ffffff", color: "#0f766e", radius: 0.5, fontFamily: "Montserrat", fontWeight: 800 }),
  preset("modern", "purple-luxe", "Purple luxe", { background: "#4c1d95", background2: "#2e1065", radius: 0.2, shadow: true, color: "#fde68a", fontFamily: "Montserrat", fontWeight: 800 }),
  preset("modern", "sunset", "Sunset", { background: "#f97316", background2: "#db2777", gradientDirection: "horizontal", radius: 0.5, shadow: true, color: "#ffffff", fontFamily: "Montserrat", fontWeight: 800 }),
  preset("modern", "ocean", "Ocean", { ...SPLIT, background: "#eff6ff", labelBackground: "#1d4ed8", labelBackground2: "#1e3a8a", labelColor: "#ffffff", color: "#1e3a8a", radius: 0.2, fontFamily: "Montserrat", fontWeight: 800 }),
  preset("modern", "rose-gold", "Rose gold", { background: "#f7d6d0", background2: "#b76e79", gradientDirection: "diagonal", radius: 0.5, borderColor: "#ffffff", border: 0.03, shadow: true, color: "#4a1f24", fontWeight: 800 }),
  preset("modern", "mint", "Mint", { ...SPLIT, background: "#ecfdf5", labelBackground: "#10b981", labelColor: "#ffffff", color: "#065f46", radius: 0.5, fontWeight: 800 }),
  preset("modern", "coral-block", "Coral block", { background: "#ff6b6b", radius: 0.1, color: "#ffffff", uppercase: true, fontFamily: "Oswald", fontWeight: 600 }),

  // --- Ribbons & Tags -------------------------------------------------------
  preset("ribbons", "gold-ribbon", "Gold ribbon", { shape: "ribbon", background: "#f9d976", background2: "#d4a017", shadow: true, color: "#3b2300", fontWeight: 800 }),
  preset("ribbons", "maroon-banner", "Maroon banner", { shape: "ribbon", background: "#7a1f2b", color: "#ffd778", fontFamily: "Playfair Display" }),
  preset("ribbons", "black-ribbon", "Black ribbon", { shape: "ribbon", background: "#111111", color: "#ffd778", glowColor: "#b8860b", uppercase: true, fontWeight: 800 }),
  preset("ribbons", "price-tag", "Price tag", { ...SPLIT, shape: "chamfer", radius: 0.5, background: "#fff8e1", labelBackground: "#d4a017", labelColor: "#ffffff", color: "#3b2300", shadow: true, fontWeight: 800 }),
  preset("ribbons", "green-tag", "Green tag", { shape: "chamfer", radius: 0.4, background: "#166534", borderColor: "#fef08a", border: 0.03, color: "#fef08a", uppercase: true, fontFamily: "Oswald", fontWeight: 600 }),
  preset("ribbons", "royal-banner", "Royal banner", { ...SPLIT, shape: "ribbon", background: "#3a0610", labelBackground: "#d4a017", labelColor: "#3a0610", color: "#ffd778", fontFamily: "Playfair Display", fontWeight: 800 }),
];
