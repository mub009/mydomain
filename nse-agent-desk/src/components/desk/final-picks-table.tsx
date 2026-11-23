"use client";

import { motion } from "motion/react";
import { holdSentence, holdShort, shortDate } from "@/lib/hold";
import { inr, pct } from "@/lib/format";
import type { Decision, Stage } from "@/lib/types";
import { ResearchProgress, RiskTag, TypingIndicator, VerdictBadge } from "./primitives";
import { PlanTag } from "./chart-check";
import { CapTag, EpsGrowth } from "./fundamentals";
import { StockSparkline } from "./stock-sparkline";

/** Small line illustration: four desks around a chart, for the waiting state. */
function WaitingArt() {
  return (
    <svg viewBox="0 0 220 96" className="h-24 w-auto" aria-hidden>
      <rect x="62" y="10" width="96" height="62" rx="8" fill="var(--muted)" stroke="var(--border)" />
      <path d="M72 58l16-14 12 8 16-22 14 10 18-18" fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="148" cy="22" r="3.5" fill="var(--primary)" />
      <path d="M72 64h76" stroke="var(--border)" strokeWidth="2" strokeLinecap="round" />
      {[[26, "#3B82F6"], [194, "#A855F7"]].map(([x, c]) => (
        <g key={x}><circle cx={x} cy="34" r="9" fill={c as string} opacity=".85" /><path d={`M${(x as number) - 14} 66c0-10 6-15 14-15s14 5 14 15Z`} fill={c as string} opacity=".35" /></g>
      ))}
      {[[86, "#14B8A6"], [134, "#F59E0B"]].map(([x, c]) => (
        <g key={x}><circle cx={x} cy="82" r="6" fill={c as string} opacity=".85" /></g>
      ))}
      <path d="M40 40h18M162 40h18" stroke="var(--border)" strokeWidth="2" strokeDasharray="3 4" strokeLinecap="round" />
    </svg>
  );
}

export function PicksWaiting({ stage, idle }: { stage: Stage | null; idle: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-9 text-center">
      <WaitingArt />
      <div className="flex items-center gap-2 text-sm font-semibold">
        {idle ? "Run an analysis to start the team" : <>Waiting for Decision Agent <TypingIndicator className="text-muted-foreground" /></>}
      </div>
      <p className="max-w-sm text-xs text-muted-foreground">
        {idle ? "Momentum Agent and Trend Agent scan the market, Research Agent analyses, and Decision Agent announces the picks here."
          : "The picks stay hidden until Decision Agent announces them in the team chat."}
      </p>
      <ResearchProgress stage={stage} className="mt-1" />
    </div>
  );
}

const upside = (d: Decision) => (d.target / d.entry - 1) * 100;

/** FinalPicksTable: table on desktop, scrollable cards on mobile. */
export function FinalPicksTable({ picks, onSelect }: { picks: Decision[]; onSelect?: (symbol: string) => void }) {
  if (!picks.length) {
    return <p className="px-4 py-10 text-center text-sm text-muted-foreground">No stock passed the buy rules in this run. Staying in cash is a valid decision.</p>;
  }
  const sized = picks.some((p) => p.quantity !== undefined);
  return (
    <>
      {/* desktop */}
      <div className="hidden overflow-x-auto scroll-thin md:block">
        <table className="w-full min-w-[640px] text-left text-[12.5px] tnum">
          <thead>
            <tr className="border-y bg-muted/50 text-[10.5px] uppercase tracking-wider text-muted-foreground">
              {["Stock", "Risk", "Verdict · plan", "60-day trend"].map((h) => <th key={h} className="whitespace-nowrap px-1.5 py-2 font-semibold first:pl-4">{h}</th>)}
              {["Entry", "Stop-loss", "Target", "Hold", "Buy zone", ...(sized ? ["Qty"] : [])].map((h) => <th key={h} className="whitespace-nowrap px-1.5 py-2 text-right font-semibold last:pr-4">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {picks.map((d, i) => (
              <motion.tr key={d.symbol} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                onClick={() => onSelect?.(d.symbol)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && onSelect?.(d.symbol)}
                className="cursor-pointer border-b last:border-0 hover:bg-muted/50">
                <td className="px-1.5 py-2.5 pl-4"><div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 font-semibold">{d.symbol}{d.fundamentals && <CapTag cap={d.fundamentals.cap} />}</div><div className="text-[11.5px] leading-snug text-muted-foreground">{d.sector} · EPS <EpsGrowth f={d.fundamentals} /></div></td>
                <td className="px-1.5 py-2.5"><RiskTag risk={d.risk} /></td>
                <td className="px-1.5 py-2.5"><VerdictBadge verdict={d.verdict} /><div className="mt-0.5 text-[11px] text-muted-foreground">{d.horizon}</div></td>
                <td className="px-1.5 py-2.5"><StockSparkline data={d.spark} width={64} showChange={false} /></td>
                <td className="whitespace-nowrap px-1.5 py-2.5 text-right font-medium">{inr(d.entry)}</td>
                <td className="whitespace-nowrap px-1.5 py-2.5 text-right text-neg">{inr(d.stopLoss)}</td>
                <td className="whitespace-nowrap px-1.5 py-2.5 text-right text-pos">{inr(d.target)}</td>
                <td className="whitespace-nowrap px-1.5 py-2.5 text-right" title={d.hold ? holdSentence(d.hold) : undefined}>
                  {d.hold ? <><div className="text-xs font-semibold">{holdShort(d.hold)}</div><div className="text-[11px] text-muted-foreground">by {shortDate(d.hold.exitBy)} · <span className={d.hold.expectedReturnPct >= 0 ? "text-pos" : "text-neg"}>{pct(d.hold.expectedReturnPct)}</span></div></> : <span className="text-xs text-muted-foreground">–</span>}
                </td>
                <td className="whitespace-nowrap px-1.5 py-2.5 text-right">
                  {d.chart?.zone ? <><div className="text-xs font-medium">{inr(d.chart.zone.low, 0)}–{inr(d.chart.zone.high, 0)}</div><PlanTag zone={d.chart.zone} /></> : <span className="text-xs text-muted-foreground">–</span>}
                </td>
                {sized && <td className="px-1.5 py-2.5 pr-4 text-right font-semibold" title={d.investment !== undefined ? `Invests ${inr(d.investment, 0)}` : undefined}>{d.quantity ?? "–"}</td>}
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* mobile cards */}
      <div className="flex snap-x gap-3 overflow-x-auto px-4 pb-4 scroll-thin md:hidden">
        {picks.map((d) => (
          <button key={d.symbol} type="button" onClick={() => onSelect?.(d.symbol)}
            className="w-[78vw] max-w-[290px] shrink-0 snap-start rounded-xl border bg-card p-3 text-left tnum">
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <div className="flex min-w-0 items-center gap-1.5 font-semibold">{d.symbol}{d.fundamentals && <CapTag cap={d.fundamentals.cap} />}</div>
              <VerdictBadge verdict={d.verdict} />
            </div>
            <div className="mt-0.5 text-[11.5px] text-muted-foreground">{d.sector} · <RiskTag risk={d.risk} /> risk · EPS <EpsGrowth f={d.fundamentals} /></div>
            <div className="my-2"><StockSparkline data={d.spark} width={150} height={34} /></div>
            <dl className="grid grid-cols-3 gap-1 text-[11px] text-muted-foreground">
              <div><dt>Entry</dt><dd className="text-[12.5px] font-semibold text-foreground">{inr(d.entry, 0)}</dd></div>
              <div><dt>Stop-loss</dt><dd className="text-[12.5px] font-semibold text-neg">{inr(d.stopLoss, 0)}</dd></div>
              <div><dt>Target</dt><dd className="text-[12.5px] font-semibold text-pos">{inr(d.target, 0)}</dd></div>
            </dl>
            <div className="mt-2 flex flex-wrap justify-between gap-x-3 border-t pt-2 text-[11.5px] text-muted-foreground">
              <span>{d.horizon}</span>
              {d.hold && <span className="w-full">Hold <b className="text-foreground">{holdShort(d.hold)}</b>, exit by <b className="text-foreground">{shortDate(d.hold.exitBy)}</b> · {d.hold.probTarget}% reach target · expected <b className={d.hold.expectedReturnPct >= 0 ? "text-pos" : "text-neg"}>{pct(d.hold.expectedReturnPct)}</b></span>}
              {d.chart?.zone && <span className="w-full">Buy zone <b className="text-foreground">{inr(d.chart.zone.low, 0)}–{inr(d.chart.zone.high, 0)}</b> · <PlanTag zone={d.chart.zone} /></span>}
              <span className="font-semibold text-foreground">Upside {pct(upside(d))}{d.quantity !== undefined ? ` · ${d.quantity} sh` : ""}</span>
            </div>
          </button>
        ))}
      </div>
    </>
  );
}
