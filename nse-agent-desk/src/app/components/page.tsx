"use client";

import { Handshake, TrendingUp } from "lucide-react";
import { AgentAgreementScatter } from "@/components/desk/agent-agreement-scatter";
import { AgentAvatar } from "@/components/desk/agent-avatar";
import { ChatMessage, MiniReportTable } from "@/components/desk/chat-message";
import { FinalPicksTable } from "@/components/desk/final-picks-table";
import { DataBanner, KPICard, MarketStatusBadge, ResearchProgress, StockSymbolChip, TypingIndicator, VerdictBadge } from "@/components/desk/primitives";
import { AgentStatusCard, PageHeader } from "@/components/desk/shell";
import { StockSparkline } from "@/components/desk/stock-sparkline";
import { PEOPLE } from "@/lib/team";
import type { Decision, Message } from "@/lib/types";
import type { Presence } from "@/store/desk";

// Fixed sample values, only for showing the components. Not real prices.
const wave = (n: number, drift: number) => Array.from({ length: 60 }, (_, i) => 1000 + i * drift + Math.sin(i / 3 + n) * 22 + Math.cos(i / 7) * 14);
const stock = (symbol: string, sector: string, lot: number, may: number, verdict: Decision["verdict"], drift: number, i: number): Decision => ({
  symbol, sector, lotappi: lot, mayavi: may, combined: (lot + may) / 2, agree: lot >= 60 && may >= 60, conflict: Math.abs(lot - may) > 25,
  risk: i % 3 === 2 ? "MEDIUM" : "LOW", horizon: "Swing, then hold ~1 month", entry: 1500 + i * 410, stopLoss: 1410 + i * 390, target: 1680 + i * 450,
  rsi: 58, ret5d: 2.4, ret21d: 6.1, volRatio: 1.6, atrPct: 2.1, lotReasons: [], lotWarnings: [], mayReasons: [], mayWarnings: [], notes: [],
  verdict, spark: wave(i, drift), quantity: 12 - i * 2, investment: (12 - i * 2) * (1500 + i * 410),
});
const SAMPLE: Decision[] = [
  stock("ALPHA", "Banks", 88, 82, "STRONG BUY", 3, 0), stock("BRAVO", "IT", 74, 79, "BUY", 1.5, 1), stock("CHARLIE", "Auto", 66, 71, "BUY", 2, 2),
  stock("DELTA", "FMCG", 52, 58, "WATCH", -0.5, 3), stock("ECHO", "Metals", 81, 38, "WATCH", 0.4, 4), stock("FOXTROT", "Energy", 24, 30, "AVOID", -2, 5),
  stock("GOLF", "Pharma", 35, 62, "AVOID", -1, 6), stock("HOTEL", "Telecom", 44, 21, "AVOID", -1.5, 7),
];
const MSG: Message = {
  id: 1, sender: "Lotappi", to: "Mubashir", thread: "Lotappi|Mubashir", kind: "report", stage: "scan",
  text: "Mubashir, here is my short-term shortlist. ALPHA leads on volume.", tickers: ["ALPHA"],
  table: { columns: ["Symbol", "Score", "Signal", "Reason"], rows: [["ALPHA", "88.0", "BUY", "Breakout above 20-day high"], ["BRAVO", "74.0", "BUY", "EMA9 above EMA21"], ["DELTA", "52.0", "WATCH", "RSI 51 in momentum zone"]] },
};
const DECISION: Message = { id: 2, sender: "FinalDecision", to: "ALL", thread: "team", kind: "decision", stage: "decide", text: "Decision made. We go with ALPHA, BRAVO and CHARLIE.", tickers: ["ALPHA", "BRAVO", "CHARLIE"] };
const STATES: Presence[] = ["Online", "Typing", "Analyzing", "Reviewing", "Idle"];

function Block({ n, name, children }: { n: number; name: string; children: React.ReactNode }) {
  return (
    <section className="card p-4">
      <h2 className="mb-3 flex items-center gap-2 text-[13px] font-semibold"><span className="grid size-5 place-items-center rounded-md bg-primary-soft text-[11px] font-bold text-primary tnum">{n}</span>{name}</h2>
      {children}
    </section>
  );
}

export default function ComponentShowcase() {
  const now = Date.UTC(2026, 10, 17, 4, 45); // fixed sample time (10:15 IST)
  return (
    <>
      <PageHeader title="Component Showcase" subtitle="The reusable building blocks, with sample values. Works in light and dark themes." />
      <div className="grid gap-4 xl:grid-cols-2">
        <Block n={1} name="AgentAvatarWithPresence">
          <div className="flex flex-wrap items-end gap-5">
            {PEOPLE.map((p, i) => <div key={p} className="flex flex-col items-center gap-1.5 text-[11px] text-muted-foreground"><AgentAvatar who={p} size={56} presence={STATES[i]} />{STATES[i]}</div>)}
            <div className="flex flex-col items-center gap-1.5 text-[11px] text-muted-foreground"><AgentAvatar who="Lotappi" size={32} presence="Idle" />Idle</div>
          </div>
        </Block>
        <Block n={2} name="AgentStatusCard">
          <div className="grid gap-1 rounded-xl bg-sidebar p-2 sm:grid-cols-2">
            <AgentStatusCard who="Lotappi" presence="Typing" lastMessage="My short-term scan is done." />
            <AgentStatusCard who="Mubashir" presence="Analyzing" />
          </div>
        </Block>
        <Block n={3} name="ChatMessage"><div className="space-y-3"><ChatMessage m={MSG} time={now} /><ChatMessage m={DECISION} time={now} /></div></Block>
        <div className="grid gap-4">
          <Block n={4} name="TypingIndicator"><span className="flex items-center gap-2 text-sm text-muted-foreground">Mayavi is typing <TypingIndicator /></span></Block>
          <Block n={5} name="StockSymbolChip"><p className="text-sm">We both rate <StockSymbolChip symbol="ALPHA" /> and <StockSymbolChip symbol="BRAVO" /> above 60.</p></Block>
          <Block n={6} name="MiniReportTable"><MiniReportTable table={MSG.table!} /></Block>
          <Block n={7} name="VerdictBadge"><div className="flex flex-wrap gap-2">{["STRONG BUY", "BUY", "WATCH", "AVOID"].map((v) => <VerdictBadge key={v} verdict={v} />)}</div></Block>
        </div>
        <Block n={8} name="KPICard">
          <div className="grid grid-cols-2 gap-3">
            <KPICard label="Both Agents Agree" value="14" sub="Lotappi and Mayavi both ≥ 60" icon={<Handshake />} />
            <KPICard label="Nifty 50 · 1-Month" value="+2.91%" sub="Sample value" tone="pos" icon={<TrendingUp />} />
          </div>
        </Block>
        <Block n={9} name="StockSparkline">
          <div className="flex flex-wrap gap-6"><StockSparkline data={wave(0, 3)} width={140} height={36} /><StockSparkline data={wave(2, -2)} width={140} height={36} /></div>
        </Block>
        <Block n={10} name="AgentAgreementScatter">
          <AgentAgreementScatter rows={SAMPLE} picks={["ALPHA", "BRAVO", "CHARLIE"]} watch={["DELTA", "ECHO"]} height={280} />
        </Block>
        <Block n={11} name="FinalPicksTable"><div className="-mx-4"><FinalPicksTable picks={SAMPLE.slice(0, 3)} /></div></Block>
        <Block n={12} name="ResearchProgress">
          <div className="space-y-4 overflow-x-auto"><ResearchProgress stage={null} /><ResearchProgress stage="analyze" /><ResearchProgress stage="decide" done /></div>
        </Block>
        <Block n={13} name="MarketStatusBadge"><MarketStatusBadge /></Block>
        <Block n={14} name="DemoDataBanner">
          <div className="space-y-2"><DataBanner source={{ kind: "demo", label: "Demo data" }} /><DataBanner source={{ kind: "eod", label: "Yahoo Finance (unofficial, end-of-day)" }} /></div>
        </Block>
      </div>
    </>
  );
}
