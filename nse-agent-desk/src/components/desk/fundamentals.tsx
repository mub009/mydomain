"use client";

import { inr, pct } from "@/lib/format";
import type { CapSize, Fundamentals } from "@/lib/types";
import { cn } from "@/lib/utils";

const CAP_STYLE: Record<CapSize, string> = {
  Large: "bg-[#e0e7ff] text-[#3730a3] dark:bg-[#272b5e] dark:text-[#c7d2fe]",
  Mid: "bg-[#ede9fe] text-[#5b21b6] dark:bg-[#33255a] dark:text-[#ddd6fe]",
  Small: "bg-[#fce7f3] text-[#9d174d] dark:bg-[#4a1d36] dark:text-[#fbcfe8]",
  "Too small": "bg-[var(--avoid-bg)] text-[var(--avoid-fg)]",
  Unknown: "bg-muted text-muted-foreground",
};

export function CapTag({ cap }: { cap: CapSize }) {
  return <span className={cn("whitespace-nowrap rounded-md px-1.5 py-px text-[10.5px] font-bold", CAP_STYLE[cap])}>{cap === "Unknown" || cap === "Too small" ? cap : `${cap} cap`}</span>;
}

export function EpsGrowth({ f, className }: { f?: Fundamentals; className?: string }) {
  if (!f) return <span className={cn("text-muted-foreground", className)}>–</span>;
  if (f.epsTTM !== undefined && f.epsTTM < 0) return <span className={cn("font-semibold text-neg", className)}>Loss</span>;
  if (f.epsGrowth1y === undefined) return <span className={cn("text-muted-foreground", className)}>n/a</span>;
  return <span className={cn("font-semibold", f.epsGrowth1y >= 0 ? "text-pos" : "text-neg", className)}>{pct(f.epsGrowth1y)}</span>;
}

/** Drawer section: market cap, size band and EPS over the last year. */
export function FundamentalsCard({ f }: { f: Fundamentals }) {
  const max = Math.max(...f.epsHistory.map((h) => Math.abs(h.eps)), 1);
  return (
    <section className="space-y-3 rounded-xl border p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[13px] font-semibold">Earnings &amp; size</h3>
        <CapTag cap={f.cap} />
      </div>
      <dl className="grid grid-cols-3 gap-2 text-center tnum">
        <div className="rounded-lg bg-muted/60 px-1 py-1.5"><dt className="text-[10.5px] text-muted-foreground">Market cap</dt>
          <dd className="text-[13px] font-semibold">{f.marketCapCr !== undefined ? `${inr(f.marketCapCr, 0)} Cr` : "–"}</dd></div>
        <div className="rounded-lg bg-muted/60 px-1 py-1.5"><dt className="text-[10.5px] text-muted-foreground">EPS {f.epsBasis === "FY" ? "latest FY" : "last 12 mo"}</dt>
          <dd className="text-[13px] font-semibold">{f.epsTTM !== undefined ? inr(f.epsTTM) : "–"}</dd></div>
        <div className="rounded-lg bg-muted/60 px-1 py-1.5"><dt className="text-[10.5px] text-muted-foreground">EPS growth 1Y</dt>
          <dd className="text-[13px]"><EpsGrowth f={f} /></dd></div>
      </dl>
      {f.epsHistory.length > 1 && (
        <div>
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">EPS by period</div>
          <ul className="space-y-1">
            {f.epsHistory.map((h) => (
              <li key={h.period} className="grid grid-cols-[56px_1fr_72px] items-center gap-2 text-[11.5px] tnum">
                <span className="text-muted-foreground">{h.period}</span>
                <span className="h-2 overflow-hidden rounded-full bg-muted">
                  <span className={cn("block h-full rounded-full", h.eps >= 0 ? "bg-primary" : "bg-neg")} style={{ width: `${(Math.abs(h.eps) / max) * 100}%` }} />
                </span>
                <span className="text-right font-medium">{inr(h.eps)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">
        Source: {f.source}. {f.epsYearAgo !== undefined && `A year earlier EPS was ${inr(f.epsYearAgo)}. `}
        Size bands are approximate: Large ≥ ₹1,00,000 Cr, Mid ≥ ₹30,000 Cr, Small ≥ ₹300 Cr.
      </p>
    </section>
  );
}
