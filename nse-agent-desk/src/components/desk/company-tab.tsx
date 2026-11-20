"use client";

import { ExternalLink, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CompanyReport, PeerRow, Quality, QualityCheck, Ratios } from "@/lib/company/types";
import { inr } from "@/lib/format";
import type { Decision } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useDesk, useStockResult } from "@/store/desk";
import { AgentAvatar } from "./agent-avatar";
import { CapTag, EpsGrowth } from "./fundamentals";
import { VerdictBadge } from "./primitives";

const crore = (n?: number) => (n === undefined ? "–" : `${inr(n, 0)} Cr`);
const GRADE_STYLE: Record<Quality["grade"], string> = {
  A: "bg-[var(--strong-bg)] text-[var(--strong-fg)]", B: "bg-[var(--buy-bg)] text-[var(--buy-fg)]",
  C: "bg-[var(--watch-bg)] text-[var(--watch-fg)]", D: "bg-[var(--avoid-bg)] text-[var(--avoid-fg)]", "n/a": "bg-muted text-muted-foreground",
};
const CHECK_STYLE: Record<QualityCheck["verdict"], string> = { good: "text-pos", ok: "text-foreground", weak: "text-neg", "n/a": "text-muted-foreground" };

export function GradeTag({ grade, className }: { grade: Quality["grade"]; className?: string }) {
  return <span className={cn("inline-grid min-w-6 place-items-center rounded-md px-1.5 text-[11px] font-black", GRADE_STYLE[grade], className)} title={`Quality grade ${grade}`}>{grade}</span>;
}

function Section({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="space-y-2 rounded-xl border p-3">
      <div className="flex items-center justify-between gap-2"><h3 className="text-[13px] font-semibold">{title}</h3>{right}</div>
      {children}
    </section>
  );
}

const cache = new Map<string, { report: CompanyReport; peers: PeerRow[] }>();

export function CompanyTab({ d }: { d: Decision }) {
  const result = useStockResult();
  const openStock = useDesk((s) => s.openStock);
  const demo = result?.source.kind === "demo";
  const seed = result?.source.seed ?? 0;

  // Peers: same sector in this run, closest in market cap.
  const peers = useMemo(() => {
    if (!result) return [];
    const cap = d.fundamentals?.marketCapCr ?? 0;
    return result.all.filter((x) => x.symbol !== d.symbol && x.sector === d.sector && d.sector !== "Other")
      .sort((a, b) => Math.abs((a.fundamentals?.marketCapCr ?? 0) - cap) - Math.abs((b.fundamentals?.marketCapCr ?? 0) - cap)).slice(0, 5);
  }, [result, d]);

  const key = `${d.symbol}:${demo}:${seed}:${peers.map((p) => p.symbol).join(",")}`;
  const [data, setData] = useState(cache.get(key) ?? null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (cache.has(key)) { setData(cache.get(key)!); return; }
    setData(null); setErr(null);
    const q = new URLSearchParams({ symbol: d.symbol, price: String(d.entry), demo: demo ? "1" : "0", seed: String(seed),
      peers: peers.map((p) => `${p.symbol}:${p.entry}`).join(",") });
    let alive = true;
    fetch(`/api/company?${q}`).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`Error ${r.status}`))))
      .then((j) => { cache.set(key, j); if (alive) setData(j); })
      .catch((e) => alive && setErr(e.message));
    return () => { alive = false; };
  }, [key, d.symbol, d.entry, demo, seed, peers]);

  if (err) return <p className="px-5 py-8 text-sm text-neg">Could not load company data: {err}</p>;
  if (!data) return <p className="flex items-center justify-center gap-2 px-5 py-12 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Loading balance sheet, cash flow and shareholders…</p>;

  const { report: r, peers: peerData } = data;
  const peerBy = new Map(peerData.map((p) => [p.symbol, p]));
  const rows: { d: Decision; ratios?: Ratios; grade?: Quality["grade"]; self?: boolean }[] = [
    { d, ratios: r.ratios, grade: r.quality.grade, self: true },
    ...peers.map((p) => ({ d: p, ratios: peerBy.get(p.symbol)?.ratios, grade: peerBy.get(p.symbol)?.grade })),
  ];
  const pe = (x: Decision) => (x.fundamentals?.epsTTM && x.fundamentals.epsTTM > 0 ? (x.entry / x.fundamentals.epsTTM).toFixed(1) : "–");
  const fmt = (n: number | undefined, f: (n: number) => string) => (n === undefined ? "–" : f(n));

  return (
    <div className="space-y-4 px-5 pb-6">
      {r.sample && <p className="rounded-lg border border-warn-border bg-warn-bg px-3 py-2 text-[12px] text-warn-fg"><b>Sample figures (demo).</b> Not real financials or holders.</p>}

      {/* Research Agent's quality view */}
      <Section title="Balance sheet & cash-flow quality" right={<GradeTag grade={r.quality.grade} className="h-6 min-w-7 text-sm" />}>
        <div className="flex gap-2.5 rounded-lg bg-muted/50 p-2.5">
          <AgentAvatar who="Research" size={28} />
          <p className="text-[12.5px] leading-relaxed"><b className="text-[#14B8A6]">Research Agent:</b> {r.quality.summary}</p>
        </div>
        <ul className="divide-y text-[12.5px]">
          {r.quality.checks.map((c) => (
            <li key={c.label} className="grid grid-cols-[1fr_auto] gap-x-3 py-1.5">
              <span className="font-medium">{c.label}</span>
              <span className={cn("text-right font-semibold tnum", CHECK_STYLE[c.verdict])}>{c.value}</span>
              <span className="col-span-2 text-[11.5px] text-muted-foreground">{c.note}</span>
            </li>
          ))}
        </ul>
        {r.quality.financialSector && <p className="text-[11px] text-muted-foreground">Banks and NBFCs borrow and lend as their business, so cash flow, debt and current ratio are not graded for them.</p>}
      </Section>

      {/* Peers */}
      <Section title={`Peers · ${d.sector}`} right={<span className="text-[11px] text-muted-foreground">from this run’s stock list</span>}>
        {peers.length ? (
          <div className="-mx-1 overflow-x-auto scroll-thin">
            <table className="w-full min-w-[520px] text-left text-[12px] tnum">
              <thead><tr className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {["Company", "Size", "P/E", "EPS 1Y", "ROE", "D/E", "Cash conv.", "Quality", "Verdict"].map((h, i) => <th key={h} className={cn("px-1 py-1 font-semibold", i > 1 && i < 7 && "text-right")}>{h}</th>)}
              </tr></thead>
              <tbody>
                {rows.map(({ d: x, ratios, grade, self }) => (
                  <tr key={x.symbol} onClick={() => !self && openStock(x.symbol)}
                    className={cn("border-t", self ? "bg-primary-soft/60 font-semibold" : "cursor-pointer hover:bg-muted/50")}>
                    <td className="px-1 py-1.5">{x.symbol}{self && <span className="ml-1 text-[10px] font-normal text-muted-foreground">(this)</span>}</td>
                    <td className="px-1 py-1.5">{x.fundamentals ? <CapTag cap={x.fundamentals.cap} /> : "–"}</td>
                    <td className="px-1 py-1.5 text-right">{pe(x)}</td>
                    <td className="px-1 py-1.5 text-right"><EpsGrowth f={x.fundamentals} /></td>
                    <td className="px-1 py-1.5 text-right">{fmt(ratios?.roe, (n) => `${n.toFixed(1)}%`)}</td>
                    <td className="px-1 py-1.5 text-right">{fmt(ratios?.debtToEquity, (n) => n.toFixed(2))}</td>
                    <td className="px-1 py-1.5 text-right">{fmt(ratios?.cashConversion, (n) => `${n.toFixed(2)}×`)}</td>
                    <td className="px-1 py-1.5">{grade ? <GradeTag grade={grade} /> : "–"}</td>
                    <td className="px-1 py-1.5"><VerdictBadge verdict={x.verdict} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="text-[12.5px] text-muted-foreground">No other {d.sector === "Other" ? "known-sector" : d.sector} stocks in this run. Choose “All caps” to compare with more companies.</p>}
      </Section>

      {/* Cash flow */}
      <Section title="Profit vs cash flow (₹ Cr)">
        {r.years.length ? (
          <>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-muted-foreground">
              {[["Net profit", "var(--series-1)"], ["Operating cash flow", "var(--series-2)"], ["Free cash flow", "var(--series-3)"]].map(([l, c]) => (
                <span key={l} className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-sm" style={{ background: c }} />{l}</span>
              ))}
            </div>
            <div className="h-44" role="img" aria-label="Net profit, operating cash flow and free cash flow by year">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={r.years} margin={{ top: 6, right: 4, bottom: 0, left: 0 }} barGap={2} barCategoryGap="22%">
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="year" tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                  <YAxis width={56} tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} tickFormatter={(v: number) => Math.round(v).toLocaleString("en-IN")} />
                  <ReferenceLine y={0} stroke="var(--muted-foreground)" />
                  <Tooltip isAnimationActive={false} cursor={{ fill: "var(--muted)", opacity: 0.5 }}
                    formatter={(v, n) => [crore(Number(v)), n === "netIncome" ? "Net profit" : n === "operatingCashFlow" ? "Operating cash flow" : "Free cash flow"]}
                    contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="netIncome" fill="var(--series-1)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                  <Bar dataKey="operatingCashFlow" fill="var(--series-2)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                  <Bar dataKey="freeCashFlow" fill="var(--series-3)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[11px] text-muted-foreground">Good quality: operating cash flow at or above net profit, and free cash flow (after capital spending) positive most years.</p>
          </>
        ) : <p className="text-[12.5px] text-muted-foreground">Cash-flow statements are not available for this stock.</p>}
      </Section>

      {/* Balance sheet */}
      <Section title="Balance sheet (₹ Cr)">
        {r.years.length ? (
          <div className="-mx-1 overflow-x-auto scroll-thin">
            <table className="w-full text-[12px] tnum">
              <thead><tr className="text-[10px] uppercase tracking-wide text-muted-foreground"><th className="px-1 py-1 text-left font-semibold">Item</th>{r.years.map((y) => <th key={y.year} className="px-1 py-1 text-right font-semibold">{y.year}</th>)}</tr></thead>
              <tbody>
                {([["Revenue", "revenue"], ["Net profit", "netIncome"], ["Total assets", "totalAssets"], ["Total liabilities", "totalLiabilities"], ["Shareholders’ equity", "equity"], ["Total debt", "debt"], ["Cash", "cash"], ["Capital spending", "capex"]] as const).map(([l, k]) => (
                  <tr key={k} className="border-t"><td className="px-1 py-1 text-muted-foreground">{l}</td>
                    {r.years.map((y) => <td key={y.year} className={cn("px-1 py-1 text-right", (y[k] ?? 0) < 0 && "text-neg")}>{y[k] === undefined ? "–" : inr(y[k]!, 0)}</td>)}</tr>
                ))}
                <tr className="border-t"><td className="px-1 py-1 text-muted-foreground">Debt / equity</td>
                  {r.years.map((y) => <td key={y.year} className="px-1 py-1 text-right">{y.debt !== undefined && y.equity ? (y.debt / y.equity).toFixed(2) : "–"}</td>)}</tr>
                <tr className="border-t"><td className="px-1 py-1 text-muted-foreground">Current ratio</td>
                  {r.years.map((y) => <td key={y.year} className="px-1 py-1 text-right">{y.currentAssets !== undefined && y.currentLiabilities ? (y.currentAssets / y.currentLiabilities).toFixed(2) : "–"}</td>)}</tr>
              </tbody>
            </table>
          </div>
        ) : <p className="text-[12.5px] text-muted-foreground">Balance-sheet data is not available for this stock.</p>}
      </Section>

      {/* Shareholders */}
      <Section title="Who owns it" right={r.shareholding?.asOf && <span className="text-[11px] text-muted-foreground">as of {r.shareholding.asOf}</span>}>
        {r.shareholding && r.shareholding.categories.length ? (
          <>
            <div className="flex h-4 w-full gap-0.5 overflow-hidden rounded-md" role="img"
              aria-label={r.shareholding.categories.map((c) => `${c.label} ${c.pct}%`).join(", ")}>
              {r.shareholding.categories.filter((c) => c.pct > 0).map((c, i) => (
                <span key={c.label} style={{ width: `${c.pct}%`, background: `var(--series-${i + 1})` }} title={`${c.label}: ${c.pct}%`} />
              ))}
            </div>
            <ul className="grid grid-cols-1 gap-x-4 gap-y-1 text-[12px] sm:grid-cols-2">
              {r.shareholding.categories.map((c, i) => (
                <li key={c.label} className="flex items-center gap-1.5">
                  <i className="size-2.5 shrink-0 rounded-sm" style={{ background: `var(--series-${i + 1})` }} />
                  <span className="flex-1 text-muted-foreground">{c.label}</span><b className="tnum">{c.pct.toFixed(2)}%</b>
                </li>
              ))}
            </ul>
            {r.shareholding.promoterTrend && (
              <p className="text-[12px]">
                Promoter holding, last 4 quarters: {r.shareholding.promoterTrend.map((t) => `${t.pct.toFixed(1)}%`).join(" → ")}
                {(() => { const t = r.shareholding!.promoterTrend!; const ch = t[t.length - 1].pct - t[0].pct;
                  return <b className={cn("ml-1", ch >= 0 ? "text-pos" : "text-neg")}>({ch >= 0 ? "+" : ""}{ch.toFixed(2)} pts)</b>; })()}
              </p>
            )}
            {r.shareholding.pledgedPct !== undefined && (
              <p className={cn("text-[12px]", r.shareholding.pledgedPct > 5 && "font-semibold text-neg")}>
                Promoter shares pledged: {r.shareholding.pledgedPct.toFixed(2)}%{r.shareholding.pledgedPct > 5 ? " (a risk if the price falls)" : ""}
              </p>
            )}
            {r.shareholding.top.length > 0 && (
              <table className="w-full text-[12px] tnum">
                <thead><tr className="text-[10px] uppercase tracking-wide text-muted-foreground"><th className="py-1 text-left font-semibold">Largest holders</th><th className="py-1 text-left font-semibold">Type</th><th className="py-1 text-right font-semibold">Stake</th></tr></thead>
                <tbody>{r.shareholding.top.map((h) => <tr key={h.name + h.type} className="border-t"><td className="py-1">{h.name}</td><td className="py-1 text-muted-foreground">{h.type}</td><td className="py-1 text-right">{h.pct.toFixed(2)}%</td></tr>)}</tbody>
              </table>
            )}
            {r.shareholding.note && <p className="text-[11px] text-muted-foreground">{r.shareholding.note}</p>}
          </>
        ) : <p className="text-[12.5px] text-muted-foreground">Shareholding data isn’t available from the free source. Use the official NSE page below.</p>}
      </Section>

      <div className="space-y-1 text-[12px]">
        <p className="text-muted-foreground">Source: {r.source}. Check important numbers against the official filings:</p>
        {r.links.map((l) => (
          <a key={l.url} href={l.url} target="_blank" rel="noreferrer noopener" className="flex items-center gap-1 font-medium text-primary hover:underline">
            {l.label}<ExternalLink className="size-3" />
          </a>
        ))}
      </div>
    </div>
  );
}
