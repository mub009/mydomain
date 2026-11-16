import type { Person } from "../team";
import { TEAM } from "../team";
import type { Verdict } from "../lib/types";

export const inr = (n: number) => "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export type Presence = "idle" | "online" | "typing";

export function Avatar({ who, size = 32, presence }: { who: Person | "System"; size?: number; presence?: Presence }) {
  const initials = who === "System" ? "SY" : TEAM[who].initials;
  return (
    <span className={`avatar av-${who}`} style={{ width: size, height: size, fontSize: size * 0.36 }} aria-hidden>
      {initials}
      {presence && presence !== "idle" && <i className={`presence ${presence}`} />}
    </span>
  );
}

export function VerdictBadge({ v }: { v: Verdict | string }) {
  return <span className={`badge b-${v.replace(/\s+/g, "-").toLowerCase()}`}>{v}</span>;
}

export function TypingDots() {
  return <span className="typing-dots" aria-label="typing"><i /><i /><i /></span>;
}
