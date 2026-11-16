/** Runs the agents: Lotappi + Mayavi -> Mubashir -> Final Decision,
 *  then plays out their conversation on the message bus. */
import { FinalDecision } from "./agents/finalDecision";
import { Lotappi } from "./agents/lotappi";
import { Mayavi } from "./agents/mayavi";
import { Mubashir } from "./agents/mubashir";
import { MessageBus } from "./bus";
import { load } from "./data";
import { runDialogue } from "./dialogue";
import { pctReturn, snapshot } from "./indicators";
import { aiModel, LLM } from "./llm";
import type { Message, RunResult } from "./types";

export interface RunOptions {
  symbols: string[];
  top?: number;
  demo?: boolean;
  useAI?: boolean;
  capital?: number;
  riskPerTrade?: number;
  onMessage?: (m: Message) => void;
  onProgress?: (text: string) => void;
}

export async function runAgents(o: RunOptions): Promise<RunResult> {
  const bus = new MessageBus(o.onMessage);
  const llm = new LLM(Boolean(o.useAI));
  const top = o.top ?? 5;

  o.onProgress?.("Loading prices…");
  const { frames, indexClose, mode, skipped } = await load(o.symbols, Boolean(o.demo),
    (d, t) => o.onProgress?.(`Loading prices ${d}/${t}`));
  const snaps = Object.fromEntries(Object.entries(frames).map(([k, v]) => [k, snapshot(v)]));
  const sparks = Object.fromEntries(Object.entries(frames).map(([k, v]) => [k, v.slice(-60).map((b) => b.close)]));
  const indexRet21d = indexClose.length > 21 ? pctReturn(indexClose, 21) : 0;

  const lot = new Lotappi().scan(snaps);
  const may = new Mayavi().scan(snaps, indexRet21d);
  const mubashir = new Mubashir();
  const rows = mubashir.analyse(lot, may, snaps);
  const fd = new FinalDecision();
  const conflicted = fd.conflicted(rows, top);
  const clarifications = Object.fromEntries(conflicted.map((r) => [r.symbol, mubashir.adviseOnConflict(r)]));
  const { all, picks, watchlist } = fd.decide(rows, sparks, top, clarifications, o.capital, o.riskPerTrade ?? 1);

  o.onProgress?.("Agents are talking…");
  await runDialogue(bus, llm, {
    mode, stockCount: rows.length, skipped, indexRet21d,
    aiLabel: llm.enabled ? `on (${aiModel})` : "off",
    lot, may, rows, conflicted, clarifications, picks, watchlist,
  });

  return { mode, indexRet21d: Math.round(indexRet21d * 100) / 100, picks, watchlist, all, conversation: bus.log, skipped };
}
