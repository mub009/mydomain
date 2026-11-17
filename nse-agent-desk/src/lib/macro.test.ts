import { afterEach, describe, expect, it, vi } from "vitest";
import { analyseMacro, applyMacro, factorViews, loadMacro, type FactorSeries } from "./macro";
import { ALL_CAPS } from "./market/universe";
import { runAnalysis } from "./pipeline";
import type { Analysis, Bar, Message } from "./types";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

const DATES = Array.from({ length: 140 }, (_, i) => new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10));
/** A factor line: noisy, with a chosen total move over the last 21 days. */
function line(start: number, lastMonthPct: number, seed: number) {
  let v = start, x = seed;
  const noise = () => { x = (x * 9301 + 49297) % 233280; return x / 233280 - 0.5; };
  return DATES.map((d, i) => {
    v *= 1 + noise() * 0.002 + (i >= DATES.length - 21 ? Math.log(1 + lastMonthPct / 100) / 21 : 0);
    return { date: d, close: v };
  });
}
/** A stock that follows a factor's daily moves with a given sign. */
const follow = (f: { date: string; close: number }[], sign: number): Bar[] => {
  let p = 100;
  return f.map((x, i) => { if (i) p *= 1 + sign * (x.close / f[i - 1].close - 1); return { date: x.date, open: p, high: p, low: p, close: p, volume: 1 }; });
};

describe("Macro Agent", () => {
  const series: FactorSeries = { gold: line(95000, 1, 3), crude: line(75, 10, 7), usdinr: line(86, 2, 11) };

  it("flags moves big enough to matter", () => {
    const f = Object.fromEntries(factorViews(series, true).map((x) => [x.id, x]));
    expect(f.gold.significant).toBe(false); // 1% < 2%
    expect(f.crude.significant).toBe(true); // 10% > 3%
    expect(f.usdinr.significant).toBe(true); // 2% > 0.7%
  });

  it("rising crude hurts an oil marketer and helps a producer; a weaker rupee helps IT", () => {
    const frames = { BPCL: follow(series.crude, -1), ONGC: follow(series.crude, 1), TCS: follow(series.usdinr, 1), TITAN: follow(series.gold, 1) };
    const r = analyseMacro(frames, series, true);
    const get = (s: string, f: string) => r.exposures.find((e) => e.symbol === s && e.factor === f)!;
    expect(get("BPCL", "crude")).toMatchObject({ effect: "Headwind", basis: "known" });
    expect(get("BPCL", "crude").points).toBe(-4); // 2 + big move + measured link agrees
    expect(get("ONGC", "crude")).toMatchObject({ effect: "Tailwind", points: 4 });
    expect(get("TCS", "usdinr")).toMatchObject({ effect: "Tailwind" });
    expect(get("TITAN", "gold")).toMatchObject({ effect: "Neutral", points: 0, link: "mixed" });
  });

  it("finds a strong measured link even without a known one", () => {
    const r = analyseMacro({ NEWCO: follow(series.crude, 1) }, series, true);
    expect(r.exposures.find((e) => e.symbol === "NEWCO")).toMatchObject({ basis: "measured", link: "benefits", effect: "Tailwind", points: 1 });
  });

  it("caps the total effect on a stock at ±4", () => {
    const row = { symbol: "BPCL", combined: 60, notes: [] } as unknown as Analysis;
    const report = { factors: [], summary: "", sample: true, exposures: [
      { symbol: "BPCL", factor: "crude", basis: "known", link: "hurts", reason: "", effect: "Headwind", points: -4 },
      { symbol: "BPCL", factor: "usdinr", basis: "known", link: "hurts", reason: "", effect: "Headwind", points: -3 },
    ] } as Parameters<typeof applyMacro>[1];
    expect(applyMacro([row], report)[0].combined).toBe(56);
  });

  it("converts gold to ₹ per 10 g from live data", async () => {
    vi.stubEnv("MARKET_DATA_PROVIDER", "yahoo");
    const chart = (closes: number[]) => ({ chart: { result: [{ timestamp: closes.map((_, i) => 1767225600 + i * 86400),
      indicators: { quote: [{ open: closes, high: closes, low: closes, close: closes, volume: closes.map(() => 1) }] } }] } });
    vi.stubGlobal("fetch", vi.fn(async (url: string) => new Response(JSON.stringify(
      url.includes("GC%3DF") || url.includes("GC=F") ? chart([3110.35, 3110.35]) : url.includes("BZ") ? chart([75, 76]) : chart([86, 86])))));
    const m = await loadMacro(false);
    expect(m!.sample).toBe(false);
    expect(m!.series.gold.at(-1)!.close).toBe(86000); // 3110.35 $/oz ÷ 31.1035 g/oz × 10 g × 86 ₹/$
    expect(m!.series.crude.at(-1)!.close).toBe(76);
  });
});

describe("in the full run", () => {
  it("the Macro Agent reports to Mubashir before his follow-up questions", async () => {
    const msgs: Message[] = [];
    const r = await runAnalysis({ symbols: ALL_CAPS, top: 5, demo: true, aiNotes: false, riskPerTrade: 1 }, (e) => { if (e.type === "message") msgs.push(e.message); });
    expect(r.macro?.factors.map((f) => f.id)).toEqual(["gold", "crude", "usdinr"]);
    const macroAt = msgs.findIndex((m) => m.sender === "Macro");
    const followUp = msgs.findIndex((m) => m.sender === "Mubashir" && m.to === "Lotappi");
    expect(macroAt).toBeGreaterThan(0);
    expect(macroAt).toBeLessThan(followUp);
    expect(msgs[macroAt].to).toBe("Mubashir");
    for (const m of msgs) expect(m.text).not.toMatch(/undefined|NaN/);
    // Demo stocks with a known link really do move with their factor.
    const it = r.macro!.exposures.filter((e) => e.factor === "usdinr" && e.link === "benefits" && e.corr !== undefined);
    expect(it.filter((e) => e.corr! > 0).length / it.length).toBeGreaterThan(0.8);
  });
});
