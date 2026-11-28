/** Company financials for the research drawer. Amounts in ₹ crore (EPS in ₹ per share). */
export interface YearFinancials {
  /** Period label: "FY25" for a year (Indian fiscal year ending March) or "Q2 FY26" for a quarter. */
  year: string;
  /** Last day of the period, YYYY-MM-DD. */
  date?: string;
  revenue?: number;
  netIncome?: number;
  totalAssets?: number;
  totalLiabilities?: number;
  equity?: number;
  debt?: number;
  cash?: number;
  currentAssets?: number;
  currentLiabilities?: number;
  operatingCashFlow?: number;
  capex?: number; // positive number = money spent
  freeCashFlow?: number;
  ebit?: number;
  interestExpense?: number;
  // Income statement
  costOfRevenue?: number;
  grossProfit?: number;
  operatingExpense?: number;
  operatingIncome?: number;
  ebitda?: number;
  pretaxIncome?: number;
  tax?: number;
  /** Diluted earnings per share, ₹. */
  eps?: number;
  // Income statement: banks and finance companies, and other lines
  interestIncome?: number;
  netInterestIncome?: number;
  /** Fees and other non-interest income. */
  otherIncome?: number;
  totalExpenses?: number;
  depreciation?: number;
  minorityInterests?: number;
  // Cash flow
  investingCashFlow?: number;
  financingCashFlow?: number;
  netChangeInCash?: number;
  changeInWorkingCapital?: number;
  /** Positive number = money paid out. */
  dividendsPaid?: number;
  debtIssued?: number;
  /** Positive number = money paid back. */
  debtRepaid?: number;
  endCash?: number;
  // Balance sheet
  netPPE?: number;
  goodwill?: number;
  inventory?: number;
  receivables?: number;
  retainedEarnings?: number;
  netDebt?: number;
  workingCapital?: number;
  minorityInterest?: number;
  /** Shares issued, in crore shares. */
  shares?: number;
}

export interface QualityCheck {
  label: string;
  value: string;
  verdict: "good" | "ok" | "weak" | "n/a";
  note: string;
}

export interface Quality {
  grade: "A" | "B" | "C" | "D" | "n/a";
  checks: QualityCheck[];
  summary: string;
  /** Banks and NBFCs: cash-flow and debt ratios don't apply the usual way. */
  financialSector: boolean;
}

export interface Ratios {
  roe?: number; // %
  debtToEquity?: number;
  currentRatio?: number;
  cashConversion?: number; // operating cash flow / net profit, 3-year
  interestCover?: number;
  fcfPositiveYears?: number;
  years: number;
}

export interface Shareholding {
  /** Holder groups and their % of shares. */
  categories: { label: string; pct: number }[];
  /** Largest named holders, if the source lists them. */
  top: { name: string; type: string; pct: number }[];
  /** Promoter holding over recent quarters, oldest first (when available). */
  promoterTrend?: { period: string; pct: number }[];
  pledgedPct?: number;
  asOf?: string;
  source: string;
  sample: boolean;
  note?: string;
}

/** Company summary: what it does and its key numbers (Yahoo Finance profile). */
export interface CompanyProfile {
  name?: string;
  sector?: string;
  industry?: string;
  /** What the company does. */
  about?: string;
  website?: string;
  city?: string;
  employees?: number;
  people: { name: string; title: string }[];
  stats: {
    marketCapCr?: number; pe?: number; forwardPe?: number; pb?: number; eps?: number; bookValue?: number;
    /** % */
    dividendYield?: number; beta?: number; high52?: number; low52?: number; avgVolume?: number;
    /** % */
    roe?: number; profitMargin?: number; revenueGrowth?: number; earningsGrowth?: number;
    debtToEquity?: number;
  };
  source: string;
}

export interface CompanyReport {
  symbol: string;
  sector: string;
  years: YearFinancials[];
  /** The last ~5 quarters (income statement; balance sheet only where published, usually half-yearly). */
  quarters: YearFinancials[];
  ratios: Ratios;
  quality: Quality;
  shareholding: Shareholding | null;
  /** Company summary (missing in demo mode or when the source has none). */
  profile?: CompanyProfile | null;
  source: string;
  sample: boolean;
  /** Official sources to double-check against. */
  links: { label: string; url: string }[];
}

export interface PeerRow {
  symbol: string;
  ratios: Ratios;
  grade: Quality["grade"];
}
