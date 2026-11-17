"use client";

import { type ColumnDef, flexRender, getCoreRowModel, getSortedRowModel, type SortingState, useReactTable } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { DataBanner, RiskTag, VerdictBadge } from "@/components/desk/primitives";
import { PageHeader } from "@/components/desk/shell";
import { StockSparkline } from "@/components/desk/stock-sparkline";
import { PlanTag, TimeframeDots } from "@/components/desk/chart-check";
import { CapTag, EpsGrowth } from "@/components/desk/fundamentals";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/segmented";
import { inr, pct } from "@/lib/format";
import type { Decision, Verdict } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useDecided, useDesk } from "@/store/desk";

const VERDICTS: ("ALL" | Verdict)[] = ["ALL", "STRONG BUY", "BUY", "WATCH", "AVOID"];
const RISK_ORDER = { LOW: 0, MEDIUM: 1, HIGH: 2 };
const signed = (v: number) => <span className={v >= 0 ? "text-pos" : "text-neg"}>{pct(v)}</span>;

const columns: ColumnDef<Decision>[] = [
  { accessorKey: "symbol", header: "Stock", cell: ({ row: { original: d } }) => <div><div className="font-semibold">{d.symbol}</div><div className="text-[11px] text-muted-foreground">{d.sector}</div></div> },
  { accessorKey: "verdict", header: "Verdict", enableSorting: false, cell: ({ row }) => <VerdictBadge verdict={row.original.verdict} /> },
  { accessorKey: "combined", header: "Combined", meta: { num: true }, cell: ({ getValue }) => <b>{(getValue() as number).toFixed(1)}</b> },
  { accessorKey: "lotappi", header: "Momentum", meta: { num: true }, cell: ({ getValue }) => (getValue() as number).toFixed(1) },
  { accessorKey: "mayavi", header: "Trend", meta: { num: true }, cell: ({ getValue }) => (getValue() as number).toFixed(1) },
  { id: "risk", accessorFn: (d) => RISK_ORDER[d.risk], header: "Risk", cell: ({ row }) => <RiskTag risk={row.original.risk} /> },
  { id: "spark", header: "60-day", enableSorting: false, cell: ({ row }) => <StockSparkline data={row.original.spark} width={76} height={24} showChange={false} /> },
  { accessorKey: "rsi", header: "RSI", meta: { num: true }, cell: ({ getValue }) => (getValue() as number).toFixed(0) },
  { accessorKey: "ret5d", header: "5-day %", meta: { num: true }, cell: ({ getValue }) => signed(getValue() as number) },
  { accessorKey: "ret21d", header: "1-month %", meta: { num: true }, cell: ({ getValue }) => signed(getValue() as number) },
  { accessorKey: "entry", header: "Entry", meta: { num: true }, cell: ({ getValue }) => inr(getValue() as number) },
  { accessorKey: "stopLoss", header: "Stop-loss", meta: { num: true }, cell: ({ getValue }) => inr(getValue() as number) },
  { accessorKey: "target", header: "Target", meta: { num: true }, cell: ({ getValue }) => inr(getValue() as number) },
  { id: "size", header: "Size", accessorFn: (d) => d.fundamentals?.marketCapCr ?? -1,
    cell: ({ row: { original: d } }) => (d.fundamentals ? <div><CapTag cap={d.fundamentals.cap} /><div className="mt-0.5 text-[11px] text-muted-foreground">{d.fundamentals.marketCapCr !== undefined ? `${inr(d.fundamentals.marketCapCr, 0)} Cr` : "–"}</div></div> : "–") },
  { id: "eps", header: "EPS 1Y", meta: { num: true }, accessorFn: (d) => (d.fundamentals?.epsTTM !== undefined && d.fundamentals.epsTTM < 0 ? -999 : d.fundamentals?.epsGrowth1y ?? -998),
    cell: ({ row: { original: d } }) => <EpsGrowth f={d.fundamentals} /> },
  { id: "charts", header: "Charts", accessorFn: (d) => (d.chart ? d.chart.bullish - d.chart.bearish : -99), meta: { num: false },
    cell: ({ row: { original: d } }) => (d.chart ? <TimeframeDots chart={d.chart} /> : <span className="text-xs text-muted-foreground">–</span>) },
  { id: "zone", header: "Buy zone", accessorFn: (d) => d.chart?.zone?.distancePct ?? 999,
    cell: ({ row: { original: d } }) => (d.chart?.zone ? <div><div className="text-xs font-medium">{inr(d.chart.zone.low, 0)}–{inr(d.chart.zone.high, 0)}</div><PlanTag zone={d.chart.zone} /></div> : <span className="text-xs text-muted-foreground">–</span>) },
  { id: "notes", header: "Notes", enableSorting: false, cell: ({ row: { original: d } }) => <span className="block min-w-56 max-w-80 whitespace-normal text-xs text-muted-foreground">{[d.passedOver, ...d.notes, ...d.lotWarnings.slice(0, 1), ...d.mayWarnings.slice(0, 1)].filter(Boolean).join(" · ") || "–"}</span> },
];

export default function ScreenerPage() {
  const r = useDecided();
  const openStock = useDesk((s) => s.openStock);
  const [q, setQ] = useState("");
  const [verdict, setVerdict] = useState<(typeof VERDICTS)[number]>("ALL");
  const [sector, setSector] = useState("ALL");
  const [risk, setRisk] = useState("ALL");
  const [size, setSize] = useState("ALL");
  const [rsiMin, setRsiMin] = useState("");
  const [rsiMax, setRsiMax] = useState("");
  const [minScore, setMinScore] = useState(0);
  const [sorting, setSorting] = useState<SortingState>([{ id: "combined", desc: true }]);

  const all = useMemo(() => r?.all ?? [], [r]);
  const sectors = useMemo(() => [...new Set(all.map((d) => d.sector))].sort(), [all]);
  // everything except the verdict filter, so the chips can show live counts
  const base = useMemo(() => all.filter((d) =>
    (!q || d.symbol.includes(q.trim().toUpperCase())) &&
    (sector === "ALL" || d.sector === sector) && (risk === "ALL" || d.risk === risk) && (size === "ALL" || d.fundamentals?.cap === size) &&
    (rsiMin === "" || d.rsi >= Number(rsiMin)) && (rsiMax === "" || d.rsi <= Number(rsiMax)) && d.combined >= minScore),
  [all, q, sector, risk, size, rsiMin, rsiMax, minScore]);
  const data = useMemo(() => (verdict === "ALL" ? base : base.filter((d) => d.verdict === verdict)), [base, verdict]);
  const filtered = q || sector !== "ALL" || risk !== "ALL" || size !== "ALL" || rsiMin || rsiMax || minScore > 0 || verdict !== "ALL";
  const reset = () => { setQ(""); setSector("ALL"); setRisk("ALL"); setSize("ALL"); setRsiMin(""); setRsiMax(""); setMinScore(0); setVerdict("ALL"); };

  const table = useReactTable({ data, columns, state: { sorting }, onSortingChange: setSorting, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel() });

  return (
    <>
      <PageHeader title="Screener" subtitle="Every stock the agents scored. Select a row for the full research." />
      {!r ? (
        <div className="card grid h-72 place-items-center p-6 text-center text-sm text-muted-foreground">
          The screener fills in once Decision Agent has announced the picks. Run an analysis from the Overview.
        </div>
      ) : (
        <div className="space-y-4">
          <DataBanner source={r.source} />
          <section className="card flex flex-wrap items-end gap-x-4 gap-y-3 p-3.5" aria-label="Filters">
            <Field label="Search" className="min-w-44 flex-1">
              <span className="relative"><Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <input className={cn(inputClass, "w-full pl-8")} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Symbol, e.g. TCS" aria-label="Search by symbol" /></span>
            </Field>
            <Field label="Sector"><select className={inputClass} value={sector} onChange={(e) => setSector(e.target.value)} aria-label="Sector">
              <option value="ALL">All sectors</option>{sectors.map((s) => <option key={s}>{s}</option>)}</select></Field>
            <Field label="Size"><select className={inputClass} value={size} onChange={(e) => setSize(e.target.value)} aria-label="Company size">
              <option value="ALL">Any size</option><option value="Large">Large cap</option><option value="Mid">Mid cap</option><option value="Small">Small cap</option><option value="Unknown">Unknown</option></select></Field>
            <Field label="Risk"><select className={inputClass} value={risk} onChange={(e) => setRisk(e.target.value)} aria-label="Risk">
              <option value="ALL">Any risk</option><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option></select></Field>
            <Field label="RSI range">
              <span className="flex items-center gap-1.5">
                <input className={cn(inputClass, "w-16")} inputMode="numeric" placeholder="0" value={rsiMin} onChange={(e) => setRsiMin(e.target.value.replace(/\D/g, "").slice(0, 3))} aria-label="Minimum RSI" />
                <span className="text-muted-foreground">to</span>
                <input className={cn(inputClass, "w-16")} inputMode="numeric" placeholder="100" value={rsiMax} onChange={(e) => setRsiMax(e.target.value.replace(/\D/g, "").slice(0, 3))} aria-label="Maximum RSI" />
              </span>
            </Field>
            <Field label={`Combined score ≥ ${minScore}`}>
              <input type="range" min={0} max={90} step={5} value={minScore} onChange={(e) => setMinScore(Number(e.target.value))} className="h-9 w-40 accent-[var(--primary)]" aria-label="Minimum combined score" />
            </Field>
            {filtered && <Button variant="ghost" size="sm" onClick={reset} className="mb-0.5"><X />Clear filters</Button>}
          </section>

          <section className="card overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 px-4 py-3">
              {VERDICTS.map((v) => {
                const n = v === "ALL" ? base.length : base.filter((d) => d.verdict === v).length;
                return (
                  <button key={v} type="button" onClick={() => setVerdict(v)} aria-pressed={verdict === v}
                    className={cn("rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                      verdict === v ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground")}>
                    {v === "ALL" ? "All" : v} <span className="tnum opacity-75">{n}</span>
                  </button>
                );
              })}
              <span className="ml-auto text-xs text-muted-foreground tnum">{data.length} of {all.length} stocks</span>
            </div>
            <div className="max-h-[calc(100dvh-22rem)] min-h-64 overflow-auto scroll-thin">
              <table className="w-full text-left text-[13px] tnum">
                <thead className="sticky top-0 z-10 bg-muted">
                  {table.getHeaderGroups().map((hg) => (
                    <tr key={hg.id}>
                      {hg.headers.map((h) => {
                        const num = (h.column.columnDef.meta as { num?: boolean } | undefined)?.num;
                        const sort = h.column.getIsSorted();
                        return (
                          <th key={h.id} aria-sort={sort === "asc" ? "ascending" : sort === "desc" ? "descending" : undefined}
                            className={cn("whitespace-nowrap border-b px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground first:pl-4", num && "text-right")}>
                            {h.column.getCanSort() ? (
                              <button type="button" onClick={h.column.getToggleSortingHandler()} className={cn("inline-flex items-center gap-1 uppercase tracking-wider hover:text-foreground", sort && "text-foreground")}>
                                {flexRender(h.column.columnDef.header, h.getContext())}
                                {sort === "asc" ? <ArrowUp className="size-3" /> : sort === "desc" ? <ArrowDown className="size-3" /> : <ChevronsUpDown className="size-3 opacity-50" />}
                              </button>
                            ) : flexRender(h.column.columnDef.header, h.getContext())}
                          </th>
                        );
                      })}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {table.getRowModel().rows.map((row) => (
                    <tr key={row.id} tabIndex={0} onClick={() => openStock(row.original.symbol)} onKeyDown={(e) => e.key === "Enter" && openStock(row.original.symbol)}
                      className="cursor-pointer border-b last:border-0 hover:bg-muted/50">
                      {row.getVisibleCells().map((c) => (
                        <td key={c.id} className={cn("whitespace-nowrap px-3 py-2 first:pl-4", (c.column.columnDef.meta as { num?: boolean } | undefined)?.num && "text-right")}>
                          {flexRender(c.column.columnDef.cell, c.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {!data.length && <p className="px-4 py-12 text-center text-sm text-muted-foreground">No stocks match these filters.</p>}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
