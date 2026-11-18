"use client";

import { CartesianGrid, LabelList, ReferenceArea, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";
import type { Decision } from "@/lib/types";
import { RiskTag, VerdictBadge } from "./primitives";

type Group = "pick" | "watch" | "other";
type Point = Decision & { group: Group };

function Tip({ active, payload }: { active?: boolean; payload?: { payload: Point }[] }) {
  const d = active && payload?.[0]?.payload;
  if (!d) return null;
  return (
    <div className="card min-w-44 px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 flex items-center justify-between gap-3">
        <b className="text-sm">{d.symbol}</b><VerdictBadge verdict={d.verdict} />
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 tnum text-muted-foreground">
        <dt>Momentum Agent</dt><dd className="text-right font-semibold text-foreground">{d.lotappi.toFixed(1)}</dd>
        <dt>Trend Agent</dt><dd className="text-right font-semibold text-foreground">{d.mayavi.toFixed(1)}</dd>
        <dt>Combined</dt><dd className="text-right font-semibold text-foreground">{d.combined.toFixed(1)}</dd>
        <dt>Risk</dt><dd className="text-right"><RiskTag risk={d.risk} /></dd>
        <dt>Sector</dt><dd className="text-right text-foreground">{d.sector}</dd>
      </dl>
      {d.group === "pick" && <div className="mt-1 font-semibold text-pos">Final pick</div>}
      {d.passedOver && <div className="mt-1 text-[var(--watch-fg)]">{d.passedOver}</div>}
    </div>
  );
}

/** AgentAgreementScatter: Momentum Agent score (x) against Trend Agent score (y). */
export function AgentAgreementScatter({ rows, picks, watch, onSelect, height = 340 }: {
  rows: Decision[]; picks: string[]; watch: string[]; onSelect?: (symbol: string) => void; height?: number;
}) {
  const groupOf = (s: string): Group => (picks.includes(s) ? "pick" : watch.includes(s) ? "watch" : "other");
  const pts: Point[] = rows.map((d) => ({ ...d, group: groupOf(d.symbol) }));
  const by = (g: Group) => pts.filter((p) => p.group === g);
  const click = (p: unknown) => onSelect?.((p as Point).symbol);
  const axis = { type: "number" as const, domain: [0, 100], ticks: [0, 20, 40, 60, 80, 100], tickLine: false, axisLine: false,
    tick: { fill: "var(--muted-foreground)", fontSize: 11 } };

  return (
    <div>
      <div className="mb-1 flex flex-wrap gap-x-4 gap-y-1 px-1 text-xs text-muted-foreground">
        {[["Final picks", "var(--pick)"], ["Watchlist", "var(--watch-dot)"], ["Other stocks", "var(--other-dot)"]].map(([l, c]) => (
          <span key={l} className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-full" style={{ background: c }} />{l}</span>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <ScatterChart margin={{ top: 12, right: 16, bottom: 22, left: 4 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="0" />
          <ReferenceArea x1={60} x2={100} y1={60} y2={100} fill="var(--agree-zone)" fillOpacity={0.1} stroke="var(--agree-zone)" strokeOpacity={0.35} strokeDasharray="4 4"
            label={{ value: "Both Agree Zone", position: "insideBottomRight", fill: "var(--pos)", fontSize: 11, fontWeight: 600, offset: 8 }} />
          <XAxis dataKey="lotappi" name="Momentum Agent score" {...axis}
            label={{ value: "Momentum Agent Score · short-term", position: "insideBottom", offset: -12, fill: "var(--muted-foreground)", fontSize: 11.5, fontWeight: 500 }} />
          <YAxis dataKey="mayavi" name="Trend Agent score" width={44} {...axis}
            label={{ value: "Trend Agent Score · 1-month", angle: -90, position: "insideLeft", offset: 12, fill: "var(--muted-foreground)", fontSize: 11.5, fontWeight: 500, style: { textAnchor: "middle" } }} />
          <Tooltip content={<Tip />} cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }} isAnimationActive={false} />
          <Scatter name="Other stocks" data={by("other")} fill="var(--other-dot)" stroke="var(--card)" strokeWidth={1.5} onClick={click} isAnimationActive={false} className="cursor-pointer" />
          <Scatter name="Watchlist" data={by("watch")} fill="var(--watch-dot)" stroke="var(--card)" strokeWidth={1.5} onClick={click} isAnimationActive={false} className="cursor-pointer" />
          <Scatter name="Final picks" data={by("pick")} fill="var(--pick)" stroke="var(--card)" strokeWidth={2} onClick={click} isAnimationActive={false} className="cursor-pointer"
            shape={(p: { cx?: number; cy?: number }) => <circle cx={p.cx} cy={p.cy} r={7} fill="var(--pick)" stroke="var(--card)" strokeWidth={2} />}>
            {/* labels alternate sides so neighbouring picks don't overlap */}
            <LabelList dataKey="symbol" content={(p) => {
              const cx = Number(p.x) + Number(p.width) / 2, cy = Number(p.y) + Number(p.height) / 2;
              const [dx, dy, anchor] = ([[-11, 4, "end"], [11, 4, "start"], [0, -12, "middle"], [0, 19, "middle"]] as const)[(p.index ?? 0) % 4];
              return (
                <text x={cx + dx} y={cy + dy} textAnchor={anchor} className="max-sm:hidden" fill="var(--foreground)" fontSize={10.5} fontWeight={600}
                  style={{ paintOrder: "stroke", stroke: "var(--card)", strokeWidth: 3 }}>{String(p.value)}</text>
              );
            }} />
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
