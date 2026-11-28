import { describe, expect, it } from "vitest";
import { together } from "./exit-check";
import { longTermView } from "./long-term";
import type { Decision, DeskTone, DeskView } from "./types";

const view = (agent: string, tone: DeskTone, verdict: string, metrics: [string, number][] = [], reasons: string[] = []): DeskView =>
  ({ agent, tone, verdict, points: 0, metrics: metrics.map(([label, value]) => ({ label, value, unit: "%" })), reasons } as unknown as DeskView);

const dec = (o: { quality?: DeskTone; growth?: DeskTone; growthVerdict?: string; value?: DeskTone; five?: number; severe?: boolean; flags?: DeskTone; above200?: boolean; bpOut?: boolean; noDesk?: boolean } = {}): Decision => ({
  symbol: "ABC", sector: "IT", verdict: "BUY", mayReasons: o.above200 === false ? [] : ["Above 200-day average (long trend up)"], mayWarnings: o.above200 === false ? ["Below 200-day average"] : [],
  blackPoints: o.bpOut ? { status: { swing: "Excluded", positional: "Excluded" }, findings: [{ materiality: "material", flag: "Auditor resigned" }] } : undefined,
  desk: o.noDesk ? undefined : {
    profitability: view("Profitability", o.quality ?? "good", "High quality", [["ROE", 22.4]]),
    growth: view("Growth", o.growth ?? "good", o.growthVerdict ?? "High growth", [["Revenue 3Y", 14.2], ["Profit 3Y", 18]]),
    valuation: view("Valuation", o.value ?? "ok", "Fair", [["P/E (TTM)", 24.5]]),
    performance: view("Performance", "good", "Outperformer", o.five === undefined ? [] : [["5Y annualised", o.five]]),
    redFlags: view("RedFlag", o.flags ?? "good", "Clear", [], ["promoter pledge 40%"]),
    severe: Boolean(o.severe), points: 0, sample: false,
  },
} as unknown as Decision);

describe("long-term view", () => {
  it("a quality grower is one to accumulate", () => {
    const v = longTermView(dec({ five: 18 }))!;
    expect(v.action).toBe("ACCUMULATE");
    expect(v.score).toBe(50 + 20 + 18 + 0 + 8 + 0 + 4);
    expect(v.summary).toMatch(/^Strong long-term case \(100\/100\)|^Strong long-term case/);
    expect(v.pillars.map((p) => p.name)).toEqual(["Quality", "Growth", "Valuation", "5-year record", "Safety", "Long trend"]);
  });

  it("weak quality, shrinking and expensive is one to exit", () => {
    const v = longTermView(dec({ quality: "weak", growth: "weak", growthVerdict: "Shrinking", value: "weak", five: -4, above200: false }))!;
    expect(v.action).toBe("EXIT");
    expect(v.summary).toContain("Poor long-term case");
  });

  it("a loss-maker or a verified red flag pulls it down hard", () => {
    expect(longTermView(dec({ growthVerdict: "Loss-making" }))!.pillars.find((p) => p.name === "Growth")!.points).toBe(-20);
    const v = longTermView(dec({ bpOut: true }))!;
    expect(v.pillars.find((p) => p.name === "Safety")!.text).toContain("auditor resigned");
    expect(v.score).toBeLessThan(longTermView(dec())!.score - 25);
  });

  it("ignores an unbelievable P/E (broken earnings data)", () => {
    const d = dec(); d.desk!.valuation = view("Valuation", "weak", "Expensive", [["P/E (TTM)", 1379.3]]);
    expect(longTermView(d)!.pillars.some((p) => p.name === "Valuation")).toBe(false);
  });

  it("says nothing without the research desk's fundamentals", () => {
    expect(longTermView(dec({ noDesk: true }))).toBeUndefined();
    expect(longTermView(dec({ quality: "n/a", growth: "n/a", value: "n/a" }))).toBeUndefined();
  });

  it("explains when the trader and the investor disagree", () => {
    expect(together("SELL", "ACCUMULATE")).toContain("long-term investor can keep it");
    expect(together("SELL", "EXIT")).toBe("Both views agree: sell.");
    expect(together("HOLD", "EXIT")).toContain("plan to exit on strength");
    expect(together("HOLD", "ACCUMULATE")).toContain("add on dips");
  });
});
