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
  /** Gold / crude / USD-INR links found by the Macro Agent. */
  macro?: MacroExposure[];
  /** Research Agent's multi-timeframe chart check (top candidates only). */
  chart?: ChartAnalysis;
  /** Research desk: Performance, Valuation and Growth Agents (top candidates only). */
  desk?: ResearchDesk;
  /** Central Bank Agent: effect of RBI policy on this stock's sector. */
  policy?: { points: number; effect: "Tailwind" | "Headwind" | "Mixed" | "Neutral"; reason: string };
  /** Black Points Analyst's downside-risk report (stocks that passed a scan). */
  blackPoints?: BPReport;
  /** Long swing check: is it turning up from a bottom? */
  bottom?: import("./bottom").BottomSetup;
}

export type DeskAgent = "Performance" | "Valuation" | "Growth" | "Profitability" | "Seasonal" | "Entry" | "RedFlag";
export type DeskTone = "good" | "ok" | "weak" | "n/a";

export interface DeskMetric {
  label: string;
  /** Percent for returns and growth, a multiple ("x") for valuation ratios. */
  value?: number;
  unit: "%" | "x" | "pts" | "";
  /** Short context, e.g. "sector median 24.1x" or "analyst mean target". */
  note?: string;
}

export interface DeskView {
  agent: DeskAgent;
  /** Score points this view adds to the combined score. */
  points: number;
  tone: DeskTone;
  verdict: string;
  metrics: DeskMetric[];
  reasons: string[];
  /** Red Flag Agent only: each check and what it found. */
  flags?: RedFlag[];
  /** Seasonality Agent only: month-by-month returns, quarters and dividends. */
  seasonalDetail?: import("./seasonal").SeasonalDetail;
  /** Entry Agent only: the entry call and its price area. */
  entry?: { plan: EntryPlan; low?: number; high?: number };
}

export type EntryPlan = "Buy now" | "Buy on dip" | "Wait" | "Avoid";

export interface RedFlag {
  check: "ASM" | "GSM" | "Promoter pledge" | "Unsolicited tips" | "Default risk";
  status: "severe" | "warning" | "clear" | "unknown";
  detail: string;
}

export interface ResearchDesk {
  performance: DeskView;
  valuation: DeskView;
  growth: DeskView;
  profitability: DeskView;
  /** Missing when the history couldn't be loaded. */
  seasonal?: DeskView;
  redFlags: DeskView;
  /** Set after the chart check. */
  entry?: DeskView;
  /** Total points: performance + valuation + growth + profitability + seasonality (capped at +/-10), plus red flags (down to -10) and entry (+/-2). */
  points: number;
  /** A severe red flag: the Decision Agent won't rate it above WATCH. */
  severe: boolean;
  sample: boolean;
  source: string;
}

// ---------- Black Points Analyst ----------

export type HoldingPeriod = "swing" | "positional";
export type BPStatus = "Eligible" | "Excluded" | "Needs Review";
export type BPCategory = "Structural decline" | "Sector pressure" | "Company weakness" | "Governance & events" | "Evidence coverage";

export interface BPEvidence {
  summary: string;
  /** Publication or period date (YYYY-MM-DD). */
  date?: string;
  source: string;
  url?: string;
  kind: "exchange filing" | "regulator" | "company financials" | "industry data" | "news" | "market data";
}

export interface BPFinding {
  category: BPCategory;
  flag: string;
  scope: "Company" | "Sector";
  /** Material findings decide the status; "watch" findings are reported only. */
  materiality: "material" | "watch";
  /** Verified needs a primary source (filing, regulator, company financials, industry data). */
  verification: "verified" | "unverified" | "stale" | "conflicting" | "missing";
  evidence: BPEvidence[];
  /** Status this finding implies for each holding period it affects. */
  impact: Partial<Record<HoldingPeriod, BPStatus>>;
  note: string;
}

export interface BPReport {
  symbol: string;
  sector: string;
  subsector?: string;
  company?: string;
  /** Why it passed the technical scan, per holding period. */
  passed: Partial<Record<HoldingPeriod, string>>;
  findings: BPFinding[];
  status: Partial<Record<HoldingPeriod, BPStatus>>;
  /** What the Decision Agent did with it. */
  finalDecision?: string;
  checkedAt: string;
  sample: boolean;
}

export interface BPSummary {
  coverage: string[];
  /** Earliest SEBI order date read this run. */
  sebiFrom?: string;
  sample: boolean;
}

export interface Decision extends Analysis {
  verdict: Verdict;
  /** Set when a buy-rated stock was left out of the final picks (e.g. sector cap). */
  passedOver?: string;
  clarification?: string;
  quantity?: number;
  investment?: number;
  spark: number[]; // last ~60 closes
  /** Decision Agent's holding plan: expected days to the target, hold-until date, odds and expected return. */
  hold?: import("./forecast").HoldPlan;
  /** Long-term (1-3 years) view from the research desk: Accumulate / Hold / Reduce / Exit. */
  longTerm?: import("./long-term").LongTermView;
}

export type Person = "News" | "Volatility" | "Macro" | "CentralBank" | "Momentum" | "Trend" | "Research" | DeskAgent | "BlackPoints" | "Decision";
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

export interface MacroFactor {
  id: "gold" | "crude" | "usdinr";
  name: string;
  /** e.g. "₹/10g", "$/bbl", "₹ per $" */
  unit: string;
  level: number;
  ret1d: number;
  ret5d: number;
  ret1m: number;
  trend: "Up" | "Down" | "Flat";
  /** True when the 1-month move is big enough to matter for stocks. */
  significant: boolean;
  spark: number[];
  sample: boolean;
}

export interface MacroExposure {
  symbol: string;
  factor: MacroFactor["id"];
  /** "known" = a documented business link; "measured" = found only in the price data. */
  basis: "known" | "measured";
  link: "benefits" | "hurts" | "mixed";
  reason: string;
  /** Correlation of daily returns with the factor over recent months, if measurable. */
  corr?: number;
  effect: "Tailwind" | "Headwind" | "Neutral";
  points: number;
}

export interface MacroReport {
  factors: MacroFactor[];
  /** Exposures for the stocks in this run, strongest effect first. */
  exposures: MacroExposure[];
  summary: string;
  sample: boolean;
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
  /** Set when a big list was quick-scanned first. */
  scan?: QuickScanSummary;
  /** Long swing picks: stocks turning up from a bottom, held ~3 weeks to 3 months (missing in older runs). */
  longSwing?: Decision[];
  sectors: SectorView[];
  macro: MacroReport | null;
  picks: Decision[];
  watchlist: Decision[];
  all: Decision[];
  skipped: string[];
  /** Black Points Analyst: what was checked this run. */
  blackPoints?: BPSummary;
  /** Central Bank Agent: RBI and Fed policy. */
  policy?: import("./policy").PolicyReport | null;
}

export interface RunRequest {
  symbols: string[];
  top: number;
  demo: boolean;
  aiNotes: boolean;
  capital?: number;
  riskPerTrade: number;
  /** Sectors for searched stocks outside the built-in lists. */
  sectors?: Record<string, string>;
  /** Stocks to research in full whatever their rank (single-stock search). */
  focus?: string[];
  /** A big list (Nifty 500 or all NSE): quick-scanned first, the best 150 get the full research. */
  universe?: "nifty500" | "allnse";
}

/** How a big list was narrowed down before the full research. */
export interface QuickScanSummary {
  label: string;
  /** Stocks in the list, stocks with prices, and stocks left out as too cheap or barely traded. */
  total: number;
  priced: number;
  thin: number;
  shortlisted: number;
  /** Of the shortlist, how many were kept as long swing (bottom) candidates. */
  bottoms?: number;
  from: "nse" | "built-in" | "demo";
  note?: string;
}

export type StreamEvent =
  | { type: "progress"; text: string }
  | { type: "message"; message: Message }
  | { type: "result"; result: RunResult }
  | { type: "error"; message: string };
