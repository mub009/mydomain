/**
 * Zerodha (Kite Connect v3): read-only holdings and positions.
 *
 * Login happens on Zerodha's own page. Kite sends back a request token, which
 * the server swaps for an access token (valid until 06:00 IST the next day).
 * The access token is kept only in an encrypted, http-only cookie in your
 * browser; it is never stored on the server or sent to any other site.
 *
 * Needs KITE_API_KEY and KITE_API_SECRET (from developers.kite.trade).
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const API = process.env.KITE_API_ROOT ?? "https://api.kite.trade"; // override only for tests
export const COOKIE = "kite_session";

export const kiteConfigured = () => Boolean(process.env.KITE_API_KEY && process.env.KITE_API_SECRET);
export const loginUrl = (apiKey: string) => `${process.env.KITE_LOGIN_ROOT ?? "https://kite.zerodha.com"}/connect/login?v=3&api_key=${encodeURIComponent(apiKey)}`;

/** Kite's checksum: SHA-256 of api_key + request_token + api_secret. */
export const checksum = (apiKey: string, requestToken: string, secret: string) =>
  createHash("sha256").update(apiKey + requestToken + secret).digest("hex");

/** Kite sessions end at 06:00 IST; the cookie ends with them. */
export function sessionExpiry(now = new Date()): Date {
  const ist = new Date(now.getTime() + 5.5 * 3600e3); // IST clock as UTC fields
  const six = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate(), 6, 0, 0) - 5.5 * 3600e3;
  return new Date(six > now.getTime() ? six : six + 24 * 3600e3);
}

export interface KiteSession { token: string; userId: string; name?: string; exp: number }

// AES-256-GCM, keyed from the API secret, so the cookie can't be read or altered.
const key = () => createHash("sha256").update(`nse-agent-desk:${process.env.KITE_API_SECRET ?? ""}`).digest();
export function seal(s: KiteSession): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([c.update(JSON.stringify(s), "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), body]).toString("base64url");
}
export function unseal(v: string | undefined, now = Date.now()): KiteSession | null {
  if (!v) return null;
  try {
    const b = Buffer.from(v, "base64url");
    const d = createDecipheriv("aes-256-gcm", key(), b.subarray(0, 12));
    d.setAuthTag(b.subarray(12, 28));
    const s = JSON.parse(Buffer.concat([d.update(b.subarray(28)), d.final()]).toString("utf8")) as KiteSession;
    return s.token && s.exp > now ? s : null;
  } catch { return null; }
}

export class KiteError extends Error { constructor(message: string, public status: number, public type?: string) { super(message); } }

async function kite<T>(path: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  const headers: Record<string, string> = { "X-Kite-Version": "3", ...(init.headers as Record<string, string>) };
  if (init.token) headers.Authorization = `token ${process.env.KITE_API_KEY}:${init.token}`;
  const res = await fetch(API + path, { ...init, headers, signal: AbortSignal.timeout(15000), cache: "no-store" });
  const j = await res.json().catch(() => null) as { status?: string; data?: T; message?: string; error_type?: string } | null;
  if (!res.ok || j?.status !== "success") throw new KiteError(j?.message ?? `Zerodha error ${res.status}`, res.status, j?.error_type);
  return j.data as T;
}

/** Swap the request token from the login redirect for a session. */
export async function createSession(requestToken: string): Promise<KiteSession> {
  const apiKey = process.env.KITE_API_KEY!, secret = process.env.KITE_API_SECRET!;
  const d = await kite<{ access_token: string; user_id: string; user_name?: string }>("/session/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ api_key: apiKey, request_token: requestToken, checksum: checksum(apiKey, requestToken, secret) }).toString(),
  });
  return { token: d.access_token, userId: d.user_id, name: d.user_name, exp: sessionExpiry().getTime() };
}

export async function endSession(token: string) {
  const q = new URLSearchParams({ api_key: process.env.KITE_API_KEY!, access_token: token });
  await kite(`/session/token?${q}`, { method: "DELETE", token }).catch(() => {});
}

export interface BrokerHolding { symbol: string; exchange: string; qty: number; avgPrice: number; lastPrice: number; closePrice: number; invested: number; value: number; pnl: number; pnlPct: number; dayChangePct: number }
export interface BrokerPosition { symbol: string; exchange: string; product: string; qty: number; avgPrice: number; lastPrice: number; pnl: number; m2m: number }

interface RawHolding { tradingsymbol: string; exchange: string; quantity: number; t1_quantity?: number; average_price: number; last_price: number; close_price: number; pnl: number; day_change_percentage?: number }
interface RawPosition { tradingsymbol: string; exchange: string; product: string; quantity: number; average_price: number; last_price: number; pnl: number; m2m: number }

const r2 = (x: number) => Math.round(x * 100) / 100;

export function normalizeHoldings(raw: RawHolding[]): BrokerHolding[] {
  return raw.map((h) => {
    const qty = (h.quantity ?? 0) + (h.t1_quantity ?? 0); // shares bought yesterday settle a day later
    const invested = qty * h.average_price, value = qty * h.last_price;
    return {
      symbol: h.tradingsymbol, exchange: h.exchange, qty, avgPrice: h.average_price, lastPrice: h.last_price, closePrice: h.close_price,
      invested: r2(invested), value: r2(value), pnl: r2(h.pnl ?? value - invested),
      pnlPct: invested ? r2(((value - invested) / invested) * 100) : 0,
      dayChangePct: r2(h.day_change_percentage ?? (h.close_price ? ((h.last_price - h.close_price) / h.close_price) * 100 : 0)),
    };
  }).filter((h) => h.qty > 0).sort((a, b) => b.value - a.value);
}

export function normalizePositions(raw: { net?: RawPosition[] }): BrokerPosition[] {
  return (raw.net ?? []).map((p) => ({
    symbol: p.tradingsymbol, exchange: p.exchange, product: p.product, qty: p.quantity,
    avgPrice: p.average_price, lastPrice: p.last_price, pnl: r2(p.pnl), m2m: r2(p.m2m),
  }));
}

export async function portfolio(token: string) {
  const [h, p] = await Promise.all([
    kite<RawHolding[]>("/portfolio/holdings", { token }),
    kite<{ net?: RawPosition[] }>("/portfolio/positions", { token }),
  ]);
  const holdings = normalizeHoldings(h), positions = normalizePositions(p);
  const invested = holdings.reduce((s, x) => s + x.invested, 0), value = holdings.reduce((s, x) => s + x.value, 0);
  const day = holdings.reduce((s, x) => s + x.qty * (x.lastPrice - x.closePrice), 0);
  return {
    holdings, positions,
    totals: { invested: r2(invested), value: r2(value), pnl: r2(value - invested), pnlPct: invested ? r2(((value - invested) / invested) * 100) : 0, dayPnl: r2(day), positionsPnl: r2(positions.reduce((s, x) => s + x.pnl, 0)) },
  };
}
