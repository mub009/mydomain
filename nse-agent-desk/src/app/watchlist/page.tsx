"use client";

/** Watchlist: stocks you want to keep an eye on, separate from what you hold. */
import { Cloud, HardDrive, Loader2, StickyNote, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/desk/shell";
import { StockFinder } from "@/components/desk/stock-finder";
import { PlanTag } from "@/components/desk/chart-check";
import { VerdictBadge } from "@/components/desk/primitives";
import { CopySymbol, PriceCell, TradingViewLink } from "@/components/desk/stock-tools";
import { pct } from "@/lib/format";
import { cn } from "@/lib/utils";
import { DESK_API, useAuth } from "@/store/auth";
import { useDecided, useDesk } from "@/store/desk";
import { useQuotes } from "@/store/quotes";
import { useWatchlist, type WatchItem } from "@/store/watchlist";

function NoteField({ item }: { item: WatchItem }) {
  const add = useWatchlist((s) => s.add);
  const [v, setV] = useState(item.note ?? "");
  const [editing, setEditing] = useState(false);
  useEffect(() => setV(item.note ?? ""), [item.note]);
  const save = () => { setEditing(false); if ((item.note ?? "") !== v.trim()) add(item.symbol, { note: v.trim() || null }); };
  if (!editing) {
    return (
      <button type="button" onClick={() => setEditing(true)} className="flex min-w-0 items-center gap-1 text-left text-[12px] text-muted-foreground hover:text-foreground">
        <StickyNote className="size-3.5 shrink-0" /><span className="truncate">{item.note || "Add a note"}</span>
      </button>
    );
  }
  return (
    <input autoFocus value={v} maxLength={200} onChange={(e) => setV(e.target.value)} onBlur={save}
      onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") { setV(item.note ?? ""); setEditing(false); } }}
      placeholder="e.g. Buy near ₹1,400" aria-label={`Note for ${item.symbol}`}
      className="well h-8 w-full rounded-lg border-0 px-2 text-[12.5px]" />
  );
}

export default function WatchlistPage() {
  const { items, loaded, where, error, load, add, remove } = useWatchlist();
  const { token, ready, init } = useAuth();
  const run = useDecided();
  const searchStock = useDesk((s) => s.searchStock);
  const [adding, setAdding] = useState<string | null>(null);

  useEffect(() => { if (DESK_API && !ready) init(); }, [ready, init]);
  useEffect(() => { if (!DESK_API || ready) load(); }, [ready, token, load]);

  const quotes = useQuotes(useMemo(() => items.map((i) => i.symbol), [items]));
  const inRun = useMemo(() => new Map((run?.all ?? []).map((d) => [d.symbol, d])), [run]);

  async function addStock(symbol: string) {
    setAdding(symbol);
    let price = quotes[symbol]?.price;
    if (!price) {
      try { const r = await fetch(`/api/quotes?symbols=${encodeURIComponent(symbol)}`); price = (await r.json()).quotes?.[symbol]?.price; } catch { /* add without a price */ }
    }
    await add(symbol, { price });
    setAdding(null);
  }

  return (
    <>
      <PageHeader title="Watchlist" subtitle="Stocks to keep an eye on, separate from what you hold. Add any NSE stock; prices refresh every minute in market hours." />
      <div className="space-y-4">
        <section className="card space-y-3 p-4" aria-label="Add to watchlist">
          <div className="flex flex-wrap items-center gap-3">
            <StockFinder className="min-w-0 flex-1 basis-72" hotkey={false} placeholder="Add a stock: name or symbol…" onChoose={(h) => addStock(h.symbol)} />
            {adding && <span className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground"><Loader2 className="size-4 animate-spin" />Adding {adding}…</span>}
          </div>
          <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
            {where === "account" ? <><Cloud className="size-3.5" />Saved to your account: the same list on every device.</>
              : <><HardDrive className="size-3.5" />Saved in this browser.{DESK_API && <> <Link href="/login" className="font-semibold text-primary hover:underline">Log in</Link> to keep it on every device (this list moves to your account).</>}</>}
          </p>
          {error && <p className="flex items-center gap-1.5 text-[12.5px] text-neg"><X className="size-3.5" />{error}</p>}
        </section>

        <section className="card overflow-hidden" aria-label="Watchlist">
          <header className="flex items-center justify-between gap-2 border-b border-[var(--edge)] px-4 py-3">
            <h2 className="text-[15px] font-semibold">Your watchlist <span className="font-normal text-muted-foreground">{items.length}</span></h2>
            {run && <span className="text-[11.5px] text-muted-foreground">Verdicts from the last analysis</span>}
          </header>
          {!loaded ? (
            <p className="flex items-center gap-2 px-4 py-8 text-[13px] text-muted-foreground"><Loader2 className="size-4 animate-spin" />Loading…</p>
          ) : !items.length ? (
            <p className="px-4 py-10 text-center text-[13px] text-muted-foreground">Nothing here yet. Search above to add a stock, or press ☆ Watch in any stock&apos;s window.</p>
          ) : (
            <ul className="divide-y divide-[var(--edge)]">
              {items.map((it) => {
                const q = quotes[it.symbol];
                const d = inRun.get(it.symbol);
                const since = q && it.addedPrice ? (q.price / it.addedPrice - 1) * 100 : undefined;
                return (
                  <li key={it.symbol} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 px-4 py-3 sm:grid-cols-[minmax(0,1.4fr)_7rem_7.5rem_minmax(0,1fr)_auto]">
                    <div className="min-w-0">
                      <div className="flex items-center gap-0.5">
                        <button type="button" onClick={() => searchStock(it.symbol)} className="text-[14px] font-bold text-primary hover:underline" title="Open the agents' research">{it.symbol}</button>
                        <CopySymbol symbol={it.symbol} />
                      </div>
                      <div className="truncate text-[11.5px] text-muted-foreground">{q?.name ?? "NSE"}</div>
                    </div>
                    {q || it.addedPrice ? <PriceCell d={{ symbol: it.symbol, spark: [], entry: it.addedPrice ?? 0 }} q={q} /> : <span className="text-right text-muted-foreground">–</span>}
                    <div className="col-span-2 text-[12px] text-muted-foreground tnum sm:col-span-1 sm:text-right">
                      {since !== undefined ? <>Since added <b className={since >= 0 ? "text-pos" : "text-neg"}>{pct(since)}</b></> : "–"}
                      {it.addedAt && <div className="text-[11px]">{new Date(it.addedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}{it.addedPrice ? ` at ₹${it.addedPrice.toLocaleString("en-IN", { maximumFractionDigits: 2 })}` : ""}</div>}
                    </div>
                    <div className="col-span-2 flex min-w-0 flex-col gap-1 sm:col-span-1">
                      {d ? <span className="flex flex-wrap items-center gap-1.5"><VerdictBadge verdict={d.verdict} />{d.chart?.zone && <PlanTag zone={d.chart.zone} />}</span>
                        : <span className="text-[11.5px] text-muted-foreground">Not in the last analysis</span>}
                      <NoteField item={it} />
                    </div>
                    <div className={cn("col-span-2 flex items-center justify-end gap-1.5 sm:col-span-1")}>
                      <TradingViewLink symbol={it.symbol} compact className="h-8 px-2.5" />
                      <button type="button" onClick={() => remove(it.symbol)} aria-label={`Remove ${it.symbol} from the watchlist`} title="Remove"
                        className="btn-3d grid size-8 place-items-center rounded-xl text-muted-foreground hover:text-neg"><Trash2 className="size-4" /></button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
