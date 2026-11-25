"use client";

/**
 * Watchlist: stocks to keep an eye on, separate from holdings and positions.
 * Logged in (NSE Desk API): saved to your account, on every device.
 * Otherwise: saved in this browser. Logging in moves the browser's list to your account.
 */
import { create } from "zustand";
import { DESK_API, deskApi, useAuth } from "./auth";

export interface WatchItem { symbol: string; note?: string | null; addedPrice?: number | null; addedAt?: string }

const KEY = "nse-desk-watchlist-v1";
const readLocal = (): WatchItem[] => {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? "[]"); return Array.isArray(v) ? v.filter((x) => typeof x?.symbol === "string") : []; } catch { return []; }
};
const writeLocal = (xs: WatchItem[]) => { try { localStorage.setItem(KEY, JSON.stringify(xs)); } catch { /* private mode */ } };
const onAccount = () => Boolean(DESK_API && useAuth.getState().token);

interface WatchStore {
  items: WatchItem[];
  loaded: boolean;
  /** "account" when saved to your login, "browser" otherwise. */
  where: "account" | "browser";
  error: string | null;
  load: () => Promise<void>;
  add: (symbol: string, opts?: { price?: number; note?: string | null }) => Promise<void>;
  remove: (symbol: string) => Promise<void>;
  has: (symbol: string) => boolean;
}

export const useWatchlist = create<WatchStore>((set, get) => ({
  items: [], loaded: false, where: "browser", error: null,

  load: async () => {
    if (!onAccount()) { set({ items: readLocal(), loaded: true, where: "browser", error: null }); return; }
    try {
      // Move anything saved in this browser to the account, once.
      const local = readLocal();
      for (const x of local) await deskApi("/api/watchlist", { method: "POST", body: JSON.stringify({ symbol: x.symbol, note: x.note ?? null, price: x.addedPrice ?? null }) }).catch(() => {});
      if (local.length) writeLocal([]);
      const { items } = await deskApi<{ items: WatchItem[] }>("/api/watchlist");
      set({ items, loaded: true, where: "account", error: null });
    } catch (e) { set({ loaded: true, error: (e as Error).message }); }
  },

  add: async (symbol, opts = {}) => {
    const sym = symbol.trim().toUpperCase();
    const prev = get().items;
    const existing = prev.find((x) => x.symbol === sym);
    const item: WatchItem = existing
      ? { ...existing, ...(opts.note !== undefined ? { note: opts.note } : {}) }
      : { symbol: sym, note: opts.note ?? null, addedPrice: opts.price ?? null, addedAt: new Date().toISOString() };
    const next = existing ? prev.map((x) => (x.symbol === sym ? item : x)) : [item, ...prev];
    set({ items: next, error: null });
    if (!onAccount()) { writeLocal(next); return; }
    try {
      const body: Record<string, unknown> = { symbol: sym, price: opts.price ?? null };
      if (opts.note !== undefined) body.note = opts.note;
      const { item: saved } = await deskApi<{ item: WatchItem }>("/api/watchlist", { method: "POST", body: JSON.stringify(body) });
      set((s) => ({ items: s.items.map((x) => (x.symbol === sym ? saved : x)) }));
    } catch (e) { set({ items: prev, error: (e as Error).message }); }
  },

  remove: async (symbol) => {
    const prev = get().items;
    const next = prev.filter((x) => x.symbol !== symbol);
    set({ items: next, error: null });
    if (!onAccount()) { writeLocal(next); return; }
    try { await deskApi(`/api/watchlist/${encodeURIComponent(symbol)}`, { method: "DELETE" }); }
    catch (e) { set({ items: prev, error: (e as Error).message }); }
  },

  has: (symbol) => get().items.some((x) => x.symbol === symbol),
}));
