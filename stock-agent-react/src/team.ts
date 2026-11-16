import type { AgentName } from "./lib/types";

export type Person = Exclude<AgentName, "System">;

export const TEAM: Record<Person, { name: string; title: string; focus: string; initials: string }> = {
  Lotappi: { name: "Lotappi", title: "Short-term Trader", focus: "Swing trades · 1-10 days", initials: "LO" },
  Mayavi: { name: "Mayavi", title: "Positional Trader", focus: "Trend holds · ~1 month", initials: "MA" },
  Mubashir: { name: "Mubashir", title: "Research Analyst", focus: "Combines views · risk", initials: "MU" },
  FinalDecision: { name: "Final Decision", title: "Portfolio Head", focus: "Takes the final call", initials: "FD" },
};

export const PEOPLE = Object.keys(TEAM) as Person[];

export const displayName = (n: AgentName | "ALL") =>
  n === "ALL" ? "Team" : n === "System" ? "System" : TEAM[n].name;

/** Chat threads: the team room plus the one-to-one conversations. */
export const THREADS: { id: string; title: string; members: Person[] }[] = [
  { id: "team", title: "Team room", members: PEOPLE },
  { id: "Lotappi|Mayavi", title: "Lotappi & Mayavi", members: ["Lotappi", "Mayavi"] },
  { id: "Lotappi|Mubashir", title: "Lotappi & Mubashir", members: ["Lotappi", "Mubashir"] },
  { id: "Mayavi|Mubashir", title: "Mayavi & Mubashir", members: ["Mayavi", "Mubashir"] },
  { id: "FinalDecision|Mubashir", title: "Mubashir & Final Decision", members: ["Mubashir", "FinalDecision"] },
];
