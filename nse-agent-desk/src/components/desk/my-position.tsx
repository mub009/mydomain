"use client";

/** "My position": your holding in this stock, the decision for you, and how to improve it. */
import { ArrowDownToLine, CircleCheck, CircleMinus, CircleX, Gem, Info, Layers, PieChart, Scissors, ShieldCheck } from "lucide-react";
import { exitAdvice, type ExitAction } from "@/lib/exit-check";
import { inr, pct } from "@/lib/format";
import { improveStock, type TipKind } from "@/lib/improve";
import { LONG_TERM_LABEL } from "@/lib/long-term";
import type { Decision } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useAllHoldings } from "@/store/holdings";

const SHORT: Record<ExitAction, { cls: string; Icon: typeof CircleX; text: string }> = {
  SELL: { cls: "bg-neg/12 text-neg", Icon: CircleX, text: "Sell" },
  "BOOK PROFIT": { cls: "bg-amber-500/12 text-amber-700 dark:text-amber-400", Icon: CircleMinus, text: "Book profit" },
  HOLD: { cls: "bg-pos/12 text-pos", Icon: CircleCheck, text: "Hold" },
};
const LONG = { ACCUMULATE: "bg-pos/12 text-pos", HOLD: "bg-sky-500/12 text-sky-700 dark:text-sky-400", REDUCE: "bg-amber-500/12 text-amber-700 dark:text-amber-400", EXIT: "bg-neg/12 text-neg" } as const;
export const TIP_ICON: Record<TipKind, { Icon: typeof Info; cls: string }> = {
  act: { Icon: CircleX, cls: "text-neg" }, add: { Icon: ArrowDownToLine, cls: "text-pos" }, trim: { Icon: Scissors, cls: "text-amber-600" },
  protect: { Icon: ShieldCheck, cls: "text-primary" }, commodity: { Icon: Gem, cls: "text-yellow-600" }, diversify: { Icon: PieChart, cls: "text-sky-600" }, info: { Icon: Info, cls: "text-muted-foreground" },
};

/** Is this stock in your holdings? */
export function useHolding(symbol?: string) {
  const { merged, invested } = useAllHoldings();
  const h = symbol ? merged.get(symbol) : undefined;
  return h ? { ...h, weightPct: invested ? (h.qty * h.avgPrice / invested) * 100 : undefined } : undefined;
}

export function MyPositionCard({ d, price }: { d: Decision; price?: number }) {
  const h = useHolding(d.symbol);
  if (!h) return null;
  const a = exitAdvice(d, h, price ?? d.entry);
  const tips = improveStock(d, a, h.weightPct);
  const S = SHORT[a.action];
  return (
    <section className="rounded-xl border-2 border-primary/30 bg-primary-soft/30 p-3" aria-label="My position">
      <div className="flex flex-wrap items-center gap-2">
        <Layers className="size-4 text-primary" />
        <h3 className="text-[13.5px] font-bold">My position</h3>
        <span className="text-[11.5px] text-muted-foreground">{h.sources.join(", ")}</span>
      </div>
      <dl className="mt-2.5 grid grid-cols-3 gap-2 text-center tnum">
        <div className="rounded-lg bg-card px-1 py-1.5"><dt className="text-[10.5px] text-muted-foreground">Holding</dt><dd className="text-[13px] font-bold">{h.qty} × {inr(h.avgPrice)}</dd><dd className="text-[10.5px] text-muted-foreground">{inr(h.qty * h.avgPrice, 0)} invested</dd></div>
        <div className="rounded-lg bg-card px-1 py-1.5"><dt className="text-[10.5px] text-muted-foreground">Now</dt><dd className="text-[13px] font-bold">{inr(a.price)}</dd><dd className="text-[10.5px] text-muted-foreground">{inr(h.qty * a.price, 0)} value</dd></div>
        <div className="rounded-lg bg-card px-1 py-1.5"><dt className="text-[10.5px] text-muted-foreground">Profit / loss</dt><dd className={cn("text-[13px] font-bold", a.pnl >= 0 ? "text-pos" : "text-neg")}>{a.pnl >= 0 ? "+" : "-"}{inr(Math.abs(a.pnl), 0)}</dd><dd className={cn("text-[10.5px]", a.pnlPct >= 0 ? "text-pos" : "text-neg")}>{pct(a.pnlPct)}{h.weightPct !== undefined ? <span className="text-muted-foreground"> · {h.weightPct.toFixed(0)}% of portfolio</span> : null}</dd></div>
      </dl>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-[12px] font-semibold">Decision for you:</span>
        <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-bold", S.cls)}><S.Icon className="size-3.5" />Short term: {S.text}{a.sellQty > 0 ? ` (${a.sellQty === a.qty ? "all" : `${a.sellQty} of ${a.qty}`})` : ""}</span>
        {a.longTerm && <span className={cn("rounded-full px-2.5 py-0.5 text-[12px] font-bold", LONG[a.longTerm.action])}>Long term: {LONG_TERM_LABEL[a.longTerm.action]} · {a.longTerm.score}</span>}
      </div>
      <ul className="mt-1.5 space-y-0.5 text-[12px] leading-snug text-muted-foreground">
        {a.reasons.slice(0, 3).map((r) => <li key={r}>• {r}</li>)}
      </ul>
      {a.together && <p className="mt-1.5 text-[12.5px] font-medium">{a.together}</p>}

      {tips.length > 0 && (
        <>
          <h4 className="mt-3 text-[12.5px] font-bold">How to improve this investment</h4>
          <ul className="mt-1.5 space-y-2">
            {tips.map((t) => { const I = TIP_ICON[t.kind]; return (
              <li key={t.title} className="flex gap-2.5 rounded-lg bg-card px-2.5 py-2">
                <I.Icon className={cn("mt-0.5 size-4 shrink-0", I.cls)} />
                <span className="min-w-0"><b className="block text-[12.5px] font-semibold">{t.title}</b><span className="block text-[12px] leading-snug text-muted-foreground">{t.text}</span></span>
              </li>
            ); })}
          </ul>
        </>
      )}
      <p className="mt-2 text-[11px] text-muted-foreground">Based on your buy price and today&apos;s analysis. Research only, not investment advice.</p>
    </section>
  );
}
