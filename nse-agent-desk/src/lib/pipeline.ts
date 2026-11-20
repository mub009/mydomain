/** Server-side orchestration: load market data, run the four agents, then
 *  stream their conversation and the result. */
import { DecisionAgent } from "./agents/decision";
import { VolatilityAgent } from "./agents/volatility";
import { NewsAgent } from "./agents/news";
import { MomentumAgent } from "./agents/momentum";
import { TrendAgent } from "./agents/trend";
import { ResearchAgent } from "./agents/research";
import { MessageBus } from "./bus";
import { runDialogue } from "./dialogue";
import { pctReturn, snapshot } from "./indicators";
import { aiModel, LLM } from "./llm";
import { analyseChart } from "./chart";
import { loadIntraday, loadMarket } from "./market";
import { capThresholds, loadFundamentals } from "./fundamentals";
import { loadNews } from "./news";
import { analyseSectors, applySectors, enrichSectors } from "./sectors";
import { analyseMacro, applyMacro, loadMacro } from "./macro";
import { registerSectors, sectorOf } from "./market/universe";
import { runResearchDesk } from "./research-desk";
import { runBlackPoints } from "./black-points";
import { nseMarketMood, nseMcpEnabled } from "./nse-mcp/client";
import type { RunRequest, RunResult, StreamEvent } from "./types";

export async function runAnalysis(o: RunRequest, emit: (e: StreamEvent) => void): Promise<RunResult> {
  const started = Date.now();
  const bus = new MessageBus((message) => emit({ type: "message", message }));
  const llm = new LLM(o.aiNotes);
  registerSectors(o.sectors);

  emit({ type: "progress", text: "Loading prices…" });
  const { frames, indexClose, vixClose, sectorIndex, source, skipped } = await loadMarket(o.symbols, o.demo,
    (d, t) => emit({ type: "progress", text: `Loading prices ${d}/${t}` }));
  // Research Agent's size filter: leave out companies below the minimum market cap (default ₹300 Cr).
  emit({ type: "progress", text: "Checking market cap and EPS…" });
  const funds = await loadFundamentals(Object.fromEntries(Object.entries(frames).map(([k, v]) => [k, v[v.length - 1].close])), source.kind === "demo", source.seed);
  const { min: minCapCr } = capThresholds();
  const excluded = Object.entries(funds).filter(([, f]) => f.cap === "Too small").map(([symbol, f]) => ({ symbol, marketCapCr: f.marketCapCr ?? 0 }));
  for (const e of excluded) delete frames[e.symbol];
  if (Object.keys(frames).length < 3) throw new Error(`Fewer than 3 stocks are above ₹${minCapCr} Cr market cap. Add more stocks to the list.`);
  const snaps = Object.fromEntries(Object.entries(frames).map(([k, v]) => [k, snapshot(v)]));
  const sparks = Object.fromEntries(Object.entries(frames).map(([k, v]) => [k, v.slice(-60).map((b) => Math.round(b.close * 100) / 100)]));
  const indexRet21d = indexClose.length > 21 ? pctReturn(indexClose, 21) : 0;

  emit({ type: "progress", text: "Agents are analysing…" });
  // News Agent collects the news; positive stories boost Momentum Agent's and Trend Agent's scores.
  emit({ type: "progress", text: "Collecting news…" });
  const news = await loadNews(Object.keys(snaps), source.kind === "demo", snaps, source.seed);
  const morning = new NewsAgent();
  // NSE's market mood (breadth, VIX range) from the NSE MCP server, live runs only.
  const mood = source.kind !== "demo" && nseMcpEnabled() ? await nseMarketMood().catch(() => null) : null;
  const vix = new VolatilityAgent().analyse(vixClose, indexClose, frames, snaps, news, source.kind === "demo", mood);
  const lot = morning.apply(new MomentumAgent().scan(snaps), news);
  const may = morning.apply(new TrendAgent().scan(snaps, indexRet21d), news);
  const mubashir = new ResearchAgent();
  // Research Agent checks the charts of the leading candidates on 1M / 1D / 4H / 1H / 30m
  // and finds each one's best buy area from 1M, 3M, 6M and 1Y history.
  // Research Agent's sector check: each sector against the Nifty; leading sectors lift their stocks.
  const sectors = analyseSectors(frames, snaps, sectorOf, indexClose, sectorIndex);
  // Macro Agent: gold, crude and USD/INR, and the stocks that depend on them — before Research Agent's analysis.
  emit({ type: "progress", text: "Reading gold, crude and USD/INR…" });
  const macroData = await loadMacro(source.kind === "demo", source.seed);
  const macro = macroData ? analyseMacro(frames, macroData.series, macroData.sample) : null;
  const first = applySectors(mubashir.applyFundamentals(applyMacro(mubashir.analyse(lot, may, snaps), macro), funds), sectors);
  const focus = (o.focus ?? []).filter((s) => frames[s]);
  const candidates = [...new Set([...focus, ...first.slice(0, Math.max(12, o.top * 2)).map((r) => r.symbol)])];
  // Research desk: Performance, Valuation and Growth Agents check the candidates for Research Agent.
  emit({ type: "progress", text: "Research desk: performance, valuation, growth, profitability, red flags…" });
  const desk = await runResearchDesk(candidates, { frames, funds, source, indexClose, sectorOf });
  const withDesk = mubashir.applyDesk(first, desk);
  // Black Points Analyst: downside risks for every stock that passed the Momentum or Trend scan.
  emit({ type: "progress", text: "Black Points Analyst: checking filings, regulator orders and financial health…" });
  const bp = await runBlackPoints(withDesk, { demo: source.kind === "demo", seed: source.seed ?? 0, frames, sectorOf, sectors, focus });
  const checked = withDesk.map((r) => (bp.reports[r.symbol] ? { ...r, blackPoints: bp.reports[r.symbol] } : r));
  // Chart check: the original candidates plus the top stocks still eligible for a holding period,
  // so stocks held out by the Black Points Analyst don't crowd out the ones that can be picked.
  const eligible = checked.filter((r) => !r.blackPoints || Object.values(r.blackPoints.status).includes("Eligible"));
  const chartSyms = [...new Set([...candidates, ...eligible.slice(0, Math.max(12, o.top * 2)).map((r) => r.symbol)])];
  emit({ type: "progress", text: "Checking charts…" });
  const intraday = await loadIntraday(chartSyms, source, frames);
  const charts = Object.fromEntries(chartSyms.map((s) => [s, analyseChart(frames[s], intraday[s]?.m30 ?? null, intraday[s]?.h1 ?? null)]));
  const rows = mubashir.applyEntry(mubashir.applyCharts(checked, charts));
  const fd = new DecisionAgent();
  const conflicted = fd.conflicted(rows, o.top);
  const clarifications = Object.fromEntries(conflicted.map((r) => [r.symbol, mubashir.adviseOnConflict(r)]));
  const { all, picks, watchlist, passed } = fd.decide(rows, sparks, o.top, clarifications, o.capital, o.riskPerTrade);

  const sectorViews = enrichSectors(sectors, all);

  await runDialogue(bus, llm, {
    source, stockCount: rows.length, skipped, indexRet21d,
    aiLabel: llm.enabled ? `on (${aiModel()})` : "off",
    capital: o.capital, riskPerTrade: o.riskPerTrade,
    macro, sectors: sectorViews, excluded, minCapCr, news, vix, positive: morning.positive(news), negative: morning.negative(news),
    snaps, lot, may, rows, conflicted, clarifications, picks, passed, watchlist, all, bpCoverage: bp.summary.coverage,
  });

  const result: RunResult = {
    source, generatedAt: new Date().toISOString(), simulatedAgents: !llm.enabled,
    capital: o.capital, riskPerTrade: o.riskPerTrade,
    indexRet21d: Math.round(indexRet21d * 100) / 100, news, vix, blackPoints: bp.summary, excluded, minCapCr, sectors: sectorViews, macro, picks, watchlist, all, skipped,
  };
  emit({ type: "result", result });
  console.log(`[nse-agent-desk] run: ${rows.length} stocks, source=${source.kind}${source.seed !== undefined ? `#${source.seed}` : ""}, ` +
    `picks=${picks.map((p) => p.symbol).join(",") || "none"}, messages=${bus.log.length}, ai=${llm.enabled}, ${Date.now() - started}ms`);
  return result;
}
