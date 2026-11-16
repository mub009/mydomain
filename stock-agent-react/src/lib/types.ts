export interface Bar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Snapshot {
  close: number;
  rsi: number;
  ema9: number;
  ema21: number;
  sma20: number;
  sma50: number;
  sma200: number; // NaN when < 200 bars
  macd: number;
  macdSignal: number;
  macdHist: number;
  macdHistPrev: number;
  atr: number;
  atrPct: number;
  volRatio: number;
  high20: number;
  high52w: number;
  ret1d: number;
  ret5d: number;
  ret21d: number;
  volatility21d: number;
}

export interface AgentReport {
  symbol: string;
  score: number;
  signal: "BUY" | "WATCH" | "AVOID";
  reasons: string[];
  warnings: string[];
  horizon: string;
}

export type Risk = "LOW" | "MEDIUM" | "HIGH";
export type Verdict = "STRONG BUY" | "BUY" | "WATCH" | "AVOID";

export interface Analysis {
  symbol: string;
  combined: number;
  lotappi: number;
  mayavi: number;
  agree: boolean;
  conflict: boolean;
  risk: Risk;
  horizon: string;
  entry: number;
  stopLoss: number;
  target: number;
  rsi: number;
  ret5d: number;
  ret21d: number;
  reasons: string[];
  warnings: string[];
  notes: string[];
}

export interface Decision extends Analysis {
  verdict: Verdict;
  clarification?: string;
  quantity?: number;
  investment?: number;
}

export type AgentName = "System" | "Lotappi" | "Mayavi" | "Mubashir" | "FinalDecision";

export interface Message {
  id: number;
  sender: AgentName;
  to: AgentName | "ALL";
  subject: string;
  text: string;
  aiNote?: string;
  time: string;
}

export interface RunResult {
  mode: "live" | "demo";
  indexRet21d: number;
  picks: Decision[];
  watchlist: Decision[];
  all: Decision[];
  conversation: Message[];
  skipped: string[];
}
