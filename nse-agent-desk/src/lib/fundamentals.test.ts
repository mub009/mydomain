import { afterEach, describe, expect, it, vi } from "vitest";
import { ResearchAgent } from "./agents/research";
import { classifyCap, epsGrowth, loadFundamentals } from "./fundamentals";
import { ALL_CAPS, MIDCAPS } from "./market/universe";
import { runAnalysis } from "./pipeline";
import type { Analysis, Fundamentals, Message } from "./types";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("size bands", () => {
  it("classifies by market cap in ₹ crore", () => {
    const t = { min: 300, mid: 30000, large: 100000 };
    expect(classifyCap(250, t)).toBe("Too small");
    expect(classifyCap(300, t)).toBe("Small");
    expect(classifyCap(29999, t)).toBe("Small");
    expect(classifyCap(30000, t)).toBe("Mid");
    expect(classifyCap(100000, t)).toBe("Large");
    expect(classifyCap(undefined, t)).toBe("Unknown");
  });
});

describe("EPS growth", () => {
  it("compares this year's EPS with last year's", () => {
    expect(epsGrowth(12, 10)).toBe(20);
    expect(epsGrowth(8, 10)).toBe(-20);
    expect(epsGrowth(5, -2)).toBeUndefined(); // growth from a loss isn't a percentage
    expect(epsGrowth(5, undefined)).toBeUndefined();
  });
});

const row = (symbol: string): Analysis => ({
  symbol, sector: "IT", combined: 60, lotappi: 60, mayavi: 60, agree: true, conflict: false, risk: "LOW", horizon: "x",
  entry: 100, stopLoss: 95, target: 110, rsi: 55, ret5d: 1, ret21d: 3, volRatio: 1, atrPct: 2,
  lotReasons: [], lotWarnings: [], mayReasons: [], mayWarnings: [], notes: [],
});
const f = (p: Partial<Fundamentals>): Fundamentals => ({ cap: "Large", epsHistory: [], source: "t", sample: true, ...p });

describe("Research Agent's earnings and size rules", () => {
  it("rewards EPS growth, marks down falling EPS and losses", () => {
    const out = new ResearchAgent().applyFundamentals(["A", "B", "C", "D", "E"].map(row), {
      A: f({ epsTTM: 12, epsGrowth1y: 25 }), B: f({ epsTTM: 11, epsGrowth1y: 12 }), C: f({ epsTTM: 10, epsGrowth1y: 3 }),
      D: f({ epsTTM: 8, epsGrowth1y: -15 }), E: f({ epsTTM: -2 }),
    });
    const by = Object.fromEntries(out.map((r) => [r.symbol, r.combined]));
    expect(by).toEqual({ A: 65, B: 63, C: 61, D: 56, E: 54 });
    expect(out.find((r) => r.symbol === "E")!.notes.some((n) => n.startsWith("Loss-making"))).toBe(true);
  });
  it("treats small caps as at least medium risk", () => {
    const [r] = new ResearchAgent().applyFundamentals([row("S")], { S: f({ cap: "Small", epsTTM: 5, epsGrowth1y: 10 }) });
    expect(r.risk).toBe("MEDIUM");
  });
});

describe("Yahoo fundamentals", () => {
  it("builds 12-month EPS from 8 quarters and market cap from shares × price", async () => {
    const q = (v: number[]) => v.map((x, i) => ({ asOfDate: `2025-0${(i % 8) + 1}-28`, reportedValue: { raw: x } }));
    const body = { timeseries: { result: [
      { meta: { type: ["quarterlyDilutedEPS"] }, quarterlyDilutedEPS: q([2, 2, 2, 2, 3, 3, 3, 3]) },
      { meta: { type: ["quarterlyOrdinarySharesNumber"] }, quarterlyOrdinarySharesNumber: [{ asOfDate: "2025-09-30", reportedValue: { raw: 50_000_000 } }] },
    ] } };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body))));
    const out = await loadFundamentals({ TESTCO: 400 }, false);
    expect(out.TESTCO.epsTTM).toBe(12);
    expect(out.TESTCO.epsYearAgo).toBe(8);
    expect(out.TESTCO.epsGrowth1y).toBe(50);
    expect(out.TESTCO.marketCapCr).toBe(2000); // 5 crore shares × ₹400
    expect(out.TESTCO.cap).toBe("Small");
  });
  it("marks a stock Unknown when its data can't be loaded", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 404 })));
    expect((await loadFundamentals({ X: 10 }, false)).X.cap).toBe("Unknown");
  });
});

describe("in the full run", () => {
  it("scans large, mid and small caps, each with EPS", async () => {
    const msgs: Message[] = [];
    const r = await runAnalysis({ symbols: ALL_CAPS, top: 10, demo: true, aiNotes: false, riskPerTrade: 1 }, (e) => { if (e.type === "message") msgs.push(e.message); });
    const caps = new Set(r.all.map((d) => d.fundamentals?.cap));
    for (const c of ["Large", "Mid", "Small"]) expect(caps).toContain(c);
    for (const d of r.all) expect(d.fundamentals?.epsHistory.length).toBeGreaterThan(0);
    const report = msgs.find((m) => m.table?.columns.includes("EPS growth"));
    expect(report?.sender).toBe("Research");
    for (const m of msgs) expect(m.text).not.toMatch(/undefined|NaN/);
  });

  it("leaves out stocks below the minimum market cap", async () => {
    vi.stubEnv("MIN_MARKET_CAP_CR", "60000"); // demo mid caps are ₹30,000-95,000 Cr, so some fall below
    const r = await runAnalysis({ symbols: MIDCAPS, top: 5, demo: true, aiNotes: false, riskPerTrade: 1 }, () => {});
    expect(r.minCapCr).toBe(60000);
    expect(r.excluded.length).toBeGreaterThan(0);
    for (const e of r.excluded) {
      expect(e.marketCapCr).toBeLessThan(60000);
      expect(r.all.some((d) => d.symbol === e.symbol)).toBe(false);
    }
  });
});

describe("Decision Agent's earnings caps", async () => {
  const { DecisionAgent: FinalDecision } = await import("./agents/decision");
  const strong = { ...row("Z"), combined: 85, agree: true };
  it("no strong buy with falling EPS, no buy while loss-making", () => {
    const fd = new FinalDecision();
    expect(fd.verdict({ ...strong, fundamentals: f({ epsTTM: 9, epsGrowth1y: 20 }) })).toBe("STRONG BUY");
    expect(fd.verdict({ ...strong, fundamentals: f({ epsTTM: 9, epsGrowth1y: -5 }) })).toBe("BUY");
    expect(fd.verdict({ ...strong, fundamentals: f({ epsTTM: -1 }) })).toBe("WATCH");
  });
  it("shows losses as -₹", async () => {
    const { inr } = await import("./format");
    expect(inr(-22.26)).toBe("-₹22.26");
  });
});
