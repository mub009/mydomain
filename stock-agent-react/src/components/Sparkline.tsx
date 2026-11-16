/** 60-day closing-price sparkline (one series, no axes). */
export function Sparkline({ data, width = 96, height = 28 }: { data: number[]; width?: number; height?: number }) {
  if (data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data), span = max - min || 1;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * (width - 4) + 2, height - 3 - ((v - min) / span) * (height - 6)]);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join("");
  const [lx, ly] = pts[pts.length - 1];
  const chg = (data[data.length - 1] / data[0] - 1) * 100;
  return (
    <span className="spark">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img"
        aria-label={`60-day price trend ${chg >= 0 ? "up" : "down"} ${Math.abs(chg).toFixed(1)}%`}>
        <path d={d} fill="none" stroke="var(--series-1)" strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={lx} cy={ly} r={2.5} fill="var(--series-1)" />
      </svg>
      <span className={chg >= 0 ? "pos" : "neg"}>{chg >= 0 ? "+" : ""}{chg.toFixed(1)}%</span>
    </span>
  );
}
