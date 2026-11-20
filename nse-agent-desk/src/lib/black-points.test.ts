import { describe, expect, it } from "vitest";
import { DecisionAgent } from "./agents/decision";
import { type BPContext, investigate, type StockEvidence } from "./black-points/analyst";
import { parseSebiListing } from "./black-points/sources";
import { ALL_CAPS } from "./market/universe";
import { runAnalysis } from "./pipeline";
import type { Analysis, Message } from "./types";

const years = [
  { year: "FY23", revenue: 1000, netIncome: 100, equity: 800, debt: 100, cash: 300, operatingCashFlow: 120, ebit: 150, interestExpense: 10, currentAssets: 500, currentLiabilities: 300 },
  { year: "FY24", revenue: 1100, netIncome: 110, equity: 880, debt: 100, cash: 320, operatingCashFlow: 130, ebit: 160, interestExpense: 10, currentAssets: 520, currentLiabilities: 300 },
  { year: "FY25", revenue: 1200, netIncome: 120, equity: 960, debt: 100, cash: 340, operatingCashFlow: 140, ebit: 170, interestExpense: 10, currentAssets: 540, currentLiabilities: 300 },
  { year: "FY26", revenue: 1300, netIncome: 130, equity: 1040, debt: 100, cash: 360, operatingCashFlow: 150, ebit: 180, interestExpense: 10, currentAssets: 560, currentLiabilities: 300 },
];
const row = (o: Partial<Analysis> = {}) => ({
  symbol: "ACME", sector: "IT", combined: 95, lotappi: 85, mayavi: 80, agree: true, conflict: false, risk: "LOW", horizon: "Swing, then hold ~1 month",
  entry: 100, stopLoss: 95, target: 110, rsi: 60, ret5d: 3, ret21d: 8, volRatio: 1.5, atrPct: 2, lotReasons: ["Breakout"], lotWarnings: [], mayReasons: ["Above 50-day"], mayWarnings: [], notes: [], ...o,
}) as Analysis;
const ctx = (o: Partial<BPContext> = {}): BPContext => ({
  today: "2026-11-19", sample: false, sebiOk: true, filingsOk: true, strict: false, sectorOf: () => "IT", sectors: [], peers: {}, sectorNews: {}, ...o,
});
const ev = (o: Partial<StockEvidence> = {}): StockEvidence => ({ years, profile: { name: "Acme Systems Limited", industry: "IT Services" }, news: [], filings: [], sebi: [], ...o });

describe("Black Points Analyst", () => {
  it("is eligible for both holding periods when nothing is found", () => {
    const r = investigate(row(), ev(), ctx());
    expect(r.status).toEqual({ swing: "Eligible", positional: "Eligible" });
    expect(r.subsector).toBe("IT Services");
    expect(r.passed.swing).toMatch(/Momentum Agent scored it 85/);
  });

  it("only covers the holding periods whose scan the stock passed", () => {
    expect(Object.keys(investigate(row({ lotappi: 40 }), ev(), ctx()).status)).toEqual(["positional"]);
  });

  it("excludes on a verified filing, holds for review on headlines only", () => {
    const filing = investigate(row(), ev({ filings: [{ symbol: "ACME", date: "2026-11-02", title: "Resignation of Statutory Auditor", url: "https://example.com/f.pdf" }] }), ctx());
    expect(filing.status).toEqual({ swing: "Excluded", positional: "Excluded" });
    expect(filing.findings[0]).toMatchObject({ flag: "Auditor resignation", verification: "verified", scope: "Company" });
    expect(filing.findings[0].evidence[0]).toMatchObject({ date: "2026-11-02", url: "https://example.com/f.pdf", kind: "exchange filing" });
    const news = investigate(row(), ev({ news: [{ title: "Acme Systems auditor resigns citing lack of information", url: "u", date: "2026-11-10", source: "Paper" }] }), ctx());
    expect(news.status).toEqual({ swing: "Needs Review", positional: "Needs Review" });
    expect(news.findings[0].verification).toBe("unverified");
  });

  it("verifies regulatory orders from SEBI's own list", () => {
    const r = investigate(row(), ev({ sebi: [{ title: "Order in the matter of Acme Systems Limited", url: "https://www.sebi.gov.in/x.html", date: "2026-10-01" }] }), ctx());
    expect(r.findings[0]).toMatchObject({ flag: "Regulatory order or probe", verification: "verified" });
    expect(r.status.swing).toBe("Excluded");
  });

  it("marks headlines contradicted by the company's figures as conflicting", () => {
    const r = investigate(row(), ev({ news: [{ title: "Acme Systems delayed loan repayment, sources say", url: "u", date: "2026-11-10", source: "Paper" }] }), ctx());
    expect(r.findings[0].verification).toBe("conflicting");
    expect(r.status.swing).toBe("Needs Review");
  });

  it("verifies weakness straight from the financial statements", () => {
    const bad = years.map((y, i) => ({ ...y, revenue: 1300 - i * 100, operatingCashFlow: i > 0 ? -20 : 50, debt: 2000, interestExpense: 120, ebit: 150 }));
    const r = investigate(row(), ev({ years: bad }), ctx());
    expect(r.findings.map((f) => f.flag)).toEqual(expect.arrayContaining(["Revenue falling two years in a row", "Poor cash flow", "Debt repayment stress"]));
    expect(r.status.positional).toBe("Excluded");
  });

  it("treats weak cash flow alone as a watch item, and skips revenue tests for lenders", () => {
    const cashPoor = years.map((y) => ({ ...y, operatingCashFlow: 20 }));
    const f = investigate(row(), ev({ years: cashPoor }), ctx()).findings.find((x) => x.flag === "Poor cash flow");
    expect(f?.materiality).toBe("watch");
    const falling = years.map((y, i) => ({ ...y, revenue: 1300 - i * 100 }));
    expect(investigate(row(), ev({ years: falling }), ctx({ sectorOf: () => "Banks" })).findings.some((x) => x.category === "Structural decline")).toBe(false);
  });

  it("ignores routine NCLT approvals", () => {
    const r = investigate(row(), ev({ news: [{ title: "NCLT approves merger of Acme Systems subsidiary", url: "u", date: "2026-11-01", source: "Paper" }] }), ctx());
    expect(r.findings).toHaveLength(0);
  });

  it("holds the stock when financials are missing or stale", () => {
    expect(investigate(row(), ev({ years: [] }), ctx()).status.swing).toBe("Needs Review");
    expect(investigate(row(), ev({ years: years.map((y, i) => ({ ...y, year: `FY${20 + i}` })) }), ctx()).findings[0].verification).toBe("stale");
  });

  it("applies a sector-wide flag only with industry data and several companies", () => {
    const sectors = [{ sector: "IT", state: "Lagging", ret3m: -9 }];
    const peers = { P1: { revYoY: -6 }, P2: { revYoY: 2, marginChange: -4 }, P3: { revYoY: 4 } };
    const both = investigate(row(), ev(), ctx({ sectors, peers }));
    expect(both.findings.find((f) => f.scope === "Sector")).toMatchObject({ verification: "verified", materiality: "material" });
    const oneCompany = investigate(row(), ev(), ctx({ sectors, peers: { P1: { revYoY: -6 }, P3: { revYoY: 4 } } }));
    expect(oneCompany.findings.find((f) => f.scope === "Sector")).toBeUndefined();
    const noIndustry = investigate(row(), ev(), ctx({ sectors: [{ sector: "IT", state: "Leading", ret3m: 5 }], peers }));
    expect(noIndustry.findings.find((f) => f.scope === "Sector")).toBeUndefined();
  });

  it("reports events inside a holding period without changing the status", () => {
    const r = investigate(row(), ev({ profile: { name: "Acme", earningsDate: "2026-12-10" } }), ctx());
    const e = r.findings.find((f) => f.flag.startsWith("Quarterly results"));
    expect(Object.keys(e!.impact)).toEqual(["positional"]); // 21 days away: inside 1 month, not inside 10 days
    expect(r.status).toEqual({ swing: "Eligible", positional: "Eligible" });
  });

  it("reads SEBI's orders listing", () => {
    const html = `<tr><td>Nov 19, 2026</td>\n<td><a href="https://www.sebi.gov.in/enforcement/orders/nov-2026/a_1.html" target="_blank" title="Order in the matter of Acme &amp; Co" class="points">x</a></tr>`;
    expect(parseSebiListing(html)).toEqual([{ date: "2026-11-19", url: "https://www.sebi.gov.in/enforcement/orders/nov-2026/a_1.html", title: "Order in the matter of Acme & Co" }]);
  });
});

describe("Decision Agent with Black Points", () => {
  const fd = new DecisionAgent();
  const withBp = (status: Record<string, string>) => row({ blackPoints: { symbol: "ACME", sector: "IT", passed: {}, findings: [], status, checkedAt: "", sample: false } as never });

  it("a verified exclusion overrides any score", () => {
    expect(fd.verdict(withBp({ swing: "Excluded", positional: "Excluded" }))).toBe("AVOID");
    expect(fd.verdict(withBp({ swing: "Needs Review", positional: "Excluded" }))).toBe("WATCH");
    const { picks } = fd.decide([withBp({ swing: "Excluded", positional: "Excluded" })], {}, 5, {});
    expect(picks).toHaveLength(0);
  });

  it("narrows the holding plan to the eligible period", () => {
    const d = fd.fitHorizon(withBp({ swing: "Excluded", positional: "Eligible" }));
    expect(d.horizon).toBe("Positional · ~1 month");
    expect(d.stopLoss).toBe(95); // 100 - 2.5 x ATR(2)
    const { picks, all } = fd.decide([withBp({ swing: "Excluded", positional: "Eligible" })], {}, 5, {});
    expect(picks[0].horizon).toBe("Positional · ~1 month");
    expect(all[0].blackPoints!.finalDecision).toMatch(/Excluded from the swing 1-10 days shortlist.*eligible for the positional ~1 month shortlist/i);
  });
});

describe("Black Points in a run", () => {
  it("checks every stock that passed a scan and never picks a held-out stock", async () => {
    const msgs: Message[] = [];
    const res = await runAnalysis({ symbols: ALL_CAPS, top: 10, demo: true, aiNotes: false, riskPerTrade: 1, capital: 500000 }, (e) => { if (e.type === "message") msgs.push(e.message); });
    for (const d of res.all) expect(Boolean(d.blackPoints)).toBe(d.lotappi >= 60 || d.mayavi >= 60);
    for (const p of res.picks) {
      const st = p.blackPoints?.status ?? {};
      const periods = p.horizon.startsWith("Swing, then") ? ["swing", "positional"] : p.horizon.startsWith("Swing") ? ["swing"] : ["positional"];
      for (const x of periods) expect(st[x as "swing"]).toBe("Eligible");
    }
    const bp = msgs.filter((m) => m.sender === "BlackPoints" || m.to === "BlackPoints");
    expect(bp[0]).toMatchObject({ sender: "Research", to: "BlackPoints", thread: "BlackPoints|Research" });
    expect(bp.some((m) => m.sender === "BlackPoints" && m.to === "Decision" && m.table?.columns.includes("Positional"))).toBe(true);
    expect(bp.at(-1)).toMatchObject({ sender: "Decision", to: "BlackPoints" });
  });
});

describe("single-stock search", () => {
  it("researches the searched stock in full even when it ranks low", async () => {
    const symbols = ALL_CAPS.slice(0, 30);
    const first = await runAnalysis({ symbols, top: 5, demo: true, aiNotes: false, riskPerTrade: 1 }, () => {});
    const low = [...first.all].sort((a, b) => a.combined - b.combined)[0].symbol;
    const r = await runAnalysis({ symbols, top: 5, demo: true, aiNotes: false, riskPerTrade: 1, focus: [low] }, () => {});
    const d = r.all.find((x) => x.symbol === low)!;
    expect(d.desk).toBeDefined();
    expect(d.chart).toBeDefined();
    expect(d.blackPoints).toBeDefined();
    expect(Object.keys(d.blackPoints!.status).length).toBeGreaterThan(0);
  });
});
