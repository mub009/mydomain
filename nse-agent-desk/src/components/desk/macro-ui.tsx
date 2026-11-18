"use client";

import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Line, LineChart, YAxis } from "recharts";
import { pct } from "@/lib/format";
import { TEAM } from "@/lib/team";
import type { MacroExposure, MacroFactor, MacroReport } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AgentAvatar } from "./agent-avatar";
import { StockSymbolChip, TypingIndicator } from "./primitives";

const NAMES: Record<MacroFactor["id"], string> = { gold: "Gold", crude: "Brent crude", usdinr: "USD/INR" };
const fmtLevel = (f: MacroFactor) =>
  f.id === "gold" ? `₹${Math.round(f.level).toLocaleString("en-IN")}` : f.id === "crude" ? `$${f.level.toFixed(2)}` : `₹${f.level.toFixed(2)}`;

export function EffectTag({ effect, points }: { effect: MacroExposure["effect"]; points?: number }) {
  const cls = effect === "Tailwind" ? "bg-[var(--buy-bg)] text-[var(--buy-fg)]" : effect === "Headwind" ? "bg-[var(--avoid-bg)] text-[var(--avoid-fg)]" : "bg-muted text-muted-foreground";
  const Icon = effect === "Tailwind" ? ArrowUpRight : effect === "Headwind" ? ArrowDownRight : Minus;
  return (
    <span className={cn("inline-flex items-center gap-0.5 whitespace-nowrap rounded-md px-1.5 py-px text-[10.5px] font-bold", cls)}>
      <Icon className="size-3" />{effect}{points ? ` ${points > 0 ? "+" : ""}${points}` : ""}
    </span>
  );
}

function FactorTile({ f }: { f: MacroFactor }) {
  const up = f.ret1m >= 0;
  return (
    <div className="rounded-xl border p-3">
      <div className="flex items-center justify-between text-[12px] font-medium text-muted-foreground">
        {f.name}<span className="text-[10.5px]">{f.unit}</span>
      </div>
      <div className="mt-0.5 flex items-end justify-between gap-2">
        <div>
          <div className="text-xl font-bold tracking-tight tnum">{fmtLevel(f)}</div>
          <div className="text-[11.5px] tnum">
            <span className={cn("font-semibold", up ? "text-pos" : "text-neg")}>{pct(f.ret1m)}</span>
            <span className="text-muted-foreground"> 1M · {pct(f.ret1d)} today</span>
          </div>
        </div>
        <span role="img" aria-label={`${f.name}, last 60 days, trend ${f.trend.toLowerCase()}`}>
          <LineChart width={86} height={34} data={f.spark.map((v, i) => ({ i, v }))} margin={{ top: 3, right: 2, bottom: 3, left: 2 }} accessibilityLayer={false}>
            <YAxis hide domain={["dataMin", "dataMax"]} />
            <Line dataKey="v" stroke={TEAM.Macro.color} strokeWidth={1.75} dot={false} isAnimationActive={false} />
          </LineChart>
        </span>
      </div>
      <div className={cn("mt-1 text-[11px] font-semibold", f.significant ? "text-foreground" : "text-muted-foreground")}>
        {f.significant ? "Big enough to move exposed stocks" : "Small move: no score effect"}
      </div>
    </div>
  );
}

/** Overview card: the three factors and the stocks they push. */
export function MacroCard({ macro, revealed, busy }: { macro: MacroReport | null | undefined; revealed: boolean; busy: boolean }) {
  const active = macro?.exposures.filter((e) => e.points !== 0) ?? [];
  return (
    <section className="card space-y-3 p-4" aria-label="Gold, crude and USD/INR">
      <header className="flex items-start gap-3">
        <AgentAvatar who="Macro" size={34} />
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold">Gold · Crude · USD/INR</h2>
          <p className="text-xs text-muted-foreground"><span className="font-semibold" style={{ color: TEAM.Macro.color }}>Macro Agent</span> · which stocks these moves help or hurt{macro?.sample ? " · sample series" : ""}</p>
        </div>
      </header>
      {!revealed ? (
        <p className="flex items-center justify-center gap-2 py-4 text-[13px] text-muted-foreground">{busy ? <>Reading gold, crude and USD/INR <TypingIndicator /></> : "Appears when the Macro Agent reports."}</p>
      ) : !macro || !macro.factors.length ? (
        <p className="py-2 text-[13px] text-muted-foreground">Gold, crude and USD/INR data was not available for this run.</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">{macro.factors.map((f) => <FactorTile key={f.id} f={f} />)}</div>
          <p className="text-[12.5px]">{macro.summary}</p>
          {active.length > 0 && (
            <div className="overflow-x-auto scroll-thin">
              <table className="w-full min-w-[520px] text-left text-[12.5px]">
                <thead><tr className="text-[10.5px] uppercase tracking-wide text-muted-foreground">
                  {["Stock", "Factor", "Effect", "Why"].map((h) => <th key={h} className="px-1 py-1 font-semibold">{h}</th>)}
                </tr></thead>
                <tbody>
                  {active.slice(0, 10).map((e) => (
                    <tr key={e.symbol + e.factor} className="border-t">
                      <td className="px-1 py-1.5"><StockSymbolChip symbol={e.symbol} /></td>
                      <td className="px-1 py-1.5 whitespace-nowrap">{NAMES[e.factor]}</td>
                      <td className="px-1 py-1.5"><EffectTag effect={e.effect} points={e.points} /></td>
                      <td className="px-1 py-1.5 text-muted-foreground">{e.reason}{e.corr !== undefined ? ` · correlation ${e.corr.toFixed(2)}` : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">Gold is the international price converted to ₹ per 10 g (no import duty or GST). Links come from each company’s business, checked against how its price actually moved.</p>
        </>
      )}
    </section>
  );
}

/** Drawer section for a stock with a gold / crude / USD-INR link. */
export function MacroExposureSection({ exposures, factors }: { exposures: MacroExposure[]; factors: MacroFactor[] }) {
  const by = new Map(factors.map((f) => [f.id, f]));
  const total = Math.max(-4, Math.min(4, exposures.reduce((s, e) => s + e.points, 0)));
  return (
    <section className="space-y-2 rounded-xl border p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-[13px] font-semibold"><AgentAvatar who="Macro" size={22} />Macro exposure</h3>
        <span className="text-[11.5px] text-muted-foreground">score effect <b className={cn(total > 0 ? "text-pos" : total < 0 ? "text-neg" : "text-foreground")}>{total > 0 ? "+" : ""}{total}</b></span>
      </div>
      <ul className="space-y-2">
        {exposures.map((e) => {
          const f = by.get(e.factor);
          return (
            <li key={e.factor} className="text-[12.5px]">
              <div className="flex flex-wrap items-center gap-2">
                <b>{NAMES[e.factor]}</b>
                {f && <span className="text-muted-foreground tnum">{fmtLevel(f)} · {pct(f.ret1m)} 1M</span>}
                <EffectTag effect={e.effect} points={e.points} />
                <span className="text-[11px] text-muted-foreground">{e.basis === "known" ? (e.link === "mixed" ? "mixed link" : `${e.link} when it rises`) : "measured link"}</span>
              </div>
              <p className="mt-0.5 text-muted-foreground">
                {e.reason.charAt(0).toUpperCase() + e.reason.slice(1)}.
                {e.corr !== undefined && e.basis === "known" && ` Measured correlation over recent months: ${e.corr.toFixed(2)}${Math.abs(e.corr) < 0.2 ? " (weak)" : (e.corr > 0) === (e.link === "benefits") ? " (agrees)" : " (disagrees)"}.`}
                {f && !f.significant && " The move this month is small, so no score effect."}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
