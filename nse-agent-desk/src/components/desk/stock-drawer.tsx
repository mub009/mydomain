"use client";

import { AlertTriangle, Check, Loader2, Maximize2, Minimize2, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { inr, pct } from "@/lib/format";
import { TEAM } from "@/lib/team";
import type { Decision, Person } from "@/lib/types";
import { cn } from "@/lib/utils";
import { findStock, useDesk, useStockResult } from "@/store/desk";
import { AgentAvatar } from "./agent-avatar";
import { ChartCheck } from "./chart-check";
import { ResearchDeskSection } from "./desk-ui";
import { BlackPointsSection } from "./black-points-ui";
import { FundamentalsCard } from "./fundamentals";
import { TrackTradeButton } from "./positions-ui";
import { CompanyTab } from "./company-tab";
import { ForecastTab } from "./forecast-tab";
import { SectorCheck } from "./sector-ui";
import { MacroExposureSection } from "./macro-ui";
import { Tabs } from "radix-ui";
import { useEffect, useMemo } from "react";
import type { ChartResponse } from "@/lib/market/chart-data";

/** Latest price and today's change, from the last two daily bars. */
function useQuote(symbol: string | undefined) {
  const [q, setQ] = useState<{ last: number; change: number; date: string } | null>(null);
  useEffect(() => {
    setQ(null);
    if (!symbol) return;
    const ctl = new AbortController();
    fetch(`/api/chart?symbol=${encodeURIComponent(symbol)}&interval=1d&range=5d`, { signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: ChartResponse | null) => {
        const b = j?.bars ?? [];
        if (b.length >= 2) setQ({ last: b[b.length - 1].c, change: (b[b.length - 1].c / b[b.length - 2].c - 1) * 100, date: String(b[b.length - 1].t) });
      })
      .catch(() => {});
    return () => ctl.abort();
  }, [symbol]);
  return q;
}
import { StockChart } from "./stock-chart";
import { StockAgentsTab } from "./stock-agents-tab";
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
  const sectors = useStockResult()?.sectors;
  const sector = sectors?.find((s) => s.sector === d.sector);
  const macroFactors = useStockResult()?.macro?.factors ?? [];
  return (
    <div className="flex-1 space-y-4 overflow-y-auto px-5 pb-6 pt-1 scroll-thin">

      <dl className="grid grid-cols-3 gap-2 text-center tnum">
        {[["Entry", inr(d.entry), ""], ["Stop-loss", inr(d.stopLoss), "text-neg"], ["Target", inr(d.target), "text-pos"]].map(([l, v, c]) => (
          <div key={l} className="rounded-xl border p-2"><dt className="text-[11px] text-muted-foreground">{l}</dt><dd className={`text-sm font-bold ${c}`}>{v}</dd></div>
        ))}
      </dl>
      <p className="text-[11.5px] leading-snug text-muted-foreground">Research scenario, not guaranteed prices. Target = entry + 2 × (entry − stop-loss), a {pct((d.target / d.entry - 1) * 100)} move.{d.quantity !== undefined && ` Sized at ${d.quantity} shares (${inr(d.investment ?? 0, 0)}).`}</p>

      {d.blackPoints && <BlackPointsSection bp={d.blackPoints} />}
      <div className="space-y-2.5">
        <ScoreBar label="Combined score" value={d.combined} color="var(--primary)" />
        <ScoreBar label="Momentum Agent · short-term" value={d.lotappi} color={TEAM.Momentum.color} />
        <ScoreBar label="Trend Agent · 1-month" value={d.mayavi} color={TEAM.Trend.color} />
      </div>

      <dl className="grid grid-cols-4 gap-2 text-center tnum">
        {[["RSI 14", d.rsi.toFixed(0)], ["5-day", pct(d.ret5d)], ["1-month", pct(d.ret21d)], ["Rel. volume", `${d.volRatio.toFixed(1)}x`]].map(([l, v]) => (
          <div key={l} className="rounded-lg bg-muted/60 px-1 py-1.5"><dt className="text-[10.5px] text-muted-foreground">{l}</dt><dd className="text-[13px] font-semibold">{v}</dd></div>
        ))}
      </dl>

      {sector ? <SectorCheck s={sector} total={sectors!.length} symbol={d.symbol} />
        : <p className="rounded-xl border border-dashed p-3 text-[12.5px] text-muted-foreground">{d.sector === "Other" ? "Sector unknown for this stock, so there's no sector check." : `Not enough ${d.sector} stocks in this run to judge the sector. Choose "All caps" for more.`}</p>}
      {d.macro && d.macro.length > 0 && <MacroExposureSection exposures={d.macro} factors={macroFactors} />}
      <AgentView who="Momentum" score={d.lotappi} reasons={d.lotReasons} warnings={d.lotWarnings} />
      <AgentView who="Trend" score={d.mayavi} reasons={d.mayReasons} warnings={d.mayWarnings} />
      {d.fundamentals && <FundamentalsCard f={d.fundamentals} />}
      {d.desk ? <ResearchDeskSection desk={d.desk} /> : <p className="rounded-xl border border-dashed p-3 text-[12.5px] text-muted-foreground">The research desk (performance, valuation, growth, profitability, red flags, entry) checks the top candidates only; this stock ranked lower.</p>}
      <AgentView who="Research" score={d.combined}>
        <p className="mt-2 text-[12.5px]">Holding plan: <b>{d.horizon}</b>. Risk <RiskTag risk={d.risk} /> (ATR {d.atrPct.toFixed(1)}% of price).</p>
        {d.notes.length > 0 && <ul className="mt-1 list-disc pl-4 text-[12.5px] text-muted-foreground">{d.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
        {d.clarification && <p className="mt-2 rounded-lg bg-muted/60 p-2 text-[12.5px]">{d.clarification}</p>}
      </AgentView>
      {d.chart ? <ChartCheck chart={d.chart} price={d.entry} /> : <p className="rounded-xl border border-dashed p-3 text-[12.5px] text-muted-foreground">Research Agent checks charts for the top candidates only; this stock ranked lower.</p>}
      <AgentView who="Decision">
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[12.5px]">
          <VerdictBadge verdict={d.verdict} />
          <span>{isPick ? "Chosen as a final pick." : d.passedOver ? `Left out of the picks. ${d.passedOver}.` : d.verdict === "WATCH" ? "On watch, not a buy yet." : d.verdict === "AVOID" ? "Does not meet the buy rules." : "Buy-rated, but ranked below the final picks."}</span>
        </div>
      </AgentView>
    </div>
  );
}

/**
 * Stock modal: opens from any stock chip, table row or chart point. Centred,
 * nearly full screen: the full price chart on the left, the agents' research
 * on the right. "Full chart" hides the research column.
 */
export function StockDrawer() {
  const symbol = useDesk((s) => s.drawerSymbol);
  const result = useStockResult();
  const currentRun = useDesk((s) => s.result);
  const lookup = useDesk((s) => s.lookup);
  const searchStock = useDesk((s) => s.searchStock);
  const openStock = useDesk((s) => s.openStock);
  const d = findStock(result, symbol);
  const [tab, setTab] = useState("agents");
  const [wide, setWide] = useState(false);
  const levels = useMemo(() => (d ? { entry: d.entry, stop: d.stopLoss, target: d.target, zoneLow: d.chart?.zone?.low, zoneHigh: d.chart?.zone?.high } : undefined), [d]);
  const demo = result?.source.kind === "demo";
  const quote = useQuote(d?.symbol);
  return (
    <Dialog.Root open={Boolean(d) || Boolean(lookup && lookup.symbol === symbol)} onOpenChange={(o) => { if (!o) { openStock(null); setWide(false); setTab("agents"); } }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[rgb(8_12_28/0.62)] backdrop-blur-sm" />
        {!d && lookup && (
          <Dialog.Content className="card fixed left-1/2 top-1/2 z-50 w-[min(520px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 p-6 outline-none">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <Dialog.Title className="text-xl font-extrabold tracking-tight">{lookup.symbol}</Dialog.Title>
                <Dialog.Description className="text-[13px] text-muted-foreground">{lookup.name ?? "NSE stock"}</Dialog.Description>
              </div>
              <Dialog.Close aria-label="Close" className="btn-3d grid size-9 place-items-center rounded-full text-muted-foreground hover:text-foreground"><X className="size-4" /></Dialog.Close>
            </div>
            {lookup.loading ? (
              <div className="mt-5 space-y-3" aria-live="polite">
                <p className="flex items-center gap-2 text-[14px] font-semibold"><Loader2 className="size-4 animate-spin text-primary" />The agents are researching {lookup.symbol}…</p>
                <p className="text-[12.5px] leading-relaxed text-muted-foreground">Loading live prices, financials, news, SEBI orders and its sector peers, then running the scanners, the research desk, the chart check and the Black Points Analyst. This takes about 15 seconds.</p>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full w-1/3 animate-[lookup-bar_1.4s_ease-in-out_infinite] rounded-full bg-primary" /></div>
              </div>
            ) : (
              <div className="mt-5 space-y-3" role="alert">
                <p className="text-[13.5px] font-semibold text-neg">{lookup.error}</p>
                <button type="button" onClick={() => searchStock(lookup.symbol, { name: lookup.name })} className="btn-3d inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold">Try again</button>
              </div>
            )}
          </Dialog.Content>
        )}
        {d && (
          <Dialog.Content
            className="card fixed inset-0 z-50 flex flex-col overflow-hidden rounded-none outline-none sm:inset-[2.5vh_2vw] sm:rounded-[22px]"
            onOpenAutoFocus={(e) => e.preventDefault()}>
            <header className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-[var(--edge)] px-4 py-2.5 sm:gap-y-2 sm:px-5 sm:py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Dialog.Title className="text-xl font-extrabold tracking-tight">{d.symbol}</Dialog.Title>
                  <VerdictBadge verdict={d.verdict} />
                </div>
                <Dialog.Description className="text-[12.5px] text-muted-foreground max-sm:line-clamp-1">
                  {d.sector} · NSE{d.fundamentals?.marketCapCr ? ` · ${d.fundamentals.cap} cap ₹${d.fundamentals.marketCapCr.toLocaleString("en-IN")} Cr` : ""}
                  {demo ? " · analysis on demo prices; the chart shows real prices" : " · live data, end of day"}
                  {result && result !== currentRun ? " · analysed on its own with its sector peers" : ""}
                </Dialog.Description>
              </div>
              <div className="tnum">
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-bold sm:text-2xl">{inr(quote?.last ?? d.entry)}</span>
                  {quote && <span className={cn("text-[13px] font-semibold", quote.change >= 0 ? "text-pos" : "text-neg")}>{pct(quote.change)} today</span>}
                </div>
                <div className="text-[11.5px] text-muted-foreground max-sm:hidden">{quote ? `Last price, ${quote.date} · analysis entry ${inr(d.entry)}` : "Analysis entry price"}</div>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <button type="button" onClick={() => setWide((w) => !w)} aria-pressed={wide}
                  className="btn-3d hidden h-9 items-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold lg:inline-flex">
                  {wide ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}{wide ? "Show research" : "Full chart"}
                </button>
                <TrackTradeButton d={d} className="h-9" />
                <Dialog.Close aria-label="Close" className="btn-3d grid size-9 place-items-center sm:size-10 rounded-full text-muted-foreground hover:text-foreground">
                  <X className="size-5" />
                </Dialog.Close>
              </div>
            </header>

            <div className={cn("min-h-0 flex-1 overflow-y-auto lg:grid lg:overflow-hidden", wide ? "lg:grid-cols-1" : "lg:grid-cols-[minmax(0,1fr)_440px]")}>
              <StockChart symbol={d.symbol} levels={levels} className="p-3 sm:p-4" />
              {!wide && (
                <Tabs.Root value={tab} onValueChange={setTab} className="flex min-h-0 flex-col border-[var(--edge)] lg:border-l">
                  <Tabs.List className="well mx-4 mb-3 mt-3 grid grid-cols-4 rounded-xl p-1 max-lg:sticky max-lg:top-0 max-lg:z-10" aria-label="Stock details">
                    {[["agents", "Agents"], ["research", "Research"], ["forecast", "Forecast"], ["company", "Company"]].map(([v, l]) => (
                      <Tabs.Trigger key={v} value={v} className="truncate rounded-lg px-2 py-1.5 text-[13px] font-medium text-muted-foreground data-[state=active]:raised data-[state=active]:font-semibold data-[state=active]:text-foreground">{l}</Tabs.Trigger>
                    ))}
                  </Tabs.List>
                  <Tabs.Content value="agents" className="flex min-h-0 flex-1 flex-col outline-none max-lg:h-[70vh]">
                    {result && <StockAgentsTab key={d.symbol} d={d} result={result} />}
                  </Tabs.Content>
                  <Tabs.Content value="research" className="flex min-h-0 flex-1 flex-col outline-none">
                    <Body d={d} isPick={Boolean(result?.picks.some((p) => p.symbol === d.symbol))} />
                  </Tabs.Content>
                  <Tabs.Content value="forecast" className="min-h-0 flex-1 overflow-y-auto outline-none scroll-thin">
                    <ForecastTab d={d} />
                  </Tabs.Content>
                  <Tabs.Content value="company" className="min-h-0 flex-1 overflow-y-auto outline-none scroll-thin">
                    <CompanyTab d={d} />
                  </Tabs.Content>
                </Tabs.Root>
              )}
            </div>
          </Dialog.Content>
        )}
      </Dialog.Portal>
    </Dialog.Root>
  );
}
