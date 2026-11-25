"use client";

import { AlertTriangle, Check, Loader2, Maximize2, Minimize2, Search, X } from "lucide-react";
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
import { MyPositionCard, useHolding } from "./my-position";
import { holdShort, shortDate } from "@/lib/hold";
import { LONG_TERM_LABEL } from "@/lib/long-term";
import { StockFinder } from "./stock-finder";
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
import { CopySymbol, TradingViewLink, WatchButton } from "./stock-tools";
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

/** Long-term (1-3 years) view from the research desk. */
function LongTermCard({ d }: { d: Decision }) {
  const lt = d.longTerm!;
  const tone = { good: "text-pos", ok: "text-foreground", weak: "text-neg", "n/a": "text-muted-foreground" } as const;
  const badge = { ACCUMULATE: "bg-pos/12 text-pos", HOLD: "bg-sky-500/12 text-sky-700 dark:text-sky-400", REDUCE: "bg-amber-500/12 text-amber-700 dark:text-amber-400", EXIT: "bg-neg/12 text-neg" }[lt.action];
  return (
    <section className="rounded-xl border p-3" aria-label="Long-term view">
      <div className="flex items-center gap-2">
        <AgentAvatar who="Research" size={22} />
        <h3 className="text-[13px] font-semibold">Long-term view <span className="font-normal text-muted-foreground">1-3 years</span></h3>
        <span className={cn("ml-auto rounded-full px-2 py-0.5 text-[11.5px] font-bold", badge)}>{LONG_TERM_LABEL[lt.action]} · {lt.score}/100</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full", lt.score >= 70 ? "bg-pos" : lt.score >= 50 ? "bg-sky-500" : lt.score >= 35 ? "bg-amber-500" : "bg-neg")} style={{ width: `${lt.score}%` }} /></div>
      <dl className="mt-2.5 grid gap-1 text-[12px]">
        {lt.pillars.map((p) => (
          <div key={p.name} className="flex gap-2">
            <dt className="w-24 shrink-0 text-muted-foreground">{p.name}</dt>
            <dd className={cn("min-w-0 flex-1", tone[p.tone])}>{p.text}</dd>
            <dd className="shrink-0 tnum text-muted-foreground">{p.points > 0 ? "+" : ""}{p.points}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-[11.5px] leading-snug text-muted-foreground">Business quality and value, not the chart: 70+ accumulate, 50-69 hold, 35-49 reduce, below 35 exit. Estimates, not advice.</p>
    </section>
  );
}

/** Decision Agent's holding plan: how long, until when, the odds and the expected return. */
function HoldCard({ d }: { d: Decision }) {
  const h = d.hold!;
  return (
    <section className="rounded-xl border p-3" aria-label="How long to hold">
      <div className="flex items-center gap-2">
        <AgentAvatar who="Decision" size={22} />
        <h3 className="text-[13px] font-semibold">How long to hold</h3>
        <span className="ml-auto text-[11px] text-muted-foreground">{d.horizon}</span>
      </div>
      <dl className="mt-2.5 grid grid-cols-3 gap-2 text-center tnum">
        <div className="rounded-lg bg-muted/60 px-1 py-1.5"><dt className="text-[10.5px] text-muted-foreground">Expected hold</dt><dd className="text-[14px] font-bold">{holdShort(h)}</dd>{h.expectedBy && <dd className="text-[10.5px] text-muted-foreground">around {shortDate(h.expectedBy)}</dd>}</div>
        <div className="rounded-lg bg-muted/60 px-1 py-1.5"><dt className="text-[10.5px] text-muted-foreground">Exit by</dt><dd className="text-[14px] font-bold">{shortDate(h.exitBy)}</dd><dd className="text-[10.5px] text-muted-foreground">{h.maxDays} trading days</dd></div>
        <div className="rounded-lg bg-muted/60 px-1 py-1.5"><dt className="text-[10.5px] text-muted-foreground">Expected return</dt><dd className={cn("text-[14px] font-bold", h.expectedReturnPct >= 0 ? "text-pos" : "text-neg")}>{pct(h.expectedReturnPct)}</dd><dd className="text-[10.5px] text-muted-foreground">target {pct(h.targetPct)}</dd></div>
      </dl>
      <div className="mt-2.5 flex h-2 overflow-hidden rounded-full" aria-hidden>
        <span className="bg-pos" style={{ width: `${h.probTarget}%` }} /><span className="bg-muted-foreground/30" style={{ width: `${h.probOpen}%` }} /><span className="bg-neg" style={{ width: `${h.probStop}%` }} />
      </div>
      <p className="mt-1.5 flex justify-between text-[11px] tnum"><span className="text-pos">{h.probTarget}% target first</span><span className="text-muted-foreground">{h.probOpen}% neither</span><span className="text-neg">{h.probStop}% stop-loss first</span></p>
      <p className="mt-1.5 text-[11.5px] leading-snug text-muted-foreground">From 1,000 simulated price paths using this stock&apos;s own daily moves. If neither the target nor the stop-loss is hit by {shortDate(h.exitBy)}, exit at the market price. Estimates, not guarantees.</p>
    </section>
  );
}

/** Long swing: is the stock turning up from a bottom, and the plan if it is. */
function BottomCard({ d }: { d: Decision }) {
  const b = d.bottom!;
  const long = useStockResult()?.longSwing?.find((x) => x.symbol === d.symbol);
  return (
    <section className="rounded-xl border p-3" aria-label="Long swing from the bottom">
      <div className="flex items-center gap-2">
        <AgentAvatar who="Trend" size={22} />
        <h3 className="text-[13px] font-semibold">Long swing · from the bottom</h3>
        <span className={cn("ml-auto rounded-md px-1.5 py-px text-[10.5px] font-bold", b.isSetup ? "bg-[var(--buy-bg)] text-[var(--buy-fg)]" : "bg-muted text-muted-foreground")}>
          {b.isSetup ? `Turning up · ${b.score}/100` : `Not a setup · ${b.score}/100`}
        </span>
      </div>
      <dl className="mt-2.5 grid grid-cols-3 gap-2 text-center tnum">
        <div className="rounded-lg bg-muted/60 px-1 py-1.5"><dt className="text-[10.5px] text-muted-foreground">Bottom</dt><dd className="text-[14px] font-bold">{inr(b.low)}</dd><dd className="text-[10.5px] text-muted-foreground">{shortDate(b.lowDate)}</dd></div>
        <div className="rounded-lg bg-muted/60 px-1 py-1.5"><dt className="text-[10.5px] text-muted-foreground">Above the low</dt><dd className="text-[14px] font-bold text-pos">+{b.offLowPct.toFixed(1)}%</dd></div>
        <div className="rounded-lg bg-muted/60 px-1 py-1.5"><dt className="text-[10.5px] text-muted-foreground">Below 52-week high</dt><dd className="text-[14px] font-bold text-neg">-{b.offHighPct.toFixed(0)}%</dd><dd className="text-[10.5px] text-muted-foreground">{inr(b.high52w, 0)}</dd></div>
      </dl>
      {b.isSetup && (
        <dl className="mt-2 grid grid-cols-3 gap-2 text-center tnum">
          <div><dt className="text-[10.5px] text-muted-foreground">Entry</dt><dd className="text-[13px] font-semibold">{inr(b.entry)}</dd></div>
          <div><dt className="text-[10.5px] text-muted-foreground">Stop (under the low)</dt><dd className="text-[13px] font-semibold text-neg">{inr(b.stopLoss)}</dd></div>
          <div><dt className="text-[10.5px] text-muted-foreground">Target</dt><dd className="text-[13px] font-semibold text-pos">{inr(b.target)}</dd></div>
        </dl>
      )}
      <ul className="mt-2 space-y-0.5 text-[12px] leading-snug">
        {b.signals.map((s) => <li key={s} className="flex gap-1.5"><span className="text-pos">✓</span>{s}</li>)}
        {b.warnings.map((s) => <li key={s} className="flex gap-1.5 text-muted-foreground"><span className="text-[var(--watch-fg)]">!</span>{s}</li>)}
      </ul>
      <p className="mt-1.5 text-[11.5px] leading-snug text-muted-foreground">
        {long ? `In today's long swing list${long.hold ? `: hold up to ${long.hold.maxDays} trading days, exit by ${shortDate(long.hold.exitBy)}` : ""}. ` : b.isSetup ? "Turning up, but not in today's long swing list (sector cap, risk checks or the list was full). " : ""}
        Held about 3 weeks to 3 months. A bottom can still fail, so keep the stop-loss.
      </p>
    </section>
  );
}

function Body({ d, isPick, price }: { d: Decision; isPick: boolean; price?: number }) {
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

      <MyPositionCard d={d} price={price} />
      {d.hold && <HoldCard d={d} />}
      {d.bottom && (d.bottom.isSetup || d.bottom.score >= 40) && <BottomCard d={d} />}
      {d.longTerm && <LongTermCard d={d} />}
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
/** True on screens 1024px and wider (chart and research side by side). */
function useWide() {
  const [w, setW] = useState(true);
  useEffect(() => {
    const m = window.matchMedia("(min-width: 1024px)");
    const on = () => setW(m.matches);
    on(); m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return w;
}

export function StockDrawer() {
  const symbol = useDesk((s) => s.drawerSymbol);
  const result = useStockResult();
  const currentRun = useDesk((s) => s.result);
  const lookup = useDesk((s) => s.lookup);
  const searchStock = useDesk((s) => s.searchStock);
  const openStock = useDesk((s) => s.openStock);
  const d = findStock(result, symbol);
  const desktop = useWide();
  const [tab, setTab] = useState("agents");
  const [mtab, setMtab] = useState("chart"); // phones: one section at a time
  const [wide, setWide] = useState(false);
  const [finding, setFinding] = useState(false);
  const held = Boolean(useHolding(d?.symbol));
  useEffect(() => { if (held) { setTab("research"); setMtab("research"); } }, [held, d?.symbol]);
  const levels = useMemo(() => (d ? { entry: d.entry, stop: d.stopLoss, target: d.target, zoneLow: d.chart?.zone?.low, zoneHigh: d.chart?.zone?.high } : undefined), [d]);
  const demo = result?.source.kind === "demo";
  const quote = useQuote(d?.symbol);
  return (
    <Dialog.Root open={Boolean(d) || Boolean(lookup && lookup.symbol === symbol)} onOpenChange={(o) => { if (!o) { openStock(null); setWide(false); setTab("agents"); setMtab("chart"); setFinding(false); } }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[rgb(8_12_28/0.62)] backdrop-blur-sm" />
        {!d && lookup && (
          <Dialog.Content className="card fixed left-1/2 top-1/2 z-50 w-[min(520px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 p-6 outline-none">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <Dialog.Title className="flex items-center gap-1 text-xl font-extrabold tracking-tight">{lookup.symbol}<CopySymbol symbol={lookup.symbol} size="md" /></Dialog.Title>
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
                  <CopySymbol symbol={d.symbol} size="md" className="-ml-1" />
                  <VerdictBadge verdict={d.verdict} />
                  {lookup?.loading && lookup.symbol === d.symbol && <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"><Loader2 className="size-3 animate-spin" />Loading full research…</span>}
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
                <button type="button" onClick={() => setFinding((f) => !f)} aria-pressed={finding} aria-label="Search another stock" title="Search another stock"
                  className={cn("btn-3d grid size-9 place-items-center rounded-full text-muted-foreground hover:text-foreground", finding && "text-primary")}>
                  <Search className="size-4" />
                </button>
                <WatchButton symbol={d.symbol} price={quote?.last ?? d.entry} className="max-sm:w-9 max-sm:justify-center max-sm:px-0" />
                <TradingViewLink symbol={d.symbol} compact className="max-sm:w-9 max-sm:justify-center max-sm:px-0" />
                <TrackTradeButton d={d} className="h-9" />
                <Dialog.Close aria-label="Close" className="btn-3d grid size-9 place-items-center sm:size-10 rounded-full text-muted-foreground hover:text-foreground">
                  <X className="size-5" />
                </Dialog.Close>
              </div>
              {finding && <StockFinder className="w-full lg:w-96" hotkey={false} autoFocus onPicked={() => { setFinding(false); setMtab("chart"); }} />}
            </header>

            {!desktop ? (
              <Tabs.Root value={mtab} onValueChange={setMtab} className="flex min-h-0 flex-1 flex-col">
                <Tabs.List className="well mx-3 mt-2.5 grid shrink-0 grid-cols-5 rounded-xl p-1" aria-label="Stock details">
                  {[["chart", "Chart"], ["agents", "Agents"], ["research", "Research"], ["forecast", "Forecast"], ["company", "Company"]].map(([v, l]) => (
                    <Tabs.Trigger key={v} value={v} className="truncate rounded-lg px-1 py-1.5 text-[12px] font-medium text-muted-foreground data-[state=active]:raised data-[state=active]:font-semibold data-[state=active]:text-foreground">{l}</Tabs.Trigger>
                  ))}
                </Tabs.List>
                <Tabs.Content value="chart" className="flex min-h-0 flex-1 flex-col overflow-y-auto outline-none">
                  <StockChart symbol={d.symbol} levels={levels} fill className="min-h-[420px] flex-1 p-3" />
                </Tabs.Content>
                <Tabs.Content value="agents" className="flex min-h-0 flex-1 flex-col pt-2 outline-none">
                  {result && <StockAgentsTab key={d.symbol} d={d} result={result} />}
                </Tabs.Content>
                <Tabs.Content value="research" className="flex min-h-0 flex-1 flex-col pt-2 outline-none">
                  <Body d={d} price={quote?.last} isPick={Boolean(result?.picks.some((p) => p.symbol === d.symbol))} />
                </Tabs.Content>
                <Tabs.Content value="forecast" className="min-h-0 flex-1 overflow-y-auto pt-2 outline-none scroll-thin">
                  <ForecastTab d={d} />
                </Tabs.Content>
                <Tabs.Content value="company" className="min-h-0 flex-1 overflow-y-auto pt-2 outline-none scroll-thin">
                  <CompanyTab d={d} />
                </Tabs.Content>
              </Tabs.Root>
            ) : (
            <div className={cn("min-h-0 flex-1 overflow-y-auto lg:grid lg:overflow-hidden", wide ? "lg:grid-cols-1" : "lg:grid-cols-[minmax(0,1fr)_440px]")}>
              <StockChart symbol={d.symbol} levels={levels} className="p-3 sm:p-4" />
              {!wide && (
                <Tabs.Root value={tab} onValueChange={setTab} className="flex min-h-0 flex-col border-[var(--edge)] lg:border-l">
                  <Tabs.List className="well mx-4 mb-3 mt-3 grid grid-cols-4 rounded-xl p-1" aria-label="Stock details">
                    {[["agents", "Agents"], ["research", "Research"], ["forecast", "Forecast"], ["company", "Company"]].map(([v, l]) => (
                      <Tabs.Trigger key={v} value={v} className="truncate rounded-lg px-2 py-1.5 text-[13px] font-medium text-muted-foreground data-[state=active]:raised data-[state=active]:font-semibold data-[state=active]:text-foreground">{l}</Tabs.Trigger>
                    ))}
                  </Tabs.List>
                  <Tabs.Content value="agents" className="flex min-h-0 flex-1 flex-col outline-none">
                    {result && <StockAgentsTab key={d.symbol} d={d} result={result} />}
                  </Tabs.Content>
                  <Tabs.Content value="research" className="flex min-h-0 flex-1 flex-col outline-none">
                    <Body d={d} price={quote?.last} isPick={Boolean(result?.picks.some((p) => p.symbol === d.symbol))} />
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
            )}
          </Dialog.Content>
        )}
      </Dialog.Portal>
    </Dialog.Root>
  );
}
