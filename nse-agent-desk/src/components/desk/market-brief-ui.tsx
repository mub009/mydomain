"use client";

/** Why the Nifty, Sensex, Bank Nifty, gold and silver moved today, and day by day. */
import { ArrowDownRight, ArrowUpRight, Loader2, Newspaper, RefreshCw, TrendingDown, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { AssetBrief, MarketBrief } from "@/lib/market-brief";
import { marketStatus } from "@/lib/market/calendar";
import { cn } from "@/lib/utils";

const fmt = (n: number, unit: string) => (unit === "pts" ? n.toLocaleString("en-IN", { maximumFractionDigits: 2 }) : `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`);
const pct = (n?: number) => (n === undefined || !Number.isFinite(n) ? "–" : `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`);
const day = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const tone = (n?: number) => (n === undefined || !Number.isFinite(n) ? "text-muted-foreground" : n >= 0 ? "text-pos" : "text-neg");

function useBrief() {
  const [b, setB] = useState<MarketBrief | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setBusy(true);
    try { const r = await fetch("/api/market-brief", { cache: "no-store" }); const j = await r.json(); if (!r.ok) throw new Error(j.error ?? `Error ${r.status}`); setB(j); setErr(null); }
    catch (e) { setErr((e as Error).message); }
    setBusy(false);
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(() => { if (marketStatus().open) load(); }, 5 * 60_000);
    return () => clearInterval(t);
  }, [load]);
  return { b, err, busy, load };
}

function AssetCard({ a }: { a: AssetBrief }) {
  const up = a.changePct >= 0;
  return (
    <article className="card flex flex-col p-4">
      <header className="flex items-start gap-3">
        <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", up ? "bg-pos/12 text-pos" : "bg-neg/12 text-neg")}>{up ? <TrendingUp className="size-5" /> : <TrendingDown className="size-5" />}</span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-bold">{a.name}</h3>
          <p className="text-[11.5px] text-muted-foreground">{a.unit === "pts" ? "points" : a.unit} · {day(a.date)}</p>
        </div>
        <div className="text-right tnum">
          <div className="text-[17px] font-bold">{fmt(a.price, a.unit)}</div>
          <div className={cn("flex items-center justify-end gap-0.5 text-[13px] font-semibold", up ? "text-pos" : "text-neg")}>
            {up ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}{a.change >= 0 ? "+" : ""}{fmt(Math.abs(a.change), a.unit).replace("₹", a.change < 0 ? "-₹" : "₹")} ({pct(a.changePct)})
          </div>
        </div>
      </header>
      <p className="mt-3 text-[13.5px] font-medium leading-snug">{a.headline}</p>
      {a.reasons.length > 1 && (
        <>
          <p className="mt-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Why</p>
          <ul className="mt-1 space-y-1 text-[12.5px] leading-snug">{a.reasons.map((r) => <li key={r} className="flex gap-1.5"><span className={up ? "text-pos" : "text-neg"}>●</span>{r}</li>)}</ul>
        </>
      )}
      {a.against.length > 0 && (
        <>
          <p className="mt-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Working against it</p>
          <ul className="mt-1 space-y-1 text-[12px] leading-snug text-muted-foreground">{a.against.map((r) => <li key={r} className="flex gap-1.5"><span>○</span>{r}</li>)}</ul>
        </>
      )}
      {a.news.length > 0 && (
        <div className="mt-3 border-t border-[var(--edge)] pt-2.5">
          <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"><Newspaper className="size-3" />In the news</p>
          <ul className="mt-1 space-y-1">
            {a.news.slice(0, 3).map((n) => (
              <li key={n.url} className="text-[12px] leading-snug">
                <a href={n.url} target="_blank" rel="noreferrer" className="hover:text-primary hover:underline">{n.title}</a>
                <span className="text-muted-foreground"> · {n.source}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

export function MarketBriefView() {
  const { b, err, busy, load } = useBrief();
  if (!b) return err ? <p className="card p-5 text-[13px] text-neg">Couldn&apos;t load today&apos;s market brief: {err}</p>
    : <p className="card flex items-center gap-2 p-5 text-[13px] text-muted-foreground"><Loader2 className="size-4 animate-spin" />Reading today&apos;s markets, gold and the news…</p>;
  const st = marketStatus();
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-[13px] text-muted-foreground">{st.open ? "Live session" : "Last session"}: <b className="text-foreground">{day(b.session)}</b>. Every reason comes from the day&apos;s data; headlines from Google News.</p>
        <button type="button" onClick={load} disabled={busy} className="btn-3d ml-auto inline-flex h-8 items-center gap-1.5 rounded-xl px-3 text-[12.5px] font-semibold"><RefreshCw className={cn("size-3.5", busy && "animate-spin")} />Refresh</button>
      </div>
      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">{b.assets.map((a) => <AssetCard key={a.id} a={a} />)}</div>

      <section className="card p-4">
        <h3 className="text-[14px] font-semibold">What else moved</h3>
        <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {b.context.map((c) => (
            <div key={c.name} className="well rounded-xl p-2.5">
              <dt className="text-[11.5px] text-muted-foreground">{c.name}</dt>
              <dd className={cn("text-[14px] font-bold tnum", tone(c.changePct))}>{c.name === "US 10-year yield" ? `${c.changePct >= 0 ? "+" : ""}${c.changePct.toFixed(2)} pts` : pct(c.changePct)}</dd>
              <dd className="text-[11px] text-muted-foreground">{c.note.replace(" (change in points)", "")}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="card overflow-hidden">
        <h3 className="px-4 pb-2 pt-4 text-[14px] font-semibold">Day by day <span className="font-normal text-muted-foreground">last 10 sessions</span></h3>
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full min-w-[640px] text-left text-[12.5px] tnum">
            <thead className="bg-muted/60 text-[10.5px] uppercase tracking-wide text-muted-foreground">
              <tr><th className="px-4 py-2">Day</th><th className="px-2 py-2 text-right">Nifty</th><th className="px-2 py-2 text-right">Bank Nifty</th><th className="px-2 py-2 text-right">Gold ₹</th><th className="px-2 py-2 text-right">USD/INR</th><th className="px-2 py-2 text-right">Crude</th><th className="px-4 py-2">Main driver</th></tr>
            </thead>
            <tbody>
              {b.days.map((d) => (
                <tr key={d.date} className="border-t">
                  <td className="whitespace-nowrap px-4 py-2 font-medium">{day(d.date)}</td>
                  <td className={cn("px-2 py-2 text-right font-semibold", tone(d.nifty))}>{pct(d.nifty)}</td>
                  <td className={cn("px-2 py-2 text-right", tone(d.banknifty))}>{pct(d.banknifty)}</td>
                  <td className={cn("px-2 py-2 text-right", tone(d.gold))}>{pct(d.gold)}</td>
                  <td className="px-2 py-2 text-right text-muted-foreground">{pct(d.usdinr)}</td>
                  <td className="px-2 py-2 text-right text-muted-foreground">{pct(d.crude)}</td>
                  <td className="px-4 py-2 text-muted-foreground">{d.why || "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="px-4 py-2.5 text-[11.5px] text-muted-foreground">Gold and silver are international prices converted to rupees (without import duty and GST), so they differ a little from jewellers&apos; rates. Main driver: the sector that moved most in the Nifty&apos;s direction. Prices from Yahoo Finance (delayed).</p>
      </section>
    </div>
  );
}

/** Compact version for the Overview: one line each for the Nifty and gold. */
export function MarketTodayCard() {
  const { b } = useBrief();
  if (!b) return null;
  const pick = b.assets.filter((a) => a.id === "nifty" || a.id === "banknifty" || a.id === "gold");
  return (
    <section className="card p-4" aria-label="Market today">
      <div className="flex items-center gap-2">
        <h2 className="text-[15px] font-semibold">Market today</h2>
        <span className="text-[11.5px] text-muted-foreground">{day(b.session)}</span>
        <Link href="/markets?tab=today" className="ml-auto text-[12.5px] font-semibold text-primary hover:underline">Why? Full brief →</Link>
      </div>
      <ul className="mt-2 space-y-2">
        {pick.map((a) => (
          <li key={a.id} className="flex gap-2.5 text-[13px] leading-snug">
            <span className={cn("mt-0.5 w-16 shrink-0 text-right font-bold tnum", a.changePct >= 0 ? "text-pos" : "text-neg")}>{pct(a.changePct)}</span>
            <span className="min-w-0">{a.headline}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
