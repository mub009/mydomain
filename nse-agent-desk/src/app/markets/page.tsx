"use client";

import { CalendarDays, Globe2, Loader2, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/desk/shell";
import type { MarketEvent } from "@/lib/events";
import type { WorldQuote } from "@/lib/world";
import { cn } from "@/lib/utils";
import { useDesk } from "@/store/desk";

const REGIONS: WorldQuote["region"][] = ["India", "Asia-Pacific", "Europe", "Americas", "Middle East & Africa"];
const pct = (n?: number) => (n === undefined ? "–" : `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`);
const num = (n?: number) => (n === undefined ? "–" : n.toLocaleString("en-IN", { maximumFractionDigits: n > 1000 ? 0 : 2 }));

function Spark({ data, up }: { data: number[]; up: boolean }) {
  if (data.length < 2) return <div className="h-10" />;
  const min = Math.min(...data), max = Math.max(...data), w = 120, h = 36;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / (max - min || 1)) * (h - 4) - 2}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-10 w-full" preserveAspectRatio="none" aria-hidden>
      <polyline points={pts} fill="none" strokeWidth={1.75} strokeLinejoin="round" style={{ stroke: up ? "var(--pos)" : "var(--neg)" }} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function localTime(tz?: string) {
  if (!tz) return "";
  try { return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: tz }).format(new Date()); } catch { return ""; }
}

function WorldIndices() {
  const [data, setData] = useState<WorldQuote[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [at, setAt] = useState<string>();
  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/world").then((r) => r.json()).then((j) => { setData(j.indices); setAt(j.at); }).catch(() => {}).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 120_000); return () => clearInterval(t); }, [load]);

  const ok = data?.filter((x) => x.change1d !== undefined) ?? [];
  const up = ok.filter((x) => x.change1d! >= 0).length;
  return (
    <div className="space-y-5">
      <div className="card flex flex-wrap items-center gap-3 p-3.5 text-[13px]">
        <Globe2 className="size-5 text-primary" aria-hidden />
        <span className="min-w-0 flex-1">
          {data ? <><b>{up}</b> of {ok.length} markets up today · <b>{data.filter((x) => x.open).length}</b> open now. Delayed quotes from Yahoo Finance{at ? `, updated ${new Date(at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}` : ""}; refreshes every 2 minutes.</> : "Loading world markets…"}
        </span>
        <button type="button" onClick={load} disabled={loading} className="btn-3d inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-semibold">
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}Refresh
        </button>
      </div>
      {REGIONS.map((region) => {
        const rows = data?.filter((x) => x.region === region) ?? [];
        if (!rows.length) return null;
        return (
          <section key={region} aria-label={region}>
            <h2 className="mb-2 text-[12px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{region}</h2>
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-3 2xl:grid-cols-4">
              {rows.map((x) => {
                const upDay = (x.change1d ?? 0) >= 0;
                return (
                  <article key={x.symbol} className="card lift min-w-0 p-3 sm:p-3.5">
                    <div className="flex items-start gap-2">
                      <span className="text-lg leading-none sm:text-xl" aria-hidden>{x.flag}</span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-bold sm:text-[14px]">{x.name}</div>
                        <div className="truncate text-[11.5px] text-muted-foreground">{x.country}</div>
                      </div>
                      <span title={`${x.open ? "Open" : "Closed"} · local time ${localTime(x.timezone)}`} className={cn("flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold sm:px-2", x.open ? "bg-[var(--buy-bg)] text-[var(--buy-fg)]" : "bg-muted text-muted-foreground")}>
                        <i className={cn("size-1.5 rounded-full", x.open ? "animate-pulse bg-pos" : "bg-[var(--other-dot)]")} /><span className="max-sm:hidden">{x.open ? "Open" : "Closed"} · {localTime(x.timezone)}</span>
                      </span>
                    </div>
                    {x.error ? <p className="mt-3 text-[12px] text-muted-foreground">Not available right now.</p> : (
                      <>
                        <div className="mt-2 flex items-baseline justify-between gap-2 tnum">
                          <span className="truncate text-[16px] font-bold sm:text-[20px]">{num(x.price)}</span>
                          <span className={cn("shrink-0 text-[12px] font-bold sm:text-[13px]", upDay ? "text-pos" : "text-neg")}>{pct(x.change1d)}</span>
                        </div>
                        <Spark data={x.spark} up={(x.change1m ?? 0) >= 0} />
                        <div className="flex justify-between text-[11px] text-muted-foreground tnum"><span>1M {pct(x.change1m)}</span><span>{x.currency ?? ""}</span></div>
                      </>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

const TYPE_STYLE: Record<MarketEvent["type"], string> = {
  Results: "bg-primary-soft text-primary",
  "Ex-dividend": "bg-[var(--watch-bg)] text-[var(--watch-fg)]",
  "Dividend payment": "bg-[var(--buy-bg)] text-[var(--buy-fg)]",
  "Policy decision": "bg-[var(--avoid-bg)] text-[var(--avoid-fg)]",
};

function Events() {
  const result = useDesk((s) => s.result);
  const searchStock = useDesk((s) => s.searchStock);
  const [scope, setScope] = useState<"India" | "Global" | "Both">("Both");
  const [type, setType] = useState<"All" | "Results" | "Dividends" | "Central banks">("All");
  const [confirmedOnly, setConfirmedOnly] = useState(false);
  const [india, setIndia] = useState<MarketEvent[] | null>(null);
  const [global, setGlobal] = useState<MarketEvent[] | null>(null);
  const symbols = result?.all.map((d) => d.symbol).join(",");

  useEffect(() => {
    setIndia(null);
    fetch(`/api/events?scope=india${symbols ? `&symbols=${encodeURIComponent(symbols)}` : ""}`).then((r) => r.json()).then((j) => setIndia(j.events ?? [])).catch(() => setIndia([]));
  }, [symbols]);
  useEffect(() => { fetch("/api/events?scope=global").then((r) => r.json()).then((j) => setGlobal(j.events ?? [])).catch(() => setGlobal([])); }, []);

  const loading = (scope !== "Global" && india === null) || (scope !== "India" && global === null);
  const list = useMemo(() => [...(scope !== "Global" ? india ?? [] : []), ...(scope !== "India" ? global ?? [] : [])]
    .filter((e) => type === "All" || (type === "Results" ? e.type === "Results" : type === "Central banks" ? e.type === "Policy decision" : e.type === "Ex-dividend" || e.type === "Dividend payment"))
    .filter((e) => !confirmedOnly || e.status === "Confirmed")
    .sort((a, b) => a.date.localeCompare(b.date)), [india, global, scope, type, confirmedOnly]);
  const byDate = useMemo(() => {
    const m = new Map<string, MarketEvent[]>();
    for (const e of list) m.set(e.date, [...(m.get(e.date) ?? []), e]);
    return [...m.entries()];
  }, [list]);
  const today = new Date(Date.now() + 19800_000).toISOString().slice(0, 10);
  const daysTo = (d: string) => Math.round((Date.parse(d) - Date.parse(today)) / 86400_000);

  const Seg = <T extends string>({ value, set, opts, label }: { value: T; set: (v: T) => void; opts: T[]; label: string }) => (
    <div role="radiogroup" aria-label={label} className="well inline-flex h-9 items-center gap-0.5 rounded-xl p-1">
      {opts.map((o) => (
        <button key={o} type="button" role="radio" aria-checked={value === o} onClick={() => set(o)}
          className={cn("h-full rounded-lg px-2.5 text-[12.5px] font-medium", value === o ? "raised -translate-y-px font-semibold text-foreground" : "text-muted-foreground hover:text-foreground")}>{o}</button>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center gap-3 p-3.5">
        <Seg label="Markets" value={scope} set={setScope} opts={["Both", "India", "Global"]} />
        <Seg label="Event type" value={type} set={setType} opts={["All", "Results", "Dividends", "Central banks"]} />
        <label className="flex items-center gap-2 text-[13px] font-medium">
          <input type="checkbox" checked={confirmedOnly} onChange={(e) => setConfirmedOnly(e.target.checked)} className="accent-[var(--primary)]" />Confirmed only
        </label>
        <span className="ml-auto text-[12px] text-muted-foreground">
          Next 4 months · India: {symbols ? "stocks in your current run" : "the built-in Nifty, mid and small cap lists"} · Global: 25 of the world&apos;s largest companies
        </span>
      </div>
      <p className="text-[12px] text-muted-foreground">
        <b>Confirmed</b>: announced by the company. <b>Expected</b>: projected from last year (Indian dividends from NSE&apos;s official corporate actions) or a date the company hasn&apos;t confirmed yet. On the ex-dividend date the price usually drops by about the dividend.
      </p>
      {loading && <div className="card flex items-center gap-2 p-5 text-[13px] text-muted-foreground"><Loader2 className="size-4 animate-spin" />Collecting results dates and dividends… (the Indian list takes up to 20 seconds the first time)</div>}
      {!loading && !list.length && <div className="card p-8 text-center text-[13px] text-muted-foreground">No events in the next 4 months for these filters.</div>}
      {byDate.map(([date, evs]) => (
        <section key={date} className="card overflow-hidden" aria-label={date}>
          <header className="flex items-baseline justify-between border-b border-[var(--edge)] bg-muted/40 px-4 py-2">
            <h2 className="text-[13.5px] font-bold">{new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</h2>
            <span className="text-[11.5px] text-muted-foreground">{daysTo(date) === 0 ? "today" : daysTo(date) === 1 ? "tomorrow" : `in ${daysTo(date)} days`}</span>
          </header>
          <ul className="divide-y divide-[var(--edge)]">
            {evs.map((e, i) => (
              <li key={`${e.symbol}-${e.type}-${i}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-[13px]">
                <span className="text-lg leading-none" aria-hidden>{e.flag}</span>
                <span className="min-w-0 flex-1 basis-56">
                  {e.scope === "India" && e.type !== "Policy decision"
                    ? <button type="button" onClick={() => searchStock(e.symbol, { name: e.name })} className="font-bold text-primary hover:underline">{e.symbol}</button>
                    : <b>{e.name}</b>}
                  <span className="ml-1.5 text-[12px] text-muted-foreground">{e.scope === "India" ? e.name : `${e.symbol} · ${e.country}`}</span>
                </span>
                <span className={cn("rounded-md px-1.5 py-px text-[11px] font-bold", TYPE_STYLE[e.type])}>{e.type}</span>
                <span className={cn("rounded-md px-1.5 py-px text-[11px] font-semibold", e.status === "Confirmed" ? "bg-[var(--buy-bg)] text-[var(--buy-fg)]" : "bg-muted text-muted-foreground")}>{e.status}</span>
                {e.amount !== undefined && <span className="tnum font-semibold">{e.currency === "INR" || e.scope === "India" ? "₹" : `${e.currency ?? ""} `}{e.amount}</span>}
                <span className="w-full pl-8 text-[11px] text-muted-foreground sm:w-auto sm:pl-0">{[e.note, e.source].filter(Boolean).join(" · ")}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export default function MarketsPage() {
  const [tab, setTab] = useState<"world" | "events">("world");
  return (
    <>
      <PageHeader title="Markets" subtitle="World indices, and upcoming results and dividends." />
      <div className="space-y-4">
        <div role="tablist" aria-label="Markets view" className="well inline-flex h-10 items-center gap-0.5 rounded-xl p-1">
          {([["world", "World indices", Globe2], ["events", "Upcoming events", CalendarDays]] as const).map(([v, l, I]) => (
            <button key={v} type="button" role="tab" aria-selected={tab === v} onClick={() => setTab(v)}
              className={cn("flex h-full items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium", tab === v ? "raised -translate-y-px font-semibold text-foreground" : "text-muted-foreground hover:text-foreground")}>
              <I className="size-4" />{l}
            </button>
          ))}
        </div>
        {tab === "world" ? <WorldIndices /> : <Events />}
      </div>
    </>
  );
}
