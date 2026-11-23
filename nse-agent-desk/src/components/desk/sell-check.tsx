"use client";

/** Sell check: the agents look at what you already own and say Sell, Book profit or Hold. */
import { CircleCheck, CircleMinus, CircleX, Loader2, Plus, ScanSearch, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { BrokerHolding } from "@/lib/broker/zerodha";
import { ACTION_ORDER, type ExitAction, type ExitAdvice, type Holding } from "@/lib/exit-check";
import { commodityPicks, improvePortfolio } from "@/lib/improve";
import { LONG_TERM_LABEL, type LongTermAction } from "@/lib/long-term";
import { TIP_ICON } from "./my-position";
import { inr, pct } from "@/lib/format";
import { cn } from "@/lib/utils";
import { DESK_API, deskApi, useAuth } from "@/store/auth";
import { useDesk } from "@/store/desk";
import { useHoldings } from "@/store/holdings";
import { usePositions } from "@/store/positions";

const STYLE: Record<ExitAction, { cls: string; Icon: typeof CircleX; text: string }> = {
  SELL: { cls: "bg-neg/12 text-neg ring-neg/30", Icon: CircleX, text: "Sell" },
  "BOOK PROFIT": { cls: "bg-amber-500/12 text-amber-700 ring-amber-500/30 dark:text-amber-400", Icon: CircleMinus, text: "Book profit" },
  HOLD: { cls: "bg-pos/12 text-pos ring-pos/30", Icon: CircleCheck, text: "Hold" },
};

const LT_STYLE: Record<LongTermAction, string> = {
  ACCUMULATE: "bg-pos/12 text-pos ring-pos/30", HOLD: "bg-sky-500/12 text-sky-700 ring-sky-500/30 dark:text-sky-400",
  REDUCE: "bg-amber-500/12 text-amber-700 ring-amber-500/30 dark:text-amber-400", EXIT: "bg-neg/12 text-neg ring-neg/30",
};
const LT_ORDER: Record<LongTermAction, number> = { EXIT: 0, REDUCE: 1, HOLD: 2, ACCUMULATE: 3 };

type Result = { advice: ExitAdvice[]; missing: { symbol: string; why: string }[]; at: string };

/** Zerodha holdings from every connected account (NSE Desk API, or this site's own route). */
async function zerodhaHoldings(): Promise<Holding[]> {
  try {
    if (DESK_API && !useAuth.getState().token) return [];
    const s = DESK_API ? await deskApi<{ accounts?: { user?: { id: string }; holdings?: BrokerHolding[] }[] }>("/api/zerodha")
      : await (await fetch("/api/broker/zerodha", { cache: "no-store" })).json();
    return (s.accounts ?? []).flatMap((a: { user?: { id: string }; holdings?: BrokerHolding[] }) => (a.holdings ?? [])
      .filter((h) => h.exchange === "NSE" || h.exchange === "BSE")
      .map((h) => ({ symbol: h.symbol, qty: h.qty, avgPrice: h.avgPrice, source: `Zerodha ${a.user?.id ?? ""}`.trim() })));
  } catch { return []; }
}

export function SellCheck() {
  const positions = usePositions((s) => s.positions);
  const searchStock = useDesk((s) => s.searchStock);
  const lastRun = useDesk((s) => s.result);
  const extra = useHoldings((x) => x.extra);
  const setExtra = useHoldings((x) => x.setExtra);
  const [sym, setSym] = useState(""); const [qty, setQty] = useState(""); const [avg, setAvg] = useState("");
  const [busy, setBusy] = useState(false); const [step, setStep] = useState("");
  const [res, setRes] = useState<Result | null>(null); const [err, setErr] = useState<string | null>(null);
  const [view, setView] = useState<"short" | "long">("short");

  const tracked: Holding[] = positions.filter((p) => p.status === "open").map((p) => ({ symbol: p.symbol, qty: p.qty, avgPrice: p.buyPrice, source: "Tracked" }));

  async function run() {
    setBusy(true); setErr(null); setRes(null);
    try {
      setStep("Collecting your holdings…");
      const holdings = [...(await zerodhaHoldings()), ...tracked, ...extra];
      if (!holdings.length) throw new Error("Nothing to check yet: connect Zerodha, track a trade, or add a stock below.");
      setStep(`The agents are checking ${new Set(holdings.map((h) => h.symbol)).size} stock${holdings.length > 1 ? "s" : ""} on live data… (about a minute)`);
      const r = await fetch("/api/exit-check", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ holdings }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? `Error ${r.status}`);
      setRes(j);
    } catch (e) { setErr((e as Error).message); }
    setBusy(false); setStep("");
  }

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const s = sym.trim().toUpperCase(), q = Number(qty), a = Number(avg);
    if (!/^[A-Z0-9&.-]{1,20}$/.test(s) || !(q > 0) || !(a > 0)) { setErr("Enter an NSE symbol, a quantity and your buy price."); return; }
    setExtra((x) => [...x.filter((h) => h.symbol !== s), { symbol: s, qty: q, avgPrice: a, source: "Added" }]);
    setSym(""); setQty(""); setAvg(""); setErr(null);
  };

  const counts = res ? (["SELL", "BOOK PROFIT", "HOLD"] as ExitAction[]).map((k) => [k, res.advice.filter((x) => x.action === k).length] as const) : [];
  const ltCounts = res ? (["EXIT", "REDUCE", "HOLD", "ACCUMULATE"] as LongTermAction[]).map((k) => [k, res.advice.filter((x) => x.longTerm?.action === k).length] as const).filter(([, n]) => n > 0) : [];
  const rows = res ? [...res.advice].sort((a, b) => view === "short"
    ? ACTION_ORDER[a.action] - ACTION_ORDER[b.action] || a.pnlPct - b.pnlPct
    : (a.longTerm ? LT_ORDER[a.longTerm.action] : 9) - (b.longTerm ? LT_ORDER[b.longTerm.action] : 9) || (a.longTerm?.score ?? 0) - (b.longTerm?.score ?? 0)) : [];
  const field = "h-9 rounded-xl border border-[var(--edge)] bg-card px-3 text-[13px] outline-none focus:border-primary focus:ring-4 focus:ring-primary/15";

  return (
    <section className="card overflow-hidden" aria-label="Sell check">
      <header className="flex flex-wrap items-center gap-3 border-b border-[var(--edge)] px-4 py-3">
        <span className="grid size-9 place-items-center rounded-xl bg-neg/10 text-neg"><ScanSearch className="size-5" /></span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold">Sell check</h2>
          <p className="text-xs text-muted-foreground">Which of your stocks to sell, book profit on, or keep holding, from a fresh analysis by the agents.</p>
        </div>
        <Button onClick={run} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <ScanSearch />}{busy ? "Checking…" : res ? "Check again" : "Check my holdings"}</Button>
      </header>

      <div className="space-y-3 px-4 py-3">
        <p className="text-[12.5px] text-muted-foreground">
          Checks your Zerodha holdings (connected accounts), {tracked.length} tracked trade{tracked.length === 1 ? "" : "s"}{extra.length ? ` and ${extra.length} added below` : ""}. Add stocks you hold elsewhere:
        </p>
        <form onSubmit={add} className="flex flex-wrap items-end gap-2">
          <input aria-label="NSE symbol" className={cn(field, "w-32 uppercase")} placeholder="Symbol" value={sym} onChange={(e) => setSym(e.target.value)} />
          <input aria-label="Quantity" className={cn(field, "w-24")} inputMode="numeric" placeholder="Qty" value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))} />
          <input aria-label="Buy price" className={cn(field, "w-28")} inputMode="decimal" placeholder="Buy price ₹" value={avg} onChange={(e) => setAvg(e.target.value.replace(/[^\d.]/g, ""))} />
          <Button type="submit" size="sm" variant="outline"><Plus />Add</Button>
        </form>
        {extra.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {extra.map((h) => (
              <span key={h.symbol} className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[12px] tnum">
                <b>{h.symbol}</b> {h.qty} × {inr(h.avgPrice)}
                <button type="button" aria-label={`Remove ${h.symbol}`} onClick={() => setExtra((x) => x.filter((y) => y.symbol !== h.symbol))} className="ml-0.5 text-muted-foreground hover:text-foreground"><X className="size-3.5" /></button>
              </span>
            ))}
          </div>
        )}
        {busy && <p className="flex items-center gap-2 text-[13px] text-muted-foreground"><Loader2 className="size-4 animate-spin text-primary" />{step}</p>}
        {err && <p role="alert" className="text-[13px] font-medium text-neg">{err}</p>}
      </div>

      {res && (
        <div className="border-t border-[var(--edge)]">
          <div className="flex flex-wrap items-center gap-2 px-4 pt-3">
            <div role="tablist" aria-label="View" className="well inline-flex rounded-xl p-1">
              {([["short", "Short term (weeks)"], ["long", "Long term (1-3 years)"]] as const).map(([v, l]) => (
                <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)}
                  className={cn("rounded-lg px-3 py-1.5 text-[12.5px] font-medium", view === v ? "raised font-semibold text-foreground" : "text-muted-foreground")}>{l}</button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 px-4 py-3">
            {view === "long" ? ltCounts.map(([k, n]) => <span key={k} className={cn("rounded-full px-2.5 py-1 text-[12.5px] font-semibold ring-1", LT_STYLE[k])}>{n} {LONG_TERM_LABEL[k]}</span>) : counts.map(([k, n]) => { const S = STYLE[k]; return <span key={k} className={cn("flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] font-semibold ring-1", S.cls)}><S.Icon className="size-3.5" />{n} {S.text}</span>; })}
            <span className="ml-auto text-[11.5px] text-muted-foreground">Checked {new Date(res.at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })} IST</span>
          </div>
          <ul className="divide-y divide-[var(--edge)]">
            {rows.map((a) => {
              const S = STYLE[a.action];
              return (
                <li key={a.symbol} className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,180px)_minmax(0,1fr)_auto] sm:items-start">
                  <div>
                    <button type="button" onClick={() => searchStock(a.symbol)} className="text-[14px] font-bold text-primary hover:underline">{a.symbol}</button>
                    <div className="text-[11.5px] text-muted-foreground tnum">{a.qty} × {inr(a.avgPrice)} · now {inr(a.price)}</div>
                    <div className={cn("text-[12.5px] font-semibold tnum", a.pnlPct >= 0 ? "text-pos" : "text-neg")}>{pct(a.pnlPct)} · {a.pnl >= 0 ? "+" : "-"}{inr(Math.abs(a.pnl), 0)}</div>
                  </div>
                  <ul className="space-y-0.5 text-[12.5px] leading-snug text-muted-foreground">
                    {a.reasons.map((r) => <li key={r}>• {r}</li>)}
                    {a.stop !== undefined && <li className="text-foreground">• Keep the stop-loss at <b>{inr(a.stop)}</b>{a.target ? <>, target <b>{inr(a.target)}</b></> : null}</li>}
                    {a.longTerm ? (
                      <li className="mt-1.5 rounded-lg bg-muted/60 px-2.5 py-1.5">
                        <b className="text-foreground">Long term:</b> {a.longTerm.summary}
                        {a.together && <span className="mt-0.5 block font-medium text-foreground">{a.together}</span>}
                      </li>
                    ) : <li className="mt-1 text-[11.5px]">Long term: not enough financial data.</li>}
                    <li className="text-[11px]">Held in: {a.sources.join(", ")}</li>
                  </ul>
                  <div className="flex flex-wrap items-start gap-1.5 sm:flex-col sm:items-end sm:text-right">
                    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] font-bold ring-1", S.cls)} title="Short term (weeks)"><S.Icon className="size-3.5" />{S.text}</span>
                    {a.sellQty > 0 && <div className="text-[12px] font-medium tnum">{a.sellQty === a.qty ? `Sell all ${a.qty}` : `Sell ${a.sellQty} of ${a.qty}`}</div>}
                    {a.longTerm && <span className={cn("inline-flex rounded-full px-2.5 py-1 text-[11.5px] font-semibold ring-1", LT_STYLE[a.longTerm.action])} title="Long term (1-3 years)">Long term: {LONG_TERM_LABEL[a.longTerm.action]} · {a.longTerm.score}</span>}
                  </div>
                </li>
              );
            })}
          </ul>
          {res.advice.length > 0 && (() => {
            const pf = improvePortfolio(res.advice, commodityPicks(lastRun?.all ?? []));
            return (
              <div className="border-t border-[var(--edge)] px-4 py-4">
                <h3 className="text-[14px] font-bold">Improve my portfolio</h3>
                <div className="mt-2 grid gap-3 md:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
                  <div className="space-y-2.5 rounded-xl bg-muted/50 p-3 text-[12px] tnum">
                    <div>
                      <p className="mb-1 font-semibold">By sector</p>
                      {pf.sectors.slice(0, 6).map((x) => (
                        <div key={x.sector} className="flex items-center gap-2">
                          <span className="w-24 truncate text-muted-foreground">{x.sector}</span>
                          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><span className={cn("block h-full rounded-full", x.pct >= 40 ? "bg-amber-500" : "bg-primary")} style={{ width: `${x.pct}%` }} /></span>
                          <span className="w-9 text-right">{x.pct.toFixed(0)}%</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between border-t border-[var(--edge)] pt-2"><span className="text-muted-foreground">Commodity-linked</span><b>{pf.commodityPct.toFixed(0)}%</b></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Gold (ETF / bonds)</span><b>{pf.goldPct.toFixed(0)}%</b></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Largest holding</span><b>{pf.weights[0]?.symbol} {pf.weights[0]?.pct.toFixed(0)}%</b></div>
                  </div>
                  <ul className="space-y-2">
                    {pf.tips.map((t) => { const I = TIP_ICON[t.kind]; return (
                      <li key={t.title} className="flex gap-2.5 rounded-lg border px-3 py-2">
                        <I.Icon className={cn("mt-0.5 size-4 shrink-0", I.cls)} />
                        <span className="min-w-0"><b className="block text-[12.5px] font-semibold">{t.title}</b><span className="block text-[12px] leading-snug text-muted-foreground">{t.text}</span></span>
                      </li>
                    ); })}
                    {!lastRun && <li className="text-[11.5px] text-muted-foreground">Run an analysis on the Overview to also see commodity stocks the agents rate well today.</li>}
                  </ul>
                </div>
              </div>
            );
          })()}
          {res.missing.length > 0 && (
            <p className="border-t border-[var(--edge)] px-4 py-2.5 text-[12px] text-muted-foreground">Not checked: {res.missing.map((m) => `${m.symbol} (${m.why})`).join("; ")}.</p>
          )}
          <p className="border-t border-[var(--edge)] px-4 py-2.5 text-[11.5px] text-muted-foreground">
            Sell: a verified red flag, a loss past the stop-loss (8% or 3 days&apos; range, whichever is larger) or a broken trend. Book profit: 15%+ up while momentum fades or the rating drops: sell half and keep the rest. Research only, not investment advice.
          </p>
        </div>
      )}
    </section>
  );
}
