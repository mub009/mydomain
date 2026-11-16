import type { MessageBus } from "../bus";
import type { LLM } from "../llm";
import type { AgentName, AgentReport } from "../types";

export const clamp = (x: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, x));
export const round = (x: number, d = 1) => Math.round(x * 10 ** d) / 10 ** d;
export const signalFor = (s: number): AgentReport["signal"] => (s >= 65 ? "BUY" : s >= 50 ? "WATCH" : "AVOID");

export abstract class Agent {
  abstract name: AgentName;
  abstract role: string;
  constructor(protected bus: MessageBus, protected llm: LLM) {}

  protected explain(task: string, data: unknown) {
    return this.llm.comment(`${this.name}, the ${this.role}`, task, data);
  }
}

export function shortList(reports: AgentReport[], n = 5): string {
  return reports.slice(0, n)
    .map((r, i) => `${i + 1}. ${r.symbol.padEnd(12)} score ${r.score.toFixed(1).padStart(5)}  ${r.signal.padEnd(6)} ${r.reasons.slice(0, 2).join("; ")}`)
    .join("\n");
}
