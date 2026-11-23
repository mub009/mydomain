"use client";

/** Sell check: the agents look at what you already own and say Sell, Book profit or Hold. */
import { CircleCheck, CircleMinus, CircleX, Loader2, Plus, ScanSearch, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { BrokerHolding } from "@/lib/broker/zerodha";
import type { ExitAction, ExitAdvice, Holding } from "@/lib/exit-check";
import { inr, pct } from "@/lib/format";
import { cn } from "@/lib/utils";
import { DESK_API, deskApi, useAuth } from "@/store/auth";
import { useDesk } from "@/store/desk";
import { usePositions } from "@/store/positions";

const STYLE: Record<ExitAction, { cls: string; Icon: typeof CircleX; text: string }> = {
  SELL: { cls: "bg-neg/12 text-neg ring-neg/30", Icon: CircleX, text: "Sell" },
  "BOOK PROFIT": { cls: "bg-amber-500/12 text-amber-700 ring-amber-500/30 dark:text-amber-400", Icon: CircleMinus, text: "Book profit" },
  HOLD: { cls: "bg-pos/12 text-pos ring-pos/30", Icon: CircleCheck, text: "Hold" },
};

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
  const [extra, setExtra] = useState<Holding[]>([]);
  const [sym, setSym] = useState(""); const [qty, setQty] = useState(""); const [avg, setAvg] = useState("");
  const [busy, setBusy] = useState(false); const [step, setStep] = useState("");
  const [res, setRes] = useState<Result | null>(null); const [err, setErr] = useState<string | null>(null);

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
          <div className="flex flex-wrap items-center gap-2 px-4 py-3">
            {counts.map(([k, n]) => { const S = STYLE[k]; return <span key={k} className={cn("flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] font-semibold ring-1", S.cls)}><S.Icon className="size-3.5" />{n} {S.text}</span>; })}
            <span className="ml-auto text-[11.5px] text-muted-foreground">Checked {new Date(res.at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })} IST</span>
          </div>
          <ul className="divide-y divide-[var(--edge)]">
            {res.advice.map((a) => {
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
                    <li className="text-[11px]">Held in: {a.sources.join(", ")}</li>
                  </ul>
                  <div className="sm:text-right">
                    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] font-bold ring-1", S.cls)}><S.Icon className="size-3.5" />{S.text}</span>
                    {a.sellQty > 0 && <div className="mt-1 text-[12px] font-medium tnum">{a.sellQty === a.qty ? `Sell all ${a.qty}` : `Sell ${a.sellQty} of ${a.qty}`}</div>}
                  </div>
                </li>
              );
            })}
          </ul>
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
