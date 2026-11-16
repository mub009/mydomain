/**
 * The team conversation. Each agent speaks like a colleague, one-to-one:
 *   Lotappi <-> Mayavi      compare notes first
 *   Lotappi, Mayavi -> Mubashir   send their reports, answer his questions
 *   Mubashir <-> Final Decision   analysis, conflicts, final call
 *   Final Decision -> team        announces the picks
 * Every number in the messages comes from the analysis; nothing is invented.
 */
import type { MessageBus } from "./bus";
import type { LLM } from "./llm";
import type { AgentName, AgentReport, Analysis, Decision, ReportRow } from "./types";

const ROLE: Record<Exclude<AgentName, "System">, string> = {
  Lotappi: "short-term (1-10 day) swing-trade scanner",
  Mayavi: "1-month positional trend scanner",
  Mubashir: "analyst who combines the short-term and 1-month reports and checks risk",
  FinalDecision: "final decision maker who picks the stocks to act on",
};

const inr = (n: number) => "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
const pct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
const names = (xs: { symbol: string }[]) => xs.map((x) => x.symbol);
const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
// lower-case the first letter, but keep acronyms like EMA9 / RSI / MACD intact
const lc = (s?: string) => (!s ? "" : /^[A-Z]{2}/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1));

export interface DialogueInput {
  mode: "live" | "demo";
  stockCount: number;
  skipped: string[];
  indexRet21d: number;
  aiLabel: string;
  lot: AgentReport[];
  may: AgentReport[];
  rows: Analysis[];
  conflicted: Analysis[];
  clarifications: Record<string, string>;
  picks: Decision[];
  watchlist: Decision[];
}

export async function runDialogue(bus: MessageBus, llm: LLM, d: DialogueInput) {
  const note = (who: Exclude<AgentName, "System">, task: string, data: unknown) =>
    llm.comment(`${who === "FinalDecision" ? "Final Decision" : who}, the ${ROLE[who]}`, task, data);
  const lotBy = new Map(d.lot.map((r) => [r.symbol, r]));
  const mayBy = new Map(d.may.map((r) => [r.symbol, r]));

  // 0. Kick-off
  bus.send("System", "ALL",
    `Market data loaded: ${d.stockCount} NSE stocks (${d.mode === "live" ? "live prices" : "demo prices, not real"}). ` +
    `Nifty 50 over 1 month: ${pct(d.indexRet21d)}. AI commentary: ${d.aiLabel}.` +
    (d.skipped.length ? ` Skipped: ${d.skipped.join(", ")}.` : ""), { kind: "system" });

  // 1. Lotappi and Mayavi compare notes
  const l3 = d.lot.slice(0, 3), m3 = d.may.slice(0, 3);
  const lead = d.lot[0];
  bus.send("Lotappi", "Mayavi",
    `Hi Mayavi, my short-term scan is done. Top three: ${list(l3.map((r) => `${r.symbol} (${r.score.toFixed(0)})`))}. ` +
    `${lead.symbol} stands out: ${lc(lead.reasons[0])}${lead.reasons[1] ? `, ${lc(lead.reasons[1])}` : ""}. What does your monthly view say?`,
    { tickers: names(l3) });

  const overlap = d.rows.filter((r) => r.agree).slice(0, 3).map((r) => r.symbol);
  bus.send("Mayavi", "Lotappi",
    `My 1-month leaders are ${list(m3.map((r) => `${r.symbol} (${r.score.toFixed(0)})`))}. ` +
    (overlap.length
      ? `Good news: we both rate ${list(overlap)} above 60, so those look solid on both time frames.`
      : `We don't agree on any stock yet. Your list is momentum, mine is trend.`),
    { tickers: [...names(m3), ...overlap] });

  const c = d.conflicted[0];
  if (c) {
    const l = lotBy.get(c.symbol)!, m = mayBy.get(c.symbol)!;
    if (c.lotappi > c.mayavi) {
      bus.send("Mayavi", "Lotappi",
        `One thing: you give ${c.symbol} ${l.score.toFixed(0)}, but I only give it ${m.score.toFixed(0)}. ` +
        `${m.warnings[0] ?? "The monthly trend is weak"}. I'd treat it as a quick trade only.`, { tickers: [c.symbol] });
      bus.send("Lotappi", "Mayavi",
        `Fair point. For ${c.symbol} I'll keep it in and out, with a tight stop. Let's flag it to Mubashir.`, { tickers: [c.symbol] });
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

  // 2. Reports to Mubashir
  const lotRows: ReportRow[] = d.lot.slice(0, 5).map((r) => ({ symbol: r.symbol, score: r.score, tag: r.signal, note: r.reasons[0] ?? "" }));
  bus.send("Lotappi", "Mubashir", "Mubashir, here is my short-term shortlist (1-10 day trades).", {
    kind: "report", rows: lotRows, tickers: names(lotRows),
    aiNote: await note("Lotappi", "In 3-4 short lines, explain your best short-term setups and the main risk, speaking to your colleague Mubashir.", d.lot.slice(0, 5)),
  });
  const mayRows: ReportRow[] = d.may.slice(0, 5).map((r) => ({ symbol: r.symbol, score: r.score, tag: r.signal, note: r.reasons[0] ?? "" }));
  bus.send("Mayavi", "Mubashir", "And here is my 1-month list, Mubashir. All of these are beating or holding with the Nifty trend.", {
    kind: "report", rows: mayRows, tickers: names(mayRows),
    aiNote: await note("Mayavi", "In 3-4 short lines, explain your best 1-month picks and the main risk, speaking to your colleague Mubashir.", d.may.slice(0, 5)),
  });

  // 3. Mubashir questions both scanners about the strongest combined stock
  const top = d.rows[0];
  const tl = lotBy.get(top.symbol)!, tm = mayBy.get(top.symbol)!;
  bus.send("Mubashir", "Lotappi", `Thanks, Lotappi. ${top.symbol} is on top after combining. Is the move still fresh, or are we late?`, { tickers: [top.symbol] });
  bus.send("Lotappi", "Mubashir",
    top.rsi > 70
      ? `RSI is ${top.rsi.toFixed(0)}, so it's getting stretched. I'd only enter ${top.symbol} on a small dip. It moved ${pct(top.ret5d)} in 5 days.`
      : `RSI is ${top.rsi.toFixed(0)}, so there's still room to run. It moved ${pct(top.ret5d)} in 5 days${tl.reasons[0] ? `, and ${lc(tl.reasons[0])}` : ""}.`,
    { tickers: [top.symbol] });
  bus.send("Mubashir", "Mayavi", `Mayavi, does ${top.symbol} hold up over a month?`, { tickers: [top.symbol] });
  bus.send("Mayavi", "Mubashir",
    tm.score >= 60
      ? `Yes. It's ${pct(top.ret21d)} over the month. ${tm.reasons.slice(0, 2).join(", ")}.`
      : `Not convincingly. It's ${pct(top.ret21d)} over the month and my score is only ${tm.score.toFixed(0)}. ${tm.warnings[0] ?? ""}`.trim(),
    { tickers: [top.symbol] });

  // 4. Mubashir -> Final Decision
  const agreeN = d.rows.filter((r) => r.agree).length;
  const highN = d.rows.filter((r) => r.risk === "HIGH").length;
  const mubRows: ReportRow[] = d.rows.slice(0, 8).map((r) => ({
    symbol: r.symbol, score: r.combined, tag: `${r.risk} risk`, note: r.horizon,
  }));
  bus.send("Mubashir", "FinalDecision",
    `My combined analysis is ready. Lotappi and Mayavi both like ${agreeN} stock${agreeN === 1 ? "" : "s"}; ` +
    (highN ? `${highN} carry high risk and I've marked them down.` : "none of them carry high risk.") + " Here are the top combined scores:", {
      kind: "report", rows: mubRows, tickers: names(mubRows),
      aiNote: await note("Mubashir", "In 4-5 short lines, tell Final Decision where the short-term and 1-month views agree or conflict, and which stocks look strongest after risk.", d.rows.slice(0, 8)),
    });

  // 5. Final Decision asks about conflicts, or about the top pick's risk
  if (d.conflicted.length) {
    const syms = names(d.conflicted);
    bus.send("FinalDecision", "Mubashir", `Lotappi and Mayavi disagree on ${list(syms)}. Which view should I trust?`, { tickers: syms });
    bus.send("Mubashir", "FinalDecision",
      syms.map((s) => `${s}: ${d.clarifications[s]}`).join("\n"), { tickers: syms });
  } else if (d.picks[0]) {
    const p = d.picks[0];
    bus.send("FinalDecision", "Mubashir", `Any red flags on ${p.symbol} before I commit?`, { tickers: [p.symbol] });
    bus.send("Mubashir", "FinalDecision",
      `Risk is ${p.risk.toLowerCase()}. Keep the stop-loss at ${inr(p.stopLoss)}; the target is ${inr(p.target)}, twice the risk.`, { tickers: [p.symbol] });
  }

  // 6. The decision, to the whole team
  const pickRows: ReportRow[] = d.picks.map((p) => ({
    symbol: p.symbol, score: p.combined, tag: p.verdict,
    note: `Entry ${inr(p.entry)} · SL ${inr(p.stopLoss)} · Target ${inr(p.target)}`,
  }));
  bus.send("FinalDecision", "ALL",
    d.picks.length
      ? `Decision made, team. We go with ${d.picks.length} stock${d.picks.length === 1 ? "" : "s"}: ${list(names(d.picks))}.` +
        (d.watchlist.length ? ` Watchlist: ${list(names(d.watchlist))}.` : "")
      : `No stock passes our buy rules today, so we stay in cash.` +
        (d.watchlist.length ? ` Watchlist: ${list(names(d.watchlist))}.` : ""),
    {
      kind: "decision", rows: pickRows, tickers: [...names(d.picks), ...names(d.watchlist)],
      aiNote: await note("FinalDecision", "In 4-6 short lines, tell the team why these picks and how to manage them (stop-loss, target). End with one sentence saying this is not financial advice.",
        { picks: d.picks.map(({ spark: _s, ...p }) => p), watchlist: names(d.watchlist) }),
    });

  if (d.picks.length) {
    bus.send("Lotappi", "ALL", "On it. I'll watch the short-term stop-losses every day.");
    bus.send("Mayavi", "ALL", "I'll track the monthly trend and flag any breakdown early.");
  }
}
