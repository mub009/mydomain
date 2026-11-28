/** Server-side orchestration: load market data, run the four agents, then
 *  stream their conversation and the result. */
import { DecisionAgent, MIN_PROFIT_PCT } from "./agents/decision";
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
import { loadPolicy, policyEffect, type PolicyReport } from "./policy";
import { globalCues, worldQuotes } from "./world";
import { nseMarketMood, nseMcpEnabled } from "./nse-mcp/client";
import { holdPlan, type HoldPlan } from "./forecast";
import { longTermView } from "./long-term";
import { addTradingDays } from "./market/calendar";
import type { Bar, QuickScanSummary, RunRequest, RunResult, StreamEvent } from "./types";
import { BIG_UNIVERSES, loadStockList } from "./market/lists";
import { quickScan } from "./market/prescreen";
import { ALL_CAPS } from "./market/universe";
import { bottomSetup, LONG_SWING_DAYS, type BottomSetup } from "./bottom";

export async function runAnalysis(o: RunRequest, emit: (e: StreamEvent) => void): Promise<RunResult> {
  const started = Date.now();
  const bus = new MessageBus((message) => emit({ type: "message", message }));
  const llm = new LLM(o.aiNotes);
  registerSectors(o.sectors);
  // Big lists (Nifty 500, all NSE): quick-scan every stock, then research the best 150 in full.
  let scan: QuickScanSummary | undefined;
  if (o.universe) ({ o, scan } = await narrowDown(o, emit));

  emit({ type: "progress", text: "Loading prices…" });
  // Time guard (Vercel stops a run at 5 minutes): prices by 140 s, fundamentals by 190 s, leaving time for the rest.
  const { frames, indexClose, vixClose, sectorIndex, source, skipped } = await loadMarket(o.symbols, o.demo,
    (d, t) => emit({ type: "progress", text: `Loading prices ${d}/${t}` }), started + 140_000);
  // Research Agent's size filter: leave out companies below the minimum market cap (default ₹300 Cr).
  emit({ type: "progress", text: "Checking market cap and EPS…" });
  const funds = await loadFundamentals(Object.fromEntries(Object.entries(frames).map(([k, v]) => [k, v[v.length - 1].close])), source.kind === "demo", source.seed, started + 190_000);
  const { min: minCapCr } = capThresholds();
  const excluded = Object.entries(funds).filter(([, f]) => f.cap === "Too small").map(([symbol, f]) => ({ symbol, marketCapCr: f.marketCapCr ?? 0 }));
  for (const e of excluded) delete frames[e.symbol];
  if (Object.keys(frames).length < 3) throw new Error(`Fewer than 3 stocks are above ₹${minCapCr} Cr market cap. Add more stocks to the list.`);
  const snaps = Object.fromEntries(Object.entries(frames).map(([k, v]) => [k, snapshot(v)]));
  const sparks = Object.fromEntries(Object.entries(frames).map(([k, v]) => [k, v.slice(-60).map((b) => Math.round(b.close * 100) / 100)]));
  const indexRet21d = indexClose.length > 21 ? pctReturn(indexClose, 21) : 0;
  // Long swing check: stocks turning up from a bottom (they score low on momentum, so they get their own list).
  const bottoms: Record<string, BottomSetup> = {};
  for (const [k, v] of Object.entries(frames)) { const b = bottomSetup(v); if (b) bottoms[k] = b; }
  const bottomTop = Object.entries(bottoms).filter(([, b]) => b.isSetup).sort((a, b) => b[1].score - a[1].score)
    .slice(0, Math.max(10, o.top)).map(([k]) => k);

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
  const [macroData, policy] = await Promise.all([
    loadMacro(source.kind === "demo", source.seed),
    // Central Bank Agent: RBI and Fed policy from their own websites.
    loadPolicy(source.kind === "demo").catch(() => null),
  ]);
  const macro = macroData ? analyseMacro(frames, macroData.series, macroData.sample) : null;
  const first = applyPolicy(policy, applySectors(mubashir.applyFundamentals(applyMacro(mubashir.analyse(lot, may, snaps), macro), funds), sectors));
  const focus = (o.focus ?? []).filter((s) => frames[s]);
  const candidates = [...new Set([...focus, ...first.slice(0, Math.max(12, o.top * 2)).map((r) => r.symbol), ...bottomTop])];
  // Research desk: Performance, Valuation and Growth Agents check the candidates for Research Agent.
  emit({ type: "progress", text: "Research desk: performance, valuation, growth, profitability, red flags…" });
  const desk = await runResearchDesk(candidates, { frames, funds, source, indexClose, sectorOf });
  const withDesk = mubashir.applyDesk(first, desk);
  // Black Points Analyst: downside risks for every stock that passed the Momentum or Trend scan.
  emit({ type: "progress", text: "Black Points Analyst: checking filings, regulator orders and financial health…" });
  const bp = await runBlackPoints(withDesk, { demo: source.kind === "demo", seed: source.seed ?? 0, frames, sectorOf, sectors, focus: [...focus, ...bottomTop], policy });
  const checked = withDesk.map((r) => (bp.reports[r.symbol] ? { ...r, blackPoints: bp.reports[r.symbol] } : r));
  // Chart check: the original candidates plus the top stocks still eligible for a holding period,
  // so stocks held out by the Black Points Analyst don't crowd out the ones that can be picked.
  const eligible = checked.filter((r) => !r.blackPoints || Object.values(r.blackPoints.status).includes("Eligible"));
  const chartSyms = [...new Set([...candidates, ...eligible.slice(0, Math.max(12, o.top * 2)).map((r) => r.symbol)])]; // includes the long swing candidates
  emit({ type: "progress", text: "Checking charts…" });
  const intraday = await loadIntraday(chartSyms, source, frames);
  const charts = Object.fromEntries(chartSyms.map((s) => [s, analyseChart(frames[s], intraday[s]?.m30 ?? null, intraday[s]?.h1 ?? null)]));
  const rows = mubashir.applyEntry(mubashir.applyCharts(checked, charts)).map((r) => (bottoms[r.symbol] ? { ...r, bottom: bottoms[r.symbol] } : r));
  // Macro Agent's global cues: the main world indices (live runs only).
  const cues = source.kind !== "demo" ? await worldQuotes().then(globalCues).catch(() => null) : null;
  const fd = new DecisionAgent(o.minProfitPct ?? MIN_PROFIT_PCT);
  const conflicted = fd.conflicted(rows, o.top);
  const clarifications = Object.fromEntries(conflicted.map((r) => [r.symbol, mubashir.adviseOnConflict(r)]));
  const decided = fd.decide(rows, sparks, o.top, clarifications, o.capital, o.riskPerTrade);
  // Decision Agent's holding plan for every stock: how long to hold, by when, the odds and the expected return.
  emit({ type: "progress", text: "Decision Agent: working out how long to hold…" });
  const plans = Object.fromEntries(decided.all.map((d) => [d.symbol, planHold(d, frames[d.symbol], source.seed)]));
  // ... and the long-term view (1-3 years) wherever the research desk has the fundamentals.
  const longs = Object.fromEntries(decided.all.map((d) => [d.symbol, longTermView(d)]));
  const withHold = <T extends { symbol: string }>(xs: T[]) => xs.map((d) => ({ ...d, ...(plans[d.symbol] ? { hold: plans[d.symbol] } : {}), ...(longs[d.symbol] ? { longTerm: longs[d.symbol] } : {}) }));
  const { all, picks, watchlist, passed } = { ...decided, all: withHold(decided.all), picks: withHold(decided.picks), watchlist: withHold(decided.watchlist) };
  // Long swing picks have their own entry, stop and target, so their own holding plan (up to ~3 months).
  const longSwing = fd.longSwing(decided.all, o.top, o.capital, o.riskPerTrade).map((d) => {
    const plan = planHold(d, frames[d.symbol], source.seed);
    return { ...d, ...(plan ? { hold: plan } : {}), ...(longs[d.symbol] ? { longTerm: longs[d.symbol] } : {}) };
  });

  const sectorViews = enrichSectors(sectors, all);

  await runDialogue(bus, llm, {
    source, stockCount: rows.length, skipped, indexRet21d, scan,
    aiLabel: llm.enabled ? `on (${aiModel()})` : "off",
    capital: o.capital, riskPerTrade: o.riskPerTrade,
    macro, sectors: sectorViews, excluded, minCapCr, news, vix, positive: morning.positive(news), negative: morning.negative(news),
    snaps, lot, may, rows, conflicted, clarifications, picks, passed, watchlist, all, longSwing, minProfitPct: fd.minProfitPct, bpCoverage: bp.summary.coverage, globalCues: cues, policy,
  });

  const result: RunResult = {
    source, generatedAt: new Date().toISOString(), simulatedAgents: !llm.enabled,
    capital: o.capital, riskPerTrade: o.riskPerTrade,
    indexRet21d: Math.round(indexRet21d * 100) / 100, news, vix, blackPoints: bp.summary, policy, excluded, minCapCr, ...(scan ? { scan } : {}), longSwing, minProfitPct: fd.minProfitPct, sectors: sectorViews, macro, picks, watchlist, all, skipped,
  };
  emit({ type: "result", result });
  console.log(`[nse-agent-desk] run: ${rows.length} stocks, source=${source.kind}${source.seed !== undefined ? `#${source.seed}` : ""}, ` +
    `picks=${picks.map((p) => p.symbol).join(",") || "none"}, messages=${bus.log.length}, ai=${llm.enabled}, ${Date.now() - started}ms`);
  return result;
}

/** Full research on a big list: 150 by default, or 250 / 400 (see RESEARCH_CHOICES). */
export const SHORTLIST = 150;
export const RESEARCH_CHOICES = [150, 250, 400] as const;

async function narrowDown(o: RunRequest, emit: (e: StreamEvent) => void): Promise<{ o: RunRequest; scan: QuickScanSummary }> {
  const id = o.universe!;
  const label = BIG_UNIVERSES[id].label;
  if (o.demo) {
    return { o: { ...o, symbols: ALL_CAPS }, scan: { label, total: ALL_CAPS.length, priced: ALL_CAPS.length, thin: 0, shortlisted: ALL_CAPS.length, from: "demo", note: `Demo data uses the built-in ${ALL_CAPS.length} stocks.` } };
  }
  emit({ type: "progress", text: `Downloading the ${label} list from NSE…` });
  const list = await loadStockList(id);
  registerSectors(list.sectors);
  const keep = o.research ?? SHORTLIST;
  if (list.symbols.length <= keep) {
    return { o: { ...o, symbols: list.symbols }, scan: { label, total: list.symbols.length, priced: list.symbols.length, thin: 0, shortlisted: list.symbols.length, from: list.from, note: list.note } };
  }
  const q = await quickScan(list.symbols, keep, (d, t) => emit({ type: "progress", text: `Quick scan of ${label}: ${d.toLocaleString("en-IN")}/${t.toLocaleString("en-IN")} stocks` }));
  if (q.shortlist.length < 3) throw new Error(`The quick scan couldn't get prices for the ${label} list. Try again in a minute, or pick a smaller list.`);
  const symbols = [...new Set([...(o.focus ?? []), ...q.shortlist.map((r) => r.symbol)])];
  return {
    o: { ...o, symbols },
    scan: { label, total: q.total, priced: q.priced, thin: q.thin, shortlisted: q.shortlist.length, bottoms: q.bottoms, from: list.from, note: list.note },
  };
}

/** Short swings are held up to 10 trading days, long swings up to ~3 months, positional (or swing-then-hold) up to 21. */
export const holdDays = (horizon: string) => (horizon.startsWith("Swing ·") ? 10 : horizon.startsWith("Long swing") ? LONG_SWING_DAYS : 21);

function planHold(d: { symbol: string; entry: number; stopLoss: number; target: number; horizon: string }, bars: Bar[] | undefined, seed?: number): HoldPlan | undefined {
  if (!bars || bars.length < 60 || !(d.stopLoss < d.entry && d.entry < d.target)) return undefined;
  const plan = holdPlan(bars, { entry: d.entry, stop: d.stopLoss, target: d.target, maxDays: holdDays(d.horizon), seed: `${d.symbol}:${seed ?? "live"}:hold` });
  const from = bars[bars.length - 1].date.slice(0, 10);
  return { ...plan, exitBy: addTradingDays(from, plan.maxDays), expectedBy: plan.expectedDays ? addTradingDays(from, plan.expectedDays) : undefined };
}

/** Central Bank Agent: move rate-sensitive sectors by the RBI's direction (+/-2). */
function applyPolicy<T extends { sector: string; combined: number; notes: string[] }>(p: PolicyReport | null, rows: T[]): T[] {
  return rows.map((r) => {
    const e = policyEffect(p, r.sector);
    if (!e) return r;
    return { ...r, policy: e, combined: Math.max(0, Math.min(100, Math.round((r.combined + e.points) * 10) / 10)), notes: [...r.notes, `Policy: ${e.effect.toLowerCase()}${e.points ? ` (${e.points > 0 ? "+" : ""}${e.points})` : ""}, ${e.reason}`] };
  }).sort((a, b) => b.combined - a.combined);
}
