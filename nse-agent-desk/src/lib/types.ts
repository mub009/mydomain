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
  sector: string;
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
  volRatio: number;
  atrPct: number;
  lotReasons: string[];
  lotWarnings: string[];
  mayReasons: string[];
  mayWarnings: string[];
  notes: string[];
}

export interface Decision extends Analysis {
  verdict: Verdict;
  /** Set when a buy-rated stock was left out of the final picks (e.g. sector cap). */
  passedOver?: string;
  clarification?: string;
  quantity?: number;
  investment?: number;
  spark: number[]; // last ~60 closes
}

export type Person = "MorningSession" | "IVIndex" | "Lotappi" | "Mayavi" | "Mubashir" | "FinalDecision";
export type AgentName = Person | "System";
export type Stage = "scan" | "analyze" | "debate" | "decide";

export interface MessageTable {
  columns: string[];
  /** First cell of each row is the stock symbol. */
  rows: string[][];
}

export interface Message {
  id: number;
  sender: AgentName;
  to: AgentName | "ALL";
  /** "team" for the team room, otherwise the two agent names sorted and joined by "|" */
  thread: string;
  kind: "system" | "chat" | "report" | "decision";
  stage: Stage;
  text: string;
  tickers: string[];
  table?: MessageTable;
  aiNote?: string;
}

export interface NewsItem {
  symbol: string;
  headline: string;
  source: string;
  url?: string;
  publishedAt?: string;
  sentiment: "positive" | "negative" | "neutral";
  /** True for fictional sample headlines used in demo mode. */
  sample: boolean;
}

export interface NewsBrief {
  /** e.g. "Sample headlines (demo)" or "Google News" */
  label: string;
  sample: boolean;
  total: number;
  items: NewsItem[]; // positive and negative items that mention a scanned stock
}

export interface VixMover {
  symbol: string;
  expect: "Likely up" | "Bigger swings" | "Holds up" | "At risk";
  why: string;
}

export interface VixReport {
  level: number;
  change1d: number; // %
  change5d: number; // %
  direction: "up" | "down" | "flat";
  regime: "Calm" | "Normal" | "Elevated" | "Fear";
  /** Likely drivers, inferred from price and news data. */
  reasons: string[];
  movers: VixMover[];
  spark: number[];
  sample: boolean;
}

export interface DataSource {
  kind: "demo" | "eod";
  /** Human label, e.g. "Demo data" or "Yahoo Finance (unofficial, end-of-day)". */
  label: string;
  seed?: number;
  /** Why the app fell back to demo data, if it did. */
  fallbackReason?: string;
}

export interface RunResult {
  source: DataSource;
  generatedAt: string;
  simulatedAgents: boolean;
  capital?: number;
  riskPerTrade: number;
  indexRet21d: number;
  news: NewsBrief | null;
  vix: VixReport | null;
  picks: Decision[];
  watchlist: Decision[];
  all: Decision[];
  skipped: string[];
}

export interface RunRequest {
  symbols: string[];
  top: number;
  demo: boolean;
  aiNotes: boolean;
  capital?: number;
  riskPerTrade: number;
}

export type StreamEvent =
  | { type: "progress"; text: string }
  | { type: "message"; message: Message }
  | { type: "result"; result: RunResult }
  | { type: "error"; message: string };
