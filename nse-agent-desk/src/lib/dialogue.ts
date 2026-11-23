/**
 * The team conversation, generated from the analysis results of this run.
 *   1. Momentum Agent <-> Trend Agent          compare top threes, agree / disagree
 *   2. Momentum Agent, Trend Agent -> Research Agent five-stock reports
 *   3. Research Agent follow-ups         RSI / 5-day / volume, then 1-month / averages / relative strength
 *   4. Research Agent -> Decision Agent  combined top eight
 *   5. Decision Agent <-> Research Agent disagreements, concentration, capital
 *   6. Decision Agent -> team      the picks; Momentum Agent and Trend Agent confirm
 * Every number comes from the analysis; nothing is invented.
 */
import { MAX_PER_SECTOR } from "./agents/decision";
import type { MessageBus } from "./bus";
import { holdSentence, holdShort, shortDate } from "./hold";
import { inr, pct } from "./format";
import type { LLM } from "./llm";
import { NEWS_BOOST } from "./agents/news";
import { SECTOR_ADJ } from "./sectors";
import { factorName } from "./macro";
import type { PolicyReport } from "./policy";
import type { AgentReport, Analysis, DataSource, Decision, MacroReport, MessageTable, NewsBrief, NewsItem, Person, SectorView, Snapshot, VixReport } from "./types";

const ROLE: Record<Person, string> = {
  News: "news scout who collects the morning stock news",
  Volatility: "volatility analyst who tracks India VIX",
  CentralBank: "central bank analyst who tracks RBI and US Federal Reserve policy and what it means for rate-sensitive sectors",
  Macro: "commodity and currency analyst who tracks gold, crude oil and USD/INR",
  Momentum: "short-term (1-10 day) swing-trade scanner",
  Trend: "1-month positional trend scanner",
  Research: "analyst who combines the short-term and 1-month reports and checks risk",
  Performance: "performance analyst on the research desk who checks YTD, 5-year and expected returns",
  Valuation: "valuation analyst on the research desk who checks P/E, P/B and P/CFO",
  Growth: "growth analyst on the research desk who checks 3-year revenue, cash-flow and profit growth",
  Profitability: "profitability analyst on the research desk who checks ROE, profit margins and cash flow",
  Seasonal: "seasonality analyst on the research desk who checks which months a stock usually rises, its strong quarters and its dividends",
  RedFlag: "risk analyst on the research desk who checks ASM/GSM surveillance, promoter pledges, tip alerts and default risk",
  Entry: "entry-point analyst on the research desk who combines fundamentals and technicals into an entry call",
  BlackPoints: "downside-risk analyst who checks filings, regulator orders, financial health and sector conditions before a stock can be shortlisted",
  Decision: "final decision maker who picks the stocks to act on",
};

const names = (xs: { symbol: string }[]) => xs.map((x) => x.symbol);
const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
// lower-case the first letter, but keep acronyms like EMA9 / RSI / MACD intact
const lc = (s?: string) => (!s ? "" : /^[A-Z]{2}/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1));
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

export interface DialogueInput {
  macro: MacroReport | null;
  sectors: SectorView[];
  excluded: { symbol: string; marketCapCr: number }[];
  minCapCr: number;
  source: DataSource;
  stockCount: number;
  skipped: string[];
  indexRet21d: number;
  aiLabel: string;
  capital?: number;
  riskPerTrade: number;
  news: NewsBrief | null;
  vix: VixReport | null;
  positive: NewsItem[];
  negative: NewsItem[];
  snaps: Record<string, Snapshot>;
  lot: AgentReport[];
  may: AgentReport[];
  rows: Analysis[];
  conflicted: Analysis[];
  clarifications: Record<string, string>;
  picks: Decision[];
  /** Every stock with its final verdict (includes the Black Points rulings). */
  all: Decision[];
  /** What the Black Points Analyst could check this run. */
  bpCoverage?: string[];
  /** Latest moves of the main world indices (live runs). */
  globalCues?: string | null;
  /** Central Bank Agent's RBI and Fed report. */
  policy?: PolicyReport | null;
  passed: Decision[];
  watchlist: Decision[];
}

/** How to enter each pick, from Research Agent's buy zones. */
function entryPlan(picks: Decision[]): string {
  const by = (plan: string) => picks.filter((p) => p.chart?.zone?.plan === plan).map((p) => p.symbol);
  const now = by("In buy zone"), dip = by("Wait for dip"), ext = by("Extended");
  const parts = [
    now.length ? `buy now (in the buy zone): ${list(now)}` : "",
    dip.length ? `wait for a dip into the buy zone: ${list(dip)}` : "",
    ext.length ? `extended, buy only on a pullback: ${list(ext)}` : "",
  ].filter(Boolean);
  return parts.length ? ` How to enter: ${parts.join("; ")}.` : "";
}

export async function runDialogue(bus: MessageBus, llm: LLM, d: DialogueInput) {
  const note = (who: Person, task: string, data: unknown) =>
    llm.comment(`${who}, the ${ROLE[who]}`, task, data);
  const lotBy = new Map(d.lot.map((r) => [r.symbol, r]));
  const mayBy = new Map(d.may.map((r) => [r.symbol, r]));
  const reportTable = (rs: AgentReport[]): MessageTable => ({
    columns: ["Symbol", "Score", "Signal", "Reason"],
    rows: rs.map((r) => [r.symbol, r.score.toFixed(1), r.signal, r.reasons[0] ?? r.warnings[0] ?? "-"]),
  });

  // ---------- Step 1: initial discussion ----------
  bus.stage = "scan";
  bus.send("System", "ALL",
    `Analysis started · ${plural(d.stockCount, "stock")} · ${d.source.label}` +
    `${d.source.seed !== undefined ? ` · run #${d.source.seed}` : ""} · Nifty 50 1-month ${pct(d.indexRet21d)} · ` +
    `agent conversation is simulated from the analysis · AI notes ${d.aiLabel}` +
    (d.skipped.length ? ` · skipped: ${d.skipped.join(", ")}` : "") +
    (d.excluded.length ? ` · left out below ₹${d.minCapCr} Cr market cap: ${d.excluded.map((e) => e.symbol).join(", ")}` : ""), { kind: "system" });

  // ---------- Step 0: News Agent hands over the news ----------
  if (d.news) {
    const pos = d.positive.slice(0, 6);
    const newsTable: MessageTable = { columns: ["Symbol", "Headline", "Source"], rows: pos.map((n) => [n.symbol, n.headline, n.source]) };
    const tag = d.news.sample ? " These are sample headlines, not real news." : "";
    if (pos.length) {
      bus.send("News", "Momentum",
        `News Agent, pre-market report. I went through ${d.news.total} headlines from ${d.news.label}: ${plural(d.positive.length, "stock")} with positive news, ${d.negative.length} with negative. Here are the positive ones for your scan.${tag}`,
        { kind: "report", table: newsTable, tickers: names(pos) });
      const weakL = pos.filter((n) => (lotBy.get(n.symbol)?.score ?? 0) < 50).map((n) => n.symbol);
      bus.send("Momentum", "News",
        `Thanks. Each one gets +${NEWS_BOOST} on my score.` + (weakL.length ? ` ${list(weakL)} still ${weakL.length === 1 ? "fails" : "fail"} my momentum rules, so good news alone doesn't make ${weakL.length === 1 ? "it" : "them"} a trade.` : " They all look tradable on my charts too."),
        { tickers: weakL });
      bus.send("News", "Trend", `Trend Agent, same positive list for your 1-month view.${d.negative.length ? ` Be careful with ${list(names(d.negative.slice(0, 3)))}: negative headlines there.` : ""}`,
        { kind: "report", table: newsTable, tickers: [...names(pos), ...names(d.negative.slice(0, 3))] });
      const strongM = pos.filter((n) => (mayBy.get(n.symbol)?.score ?? 0) >= 60).map((n) => n.symbol);
      bus.send("Trend", "News",
        `Noted, +${NEWS_BOOST} for each. ` + (strongM.length ? `${list(strongM)} already ${strongM.length === 1 ? "has" : "have"} a good monthly trend, so the news supports the chart.` : "None of them has a strong monthly trend yet, so I'll wait for the chart to confirm."),
        { tickers: strongM });
    } else {
      bus.send("News", "Momentum", `News Agent here. I went through ${d.news.total} headlines from ${d.news.label} and found no clearly positive news on the stocks we scan. Nothing to add to your scores today.`);
    }
  }

  const l3 = d.lot.slice(0, 3), m3 = d.may.slice(0, 3);
  const lead = d.lot[0];
  bus.send("Momentum", "Trend",
    `Trend Agent, short-term scan complete. Top three: ${list(l3.map((r) => `${r.symbol} (${r.score.toFixed(0)})`))}. ` +
    `${lead.symbol} stands out: ${[lead.reasons[0], lead.reasons[1]].filter(Boolean).map(lc).join(", ") || "it has the best momentum score"}. What does your monthly view say?`,
    { tickers: names(l3) });

  const overlap = d.rows.filter((r) => r.agree).slice(0, 3).map((r) => r.symbol);
  bus.send("Trend", "Momentum",
    `My 1-month leaders are ${list(m3.map((r) => `${r.symbol} (${r.score.toFixed(0)})`))}. ` +
    (overlap.length
      ? `Good news: we both rate ${list(overlap)} above 60, so ${overlap.length === 1 ? "that one looks" : "those look"} solid on both time frames.`
      : `We don't agree on any stock yet. Your list is momentum, mine is trend.`),
    { tickers: [...names(m3), ...overlap] });

  const c = d.conflicted[0] ?? d.rows.find((r) => r.conflict);
  if (c) {
    const l = lotBy.get(c.symbol)!, m = mayBy.get(c.symbol)!;
    if (c.lotappi > c.mayavi) {
      bus.send("Trend", "Momentum",
        `One thing: you give ${c.symbol} ${l.score.toFixed(0)}, but I only give it ${m.score.toFixed(0)}. ` +
        `${m.warnings[0] ?? "The monthly trend is weak"}. I'd treat it as a quick trade only.`, { tickers: [c.symbol] });
      bus.send("Momentum", "Trend",
        `Fair point. For ${c.symbol} I'd keep it in and out, with a tight stop. Let's flag it to Research Agent.`, { tickers: [c.symbol] });
    } else {
      bus.send("Momentum", "Trend",
        `${c.symbol} is ${m.score.toFixed(0)} on your list but only ${l.score.toFixed(0)} on mine. ` +
        `${l.warnings[0] ?? "Short-term momentum is flat"}. The timing looks off right now.`, { tickers: [c.symbol] });
      bus.send("Trend", "Momentum",
        `True, ${c.symbol} is a trend hold, not a swing. Better to buy it on a dip. I'll flag it to Research Agent.`, { tickers: [c.symbol] });
    }
  } else {
    bus.send("Momentum", "Trend", "No big disagreements between us today. Sending my report to Research Agent now.");
  }

  // ---------- Step 2: individual reports ----------
  bus.send("Momentum", "Research", "Research Agent, here is my short-term shortlist (1-10 trading days).", {
    kind: "report", table: reportTable(d.lot.slice(0, 5)), tickers: names(d.lot.slice(0, 5)),
    aiNote: await note("Momentum", "In 3-4 short lines, explain your best short-term setups and the main risk, speaking to your colleague Research Agent.", d.lot.slice(0, 5)),
  });
  bus.send("Trend", "Research", `And here is my 1-month list, Research Agent. Nifty 50 is ${pct(d.indexRet21d)} over the month, for comparison.`, {
    kind: "report", table: reportTable(d.may.slice(0, 5)), tickers: names(d.may.slice(0, 5)),
    aiNote: await note("Trend", "In 3-4 short lines, explain your best 1-month picks and the main risk, speaking to your colleague Research Agent.", d.may.slice(0, 5)),
  });

  // ---------- Central Bank Agent: RBI and Fed ----------
  if (d.policy) {
    const p = d.policy;
    const days = (iso: string) => Math.round((Date.parse(iso) - Date.parse(new Date(Date.now() + 19800_000).toISOString().slice(0, 10))) / 86400_000);
    const mpc = p.lastMpc;
    const affected = d.rows.filter((r) => r.policy && r.policy.points !== 0);
    const ups = affected.filter((r) => r.policy!.points > 0).map((r) => r.symbol), downs = affected.filter((r) => r.policy!.points < 0).map((r) => r.symbol);
    bus.send("CentralBank", "Research",
      `Research Agent, the rate picture first.${p.sample ? " (Sample figures in demo mode.)" : ""}\n` +
      (p.rbi ? `• RBI: repo rate ${p.rbi.repo}%${p.rbi.crr !== undefined ? `, CRR ${p.rbi.crr}%` : ""}${p.rbi.slr !== undefined ? `, SLR ${p.rbi.slr}%` : ""}.` : "• RBI rates not available.") +
      (mpc ? ` Last MPC (${mpc.meeting ?? "latest"}): ${mpc.decision === "hike" ? `raised the repo rate by ${mpc.bps} bps` : mpc.decision === "cut" ? `cut the repo rate by ${mpc.bps} bps` : "kept the repo rate unchanged"}${mpc.stance ? `, stance ${mpc.stance}` : ""}${mpc.inflation ? `, CPI inflation projected at ${mpc.inflation}` : ""}.` : "") +
      (p.nextMpc ? `\n• Next RBI decision: ${p.nextMpc.decisionDate} (${p.nextMpc.label}), in ${days(p.nextMpc.decisionDate)} days.` : "") +
      (p.fed ? `\n• US Fed: ${p.fed.range}%${p.fed.lastChange ? `, last move a ${p.fed.lastChange.bps} bps ${p.fed.lastChange.dir} on ${p.fed.lastChange.date}` : ""}${p.fed.nextMeeting ? `; next decision ${p.fed.nextMeeting.decisionDate}` : ""}.` : "") +
      `\nThe RBI is ${p.direction}.` +
      (p.direction === "neutral" ? " No adjustment for rate-sensitive sectors." : ` I've moved rate-sensitive sectors (NBFCs, realty, autos, capital goods, infrastructure, cement) by ${p.direction === "tightening" ? "-2" : "+2"}; banks are mixed.`) +
      (downs.length ? ` Marked down: ${downs.length > 8 ? `${downs.slice(0, 8).join(", ")} and ${downs.length - 8} more` : list(downs)}.` : "") + (ups.length ? ` Lifted: ${list(ups.slice(0, 8))}.` : ""),
      { kind: "report", tickers: [...downs, ...ups].slice(0, 12) });
    bus.send("Research", "CentralBank",
      p.nextMpc && days(p.nextMpc.decisionDate) <= 35
        ? `Noted. The RBI decision on ${p.nextMpc.decisionDate} falls inside our holding periods, so the Black Points Analyst will flag it for rate-sensitive stocks.`
        : "Noted, I'll fold the policy effect into the scores.");
  }

  // ---------- Macro Agent: global markets ----------
  if (d.globalCues) {
    bus.send("Macro", "Research", `Global cues first: ${d.globalCues} in their latest sessions. Large overnight moves abroad often show up in the Nifty's opening; the Markets page has every country's index.`);
  }

  // ---------- Macro Agent: gold, crude, USD/INR → Research Agent (before his analysis) ----------
  if (d.macro && d.macro.factors.length) {
    const mx = d.macro;
    const scanned = new Set([...d.lot.slice(0, 10), ...d.may.slice(0, 10)].map((r) => r.symbol));
    const active = mx.exposures.filter((e) => e.points !== 0);
    const shown = [...active.filter((e) => scanned.has(e.symbol)), ...active.filter((e) => !scanned.has(e.symbol))].slice(0, 8);
    bus.send("Macro", "Research",
      `Research Agent, before you combine the lists: ${mx.summary}${mx.sample ? " (Sample series in demo mode.)" : ""}` +
      (shown.length ? " These stocks depend on those moves:" : " None of the scanned stocks is strongly exposed to these moves right now."),
      { kind: "report", tickers: [...new Set(shown.map((e) => e.symbol))],
        table: shown.length ? {
          columns: ["Symbol", "Factor", "Effect", "Points", "Why"],
          rows: shown.map((e) => [e.symbol, factorName(e.factor), e.effect, `${e.points > 0 ? "+" : ""}${e.points}`, e.reason + (e.corr !== undefined && e.basis === "known" ? ` (measured correlation ${e.corr.toFixed(2)})` : "")]),
        } : undefined,
        aiNote: await note("Macro", "In 3-4 short lines, tell Research Agent what the gold, crude and USD/INR moves mean for the listed Indian stocks. Use only the data given.", { factors: mx.factors.map(({ spark: _s, ...f }) => f), exposures: shown }),
      });
    const ups = [...new Set(active.filter((e) => e.effect === "Tailwind").map((e) => e.symbol))].slice(0, 4);
    const downs = [...new Set(active.filter((e) => e.effect === "Headwind").map((e) => e.symbol))].slice(0, 4);
    bus.send("Research", "Macro",
      active.length
        ? `Thanks. I'll add your points to those scores (at most ±4 per stock)` + (ups.length ? `: a lift for ${list(ups)}` : "") + (downs.length ? `${ups.length ? "," : ":"} a cut for ${list(downs)}` : "") + "."
        : "Understood. No macro adjustments today.",
      { tickers: [...ups, ...downs] });
  }

  // ---------- Research desk: Performance, Valuation and Growth Agents → Research Agent ----------
  const deskRows = d.rows.filter((r) => r.desk).slice(0, 8);
  if (deskRows.length) {
    const sample = deskRows[0].desk!.sample ? " (Sample figures in demo mode.)" : "";
    const fmt = (v: number | undefined, unit: "%" | "x") => (v === undefined ? "–" : unit === "%" ? pct(v) : `${v.toFixed(1)}x`);
    const best = (pick: (r: Analysis) => number | undefined, n = 3) =>
      deskRows.filter((r) => pick(r) !== undefined).sort((a, b) => pick(b)! - pick(a)!).slice(0, n).map((r) => r.symbol);
    bus.send("Research", "Performance",
      `Research desk, before I rank the top ${plural(deskRows.length, "candidate")}: Performance Agent, check the returns; Valuation Agent, the price against earnings, book and cash flow; Growth Agent, the 3-year growth; Profitability Agent, ROE, margins and cash flow; Seasonality Agent, the seasonal pattern and dividends; Red Flag Agent, surveillance, pledges, tips and default risk; Entry Point Agent, where to get in.`,
      { tickers: names(deskRows) });

    const perf = (r: Analysis) => r.desk!.performance;
    const fiveLead = best((r) => perf(r).metrics[1].value);
    const expLead = best((r) => perf(r).metrics[2].value);
    const analyst = deskRows.some((r) => perf(r).metrics[2].note?.startsWith("mean target"));
    bus.send("Performance", "Research",
      `Returns are in.${sample} ${fiveLead.length ? `Best 5-year compounders: ${list(fiveLead)}. ` : ""}${expLead.length ? `Highest expected 1-year return: ${list(expLead)}` : ""}` +
      `${expLead.length ? (analyst ? " (analyst targets where available, otherwise my earnings-based estimate)." : " (my estimate from earnings growth and valuation, not a forecast).") : ""}`,
      { kind: "report", tickers: [...new Set([...fiveLead, ...expLead])], table: {
        columns: ["Symbol", "YTD", "5Y a year", "Expected 1Y", "View", "Points"],
        rows: deskRows.map((r) => { const p = perf(r); return [r.symbol, fmt(p.metrics[0].value, "%"), fmt(p.metrics[1].value, "%"), fmt(p.metrics[2].value, "%"), p.verdict, `${p.points >= 0 ? "+" : ""}${p.points}`]; }),
      } });

    const val = (r: Analysis) => r.desk!.valuation;
    const cheap = deskRows.filter((r) => val(r).points >= 1).map((r) => r.symbol);
    const dear = deskRows.filter((r) => val(r).points <= -2).map((r) => r.symbol);
    const cashGap = deskRows.filter((r) => val(r).reasons.some((x) => x.includes("not fully backed by cash"))).map((r) => r.symbol);
    bus.send("Valuation", "Research",
      `I compared each P/E with the median of its sector in this run.` +
      `${cheap.length ? ` Cheaper than their sector: ${list(cheap)}.` : " None is clearly cheaper than its sector."}` +
      `${dear.length ? ` Expensive: ${list(dear)}.` : ""}${cashGap.length ? ` Watch ${list(cashGap)}: the price is high against operating cash flow, so profits are not fully backed by cash.` : ""}`,
      { kind: "report", tickers: [...new Set([...cheap, ...dear, ...cashGap])], table: {
        columns: ["Symbol", "P/E (TTM)", "Sector P/E", "P/B", "P/CFO", "View", "Points"],
        rows: deskRows.map((r) => { const v = val(r); return [r.symbol, fmt(v.metrics[0].value, "x"), v.metrics[0].note?.replace("sector median ", "") ?? "–", fmt(v.metrics[1].value, "x"), fmt(v.metrics[2].value, "x"), v.verdict, `${v.points >= 0 ? "+" : ""}${v.points}`]; }),
      } });

    const gr = (r: Analysis) => r.desk!.growth;
    const fast = deskRows.filter((r) => gr(r).points >= 3).map((r) => r.symbol);
    const shrink = deskRows.filter((r) => gr(r).points < 0).map((r) => r.symbol);
    bus.send("Growth", "Research",
      `3-year growth, as yearly rates (CAGR) from the annual reports.` +
      `${fast.length ? ` Growing 15% a year or more on average: ${list(fast)}.` : " None grew 15% a year or more on average."}` +
      `${shrink.length ? ` Shrinking or loss-making: ${list(shrink)}.` : ""}`,
      { kind: "report", tickers: [...fast, ...shrink], table: {
        columns: ["Symbol", "Revenue", "Cash flow", "Profit", "View", "Points"],
        rows: deskRows.map((r) => { const g = gr(r); return [r.symbol, fmt(g.metrics[0].value, "%"), fmt(g.metrics[1].value, "%"), fmt(g.metrics[2].value, "%"), g.verdict, `${g.points >= 0 ? "+" : ""}${g.points}`]; }),
      } });

    const pr = (r: Analysis) => r.desk!.profitability;
    const highRoe = deskRows.filter((r) => pr(r).points >= 2).map((r) => r.symbol);
    const weakP = deskRows.filter((r) => pr(r).points < 0).map((r) => r.symbol);
    bus.send("Profitability", "Research",
      `Profitability from the latest annual report: ROE, net margin, and how much of the profit arrived as cash over 3 years.` +
      `${highRoe.length ? ` Highly profitable: ${list(highRoe)}.` : " None stands out on ROE."}${weakP.length ? ` Weak: ${list(weakP)}.` : ""}`,
      { kind: "report", tickers: [...highRoe, ...weakP], table: {
        columns: ["Symbol", "ROE", "Net margin", "Cash / profit", "View", "Points"],
        rows: deskRows.map((r) => { const v = pr(r); return [r.symbol, fmt(v.metrics[0].value, "%"), fmt(v.metrics[1].value, "%"), fmt(v.metrics[2].value, "x"), v.verdict, `${v.points >= 0 ? "+" : ""}${v.points}`]; }),
      } });

    const withSeason = deskRows.filter((r) => r.desk!.seasonal?.seasonalDetail);
    if (withSeason.length) {
      const sv = (r: Analysis) => r.desk!.seasonal!;
      const sd = (r: Analysis) => sv(r).seasonalDetail!;
      const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const win = sd(withSeason[0]).window.map((m) => MON[m - 1]).join("-");
      const tail = withSeason.filter((r) => sv(r).points >= 2).map((r) => r.symbol);
      const head = withSeason.filter((r) => sv(r).points < 0).map((r) => r.symbol);
      const exSoon = withSeason.filter((r) => sd(r).nextEx && sd(r).window.some((m) => sd(r).nextEx!.month.startsWith(MON[m - 1])));
      bus.send("Seasonal", "Research",
        `Seasonal check for ${win}, from up to ${Math.max(...withSeason.map((r) => sd(r).years))} years of monthly prices, the last quarters' results and the dividend history.` +
        `${tail.length ? ` Usually strong in ${win}: ${list(tail)}.` : ` None has a strong ${win} record.`}${head.length ? ` Usually weak now: ${list(head)}.` : ""}` +
        `${exSoon.length ? ` Ex-dividend likely soon for ${list(exSoon.map((r) => r.symbol))}: the price normally drops by about the dividend on that day, so don't read it as a fall in value.` : ""}` +
        `${withSeason[0].desk!.sample ? " (Sample history in demo mode.)" : ""}`,
        { kind: "report", tickers: [...tail, ...head, ...names(exSoon)], table: {
          columns: ["Symbol", `${win} up years`, "Best month", "Strong quarter", "Div. yield", "Next ex-date", "Points"],
          rows: withSeason.map((r) => {
            const d = sd(r), best = [...d.months].sort((a, b) => b.avg - a.avg)[0];
            const q = [...d.quarters].filter((x) => x.revenueVsAvg !== undefined).sort((a, b) => b.revenueVsAvg! - a.revenueVsAvg!)[0];
            return [r.symbol, d.years ? `${sv(r).metrics[0].value}% (avg ${sv(r).metrics[0].note?.split(" ")[1] ?? "–"})` : "–", d.years ? `${MON[best.month - 1]} ${best.avg >= 0 ? "+" : ""}${best.avg}%` : "–",
              q ? q.label.split(" ")[0] + ` (${q.revenueVsAvg! >= 0 ? "+" : ""}${q.revenueVsAvg}%)` : "–", d.yieldPct !== undefined ? `${d.yieldPct}%` : "none",
              d.nextEx ? `~${d.nextEx.month} ₹${d.nextEx.amount}` : "–", `${sv(r).points >= 0 ? "+" : ""}${sv(r).points}`];
          }),
        } });
    }

    const rf = (r: Analysis) => r.desk!.redFlags;
    // Severe flags from every stock the desk checked, not only the top eight shown.
    const severe = d.rows.filter((r) => r.desk?.severe);
    const cautious = deskRows.filter((r) => !r.desk!.severe && rf(r).points < 0).map((r) => r.symbol);
    const unknown = [...new Set(deskRows.flatMap((r) => rf(r).flags!.filter((f) => f.status === "unknown").map((f) => f.check)))].filter((c) => c !== "Default risk");
    const status = (r: Analysis, c: string) => { const f = rf(r).flags!.find((x) => x.check === c)!; return f.status === "clear" ? "OK" : f.status === "unknown" ? "?" : f.status === "severe" ? "FLAG" : "Watch"; };
    bus.send("RedFlag", "Research",
      (severe.length ? `Red flags: ${severe.map((r) => `${r.symbol} (${rf(r).flags!.filter((f) => f.status === "severe").map((f) => f.check).join(", ")})`).join("; ")}. Decision Agent should not rate these above WATCH.` : `No severe red flags among the ${plural(d.rows.filter((r) => r.desk).length, "stock")} we checked.`) +
      `${cautious.length ? ` Caution on ${list(cautious)}.` : ""}${unknown.length ? ` Not verified this run: ${list(unknown)}.` : ""}` +
      `${deskRows[0].desk!.sample ? " (Sample lists in demo mode.)" : ""}`,
      { kind: "report", tickers: [...names(severe), ...cautious], table: {
        columns: ["Symbol", "ASM", "GSM", "Pledge", "Tips", "Default prob.", "Points"],
        rows: deskRows.map((r) => [r.symbol, status(r, "ASM"), status(r, "GSM"), status(r, "Promoter pledge"), status(r, "Unsolicited tips"),
          rf(r).metrics[2].value === undefined ? "–" : rf(r).metrics[2].value! < 0.01 ? "<0.01%" : `${rf(r).metrics[2].value}%`, `${rf(r).points}`]),
      } });

    const withEntry = deskRows.filter((r) => r.desk!.entry);
    if (withEntry.length) {
      const by = (p: string) => withEntry.filter((r) => r.desk!.entry!.verdict === p).map((r) => r.symbol);
      const now = by("Buy now"), dip = by("Buy on dip"), avoid = by("Avoid");
      bus.send("Entry", "Research",
        `Entry calls from fundamentals plus technicals.` +
        `${now.length ? ` Buy now: ${list(now)}.` : ""}${dip.length ? ` Buy on a dip into the zone: ${list(dip)}.` : ""}${avoid.length ? ` Avoid for now: ${list(avoid)}.` : ""}`,
        { kind: "report", tickers: [...now, ...dip, ...avoid], table: {
          columns: ["Symbol", "Fundamentals", "Technicals", "Entry area", "Call"],
          rows: withEntry.map((r) => { const e = r.desk!.entry!; return [r.symbol, e.metrics[0].note ?? "–", e.metrics[1].note ?? "–", e.metrics[2].note ?? "–", e.verdict]; }),
        } });
    }

    const ups = deskRows.filter((r) => r.desk!.points >= 9).map((r) => r.symbol);
    const downs = deskRows.filter((r) => r.desk!.points <= -3).map((r) => r.symbol);
    bus.send("Research", "Entry",
      `Thanks, desk. I've added your points to each score: up to ±10 for performance, valuation, growth and profitability, up to −10 for red flags, ±2 for the entry call.` +
      `${ups.length ? ` Biggest lift for ${list(ups)}.` : ""}${downs.length ? ` Marked down: ${list(downs)}.` : ""}`,
      { tickers: [...ups, ...downs] });
  }

  // ---------- Step 3: follow-up research ----------
  bus.stage = "analyze";
  const top = d.rows[0];
  const ts = d.snaps[top.symbol], tm = mayBy.get(top.symbol)!;
  bus.send("Research", "Momentum", `Thanks, Momentum Agent. ${top.symbol} ranks highest after I combine both lists. Is the move still fresh, or are we late?`, { tickers: [top.symbol] });
  bus.send("Momentum", "Research",
    `RSI is ${ts.rsi.toFixed(0)}${ts.rsi > 70 ? ", so it's getting stretched" : ts.rsi < 45 ? ", so momentum is soft" : ", so there's still room"}. ` +
    `It moved ${pct(ts.ret5d)} in 5 days, and today's volume is ${ts.volRatio.toFixed(1)}x the 20-day average` +
    `${ts.volRatio >= 1.5 ? ", which confirms buyers are active." : ts.volRatio < 0.8 ? ", which is thin, so I wouldn't chase it." : ", which is normal."}`,
    { tickers: [top.symbol] });
  bus.send("Research", "Trend", `Trend Agent, does ${top.symbol} hold up over a month?`, { tickers: [top.symbol] });
  const above = (v: number) => (ts.close > v ? "above" : "below");
  const rs = ts.ret21d - d.indexRet21d;
  bus.send("Trend", "Research",
    `It is ${pct(ts.ret21d)} over the month. Price is ${above(ts.sma20)} its 20-day and ${above(ts.sma50)} its 50-day average` +
    `${Number.isNaN(ts.sma200) ? "" : `, and ${above(ts.sma200)} the 200-day`}. Against the Nifty it is ${rs >= 0 ? "ahead" : "behind"} by ${Math.abs(rs).toFixed(1)}%. ` +
    `${tm.score >= 60 ? "I'm comfortable holding it for a month." : `My score is only ${tm.score.toFixed(0)}, so I'm not convinced for a month.`}`,
    { tickers: [top.symbol] });

  // ---------- Volatility Agent reports to Research Agent ----------
  if (d.vix) {
    const v = d.vix;
    bus.send("Volatility", "Research",
      `Research Agent, India VIX is at ${v.level.toFixed(2)}, ${v.direction === "flat" ? "little changed" : v.direction} ${pct(v.change1d)} today and ${pct(v.change5d)} over 5 days. Regime: ${v.regime.toLowerCase()}.` +
      `${v.sample ? " (Demo VIX, not the real index.)" : ""}\n\nLikely why:\n${v.reasons.map((r) => `• ${r}`).join("\n")}\n\nThese are my inferences from prices and headlines. Stocks I expect to move next:`,
      { kind: "report", tickers: names(v.movers), table: { columns: ["Symbol", "Expect", "Why"], rows: v.movers.map((m) => [m.symbol, m.expect, m.why]) },
        aiNote: await note("Volatility", "In 3-4 short lines, explain to Research Agent what the India VIX move means for the stocks listed. Do not claim causes that are not in the data.", v) });
    const risky = v.movers.filter((m) => m.expect === "At risk" || m.expect === "Bigger swings").map((m) => m.symbol);
    bus.send("Research", "Volatility",
      v.direction === "up" ? `Understood. With VIX rising I'll treat ${risky.length ? list(risky) : "high-beta names"} with extra care and keep the stops firm.`
        : v.direction === "down" ? "Good. Falling VIX supports holding trends longer. I'll still size every trade by its stop-loss."
        : "Thanks. A steady VIX means I rate each stock on its own chart today.", { tickers: risky });
  }

  // ---------- Research Agent's sector check ----------
  if (d.sectors.length) {
    const by = (st: SectorView["state"]) => d.sectors.filter((x) => x.state === st).map((x) => x.sector);
    const lead = by("Leading"), lag = by("Lagging"), imp = by("Improving"), weak = by("Weakening");
    const indexN = d.sectors.filter((x) => x.source === "index").length;
    bus.send("Research", "Decision",
      `Sector check against the Nifty 50 (${indexN ? `${indexN} from NSE sector indices, the rest from` : "from"} the average of each sector's stocks in this run): ` +
      [lead.length && `leading ${list(lead)}`, imp.length && `improving ${list(imp)}`, weak.length && `weakening ${list(weak)}`, lag.length && `lagging ${list(lag)}`].filter(Boolean).join("; ") +
      `. I've moved each stock's score by its sector: leading ${SECTOR_ADJ.Leading >= 0 ? "+" : ""}${SECTOR_ADJ.Leading}, improving +${SECTOR_ADJ.Improving}, weakening ${SECTOR_ADJ.Weakening}, lagging ${SECTOR_ADJ.Lagging}.`,
      { kind: "report", tickers: [], table: {
        columns: ["Sector", "State", "1M", "vs Nifty", "Breadth", "Rank"],
        rows: d.sectors.slice(0, 10).map((x) => [x.sector, x.state, pct(x.ret1m), pct(x.relStrength), `${x.breadth}%`, `${x.rank} of ${d.sectors.length}`]),
      } });
  }

  // ---------- Research Agent's earnings and size check ----------
  const withF = d.rows.filter((r) => r.fundamentals);
  if (withF.length) {
    const sizes = ["Large", "Mid", "Small"].map((c) => `${withF.filter((r) => r.fundamentals!.cap === c).length} ${c.toLowerCase()}`).join(", ");
    const growing = withF.filter((r) => (r.fundamentals!.epsGrowth1y ?? -1) >= 10).length;
    const falling = withF.filter((r) => (r.fundamentals!.epsGrowth1y ?? 0) < 0).map((r) => r.symbol);
    const losses = withF.filter((r) => (r.fundamentals!.epsTTM ?? 0) < 0).map((r) => r.symbol);
    const sample = withF.some((r) => r.fundamentals!.sample) ? " (sample figures in demo mode)" : "";
    const unknownN = withF.filter((r) => r.fundamentals!.cap === "Unknown").length;
    const top8 = d.rows.slice(0, 8);
    const capText = (r: Analysis) => (r.fundamentals?.marketCapCr !== undefined ? `${inr(r.fundamentals.marketCapCr, 0)} Cr` : "-");
    const epsText = (v?: number) => (v === undefined ? "-" : inr(v));
    bus.send("Research", "Decision",
      `Earnings and size check${sample}: ${sizes} cap stocks above ₹${d.minCapCr} Cr.` +
      (d.excluded.length ? ` I left out ${list(d.excluded.map((e) => `${e.symbol} (${inr(e.marketCapCr, 0)} Cr)`))} as too small.` : "") +
      (unknownN ? ` ${plural(unknownN, "stock")} had no market-cap data, so I couldn't verify ${unknownN === 1 ? "its" : "their"} size.` : "") +
      ` ${plural(growing, "stock")} grew EPS by 10% or more over the last year.` +
      (falling.length ? ` EPS fell for ${plural(falling.length, "stock")}${falling.length <= 4 ? ` (${list(falling)})` : ""}, which I marked down.` : "") +
      (losses.length ? ` Loss-making: ${list(losses.slice(0, 4))}.` : "") + " Top eight:",
      { kind: "report", tickers: names(top8), table: {
        columns: ["Symbol", "Size", "Market cap", "EPS now", "EPS 1Y ago", "EPS growth"],
        rows: top8.map((r) => [r.symbol, r.fundamentals?.cap ?? "Unknown", capText(r), epsText(r.fundamentals?.epsTTM), epsText(r.fundamentals?.epsYearAgo),
          (r.fundamentals?.epsTTM ?? 0) < 0 ? "Loss" : r.fundamentals?.epsGrowth1y !== undefined ? pct(r.fundamentals.epsGrowth1y) : "-"]),
      } });
  }

  // ---------- Research Agent's chart check: 1M / 1D / 4H / 1H / 30m + best buy area ----------
  const charted = d.rows.filter((r) => r.chart).slice(0, 6);
  if (charted.length) {
    const cell = (t: string) => (t === "Bullish" ? "Bullish" : t === "Bearish" ? "Bearish" : "Neutral");
    const zoneText = (r: Analysis) => (r.chart!.zone ? `${inr(r.chart!.zone.low, 0)}-${inr(r.chart!.zone.high, 0)}` : "None below price");
    const lead = charted[0], lc_ = lead.chart!, z = lc_.zone;
    const intraNote = charted.some((r) => !r.chart!.intraday) ? " Intraday candles were missing for some stocks, so those are read on 1M and 1D only." : "";
    bus.send("Research", "Decision",
      `I checked the charts of the top candidates on five timeframes (1M, 1D, 4H, 1H, 30m) and found each one's best buy area from its 1-month, 3-month, 6-month and 1-year history.${intraNote}`,
      { kind: "report", tickers: names(charted), table: {
        columns: ["Symbol", "1M", "1D", "4H", "1H", "30m", "Buy zone", "Plan"],
        rows: charted.map((r) => [r.symbol, ...r.chart!.timeframes.map((t) => cell(t.trend)), zoneText(r), r.chart!.zone?.plan ?? "No zone"]),
      } });
    const hist = lc_.history.map((h) => `${h.label}: range ${inr(h.low, 0)}-${inr(h.high, 0)}, most traded ${inr(h.poc, 0)}`).join("\n");
    bus.send("Research", "Decision",
      `${lead.symbol} in detail: ${lc_.bullish} of 5 timeframes bullish.\n${hist}\n\n` +
      (z ? `Best buy area: ${inr(z.low)}-${inr(z.high)}, from ${z.basis.join("; ")}. ` +
        (z.plan === "In buy zone" ? "Price is inside it now, so it can be bought here" : z.plan === "Wait for dip" ? `Price is ${z.distancePct.toFixed(1)}% above it, so I'd wait for a dip into the zone` : `Price is ${z.distancePct.toFixed(1)}% above it, which is extended; I wouldn't chase it`) +
        `. A stop under the zone would be ${inr(z.stop)}.`
        : "Price is below all its recent support levels, so there is no buy area I'd trust yet."),
      { tickers: [lead.symbol] });

    // If the daily trend is up but the short charts are down, ask Momentum Agent whether it's just a dip.
    const dip = charted.find((r) => r.chart!.timeframes[1].trend === "Bullish" && r.chart!.timeframes.slice(3).every((t) => t.trend === "Bearish"));
    if (dip) {
      const dz = dip.chart!.zone;
      bus.send("Research", "Momentum", `Momentum Agent, ${dip.symbol} is bullish on the daily chart but bearish on 1H and 30m. Is that just a pullback?`, { tickers: [dip.symbol] });
      bus.send("Momentum", "Research",
        `Looks like a pullback inside an uptrend: 30-minute RSI is ${dip.chart!.timeframes[4].rsi.toFixed(0)}. ` +
        (dz ? `I'd only buy once it reaches the ${inr(dz.low, 0)}-${inr(dz.high, 0)} area or the 30m chart turns up again.` : "I'd wait for the 30m chart to turn up before buying."),
        { tickers: [dip.symbol] });
    }
  }

  // ---------- Step 4: combined analysis ----------
  const agreeN = d.rows.filter((r) => r.agree).length;
  const highN = d.rows.filter((r) => r.risk === "HIGH").length;
  const top8 = d.rows.slice(0, 8);
  bus.send("Research", "Decision",
    `My combined analysis is ready. Momentum Agent and Trend Agent both like ${plural(agreeN, "stock")}; ` +
    (highN ? `${plural(highN, "stock")} carry high risk and I've marked them down.` : "none carry high risk.") +
    " Top eight, with a trade scenario for each (target is twice the risk):", {
      kind: "report", tickers: names(top8),
      table: {
        columns: ["Symbol", "Combined", "Risk", "Holding plan", "Entry", "Stop-loss", "Target"],
        rows: top8.map((r) => [r.symbol, r.combined.toFixed(1), r.risk, r.horizon, inr(r.entry), inr(r.stopLoss), inr(r.target)]),
      },
      aiNote: await note("Research", "In 4-5 short lines, tell Decision Agent where the short-term and 1-month views agree or conflict, and which stocks look strongest after risk.", top8),
    });

  // ---------- Black Points Analyst: downside risks before anything is shortlisted ----------
  const checked = d.all.filter((x) => x.blackPoints);
  if (checked.length) {
    const PL: Record<string, string> = { swing: "Swing", positional: "Positional" };
    const st = (x: Decision, p: "swing" | "positional") => x.blackPoints!.status[p] ?? "–";
    const blocked = checked.filter((x) => Object.values(x.blackPoints!.status).some((s) => s !== "Eligible"));
    const excluded = checked.filter((x) => Object.values(x.blackPoints!.status).includes("Excluded"));
    const review = checked.filter((x) => Object.values(x.blackPoints!.status).includes("Needs Review"));
    bus.send("Research", "BlackPoints",
      `Black Points Analyst, ${plural(checked.length, "stock")} passed the Momentum or Trend scan. Before Decision Agent shortlists any of them, check each for structural decline, sector pressure, company weakness, governance problems and events inside the holding period.`,
      { tickers: names(checked).slice(0, 12) });
    bus.send("BlackPoints", "Research",
      `On it. What I can check this run:\n${(d.bpCoverage ?? []).map((c) => `• ${c}`).join("\n")}\nA finding counts as verified only when a primary source backs it; headlines alone put a stock in Needs Review.`);
    const top = (x: Decision) => x.blackPoints!.findings.filter((f) => f.materiality === "material").sort((a, b) => (a.verification === "verified" ? -1 : 1) - (b.verification === "verified" ? -1 : 1))[0];
    bus.send("BlackPoints", "Decision",
      `Risk report for ${plural(checked.length, "stock")}: ${checked.length - blocked.length} eligible, ${excluded.length} excluded on verified evidence, ${review.length} need review.` +
      (blocked.length ? " Details for the flagged ones follow." : " No material red flags in this group."),
      { kind: "report", tickers: names(blocked), table: {
        columns: ["Symbol", "Sector · subsector", "Passed scan", "Red flag", "Scope", "Swing", "Positional", "Evidence"],
        rows: [...blocked, ...checked.filter((x) => !blocked.includes(x))].slice(0, 14).map((x) => {
          const f = top(x), e = f?.evidence[0];
          return [x.symbol, `${x.blackPoints!.sector}${x.blackPoints!.subsector ? ` · ${x.blackPoints!.subsector}` : ""}`,
            Object.keys(x.blackPoints!.passed).map((p) => PL[p]).join(" + "), f ? `${f.flag} (${f.verification})` : "None material", f?.scope ?? "–",
            st(x, "swing"), st(x, "positional"), e ? `${e.source}${e.date ? `, ${e.date}` : ""}` : "–"];
        }),
      } });
    for (const x of blocked.slice(0, 4)) {
      const bp = x.blackPoints!;
      const fs = bp.findings.filter((f) => f.materiality === "material" && Object.values(f.impact).some((s) => s !== "Eligible"));
      bus.send("BlackPoints", "Decision",
        `${x.symbol} (${bp.sector}${bp.subsector ? `, ${bp.subsector}` : ""}). Passed the scan: ${Object.values(bp.passed).join(" | ")}.\n` +
        fs.map((f) => `• ${f.flag}: ${f.scope === "Sector" ? "affects the whole sector" : "affects the company"}, ${f.verification}. ${f.note}\n  Evidence: ${f.evidence.slice(0, 2).map((e) => `${e.summary} (${e.source}${e.date ? `, ${e.date}` : ""})`).join("; ")}`).join("\n") +
        `\nSuggested: ${Object.entries(bp.status).map(([p, s]) => `${PL[p]} ${s}`).join(", ")}. Source links are in the Flagged Stocks tab.`,
        { tickers: [x.symbol] });
    }
    bus.send("Decision", "BlackPoints",
      blocked.length
        ? `Applied. ${excluded.length ? `${list(names(excluded))} ${excluded.length === 1 ? "is" : "are"} excluded from the affected shortlists. ` : ""}${review.length ? `${list(names(review))} ${review.length === 1 ? "is" : "are"} held out pending review. ` : ""}A strong technical score or a vote from the scanners can't override this. They stay visible in the Flagged Stocks tab with your evidence.`
        : "Thanks. Everything you checked is eligible; I'll shortlist on the scores.",
      { tickers: names(blocked) });
  }

  // ---------- Step 5: portfolio review ----------
  bus.stage = "debate";
  if (d.conflicted.length) {
    const syms = names(d.conflicted);
    bus.send("Decision", "Research", `Momentum Agent and Trend Agent disagree on ${list(syms)}. Which view should I trust?`, { tickers: syms });
    bus.send("Research", "Decision", syms.map((s) => `${s}: ${d.clarifications[s]}`).join("\n\n"), { tickers: syms });
  } else if (d.picks[0]) {
    const p = d.picks[0];
    bus.send("Decision", "Research", `No open disagreements in the top group. Any red flags on ${p.symbol} before I commit?`, { tickers: [p.symbol] });
    bus.send("Research", "Decision",
      `Risk is ${p.risk.toLowerCase()} (ATR ${p.atrPct.toFixed(1)}% of price). The scenario: stop-loss ${inr(p.stopLoss)}, target ${inr(p.target)}. ` +
      `These are research levels, not guaranteed prices. A gap down can skip the stop.`, { tickers: [p.symbol] });
  }

  if (d.passed.length) {
    const syms = names(d.passed);
    bus.send("Decision", "Research",
      `On concentration: I'm leaving out ${list(d.passed.map((p) => `${p.symbol} (${p.sector})`))}. ` +
      `We already hold ${MAX_PER_SECTOR} from ${d.passed.length === 1 ? "that sector" : "those sectors"}, and I won't put more than that in one sector.`, { tickers: syms });
    bus.send("Research", "Decision", `Agreed. ${list(syms)} ${syms.length === 1 ? "goes" : "go"} on the watchlist instead.`, { tickers: syms });
  }
  if (d.capital && d.picks.length) {
    const invested = d.picks.reduce((s, p) => s + (p.investment ?? 0), 0);
    const zero = d.picks.filter((p) => !p.quantity);
    bus.send("Decision", "Research",
      `On capital: with ${inr(d.capital, 0)} and ${d.riskPerTrade}% risk per trade, the picks use ${inr(invested, 0)} ` +
      `(${((invested / d.capital) * 100).toFixed(0)}% of capital).` +
      (zero.length ? ` There isn't enough left to size ${list(names(zero))}, so ${zero.length === 1 ? "it stays" : "they stay"} at zero shares.` : ""),
      { tickers: names(zero) });
  }

  // ---------- Step 6: final announcement ----------
  bus.stage = "decide";
  bus.send("Decision", "ALL",
    d.picks.length
      ? `Decision made. We go with ${list(names(d.picks))}.` + entryPlan(d.picks) +
        (d.watchlist.length ? ` Watchlist: ${list(names(d.watchlist))}.` : "") + " Momentum Agent, Trend Agent, please confirm."
      : `Decision made: no stock passes our buy rules today, so we stay in cash.` +
        (d.watchlist.length ? ` Watchlist: ${list(names(d.watchlist))}.` : ""),
    {
      kind: "decision", tickers: [...names(d.picks), ...names(d.watchlist)],
      table: d.picks.length ? {
        columns: ["Symbol", "Verdict", "Entry", "Stop-loss", "Target", "Hold", "Exit by", "Expected", "Buy zone"],
        rows: d.picks.map((p) => [p.symbol, p.verdict, inr(p.entry), inr(p.stopLoss), inr(p.target),
          holdShort(p.hold), shortDate(p.hold?.exitBy) || "-", p.hold ? `${p.hold.expectedReturnPct >= 0 ? "+" : ""}${p.hold.expectedReturnPct.toFixed(1)}%` : "-",
          p.chart?.zone ? `${inr(p.chart.zone.low, 0)}-${inr(p.chart.zone.high, 0)}` : "-"]),
      } : undefined,
      aiNote: await note("Decision", "In 4-6 short lines, tell the team why these picks and how to manage them (stop-loss, target). End with one sentence saying this is not financial advice.",
        { picks: d.picks.map(({ spark: _s, ...p }) => p), watchlist: names(d.watchlist) }),
    });

  // How long to hold each pick, from 1,000 simulated price paths per stock.
  const planned = d.picks.filter((p) => p.hold);
  if (planned.length) {
    bus.send("Decision", "ALL",
      `How long to hold, from 1,000 simulated price paths per stock:\n${planned.map((p) => `• ${p.symbol}: ${holdSentence(p.hold!)}`).join("\n")}`,
      { kind: "report", tickers: names(planned) });
  }

  if (d.picks.length) {
    const swing = d.picks.filter((p) => p.horizon.startsWith("Swing")).slice(0, 3);
    bus.send("Momentum", "ALL",
      `Confirmed. I'll watch the short-term stop-losses daily${swing.length ? `, starting with ${list(names(swing))}` : ""}.`, { tickers: names(swing) });
    bus.send("Trend", "ALL", "Confirmed. I'll track the monthly trend and flag any breakdown early.");
  } else {
    bus.send("Momentum", "ALL", "Understood. I'll rescan tomorrow.");
    bus.send("Trend", "ALL", "Agreed. No trend worth holding today.");
  }
}
