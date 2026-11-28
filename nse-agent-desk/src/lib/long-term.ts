/**
 * Long-term view (1-3 years): is this a business worth owning, whatever the
 * chart does in the next few weeks?
 *
 * Built from the research desk (5-year record, valuation against the sector,
 * 3-year growth, profitability, red flags), the Black Points Analyst and the
 * 200-day trend. Each pillar adds or takes points from 50:
 *
 *   Quality (ROE, margins, cash)   +20 good · +8 ok · -12 weak
 *   Growth (3Y revenue, CF, profit) +18 good · +6 ok · -14 weak · -20 loss-making
 *   Valuation vs sector             +8 cheap · 0 fair · -10 expensive (skipped if P/E > 300: bad data)
 *   5-year record                   +8 at 15%+ a year · +4 at 8%+ · -8 if negative
 *   Safety                          -30 verified red flag · -25 severe · -10 weak
 *   Long trend (200-day average)    +4 above · -6 below
 *
 * 70+ Accumulate (add on dips) · 50-69 Hold · 35-49 Reduce · below 35 Exit.
 */
import type { Decision, DeskTone, DeskView } from "./types";

export type LongTermAction = "ACCUMULATE" | "HOLD" | "REDUCE" | "EXIT";
export interface LongTermPillar { name: string; tone: DeskTone; text: string; points: number }
export interface LongTermView {
  score: number;
  action: LongTermAction;
  grade: "Strong" | "Decent" | "Weak" | "Poor";
  pillars: LongTermPillar[];
  /** One line for chat and lists. */
  summary: string;
}

const metric = (v: DeskView | undefined, re: RegExp) => v?.metrics.find((m) => re.test(m.label))?.value;
const pct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;

export function longTermView(d: Decision): LongTermView | undefined {
  const desk = d.desk;
  if (!desk) return undefined;
  const pillars: LongTermPillar[] = [];
  const add = (name: string, tone: DeskTone, points: number, text: string) => pillars.push({ name, tone, points, text });

  // Quality
  const p = desk.profitability, roe = metric(p, /^ROE/);
  if (p.tone !== "n/a") add("Quality", p.tone, p.tone === "good" ? 20 : p.tone === "ok" ? 8 : -12,
    `${p.verdict.toLowerCase()}${roe !== undefined ? `, ROE ${roe.toFixed(1)}%` : ""}`);
  // Growth
  const g = desk.growth, rev = metric(g, /^Revenue/), prof = metric(g, /^Profit/);
  if (g.verdict === "Loss-making") add("Growth", "weak", -20, "loss-making");
  else if (g.tone !== "n/a") add("Growth", g.tone, g.tone === "good" ? 18 : g.tone === "ok" ? 6 : -14,
    `${g.verdict.toLowerCase()}${rev !== undefined ? `, revenue ${pct(rev)} a year` : ""}${prof !== undefined ? `, profit ${pct(prof)}` : ""}`);
  // Valuation
  // A P/E in the hundreds usually means the earnings figure is broken (near zero), so skip it.
  const v = desk.valuation, pe = metric(v, /^P\/E/);
  if (v.tone !== "n/a" && !(pe !== undefined && pe > 300)) add("Valuation", v.tone, v.tone === "good" ? 8 : v.tone === "ok" ? 0 : -10,
    `${v.verdict.toLowerCase()}${pe !== undefined ? `, P/E ${pe.toFixed(1)}x` : ""}`);
  // Track record
  const five = metric(desk.performance, /^5Y/);
  if (five !== undefined) add("5-year record", five >= 15 ? "good" : five >= 8 ? "ok" : five < 0 ? "weak" : "ok", five >= 15 ? 8 : five >= 8 ? 4 : five < 0 ? -8 : 0, `${pct(five)} a year over 5 years`);
  // Safety
  const bpOut = d.blackPoints && Object.values(d.blackPoints.status).length > 0 && Object.values(d.blackPoints.status).every((s) => s === "Excluded");
  const flag = d.blackPoints?.findings.find((f) => f.materiality === "material");
  if (bpOut) add("Safety", "weak", -30, `verified red flag${flag ? `: ${flag.flag.toLowerCase()}` : ""}`);
  else if (desk.severe) add("Safety", "weak", -25, desk.redFlags.reasons[0] ?? "severe red flag");
  else if (desk.redFlags.tone === "weak") add("Safety", "weak", -10, desk.redFlags.reasons[0] ?? "some red flags");
  else add("Safety", "good", 0, "no serious red flags");
  // Long trend
  const above = d.mayReasons.some((r) => /above (the )?200-day/i.test(r));
  const below = d.mayWarnings.some((r) => /below (the )?200-day/i.test(r));
  if (above || below) add("Long trend", above ? "good" : "weak", above ? 4 : -6, above ? "above its 200-day average" : "below its 200-day average");

  const known = pillars.filter((x) => x.name !== "Safety" && x.name !== "Long trend").length;
  if (known < 2) return undefined; // too little fundamental data to say anything
  const score = Math.max(0, Math.min(100, 50 + pillars.reduce((s, x) => s + x.points, 0)));
  const action: LongTermAction = score >= 70 ? "ACCUMULATE" : score >= 50 ? "HOLD" : score >= 35 ? "REDUCE" : "EXIT";
  const grade = score >= 70 ? "Strong" : score >= 50 ? "Decent" : score >= 35 ? "Weak" : "Poor";
  const best = [...pillars].sort((a, b) => b.points - a.points)[0], worst = [...pillars].sort((a, b) => a.points - b.points)[0];
  const summary = `${grade} long-term case (${score}/100): ${best.points > 0 ? `${best.name.toLowerCase()} ${best.text}` : "no clear strength"}` +
    `${worst.points < 0 && worst !== best ? `; but ${worst.name.toLowerCase()} ${worst.text}` : ""}.`;
  return { score, action, grade, pillars, summary };
}

export const LONG_TERM_LABEL: Record<LongTermAction, string> = { ACCUMULATE: "Accumulate", HOLD: "Hold", REDUCE: "Reduce", EXIT: "Exit" };
