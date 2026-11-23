/**
 * Upcoming corporate events for Indian stocks and major global companies:
 * results dates, ex-dividend dates and dividend payment dates.
 *
 *  Confirmed  dates the company has announced (Yahoo Finance calendar)
 *  Expected   projected from last year's pattern: Indian dividends from NSE's
 *             official corporate actions, global ones from Yahoo's dividend
 *             history; results dates Yahoo marks as estimates
 */
import { quoteSummary } from "./company";
import { COMPANY_NAMES } from "./news";
import { ALL_CAPS } from "./market/universe";
import { dividendAmount, nseCorporateActions, nseMcpEnabled } from "./nse-mcp/client";
import { loadPolicy } from "./policy";

export interface GlobalCompany { symbol: string; name: string; country: string; flag: string }
export const GLOBAL_COMPANIES: GlobalCompany[] = [
  { symbol: "AAPL", name: "Apple", country: "United States", flag: "🇺🇸" },
  { symbol: "MSFT", name: "Microsoft", country: "United States", flag: "🇺🇸" },
  { symbol: "NVDA", name: "NVIDIA", country: "United States", flag: "🇺🇸" },
  { symbol: "AMZN", name: "Amazon", country: "United States", flag: "🇺🇸" },
  { symbol: "GOOGL", name: "Alphabet", country: "United States", flag: "🇺🇸" },
  { symbol: "META", name: "Meta Platforms", country: "United States", flag: "🇺🇸" },
  { symbol: "TSLA", name: "Tesla", country: "United States", flag: "🇺🇸" },
  { symbol: "JPM", name: "JPMorgan Chase", country: "United States", flag: "🇺🇸" },
  { symbol: "V", name: "Visa", country: "United States", flag: "🇺🇸" },
  { symbol: "XOM", name: "ExxonMobil", country: "United States", flag: "🇺🇸" },
  { symbol: "WMT", name: "Walmart", country: "United States", flag: "🇺🇸" },
  { symbol: "KO", name: "Coca-Cola", country: "United States", flag: "🇺🇸" },
  { symbol: "TSM", name: "TSMC", country: "Taiwan", flag: "🇹🇼" },
  { symbol: "005930.KS", name: "Samsung Electronics", country: "South Korea", flag: "🇰🇷" },
  { symbol: "7203.T", name: "Toyota", country: "Japan", flag: "🇯🇵" },
  { symbol: "0700.HK", name: "Tencent", country: "China", flag: "🇨🇳" },
  { symbol: "BABA", name: "Alibaba", country: "China", flag: "🇨🇳" },
  { symbol: "ASML", name: "ASML", country: "Netherlands", flag: "🇳🇱" },
  { symbol: "SAP.DE", name: "SAP", country: "Germany", flag: "🇩🇪" },
  { symbol: "MC.PA", name: "LVMH", country: "France", flag: "🇫🇷" },
  { symbol: "NESN.SW", name: "Nestlé", country: "Switzerland", flag: "🇨🇭" },
  { symbol: "NOVO-B.CO", name: "Novo Nordisk", country: "Denmark", flag: "🇩🇰" },
  { symbol: "SHEL.L", name: "Shell", country: "United Kingdom", flag: "🇬🇧" },
  { symbol: "HSBA.L", name: "HSBC", country: "United Kingdom", flag: "🇬🇧" },
  { symbol: "2222.SR", name: "Saudi Aramco", country: "Saudi Arabia", flag: "🇸🇦" },
];

export type EventType = "Results" | "Ex-dividend" | "Dividend payment" | "Policy decision";
export interface MarketEvent {
  date: string; symbol: string; name: string; country: string; flag: string; scope: "India" | "Global";
  type: EventType; status: "Confirmed" | "Expected"; amount?: number; currency?: string; note?: string; source: string;
}

const DAY = 86400_000;
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const todayIST = () => iso(Date.now() + 19800_000);
const fromRaw = (x?: { raw?: number }) => (typeof x?.raw === "number" ? iso(x.raw * 1000) : undefined);
const plusYear = (d: string) => `${Number(d.slice(0, 4)) + 1}${d.slice(4)}`;

/** Next expected ex-date from past dividends: last year's dates moved a year on, or the usual gap for quarterly payers. */
export function projectDividend(past: { date: string; amount: number }[], today: string, horizonDays = 120): { date: string; amount: number; basedOn: string } | undefined {
  const recent = past.filter((d) => d.date > iso(Date.parse(today) - 400 * DAY)).sort((a, b) => a.date.localeCompare(b.date));
  const cands = recent.map((d) => ({ date: plusYear(d.date), amount: d.amount, basedOn: d.date }));
  if (recent.length >= 3) {
    const gaps = recent.slice(1).map((d, i) => (Date.parse(d.date) - Date.parse(recent[i].date)) / DAY).sort((a, b) => a - b);
    const gap = gaps[Math.floor(gaps.length / 2)], last = recent[recent.length - 1];
    let next = Date.parse(last.date) + gap * DAY;
    while (iso(next) <= today) next += gap * DAY;
    cands.push({ date: iso(next), amount: last.amount, basedOn: last.date });
  }
  const end = iso(Date.parse(today) + horizonDays * DAY);
  return cands.filter((c) => c.date > today && c.date <= end).sort((a, b) => a.date.localeCompare(b.date))[0];
}

async function yahooDividends(ySymbol: string): Promise<{ date: string; amount: number }[]> {
  const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ySymbol)}?range=2y&interval=1mo&events=div`,
    { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(10000) });
  if (!res.ok) return [];
  const ev = (await res.json())?.chart?.result?.[0]?.events?.dividends ?? {};
  return Object.values(ev as Record<string, { date: number; amount: number }>).map((d) => ({ date: iso(d.date * 1000), amount: d.amount }));
}

async function eventsFor(c: GlobalCompany, scope: "India" | "Global", horizonDays: number): Promise<MarketEvent[]> {
  const today = todayIST(), end = iso(Date.parse(today) + horizonDays * DAY);
  const ySym = scope === "India" ? `${c.symbol}.NS` : c.symbol;
  const out: MarketEvent[] = [];
  const base = { symbol: c.symbol, name: c.name, country: c.country, flag: c.flag, scope };
  let currency: string | undefined;
  try {
    const q = await quoteSummary(ySym, "calendarEvents,price,defaultKeyStatistics", true);
    const lastDiv: number | undefined = q?.defaultKeyStatistics?.lastDividendValue?.raw;
    const ce = q?.calendarEvents ?? {};
    currency = q?.price?.currency;
    if (scope === "India" && q?.price?.longName) base.name = q.price.longName;
    const earn = fromRaw(ce.earnings?.earningsDate?.[0]);
    if (earn && earn >= today && earn <= end) out.push({ ...base, date: earn, type: "Results", status: ce.earnings?.isEarningsDateEstimate ? "Expected" : "Confirmed", source: "Company calendar (Yahoo Finance)", note: ce.earnings?.isEarningsDateEstimate ? "Estimated date" : undefined });
    else if (earn && earn < today) {
      // Last results already out and the next date not announced: quarterly cycle, about 91 days on.
      let next = Date.parse(earn) + 91 * DAY;
      while (iso(next) <= today) next += 91 * DAY;
      if (iso(next) <= end) out.push({ ...base, date: iso(next), type: "Results", status: "Expected", source: "Projected from the last results date (Yahoo Finance)", note: `Quarterly cycle; last results ${earn}` });
    }
    const ex = fromRaw(ce.exDividendDate), pay = fromRaw(ce.dividendDate);
    const amt = lastDiv ? { amount: Math.round(lastDiv * 1000) / 1000, note: "Amount: last declared dividend per share" } : {};
    if (ex && ex >= today && ex <= end) out.push({ ...base, date: ex, type: "Ex-dividend", status: "Confirmed", currency, source: "Company calendar (Yahoo Finance)", ...amt });
    if (pay && pay >= today && pay <= end) out.push({ ...base, date: pay, type: "Dividend payment", status: "Confirmed", currency, source: "Company calendar (Yahoo Finance)", ...amt });
  } catch { /* calendar unavailable: only the projection below */ }
  if (!out.some((e) => e.type === "Ex-dividend")) {
    try {
      const nse = scope === "India" && nseMcpEnabled();
      const past = nse
        ? (await nseCorporateActions(c.symbol, iso(Date.parse(today) - 450 * DAY))).filter((a) => a.actionType === "DIVIDEND").map((a) => ({ date: a.exDate, amount: Math.round(dividendAmount(a.purpose) * 100) / 100 })).filter((d) => d.amount > 0)
        : await yahooDividends(ySym);
      const p = projectDividend(past, today, horizonDays);
      if (p) out.push({ ...base, date: p.date, type: "Ex-dividend", status: "Expected", amount: p.amount, currency: currency ?? (scope === "India" ? "INR" : undefined),
        note: `Based on last year's ex-date ${p.basedOn}`, source: nse ? "NSE corporate actions (official), projected" : "Yahoo Finance dividend history, projected" });
    } catch { /* no history */ }
  }
  return out;
}

const cache = new Map<string, { at: number; v: MarketEvent[] }>();
export async function upcomingEvents(scope: "India" | "Global", symbols?: string[], horizonDays = 120): Promise<MarketEvent[]> {
  const list: GlobalCompany[] = scope === "Global" ? GLOBAL_COMPANIES
    : (symbols?.length ? symbols : ALL_CAPS).map((s) => ({ symbol: s, name: COMPANY_NAMES[s]?.[0] ?? s, country: "India", flag: "🇮🇳" }));
  const key = `${scope}:${list.map((c) => c.symbol).join(",")}:${horizonDays}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 3600_000) return hit.v;
  const all: MarketEvent[][] = new Array(list.length);
  let next = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    for (let i = next++; i < list.length; i = next++) all[i] = await eventsFor(list[i], scope, horizonDays);
  }));
  // Central-bank decisions: RBI (India) and the US Fed (global), from their own websites.
  const policy = await loadPolicy(false).catch(() => null);
  const pe: MarketEvent[] = [];
  const end = iso(Date.parse(todayIST()) + horizonDays * DAY);
  if (scope === "India" && policy?.nextMpc && policy.nextMpc.decisionDate <= end) {
    pe.push({ date: policy.nextMpc.decisionDate, symbol: "RBI", name: "Reserve Bank of India: MPC decision", country: "India", flag: "🇮🇳", scope, type: "Policy decision", status: "Confirmed",
      note: `Meeting ${policy.nextMpc.label}; repo rate now ${policy.rbi?.repo ?? "?"}%, RBI is ${policy.direction}`, source: "RBI MPC schedule (rbi.org.in)" });
  }
  if (scope === "Global") for (const m of (policy?.fed?.upcoming ?? []).filter((x) => x.decisionDate <= end)) {
    pe.push({ date: m.decisionDate, symbol: "FOMC", name: "US Federal Reserve: FOMC decision", country: "United States", flag: "🇺🇸", scope, type: "Policy decision", status: "Confirmed",
      note: `Meeting ${m.label}; federal funds rate now ${policy?.fed?.range}%`, source: "FOMC calendar (federalreserve.gov)" });
  }
  const v = [...pe, ...all.flat()].sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
  cache.set(key, { at: Date.now(), v });
  return v;
}
