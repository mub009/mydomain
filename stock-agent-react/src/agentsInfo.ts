import type { AgentName } from "./lib/types";

export const AGENTS: { id: Exclude<AgentName, "System">; name: string; job: string; initials: string }[] = [
  { id: "Lotappi", name: "Lotappi", job: "Short-term stocks (1-10 days)", initials: "L" },
  { id: "Mayavi", name: "Mayavi", job: "Short-month stocks (~1 month)", initials: "M" },
  { id: "Mubashir", name: "Mubashir", job: "Analyses both reports + risk", initials: "Mu" },
  { id: "FinalDecision", name: "Final Decision", job: "Takes the final decision", initials: "FD" },
];

export const displayName = (n: string) => (n === "FinalDecision" ? "Final Decision" : n);
