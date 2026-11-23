/**
 * Client for NSE's official Bhavcopy MCP server (mcp.nseindia.in): end-of-day
 * prices for ~5,000 NSE stocks, NSE indices with P/E, P/B and dividend yield,
 * India VIX, market breadth and corporate actions (dividends, splits, bonuses).
 *
 * MCP over Streamable HTTP: one session, JSON-RPC "tools/call", answers as
 * JSON or as a server-sent event. Calls are cached (end-of-day data), at most
 * NSE_MCP_CONCURRENCY run at once, and a failed call is retried with backoff
 * (the server sometimes returns a gateway error page).
 *
 * Settings: NSE_MCP=off disables it; NSE_MCP_URL points elsewhere.
 */
const URL_DEFAULT = "https://mcp.nseindia.in/bhavcopy/cm/mcp";
export const nseMcpEnabled = () => (process.env.NSE_MCP ?? "on").toLowerCase() !== "off";
const url = () => process.env.NSE_MCP_URL ?? URL_DEFAULT;

let session: Promise<string> | null = null;
let rpcId = 0;
const cache = new Map<string, { at: number; v: unknown }>();
const TTL = 20 * 60_000;

// simple semaphore
let active = 0;
const waiting: (() => void)[] = [];
const limit = () => Math.max(1, Number(process.env.NSE_MCP_CONCURRENCY ?? 12));
async function slot<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= limit()) await new Promise<void>((r) => waiting.push(r));
  active++;
  try { return await fn(); } finally { active--; waiting.shift()?.(); }
}

function parseBody(text: string): { result?: { content?: { type: string; text?: string }[]; isError?: boolean }; error?: { message: string } } {
  const data = text.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim()).pop() ?? text.trim();
  if (!data.startsWith("{")) throw new Error("NSE MCP returned a non-JSON page");
  return JSON.parse(data);
}

async function post(body: unknown, sid?: string) {
  return fetch(url(), {
    method: "POST", signal: AbortSignal.timeout(20000),
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", "MCP-Protocol-Version": "2025-06-18", ...(sid ? { "Mcp-Session-Id": sid } : {}) },
    body: JSON.stringify(body),
  });
}

function openSession(): Promise<string> {
  session ??= (async () => {
    const res = await post({ jsonrpc: "2.0", id: ++rpcId, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "nse-agent-desk", version: "1.0" } } });
    const sid = res.headers.get("mcp-session-id");
    parseBody(await res.text());
    if (!sid) throw new Error("NSE MCP did not open a session");
    await post({ jsonrpc: "2.0", method: "notifications/initialized" }, sid).catch(() => {});
    return sid;
  })().catch((e) => { session = null; throw e; });
  return session;
}

/** Call an NSE MCP tool and return its parsed JSON answer. */
export async function nseTool<T = Record<string, unknown>>(name: string, args: Record<string, unknown>): Promise<T> {
  const key = `${name}:${JSON.stringify(args)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.v as T;
  const v = await slot(async () => {
    let lastErr: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const sid = await openSession();
        const res = await post({ jsonrpc: "2.0", id: ++rpcId, method: "tools/call", params: { name, arguments: args } }, sid);
        if (res.status === 404 || res.status === 400) { session = null; throw new Error(`session expired (HTTP ${res.status})`); }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = parseBody(await res.text());
        if (body.error) throw new Error(body.error.message);
        const text = body.result?.content?.find((c) => c.type === "text")?.text ?? "";
        if (body.result?.isError) throw new Error(text.slice(0, 200) || "tool error");
        return JSON.parse(text) as T;
      } catch (e) {
        lastErr = e;
        await new Promise((r) => setTimeout(r, 400 * 2 ** attempt));
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  });
  cache.set(key, { at: Date.now(), v });
  return v;
}

// ---------- typed helpers ----------

export interface NseBar { date: string; open: number; high: number; low: number; close: number; volume: number; deliveryQty?: number }
export interface NseAction { exDate: string; actionType: string; purpose: string; adjustmentFactor: number }

type HistoryChunk = { data?: { date: string; open: number; high: number; low: number; close: number; volume: number; deliveryQty?: number }[]; next_end_date?: string };

/**
 * Daily OHLCV for one stock, oldest first, `months` back. The server returns
 * 3 months per call; the chunks' end dates are known in advance (each ends the
 * day before the next one starts), so they are fetched in parallel.
 */
export async function nseStockHistory(symbol: string, months = 12): Promise<NseBar[]> {
  const today = new Date(Date.now() + 19800_000);
  const ends = Array.from({ length: Math.ceil(months / 3) }, (_, k) => {
    if (k === 0) return "today";
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 3 * k, today.getUTCDate() - 1));
    return d.toISOString().slice(0, 10);
  });
  const chunks = await Promise.all(ends.map((endDate, k) => nseTool<HistoryChunk>("get_stock_history", { symbol, months: Math.min(3, months - 3 * k), endDate })));
  const out: NseBar[] = chunks.flatMap((r) => (r.data ?? []).map((d) => ({ date: d.date, open: d.open, high: d.high, low: d.low, close: d.close, volume: d.volume, deliveryQty: d.deliveryQty || undefined })));
  const seen = new Set<string>();
  return out.filter((b) => !seen.has(b.date) && Boolean(seen.add(b.date))).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Corporate actions from `fromDate` to today. One cached 10-year call per stock
 * is shared by every agent (prices, dividends), then filtered here.
 */
export async function nseCorporateActions(symbol: string, fromDate: string): Promise<NseAction[]> {
  const today = new Date(Date.now() + 19800_000).toISOString().slice(0, 10);
  const from = `${Number(today.slice(0, 4)) - 10}-01-01`;
  const r = await nseTool<{ actions?: NseAction[] }>("get_corporate_actions", { symbol, fromDate: from, toDate: today });
  return (r.actions ?? []).filter((a) => a.exDate >= fromDate);
}

/**
 * Adjust raw bhavcopy prices for splits and bonuses: every bar before an
 * ex-date is multiplied by that action's adjustment factor (0.5 for a 1:2
 * split, 0.2 for a 4:1 bonus) and its volume divided by it.
 */
export function adjustForActions<T extends { date: string; open: number; high: number; low: number; close: number; volume: number }>(bars: T[], actions: NseAction[]): T[] {
  const factors = actions.filter((a) => a.adjustmentFactor > 0 && a.adjustmentFactor !== 1);
  if (!factors.length) return bars;
  return bars.map((b) => {
    const f = factors.filter((a) => b.date < a.exDate).reduce((p, a) => p * a.adjustmentFactor, 1);
    return f === 1 ? b : { ...b, open: b.open * f, high: b.high * f, low: b.low * f, close: b.close * f, volume: b.volume / f };
  });
}

/** Rupees per share from an NSE dividend description, e.g. "Dividend - Rs 6.75 Per Share /Special Dividend - Rs 2.75 Per Share" = 9.5. */
export function dividendAmount(purpose: string): number {
  return [...purpose.matchAll(/(?:Rs\.?|Re\.?|₹)\s*([\d.]+)\s*(?:\/-\s*)?Per\s*Share/gi)].reduce((s, m) => s + Number(m[1]), 0);
}

export async function nseIndexHistory(indexName: string, months = 12): Promise<NseBar[]> {
  const r = await nseTool<{ data?: { date: string; open: number; high: number; low: number; close: number; volume?: number }[] }>("get_index_history", { indexName, months, endDate: "today" });
  return (r.data ?? []).map((d) => ({ date: d.date, open: d.open, high: d.high, low: d.low, close: d.close, volume: d.volume ?? 0 })).sort((a, b) => a.date.localeCompare(b.date));
}

export interface NseIndexRow { indexName: string; close: number; pctChange: number; pe?: number; pb?: number; divYield?: number; date: string }
export async function nseIndexSnapshot(): Promise<NseIndexRow[]> {
  const r = await nseTool<{ indices?: NseIndexRow[]; data?: NseIndexRow[] }>("get_index_snapshot", { date: "today", filter: "" });
  return r.indices ?? r.data ?? [];
}

export interface NseMood {
  date: string;
  stock_breadth?: { up: number; down: number; unchanged: number; up_pct: number; reading: string; stocks: number };
  index_breadth?: { up: number; down: number; up_pct: number; reading: string; equity_indices: number };
  india_vix?: { level: number; change_1d_pct: number; range?: { min: number; max: number; percentile: number; window_from: string } };
}
export const nseMarketMood = () => nseTool<NseMood>("get_market_mood", { date: "today" });

export async function nseBulkQuote(symbols: string[]): Promise<{ symbol: string; close: number; prev_close: number; pct_change: number; date: string }[]> {
  const r = await nseTool<{ quotes?: { symbol: string; close: number; prev_close: number; pct_change: number; date: string }[] }>("get_bulk_quote", { symbols: symbols.slice(0, 50) });
  return r.quotes ?? [];
}
