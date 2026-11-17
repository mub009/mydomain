/** Server-side orchestration: load market data, run the four agents, then
 *  stream their conversation and the result. */
import { FinalDecision } from "./agents/finalDecision";
import { IVIndex } from "./agents/ivIndex";
import { MorningSession } from "./agents/morningSession";
import { Lotappi } from "./agents/lotappi";
import { Mayavi } from "./agents/mayavi";
import { Mubashir } from "./agents/mubashir";
import { MessageBus } from "./bus";
import { runDialogue } from "./dialogue";
import { pctReturn, snapshot } from "./indicators";
import { aiModel, LLM } from "./llm";
import { analyseChart } from "./chart";
import { loadIntraday, loadMarket } from "./market";
import { loadNews } from "./news";
import type { RunRequest, RunResult, StreamEvent } from "./types";

export async function runAnalysis(o: RunRequest, emit: (e: StreamEvent) => void): Promise<RunResult> {
  const started = Date.now();
  const bus = new MessageBus((message) => emit({ type: "message", message }));
  const llm = new LLM(o.aiNotes);

  emit({ type: "progress", text: "Loading prices…" });
  const { frames, indexClose, vixClose, source, skipped } = await loadMarket(o.symbols, o.demo,
    (d, t) => emit({ type: "progress", text: `Loading prices ${d}/${t}` }));
  const snaps = Object.fromEntries(Object.entries(frames).map(([k, v]) => [k, snapshot(v)]));
  const sparks = Object.fromEntries(Object.entries(frames).map(([k, v]) => [k, v.slice(-60).map((b) => Math.round(b.close * 100) / 100)]));
  const indexRet21d = indexClose.length > 21 ? pctReturn(indexClose, 21) : 0;

  emit({ type: "progress", text: "Agents are analysing…" });
  // Morning Session collects the news; positive stories boost Lotappi's and Mayavi's scores.
  emit({ type: "progress", text: "Collecting news…" });
  const news = await loadNews(Object.keys(snaps), source.kind === "demo", snaps, source.seed);
  const morning = new MorningSession();
  const vix = new IVIndex().analyse(vixClose, indexClose, frames, snaps, news, source.kind === "demo");
  const lot = morning.apply(new Lotappi().scan(snaps), news);
  const may = morning.apply(new Mayavi().scan(snaps, indexRet21d), news);
  const mubashir = new Mubashir();
  // Mubashir checks the charts of the leading candidates on 1M / 1D / 4H / 1H / 30m
  // and finds each one's best buy area from 1M, 3M, 6M and 1Y history.
  const first = mubashir.analyse(lot, may, snaps);
  const candidates = first.slice(0, Math.max(12, o.top * 2)).map((r) => r.symbol);
  emit({ type: "progress", text: "Checking charts…" });
  const intraday = await loadIntraday(candidates, source, frames);
  const charts = Object.fromEntries(candidates.map((s) => [s, analyseChart(frames[s], intraday[s]?.m30 ?? null, intraday[s]?.h1 ?? null)]));
  const rows = mubashir.applyCharts(first, charts);
  const fd = new FinalDecision();
  const conflicted = fd.conflicted(rows, o.top);
  const clarifications = Object.fromEntries(conflicted.map((r) => [r.symbol, mubashir.adviseOnConflict(r)]));
  const { all, picks, watchlist, passed } = fd.decide(rows, sparks, o.top, clarifications, o.capital, o.riskPerTrade);

  await runDialogue(bus, llm, {
    source, stockCount: rows.length, skipped, indexRet21d,
    aiLabel: llm.enabled ? `on (${aiModel()})` : "off",
    capital: o.capital, riskPerTrade: o.riskPerTrade,
    news, vix, positive: morning.positive(news), negative: morning.negative(news),
    snaps, lot, may, rows, conflicted, clarifications, picks, passed, watchlist,
  });

  const result: RunResult = {
    source, generatedAt: new Date().toISOString(), simulatedAgents: !llm.enabled,
    capital: o.capital, riskPerTrade: o.riskPerTrade,
    indexRet21d: Math.round(indexRet21d * 100) / 100, news, vix, picks, watchlist, all, skipped,
  };
  emit({ type: "result", result });
  console.log(`[nse-agent-desk] run: ${rows.length} stocks, source=${source.kind}${source.seed !== undefined ? `#${source.seed}` : ""}, ` +
    `picks=${picks.map((p) => p.symbol).join(",") || "none"}, messages=${bus.log.length}, ai=${llm.enabled}, ${Date.now() - started}ms`);
  return result;
}
