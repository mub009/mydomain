"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Segmented } from "@/components/ui/segmented";
import type { Forecast } from "@/lib/forecast";
import { inr, pct } from "@/lib/format";
import type { Decision } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useDesk, useStockResult } from "@/store/desk";
import { AgentAvatar } from "./agent-avatar";

const cache = new Map<string, Forecast>();

function Tip({ active, payload }: { active?: boolean; payload?: { payload: Forecast["points"][number] }[] }) {
  const p = active && payload?.[0]?.payload;
  if (!p) return null;
  return (
    <div className="card px-3 py-2 text-xs tnum shadow-lg">
      <div className="mb-0.5 font-semibold">{p.t < 0 ? `${-p.t} days ago` : p.t === 0 ? "Today" : `In ${p.t} trading day${p.t === 1 ? "" : "s"}`}</div>
      {p.close !== undefined && p.t <= 0 && <div>Close {inr(p.close)}</div>}
      {p.t > 0 && <>
        <div>Middle path {inr(p.p50!)}</div>
        <div className="text-muted-foreground">50% range {inr(p.p25!)} – {inr(p.p75!)}</div>
        <div className="text-muted-foreground">80% range {inr(p.p10!)} – {inr(p.p90!)}</div>
      </>}
    </div>
  );
}

export function ForecastTab({ d }: { d: Decision }) {
  const result = useStockResult();
  const demo = result?.source.kind === "demo", seed = result?.source.seed ?? 0;
  const [horizon, setHorizon] = useState<10 | 21>(d.horizon.startsWith("Swing ·") ? 10 : 21);
  const key = `${d.symbol}:${horizon}:${demo}:${seed}:${d.stopLoss}:${d.target}`;
  const [f, setF] = useState<Forecast | null>(cache.get(key) ?? null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (cache.has(key)) { setF(cache.get(key)!); return; }
    setF(null); setErr(null);
    let alive = true;
    const q = new URLSearchParams({ symbol: d.symbol, horizon: String(horizon), stop: String(d.stopLoss), target: String(d.target), demo: demo ? "1" : "0", seed: String(seed) });
    fetch(`/api/forecast?${q}`).then(async (r) => (r.ok ? r.json() : Promise.reject(new Error((await r.json().catch(() => null))?.error ?? `Error ${r.status}`))))
      .then((j: Forecast) => { cache.set(key, j); if (alive) setF(j); })
      .catch((e) => alive && setErr(e.message));
    return () => { alive = false; };
  }, [key, d.symbol, d.stopLoss, d.target, horizon, demo, seed]);

  const data = f?.points.map((p) => ({ ...p, band80: p.p10 !== undefined ? [p.p10, p.p90] : undefined, band50: p.p25 !== undefined ? [p.p25, p.p75] : undefined }));
  const lo = f ? Math.min(...f.points.map((p) => p.p10 ?? p.close ?? Infinity), d.stopLoss) : 0;
  const hi = f ? Math.max(...f.points.map((p) => p.p90 ?? p.close ?? 0), d.target) : 0;
  const cal = f?.calibration;

  return (
    <div className="space-y-4 px-5 pb-6">
      {demo && <p className="rounded-lg border border-warn-border bg-warn-bg px-3 py-2 text-[12px] text-warn-fg"><b>Demo prices.</b> The forecast uses the fictional demo price history.</p>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[13px] font-semibold">Likely price range</h3>
        <Segmented<10 | 21> label="Forecast horizon" value={horizon} onChange={setHorizon} options={[{ value: 10, label: "Next 10 days" }, { value: 21, label: "Next 1 month" }]} />
      </div>

      {err ? <p className="text-sm text-neg">Could not build the forecast: {err}</p>
        : !f || !data ? <p className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Simulating 2,000 price paths…</p>
        : (
          <>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><i className="h-0.5 w-3 rounded bg-foreground" />Price so far</span>
              <span className="inline-flex items-center gap-1.5"><i className="h-0.5 w-3 rounded border-t-2 border-dashed border-[var(--series-1)]" />Middle path</span>
              <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-[var(--series-1)] opacity-40" />50% range</span>
              <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-[var(--series-1)] opacity-15" />80% range</span>
            </div>
            <div className="h-64" role="img" aria-label={`Price history and the likely range for the next ${horizon} trading days`}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="t" type="number" domain={["dataMin", "dataMax"]} tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                    ticks={[-60, -40, -20, 0, horizon]} tickFormatter={(t: number) => (t === 0 ? "Today" : t < 0 ? `${t}d` : `+${t}d`)} />
                  <YAxis domain={[Math.floor(lo * 0.98), Math.ceil(hi * 1.02)]} width={60} tickLine={false} axisLine={false}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} tickFormatter={(v: number) => `₹${Math.round(v).toLocaleString("en-IN")}`} />
                  <Tooltip content={<Tip />} isAnimationActive={false} />
                  <Area dataKey="band80" stroke="none" fill="var(--series-1)" fillOpacity={0.14} isAnimationActive={false} connectNulls={false} />
                  <Area dataKey="band50" stroke="none" fill="var(--series-1)" fillOpacity={0.3} isAnimationActive={false} connectNulls={false} />
                  <Line dataKey="close" stroke="var(--foreground)" strokeWidth={1.75} dot={false} isAnimationActive={false} connectNulls={false} />
                  <Line dataKey="p50" stroke="var(--series-1)" strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} connectNulls={false} />
                  <ReferenceLine x={0} stroke="var(--muted-foreground)" strokeDasharray="2 3" />
                  <ReferenceLine y={d.target} stroke="var(--pos)" strokeDasharray="4 3" label={{ value: `Target ${inr(d.target, 0)}`, position: "insideTopLeft", fill: "var(--pos)", fontSize: 10, fontWeight: 600 }} />
                  <ReferenceLine y={d.entry} stroke="var(--muted-foreground)" strokeDasharray="4 3" label={{ value: `Entry ${inr(d.entry, 0)}`, position: "insideBottomLeft", fill: "var(--muted-foreground)", fontSize: 10 }} />
                  <ReferenceLine y={d.stopLoss} stroke="var(--neg)" strokeDasharray="4 3" label={{ value: `Stop-loss ${inr(d.stopLoss, 0)}`, position: "insideBottomLeft", fill: "var(--neg)", fontSize: 10, fontWeight: 600 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <dl className="grid grid-cols-3 gap-2 text-center tnum">
              {[["Reaches target first", f.probTarget, "text-pos"], ["Hits stop-loss first", f.probStop, "text-neg"], ["Neither, in time", f.probNeither, "text-foreground"]].map(([l, v, c]) => (
                <div key={l as string} className="rounded-xl border p-2">
                  <dt className="text-[11px] text-muted-foreground">{l}</dt>
                  <dd className={cn("text-lg font-bold", c as string)}>{(v as number).toFixed(0)}%</dd>
                </div>
              ))}
            </dl>

            <div className="flex gap-2.5 rounded-lg bg-muted/50 p-2.5 text-[12.5px] leading-relaxed">
              <AgentAvatar who="Research" size={28} />
              <p>
                <b className="text-[#14B8A6]">Research Agent:</b> In {horizon === 10 ? "10 trading days" : "a month"}, the middle path ends near <b>{inr(f.median)}</b> ({pct((f.median / f.last - 1) * 100)}),
                and 8 in 10 simulated outcomes end between <b>{inr(f.range80[0])}</b> and <b>{inr(f.range80[1])}</b>. The price ended higher than today in {f.probUp.toFixed(0)}% of them.
                {f.probTarget > f.probStop * 1.3 ? " The odds favour the target over the stop." : f.probStop > f.probTarget * 1.3 ? " The stop is more likely to be hit than the target in this time; consider waiting for the buy zone." : " Target and stop are about equally likely in this time."}
              </p>
            </div>

            {cal && (
              <p className={cn("rounded-lg px-3 py-2 text-[12px]", Math.abs(cal.coverage - 80) <= 10 ? "bg-[var(--buy-bg)] text-[var(--buy-fg)]" : "bg-[var(--watch-bg)] text-[var(--watch-fg)]")}>
                <b>Track record:</b> over the past year, this stock’s 80% range held the real price {cal.coverage}% of the time ({cal.checks} checks).
                {Math.abs(cal.coverage - 80) <= 10 ? " The ranges have been reliable for it." : cal.coverage < 80 ? " Its moves have been bigger than expected, so treat the range as too narrow." : " Its moves have been smaller than expected, so the range may be too wide."}
              </p>
            )}

            <p className="text-[11px] leading-relaxed text-muted-foreground">
              How it works: 2,000 possible paths built by re-sampling this stock’s own daily moves from the past year, scaled to its recent volatility
              ({f.dailyVol.toFixed(2)}% a day), with half its past average trend ({f.drift >= 0 ? "+" : ""}{f.drift.toFixed(2)}% a day). It shows what has been
              normal for this stock, not what will happen: news, results and market shocks can push the price outside the range.
            </p>
          </>
        )}
    </div>
  );
}
