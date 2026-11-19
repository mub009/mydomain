import { Activity, CalendarRange, Crosshair, Flag, Gauge, PiggyBank, Globe2, IndianRupee, Microscope, Newspaper, Scale, Sprout, TrendingUp, Zap, type LucideIcon } from "lucide-react";
import { TEAM } from "@/lib/team";
import type { AgentName, Person } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { Presence } from "@/store/desk";

/** One icon per agent: what it does, not a person. */
export const AGENT_ICON: Record<Person, LucideIcon> = {
  News: Newspaper,       // pre-market news
  Volatility: Activity,  // India VIX
  Macro: Globe2,         // gold, crude, USD/INR
  Momentum: Zap,         // short-term momentum
  Trend: TrendingUp,     // 1-month trend
  Research: Microscope,  // combines everything
  Performance: Gauge,    // returns: YTD, 5Y, expected
  Valuation: IndianRupee, // P/E, P/B, P/CFO
  Growth: Sprout,        // 3-year growth
  Profitability: PiggyBank, // ROE, margins, cash flow
  Seasonal: CalendarRange, // seasonal months, quarters, dividends
  RedFlag: Flag,         // ASM / GSM, pledge, tips, default risk
  Entry: Crosshair,      // where to enter
  Decision: Scale,       // weighs and decides
};

const DOT: Record<Presence, string> = {
  Idle: "bg-slate-400", Online: "bg-emerald-500", Typing: "bg-sky-400", Analyzing: "bg-violet-400", Reviewing: "bg-amber-400",
};

/** AgentAvatarWithPresence */
export function AgentAvatar({ who, size = 36, presence, ringClass = "ring-card", className }: {
  who: AgentName; size?: number; presence?: Presence; ringClass?: string; className?: string;
}) {
  const Icon = who === "System" ? null : AGENT_ICON[who];
  const color = who === "System" ? "#64748B" : TEAM[who].color;
  return (
    <span className={cn("relative inline-block shrink-0", className)} style={{ width: size, height: size }}>
      {/* Glossy orb: a highlight at the top left, shading underneath and a soft coloured glow. */}
      <span className="grid size-full place-items-center rounded-full text-white"
        style={{
          background: `radial-gradient(circle at 32% 26%, rgb(255 255 255 / 0.55), rgb(255 255 255 / 0) 42%), linear-gradient(150deg, ${color}, color-mix(in srgb, ${color} 62%, black))`,
          boxShadow: `inset 0 -${Math.max(2, size / 9)}px ${Math.max(4, size / 5)}px rgb(0 0 0 / 0.28), inset 0 1px 1px rgb(255 255 255 / 0.4), 0 ${Math.max(2, size / 10)}px ${Math.max(6, size / 4)}px -2px color-mix(in srgb, ${color} 55%, transparent)`,
        }}>
        {Icon ? <Icon style={{ width: size * 0.5, height: size * 0.5, filter: "drop-shadow(0 1px 1px rgb(0 0 0 / 0.35))" }} strokeWidth={2.2} aria-hidden />
          : <span className="text-[10px] font-bold">SYS</span>}
      </span>
      {presence && (
        <span title={presence}
          className={cn("absolute -bottom-0.5 -right-0.5 size-3 rounded-full ring-2", ringClass, DOT[presence],
            presence !== "Idle" && presence !== "Online" && "animate-pulse")} />
      )}
    </span>
  );
}

export const PRESENCE_TEXT: Record<Presence, string> = {
  Idle: "text-slate-400", Online: "text-emerald-400", Typing: "text-sky-400", Analyzing: "text-violet-400", Reviewing: "text-amber-400",
};
