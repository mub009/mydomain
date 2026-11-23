/**
 * NSE equity-segment trading calendar.
 * Regular session: Monday-Friday, 09:15-15:30 IST, excluding trading holidays.
 *
 * IMPORTANT: holiday dates are published by NSE in a circular each year and
 * can change. Verify this list against the current NSE circular and add each
 * new year when it is published. Years not listed fall back to weekends only.
 * Special sessions (e.g. Diwali Muhurat trading) are not modelled.
 */
export const NSE_HOLIDAYS: Record<number, string[]> = {
  2026: [
    "2026-01-26", // Republic Day
    "2026-03-03", // Holi
    "2026-03-26", // Ram Navami
    "2026-03-31", // Mahavir Jayanti
    "2026-04-03", // Good Friday
    "2026-04-14", // Dr. Ambedkar Jayanti
    "2026-05-01", // Maharashtra Day
    "2026-05-28", // Bakri Id
    "2026-06-26", // Muharram
    "2026-09-14", // Ganesh Chaturthi
    "2026-10-02", // Gandhi Jayanti
    "2026-10-20", // Dussehra
    "2026-11-10", // Diwali Balipratipada
    "2026-11-24", // Guru Nanak Jayanti
    "2026-12-25", // Christmas
  ],
};

export interface MarketStatus {
  open: boolean;
  /** "Open", "Closed", "Pre-open", "Weekend" or "Holiday" */
  label: string;
  /** e.g. "02:47 pm" */
  time: string;
  calendarKnown: boolean;
}

/** Wall-clock parts in Asia/Kolkata for any instant. */
function istParts(at: Date) {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "short",
  }).formatToParts(at);
  const get = (t: string) => f.find((p) => p.type === t)!.value;
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`, year: Number(get("year")),
    minutes: Number(get("hour")) * 60 + Number(get("minute")), weekday: get("weekday"),
  };
}

export function marketStatus(at = new Date()): MarketStatus {
  const p = istParts(at);
  const time = at.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" });
  const holidays = NSE_HOLIDAYS[p.year];
  const base = { time, calendarKnown: Boolean(holidays) };
  if (p.weekday === "Sat" || p.weekday === "Sun") return { ...base, open: false, label: "Weekend" };
  if (holidays?.includes(p.date)) return { ...base, open: false, label: "Holiday" };
  if (p.minutes >= 540 && p.minutes < 555) return { ...base, open: false, label: "Pre-open" };
  if (p.minutes >= 555 && p.minutes <= 930) return { ...base, open: true, label: "Open" };
  return { ...base, open: false, label: "Closed" };
}

/** The trading day `n` sessions after `from` (a YYYY-MM-DD date), skipping weekends and NSE holidays. */
export function addTradingDays(from: string, n: number): string {
  const d = new Date(`${from}T00:00:00Z`);
  let left = n;
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const day = d.getUTCDay(), iso = d.toISOString().slice(0, 10);
    if (day !== 0 && day !== 6 && !(NSE_HOLIDAYS[d.getUTCFullYear()] ?? []).includes(iso)) left--;
  }
  return d.toISOString().slice(0, 10);
}
