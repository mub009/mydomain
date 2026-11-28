"use client";

import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Line, LineChart, YAxis } from "recharts";
import { pct } from "@/lib/format";
import { TEAM } from "@/lib/team";
import type { MacroExposure, MacroFactor, MacroReport } from "@/lib/types";
import type { GeoExposure, GeoLevel, GeoReport, GeoTheme } from "@/lib/geopolitics";
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

const LEVEL_STYLE: Record<GeoLevel, string> = {
  Calm: "bg-[var(--buy-bg)] text-[var(--buy-fg)]", Watch: "bg-muted text-foreground",
  Elevated: "bg-[var(--watch-bg)] text-[var(--watch-fg)]", High: "bg-[var(--avoid-bg)] text-[var(--avoid-fg)]",
};
const TREND_STYLE: Record<GeoTheme["trend"], string> = { Escalating: "text-neg", Easing: "text-pos", Steady: "text-muted-foreground" };

function MoveChip({ label, v, upIsBad }: { label: string; v?: number; upIsBad?: boolean }) {
  if (v === undefined) return null;
  const bad = upIsBad ? v > 0 : v < 0;
  return (
    <span className="inline-flex items-center gap-1 rounded-lg bg-muted/70 px-2 py-1 text-[12px] tnum">
      {label} <b className={cn(Math.abs(v) < 0.3 ? "text-foreground" : bad ? "text-neg" : "text-pos")}>{v >= 0 ? "+" : ""}{v.toFixed(1)}%</b>
    </span>
  );
}

/** Geopolitics Agent: wars, conflicts, sanctions, the market check and the stocks affected. */
export function GeopoliticsCard({ geo, revealed, busy }: { geo: GeoReport | null | undefined; revealed: boolean; busy: boolean }) {
  return (
    <section className="card space-y-3 p-4" aria-label="World events">
      <header className="flex items-start gap-3">
        <AgentAvatar who="Geopolitics" size={34} />
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold">World events · wars & sanctions</h2>
          <p className="text-xs text-muted-foreground"><span className="font-semibold" style={{ color: TEAM.Geopolitics.color }}>Geopolitics Agent</span> · reports to the Macro Agent{geo?.sample ? " · sample headlines" : ""}</p>
        </div>
        {revealed && geo && <span className={cn("shrink-0 rounded-md px-2 py-0.5 text-[12px] font-bold", LEVEL_STYLE[geo.level])}>{geo.level} · {geo.score}</span>}
      </header>
      {!revealed ? (
        <p className="flex items-center justify-center gap-2 py-4 text-[13px] text-muted-foreground">{busy ? <>Reading world news <TypingIndicator /></> : "Appears when the Geopolitics Agent reports."}</p>
      ) : !geo ? (
        <p className="py-2 text-[13px] text-muted-foreground">World news wasn&apos;t available for this run.</p>
      ) : (
        <>
          <p className="text-[12.5px]">{geo.summary}</p>
          <div className="flex flex-wrap gap-1.5" aria-label="5-day market moves">
            <span className="self-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">5 days</span>
            <MoveChip label="Brent" v={geo.markets.crudePct} upIsBad /><MoveChip label="Gold" v={geo.markets.goldPct} /><MoveChip label="USD/INR" v={geo.markets.usdinrPct} upIsBad />
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {geo.themes.map((t) => (
              <li key={t.id} className="rounded-xl border p-2.5">
                <div className="flex items-center gap-2">
                  <b className="min-w-0 flex-1 truncate text-[13px]">{t.name}</b>
                  <span className={cn("text-[11.5px] font-semibold", TREND_STYLE[t.trend])}>{t.trend}</span>
                  <span className="text-[11.5px] font-bold tnum">{t.score}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                  <span className={cn("block h-full rounded-full", t.score >= 75 ? "bg-neg" : t.score >= 50 ? "bg-[var(--watch-fg)]" : t.score >= 25 ? "bg-muted-foreground/60" : "bg-pos")} style={{ width: `${Math.max(3, t.score)}%` }} />
                </div>
                {t.headlines.length ? (
                  <ul className="mt-1.5 space-y-1">
                    {t.headlines.slice(0, 2).map((h) => (
                      <li key={h.title} className="text-[11.5px] leading-snug">
                        <span className={cn("mr-1 font-bold", h.tone === "escalation" ? "text-neg" : h.tone === "calming" ? "text-pos" : "text-muted-foreground")}>{h.tone === "escalation" ? "▲" : h.tone === "calming" ? "▼" : "•"}</span>
                        {h.url ? <a href={h.url} target="_blank" rel="noopener noreferrer" className="hover:underline">{h.title}</a> : h.title}
                        {h.source && <span className="text-muted-foreground"> · {h.source}</span>}
                      </li>
                    ))}
                  </ul>
                ) : <p className="mt-1.5 text-[11.5px] text-muted-foreground">Nothing notable in 2 days.</p>}
                {t.score >= 25 && <p className="mt-1.5 text-[11px] text-muted-foreground">Usually: {t.effects.slice(0, 2).join("; ")}.</p>}
              </li>
            ))}
          </ul>
          {geo.exposures.length > 0 && (
            <div className="overflow-x-auto scroll-thin">
              <table className="w-full min-w-[460px] text-left text-[12.5px]">
                <thead><tr className="text-[10.5px] uppercase tracking-wide text-muted-foreground">{["Stock", "Effect", "Why"].map((h) => <th key={h} className="px-1 py-1 font-semibold">{h}</th>)}</tr></thead>
                <tbody>
                  {geo.exposures.slice(0, 10).map((e) => (
                    <tr key={e.symbol} className="border-t">
                      <td className="px-1 py-1.5"><StockSymbolChip symbol={e.symbol} /></td>
                      <td className="px-1 py-1.5"><EffectTag effect={e.effect} points={e.points} /></td>
                      <td className="px-1 py-1.5 text-muted-foreground">{e.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">From Google News headlines of the last 2 days: ▲ escalation (attacks, missiles, troops), ▼ calming (ceasefire, talks). Scores show the tone of the news, not a forecast; stock effects are capped at ±3 points.</p>
        </>
      )}
    </section>
  );
}

/** Drawer note for a stock the Geopolitics Agent flagged. */
export function GeoExposureNote({ e }: { e: GeoExposure }) {
  return (
    <section className="flex gap-2.5 rounded-xl border p-3" aria-label="World events">
      <AgentAvatar who="Geopolitics" size={22} />
      <p className="text-[12.5px]"><b className="font-semibold">World events</b> <EffectTag effect={e.effect} points={e.points} /> <span className="text-muted-foreground">{e.reason}.</span></p>
    </section>
  );
}
