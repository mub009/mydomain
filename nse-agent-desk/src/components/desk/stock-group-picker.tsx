"use client";

/**
 * Build your own group of stocks to analyse: search by company name or
 * symbol, add a whole sector, paste a list of names, and save groups to reuse.
 */
import { Check, FolderOpen, Layers, Loader2, Plus, Save, Search, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { GroupHit, SearchResult, StockHit } from "@/lib/market/search";
import { cn } from "@/lib/utils";
import { symbolsOf, useDesk } from "@/store/desk";

const MAX = 150;
type Option = { kind: "group"; g: GroupHit } | { kind: "stock"; s: StockHit };

async function search(q: string, signal?: AbortSignal): Promise<SearchResult> {
  const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal });
  if (!r.ok) throw new Error(`Search failed (HTTP ${r.status})`);
  return r.json();
}

export function StockGroupPicker() {
  const custom = useDesk((s) => s.custom);
  const stockInfo = useDesk((s) => s.stockInfo);
  const groups = useDesk((s) => s.groups);
  const set = useDesk((s) => s.set);
  const selected = useMemo(() => symbolsOf({ universe: "custom", custom }), [custom]);
  const chosen = new Set(selected);

  const [q, setQ] = useState("");
  const [res, setRes] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const [naming, setNaming] = useState(false);
  const [groupName, setGroupName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const parts = q.split(/[,;\n]+/).map((x) => x.trim()).filter(Boolean);
  const isList = parts.length >= 2;

  // live suggestions while typing one name
  useEffect(() => {
    if (isList || q.trim().length < 1) { setRes(null); return; }
    const ctl = new AbortController();
    const t = setTimeout(() => {
      setLoading(true);
      search(q.trim(), ctl.signal).then((r) => { setRes(r); setActive(0); }).catch(() => {}).finally(() => setLoading(false));
    }, 200);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [q, isList]);

  const options: Option[] = useMemo(() => [
    ...(res?.groups ?? []).map((g) => ({ kind: "group" as const, g })),
    ...(res?.stocks ?? []).map((s) => ({ kind: "stock" as const, s })),
  ], [res]);

  function add(hits: StockHit[]) {
    const fresh = hits.filter((h) => !chosen.has(h.symbol));
    const room = MAX - selected.length;
    const take = fresh.slice(0, Math.max(0, room));
    if (!take.length) { setNote(fresh.length ? `Your list is full (${MAX} stocks).` : "Already in your list."); return; }
    const info = { ...stockInfo };
    for (const h of take) info[h.symbol] = { name: h.name, sector: h.sector ?? info[h.symbol]?.sector };
    set({ custom: [...selected, ...take.map((h) => h.symbol)].join(", "), stockInfo: info });
    setNote(take.length < fresh.length ? `Added ${take.length}; the list holds at most ${MAX}.` : take.length > 1 ? `Added ${take.length} stocks.` : null);
  }

  function pick(o: Option) {
    if (o.kind === "group") add(o.g.symbols.map((symbol) => ({ symbol, name: stockInfo[symbol]?.name ?? symbol, sector: o.g.name.replace(/ \(.*\)$/, "") })));
    else if (chosen.has(o.s.symbol)) remove(o.s.symbol);
    else add([o.s]);
    setQ(""); setRes(null); setOpen(false);
    inputRef.current?.focus();
  }

  /** Paste "tcs, infosys, hdfc bank": find the first NSE match for each name. */
  async function addList() {
    setLoading(true); setNote(null);
    const found: StockHit[] = [], missing: string[] = [];
    for (const p of parts.slice(0, 60)) {
      try {
        const r = await search(p);
        const exact = r.stocks.find((s) => s.symbol === p.toUpperCase());
        const hit = exact ?? r.stocks[0];
        if (hit) found.push(hit); else missing.push(p);
      } catch { missing.push(p); }
    }
    setLoading(false);
    add(found);
    if (missing.length) setNote(`Not found on NSE: ${missing.join(", ")}`);
    setQ("");
  }

  function remove(sym: string) {
    set({ custom: selected.filter((s) => s !== sym).join(", ") });
  }

  function saveGroup() {
    const name = groupName.trim().slice(0, 40);
    if (!name || selected.length < 1) return;
    set({ groups: [...groups.filter((g) => g.name !== name), { name, symbols: selected }] });
    setNaming(false); setGroupName(""); setNote(`Saved "${name}" (${selected.length} stocks).`);
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (isList) addList();
      else if (options[active]) pick(options[active]);
    } else if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, options.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Escape") setOpen(false);
  }

  const valid = selected.length >= 3 && selected.length <= MAX;

  return (
    <div className="w-full space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input ref={inputRef} value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); setNote(null); }} onKeyDown={onKey}
            onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
            role="combobox" aria-expanded={open && options.length > 0} aria-controls="stock-search-list" aria-autocomplete="list"
            aria-activedescendant={open && options[active] ? `stock-opt-${active}` : undefined}
            aria-label="Search NSE stocks by company name or symbol"
            placeholder="Search a company or symbol, a sector (bank, pharma), or paste names: tcs, infosys, wipro"
            className="well h-11 w-full rounded-xl border-0 pl-9 pr-9 text-[13.5px] placeholder:text-muted-foreground/70 focus-visible:outline-2 focus-visible:outline-primary" />
          {loading && <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-label="Searching" />}

          {open && !isList && options.length > 0 && (
            <ul id="stock-search-list" role="listbox" aria-label="Matching stocks"
              className="card absolute inset-x-0 top-[calc(100%+6px)] z-40 max-h-80 overflow-y-auto p-1.5 scroll-thin">
              {options.map((o, i) => {
                const on = o.kind === "stock" && chosen.has(o.s.symbol);
                return (
                  <li key={o.kind === "group" ? `g:${o.g.name}` : o.s.symbol} id={`stock-opt-${i}`} role="option" aria-selected={i === active}
                    onMouseDown={(e) => { e.preventDefault(); pick(o); }} onMouseEnter={() => setActive(i)}
                    className={cn("flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px]", i === active && "bg-muted")}>
                    {o.kind === "group" ? (
                      <>
                        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary"><Layers className="size-4" /></span>
                        <span className="min-w-0 flex-1"><b>Add all {o.g.name}</b><span className="block truncate text-[11.5px] text-muted-foreground">{o.g.symbols.length} stocks: {o.g.symbols.slice(0, 6).join(", ")}{o.g.symbols.length > 6 ? "…" : ""}</span></span>
                      </>
                    ) : (
                      <>
                        <span className={cn("grid size-7 shrink-0 place-items-center rounded-lg", on ? "bg-[var(--buy-bg)] text-[var(--buy-fg)]" : "bg-muted text-muted-foreground")}>{on ? <Check className="size-4" /> : <Plus className="size-4" />}</span>
                        <span className="min-w-0 flex-1">
                          <b className="tnum">{o.s.symbol}</b>
                          <span className="block truncate text-[11.5px] text-muted-foreground">{o.s.name}{o.s.industry ? ` · ${o.s.industry}` : ""}</span>
                        </span>
                        {o.s.sector && <span className="shrink-0 rounded-md bg-muted px-1.5 py-px text-[10.5px] font-semibold text-muted-foreground">{o.s.sector}</span>}
                      </>
                    )}
                  </li>
                );
              })}
              {res?.source && <li className="px-2.5 pb-1 pt-1.5 text-[10.5px] text-muted-foreground" role="presentation">NSE listings · {res.source}</li>}
            </ul>
          )}
        </div>
        {isList && (
          <button type="button" onClick={addList} disabled={loading} className="btn-3d-primary inline-flex h-10 items-center gap-1.5 rounded-xl px-3.5 text-[13px] font-semibold text-white">
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}Add {parts.length} names
          </button>
        )}
      </div>

      {groups.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5" aria-label="Saved groups">
          <span className="mr-0.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"><FolderOpen className="size-3.5" />Saved groups</span>
          {groups.map((g) => (
            <span key={g.name} className="btn-3d inline-flex h-7 items-center rounded-lg text-[12px]">
              <button type="button" onClick={() => { set({ custom: g.symbols.join(", ") }); setNote(`Loaded "${g.name}".`); }} className="px-2 font-semibold" title={g.symbols.join(", ")}>
                {g.name} <span className="font-normal text-muted-foreground">{g.symbols.length}</span>
              </button>
              <button type="button" onClick={() => set({ groups: groups.filter((x) => x.name !== g.name) })} aria-label={`Delete group ${g.name}`} className="border-l border-[var(--edge)] px-1.5 text-muted-foreground hover:text-neg"><X className="size-3" /></button>
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5" aria-label="Stocks in your list">
        <span className={cn("mr-0.5 text-[11px] font-semibold uppercase tracking-wide", valid ? "text-muted-foreground" : "text-neg")}>
          My list · {selected.length}{!valid && " (pick 3 to 150)"}
        </span>
        {selected.map((sym) => (
          <span key={sym} className="raised inline-flex h-7 items-center gap-1 rounded-lg pl-2 pr-1 text-[12px]" title={stockInfo[sym]?.name ?? sym}>
            <b className="tnum">{sym}</b>
            {stockInfo[sym]?.sector && <span className="text-[10.5px] text-muted-foreground">{stockInfo[sym].sector}</span>}
            <button type="button" onClick={() => remove(sym)} aria-label={`Remove ${sym}`} className="grid size-5 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-neg"><X className="size-3" /></button>
          </span>
        ))}
        {selected.length > 0 && (
          <span className="ml-auto flex items-center gap-1.5">
            {naming ? (
              <form onSubmit={(e) => { e.preventDefault(); saveGroup(); }} className="flex items-center gap-1.5">
                <input autoFocus value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Group name" aria-label="Group name" maxLength={40}
                  className="well h-7 w-36 rounded-lg border-0 px-2 text-[12px]" />
                <button type="submit" className="btn-3d-primary h-7 rounded-lg px-2.5 text-[12px] font-semibold text-white">Save</button>
                <button type="button" onClick={() => setNaming(false)} className="h-7 px-1.5 text-[12px] text-muted-foreground">Cancel</button>
              </form>
            ) : (
              <button type="button" onClick={() => setNaming(true)} className="btn-3d inline-flex h-7 items-center gap-1 rounded-lg px-2 text-[12px] font-semibold"><Save className="size-3.5" />Save as group</button>
            )}
            <button type="button" onClick={() => set({ custom: "" })} className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-[12px] text-muted-foreground hover:text-neg"><Trash2 className="size-3.5" />Clear</button>
          </span>
        )}
      </div>
      {note && <p className="text-[12px] text-muted-foreground" role="status">{note}</p>}
    </div>
  );
}
