/**
 * Exchange surveillance and pledge data for the Red Flag Agent.
 *
 *  ASM (Additional Surveillance Measure) and GSM (Graded Surveillance Measure)
 *  are NSE/BSE lists of stocks under extra watch, usually for unusual price
 *  moves or weak fundamentals. Trading them carries extra margins or limits.
 *
 *  Sources, in order:
 *   1. .data/surveillance.json (your own copy, e.g. saved from the NSE site):
 *      { "asOf": "2026-11-14", "asm": { "SYMBOL": "LT Stage II" }, "gsm": { "SYMBOL": "Stage I" },
 *        "unsolicited": ["SYMBOL"], "pledge": { "SYMBOL": 12.5 } }
 *   2. NSE website JSON (unofficial; NSE often blocks automated requests)
 *   3. Nothing: the agent then says these lists were not checked.
 *  Demo mode uses sample flags, labelled as samples.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { listOf } from "./market/universe";

export interface Surveillance {
  asm: Record<string, string>;
  gsm: Record<string, string>;
  /** Stocks named in exchange/SEBI alerts about unsolicited tips (SMS, WhatsApp, Telegram). */
  unsolicited: string[];
  /** Promoter shares pledged, % of promoter holding. */
  pledge: Record<string, number>;
  /** Which lists were actually checked. */
  checked: { asm: boolean; gsm: boolean; unsolicited: boolean; pledge: boolean };
  source: string;
  sample: boolean;
  asOf?: string;
}

function seeded(str: string) {
  let h = 2166136261;
  for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Sample flags: mostly small caps, a few mid caps. Pledges come from the demo shareholding. */
export function demoSurveillance(symbols: string[], seed: number, pledge: Record<string, number>): Surveillance {
  const asm: Record<string, string> = {}, gsm: Record<string, string> = {};
  const unsolicited: string[] = [];
  for (const s of symbols) {
    const r = seeded(`surv:${s}:${seed}`);
    const size = listOf(s) ?? "small";
    const base = size === "small" ? 1 : size === "mid" ? 0.35 : 0.05;
    const x = r();
    if (x < 0.012 * base) gsm[s] = "Stage I";
    else if (x < 0.07 * base) asm[s] = ["ST Stage I", "LT Stage I", "LT Stage II"][Math.floor(r() * 3)];
    if (r() < 0.025 * base) unsolicited.push(s);
  }
  return { asm, gsm, unsolicited, pledge, checked: { asm: true, gsm: true, unsolicited: true, pledge: true }, source: "Sample lists (demo)", sample: true };
}

const dataFile = () => path.join(process.env.NSE_DESK_DATA_DIR ?? path.join(process.cwd(), ".data"), "surveillance.json");

/** Collect { symbol, stage } pairs from any JSON shape NSE returns. */
export function collectStages(json: unknown, trail = ""): { symbol: string; stage: string; trail: string }[] {
  const out: { symbol: string; stage: string; trail: string }[] = [];
  if (Array.isArray(json)) json.forEach((v) => out.push(...collectStages(v, trail)));
  else if (json && typeof json === "object") {
    const o = json as Record<string, unknown>;
    if (typeof o.symbol === "string") {
      const key = Object.keys(o).find((k) => /stage|indicator|surv/i.test(k) && typeof o[k] === "string" && o[k]);
      out.push({ symbol: o.symbol.toUpperCase(), stage: key ? String(o[key]) : "listed", trail });
    } else for (const [k, v] of Object.entries(o)) out.push(...collectStages(v, `${trail}/${k}`));
  }
  return out;
}

async function nseSession() {
  const ua = { "User-Agent": "Mozilla/5.0", Accept: "application/json,text/html", "Accept-Language": "en-IN,en;q=0.9" };
  const home = await fetch("https://www.nseindia.com/", { headers: ua, signal: AbortSignal.timeout(8000) });
  const cookie = home.headers.getSetCookie?.().map((c) => c.split(";")[0]).join("; ") ?? "";
  return async (p: string) => {
    const res = await fetch(`https://www.nseindia.com${p}`, { headers: { ...ua, cookie, Referer: "https://www.nseindia.com/" }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  };
}

export async function loadSurveillance(symbols: string[], opts: { demo: boolean; seed: number; demoPledge?: Record<string, number> }): Promise<Surveillance> {
  if (opts.demo) return demoSurveillance(symbols, opts.seed, opts.demoPledge ?? {});
  const s: Surveillance = { asm: {}, gsm: {}, unsolicited: [], pledge: {}, checked: { asm: false, gsm: false, unsolicited: false, pledge: false }, source: "Not checked", sample: false };
  const sources: string[] = [];

  // 1. your own saved copy
  try {
    const f = JSON.parse(await readFile(dataFile(), "utf8"));
    if (f.asm) { Object.assign(s.asm, f.asm); s.checked.asm = true; }
    if (f.gsm) { Object.assign(s.gsm, f.gsm); s.checked.gsm = true; }
    if (Array.isArray(f.unsolicited)) { s.unsolicited.push(...f.unsolicited.map((x: string) => x.toUpperCase())); s.checked.unsolicited = true; }
    if (f.pledge) { Object.assign(s.pledge, f.pledge); s.checked.pledge = true; }
    s.asOf = f.asOf;
    sources.push("surveillance.json");
  } catch { /* no saved copy */ }

  // 2. NSE website (best effort)
  if (!s.checked.asm || !s.checked.gsm || !s.checked.pledge) {
    try {
      const get = await nseSession();
      if (!s.checked.asm) {
        const rows = collectStages(await get("/api/reportASM"));
        for (const r of rows) s.asm[r.symbol] = `${/long/i.test(r.trail) ? "LT" : /short/i.test(r.trail) ? "ST" : ""} ${r.stage}`.trim();
        if (rows.length) { s.checked.asm = true; sources.push("NSE ASM list"); }
      }
      if (!s.checked.gsm) {
        const rows = collectStages(await get("/api/reportGSM"));
        for (const r of rows) s.gsm[r.symbol] = r.stage;
        if (rows.length) { s.checked.gsm = true; sources.push("NSE GSM list"); }
      }
      if (!s.checked.pledge) {
        let found = 0;
        await Promise.all(symbols.map(async (sym) => {
          try {
            const j = JSON.stringify(await get(`/api/corporate-pledgedata?index=equities&symbol=${encodeURIComponent(sym)}`));
            const m = /"[^"]*(?:perc?[^"]*pledg|pledg[^"]*perc?)[^"]*"\s*:\s*"?(-?[\d.]+)/i.exec(j);
            if (m) { s.pledge[sym] = Number(m[1]); found++; }
          } catch { /* this symbol stays unknown */ }
        }));
        if (found) { s.checked.pledge = true; sources.push("NSE pledge data"); }
      }
    } catch { /* NSE not reachable */ }
  }
  s.source = sources.length ? sources.join(" + ") : "Not checked (NSE not reachable and no surveillance.json)";
  return s;
}
