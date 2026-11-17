/** Server-side orchestration: load market data, run the four agents, then
 *  stream their conversation and the result. */
import { FinalDecision } from "./agents/finalDecision";
import { Lotappi } from "./agents/lotappi";
import { Mayavi } from "./agents/mayavi";
import { Mubashir } from "./agents/mubashir";
import { MessageBus } from "./bus";
import { runDialogue } from "./dialogue";
import { pctReturn, snapshot } from "./indicators";
import { aiModel, LLM } from "./llm";
import { loadMarket } from "./market";
import type { RunRequest, RunResult, StreamEvent } from "./types";

export async function runAnalysis(o: RunRequest, emit: (e: StreamEvent) => void): Promise<RunResult> {
  const started = Date.now();
  const bus = new MessageBus((message) => emit({ type: "message", message }));
  const llm = new LLM(o.aiNotes);

  emit({ type: "progress", text: "Loading prices…" });
  const { frames, indexClose, source, skipped } = await loadMarket(o.symbols, o.demo,
    (d, t) => emit({ type: "progress", text: `Loading prices ${d}/${t}` }));
  const snaps = Object.fromEntries(Object.entries(frames).map(([k, v]) => [k, snapshot(v)]));
  const sparks = Object.fromEntries(Object.entries(frames).map(([k, v]) => [k, v.slice(-60).map((b) => Math.round(b.close * 100) / 100)]));
  const indexRet21d = indexClose.length > 21 ? pctReturn(indexClose, 21) : 0;

  emit({ type: "progress", text: "Agents are analysing…" });
  const lot = new Lotappi().scan(snaps);
  const may = new Mayavi().scan(snaps, indexRet21d);
  const mubashir = new Mubashir();
  const rows = mubashir.analyse(lot, may, snaps);
  const fd = new FinalDecision();
  const conflicted = fd.conflicted(rows, o.top);
  const clarifications = Object.fromEntries(conflicted.map((r) => [r.symbol, mubashir.adviseOnConflict(r)]));
  const { all, picks, watchlist, passed } = fd.decide(rows, sparks, o.top, clarifications, o.capital, o.riskPerTrade);

  await runDialogue(bus, llm, {
    source, stockCount: rows.length, skipped, indexRet21d,
    aiLabel: llm.enabled ? `on (${aiModel()})` : "off",
    capital: o.capital, riskPerTrade: o.riskPerTrade,
    snaps, lot, may, rows, conflicted, clarifications, picks, passed, watchlist,
  });

  const result: RunResult = {
    source, generatedAt: new Date().toISOString(), simulatedAgents: !llm.enabled,
    capital: o.capital, riskPerTrade: o.riskPerTrade,
    indexRet21d: Math.round(indexRet21d * 100) / 100, picks, watchlist, all, skipped,
  };
  emit({ type: "result", result });
  console.log(`[nse-agent-desk] run: ${rows.length} stocks, source=${source.kind}${source.seed !== undefined ? `#${source.seed}` : ""}, ` +
    `picks=${picks.map((p) => p.symbol).join(",") || "none"}, messages=${bus.log.length}, ai=${llm.enabled}, ${Date.now() - started}ms`);
  return result;
}
