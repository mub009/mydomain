"use client";

/** Small shared pieces for stock lists: current price, copy the symbol, open in TradingView, buy-zone filter. */
import { Check, Copy, ExternalLink } from "lucide-react";
import { useState } from "react";
import { inr, pct } from "@/lib/format";
import { tradingViewUrl, type Quote } from "@/lib/market/quotes";
import type { Decision } from "@/lib/types";
import { currentPrice, matchesZone, ZONE_FILTERS, TOP_N, type ZoneFilter } from "@/lib/stock-view";
export { currentPrice, lastClose, matchesZone, ZONE_FILTERS, TOP_N, type ZoneFilter } from "@/lib/stock-view";
import { cn } from "@/lib/utils";
import { useQuoteStore } from "@/store/quotes";

export function PriceCell({ d, q, className, align = "right" }: { d: Pick<Decision, "spark" | "entry" | "symbol">; q?: Quote; className?: string; align?: "left" | "right" }) {
  const p = currentPrice(d, q);
  const time = q ? new Date(q.at).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" }) : null;
  return (
    <div className={cn("tnum", align === "right" && "text-right", className)}
      title={p.live ? `Current price at ${time} IST (delayed)` : "Last close in this analysis"}>
      <div className="whitespace-nowrap font-semibold">{inr(p.price)}</div>
      {p.changePct !== undefined && <div className={cn("whitespace-nowrap text-[11px] font-medium", p.changePct >= 0 ? "text-pos" : "text-neg")}>{pct(p.changePct)}</div>}
    </div>
  );
}

/** Copies the stock's NSE symbol; never opens the row it sits in. */
export function CopySymbol({ symbol, className, size = "sm" }: { symbol: string; className?: string; size?: "sm" | "md" }) {
  const [done, setDone] = useState(false);
  async function copy(e: React.MouseEvent | React.KeyboardEvent) {
    e.stopPropagation(); e.preventDefault();
    try { await navigator.clipboard.writeText(symbol); }
    catch {
      const t = document.createElement("textarea"); t.value = symbol; document.body.appendChild(t); t.select();
      try { document.execCommand("copy"); } finally { t.remove(); }
    }
    setDone(true); setTimeout(() => setDone(false), 1500);
  }
  const Icon = done ? Check : Copy;
  return (
    <span role="button" tabIndex={0} onClick={copy} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && copy(e)}
      aria-label={done ? `${symbol} copied` : `Copy ${symbol}`} title={done ? "Copied" : `Copy ${symbol}`}
      className={cn("inline-grid shrink-0 cursor-pointer place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground",
        size === "sm" ? "size-6" : "size-8", done && "text-pos", className)}>
      <Icon className={size === "sm" ? "size-3.5" : "size-4"} />
    </span>
  );
}

/** Opens the stock's TradingView chart in a new tab. */
export function TradingViewLink({ symbol, className, compact }: { symbol: string; className?: string; compact?: boolean }) {
  return (
    <a href={tradingViewUrl(symbol)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
      title={`Open ${symbol} in TradingView (new tab)`} aria-label={`Open ${symbol} in TradingView, new tab`}
      className={cn("btn-3d inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold", className)}>
      <ExternalLink className="size-4" />{compact ? <span className="max-sm:hidden">TradingView</span> : "TradingView"}
    </a>
  );
}

/** Chips for the buy-zone filter (with counts) and a "show top N" picker. */
export function ZoneAndTopFilter({ items, zone, onZone, top, onTop, className }: {
  items: Pick<Decision, "chart">[]; zone: ZoneFilter; onZone: (z: ZoneFilter) => void; top: number; onTop: (n: number) => void; className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <div role="group" aria-label="Filter by buy zone" className="flex flex-wrap gap-1.5">
        {ZONE_FILTERS.map(({ value, label }) => {
          const n = items.filter((d) => matchesZone(d, value)).length;
          return (
            <button key={value} type="button" onClick={() => onZone(value)} aria-pressed={zone === value}
              className={cn("rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                zone === value ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground")}>
              {label} <span className="tnum opacity-75">{n}</span>
            </button>
          );
        })}
      </div>
      <label className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
        Show
        <select value={top} onChange={(e) => onTop(Number(e.target.value))} aria-label="Show top N stocks"
          className="well h-8 rounded-lg border-0 px-2 text-xs font-semibold text-foreground">
          {TOP_N.map((n) => <option key={n} value={n}>{n ? `Top ${n}` : "All"}</option>)}
        </select>
      </label>
    </div>
  );
}

/** PriceCell that reads the shared quotes store (for table cells defined outside a component). */
export function LivePriceCell({ d, align }: { d: Pick<Decision, "spark" | "entry" | "symbol">; align?: "left" | "right" }) {
  const q = useQuoteStore((s) => s.quotes[d.symbol]);
  return <PriceCell d={d} q={q} align={align} />;
}
