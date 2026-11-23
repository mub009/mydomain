"use client";

import { ExternalLink } from "lucide-react";
import type { PolicyReport } from "@/lib/policy";
import { TEAM } from "@/lib/team";
import { cn } from "@/lib/utils";
import { AgentAvatar } from "./agent-avatar";

const daysTo = (iso: string) => Math.round((Date.parse(iso) - Date.parse(new Date(Date.now() + 19800_000).toISOString().slice(0, 10))) / 86400_000);

/** Overview card: RBI and Fed policy from the Central Bank Agent. */
export function PolicyCard({ policy, revealed, busy }: { policy: PolicyReport | null | undefined; revealed: boolean; busy: boolean }) {
  return (
    <section className="card p-4" aria-label="Central banks">
      <header className="mb-3 flex items-center gap-3">
        <AgentAvatar who="CentralBank" size={36} />
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold">Central banks</h2>
          <p className="text-xs"><span style={{ color: TEAM.CentralBank.color }} className="font-semibold">Central Bank Agent</span><span className="text-muted-foreground"> · RBI and US Fed policy{policy?.sample ? " · sample" : ""}</span></p>
        </div>
        {revealed && policy && (
          <span className={cn("ml-auto rounded-md px-2 py-0.5 text-[11px] font-bold", policy.direction === "tightening" ? "bg-[var(--avoid-bg)] text-[var(--avoid-fg)]" : policy.direction === "easing" ? "bg-[var(--buy-bg)] text-[var(--buy-fg)]" : "bg-muted text-muted-foreground")}>
            RBI {policy.direction}
          </span>
        )}
      </header>
      {!revealed || !policy ? (
        <p className="py-6 text-center text-[13px] text-muted-foreground">{busy ? "Reading RBI and Fed policy…" : policy === null ? "Policy data wasn't available this run." : "Appears when the Central Bank Agent reports."}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-muted/50 p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">🇮🇳 Reserve Bank of India</div>
            <div className="mt-1 flex items-baseline gap-2 tnum"><span className="text-2xl font-bold">{policy.rbi?.repo ?? "–"}%</span><span className="text-[12px] text-muted-foreground">repo rate</span></div>
            {policy.lastMpc && (
              <p className="mt-1 text-[12.5px]">
                Last MPC{policy.lastMpc.meeting ? ` (${policy.lastMpc.meeting})` : ""}: <b>{policy.lastMpc.decision === "hike" ? `raised ${policy.lastMpc.bps ?? ""} bps` : policy.lastMpc.decision === "cut" ? `cut ${policy.lastMpc.bps ?? ""} bps` : "no change"}</b>
                {policy.lastMpc.stance ? <>, stance <b>{policy.lastMpc.stance}</b></> : null}{policy.lastMpc.inflation ? <>; CPI projected {policy.lastMpc.inflation}</> : null}.
                {policy.lastMpc.url && <a href={policy.lastMpc.url} target="_blank" rel="noreferrer noopener" className="ml-1 inline-flex items-center gap-0.5 font-semibold text-primary hover:underline">RBI<ExternalLink className="size-3" /></a>}
              </p>
            )}
            {policy.nextMpc && <p className="mt-1 text-[12.5px]">Next decision <b>{policy.nextMpc.decisionDate}</b> <span className="text-muted-foreground">(in {daysTo(policy.nextMpc.decisionDate)} days)</span></p>}
            {policy.rbi && <p className="mt-1 text-[11.5px] text-muted-foreground tnum">SDF {policy.rbi.sdf}% · MSF {policy.rbi.msf}% · CRR {policy.rbi.crr}% · SLR {policy.rbi.slr}%</p>}
          </div>
          <div className="rounded-xl bg-muted/50 p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">🇺🇸 US Federal Reserve</div>
            {policy.fed ? (
              <>
                <div className="mt-1 flex items-baseline gap-2 tnum"><span className="text-2xl font-bold">{policy.fed.range}%</span><span className="text-[12px] text-muted-foreground">fed funds target</span></div>
                {policy.fed.lastChange && <p className="mt-1 text-[12.5px]">Last move: <b>{policy.fed.lastChange.bps} bps {policy.fed.lastChange.dir}</b> on {policy.fed.lastChange.date}.</p>}
                {policy.fed.nextMeeting && <p className="mt-1 text-[12.5px]">Next decision <b>{policy.fed.nextMeeting.decisionDate}</b> <span className="text-muted-foreground">(in {daysTo(policy.fed.nextMeeting.decisionDate)} days)</span></p>}
              </>
            ) : <p className="mt-2 text-[12.5px] text-muted-foreground">Not available.</p>}
          </div>
          <p className="text-[12px] text-muted-foreground sm:col-span-2">
            {policy.direction === "neutral" ? "No score adjustment." : `Rate-sensitive sectors (NBFCs, realty, autos, capital goods, infrastructure, cement) are ${policy.direction === "tightening" ? "marked down 2 points" : "lifted 2 points"}; banks are mixed. A decision inside a holding period is flagged by the Black Points Analyst.`}
          </p>
        </div>
      )}
    </section>
  );
}
