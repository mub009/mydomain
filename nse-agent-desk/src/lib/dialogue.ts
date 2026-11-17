/**
 * The team conversation, generated from the analysis results of this run.
 *   1. Lotappi <-> Mayavi          compare top threes, agree / disagree
 *   2. Lotappi, Mayavi -> Mubashir five-stock reports
 *   3. Mubashir follow-ups         RSI / 5-day / volume, then 1-month / averages / relative strength
 *   4. Mubashir -> Final Decision  combined top eight
 *   5. Final Decision <-> Mubashir disagreements, concentration, capital
 *   6. Final Decision -> team      the picks; Lotappi and Mayavi confirm
 * Every number comes from the analysis; nothing is invented.
 */
import { MAX_PER_SECTOR } from "./agents/finalDecision";
import type { MessageBus } from "./bus";
import { inr, pct } from "./format";
import type { LLM } from "./llm";
import type { AgentReport, Analysis, DataSource, Decision, MessageTable, Person, Snapshot } from "./types";

const ROLE: Record<Person, string> = {
  Lotappi: "short-term (1-10 day) swing-trade scanner",
  Mayavi: "1-month positional trend scanner",
  Mubashir: "analyst who combines the short-term and 1-month reports and checks risk",
  FinalDecision: "final decision maker who picks the stocks to act on",
};

const names = (xs: { symbol: string }[]) => xs.map((x) => x.symbol);
const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
// lower-case the first letter, but keep acronyms like EMA9 / RSI / MACD intact
const lc = (s?: string) => (!s ? "" : /^[A-Z]{2}/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1));
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

export interface DialogueInput {
  source: DataSource;
  stockCount: number;
  skipped: string[];
  indexRet21d: number;
  aiLabel: string;
  capital?: number;
  riskPerTrade: number;
  snaps: Record<string, Snapshot>;
  lot: AgentReport[];
  may: AgentReport[];
  rows: Analysis[];
  conflicted: Analysis[];
  clarifications: Record<string, string>;
  picks: Decision[];
  passed: Decision[];
  watchlist: Decision[];
}

export async function runDialogue(bus: MessageBus, llm: LLM, d: DialogueInput) {
  const note = (who: Person, task: string, data: unknown) =>
    llm.comment(`${who === "FinalDecision" ? "Final Decision" : who}, the ${ROLE[who]}`, task, data);
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
    (d.skipped.length ? ` · skipped: ${d.skipped.join(", ")}` : ""), { kind: "system" });

  const l3 = d.lot.slice(0, 3), m3 = d.may.slice(0, 3);
  const lead = d.lot[0];
  bus.send("Lotappi", "Mayavi",
    `Hi Mayavi, my short-term scan is done. Top three: ${list(l3.map((r) => `${r.symbol} (${r.score.toFixed(0)})`))}. ` +
    `${lead.symbol} stands out: ${[lead.reasons[0], lead.reasons[1]].filter(Boolean).map(lc).join(", ") || "it has the best momentum score"}. What does your monthly view say?`,
    { tickers: names(l3) });

  const overlap = d.rows.filter((r) => r.agree).slice(0, 3).map((r) => r.symbol);
  bus.send("Mayavi", "Lotappi",
    `My 1-month leaders are ${list(m3.map((r) => `${r.symbol} (${r.score.toFixed(0)})`))}. ` +
    (overlap.length
      ? `Good news: we both rate ${list(overlap)} above 60, so ${overlap.length === 1 ? "that one looks" : "those look"} solid on both time frames.`
      : `We don't agree on any stock yet. Your list is momentum, mine is trend.`),
    { tickers: [...names(m3), ...overlap] });

  const c = d.conflicted[0] ?? d.rows.find((r) => r.conflict);
  if (c) {
    const l = lotBy.get(c.symbol)!, m = mayBy.get(c.symbol)!;
    if (c.lotappi > c.mayavi) {
      bus.send("Mayavi", "Lotappi",
        `One thing: you give ${c.symbol} ${l.score.toFixed(0)}, but I only give it ${m.score.toFixed(0)}. ` +
        `${m.warnings[0] ?? "The monthly trend is weak"}. I'd treat it as a quick trade only.`, { tickers: [c.symbol] });
      bus.send("Lotappi", "Mayavi",
        `Fair point. For ${c.symbol} I'd keep it in and out, with a tight stop. Let's flag it to Mubashir.`, { tickers: [c.symbol] });
    } else {
      bus.send("Lotappi", "Mayavi",
        `${c.symbol} is ${m.score.toFixed(0)} on your list but only ${l.score.toFixed(0)} on mine. ` +
        `${l.warnings[0] ?? "Short-term momentum is flat"}. The timing looks off right now.`, { tickers: [c.symbol] });
      bus.send("Mayavi", "Lotappi",
        `True, ${c.symbol} is a trend hold, not a swing. Better to buy it on a dip. I'll flag it to Mubashir.`, { tickers: [c.symbol] });
    }
  } else {
    bus.send("Lotappi", "Mayavi", "No big disagreements between us today. Sending my report to Mubashir now.");
  }

  // ---------- Step 2: individual reports ----------
  bus.send("Lotappi", "Mubashir", "Mubashir, here is my short-term shortlist (1-10 trading days).", {
    kind: "report", table: reportTable(d.lot.slice(0, 5)), tickers: names(d.lot.slice(0, 5)),
    aiNote: await note("Lotappi", "In 3-4 short lines, explain your best short-term setups and the main risk, speaking to your colleague Mubashir.", d.lot.slice(0, 5)),
  });
  bus.send("Mayavi", "Mubashir", `And here is my 1-month list, Mubashir. Nifty 50 is ${pct(d.indexRet21d)} over the month, for comparison.`, {
    kind: "report", table: reportTable(d.may.slice(0, 5)), tickers: names(d.may.slice(0, 5)),
    aiNote: await note("Mayavi", "In 3-4 short lines, explain your best 1-month picks and the main risk, speaking to your colleague Mubashir.", d.may.slice(0, 5)),
  });

  // ---------- Step 3: follow-up research ----------
  bus.stage = "analyze";
  const top = d.rows[0];
  const ts = d.snaps[top.symbol], tm = mayBy.get(top.symbol)!;
  bus.send("Mubashir", "Lotappi", `Thanks, Lotappi. ${top.symbol} ranks highest after I combine both lists. Is the move still fresh, or are we late?`, { tickers: [top.symbol] });
  bus.send("Lotappi", "Mubashir",
    `RSI is ${ts.rsi.toFixed(0)}${ts.rsi > 70 ? ", so it's getting stretched" : ts.rsi < 45 ? ", so momentum is soft" : ", so there's still room"}. ` +
    `It moved ${pct(ts.ret5d)} in 5 days, and today's volume is ${ts.volRatio.toFixed(1)}x the 20-day average` +
    `${ts.volRatio >= 1.5 ? ", which confirms buyers are active." : ts.volRatio < 0.8 ? ", which is thin, so I wouldn't chase it." : ", which is normal."}`,
    { tickers: [top.symbol] });
  bus.send("Mubashir", "Mayavi", `Mayavi, does ${top.symbol} hold up over a month?`, { tickers: [top.symbol] });
  const above = (v: number) => (ts.close > v ? "above" : "below");
  const rs = ts.ret21d - d.indexRet21d;
  bus.send("Mayavi", "Mubashir",
    `It is ${pct(ts.ret21d)} over the month. Price is ${above(ts.sma20)} its 20-day and ${above(ts.sma50)} its 50-day average` +
    `${Number.isNaN(ts.sma200) ? "" : `, and ${above(ts.sma200)} the 200-day`}. Against the Nifty it is ${rs >= 0 ? "ahead" : "behind"} by ${Math.abs(rs).toFixed(1)}%. ` +
    `${tm.score >= 60 ? "I'm comfortable holding it for a month." : `My score is only ${tm.score.toFixed(0)}, so I'm not convinced for a month.`}`,
    { tickers: [top.symbol] });

  // ---------- Step 4: combined analysis ----------
  const agreeN = d.rows.filter((r) => r.agree).length;
  const highN = d.rows.filter((r) => r.risk === "HIGH").length;
  const top8 = d.rows.slice(0, 8);
  bus.send("Mubashir", "FinalDecision",
    `My combined analysis is ready. Lotappi and Mayavi both like ${plural(agreeN, "stock")}; ` +
    (highN ? `${plural(highN, "stock")} carry high risk and I've marked them down.` : "none carry high risk.") +
    " Top eight, with a trade scenario for each (target is twice the risk):", {
      kind: "report", tickers: names(top8),
      table: {
        columns: ["Symbol", "Combined", "Risk", "Holding plan", "Entry", "Stop-loss", "Target"],
        rows: top8.map((r) => [r.symbol, r.combined.toFixed(1), r.risk, r.horizon, inr(r.entry), inr(r.stopLoss), inr(r.target)]),
      },
      aiNote: await note("Mubashir", "In 4-5 short lines, tell Final Decision where the short-term and 1-month views agree or conflict, and which stocks look strongest after risk.", top8),
    });

  // ---------- Step 5: portfolio review ----------
  bus.stage = "debate";
  if (d.conflicted.length) {
    const syms = names(d.conflicted);
    bus.send("FinalDecision", "Mubashir", `Lotappi and Mayavi disagree on ${list(syms)}. Which view should I trust?`, { tickers: syms });
    bus.send("Mubashir", "FinalDecision", syms.map((s) => `${s}: ${d.clarifications[s]}`).join("\n\n"), { tickers: syms });
  } else if (d.picks[0]) {
    const p = d.picks[0];
    bus.send("FinalDecision", "Mubashir", `No open disagreements in the top group. Any red flags on ${p.symbol} before I commit?`, { tickers: [p.symbol] });
    bus.send("Mubashir", "FinalDecision",
      `Risk is ${p.risk.toLowerCase()} (ATR ${p.atrPct.toFixed(1)}% of price). The scenario: stop-loss ${inr(p.stopLoss)}, target ${inr(p.target)}. ` +
      `These are research levels, not guaranteed prices. A gap down can skip the stop.`, { tickers: [p.symbol] });
  }

  if (d.passed.length) {
    const syms = names(d.passed);
    bus.send("FinalDecision", "Mubashir",
      `On concentration: I'm leaving out ${list(d.passed.map((p) => `${p.symbol} (${p.sector})`))}. ` +
      `We already hold ${MAX_PER_SECTOR} from ${d.passed.length === 1 ? "that sector" : "those sectors"}, and I won't put more than that in one sector.`, { tickers: syms });
    bus.send("Mubashir", "FinalDecision", `Agreed. ${list(syms)} ${syms.length === 1 ? "goes" : "go"} on the watchlist instead.`, { tickers: syms });
  }
  if (d.capital && d.picks.length) {
    const invested = d.picks.reduce((s, p) => s + (p.investment ?? 0), 0);
    const zero = d.picks.filter((p) => !p.quantity);
    bus.send("FinalDecision", "Mubashir",
      `On capital: with ${inr(d.capital, 0)} and ${d.riskPerTrade}% risk per trade, the picks use ${inr(invested, 0)} ` +
      `(${((invested / d.capital) * 100).toFixed(0)}% of capital).` +
      (zero.length ? ` There isn't enough left to size ${list(names(zero))}, so ${zero.length === 1 ? "it stays" : "they stay"} at zero shares.` : ""),
      { tickers: names(zero) });
  }

  // ---------- Step 6: final announcement ----------
  bus.stage = "decide";
  bus.send("FinalDecision", "ALL",
    d.picks.length
      ? `Decision made. We go with ${list(names(d.picks))}.` +
        (d.watchlist.length ? ` Watchlist: ${list(names(d.watchlist))}.` : "") + " Lotappi, Mayavi, please confirm."
      : `Decision made: no stock passes our buy rules today, so we stay in cash.` +
        (d.watchlist.length ? ` Watchlist: ${list(names(d.watchlist))}.` : ""),
    {
      kind: "decision", tickers: [...names(d.picks), ...names(d.watchlist)],
      table: d.picks.length ? {
        columns: ["Symbol", "Verdict", "Entry", "Stop-loss", "Target"],
        rows: d.picks.map((p) => [p.symbol, p.verdict, inr(p.entry), inr(p.stopLoss), inr(p.target)]),
      } : undefined,
      aiNote: await note("FinalDecision", "In 4-6 short lines, tell the team why these picks and how to manage them (stop-loss, target). End with one sentence saying this is not financial advice.",
        { picks: d.picks.map(({ spark: _s, ...p }) => p), watchlist: names(d.watchlist) }),
    });

  if (d.picks.length) {
    const swing = d.picks.filter((p) => p.horizon.startsWith("Swing")).slice(0, 3);
    bus.send("Lotappi", "ALL",
      `Confirmed. I'll watch the short-term stop-losses daily${swing.length ? `, starting with ${list(names(swing))}` : ""}.`, { tickers: names(swing) });
    bus.send("Mayavi", "ALL", "Confirmed. I'll track the monthly trend and flag any breakdown early.");
  } else {
    bus.send("Lotappi", "ALL", "Understood. I'll rescan tomorrow.");
    bus.send("Mayavi", "ALL", "Agreed. No trend worth holding today.");
  }
}
