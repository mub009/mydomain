import { describe, expect, it } from "vitest";
import { ALL_CAPS, sectorOf } from "./market/universe";
import { runAnalysis } from "./pipeline";
import { analyseSectors, applySectors } from "./sectors";
import type { Analysis, Bar, Message, Snapshot } from "./types";

/** n daily bars growing by `g` per day, with a late turn of `late` per day over the last 10 days. */
const bars = (g: number, late = g, n = 80): Bar[] => {
  let c = 100;
  return Array.from({ length: n }, (_, i) => { c *= 1 + (i >= n - 10 ? late : g); return { date: `d${i}`, open: c, high: c, low: c, close: c, volume: 1 }; });
};
const snap = (b: Bar[], aboveSma50 = true) => ({ close: b.at(-1)!.close, sma50: aboveSma50 ? 0 : 1e9 }) as Snapshot;

describe("sector states", () => {
  const nifty = bars(0.001).map((b) => b.close);
  const frames = {
    A1: bars(0.004), A2: bars(0.004),                 // strong and still strong → Leading
    B1: bars(-0.002, 0.004), B2: bars(-0.002, 0.004), // weak, but turning up → Improving
    C1: bars(0.006, -0.002), C2: bars(0.006, -0.002), // still ahead over the month, but the lead is shrinking → Weakening
    D1: bars(-0.003), D2: bars(-0.003),               // weak and still weak → Lagging
    E1: bars(0.01),                                   // a single stock is not a sector
  };
  const sec = (s: string) => ({ A: "Banks", B: "IT", C: "Pharma", D: "Metals", E: "Auto" })[s[0]]!;
  const snaps = Object.fromEntries(Object.entries(frames).map(([k, v]) => [k, snap(v, !k.startsWith("D"))]));
  const views = analyseSectors(frames, snaps, sec, nifty);
  const state = (s: string) => views.find((v) => v.sector === s)?.state;

  it("classifies leading, improving, weakening and lagging", () => {
    expect(state("Banks")).toBe("Leading");
    expect(state("IT")).toBe("Improving");
    expect(state("Pharma")).toBe("Weakening");
    expect(state("Metals")).toBe("Lagging");
  });
  it("needs at least two stocks unless an index is given", () => {
    expect(state("Auto")).toBeUndefined();
    expect(analyseSectors(frames, snaps, sec, nifty, { Auto: bars(0.002).map((b) => b.close) }).find((v) => v.sector === "Auto")?.source).toBe("index");
  });
  it("measures breadth and ranks every sector once", () => {
    expect(views.find((v) => v.sector === "Metals")!.breadth).toBe(0);
    expect(views.map((v) => v.rank).sort()).toEqual([1, 2, 3, 4]);
    expect(views[0].sector).toBe("Banks");
  });
  it("moves stock scores by sector state", () => {
    const row = (symbol: string, sector: string) => ({ symbol, sector, combined: 60, notes: [] }) as unknown as Analysis;
    const out = applySectors([row("X", "Banks"), row("Y", "Metals"), row("Z", "Other")], views);
    expect(Object.fromEntries(out.map((r) => [r.symbol, r.combined]))).toEqual({ X: 63, Y: 57, Z: 60 });
  });
});

describe("in the full run", () => {
  it("reports sectors and Research Agent talks about them", async () => {
    const msgs: Message[] = [];
    const r = await runAnalysis({ symbols: ALL_CAPS, top: 5, demo: true, aiNotes: false, riskPerTrade: 1 }, (e) => { if (e.type === "message") msgs.push(e.message); });
    expect(r.sectors.length).toBeGreaterThan(8);
    for (const s of r.sectors) {
      expect(s.closes.length).toBeGreaterThan(30);
      expect(s.leaders.every((l) => sectorOf(l) === s.sector)).toBe(true);
    }
    const m = msgs.find((x) => x.text.startsWith("Sector check"));
    expect(m?.sender).toBe("Research");
    expect(m?.table?.columns[0]).toBe("Sector");
  });
});
