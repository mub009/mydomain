/** Runs the agents in order: Lotappi + Mayavi -> Mubashir -> Final Decision. */
import { FinalDecision } from "./agents/finalDecision";
import { Lotappi } from "./agents/lotappi";
import { Mayavi } from "./agents/mayavi";
import { Mubashir } from "./agents/mubashir";
import { MessageBus } from "./bus";
import { load } from "./data";
import { pctReturn, snapshot } from "./indicators";
import { aiModel, LLM } from "./llm";
import type { AgentName, Message, RunResult } from "./types";

export interface RunOptions {
  symbols: string[];
  top?: number;
  demo?: boolean;
  useAI?: boolean;
  capital?: number;
  riskPerTrade?: number;
  onMessage?: (m: Message) => void;
  onStage?: (agent: AgentName | "Data" | "Done", detail?: string) => void;
}

export async function runAgents(o: RunOptions): Promise<RunResult> {
  const bus = new MessageBus(o.onMessage);
  const llm = new LLM(Boolean(o.useAI));
  const stage = o.onStage ?? (() => {});

  stage("Data", "Loading prices...");
  const { frames, indexClose, mode, skipped } = await load(o.symbols, Boolean(o.demo),
    (d, t) => stage("Data", `Loading prices ${d}/${t}`));
  const snaps = Object.fromEntries(Object.entries(frames).map(([k, v]) => [k, snapshot(v)]));
  const indexRet21d = indexClose.length > 21 ? pctReturn(indexClose, 21) : 0;

  bus.send("System", "ALL", "Start",
    `Data mode: ${mode.toUpperCase()} | stocks: ${Object.keys(snaps).length}` +
    `${skipped.length ? ` | skipped: ${skipped.join(", ")}` : ""} | AI commentary: ${llm.enabled ? `on (${aiModel})` : "off"}`);

  stage("Lotappi");
  await new Lotappi(bus, llm).run(snaps);
  stage("Mayavi");
  await new Mayavi(bus, llm).run(snaps, indexRet21d);
  stage("Mubashir");
  const mubashir = new Mubashir(bus, llm);
  await mubashir.run(snaps);
  stage("FinalDecision");
  const { picks, watchlist, all } = await new FinalDecision(bus, llm).run(mubashir, o.top ?? 5, o.capital, o.riskPerTrade ?? 1);
  stage("Done");

  return { mode, indexRet21d: Math.round(indexRet21d * 100) / 100, picks, watchlist, all, conversation: bus.log, skipped };
}
