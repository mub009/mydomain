"use client";

import { AlertOctagon, CircleCheck, ExternalLink, HelpCircle, ShieldAlert, TriangleAlert } from "lucide-react";
import { TEAM } from "@/lib/team";
import type { BPFinding, BPReport, BPStatus, Decision, HoldingPeriod } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useDesk } from "@/store/desk";
import { AgentAvatar } from "./agent-avatar";
import { StockSymbolChip, VerdictBadge } from "./primitives";

const PERIOD: Record<HoldingPeriod, string> = { swing: "Swing 1-10 days", positional: "Positional ~1 month" };

const STATUS: Record<BPStatus, { cls: string; Icon: typeof CircleCheck }> = {
  Eligible: { cls: "bg-[var(--buy-bg)] text-[var(--buy-fg)]", Icon: CircleCheck },
  Excluded: { cls: "bg-[var(--avoid-bg)] text-[var(--avoid-fg)]", Icon: AlertOctagon },
  "Needs Review": { cls: "bg-[var(--watch-bg)] text-[var(--watch-fg)]", Icon: HelpCircle },
};

const VERIFY: Record<BPFinding["verification"], string> = {
  verified: "Verified", unverified: "Unverified (news only)", conflicting: "Conflicting evidence", stale: "Stale evidence", missing: "Evidence missing",
};

export function BPStatusChip({ status, period }: { status: BPStatus; period?: HoldingPeriod }) {
  const s = STATUS[status];
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-px text-[10.5px] font-bold", s.cls)}>
      <s.Icon className="size-3" aria-hidden />{period ? `${period === "swing" ? "Swing" : "Positional"}: ` : ""}{status}
    </span>
  );
}

/** Overall label for tables: the worst status across the holding periods. */
export function bpOverall(bp?: BPReport): BPStatus | undefined {
  if (!bp) return undefined;
  const v = Object.values(bp.status);
  return v.includes("Excluded") && !v.includes("Eligible") ? "Excluded" : v.every((x) => x === "Eligible") ? "Eligible" : v.includes("Eligible") ? "Eligible" : "Needs Review";
}

function Finding({ f }: { f: BPFinding }) {
  const material = f.materiality === "material";
  return (
    <li className={cn("rounded-lg border p-2.5", material && f.verification === "verified" ? "border-neg/40" : material ? "border-[var(--watch-fg)]/40" : "")}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {material ? (f.verification === "verified" ? <AlertOctagon className="size-3.5 text-neg" aria-hidden /> : <TriangleAlert className="size-3.5 text-[var(--watch-fg)]" aria-hidden />) : <HelpCircle className="size-3.5 text-muted-foreground" aria-hidden />}
        <b className="text-[12.5px]">{f.flag}</b>
        <span className="rounded bg-muted px-1.5 text-[10.5px] text-muted-foreground">{f.category}</span>
        <span className="rounded bg-muted px-1.5 text-[10.5px] text-muted-foreground">{f.scope === "Sector" ? "Whole sector" : "Company"}</span>
        <span className={cn("text-[10.5px] font-semibold", f.verification === "verified" ? "text-foreground" : "text-[var(--watch-fg)]")}>{VERIFY[f.verification]}</span>
        {!material && <span className="text-[10.5px] text-muted-foreground">watch only</span>}
      </div>
      <p className="mt-1 text-[12px] text-muted-foreground">{f.note}</p>
      <ul className="mt-1.5 space-y-1">
        {f.evidence.slice(0, 5).map((e, i) => (
          <li key={i} className="text-[11.5px] leading-snug">
            <span className="mr-1 rounded bg-muted px-1 text-[10px] uppercase tracking-wide text-muted-foreground">{e.kind}</span>
            {e.summary}
            <span className="text-muted-foreground"> · {e.source}{e.date ? ` · ${e.date}` : ""}</span>
            {e.url && <a href={e.url} target="_blank" rel="noreferrer noopener" className="ml-1 inline-flex items-center gap-0.5 font-semibold text-primary hover:underline">source<ExternalLink className="size-3" /></a>}
          </li>
        ))}
      </ul>
      {Object.keys(f.impact).length > 0 && material && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">{(Object.entries(f.impact) as [HoldingPeriod, BPStatus][]).map(([p, s]) => <BPStatusChip key={p} status={s} period={p} />)}</div>
      )}
    </li>
  );
}

/** Stock window: the Black Points Analyst's report on this stock. */
export function BlackPointsSection({ bp }: { bp: BPReport }) {
  const material = bp.findings.filter((f) => f.materiality === "material");
  const watch = bp.findings.filter((f) => f.materiality !== "material");
  return (
    <section className="space-y-2.5 rounded-xl border p-3" aria-label="Black Points Analyst">
      <div className="flex flex-wrap items-center gap-2">
        <AgentAvatar who="BlackPoints" size={28} />
        <b className="text-[13px]" style={{ color: TEAM.BlackPoints.color }}>{TEAM.BlackPoints.name}</b>
        <span className="text-[11.5px] text-muted-foreground">{bp.sector}{bp.subsector ? ` · ${bp.subsector}` : ""}{bp.sample ? " · sample evidence" : ""}</span>
        <span className="ml-auto flex flex-wrap gap-1">{(Object.entries(bp.status) as [HoldingPeriod, BPStatus][]).map(([p, s]) => <BPStatusChip key={p} status={s} period={p} />)}</span>
      </div>
      <dl className="space-y-0.5 text-[12px]">
        {(Object.entries(bp.passed) as [HoldingPeriod, string][]).map(([p, why]) => (
          <div key={p}><dt className="inline font-semibold">{why.startsWith("Did not pass") ? "Checked" : "Passed"} for {PERIOD[p]}: </dt><dd className="inline text-muted-foreground">{why}</dd></div>
        ))}
      </dl>
      {material.length ? <ul className="space-y-2">{material.map((f, i) => <Finding key={i} f={f} />)}</ul>
        : <p className="flex items-center gap-1.5 rounded-lg bg-[var(--buy-bg)] px-2.5 py-1.5 text-[12.5px] text-[var(--buy-fg)]"><CircleCheck className="size-3.5" />No material red flags found in the sources checked.</p>}
      {watch.length > 0 && (
        <details className="text-[12px]">
          <summary className="cursor-pointer font-semibold text-muted-foreground">{watch.length} watch item{watch.length > 1 ? "s" : ""} (don&apos;t change the status)</summary>
          <ul className="mt-2 space-y-2">{watch.map((f, i) => <Finding key={i} f={f} />)}</ul>
        </details>
      )}
      {bp.finalDecision && <p className="rounded-lg bg-muted/60 p-2.5 text-[12.5px]"><b>Final decision</b> (Decision Agent, on the Research Agent&apos;s analysis): {bp.finalDecision}</p>}
    </section>
  );
}

/** Screener tab: every stock the analyst excluded or held for review, with the evidence and the final decision. */
export function FlaggedStocks({ all }: { all: Decision[] }) {
  const openStock = useDesk((s) => s.openStock);
  const coverage = useDesk((s) => s.result?.blackPoints?.coverage ?? []);
  const flagged = all.filter((d) => d.blackPoints && Object.values(d.blackPoints.status).some((s) => s !== "Eligible"))
    .sort((a, b) => Number(Object.values(b.blackPoints!.status).includes("Excluded")) - Number(Object.values(a.blackPoints!.status).includes("Excluded")));
  const checked = all.filter((d) => d.blackPoints).length;
  return (
    <div className="space-y-3">
      <div className="card flex flex-wrap items-start gap-3 p-3.5">
        <ShieldAlert className="mt-0.5 size-5 shrink-0" style={{ color: TEAM.BlackPoints.color }} aria-hidden />
        <div className="min-w-0 flex-1 text-[12.5px]">
          <p><b>{flagged.length}</b> of {checked} stocks that passed a scan are excluded or held for review. A verified red flag excludes a stock from the affected shortlist; missing, stale, conflicting or news-only evidence holds it for review. Neither can be overridden by a score or a vote.</p>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-muted-foreground">{coverage.map((c) => <li key={c}>{c}</li>)}</ul>
        </div>
      </div>
      {!flagged.length && <p className="card p-6 text-center text-[13px] text-muted-foreground">No stocks were excluded or held for review in this run.</p>}
      {flagged.map((d) => (
        <article key={d.symbol} className="card space-y-2 p-3.5">
          <header className="flex flex-wrap items-center gap-2">
            <StockSymbolChip symbol={d.symbol} />
            <span className="text-[12px] text-muted-foreground">{d.blackPoints!.company ?? ""}</span>
            <VerdictBadge verdict={d.verdict} />
            <button type="button" onClick={() => openStock(d.symbol)} className="ml-auto text-[12px] font-semibold text-primary hover:underline">Open stock</button>
          </header>
          <BlackPointsSection bp={d.blackPoints!} />
        </article>
      ))}
    </div>
  );
}
