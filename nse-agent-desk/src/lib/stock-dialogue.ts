/**
 * The agents discussing one stock. Built from that stock's analysis and the
 * run it came from: every number is from the data, nothing is invented.
 * Runs in the browser, so it works for any stock in a run or from a search.
 */
import { MessageBus } from "./bus";
import { inr, pct } from "./format";
import type { BPStatus, Decision, DeskView, HoldingPeriod, Message, RunResult } from "./types";

const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
const lc = (s?: string) => (!s ? "" : /^[A-Z]{2}/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1));
const PERIOD: Record<HoldingPeriod, string> = { swing: "swing (1-10 days)", positional: "positional (~1 month)" };

function deskLine(v: DeskView): string {
  const m = v.metrics.filter((x) => x.value !== undefined).map((x) =>
    `${x.label} ${x.unit === "%" ? `${x.value! >= 0 && !/yield|up years|Pledged|Default/.test(x.label) ? "+" : ""}${x.value}%` : x.unit === "x" ? `${x.value}x` : x.unit === "pts" ? `${x.value! > 0 ? "+" : ""}${x.value}` : x.value}`);
  return `${v.verdict}${v.points ? ` (${v.points > 0 ? "+" : ""}${v.points})` : ""}. ${m.join(", ")}${m.length ? "." : ""}${v.reasons.length ? ` ${v.reasons[0].charAt(0).toUpperCase()}${v.reasons[0].slice(1)}.` : ""}`;
}

export function stockConversation(d: Decision, r: RunResult): Message[] {
  const bus = new MessageBus();
  const s = d.symbol, t = [s];
  const company = d.blackPoints?.company;
  const sector = r.sectors.find((x) => x.sector === d.sector);

  // ---------- Research Agent opens ----------
  bus.stage = "scan";
  bus.send("Research", "ALL",
    `Team, let's look at ${s}${company ? ` (${company})` : ""}: ${d.sector}${d.blackPoints?.subsector ? `, ${d.blackPoints.subsector}` : ""}, ` +
    `${d.fundamentals?.cap && d.fundamentals.cap !== "Unknown" ? `${d.fundamentals.cap.toLowerCase()} cap, ` : ""}last price ${inr(d.entry)}. Each of you, your view.`, { tickers: t });

  // ---------- context agents ----------
  const items = (r.news?.items ?? []).filter((n) => n.symbol === s);
  if (r.news) {
    const pos = items.filter((n) => n.sentiment === "positive"), neg = items.filter((n) => n.sentiment === "negative");
    bus.send("News", "Research", items.length
      ? `${pos.length} positive and ${neg.length} negative headline${items.length > 1 ? "s" : ""} on ${s} today:\n${items.slice(0, 4).map((n) => `• ${n.sentiment === "positive" ? "▲" : "▼"} ${n.headline} (${n.source})`).join("\n")}` +
        `${pos.length ? "\nPositive news added 6 points to both scanners' scores." : ""}`
      : `No ${s} headlines in this morning's ${r.news.label} set (${r.news.total} read), so no news adjustment.`, { tickers: t });
  }
  if (r.vix) {
    const mv = r.vix.movers.find((m) => m.symbol === s);
    bus.send("Volatility", "Research",
      `India VIX is ${r.vix.level.toFixed(2)} (${r.vix.regime.toLowerCase()}, ${pct(r.vix.change1d)} today). ` +
      (mv ? `${s} is on my list: ${mv.expect.toLowerCase()}. ${mv.why}.` : `${s} isn't among the stocks I expect to move most on volatility. Its daily range (ATR) is ${d.atrPct.toFixed(1)}% of the price.`), { tickers: t });
  }
  if (r.macro) {
    const ex = (d.macro ?? []).filter((e) => e.points !== 0);
    bus.send("Macro", "Research", ex.length
      ? `${s} depends on ${list(ex.map((e) => `${e.factor === "gold" ? "gold" : e.factor === "crude" ? "crude oil" : "USD/INR"} (${e.effect.toLowerCase()}, ${e.points > 0 ? "+" : ""}${e.points})`))}. ${ex[0].reason}.`
      : `No strong link between ${s} and gold, crude or USD/INR right now, so no macro adjustment.`, { tickers: t });
  }

  // ---------- scanners ----------
  bus.send("Momentum", "Research",
    `Short-term score ${d.lotappi.toFixed(0)} of 100${d.lotappi >= 60 ? ", it passes my scan" : ", below my 60 cut-off"}. ` +
    `RSI ${d.rsi.toFixed(0)}, ${pct(d.ret5d)} in 5 days, volume ${d.volRatio.toFixed(1)}x normal.` +
    `${d.lotReasons.length ? ` For: ${d.lotReasons.slice(0, 3).map(lc).join("; ")}.` : ""}${d.lotWarnings.length ? ` Against: ${d.lotWarnings.slice(0, 2).map(lc).join("; ")}.` : ""}`, { tickers: t });
  bus.send("Trend", "Research",
    `1-month score ${d.mayavi.toFixed(0)} of 100${d.mayavi >= 60 ? ", it passes my scan" : ", below my 60 cut-off"}. ${pct(d.ret21d)} over the month against the Nifty's ${pct(r.indexRet21d)}.` +
    `${d.mayReasons.length ? ` For: ${d.mayReasons.slice(0, 3).map(lc).join("; ")}.` : ""}${d.mayWarnings.length ? ` Against: ${d.mayWarnings.slice(0, 2).map(lc).join("; ")}.` : ""}`, { tickers: t });
  if (d.conflict) {
    const swingFav = d.lotappi > d.mayavi;
    bus.send(swingFav ? "Momentum" : "Trend", swingFav ? "Trend" : "Momentum",
      swingFav ? `We disagree on ${s}: I see a short-term move, you don't see a trend. It's a quick trade at best, not a hold.`
        : `We disagree on ${s}: the monthly trend is sound but the short-term timing is weak. Better on a dip than now.`, { tickers: t });
  } else if (d.agree) {
    bus.send("Trend", "Momentum", `We both rate ${s} above 60, so short-term momentum and the monthly trend agree.`, { tickers: t });
  }

  // ---------- research desk ----------
  bus.stage = "analyze";
  if (d.desk) {
    bus.send("Research", "Performance", `Research desk, your reports on ${s}, please.`, { tickers: t });
    const desk: [DeskView | undefined][] = [[d.desk.performance], [d.desk.valuation], [d.desk.growth], [d.desk.profitability], [d.desk.seasonal], [d.desk.redFlags], [d.desk.entry]];
    for (const [v] of desk) if (v) bus.send(v.agent, "Research", deskLine(v), { tickers: t });
    bus.send("Research", "Entry", `Thanks, desk: ${d.desk.points >= 0 ? "+" : ""}${d.desk.points} points in total on ${s}.`, { tickers: t });
  }

  // ---------- Research Agent's summary to the Decision Agent ----------
  const c = d.chart;
  const lines = [
    sector ? `Sector: ${d.sector} is ${sector.state.toLowerCase()} (${pct(sector.ret1m)} in a month, ${pct(sector.relStrength)} vs the Nifty, measured on ${sector.sourceLabel}).` : "",
    d.fundamentals?.epsGrowth1y !== undefined ? `Earnings: EPS ${pct(d.fundamentals.epsGrowth1y)} over a year.` : "",
    c ? `Charts: ${c.bullish} of 5 timeframes bullish (${c.timeframes.map((x) => `${x.tf} ${x.trend.toLowerCase()}`).join(", ")}).` +
      (c.zone ? ` Best buy area ${inr(c.zone.low)}-${inr(c.zone.high)}, ${c.zone.plan.toLowerCase()}.` : " No reliable buy area below the price.") : "",
    `Combined score ${d.combined.toFixed(0)} of 100, risk ${d.risk.toLowerCase()} (ATR ${d.atrPct.toFixed(1)}%), holding plan: ${d.horizon}.`,
    `Scenario: entry ${inr(d.entry)}, stop-loss ${inr(d.stopLoss)}, target ${inr(d.target)}.`,
  ].filter(Boolean);
  bus.send("Research", "Decision", `My analysis of ${s}:\n${lines.map((l) => `• ${l}`).join("\n")}`, { kind: "report", tickers: t });

  // ---------- Black Points Analyst ----------
  const bp = d.blackPoints;
  if (bp) {
    bus.send("Research", "BlackPoints", `Black Points Analyst, any downside risks on ${s} before Decision Agent rules?`, { tickers: t });
    const mat = bp.findings.filter((f) => f.materiality === "material");
    const watch = bp.findings.filter((f) => f.materiality !== "material");
    const st = (Object.entries(bp.status) as [HoldingPeriod, BPStatus][]).map(([p, v]) => `${PERIOD[p]}: ${v}`).join("; ");
    bus.send("BlackPoints", "Decision",
      (mat.length
        ? `${mat.length} material finding${mat.length > 1 ? "s" : ""} on ${s}:\n${mat.slice(0, 4).map((f) => `• ${f.flag} (${f.scope === "Sector" ? "whole sector" : "company"}, ${f.verification}): ${f.evidence[0]?.summary ?? f.note}${f.evidence[0]?.date ? ` [${f.evidence[0].source}, ${f.evidence[0].date}]` : ""}`).join("\n")}`
        : `No material red flags on ${s} in the sources I checked.`) +
      `${watch.length ? `\nWatch: ${watch.slice(0, 3).map((f) => f.flag).join("; ")}.` : ""}\nStatus: ${st}.`, { kind: "report", tickers: t });
  }

  // ---------- Decision Agent ----------
  bus.stage = "decide";
  const isPick = r.picks.some((p) => p.symbol === s);
  const why = [
    d.combined >= 70 && d.agree && d.risk !== "HIGH" ? "combined score 70+, both scanners agree and risk isn't high"
      : d.combined >= 60 && d.risk !== "HIGH" ? "combined score 60+ and risk isn't high"
      : d.combined >= 48 ? "combined score between 48 and 60" : "combined score below 48",
  ];
  if (d.fundamentals?.epsTTM !== undefined && d.fundamentals.epsTTM < 0) why.push("loss-making, so it can't be a buy");
  if (d.desk?.severe) why.push("a severe red flag from the Red Flag Agent");
  if (bp?.finalDecision && Object.values(bp.status).some((x) => x !== "Eligible")) why.push("the Black Points ruling");
  bus.send("Decision", "ALL",
    `${s}: ${d.verdict}. Why: ${why.join("; ")}.` +
    (isPick ? ` It's one of this run's final picks${d.quantity ? `: ${d.quantity} shares (${inr(d.investment ?? 0, 0)}) at ${r.riskPerTrade}% risk of your capital` : ""}.`
      : d.passedOver ? ` Buy-rated but left out: ${lc(d.passedOver)}.` : "") +
    (d.clarification ? `\nOn the scanners' disagreement: ${d.clarification}` : "") +
    (bp?.finalDecision ? `\nShortlists: ${bp.finalDecision}` : ""), { kind: "decision", tickers: t });
  if (d.verdict === "STRONG BUY" || d.verdict === "BUY") {
    bus.send("Momentum", "ALL", `If you take it, track the trade and I'll alert you on a 3% loss, near the stop-loss (${inr(d.stopLoss)}) or if it's hit.`, { tickers: t });
    bus.send("Trend", "ALL", `And I'll tell you when it reaches the first exit and the target (${inr(d.target)}).`, { tickers: t });
  }
  return bus.log;
}
