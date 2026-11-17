"use client";

import { ArrowDownRight, ArrowUpRight, CornerRightDown, CornerRightUp } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, Tooltip, YAxis } from "recharts";
import { pct } from "@/lib/format";
import type { SectorView } from "@/lib/types";
import { cn } from "@/lib/utils";
import { StockSymbolChip } from "./primitives";

const STATE: Record<SectorView["state"], { cls: string; Icon: typeof ArrowUpRight; hint: string }> = {
  Leading: { cls: "bg-[var(--strong-bg)] text-[var(--strong-fg)]", Icon: ArrowUpRight, hint: "beating the Nifty, and the lead is growing" },
  Improving: { cls: "bg-primary-soft text-primary", Icon: CornerRightUp, hint: "behind the Nifty, but catching up" },
  Weakening: { cls: "bg-[var(--watch-bg)] text-[var(--watch-fg)]", Icon: CornerRightDown, hint: "ahead of the Nifty, but the lead is shrinking" },
  Lagging: { cls: "bg-[var(--avoid-bg)] text-[var(--avoid-fg)]", Icon: ArrowDownRight, hint: "behind the Nifty, and falling further back" },
};
export const isSectorState = (v: string): v is SectorView["state"] => v in STATE;

export function SectorStateTag({ state }: { state: SectorView["state"] }) {
  const s = STATE[state];
  return <span className={cn("inline-flex items-center gap-0.5 whitespace-nowrap rounded-md px-1.5 py-px text-[10.5px] font-bold", s.cls)} title={s.hint}><s.Icon className="size-3" />{state}</span>;
}

/** Drawer: how this stock's sector is doing. */
export function SectorCheck({ s, total, symbol }: { s: SectorView; total: number; symbol: string }) {
  const data = s.closes.map((v, i) => ({ i, sector: v, nifty: s.niftyCloses[i] }));
  return (
    <section className="space-y-2.5 rounded-xl border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[13px] font-semibold">Sector check · {s.sector}</h3>
        <span className="flex items-center gap-2 text-[11.5px] text-muted-foreground">rank {s.rank} of {total}<SectorStateTag state={s.state} /></span>
      </div>
      <p className="text-[12.5px]">The {s.sector} sector is <b>{s.state.toLowerCase()}</b>: {STATE[s.state].hint}.</p>
      <dl className="grid grid-cols-4 gap-1.5 text-center tnum">
        {[["1 month", pct(s.ret1m), s.ret1m], ["3 months", pct(s.ret3m), s.ret3m], ["vs Nifty 1M", pct(s.relStrength), s.relStrength], ["Above 50-DMA", `${s.breadth}%`, s.breadth - 50]].map(([l, v, n]) => (
          <div key={l as string} className="rounded-lg bg-muted/60 px-1 py-1.5"><dt className="text-[10.5px] text-muted-foreground">{l}</dt>
            <dd className={cn("text-[13px] font-semibold", (n as number) >= 0 ? "text-pos" : "text-neg")}>{v}</dd></div>
        ))}
      </dl>
      {data.length > 1 && (
        <>
          <div className="flex gap-4 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><i className="h-0.5 w-3 rounded bg-[var(--series-1)]" />{s.sector}</span>
            {s.niftyCloses.length > 0 && <span className="inline-flex items-center gap-1.5"><i className="h-0.5 w-3 rounded bg-muted-foreground" />Nifty 50</span>}
            <span className="ml-auto">60 days, start = 100</span>
          </div>
          <div className="h-28" role="img" aria-label={`${s.sector} sector against the Nifty 50 over 60 days`}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <YAxis width={34} domain={["dataMin - 1", "dataMax + 1"]} tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} tickFormatter={(v: number) => Math.round(v).toString()} />
                <Tooltip isAnimationActive={false} labelFormatter={() => ""} formatter={(v, n) => [Number(v).toFixed(1), n === "sector" ? s.sector : "Nifty 50"]}
                  contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                <Line dataKey="nifty" stroke="var(--muted-foreground)" strokeWidth={1.5} strokeDasharray="4 3" dot={false} isAnimationActive={false} />
                <Line dataKey="sector" stroke="var(--series-1)" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
      {s.leaders.length > 0 && (
        <p className="text-[12px] text-muted-foreground">
          Strongest in the sector: {s.leaders.map((l) => <StockSymbolChip key={l} symbol={l} className={l === symbol ? "ring-1 ring-primary" : ""} />)} · {s.buyPct}% rated BUY or better
        </p>
      )}
      <p className="text-[11px] text-muted-foreground">Based on {s.sourceLabel}. Score effect on this stock: {s.state === "Leading" ? "+3" : s.state === "Improving" ? "+1" : s.state === "Weakening" ? "−1" : "−3"}.</p>
    </section>
  );
}

/** Overview: every sector ranked. */
export function SectorStrengthCard({ sectors, onPick }: { sectors: SectorView[]; onPick?: (symbol: string) => void }) {
  if (!sectors.length) return null;
  const max = Math.max(...sectors.map((s) => Math.abs(s.relStrength)), 1);
  return (
    <section className="card overflow-hidden" aria-label="Sector strength">
      <header className="px-4 pb-2 pt-4">
        <h2 className="text-[15px] font-semibold">Sector Strength</h2>
        <p className="text-xs text-muted-foreground">State compares each sector with the Nifty 50 over 1 month; the rank also counts the 3-month return and breadth. Research Agent lifts stocks in leading sectors and marks down lagging ones.</p>
      </header>
      <div className="overflow-x-auto scroll-thin">
        <table className="w-full min-w-[640px] text-left text-[12.5px] tnum">
          <thead><tr className="border-y bg-muted/50 text-[10.5px] uppercase tracking-wider text-muted-foreground">
            {["#", "Sector", "State", "vs Nifty (1M)", "1M", "3M", "Breadth", "Buys", "Strongest"].map((h, i) => <th key={h} className={cn("whitespace-nowrap px-2 py-2 font-semibold first:pl-4", i >= 4 && i <= 7 && "text-right")}>{h}</th>)}
          </tr></thead>
          <tbody>
            {sectors.map((s) => (
              <tr key={s.sector} className="border-b last:border-0">
                <td className="px-2 py-2 pl-4 text-muted-foreground">{s.rank}</td>
                <td className="px-2 py-2 font-semibold">{s.sector}<div className="text-[10.5px] font-normal text-muted-foreground">{s.source === "index" ? s.sourceLabel.replace(/^the | index$/g, "") : `${s.members} stocks`}</div></td>
                <td className="px-2 py-2"><SectorStateTag state={s.state} /></td>
                <td className="px-2 py-2">
                  {/* diverging bar around zero */}
                  <span className="flex items-center gap-2">
                    <span className="relative h-2 w-24 rounded-full bg-muted">
                      <i className="absolute inset-y-[-2px] left-1/2 w-px bg-foreground/40" />
                      <span className={cn("absolute inset-y-0 rounded-full", s.relStrength >= 0 ? "left-1/2 bg-pos" : "right-1/2 bg-neg")} style={{ width: `${(Math.abs(s.relStrength) / max) * 50}%` }} />
                    </span>
                    <b className={s.relStrength >= 0 ? "text-pos" : "text-neg"}>{pct(s.relStrength)}</b>
                  </span>
                </td>
                <td className="px-2 py-2 text-right">{pct(s.ret1m)}</td>
                <td className="px-2 py-2 text-right">{pct(s.ret3m)}</td>
                <td className="px-2 py-2 text-right">{s.breadth}%</td>
                <td className="px-2 py-2 text-right">{s.buyPct}%</td>
                <td className="px-2 py-2">{s.leaders.slice(0, 2).map((l) => <StockSymbolChip key={l} symbol={l} />)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
