"use client";

/**
 * What you own, from every place the app knows: Zerodha holdings (set by the
 * Zerodha card), tracked trades, and stocks added by hand in the Sell check.
 * The stock window uses it to show "My position" for a stock you hold.
 */
import { create } from "zustand";
import { mergeHoldings, type Holding } from "@/lib/exit-check";
import { usePositions } from "./positions";

interface HoldingsStore {
  zerodha: Holding[];
  extra: Holding[];
  setZerodha: (h: Holding[]) => void;
  setExtra: (fn: (h: Holding[]) => Holding[]) => void;
}

export const useHoldings = create<HoldingsStore>((set) => ({
  zerodha: [], extra: [],
  setZerodha: (zerodha) => set({ zerodha }),
  setExtra: (fn) => set((s) => ({ extra: fn(s.extra) })),
}));

/** Everything held, merged per stock (total qty, weighted buy price), plus each one's share of the money invested. */
export function useAllHoldings() {
  const zerodha = useHoldings((s) => s.zerodha);
  const extra = useHoldings((s) => s.extra);
  const positions = usePositions((s) => s.positions);
  const tracked: Holding[] = positions.filter((p) => p.status === "open").map((p) => ({ symbol: p.symbol, qty: p.qty, avgPrice: p.buyPrice, source: "Tracked" }));
  const merged = mergeHoldings([...zerodha, ...tracked, ...extra]);
  const invested = [...merged.values()].reduce((s, h) => s + h.qty * h.avgPrice, 0);
  return { merged, invested };
}
