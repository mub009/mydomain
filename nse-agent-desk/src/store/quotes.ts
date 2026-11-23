"use client";

/** Current prices shown across the app: fetched in batches, refreshed every minute while NSE is open. */
import { useEffect } from "react";
import { create } from "zustand";
import { marketStatus } from "@/lib/market/calendar";
import type { Quote } from "@/lib/market/quotes";

interface QuoteStore {
  quotes: Record<string, Quote>;
  /** When each symbol was last fetched (ms). */
  fetched: Record<string, number>;
  load: (symbols: string[], maxAgeMs: number) => Promise<void>;
}

const inFlight = new Set<string>();

export const useQuoteStore = create<QuoteStore>((set, get) => ({
  quotes: {}, fetched: {},
  load: async (symbols, maxAgeMs) => {
    const now = Date.now();
    const need = symbols.filter((s) => !inFlight.has(s) && now - (get().fetched[s] ?? 0) > maxAgeMs);
    if (!need.length) return;
    need.forEach((s) => inFlight.add(s));
    try {
      for (let i = 0; i < need.length; i += 150) {
        const part = need.slice(i, i + 150);
        const r = await fetch(`/api/quotes?symbols=${encodeURIComponent(part.join(","))}`);
        if (!r.ok) continue;
        const { quotes } = (await r.json()) as { quotes: Record<string, Quote> };
        set((st) => ({ quotes: { ...st.quotes, ...quotes }, fetched: { ...st.fetched, ...Object.fromEntries(part.map((s) => [s, now])) } }));
      }
    } catch { /* keep the last close */ }
    finally { need.forEach((s) => inFlight.delete(s)); }
  },
}));

/** Current prices for these symbols; refreshed every minute in market hours, every 15 minutes otherwise. */
export function useQuotes(symbols: string[]): Record<string, Quote> {
  const key = [...new Set(symbols)].sort().join(",");
  const load = useQuoteStore((s) => s.load);
  useEffect(() => {
    if (!key) return;
    const list = key.split(",");
    const age = () => (marketStatus().open ? 60_000 : 15 * 60_000);
    load(list, age());
    const t = setInterval(() => { if (document.visibilityState === "visible") load(list, age()); }, 60_000);
    return () => clearInterval(t);
  }, [key, load]);
  return useQuoteStore((s) => s.quotes);
}
