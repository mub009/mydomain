export interface Palette {
  id: string;
  name: string;
  /** Page background. */
  bg: string;
  /** Second background tone, for gradients and panels. */
  bgAlt: string;
  /** Body text on `bg`. */
  ink: string;
  /** Secondary text on `bg`. */
  muted: string;
  /** Buttons, rules and flashes. */
  accent: string;
  /** Text drawn on `accent`. */
  onAccent: string;
  /** True when `bg` is dark, so layouts know which way the contrast runs. */
  dark: boolean;
}

export const PALETTES: Palette[] = [
  {
    id: "crimson",
    name: "Crimson",
    bg: "#0f0b0c",
    bgAlt: "#3b0d14",
    ink: "#ffffff",
    muted: "#e6bfc5",
    accent: "#e11d2e",
    onAccent: "#ffffff",
    dark: true,
  },
  {
    id: "saffron",
    name: "Saffron",
    bg: "#fff8e7",
    bgAlt: "#ffe6ac",
    ink: "#2a1c05",
    muted: "#7a6134",
    accent: "#f59e0b",
    onAccent: "#241701",
    dark: false,
  },
  {
    id: "midnight",
    name: "Midnight",
    bg: "#0b1220",
    bgAlt: "#152744",
    ink: "#f8fafc",
    muted: "#9db2ce",
    accent: "#38bdf8",
    onAccent: "#04121f",
    dark: true,
  },
  {
    id: "emerald",
    name: "Emerald",
    bg: "#f2fbf6",
    bgAlt: "#c9f0dc",
    ink: "#06281a",
    muted: "#3f6b56",
    accent: "#0f9d58",
    onAccent: "#ffffff",
    dark: false,
  },
  {
    id: "royal",
    name: "Royal",
    bg: "#120c2a",
    bgAlt: "#2c1b6b",
    ink: "#f5f3ff",
    muted: "#bfb4ee",
    accent: "#a855f7",
    onAccent: "#160a2e",
    dark: true,
  },
  {
    id: "mono",
    name: "Mono",
    bg: "#ffffff",
    bgAlt: "#ededed",
    ink: "#111111",
    muted: "#6b6b6b",
    accent: "#111111",
    onAccent: "#ffffff",
    dark: false,
  },
];

export const DEFAULT_PALETTE_ID = PALETTES[0].id;

export function resolvePalette(id?: string | null): Palette {
  return PALETTES.find((p) => p.id === id) ?? PALETTES[0];
}
