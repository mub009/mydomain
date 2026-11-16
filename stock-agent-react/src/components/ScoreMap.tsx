import { useState } from "react";
import type { Decision } from "../lib/types";
import { VerdictBadge } from "./ui";

/**
 * Scatter: Lotappi's short-term score (x) vs Mayavi's 1-month score (y).
 * The top-right quadrant (both >= 60) is where the two agents agree.
 */
const W = 520, H = 340, P = { l: 40, r: 16, t: 14, b: 36 };
const sx = (v: number) => P.l + (v / 100) * (W - P.l - P.r);
const sy = (v: number) => H - P.b - (v / 100) * (H - P.t - P.b);

type Group = "pick" | "watch" | "other";

export function ScoreMap({ rows, picks, watch }: { rows: Decision[]; picks: Set<string>; watch: Set<string> }) {
  const [hover, setHover] = useState<Decision | null>(null);
  const group = (d: Decision): Group => (picks.has(d.symbol) ? "pick" : watch.has(d.symbol) ? "watch" : "other");
  const order: Group[] = ["other", "watch", "pick"]; // picks drawn last, on top
  const sorted = [...rows].sort((a, b) => order.indexOf(group(a)) - order.indexOf(group(b)));

  return (
    <div className="chart">
      <div className="legend">
        <span><i className="sw g-pick" />Final pick</span>
        <span><i className="sw g-watch" />Watchlist</span>
        <span><i className="sw g-other" />Other</span>
      </div>
      <div className="chart-box">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Lotappi score versus Mayavi score for each stock">
          {[0, 20, 40, 60, 80, 100].map((v) => (
            <g key={v}>
              <line x1={sx(0)} x2={sx(100)} y1={sy(v)} y2={sy(v)} className="grid" />
              <text x={P.l - 8} y={sy(v) + 4} className="tick" textAnchor="end">{v}</text>
              <text x={sx(v)} y={H - P.b + 16} className="tick" textAnchor="middle">{v}</text>
            </g>
          ))}
          <rect x={sx(60)} y={sy(100)} width={sx(100) - sx(60)} height={sy(60) - sy(100)} className="agree-zone" />
          <text x={sx(98)} y={sy(97)} className="zone-label" textAnchor="end">Both agree</text>
          <text x={(sx(0) + sx(100)) / 2} y={H - 4} className="axis-label" textAnchor="middle">Lotappi · short-term score</text>
          <text x={12} y={(sy(0) + sy(100)) / 2} className="axis-label" textAnchor="middle" transform={`rotate(-90 12 ${(sy(0) + sy(100)) / 2})`}>Mayavi · 1-month score</text>
          {sorted.map((d) => {
            const g = group(d);
            return (
              <g key={d.symbol} onMouseEnter={() => setHover(d)} onMouseLeave={() => setHover(null)}>
                <circle cx={sx(d.lotappi)} cy={sy(d.mayavi)} r={12} fill="transparent" />
                <circle cx={sx(d.lotappi)} cy={sy(d.mayavi)} r={g === "pick" ? 6 : 4.5}
                  className={`dot g-${g} ${hover?.symbol === d.symbol ? "hot" : ""}`} />
                {g === "pick" && (
                  <text x={sx(d.lotappi) - 9} y={sy(d.mayavi) + 4} className="dot-label" textAnchor="end">{d.symbol}</text>
                )}
              </g>
            );
          })}
        </svg>
        {hover && (
          <div className="tip" style={{ left: `${(sx(hover.lotappi) / W) * 100}%`, top: `${(sy(hover.mayavi) / H) * 100}%` }}>
            <div className="tip-head"><b>{hover.symbol}</b><VerdictBadge v={hover.verdict} /></div>
            <div>Lotappi <b>{hover.lotappi}</b> · Mayavi <b>{hover.mayavi}</b></div>
            <div>Combined <b>{hover.combined}</b> · Risk <b>{hover.risk.toLowerCase()}</b></div>
          </div>
        )}
      </div>
    </div>
  );
}
