"use client";

import { Bell, BellOff, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/desk/shell";
import { AlertItem } from "@/components/desk/positions-ui";
import { DiversificationCard } from "@/components/desk/diversification-card";
import { diversify } from "@/lib/diversify";
import { sectorOf } from "@/lib/market/universe";
import { useDesk } from "@/store/desk";
import { Button } from "@/components/ui/button";
import { ZerodhaCard } from "@/components/desk/broker-ui";
import { SellCheck } from "@/components/desk/sell-check";
import { inr, istDate, istTime, pct } from "@/lib/format";
import { health, progress, type Health } from "@/lib/positions/rules";
import type { Position } from "@/lib/positions/types";
import { cn } from "@/lib/utils";
import { usePositions } from "@/store/positions";

const HEALTH_STYLE: Record<Health, string> = {
  "Stop hit": "bg-[var(--avoid-bg)] text-[var(--avoid-fg)]", "Near stop": "bg-[var(--avoid-bg)] text-[var(--avoid-fg)]",
  "In loss": "bg-[var(--watch-bg)] text-[var(--watch-fg)]", Healthy: "bg-muted text-foreground",
  "First exit hit": "bg-[var(--buy-bg)] text-[var(--buy-fg)]", "Near target": "bg-[var(--buy-bg)] text-[var(--buy-fg)]",
  "Target hit": "bg-[var(--strong-bg)] text-[var(--strong-fg)]", Closed: "bg-muted text-muted-foreground",
};

/** Stop ← buy → first exit → target, with today's price marked. */
function PriceRail({ p }: { p: Position }) {
  const price = p.lastPrice ?? p.buyPrice;
  const at = (v: number) => `${progress(p, v)}%`;
  return (
    <div className="pt-5 pb-6" role="img" aria-label={`Price ${inr(price)} between stop ${inr(p.stop)} and target ${inr(p.target)}`}>
      <div className="relative h-2 rounded-full bg-gradient-to-r from-neg/70 via-border to-pos/70">
        {[["Stop", p.stop, "text-neg"], ["Buy", p.buyPrice, "text-muted-foreground"], ["1st exit", p.partial, "text-pos"], ["Target", p.target, "text-pos"]].map(([l, v, c]) => (
          <span key={l as string} className="absolute top-0 -translate-x-1/2" style={{ left: at(v as number) }}>
            <i className="block h-2 w-0.5 bg-foreground/40" />
            <span className={cn("absolute top-3 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold tnum", c as string)}>{l}<br />{inr(v as number, 0)}</span>
          </span>
        ))}
        {p.lastPrice !== undefined && (
          <span className="absolute -top-5 -translate-x-1/2" style={{ left: at(price) }}>
            <span className="block whitespace-nowrap rounded bg-foreground px-1 text-[10px] font-bold text-background tnum">{inr(price)}</span>
            <i className="mx-auto block size-0 border-x-4 border-t-4 border-x-transparent border-t-foreground" />
          </span>
        )}
      </div>
    </div>
  );
}

function PositionCard({ p }: { p: Position }) {
  const close = usePositions((s) => s.close);
  const remove = usePositions((s) => s.remove);
  const allAlerts = usePositions((s) => s.alerts);
  const alerts = useMemo(() => allAlerts.filter((a) => a.positionId === p.id), [allAlerts, p.id]);
  const price = p.status === "closed" ? p.exitPrice! : p.lastPrice;
  const pnl = price !== undefined ? (price - p.buyPrice) * p.qty : undefined;
  const pnlPct = price !== undefined ? (price / p.buyPrice - 1) * 100 : undefined;
  const h = health(p, p.lastPrice);
  return (
    <article className="card p-4">
      <header className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold">{p.symbol}</h3>
            <span className={cn("rounded-md px-1.5 py-px text-[11px] font-bold", HEALTH_STYLE[h])}>{h}</span>
            {p.feed === "demo" && <span className="rounded-md bg-warn-bg px-1.5 py-px text-[10.5px] font-semibold text-warn-fg">Demo price</span>}
            {p.stopAtCost && p.status === "open" && <span className="rounded-md bg-primary-soft px-1.5 py-px text-[10.5px] font-semibold text-primary">Stop at cost</span>}
          </div>
          <p className="text-xs text-muted-foreground tnum">
            {p.qty} shares at {inr(p.buyPrice)} · {istDate(p.openedAt)}
            {p.status === "closed" ? ` · closed at ${inr(p.exitPrice!)}` : p.lastCheckedAt ? ` · checked ${istTime(p.lastCheckedAt)} IST` : " · not checked yet"}
          </p>
        </div>
        <div className="text-right tnum">
          <div className="text-lg font-bold">{price !== undefined ? inr(price) : "–"}</div>
          {pnl !== undefined && <div className={cn("text-[13px] font-semibold", pnl >= 0 ? "text-pos" : "text-neg")}>{pnl >= 0 ? "+" : ""}{inr(pnl, 0)} ({pct(pnlPct!)})</div>}
        </div>
      </header>
      <PriceRail p={p} />
      {alerts.length > 0 && (
        <details className="mt-1 rounded-lg bg-muted/40 px-3 py-2" open={alerts.some((a) => !a.read)}>
          <summary className="cursor-pointer text-[12.5px] font-semibold">{alerts.length} follow-up alert{alerts.length === 1 ? "" : "s"}</summary>
          <div className="mt-2 space-y-3">{alerts.map((a) => <AlertItem key={a.id} a={a} />)}</div>
        </details>
      )}
      <footer className="mt-3 flex flex-wrap justify-end gap-2">
        {p.status === "open" && <Button size="sm" variant="outline" onClick={() => close(p.id, p.lastPrice)}>Mark as sold{p.lastPrice !== undefined ? ` at ${inr(p.lastPrice)}` : ""}</Button>}
        <Button size="sm" variant="ghost" onClick={() => remove(p.id)} aria-label={`Delete ${p.symbol}`}><Trash2 />Delete</Button>
      </footer>
    </article>
  );
}

export default function PositionsPage() {
  const { positions, alerts, monitor, lastRunAt, loaded, checkNow, markAllRead } = usePositions();
  const [checking, setChecking] = useState(false);
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("default");
  useEffect(() => { setPerm(typeof Notification === "undefined" ? "unsupported" : Notification.permission); }, []);

  const open = positions.filter((p) => p.status === "open");
  const closed = positions.filter((p) => p.status === "closed");
  const invested = open.reduce((s, p) => s + p.buyPrice * p.qty, 0);
  const pnlOpen = open.reduce((s, p) => s + ((p.lastPrice ?? p.buyPrice) - p.buyPrice) * p.qty, 0);
  const pnlClosed = closed.reduce((s, p) => s + ((p.exitPrice ?? p.buyPrice) - p.buyPrice) * p.qty, 0);
  const unread = alerts.filter((a) => !a.read).length;
  const result = useDesk((s) => s.result);
  const balance = useMemo(() => {
    const known = new Map((result?.all ?? []).map((d) => [d.symbol, d]));
    return diversify(open.map((p) => {
      const d = known.get(p.symbol);
      return { symbol: p.symbol, sector: p.sector ?? d?.sector ?? sectorOf(p.symbol), cap: p.cap ?? d?.fundamentals?.cap ?? "Unknown",
        value: p.qty * (p.lastPrice ?? p.buyPrice), closes: d?.spark };
    }), result?.all ?? []);
  }, [open, result]);

  return (
    <>
      <PageHeader title="My Positions" subtitle="Trades you track. Momentum Agent and Trend Agent follow them up and alert you.">
        <Button variant="outline" size="sm" disabled={checking || !open.length} onClick={async () => { setChecking(true); await checkNow(); setChecking(false); }}>
          <RefreshCw className={cn(checking && "animate-spin")} />Check now
        </Button>
      </PageHeader>

      <div className="space-y-4">
        <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {[["Open positions", String(open.length), `${inr(invested, 0)} invested`],
            ["Open P&L", `${pnlOpen >= 0 ? "+" : ""}${inr(pnlOpen, 0)}`, "at the last checked prices"],
            ["Booked P&L", `${pnlClosed >= 0 ? "+" : ""}${inr(pnlClosed, 0)}`, `${closed.length} closed`],
            ["Unread alerts", String(unread), lastRunAt ? `last check ${istTime(lastRunAt)} IST` : "no checks yet"]].map(([l, v, s], i) => (
            <div key={l} className="card p-4">
              <div className="text-[13px] font-medium text-muted-foreground">{l}</div>
              <div className={cn("mt-1 text-2xl font-bold tnum", i === 1 && (pnlOpen >= 0 ? "text-pos" : "text-neg"), i === 2 && (pnlClosed >= 0 ? "text-pos" : "text-neg"))}>{v}</div>
              <div className="text-xs text-muted-foreground">{s}</div>
            </div>
          ))}
        </section>

        <ZerodhaCard />

        <SellCheck />

        <section className="card flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-[13px]">
          <span className="min-w-0 flex-1 basis-64">
            {monitor?.inApp
              ? <>Positions are saved in this browser. While the app is open, live positions are checked every <b>{monitor.minutes} min</b> during NSE hours (09:15–15:30 IST) and demo positions every minute; press Check now any time. Prices from Yahoo are delayed.</>
              : monitor?.enabled
              ? <>Live positions are checked every <b>{monitor.minutes} min</b> during NSE hours (09:15–15:30 IST); demo positions every minute. Prices from Yahoo are delayed.</>
              : <>The position monitor is off (POSITION_MONITOR_ENABLED=false). Use “Check now”.</>}
            {" "}Telegram alerts: <b>{monitor?.telegram ? "on" : "off"}</b>.
          </span>
          {perm === "default" && <Button size="sm" variant="outline" onClick={async () => setPerm(await Notification.requestPermission())}><Bell />Enable desktop alerts</Button>}
          {perm === "granted" && <span className="flex items-center gap-1 text-xs font-semibold text-pos"><Bell className="size-3.5" />Desktop alerts on</span>}
          {perm === "denied" && <span className="flex items-center gap-1 text-xs text-muted-foreground"><BellOff className="size-3.5" />Desktop alerts blocked in the browser</span>}
        </section>

        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-3">
            {open.length > 0 && <DiversificationCard d={balance} title="Portfolio balance" subtitle={`Your ${open.length} open position${open.length === 1 ? "" : "s"}, weighted by current value${result ? "; suggestions from the latest analysis" : ". Run an analysis to get suggestions"}.`} />}
            <h2 className="text-[15px] font-semibold">Open ({open.length})</h2>
            {!loaded ? <p className="text-sm text-muted-foreground">Loading…</p>
              : !open.length ? <div className="card px-4 py-10 text-center text-sm text-muted-foreground">No open positions. Run an analysis, open a pick and press <b>Track this trade</b>.</div>
              : open.map((p) => <PositionCard key={p.id} p={p} />)}
            {closed.length > 0 && <><h2 className="pt-2 text-[15px] font-semibold">Closed ({closed.length})</h2>{closed.map((p) => <PositionCard key={p.id} p={p} />)}</>}
          </div>

          <section id="alerts" className="card flex max-h-[calc(100dvh-8rem)] flex-col overflow-hidden xl:sticky xl:top-24">
            <header className="flex items-center justify-between border-b px-4 py-3">
              <div><h2 className="text-[15px] font-semibold">Alerts</h2><p className="text-xs text-muted-foreground">{unread} unread</p></div>
              {unread > 0 && <Button size="sm" variant="outline" onClick={markAllRead}>Mark all read</Button>}
            </header>
            <div className="flex-1 space-y-4 overflow-y-auto p-4 scroll-thin">
              {alerts.length ? alerts.map((a) => <AlertItem key={a.id} a={a} />) : <p className="py-8 text-center text-[13px] text-muted-foreground">No alerts yet.</p>}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
