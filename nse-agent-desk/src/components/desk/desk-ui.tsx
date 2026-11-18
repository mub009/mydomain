"use client";

import { AlertOctagon, AlertTriangle, CheckCircle2, HelpCircle } from "lucide-react";
import { TEAM } from "@/lib/team";
import type { DeskMetric, DeskTone, DeskView, RedFlag, ResearchDesk } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AgentAvatar } from "./agent-avatar";

const TONE: Record<DeskTone, string> = {
  good: "bg-[var(--buy-bg)] text-[var(--buy-fg)]",
  ok: "bg-muted text-muted-foreground",
  weak: "bg-[var(--avoid-bg)] text-[var(--avoid-fg)]",
  "n/a": "bg-muted text-muted-foreground",
};

/** Shares of a whole (pledge, default probability): shown without a + sign. */
const LEVEL = new Set(["Pledged", "Default prob."]);

export const deskValue = (m: DeskMetric | undefined) =>
  !m || m.value === undefined ? "–"
    : LEVEL.has(m.label) ? (m.label === "Default prob." && m.value < 0.01 ? "<0.01%" : `${m.value.toFixed(m.value < 1 ? 2 : 1)}%`)
    : m.unit === "%" ? `${m.value >= 0 ? "+" : ""}${m.value.toFixed(1)}%`
    : m.unit === "x" ? `${m.value.toFixed(1)}x`
    : m.unit === "pts" ? `${m.value > 0 ? "+" : ""}${m.value}`
    : String(m.value);

const FLAG: Record<RedFlag["status"], { Icon: typeof AlertOctagon; cls: string; label: string }> = {
  severe: { Icon: AlertOctagon, cls: "text-neg", label: "Red flag" },
  warning: { Icon: AlertTriangle, cls: "text-[var(--watch-fg)]", label: "Caution" },
  clear: { Icon: CheckCircle2, cls: "text-pos", label: "Clear" },
  unknown: { Icon: HelpCircle, cls: "text-muted-foreground", label: "Not checked" },
};

function Flags({ flags }: { flags: RedFlag[] }) {
  return (
    <ul className="mt-2 space-y-1">
      {flags.map((f) => {
        const s = FLAG[f.status];
        return (
          <li key={f.check} className="flex gap-1.5 text-[11.5px] leading-snug">
            <s.Icon className={cn("mt-px size-3.5 shrink-0", s.cls)} aria-label={s.label} />
            <span><b className="font-semibold">{f.check}:</b> <span className="text-muted-foreground">{f.detail}</span></span>
          </li>
        );
      })}
    </ul>
  );
}

function View({ v }: { v: DeskView }) {
  const t = TEAM[v.agent];
  return (
    <div className="rounded-lg border p-2.5">
      <div className="mb-2 flex items-center gap-2">
        <AgentAvatar who={v.agent} size={24} />
        <b className="text-[12.5px]" style={{ color: t.color }}>{t.name}</b>
        <span className={cn("ml-auto rounded-md px-1.5 py-px text-[10.5px] font-bold", TONE[v.tone])}>{v.verdict}</span>
        <span className={cn("w-7 text-right text-[11.5px] font-semibold tnum", v.points > 0 ? "text-pos" : v.points < 0 ? "text-neg" : "text-muted-foreground")}>{v.points > 0 ? "+" : ""}{v.points}</span>
      </div>
      <dl className="grid grid-cols-3 gap-1.5 text-center tnum">
        {v.metrics.map((m) => (
          <div key={m.label} className="rounded-md bg-muted/60 px-1 py-1.5" title={m.note}>
            <dt className="text-[10.5px] text-muted-foreground">{m.label}</dt>
            <dd className={cn("text-[13px] font-semibold", (m.unit === "%" || m.unit === "pts") && !LEVEL.has(m.label) && m.value !== undefined && (m.value >= 0 ? "text-pos" : "text-neg"))}>{deskValue(m)}</dd>
            {m.note && <div className="truncate text-[9.5px] leading-tight text-muted-foreground">{m.note}</div>}
          </div>
        ))}
      </dl>
      {v.flags ? <Flags flags={v.flags} />
        : v.reasons.length > 0 && <p className="mt-1.5 text-[11.5px] leading-snug text-muted-foreground">{v.reasons.join(" · ")}</p>}
    </div>
  );
}

/** Drawer section: the research desk's six sub-agent reports. */
export function ResearchDeskSection({ desk }: { desk: ResearchDesk }) {
  return (
    <section className="space-y-2 rounded-xl border p-3" aria-label="Research desk">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-[13px] font-semibold">Research desk</h3>
        <span className="text-[11.5px] text-muted-foreground">
          Net <b className={cn("tnum", desk.points > 0 ? "text-pos" : desk.points < 0 ? "text-neg" : "")}>{desk.points > 0 ? "+" : ""}{desk.points}</b> to Research Agent{desk.sample ? " · sample figures" : ""}
        </span>
      </div>
      <View v={desk.performance} />
      <View v={desk.valuation} />
      <View v={desk.growth} />
      <View v={desk.profitability} />
      <View v={desk.redFlags} />
      {desk.entry && <View v={desk.entry} />}
      {desk.performance.metrics[2].note?.startsWith("estimate") && (
        <p className="text-[11px] leading-snug text-muted-foreground">Expected return is an estimate from earnings growth and valuation against the sector, not a forecast.</p>
      )}
    </section>
  );
}
