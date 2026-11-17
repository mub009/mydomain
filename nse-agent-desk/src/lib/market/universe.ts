/** Nifty 50 constituents with a broad sector label (used for the sector cap and filters). */
export const NIFTY50_SECTORS: Record<string, string> = {
  RELIANCE: "Energy", ONGC: "Energy", BPCL: "Energy", COALINDIA: "Energy",
  NTPC: "Utilities", POWERGRID: "Utilities",
  TCS: "IT", INFY: "IT", HCLTECH: "IT", WIPRO: "IT", TECHM: "IT",
  HDFCBANK: "Banks", ICICIBANK: "Banks", SBIN: "Banks", KOTAKBANK: "Banks", AXISBANK: "Banks", INDUSINDBK: "Banks",
  BAJFINANCE: "Financials", BAJAJFINSV: "Financials", SHRIRAMFIN: "Financials", SBILIFE: "Financials", HDFCLIFE: "Financials",
  ITC: "FMCG", HINDUNILVR: "FMCG", NESTLEIND: "FMCG", BRITANNIA: "FMCG", TATACONSUM: "FMCG",
  MARUTI: "Auto", "M&M": "Auto", TATAMOTORS: "Auto", EICHERMOT: "Auto", HEROMOTOCO: "Auto", "BAJAJ-AUTO": "Auto",
  SUNPHARMA: "Pharma", CIPLA: "Pharma", DRREDDY: "Pharma", DIVISLAB: "Pharma", APOLLOHOSP: "Healthcare",
  JSWSTEEL: "Metals", TATASTEEL: "Metals", HINDALCO: "Metals",
  ULTRACEMCO: "Cement", GRASIM: "Cement",
  LT: "Infrastructure", ADANIPORTS: "Infrastructure", ADANIENT: "Conglomerate",
  BHARTIARTL: "Telecom",
  TITAN: "Consumer", ASIANPAINT: "Consumer", TRENT: "Consumer",
};

/**
 * Starter lists of well-known mid-cap and small-cap NSE stocks. These are
 * presets to scan, not an official index: membership changes, and each
 * stock's size label comes from its market cap, not from this list.
 */
export const MIDCAP_SECTORS: Record<string, string> = {
  PERSISTENT: "IT", COFORGE: "IT", MPHASIS: "IT", LTTS: "IT", TATAELXSI: "IT",
  LUPIN: "Pharma", AUROPHARMA: "Pharma", ALKEM: "Pharma",
  TATACOMM: "Telecom", VOLTAS: "Consumer", PAGEIND: "Consumer",
  FEDERALBNK: "Banks", IDFCFIRSTB: "Banks", AUBANK: "Banks",
  ASHOKLEY: "Auto", BHARATFORG: "Auto", BALKRISIND: "Auto", MRF: "Auto",
  CUMMINSIND: "Capital Goods", POLYCAB: "Capital Goods", CONCOR: "Infrastructure",
  PIIND: "Chemicals", SRF: "Chemicals",
  TORNTPOWER: "Utilities", PETRONET: "Energy", HINDPETRO: "Energy",
  GODREJPROP: "Realty", OBEROIRLTY: "Realty", PHOENIXLTD: "Realty",
  ASTRAL: "Building Materials",
};

export const SMALLCAP_SECTORS: Record<string, string> = {
  CDSL: "Financials", ANGELONE: "Financials", CAMS: "Financials", HUDCO: "Financials",
  BSOFT: "IT", CYIENT: "IT", SONATSOFTW: "IT", ZENSARTECH: "IT", MASTEK: "IT", REDINGTON: "IT",
  IEX: "Utilities", CESC: "Utilities",
  RADICO: "FMCG", AMBER: "Consumer",
  CENTURYPLY: "Building Materials", CERA: "Building Materials", KAJARIACER: "Building Materials",
  CHAMBLFERT: "Chemicals",
  GRANULES: "Pharma", NATCOPHARM: "Pharma", JBCHEPHARM: "Pharma",
  NBCC: "Infrastructure", IRCON: "Infrastructure", BEML: "Capital Goods",
  RATNAMANI: "Metals", JKLAKSHMI: "Cement", BIRLACORPN: "Cement", TRIDENT: "Textiles",
  KARURVYSYA: "Banks", CUB: "Banks",
};

export const NIFTY50 = Object.keys(NIFTY50_SECTORS);
export const MIDCAPS = Object.keys(MIDCAP_SECTORS);
export const SMALLCAPS = Object.keys(SMALLCAP_SECTORS);
export const ALL_CAPS = [...NIFTY50, ...MIDCAPS, ...SMALLCAPS];

export type Universe = "large" | "mid" | "small" | "all" | "custom";
export const UNIVERSES: Record<Exclude<Universe, "custom">, { label: string; symbols: string[] }> = {
  large: { label: "Large (Nifty 50)", symbols: NIFTY50 },
  mid: { label: "Mid cap", symbols: MIDCAPS },
  small: { label: "Small cap", symbols: SMALLCAPS },
  all: { label: "All caps", symbols: ALL_CAPS },
};

/** Which starter list a symbol came from (used to shape demo market caps). */
export const listOf = (symbol: string): "large" | "mid" | "small" | null =>
  symbol in NIFTY50_SECTORS ? "large" : symbol in MIDCAP_SECTORS ? "mid" : symbol in SMALLCAP_SECTORS ? "small" : null;

export const sectorOf = (symbol: string) =>
  NIFTY50_SECTORS[symbol] ?? MIDCAP_SECTORS[symbol] ?? SMALLCAP_SECTORS[symbol] ?? "Other";
