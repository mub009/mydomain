/** Positions and alerts, saved to .data/positions.json (single user, local app). */
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { migrateAgent } from "../team";
import type { Person } from "../types";
import type { PositionsState } from "./types";

const FILE = () => path.join(process.env.NSE_DESK_DATA_DIR ?? path.join(process.cwd(), ".data"), "positions.json");
let cache: PositionsState | null = null;
let chain: Promise<unknown> = Promise.resolve();

export async function readState(): Promise<PositionsState> {
  if (cache) return cache;
  try { cache = JSON.parse(await readFile(FILE(), "utf8")); } catch { cache = { positions: [], alerts: [] }; }
  // Alerts saved before the agents were renamed.
  for (const a of cache!.alerts) a.from = migrateAgent(a.from) as Person;
  return cache!;
}

/** Run a change against the state one at a time and save it (atomic file replace). */
export function update<T>(fn: (s: PositionsState) => T | Promise<T>): Promise<T> {
  const next = chain.then(async () => {
    const s = await readState();
    const out = await fn(s);
    s.alerts = s.alerts.slice(-300); // keep the file small
    const f = FILE();
    await mkdir(path.dirname(f), { recursive: true });
    await writeFile(`${f}.tmp`, JSON.stringify(s, null, 1));
    await rename(`${f}.tmp`, f);
    return out;
  });
  chain = next.catch(() => {});
  return next;
}

/**
 * Hosts without a lasting disk (Vercel: every server instance has its own
 * temporary folder) keep positions in the browser instead. The browser sends
 * its copy with each request and gets the changed copy back.
 */
export const browserStorage = () => Boolean(process.env.VERCEL) || process.env.POSITIONS_STORAGE === "browser";

/** A state sent by the browser, checked for shape and size. */
export function clientState(x: unknown): PositionsState | null {
  const s = x as PositionsState | null;
  if (!s || typeof s !== "object" || !Array.isArray(s.positions) || !Array.isArray(s.alerts)) return null;
  if (s.positions.length > 500 || s.alerts.length > 1000) return null;
  return { positions: s.positions, alerts: s.alerts, lastRunAt: typeof s.lastRunAt === "string" ? s.lastRunAt : undefined };
}

/** Apply a change to the browser's copy when one is sent, otherwise to the saved file. */
export async function change<T>(given: unknown, fn: (s: PositionsState) => T | Promise<T>): Promise<{ out: T; state?: PositionsState }> {
  const s = clientState(given);
  if (!s) return { out: await update(fn) };
  const out = await fn(s);
  s.alerts = s.alerts.slice(-300);
  return { out, state: s };
}

/** For tests: forget the in-memory copy. */
export const resetCache = () => { cache = null; };
