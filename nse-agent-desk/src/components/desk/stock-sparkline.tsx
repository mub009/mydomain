"use client";

import { Line, LineChart, YAxis } from "recharts";
import { pct } from "@/lib/format";
import { cn } from "@/lib/utils";

/** StockSparkline: 60-day closing prices with the period change beside it. */
export function StockSparkline({ data, width = 88, height = 28, showChange = true }: {
  data: number[]; width?: number; height?: number; showChange?: boolean;
}) {
  if (data.length < 2) return null;
  const change = (data[data.length - 1] / data[0] - 1) * 100;
  const up = change >= 0;
  const points = data.map((v, i) => ({ i, v }));
  return (
    <span className="inline-flex items-center gap-2" role="img" aria-label={`60-day trend ${up ? "up" : "down"} ${Math.abs(change).toFixed(1)}%`}>
      <LineChart width={width} height={height} data={points} margin={{ top: 3, right: 3, bottom: 3, left: 3 }} accessibilityLayer={false}>
        <YAxis hide domain={["dataMin", "dataMax"]} />
        <Line type="monotone" dataKey="v" stroke={up ? "var(--pos)" : "var(--neg)"} strokeWidth={1.75} dot={false} isAnimationActive={false} />
      </LineChart>
      {showChange && <span className={cn("w-12 text-xs font-semibold tnum", up ? "text-pos" : "text-neg")}>{pct(change)}</span>}
    </span>
  );
}
