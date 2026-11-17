import type { AgentName, Person } from "./types";

export const TEAM: Record<Person, { name: string; title: string; focus: string; color: string }> = {
  MorningSession: { name: "Morning Session", title: "News Scout", focus: "Collects stock news · 9:00 AM IST", color: "#EC4899" },
  IVIndex: { name: "IV Index Agent", title: "Volatility Analyst", focus: "Tracks India VIX · explains moves", color: "#84CC16" },
  Lotappi: { name: "Lotappi", title: "Short-term Trader", focus: "Swing trades · 1-10 days", color: "#3B82F6" },
  Mayavi: { name: "Mayavi", title: "Positional Trader", focus: "Trend holds · ~1 month", color: "#A855F7" },
  Mubashir: { name: "Mubashir", title: "Research Analyst", focus: "Combines views · rates risk", color: "#14B8A6" },
  FinalDecision: { name: "Final Decision", title: "Portfolio Head", focus: "Takes the final call", color: "#F59E0B" },
};

export const PEOPLE = Object.keys(TEAM) as Person[];

export const displayName = (n: AgentName | "ALL") =>
  n === "ALL" ? "Team" : n === "System" ? "System" : TEAM[n].name;

/** Chat threads: the team room plus the one-to-one conversations. */
export const THREADS: { id: string; title: string; members: Person[] }[] = [
  { id: "team", title: "Team Room", members: PEOPLE },
  { id: "Lotappi|MorningSession", title: "Morning Session & Lotappi", members: ["MorningSession", "Lotappi"] },
  { id: "Mayavi|MorningSession", title: "Morning Session & Mayavi", members: ["MorningSession", "Mayavi"] },
  { id: "Lotappi|Mayavi", title: "Lotappi & Mayavi", members: ["Lotappi", "Mayavi"] },
  { id: "Lotappi|Mubashir", title: "Lotappi & Mubashir", members: ["Lotappi", "Mubashir"] },
  { id: "Mayavi|Mubashir", title: "Mayavi & Mubashir", members: ["Mayavi", "Mubashir"] },
  { id: "IVIndex|Mubashir", title: "IV Index Agent & Mubashir", members: ["IVIndex", "Mubashir"] },
  { id: "FinalDecision|Mubashir", title: "Mubashir & Final Decision", members: ["Mubashir", "FinalDecision"] },
];
