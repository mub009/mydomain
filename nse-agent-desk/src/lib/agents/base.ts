import type { AgentReport } from "../types";

export const clamp = (x: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, x));
export const round = (x: number, d = 1) => Math.round(x * 10 ** d) / 10 ** d;
export const signalFor = (s: number): AgentReport["signal"] => (s >= 65 ? "BUY" : s >= 50 ? "WATCH" : "AVOID");
export const byScore = (a: { score: number }, b: { score: number }) => b.score - a.score;
