"use client";

import { ArrowDownRight, ArrowUpRight, ExternalLink, Newspaper } from "lucide-react";
import { Line, LineChart, YAxis } from "recharts";
import { pct } from "@/lib/format";
import { TEAM } from "@/lib/team";
import type { NewsBrief, NewsItem, VixReport } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AgentAvatar } from "./agent-avatar";
import { StockSymbolChip, TypingIndicator } from "./primitives";

function CardHead({ who, title, sub, right }: { who: "News" | "Volatility"; title: string; sub: string; right?: React.ReactNode }) {
  return (
    <header className="flex items-start gap-3 px-4 pb-3 pt-4">
      <AgentAvatar who={who} size={34} />
      <div className="min-w-0 flex-1">
        <h2 className="text-[15px] font-semibold">{title}</h2>
        <p className="text-xs text-muted-foreground"><span style={{ color: TEAM[who].color }} className="font-semibold">{TEAM[who].name}</span> · {sub}</p>
      </div>
      {right}
    </header>
  );
}

function Waiting({ text, busy }: { text: string; busy: boolean }) {
  return <p className="flex items-center justify-center gap-2 px-4 pb-6 pt-3 text-center text-[13px] text-muted-foreground">{text}{busy && <TypingIndicator />}</p>;
}

function Headline({ n }: { n: NewsItem }) {
  const pos = n.sentiment === "positive";
  return (
    <li className="flex gap-2.5 border-t px-4 py-2 first:border-t-0">
      <span className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full", pos ? "bg-[var(--buy-bg)] text-[var(--buy-fg)]" : "bg-[var(--avoid-bg)] text-[var(--avoid-fg)]")}
        title={pos ? "Positive" : "Negative"}>
        {pos ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
      </span>
      <div className="min-w-0 flex-1 text-[13px] leading-snug">
        <StockSymbolChip symbol={n.symbol} className="mr-1" />
        {n.url ? <a href={n.url} target="_blank" rel="noreferrer noopener" className="hover:underline">{n.headline}<ExternalLink className="ml-1 inline size-3 opacity-60" /></a> : n.headline}
        <div className="text-[11px] text-muted-foreground">{n.source}{n.sample && " · sample"}{pos ? " · sent to Momentum Agent & Trend Agent" : " · flagged as a risk"}</div>
      </div>
    </li>
  );
}

/** News Agent: the news it collected, positive first. */
export function MorningNewsCard({ news, revealed, busy, time }: { news: NewsBrief | null | undefined; revealed: boolean; busy: boolean; time: string }) {
  const pos = news?.items.filter((i) => i.sentiment === "positive") ?? [];
  const neg = news?.items.filter((i) => i.sentiment === "negative") ?? [];
  return (
    <section className="card flex flex-col overflow-hidden" aria-label="Morning news">
      <CardHead who="News" title="Morning News" sub={`runs daily at ${time} IST`}
        right={revealed && news && <span className="flex items-center gap-1 whitespace-nowrap rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground"><Newspaper className="size-3" />{news.label}</span>} />
      {!revealed ? <Waiting busy={busy} text={busy ? "Collecting news" : "Run an analysis, or wait for the 9 AM session."} />
        : !news ? <p className="px-4 pb-5 text-[13px] text-muted-foreground">News could not be collected for this run. The agents scored the stocks on prices alone.</p>
        : !news.items.length ? <p className="px-4 pb-5 text-[13px] text-muted-foreground">No clearly positive or negative news on the scanned stocks.</p>
        : (
          <>
            <div className="flex gap-4 px-4 pb-2 text-xs"><span className="font-semibold text-pos">{pos.length} positive</span><span className="font-semibold text-neg">{neg.length} negative</span><span className="text-muted-foreground">of {news.total} headlines read</span></div>
            <ul className="max-h-72 overflow-y-auto scroll-thin">{[...pos, ...neg].slice(0, 12).map((n, i) => <Headline key={i} n={n} />)}</ul>
          </>
        )}
    </section>
  );
}

const EXPECT_STYLE: Record<string, string> = {
  "Likely up": "bg-[var(--buy-bg)] text-[var(--buy-fg)]", "Holds up": "bg-[var(--strong-bg)] text-[var(--strong-fg)]",
  "Bigger swings": "bg-[var(--watch-bg)] text-[var(--watch-fg)]", "At risk": "bg-[var(--avoid-bg)] text-[var(--avoid-fg)]",
};

/** Volatility Agent: India VIX level, why it moved, and the stocks to watch next. */
export function VixCard({ vix, revealed, busy }: { vix: VixReport | null | undefined; revealed: boolean; busy: boolean }) {
  const Dir = vix?.direction === "up" ? ArrowUpRight : ArrowDownRight;
  // For VIX, up means more fear: show it in red.
  const tone = vix?.direction === "up" ? "text-neg" : vix?.direction === "down" ? "text-pos" : "text-muted-foreground";
  return (
    <section className="card flex flex-col overflow-hidden" aria-label="India VIX">
      <CardHead who="Volatility" title="India VIX" sub="volatility index tracker" />
      {!revealed ? <Waiting busy={busy} text={busy ? "Reading India VIX" : "Appears when the Volatility Agent reports."} />
        : !vix ? <p className="px-4 pb-5 text-[13px] text-muted-foreground">India VIX data was not available for this run.</p>
        : (
          <div className="space-y-3 px-4 pb-4">
            <div className="flex items-center gap-4">
              <div>
                <div className="flex items-baseline gap-2"><span className="text-[28px] font-bold leading-none tracking-tight tnum">{vix.level.toFixed(2)}</span>
                  <span className={cn("flex items-center text-sm font-semibold tnum", tone)}>{vix.direction !== "flat" && <Dir className="size-4" />}{pct(vix.change1d)}</span></div>
                <div className="mt-1 text-xs text-muted-foreground tnum">5-day {pct(vix.change5d)} · <b className="font-semibold text-foreground">{vix.regime}</b>{vix.sample && " · demo VIX"}</div>
              </div>
              <div className="ml-auto" role="img" aria-label="India VIX, last 60 days">
                <LineChart width={130} height={44} data={vix.spark.map((v, i) => ({ i, v }))} margin={{ top: 4, right: 2, bottom: 4, left: 2 }} accessibilityLayer={false}>
                  <YAxis hide domain={["dataMin", "dataMax"]} />
                  <Line type="monotone" dataKey="v" stroke={TEAM.Volatility.color} strokeWidth={1.75} dot={false} isAnimationActive={false} />
                </LineChart>
              </div>
            </div>
            <div>
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Likely why</div>
              <ul className="space-y-1 text-[12.5px] leading-snug">{vix.reasons.map((r) => <li key={r} className="flex gap-1.5"><span className="mt-1.5 size-1 shrink-0 rounded-full bg-muted-foreground" />{r}</li>)}</ul>
            </div>
            <div>
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Next stocks to move</div>
              <ul className="space-y-1.5">
                {vix.movers.map((m) => (
                  <li key={m.symbol} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12.5px]">
                    <StockSymbolChip symbol={m.symbol} />
                    <span className={cn("rounded-md px-1.5 py-px text-[10.5px] font-bold", EXPECT_STYLE[m.expect])}>{m.expect}</span>
                    <span className="text-muted-foreground">{m.why}</span>
                  </li>
                ))}
              </ul>
            </div>
            <p className="text-[11px] text-muted-foreground">The reasons are inferred from prices and headlines. Results, RBI policy, expiry and global cues can also move VIX.</p>
          </div>
        )}
    </section>
  );
}
