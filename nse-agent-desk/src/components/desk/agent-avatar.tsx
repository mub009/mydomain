import { TEAM } from "@/lib/team";
import type { AgentName, Person } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { Presence } from "@/store/desk";

/** Hand-drawn illustrated portraits, one per agent. */
function Portrait({ who }: { who: Person }) {
  const skin = { MorningSession: "#E0AC86", IVIndex: "#C99470", Lotappi: "#F2C29B", Mayavi: "#E8B48C", Mubashir: "#D9A27A", FinalDecision: "#EBC3A0" }[who];
  const c = TEAM[who].color;
  return (
    <svg viewBox="0 0 64 64" className="size-full" aria-hidden>
      <rect width="64" height="64" fill={c} opacity=".18" />
      {/* shoulders */}
      <path d="M8 64c0-13 10-20 24-20s24 7 24 20Z" fill={who === "FinalDecision" ? "#27324B" : c} />
      {who === "FinalDecision" && <><path d="M26 45l6 7 6-7-6-2Z" fill="#fff" /><path d="M30.5 50h3l1.5 12h-6Z" fill={c} /></>}
      {who === "Mubashir" && <path d="M25 45l7 8 7-8" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />}
      {who === "Lotappi" && <path d="M24 46h16" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity=".7" />}
      {who === "MorningSession" && <><rect x="38" y="50" width="11" height="8" rx="1.5" fill="#fff" opacity=".9" /><path d="M40 53h7M40 55.5h5" stroke={c} strokeWidth="1.2" /></>}
      {who === "IVIndex" && <path d="M18 56l6-5 5 3 6-7 5 4 6-6" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />}
      {/* neck + head */}
      <rect x="27" y="36" width="10" height="10" rx="4" fill={skin} />
      {who === "Mayavi" && <path d="M15 30c0-13 7-20 17-20s17 7 17 20v16c0 2-3 3-5 1l-3-9H23l-3 9c-2 2-5 1-5-1Z" fill="#3B2A4D" />}
      <ellipse cx="32" cy="28" rx="11.5" ry="13" fill={skin} />
      {/* hair */}
      {who === "Lotappi" && <path d="M20 26c-1-10 5-16 13-16 8 0 13 5 11 15-2-5-5-7-10-7-4 3-10 4-14 8Z" fill="#2B2B33" />}
      {who === "Mayavi" && <path d="M20 27c0-10 5-15 12-15s12 5 12 15c-4-2-7-6-9-9-3 5-9 8-15 9Z" fill="#3B2A4D" />}
      {who === "MorningSession" && <><path d="M19 30c-1-12 5-18 13-18s14 6 13 18c-2-6-5-9-13-9s-11 3-13 9Z" fill="#4A2B1F" /><path d="M18 22c2-6 8-9 14-9s12 3 14 9" fill="none" stroke={c} strokeWidth="3" strokeLinecap="round" /></>}
      {who === "IVIndex" && <path d="M20 25c0-9 5-14 12-14s12 5 12 14c-3-3-6-4-9-4-4 0-8 1-15 4Z" fill="#111827" />}
      {who === "Mubashir" && <><path d="M20 25c0-9 5-14 12-14s12 5 12 14c-2-4-5-6-12-6s-10 2-12 6Z" fill="#1F2937" /><path d="M21 31c1 9 5 12 11 12s10-3 11-12c-2 4-5 5-7 5h-8c-2 0-5-1-7-5Z" fill="#1F2937" /></>}
      {who === "FinalDecision" && <path d="M20 26c-1-9 5-15 12-15 8 0 13 6 12 15-1-4-3-7-6-8-5 1-12 2-18 8Z" fill="#B8BEC9" />}
      {/* face */}
      <circle cx="27.5" cy="28.5" r="1.4" fill="#1F2937" /><circle cx="36.5" cy="28.5" r="1.4" fill="#1F2937" />
      {who === "Mubashir"
        ? <><circle cx="27.5" cy="28.5" r="4" fill="none" stroke="#111827" strokeWidth="1.3" /><circle cx="36.5" cy="28.5" r="4" fill="none" stroke="#111827" strokeWidth="1.3" /><path d="M31.5 28.5h1" stroke="#111827" strokeWidth="1.3" /><path d="M29 36.5c2 1.2 4 1.2 6 0" stroke="#F8FAFC" strokeWidth="1.3" fill="none" strokeLinecap="round" /></>
        : <path d="M28.5 34.5c2 1.6 5 1.6 7 0" stroke="#7C4A33" strokeWidth="1.4" fill="none" strokeLinecap="round" />}
      {who === "FinalDecision" && <path d="M24.5 25h5M34.5 25h5" stroke="#8B93A1" strokeWidth="1.4" strokeLinecap="round" />}
    </svg>
  );
}

const DOT: Record<Presence, string> = {
  Idle: "bg-slate-400", Online: "bg-emerald-500", Typing: "bg-sky-400", Analyzing: "bg-violet-400", Reviewing: "bg-amber-400",
};

/** AgentAvatarWithPresence */
export function AgentAvatar({ who, size = 36, presence, ringClass = "ring-card", className }: {
  who: AgentName; size?: number; presence?: Presence; ringClass?: string; className?: string;
}) {
  return (
    <span className={cn("relative inline-block shrink-0", className)} style={{ width: size, height: size }}>
      <span className="block size-full overflow-hidden rounded-full bg-muted">
        {who === "System"
          ? <span className="grid size-full place-items-center bg-slate-500 text-[10px] font-bold text-white">SYS</span>
          : <Portrait who={who} />}
      </span>
      {presence && (
        <span
          title={presence}
          className={cn("absolute -bottom-0.5 -right-0.5 size-3 rounded-full ring-2", ringClass, DOT[presence],
            presence !== "Idle" && presence !== "Online" && "animate-pulse")}
        />
      )}
    </span>
  );
}

export const PRESENCE_TEXT: Record<Presence, string> = {
  Idle: "text-slate-400", Online: "text-emerald-400", Typing: "text-sky-400", Analyzing: "text-violet-400", Reviewing: "text-amber-400",
};
