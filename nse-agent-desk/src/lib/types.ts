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

export type Timeframe = "1M" | "1D" | "4H" | "1H" | "30m";
export type Trend = "Bullish" | "Bearish" | "Neutral";

export interface TimeframeView {
  tf: Timeframe;
  trend: Trend;
  rsi: number;
  /** Bars the reading is based on. */
  bars: number;
  note: string;
}

export interface HistoryWindow {
  label: "1M" | "3M" | "6M" | "1Y";
  low: number;
  high: number;
  /** Price where the most volume traded in this window. */
  poc: number;
  /** % change over the window. */
  change: number;
  /** Highest swing low below today's price, if any. */
  support?: number;
}

export interface BuyZone {
  low: number;
  high: number;
  /** How far today's price is above the zone (0 when inside it). */
  distancePct: number;
  plan: "In buy zone" | "Wait for dip" | "Extended";
  /** Which history levels make up the zone. */
  basis: string[];
  /** Stop-loss for a buy inside the zone. */
  stop: number;
}

export interface ChartAnalysis {
  timeframes: TimeframeView[];
  bullish: number;
  bearish: number;
  history: HistoryWindow[];
  zone: BuyZone | null;
  /** False when intraday candles were not available. */
  intraday: boolean;
  /** Last ~6 months of daily closes, for the zone chart. */
  closes: number[];
}

export type CapSize = "Large" | "Mid" | "Small" | "Too small" | "Unknown";

export interface Fundamentals {
  /** Market cap in ₹ crore (shares outstanding × last price). */
  marketCapCr?: number;
  cap: CapSize;
  /** Earnings per share over the last 12 months, in ₹. */
  epsTTM?: number;
  /** EPS for the 12 months ending a year earlier. */
  epsYearAgo?: number;
  /** % change between the two; undefined when it can't be computed. */
  epsGrowth1y?: number;
  /** How the EPS figures were built: "TTM" (last 4 vs previous 4 quarters) or "FY" (latest vs previous fiscal year). */
  epsBasis?: "TTM" | "FY";
  /** Recent EPS by period, oldest first. */
  epsHistory: { period: string; eps: number }[];
  source: string;
  sample: boolean;
}

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
  /** Market cap and EPS check. */
  fundamentals?: Fundamentals;
  /** Mubashir's multi-timeframe chart check (top candidates only). */
  chart?: ChartAnalysis;
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

export interface SectorView {
  sector: string;
  members: number;
  /** "index" = an NSE sector index; "composite" = average of this run's stocks. */
  source: "index" | "composite";
  sourceLabel: string;
  ret1m: number;
  ret3m: number;
  /** Sector 1-month return minus Nifty 50 1-month return. */
  relStrength: number;
  /** Change in relative strength over the last 10 trading days. */
  rsMomentum: number;
  /** % of the sector's stocks above their 50-day average. */
  breadth: number;
  state: "Leading" | "Improving" | "Weakening" | "Lagging";
  rank: number;
  /** Last 60 closes rebased to 100, and the Nifty over the same days. */
  closes: number[];
  niftyCloses: number[];
  buyPct: number;
  avgScore: number;
  leaders: string[];
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
  /** Stocks left out for being below the minimum market cap. */
  excluded: { symbol: string; marketCapCr: number }[];
  minCapCr: number;
  sectors: SectorView[];
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
