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

export const NIFTY50 = Object.keys(NIFTY50_SECTORS);
export const sectorOf = (symbol: string) => NIFTY50_SECTORS[symbol] ?? "Other";
