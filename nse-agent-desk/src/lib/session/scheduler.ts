/**
 * News Agent scheduler: runs the whole team automatically every trading
 * day at 09:00 IST (before the 09:15 open), and keeps the latest run so the
 * app can replay it.
 *
 * Runs inside the Next.js server process (started from src/instrumentation.ts),
 * so it only fires while `npm start` / `npm run dev` is running. On a
 * serverless host, call POST /api/session from an external cron instead.
 *
 * Settings (environment):
 *   MORNING_SESSION_ENABLED  "true" to turn the schedule on (default off)
 *   MORNING_SESSION_TIME     "HH:MM" IST, default "09:00"
 *   MORNING_SESSION_DEMO     "true" to use demo data (default: live provider)
 *   MORNING_SESSION_UNIVERSE large | mid | small | all (default all)
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { NSE_HOLIDAYS } from "../market/calendar";
import { UNIVERSES, type Universe } from "../market/universe";
import { runAnalysis } from "../pipeline";
import { threadOf } from "../bus";
import { migrateAgent } from "../team";
import type { AgentName, Message, RunResult } from "../types";

export interface SessionRecord {
  ranAt: string;
  trigger: "schedule" | "manual";
  result: RunResult;
  messages: Message[];
}

const FILE = path.join(process.env.NSE_DESK_DATA_DIR ?? path.join(process.cwd(), ".data"), "morning-session.json");
let latest: SessionRecord | null = null;
let running: Promise<SessionRecord> | null = null;

function ist(at: Date) {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "short",
  }).formatToParts(at);
  const g = (t: string) => f.find((p) => p.type === t)!.value;
  return { date: `${g("year")}-${g("month")}-${g("day")}`, year: Number(g("year")), hhmm: `${g("hour")}:${g("minute")}`, weekday: g("weekday") };
}

export const sessionTime = () => (process.env.MORNING_SESSION_TIME ?? "09:00").padStart(5, "0");

/** True on an NSE trading day, at or after the session time, if today's session has not run yet. */
export function isSessionDue(at: Date, lastRanAt: string | null, time = sessionTime()): boolean {
  const t = ist(at);
  if (t.weekday === "Sat" || t.weekday === "Sun") return false;
  if (NSE_HOLIDAYS[t.year]?.includes(t.date)) return false;
  if (t.hhmm < time || t.hhmm > "15:30") return false;
  return !lastRanAt || ist(new Date(lastRanAt)).date !== t.date;
}

export async function getLatestSession(): Promise<SessionRecord | null> {
  if (latest) return latest;
  try { latest = JSON.parse(await readFile(FILE, "utf8")); } catch { /* none yet */ }
  // Runs saved before the agents were renamed.
  for (const m of latest?.messages ?? []) {
    m.sender = migrateAgent(m.sender) as AgentName;
    m.to = migrateAgent(m.to) as AgentName | "ALL";
    m.thread = threadOf(m.sender, m.to);
  }
  return latest;
}

/** Run the News Agent now. Concurrent calls share one run. */
export function runMorningSession(trigger: SessionRecord["trigger"]): Promise<SessionRecord> {
  if (running) return running;
  running = (async () => {
    const messages: Message[] = [];
    let failure: string | null = null;
    const result = await runAnalysis(
      { symbols: UNIVERSES[(process.env.MORNING_SESSION_UNIVERSE as Exclude<Universe, "custom">) in UNIVERSES ? process.env.MORNING_SESSION_UNIVERSE as Exclude<Universe, "custom"> : "all"].symbols, top: 5, demo: process.env.MORNING_SESSION_DEMO === "true", aiNotes: true, riskPerTrade: 1 },
      (e) => { if (e.type === "message") messages.push(e.message); if (e.type === "error") failure = e.message; },
    );
    if (failure) throw new Error(failure);
    const record: SessionRecord = { ranAt: new Date().toISOString(), trigger, result, messages };
    latest = record;
    try {
      await mkdir(path.dirname(FILE), { recursive: true });
      await writeFile(FILE, JSON.stringify(record));
    } catch (e) {
      console.warn("[nse-agent-desk] could not save the morning session:", (e as Error).message);
    }
    console.log(`[nse-agent-desk] morning session (${trigger}) done: ${result.picks.map((p) => p.symbol).join(", ") || "no picks"}`);
    return record;
  })().finally(() => { running = null; });
  return running;
}

let started = false;
/** Check once a minute whether today's session is due. */
export function startScheduler() {
  if (started || process.env.MORNING_SESSION_ENABLED !== "true") return;
  started = true;
  console.log(`[nse-agent-desk] morning session scheduled daily at ${sessionTime()} IST on NSE trading days`);
  const tick = async () => {
    try {
      const last = await getLatestSession();
      if (isSessionDue(new Date(), last?.ranAt ?? null)) await runMorningSession("schedule");
    } catch (e) {
      console.error("[nse-agent-desk] morning session failed:", (e as Error).message);
    }
  };
  setInterval(tick, 60_000).unref?.();
  void tick();
}
