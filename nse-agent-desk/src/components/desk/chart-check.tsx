"use client";

import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { inr, pct } from "@/lib/format";
import type { BuyZone, ChartAnalysis, Trend } from "@/lib/types";
import { cn } from "@/lib/utils";

const TREND_STYLE: Record<Trend, string> = {
  Bullish: "bg-[var(--buy-bg)] text-[var(--buy-fg)]",
  Bearish: "bg-[var(--avoid-bg)] text-[var(--avoid-fg)]",
  Neutral: "bg-muted text-muted-foreground",
};
const TREND_ICON = { Bullish: ArrowUpRight, Bearish: ArrowDownRight, Neutral: Minus };

/** Trend tag with icon + text, so it never relies on colour alone. */
export function TrendTag({ trend, compact }: { trend: Trend; compact?: boolean }) {
  const Icon = TREND_ICON[trend];
  return (
    <span className={cn("inline-flex items-center gap-0.5 rounded-md px-1.5 py-px text-[10.5px] font-bold", TREND_STYLE[trend])}>
      <Icon className="size-3" aria-hidden />{compact ? trend.slice(0, 4) : trend}
    </span>
  );
}

const PLAN_STYLE: Record<BuyZone["plan"], string> = {
  "In buy zone": "bg-[var(--strong-bg)] text-[var(--strong-fg)]",
  "Wait for dip": "bg-[var(--watch-bg)] text-[var(--watch-fg)]",
  Extended: "bg-[var(--avoid-bg)] text-[var(--avoid-fg)]",
};

export function PlanTag({ zone }: { zone: BuyZone | null | undefined }) {
  if (!zone) return <span className="text-[11px] text-muted-foreground">No zone</span>;
  return <span className={cn("whitespace-nowrap rounded-md px-1.5 py-px text-[10.5px] font-bold", PLAN_STYLE[zone.plan])}>{zone.plan}</span>;
}

/** Five small dots, one per timeframe, for tight table cells. */
export function TimeframeDots({ chart }: { chart: ChartAnalysis }) {
  return (
    <span className="inline-flex items-center gap-1" role="img"
      aria-label={chart.timeframes.map((t) => `${t.tf} ${t.trend}`).join(", ")}
      title={chart.timeframes.map((t) => `${t.tf}: ${t.trend}`).join("  ·  ")}>
      {chart.timeframes.map((t) => (
        <span key={t.tf} className="flex flex-col items-center gap-0.5">
          <i className={cn("size-2 rounded-full", t.trend === "Bullish" ? "bg-[var(--pick)]" : t.trend === "Bearish" ? "bg-neg" : "bg-[var(--other-dot)]")} />
          <span className="text-[8.5px] font-semibold leading-none text-muted-foreground">{t.tf}</span>
        </span>
      ))}
    </span>
  );
}

/** Drawer section: Research Agent's chart check and best buy area. */
export function ChartCheck({ chart, price }: { chart: ChartAnalysis; price: number }) {
  const z = chart.zone;
  const data = chart.closes.map((v, i) => ({ i, v }));
  const lo = Math.min(...chart.closes, z?.stop ?? Infinity), hi = Math.max(...chart.closes);
  return (
    <section className="space-y-3 rounded-xl border p-3">
      <h3 className="text-[13px] font-semibold">Chart check · 5 timeframes</h3>
      <div className="grid grid-cols-5 gap-1.5">
        {chart.timeframes.map((t) => (
          <div key={t.tf} className="rounded-lg bg-muted/60 px-1 py-1.5 text-center" title={t.note}>
            <div className="text-[11px] font-bold">{t.tf}</div>
            <div className="my-0.5"><TrendTag trend={t.trend} compact /></div>
            <div className="text-[10.5px] text-muted-foreground tnum">{t.bars ? `RSI ${t.rsi.toFixed(0)}` : "no data"}</div>
          </div>
        ))}
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between gap-2">
          <h3 className="text-[13px] font-semibold">Best buy area</h3><PlanTag zone={z} />
        </div>
        {z ? (
          <>
            <p className="text-[12.5px]">
              <b className="tnum">{inr(z.low)} – {inr(z.high)}</b>
              <span className="text-muted-foreground"> · {z.distancePct > 0 ? `price is ${z.distancePct.toFixed(1)}% above` : "price is inside"} · stop under zone {inr(z.stop)}</span>
            </p>
            <div className="mt-2 h-36" role="img" aria-label={`Last 6 months of prices with the buy area ${inr(z.low)} to ${inr(z.high)} shaded`}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="i" hide />
                  <YAxis domain={[Math.floor(lo * 0.98), Math.ceil(hi * 1.01)]} width={52} tickLine={false} axisLine={false}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} tickFormatter={(v: number) => `₹${Math.round(v).toLocaleString("en-IN")}`} />
                  <ReferenceArea y1={z.low} y2={z.high} fill="var(--pick)" fillOpacity={0.16} stroke="var(--pick)" strokeOpacity={0.5} strokeDasharray="3 3"
                    label={{ value: "Buy zone", position: "insideBottomLeft", fill: "var(--pos)", fontSize: 10, fontWeight: 600 }} />
                  <ReferenceLine y={z.stop} stroke="var(--neg)" strokeDasharray="4 3" label={{ value: "Stop", position: "insideTopLeft", fill: "var(--neg)", fontSize: 10 }} />
                  <Tooltip isAnimationActive={false} formatter={(v) => [inr(Number(v)), "Close"]} labelFormatter={() => ""} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                  <Line type="monotone" dataKey="v" stroke="var(--primary)" strokeWidth={1.75} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <ul className="mt-1 list-disc pl-4 text-[11.5px] text-muted-foreground">{z.basis.slice(0, 4).map((b) => <li key={b}>{b}</li>)}</ul>
          </>
        ) : <p className="text-[12.5px] text-muted-foreground">Price {inr(price)} is below every recent support level, so there is no buy area to trust yet.</p>}
      </div>

      <div className="overflow-x-auto scroll-thin">
        <table className="w-full text-left text-[11.5px] tnum">
          <thead><tr className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {["History", "Low", "High", "Most traded", "Support", "Change"].map((h, i) => <th key={h} className={cn("py-1 font-semibold", i > 0 && "text-right")}>{h}</th>)}
          </tr></thead>
          <tbody>
            {chart.history.map((h) => (
              <tr key={h.label} className="border-t">
                <td className="py-1 font-semibold">{h.label}</td>
                <td className="py-1 text-right">{inr(h.low, 0)}</td>
                <td className="py-1 text-right">{inr(h.high, 0)}</td>
                <td className="py-1 text-right">{inr(h.poc, 0)}</td>
                <td className="py-1 text-right">{h.support !== undefined ? inr(h.support, 0) : "–"}</td>
                <td className={cn("py-1 text-right font-medium", h.change >= 0 ? "text-pos" : "text-neg")}>{pct(h.change)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!chart.intraday && <p className="text-[11px] text-muted-foreground">Intraday candles were not available, so 4H, 1H and 30m are not rated.</p>}
    </section>
  );
}
