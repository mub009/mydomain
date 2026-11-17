"use client";

import { AlertOctagon, AlertTriangle, Minus, Plus, ShieldCheck } from "lucide-react";
import type { Diversification, Slice } from "@/lib/diversify";
import { inr } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AgentAvatar } from "./agent-avatar";
import { GradeTag } from "./company-tab";
import { StockSymbolChip } from "./primitives";

/** Horizontal bars, one hue; a bar past the limit turns red and says so. */
function Bars({ title, slices, limit, max = 8 }: { title: string; slices: Slice[]; limit?: number; max?: number }) {
  const shown = slices.slice(0, max), rest = slices.slice(max);
  const rows = rest.length ? [...shown, { name: `${rest.length} more`, value: rest.reduce((s, x) => s + x.value, 0), pct: Math.round(rest.reduce((s, x) => s + x.pct, 0) * 10) / 10 }] : shown;
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}{limit !== undefined && <span className="font-normal normal-case tracking-normal">limit {limit}%</span>}
      </div>
      <ul className="space-y-1.5">
        {rows.map((s) => {
          const over = limit !== undefined && s.pct > limit;
          return (
            <li key={s.name} className="grid grid-cols-[minmax(84px,auto)_1fr_52px] items-center gap-2 text-[12px] tnum">
              <span className="truncate">{s.name}</span>
              <span className="relative h-2.5 rounded-full bg-muted">
                <span className={cn("absolute inset-y-0 left-0 rounded-full", over ? "bg-neg" : "bg-primary")} style={{ width: `${Math.min(100, s.pct)}%` }} />
                {limit !== undefined && <i className="absolute inset-y-[-3px] w-px bg-foreground/50" style={{ left: `${limit}%` }} title={`Limit ${limit}%`} />}
              </span>
              <span className={cn("text-right font-semibold", over && "text-neg")}>{s.pct}%{over ? " ⚠" : ""}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function DiversificationCard({ d, title, subtitle }: { d: Diversification; title: string; subtitle: string }) {
  if (d.grade === "n/a") return null;
  return (
    <section className="card space-y-4 p-4" aria-label={title}>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-[15px] font-semibold">{title}</h2>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2 text-right">
          <div><div className="text-xl font-bold leading-none tnum">{d.score}<span className="text-xs font-medium text-muted-foreground">/100</span></div>
            <div className="text-[11px] text-muted-foreground">diversification</div></div>
          <GradeTag grade={d.grade} className="h-8 min-w-8 text-base" />
        </div>
      </header>

      <div className="flex gap-2.5 rounded-lg bg-muted/50 p-2.5">
        <AgentAvatar who="Mubashir" size={28} />
        <p className="text-[12.5px] leading-relaxed"><b className="text-[#14B8A6]">Mubashir:</b> {d.summary} Total {inr(d.total, 0)}.</p>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        <Bars title="By sector" slices={d.bySector} limit={d.limits.sector} />
        <Bars title="By company size" slices={d.byCap} />
        <Bars title="Largest stocks" slices={d.byStock} limit={d.limits.stock} max={6} />
      </div>

      {d.warnings.length > 0 ? (
        <ul className="space-y-1.5">
          {d.warnings.map((w) => {
            const Icon = w.severity === "critical" ? AlertOctagon : AlertTriangle;
            return (
              <li key={w.text} className={cn("flex gap-2 rounded-lg px-2.5 py-1.5 text-[12.5px]",
                w.severity === "critical" ? "bg-[var(--avoid-bg)] text-[var(--avoid-fg)]" : "bg-[var(--watch-bg)] text-[var(--watch-fg)]")}>
                <Icon className="mt-0.5 size-3.5 shrink-0" />{w.text}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="flex items-center gap-2 rounded-lg bg-[var(--buy-bg)] px-2.5 py-1.5 text-[12.5px] text-[var(--buy-fg)]"><ShieldCheck className="size-3.5" />Within all limits: no sector, stock or size group is too heavy.</p>
      )}

      {d.suggestions.length > 0 && (
        <div>
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">To balance it</div>
          <ul className="space-y-1.5">
            {d.suggestions.map((s) => (
              <li key={s.action + s.symbol} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12.5px]">
                <span className={cn("inline-flex items-center gap-0.5 rounded-md px-1.5 py-px text-[10.5px] font-bold",
                  s.action === "add" ? "bg-[var(--buy-bg)] text-[var(--buy-fg)]" : "bg-[var(--watch-bg)] text-[var(--watch-fg)]")}>
                  {s.action === "add" ? <Plus className="size-3" /> : <Minus className="size-3" />}{s.action === "add" ? "Add" : "Trim"}
                </span>
                <StockSymbolChip symbol={s.symbol} />
                <span className="text-muted-foreground">{s.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
