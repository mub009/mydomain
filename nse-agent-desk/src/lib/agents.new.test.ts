import { describe, expect, it } from "vitest";
import { VolatilityAgent } from "./agents/volatility";
import { NewsAgent, NEWS_BOOST } from "./agents/news";
import { snapshot } from "./indicators";
import { demoBars, demoIndex, demoVix } from "./market/demo";
import { NIFTY50 } from "./market/universe";
import { demoNews, sentimentOf } from "./news";
import { runAnalysis } from "./pipeline";
import { isSessionDue } from "./session/scheduler";
import type { AgentReport, Message, NewsBrief } from "./types";

describe("News Agent agent", () => {
  it("sorts headlines into positive and negative", () => {
    expect(sentimentOf("Tata Motors shares surge after record monthly sales")).toBe("positive");
    expect(sentimentOf("Infosys slips as brokerage downgrades the stock")).toBe("negative");
    expect(sentimentOf("Board meeting scheduled for Friday")).toBe("neutral");
  });

  it("boosts stocks with positive news and only warns on negative news", () => {
    const reports: AgentReport[] = [
      { symbol: "AAA", score: 50, signal: "WATCH", reasons: [], warnings: [], horizon: "x" },
      { symbol: "BBB", score: 70, signal: "BUY", reasons: [], warnings: [], horizon: "x" },
    ];
    const brief: NewsBrief = { label: "t", sample: true, total: 2, items: [
      { symbol: "AAA", headline: "AAA wins order", source: "s", sentiment: "positive", sample: true },
      { symbol: "BBB", headline: "BBB misses estimates", source: "s", sentiment: "negative", sample: true },
    ] };
    const out = new NewsAgent().apply(reports, brief);
    const a = out.find((r) => r.symbol === "AAA")!, b = out.find((r) => r.symbol === "BBB")!;
    expect(a.score).toBe(50 + NEWS_BOOST);
    expect(a.reasons.some((r) => r.startsWith("Positive news"))).toBe(true);
    expect(b.score).toBe(70);
    expect(b.warnings.some((r) => r.startsWith("Negative news"))).toBe(true);
  });

  it("demo headlines are labelled as samples", () => {
    const snaps = Object.fromEntries(NIFTY50.map((s) => [s, snapshot(demoBars(s, 3))]));
    const n = demoNews(snaps, 3);
    expect(n.sample).toBe(true);
    expect(n.items.length).toBeGreaterThan(0);
    for (const i of n.items) { expect(i.sample).toBe(true); expect(i.sentiment).not.toBe("neutral"); }
  });
});

describe("Volatility Agent", () => {
  const frames = Object.fromEntries(NIFTY50.map((s) => [s, demoBars(s, 11)]));
  const snaps = Object.fromEntries(Object.entries(frames).map(([k, v]) => [k, snapshot(v)]));
  const index = demoIndex(Object.values(frames));

  it("reports level, direction, reasons and next movers", () => {
    const r = new VolatilityAgent().analyse(demoVix(index, 11), index, frames, snaps, null, true)!;
    expect(r.level).toBeGreaterThan(0);
    expect(["up", "down", "flat"]).toContain(r.direction);
    expect(r.reasons.length).toBeGreaterThan(0);
    expect(r.movers.length).toBeGreaterThanOrEqual(3);
    for (const m of r.movers) expect(NIFTY50).toContain(m.symbol);
  });

  it("explains a VIX spike on a falling market as fear", () => {
    const vix = [...Array(40).fill(13), 13, 13, 13, 13, 16]; // +23% on the last day
    const idx = [...Array(44).fill(100), 98]; // index -2%
    const r = new VolatilityAgent().analyse(vix, idx, frames, snaps, null, true)!;
    expect(r.direction).toBe("up");
    expect(r.reasons[0]).toMatch(/Falling prices/);
  });

  it("returns nothing without enough VIX history", () => {
    expect(new VolatilityAgent().analyse([14, 15], index, frames, snaps, null, true)).toBeNull();
  });
});

describe("9 AM schedule (IST)", () => {
  // 17 Nov 2026 is a Tuesday. 03:30Z = 09:00 IST.
  it("runs on a trading day from 09:00 IST, once per day", () => {
    expect(isSessionDue(new Date("2026-11-17T03:29:00Z"), null, "09:00")).toBe(false);
    expect(isSessionDue(new Date("2026-11-17T03:30:00Z"), null, "09:00")).toBe(true);
    expect(isSessionDue(new Date("2026-11-17T04:00:00Z"), "2026-11-17T03:30:30Z", "09:00")).toBe(false);
    expect(isSessionDue(new Date("2026-11-18T03:31:00Z"), "2026-11-17T03:30:30Z", "09:00")).toBe(true);
  });
  it("skips weekends and NSE holidays", () => {
    expect(isSessionDue(new Date("2026-11-21T03:31:00Z"), null, "09:00")).toBe(false); // Saturday
    expect(isSessionDue(new Date("2026-11-24T03:31:00Z"), null, "09:00")).toBe(false); // Guru Nanak Jayanti
  });
});

describe("full run with the new agents", () => {
  it("News Agent briefs Momentum Agent and Trend Agent; Volatility Agent reports to Research Agent", async () => {
    const messages: Message[] = [];
    const res = await runAnalysis({ symbols: NIFTY50, top: 5, demo: true, aiNotes: false, riskPerTrade: 1 },
      (e) => { if (e.type === "message") messages.push(e.message); });
    expect(res.news?.sample).toBe(true);
    expect(res.vix).not.toBeNull();
    const threads = new Set(messages.map((m) => m.thread));
    for (const t of ["Momentum|News", "News|Trend", "Research|Volatility"]) expect(threads).toContain(t);
    // news comes first, before Momentum Agent talks to Trend Agent
    const firstNews = messages.findIndex((m) => m.sender === "News");
    const firstScan = messages.findIndex((m) => m.thread === "Momentum|Trend");
    expect(firstNews).toBeGreaterThan(0);
    expect(firstNews).toBeLessThan(firstScan);
    for (const m of messages) expect(m.text).not.toMatch(/undefined|NaN/);
  });
});
