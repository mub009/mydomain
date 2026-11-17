import type { AgentName, Person } from "./types";

export const TEAM: Record<Person, { name: string; title: string; focus: string; color: string }> = {
  News: { name: "News Agent", title: "Pre-market news & sentiment", focus: "Collects stock news · 9:00 AM IST", color: "#EC4899" },
  Volatility: { name: "Volatility Agent", title: "India VIX analysis", focus: "Tracks market fear · explains moves", color: "#84CC16" },
  Macro: { name: "Macro Agent", title: "Gold · crude · USD/INR", focus: "Commodity & currency effects", color: "#06B6D4" },
  Momentum: { name: "Momentum Agent", title: "Short-term trades · 1-10 days", focus: "Breakouts, RSI, volume, MACD", color: "#3B82F6" },
  Trend: { name: "Trend Agent", title: "Positional trades · ~1 month", focus: "Moving averages, relative strength", color: "#A855F7" },
  Research: { name: "Research Agent", title: "Combines signals, risk & charts", focus: "EPS, sectors, charts, buy zones", color: "#14B8A6" },
  Decision: { name: "Decision Agent", title: "Final picks & portfolio rules", focus: "Verdicts, sector cap, sizing", color: "#F59E0B" },
};

/** Old agent names (before the technical rename), for data saved by earlier versions. */
export const LEGACY_AGENT: Record<string, Person> = {
  Lotappi: "Momentum", Mayavi: "Trend", Mubashir: "Research", FinalDecision: "Decision", MorningSession: "News", IVIndex: "Volatility",
};
export const migrateAgent = <T extends string>(n: T): T | Person => LEGACY_AGENT[n] ?? n;

export const PEOPLE = Object.keys(TEAM) as Person[];

export const displayName = (n: AgentName | "ALL") =>
  n === "ALL" ? "Team" : n === "System" ? "System" : TEAM[n].name;

/** Chat threads: the team room plus the one-to-one conversations. */
export const THREADS: { id: string; title: string; members: Person[] }[] = [
  { id: "team", title: "Team Room", members: PEOPLE },
  { id: "Momentum|News", title: "News Agent & Momentum Agent", members: ["News", "Momentum"] },
  { id: "News|Trend", title: "News Agent & Trend Agent", members: ["News", "Trend"] },
  { id: "Momentum|Trend", title: "Momentum Agent & Trend Agent", members: ["Momentum", "Trend"] },
  { id: "Momentum|Research", title: "Momentum Agent & Research Agent", members: ["Momentum", "Research"] },
  { id: "Research|Trend", title: "Trend Agent & Research Agent", members: ["Trend", "Research"] },
  { id: "Macro|Research", title: "Macro Agent & Research Agent", members: ["Macro", "Research"] },
  { id: "Research|Volatility", title: "Volatility Agent & Research Agent", members: ["Volatility", "Research"] },
  { id: "Decision|Research", title: "Research Agent & Decision Agent", members: ["Research", "Decision"] },
];
