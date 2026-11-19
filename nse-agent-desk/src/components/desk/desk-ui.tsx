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
const LEVEL_LABELS = new Set(["Pledged", "Default prob.", "Dividend yield"]);
const LEVEL = { has: (label: string) => LEVEL_LABELS.has(label) || label.endsWith("up years") };

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

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Seasonality Agent: average return by calendar month, results by quarter, dividend history. */
function Seasonal({ d }: { d: NonNullable<DeskView["seasonalDetail"]> }) {
  const max = Math.max(1, ...d.months.map((m) => Math.abs(m.avg)));
  return (
    <div className="mt-2.5 space-y-3">
      {d.years > 0 && (
        <div>
          <div className="mb-1 flex items-baseline justify-between text-[11px] text-muted-foreground">
            <span className="font-semibold uppercase tracking-wide">Average return by month</span><span>{d.years} years · highlighted: this month and next</span>
          </div>
          <div className="grid grid-cols-12 gap-0.5" role="img"
            aria-label={d.months.map((m) => `${MON[m.month - 1]} ${m.avg >= 0 ? "+" : ""}${m.avg}%, up ${m.hit}% of years`).join("; ")}>
            {d.months.map((m) => {
              const on = d.window.includes(m.month), h = (Math.abs(m.avg) / max) * 34;
              return (
                <div key={m.month} title={`${MON[m.month - 1]}: average ${m.avg >= 0 ? "+" : ""}${m.avg}%, up in ${m.hit}% of ${m.years} years`}
                  className={cn("flex flex-col items-center rounded-md py-1", on && "bg-primary-soft ring-1 ring-primary/40")}>
                  <span className="text-[9px] font-semibold tnum text-muted-foreground">{m.hit}%</span>
                  <div className="relative h-[72px] w-full">
                    <i className="absolute inset-x-0 top-1/2 h-px bg-border" />
                    <i className={cn("absolute left-1/2 w-2.5 -translate-x-1/2 rounded-sm", m.avg >= 0 ? "bottom-1/2 bg-pos" : "top-1/2 bg-neg")} style={{ height: Math.max(2, h) }} />
                  </div>
                  <span className={cn("text-[9.5px] tnum", on ? "font-bold text-primary" : "text-muted-foreground")}>{MON[m.month - 1]}</span>
                </div>
              );
            })}
          </div>
          <p className="mt-0.5 text-[10.5px] text-muted-foreground">Bars: average return in that month. Number on top: share of years it rose.</p>
        </div>
      )}
      {d.quarters.some((q) => q.revenueVsAvg !== undefined) && (
        <div className="flex flex-wrap items-center gap-1.5 text-[11.5px]">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Results by quarter</span>
          {d.quarters.filter((q) => q.revenueVsAvg !== undefined).map((q) => (
            <span key={q.q} className="rounded-md bg-muted px-1.5 py-0.5 tnum" title={`Revenue vs the average quarter; profit ${q.profitVsAvg !== undefined ? `${q.profitVsAvg >= 0 ? "+" : ""}${q.profitVsAvg}%` : "n/a"}`}>
              {q.label} <b className={q.revenueVsAvg! >= 0 ? "text-pos" : "text-neg"}>{q.revenueVsAvg! >= 0 ? "+" : ""}{q.revenueVsAvg}%</b>
            </span>
          ))}
          <span className="text-[10.5px] text-muted-foreground">revenue vs the average quarter (last few quarters only)</span>
        </div>
      )}
      {d.dividends.length > 0 && (
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full text-left text-[11.5px] tnum">
            <thead><tr className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {["Ex-date", "Dividend", "Yield", "Ex-day move", "Back to pre-dividend price"].map((h, i) => <th key={h} className={cn("py-1 font-semibold", i > 0 && "text-right")}>{h}</th>)}
            </tr></thead>
            <tbody>
              {d.dividends.slice(0, 6).map((e) => (
                <tr key={e.date} className="border-t">
                  <td className="py-1">{e.date}</td>
                  <td className="py-1 text-right">₹{e.amount}</td>
                  <td className="py-1 text-right">{e.yieldPct}%</td>
                  <td className={cn("py-1 text-right font-medium", e.exDayChangePct >= 0 ? "text-pos" : "text-neg")}>{e.exDayChangePct >= 0 ? "+" : ""}{e.exDayChangePct}%</td>
                  <td className="py-1 text-right">{e.recoveryDays === undefined ? "not within 60 days" : e.recoveryDays === 0 ? "same day" : `${e.recoveryDays} days`}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-[10.5px] text-muted-foreground">
            On the ex-date the price usually drops by about the dividend, because new buyers no longer get it. That drop isn&apos;t a loss in value.
            {d.nextEx && <> Next ex-date expected around <b>{d.nextEx.month}</b> (₹{d.nextEx.amount} last year, {d.nextEx.basedOn}).</>}
          </p>
        </div>
      )}
    </div>
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
      {v.seasonalDetail && <Seasonal d={v.seasonalDetail} />}
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
      {desk.seasonal && <View v={desk.seasonal} />}
      <View v={desk.redFlags} />
      {desk.entry && <View v={desk.entry} />}
      {desk.performance.metrics[2].note?.startsWith("estimate") && (
        <p className="text-[11px] leading-snug text-muted-foreground">Expected return is an estimate from earnings growth and valuation against the sector, not a forecast.</p>
      )}
    </section>
  );
}
