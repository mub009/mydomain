"use client";

import { History, Handshake, ScanSearch, TrendingUp, Trophy } from "lucide-react";
import Link from "next/link";
import { AgentAgreementScatter } from "@/components/desk/agent-agreement-scatter";
import { AnalysisToolbar } from "@/components/desk/analysis-toolbar";
import { MarketTodayCard } from "@/components/desk/market-brief-ui";
import { FinalPicksTable, PicksWaiting } from "@/components/desk/final-picks-table";
import { MessageFeed } from "@/components/desk/message-feed";
import { MorningNewsCard, VixCard } from "@/components/desk/morning-cards";
import { DiversificationCard } from "@/components/desk/diversification-card";
import { SectorStrengthCard } from "@/components/desk/sector-ui";
import { MacroCard } from "@/components/desk/macro-ui";
import { PolicyCard } from "@/components/desk/policy-ui";
import { BulkTrackButton } from "@/components/desk/positions-ui";
import { diversify } from "@/lib/diversify";
import { useMemo, useState } from "react";
import { DataBanner, KPICard, ResearchProgress } from "@/components/desk/primitives";
import { PageHeader } from "@/components/desk/shell";
import { Button } from "@/components/ui/button";
import { istDate, istTime, pct } from "@/lib/format";
import { useBusy, useDecided, useDesk, useStage } from "@/store/desk";
import { matchesTrade, matchesZone, TradeChips, ZoneAndTopFilter, type TradeFilter, type ZoneFilter } from "@/components/desk/stock-tools";
import type { Decision } from "@/lib/types";

export default function OverviewPage() {
  const r = useDecided();
  const busy = useBusy();
  const { stage, done } = useStage();
  const error = useDesk((s) => s.error);
  const source = useDesk((s) => s.result?.source);
  const messages = useDesk((s) => s.messages);
  const shown = useDesk((s) => s.shown);
  const typing = useDesk((s) => s.typing);
  const times = useDesk((s) => s.times);
  const openStock = useDesk((s) => s.openStock);
  const result = useDesk((s) => s.result);
  const session = useDesk((s) => s.session);
  const replayOf = useDesk((s) => s.replayOf);
  const replaySession = useDesk((s) => s.replaySession);
  const said = (who: string) => messages.slice(0, shown).some((m) => m.sender === who);
  const idle = !busy && !messages.length;

  const balance = useMemo(() => (r ? diversify(r.picks.map((p) => ({
    symbol: p.symbol, sector: p.sector, cap: p.fundamentals?.cap ?? "Unknown", value: p.investment || p.entry * (p.quantity || 1), closes: p.spark,
  })), r.all) : null), [r]);
  // Final Picks filters: where the price sits against the buy zone, and how many to show.
  const [zone, setZone] = useState<ZoneFilter>("ALL");
  const [top, setTop] = useState(0);
  const [trade, setTrade] = useState<TradeFilter>("ALL");
  // The main picks plus the long swing picks (turning up from a bottom) not already among them.
  const allPicks = useMemo<Decision[]>(() => {
    const main = r?.picks ?? [];
    const have = new Set(main.map((p) => p.symbol));
    return [...main, ...(r?.longSwing ?? []).filter((p) => !have.has(p.symbol))];
  }, [r]);
  const ofTrade = (t: TradeFilter) => (t === "Long swing" ? r?.longSwing ?? [] : t === "ALL" ? allPicks : (r?.picks ?? []).filter((d) => matchesTrade(d, t)));
  const byTrade = useMemo(() => ofTrade(trade), [r, allPicks, trade]); // eslint-disable-line react-hooks/exhaustive-deps
  const shownPicks = useMemo(() => {
    const xs = byTrade.filter((d) => matchesZone(d, zone));
    return top ? xs.slice(0, top) : xs;
  }, [byTrade, zone, top]);
  const buys = r?.all.filter((d) => d.verdict === "STRONG BUY" || d.verdict === "BUY").length;
  const agree = r?.all.filter((d) => d.agree).length;

  return (
    <>
      <PageHeader title="Overview" subtitle="Sixteen AI agents scan, analyse, debate and decide." />
      <div className="space-y-4">
        {source && <DataBanner source={source} />}
        <AnalysisToolbar />
        <MarketTodayCard />
        {(session?.ranAt || session?.enabled) && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border bg-card px-3.5 py-2.5 text-[13px]">
            <History className="size-4 text-[#EC4899]" aria-hidden />
            <span className="min-w-0 flex-1">
              {replayOf ? <>Showing the News Agent from <b className="font-semibold">{istDate(replayOf)}, {istTime(replayOf)} IST</b>.</>
                : session.ranAt ? <>The 9 AM session last ran <b className="font-semibold">{istDate(session.ranAt)}, {istTime(session.ranAt)} IST</b>.</>
                : <>News Agent is scheduled for <b className="font-semibold">{session.time} IST</b> on trading days. No run yet.</>}
            </span>
            {session.ranAt && !replayOf && <Button variant="outline" size="sm" onClick={replaySession} disabled={busy}>Replay 9 AM session</Button>}
          </div>
        )}
        {error && <div role="alert" className="rounded-xl border border-neg/40 bg-neg/10 px-3.5 py-2.5 text-[13px] font-medium text-neg">Could not finish the analysis: {error}</div>}

        <section className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Key figures">
          <KPICard label="Stocks Scanned" value={r ? String(r.all.length) : "–"} sub={r ? (r.source.kind === "demo" ? "Demo data" : "End-of-day data") : "Run an analysis"} icon={<ScanSearch />} />
          <KPICard label="Buy Signals" value={buys === undefined ? "–" : String(buys)} sub={r ? `${r.picks.length} chosen as final picks` : "After the final decision"} icon={<Trophy />} />
          <KPICard label="Both Agents Agree" value={agree === undefined ? "–" : String(agree)} sub="Momentum Agent and Trend Agent both ≥ 60" icon={<Handshake />} />
          <KPICard label="Nifty 50 · 1-Month" value={r ? pct(r.indexRet21d, 2) : "–"} sub={r?.source.kind === "demo" ? "Demo index" : "Benchmark return"}
            tone={r ? (r.indexRet21d >= 0 ? "pos" : "neg") : undefined} icon={<TrendingUp />} />
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <MorningNewsCard news={result?.news} revealed={Boolean(result) && said("News")} busy={busy && !said("News")} time={session?.time ?? "09:00"} />
          <VixCard vix={result?.vix} revealed={Boolean(result) && said("Volatility")} busy={busy && !said("Volatility")} />
        </div>

        <PolicyCard policy={result?.policy} revealed={Boolean(result) && said("CentralBank")} busy={busy && !said("CentralBank")} />
        <MacroCard macro={result?.macro} revealed={Boolean(result) && said("Macro")} busy={busy && !said("Macro")} />

        {r && <SectorStrengthCard sectors={r.sectors} />}

        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-4">
            <section className="card overflow-hidden">
              <header className="flex flex-wrap items-center justify-between gap-3 px-4 pb-3 pt-4">
                <div>
                  <h2 className="text-[15px] font-semibold">Final Picks</h2>
                  <p className="text-xs text-muted-foreground">
                    {r ? (r.watchlist.length ? `Watchlist: ${r.watchlist.map((w) => w.symbol).join(", ")} · track them all, or open a pick` : "Track them all, or open a pick")
                      : "Announced by Decision Agent at the end of the discussion"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {r && <ResearchProgress stage={stage} done={done} className="hidden sm:flex" />}
                  {r && done && shownPicks.length > 0 && <BulkTrackButton items={shownPicks} label={`Track all ${shownPicks.length}`} />}
                </div>
              </header>
              {r && done && allPicks.length > 0 && (
                <div className="space-y-2 border-t border-[var(--edge)] px-4 py-2.5">
                  <TradeChips value={trade} onChange={setTrade} count={(t) => ofTrade(t).length} />
                  <ZoneAndTopFilter items={byTrade} zone={zone} onZone={setZone} top={top} onTop={setTop} />
                  {trade === "Long swing" && (
                    <p className="text-[12px] leading-snug text-muted-foreground">
                      Long swing: stocks well below their 52-week high that bounced off a recent low and are turning up. Stop-loss under the low, target part of the way back to the old high, held about 3 weeks to 3 months. A bottom can still fail, so size these smaller.
                    </p>
                  )}
                </div>
              )}
              {r ? <FinalPicksTable picks={done ? shownPicks : r.picks} onSelect={openStock}
                empty={trade === "Long swing" ? "No stock is clearly turning up from a bottom in this run. Try a bigger list (Nifty 500 or All NSE)."
                  : allPicks.length ? "No pick matches this filter. Choose All to see every pick." : undefined} /> : <PicksWaiting stage={stage} idle={idle} />}
            </section>

            {balance && <DiversificationCard d={balance} title="Portfolio balance of these picks"
              subtitle={r?.picks.some((p) => p.investment) ? "Weighted by the suggested investment in each pick." : "Weighted by one share of each pick; enter your capital for real weights."} />}

            <section className="card p-4">
              <h2 className="text-[15px] font-semibold">Where the Agents Agree</h2>
              <p className="mb-3 text-xs text-muted-foreground">Each point is a stock. Further right means Momentum Agent likes it more; higher means Trend Agent does.</p>
              {r ? <AgentAgreementScatter rows={r.all} picks={r.picks.map((p) => p.symbol)} watch={r.watchlist.map((w) => w.symbol)} onSelect={openStock} />
                : <div className="grid h-56 place-items-center rounded-xl border border-dashed text-[13px] text-muted-foreground">The chart appears after the final decision.</div>}
            </section>
          </div>

          <section className="card flex h-[560px] flex-col overflow-hidden xl:sticky xl:top-24 xl:h-[calc(100dvh-7.5rem)]" aria-label="Live team chat">
            <header className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <h2 className="flex items-center gap-2 text-[15px] font-semibold">
                  Live Team Chat
                  {busy && <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400"><i className="size-1.5 animate-pulse rounded-full bg-current" />Live</span>}
                </h2>
                <p className="text-xs text-muted-foreground">{busy ? "Agents are talking now" : messages.length ? "Discussion finished" : "Read-only feed"}</p>
              </div>
              <Button asChild variant="outline" size="sm"><Link href="/chat">Open</Link></Button>
            </header>
            <MessageFeed messages={messages.slice(0, shown)} times={times} typing={typing} compact empty="The team's messages will appear here as they talk." />
          </section>
        </div>
      </div>
    </>
  );
}
