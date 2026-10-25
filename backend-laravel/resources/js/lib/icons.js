import { ICONS } from "./icons-data";

// The same Lucide icons the Blade <x-icon> component renders, for markup
// built in page scripts.
export function icon(name, { size = 24, className = "", strokeWidth = 2, fill = "none" } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" class="${className}" aria-hidden="true">${ICONS[name] ?? ""}</svg>`;
}
