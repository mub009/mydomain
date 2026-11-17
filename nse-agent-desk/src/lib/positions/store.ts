/** Positions and alerts, saved to .data/positions.json (single user, local app). */
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PositionsState } from "./types";

const FILE = () => path.join(process.env.NSE_DESK_DATA_DIR ?? path.join(process.cwd(), ".data"), "positions.json");
let cache: PositionsState | null = null;
let chain: Promise<unknown> = Promise.resolve();

export async function readState(): Promise<PositionsState> {
  if (cache) return cache;
  try { cache = JSON.parse(await readFile(FILE(), "utf8")); } catch { cache = { positions: [], alerts: [] }; }
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

/** For tests: forget the in-memory copy. */
export const resetCache = () => { cache = null; };
