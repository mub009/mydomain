"use client";

/** Search any NSE stock by name or symbol and open it with the agents' full research. */
import { Loader2, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { StockHit } from "@/lib/market/search";
import { cn } from "@/lib/utils";
import { useDesk } from "@/store/desk";

export function StockFinder({ className }: { className?: string }) {
  const searchStock = useDesk((s) => s.searchStock);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<StockHit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  // "/" focuses the search from anywhere (except while typing in a field)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === "/" && !/INPUT|TEXTAREA|SELECT/.test(t.tagName) && !t.isContentEditable) { e.preventDefault(); ref.current?.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const text = q.trim();
    if (!text) { setHits([]); return; }
    const ctl = new AbortController();
    const t = setTimeout(() => {
      setLoading(true);
      fetch(`/api/search?q=${encodeURIComponent(text)}`, { signal: ctl.signal })
        .then((r) => (r.ok ? r.json() : { stocks: [] }))
        .then((j) => { setHits(j.stocks ?? []); setActive(0); })
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 200);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [q]);

  function pick(h: StockHit) {
    searchStock(h.symbol, { name: h.name, sector: h.sector });
    setQ(""); setHits([]); setOpen(false);
    ref.current?.blur();
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, hits.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Escape") { setOpen(false); ref.current?.blur(); }
    else if (e.key === "Enter") {
      e.preventDefault();
      if (hits[active]) pick(hits[active]);
      else if (/^[A-Za-z0-9&.-]{2,20}$/.test(q.trim())) pick({ symbol: q.trim().toUpperCase(), name: q.trim().toUpperCase() }); // a symbol typed in full
    }
  }

  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <input ref={ref} value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onKeyDown={onKey}
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        role="combobox" aria-expanded={open && hits.length > 0} aria-controls="stock-finder-list" aria-autocomplete="list"
        aria-activedescendant={open && hits[active] ? `finder-opt-${active}` : undefined}
        aria-label="Search any NSE stock" placeholder="Search any NSE stock…"
        className="well h-10 w-full rounded-xl border-0 pl-9 pr-9 text-[13.5px] placeholder:text-muted-foreground/70 focus-visible:outline-2 focus-visible:outline-primary" />
      {loading ? <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-label="Searching" />
        : !q && <kbd className="absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-[var(--edge)] px-1.5 text-[10.5px] text-muted-foreground sm:block">/</kbd>}
      {open && hits.length > 0 && (
        <ul id="stock-finder-list" role="listbox" aria-label="Matching NSE stocks"
          className="card absolute inset-x-0 top-[calc(100%+6px)] z-50 max-h-96 min-w-80 overflow-y-auto p-1.5 scroll-thin">
          {hits.map((h, i) => (
            <li key={h.symbol} id={`finder-opt-${i}`} role="option" aria-selected={i === active}
              onMouseDown={(e) => { e.preventDefault(); pick(h); }} onMouseEnter={() => setActive(i)}
              className={cn("flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px]", i === active && "bg-muted")}>
              <span className="min-w-0 flex-1">
                <b className="tnum">{h.symbol}</b>
                <span className="block truncate text-[11.5px] text-muted-foreground">{h.name}{h.industry ? ` · ${h.industry}` : ""}</span>
              </span>
              {h.sector && <span className="shrink-0 rounded-md bg-muted px-1.5 py-px text-[10.5px] font-semibold text-muted-foreground">{h.sector}</span>}
            </li>
          ))}
          <li role="presentation" className="px-2.5 pb-1 pt-1.5 text-[10.5px] text-muted-foreground">Opens the stock with the agents&apos; full research on live data</li>
        </ul>
      )}
    </div>
  );
}
