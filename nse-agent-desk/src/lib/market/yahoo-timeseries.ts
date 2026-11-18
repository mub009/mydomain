/** Yahoo Finance fundamentals time series (unofficial). Values are in ₹ for NSE stocks. */
type Point = { asOfDate: string; reportedValue?: { raw: number } };
export type Series = Record<string, { date: string; v: number }[]>;

export const yahooSymbol = (s: string) => (s.endsWith(".NS") || s.endsWith(".BO") ? s : `${s}.NS`);

export async function yahooTimeseries(symbol: string, types: string[], years = 6): Promise<Series> {
  const y = yahooSymbol(symbol);
  const now = Math.floor(Date.now() / 1000);
  const url = `https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(y)}` +
    `?symbol=${encodeURIComponent(y)}&type=${types.join(",")}&period1=${now - years * 366 * 86400}&period2=${now}`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store", signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const series: Series = {};
  for (const r of json?.timeseries?.result ?? []) {
    const t = r?.meta?.type?.[0];
    const pts = (r?.[t] as (Point | null)[] | undefined)?.filter((p): p is Point => Boolean(p?.reportedValue)) ?? [];
    if (t) series[t] = pts.map((p) => ({ date: p.asOfDate, v: p.reportedValue!.raw })).sort((a, b) => a.date.localeCompare(b.date));
  }
  return series;
}
