"use client";

import { AlertTriangle, Check } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { inr, pct } from "@/lib/format";
import { TEAM } from "@/lib/team";
import type { Decision, Person } from "@/lib/types";
import { findStock, useDesk } from "@/store/desk";
import { AgentAvatar } from "./agent-avatar";
import { ChartCheck } from "./chart-check";
import { FundamentalsCard } from "./fundamentals";
import { TrackTradeButton } from "./positions-ui";
import { CompanyTab } from "./company-tab";
import { SectorCheck } from "./sector-ui";
import { MacroExposureSection } from "./macro-ui";
import { Tabs } from "radix-ui";
import { useState } from "react";
import { RiskTag, VerdictBadge } from "./primitives";

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between text-xs"><span className="text-muted-foreground">{label}</span><b className="tnum">{value.toFixed(1)}</b></div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${value}%`, background: color }} /></div>
    </div>
  );
}

function AgentView({ who, score, reasons, warnings, children }: { who: Person; score?: number; reasons?: string[]; warnings?: string[]; children?: React.ReactNode }) {
  const t = TEAM[who];
  return (
    <section className="rounded-xl border p-3">
      <div className="flex items-center gap-2">
        <AgentAvatar who={who} size={28} />
        <div className="min-w-0 flex-1"><b className="text-[13px]" style={{ color: t.color }}>{t.name}</b><span className="ml-1.5 text-[11.5px] text-muted-foreground">{t.title}</span></div>
        {score !== undefined && <span className="text-sm font-bold tnum">{score.toFixed(1)}</span>}
      </div>
      <ul className="mt-2 space-y-1 text-[12.5px]">
        {reasons?.map((r) => <li key={r} className="flex gap-1.5"><Check className="mt-0.5 size-3.5 shrink-0 text-pos" />{r}</li>)}
        {warnings?.map((r) => <li key={r} className="flex gap-1.5 text-muted-foreground"><AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-[var(--watch-fg)]" />{r}</li>)}
        {!reasons?.length && !warnings?.length && !children && <li className="text-muted-foreground">No notable signals.</li>}
      </ul>
      {children}
    </section>
  );
}

function Body({ d, isPick }: { d: Decision; isPick: boolean }) {
  const sectors = useDesk((s) => s.result?.sectors);
  const sector = sectors?.find((s) => s.sector === d.sector);
  const macroFactors = useDesk((s) => s.result?.macro?.factors ?? []);
  const up = d.spark[d.spark.length - 1] >= d.spark[0];
  const stroke = up ? "var(--pos)" : "var(--neg)";
  return (
    <div className="flex-1 space-y-4 overflow-y-auto px-5 pb-6 scroll-thin">
      <div className="h-28 rounded-xl border bg-muted/40 p-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={d.spark.map((v, i) => ({ i, v }))} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
            <YAxis hide domain={["dataMin", "dataMax"]} />
            <Area type="monotone" dataKey="v" stroke={stroke} strokeWidth={2} fill={stroke} fillOpacity={0.12} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <dl className="grid grid-cols-3 gap-2 text-center tnum">
        {[["Entry", inr(d.entry), ""], ["Stop-loss", inr(d.stopLoss), "text-neg"], ["Target", inr(d.target), "text-pos"]].map(([l, v, c]) => (
          <div key={l} className="rounded-xl border p-2"><dt className="text-[11px] text-muted-foreground">{l}</dt><dd className={`text-sm font-bold ${c}`}>{v}</dd></div>
        ))}
      </dl>
      <p className="text-[11.5px] leading-snug text-muted-foreground">Research scenario, not guaranteed prices. Target = entry + 2 × (entry − stop-loss), a {pct((d.target / d.entry - 1) * 100)} move.{d.quantity !== undefined && ` Sized at ${d.quantity} shares (${inr(d.investment ?? 0, 0)}).`}</p>

      <div className="space-y-2.5">
        <ScoreBar label="Combined score" value={d.combined} color="var(--primary)" />
        <ScoreBar label="Lotappi · short-term" value={d.lotappi} color={TEAM.Lotappi.color} />
        <ScoreBar label="Mayavi · 1-month" value={d.mayavi} color={TEAM.Mayavi.color} />
      </div>

      <dl className="grid grid-cols-4 gap-2 text-center tnum">
        {[["RSI 14", d.rsi.toFixed(0)], ["5-day", pct(d.ret5d)], ["1-month", pct(d.ret21d)], ["Rel. volume", `${d.volRatio.toFixed(1)}x`]].map(([l, v]) => (
          <div key={l} className="rounded-lg bg-muted/60 px-1 py-1.5"><dt className="text-[10.5px] text-muted-foreground">{l}</dt><dd className="text-[13px] font-semibold">{v}</dd></div>
        ))}
      </dl>

      {sector ? <SectorCheck s={sector} total={sectors!.length} symbol={d.symbol} />
        : <p className="rounded-xl border border-dashed p-3 text-[12.5px] text-muted-foreground">{d.sector === "Other" ? "Sector unknown for this stock, so there's no sector check." : `Not enough ${d.sector} stocks in this run to judge the sector. Choose "All caps" for more.`}</p>}
      {d.macro && d.macro.length > 0 && <MacroExposureSection exposures={d.macro} factors={macroFactors} />}
      <AgentView who="Lotappi" score={d.lotappi} reasons={d.lotReasons} warnings={d.lotWarnings} />
      <AgentView who="Mayavi" score={d.mayavi} reasons={d.mayReasons} warnings={d.mayWarnings} />
      {d.fundamentals && <FundamentalsCard f={d.fundamentals} />}
      <AgentView who="Mubashir" score={d.combined}>
        <p className="mt-2 text-[12.5px]">Holding plan: <b>{d.horizon}</b>. Risk <RiskTag risk={d.risk} /> (ATR {d.atrPct.toFixed(1)}% of price).</p>
        {d.notes.length > 0 && <ul className="mt-1 list-disc pl-4 text-[12.5px] text-muted-foreground">{d.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
        {d.clarification && <p className="mt-2 rounded-lg bg-muted/60 p-2 text-[12.5px]">{d.clarification}</p>}
      </AgentView>
      {d.chart ? <ChartCheck chart={d.chart} price={d.entry} /> : <p className="rounded-xl border border-dashed p-3 text-[12.5px] text-muted-foreground">Mubashir checks charts for the top candidates only; this stock ranked lower.</p>}
      <AgentView who="FinalDecision">
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[12.5px]">
          <VerdictBadge verdict={d.verdict} />
          <span>{isPick ? "Chosen as a final pick." : d.passedOver ? `Left out of the picks. ${d.passedOver}.` : d.verdict === "WATCH" ? "On watch, not a buy yet." : d.verdict === "AVOID" ? "Does not meet the buy rules." : "Buy-rated, but ranked below the final picks."}</span>
        </div>
      </AgentView>
    </div>
  );
}

/** Research drawer: opens from any stock chip, table row or chart point. */
export function StockDrawer() {
  const symbol = useDesk((s) => s.drawerSymbol);
  const result = useDesk((s) => s.result);
  const openStock = useDesk((s) => s.openStock);
  const d = findStock(result, symbol);
  const [tab, setTab] = useState("research");
  return (
    <Sheet open={Boolean(d)} onOpenChange={(o) => !o && openStock(null)}>
      <SheetContent>
        {d && (
          <>
            <div className="px-5 pb-3 pt-5">
              <div className="flex items-center gap-2 pr-8">
                <SheetTitle className="text-xl font-bold tracking-tight">{d.symbol}</SheetTitle>
                <VerdictBadge verdict={d.verdict} />
              </div>
              <SheetDescription className="text-[13px] text-muted-foreground">
                {d.sector} · NSE · {result?.source.kind === "demo" ? "demo data, not real prices" : "end-of-day data"}
              </SheetDescription>
              <TrackTradeButton d={d} className="mt-3 w-full" />
            </div>
            <Tabs.Root value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
              <Tabs.List className="mx-5 mb-3 grid grid-cols-2 rounded-lg bg-muted p-0.5" aria-label="Stock details">
                {[["research", "Research"], ["company", "Company: peers, financials, owners"]].map(([v, l]) => (
                  <Tabs.Trigger key={v} value={v} className="truncate rounded-md px-2 py-1.5 text-[13px] font-medium text-muted-foreground data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm">{l}</Tabs.Trigger>
                ))}
              </Tabs.List>
              <Tabs.Content value="research" className="flex min-h-0 flex-1 flex-col outline-none">
                <Body d={d} isPick={Boolean(result?.picks.some((p) => p.symbol === d.symbol))} />
              </Tabs.Content>
              <Tabs.Content value="company" className="min-h-0 flex-1 overflow-y-auto outline-none scroll-thin">
                <CompanyTab d={d} />
              </Tabs.Content>
            </Tabs.Root>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
