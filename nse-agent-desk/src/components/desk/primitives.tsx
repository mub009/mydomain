"use client";

import { AlertTriangle, ArrowDownRight, ArrowUpRight, Ban, Check, CircleCheck, Eye, FlaskConical } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { marketStatus, type MarketStatus } from "@/lib/market/calendar";
import type { DataSource, Stage, Verdict } from "@/lib/types";
import { cn } from "@/lib/utils";
import { findStock, useDesk } from "@/store/desk";

/** VerdictBadge: colour + icon + text, never colour alone. */
export function VerdictBadge({ verdict, className }: { verdict: Verdict | string; className?: string }) {
  const map: Record<string, { bg: string; fg: string; Icon: typeof Check }> = {
    "STRONG BUY": { bg: "var(--strong-bg)", fg: "var(--strong-fg)", Icon: CircleCheck },
    BUY: { bg: "var(--buy-bg)", fg: "var(--buy-fg)", Icon: Check },
    WATCH: { bg: "var(--watch-bg)", fg: "var(--watch-fg)", Icon: Eye },
    AVOID: { bg: "var(--avoid-bg)", fg: "var(--avoid-fg)", Icon: Ban },
  };
  const v = map[verdict] ?? map.WATCH;
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-bold tracking-wide", className)}
      style={{ background: v.bg, color: v.fg }}>
      <v.Icon className="size-3" strokeWidth={2.6} aria-hidden />{verdict}
    </span>
  );
}

export function RiskTag({ risk }: { risk: string }) {
  const r = risk.toUpperCase();
  return (
    <span className={cn("text-xs font-semibold", r === "LOW" ? "text-pos" : r === "HIGH" ? "text-neg" : "text-[var(--watch-fg)]")}>
      {r.charAt(0) + r.slice(1).toLowerCase()}
    </span>
  );
}

/** StockSymbolChip: opens the research drawer once the decision is in. */
export function StockSymbolChip({ symbol, className }: { symbol: string; className?: string }) {
  const openStock = useDesk((s) => s.openStock);
  const known = useDesk((s) => Boolean(findStock(s.result, symbol)));
  return (
    <button type="button" disabled={!known} onClick={() => openStock(symbol)}
      title={known ? `Open ${symbol} research` : `${symbol} (research opens after the run finishes)`}
      className={cn(
        "mx-px inline-flex items-center rounded-md bg-primary-soft px-1.5 py-px align-baseline text-[0.86em] font-semibold tnum text-primary",
        "enabled:hover:bg-primary enabled:hover:text-primary-foreground disabled:cursor-default", className)}>
      {symbol}
    </button>
  );
}

/** TypingIndicator */
export function TypingIndicator({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)} role="status" aria-label="typing">
      {[0, 1, 2].map((i) => (
        <i key={i} className="size-1.5 rounded-full bg-current" style={{ animation: `typing-bounce 1.2s ${i * 0.15}s infinite` }} />
      ))}
    </span>
  );
}

/**
 * Tilt: a card that leans toward the pointer in 3D, with a glare that follows
 * it. Mouse only, and off when the viewer prefers reduced motion.
 */
export function Tilt({ children, className, max = 6 }: { children: React.ReactNode; className?: string; max?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const move = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el || e.pointerType !== "mouse" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
    el.style.transform = `perspective(900px) rotateX(${(0.5 - py) * 2 * max}deg) rotateY(${(px - 0.5) * 2 * max}deg) translateY(-3px)`;
    el.style.setProperty("--gx", `${px * 100}%`);
    el.style.setProperty("--gy", `${py * 100}%`);
    el.dataset.active = "true";
  };
  const leave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.transform = "";
    el.dataset.active = "false";
  };
  return (
    <div ref={ref} onPointerMove={move} onPointerLeave={leave} className={cn("tilt relative", className)}>
      {children}
      <span className="tilt-glare" aria-hidden />
    </div>
  );
}

/** KPICard */
export function KPICard({ label, value, sub, tone, icon }: {
  label: string; value: string; sub: string; tone?: "pos" | "neg"; icon?: React.ReactNode;
}) {
  return (
    <Tilt className="card p-4">
      <div className="flex items-center justify-between text-[13px] font-medium text-muted-foreground">
        {label}
        {icon && <span className="btn-3d-primary grid size-9 place-items-center rounded-xl text-white [&_svg]:size-[18px] tilt-pop">{icon}</span>}
      </div>
      <div className={cn("tilt-pop mt-1 flex items-center gap-1 text-[30px] font-bold leading-tight tracking-tight tnum",
        tone === "pos" && "text-pos", tone === "neg" && "text-neg")}>
        {value}
        {tone === "pos" && <ArrowUpRight className="size-5" aria-hidden />}
        {tone === "neg" && <ArrowDownRight className="size-5" aria-hidden />}
      </div>
      <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>
    </Tilt>
  );
}

/** MarketStatusBadge: NSE regular session, IST, with the trading calendar. */
export function MarketStatusBadge({ className }: { className?: string }) {
  const [st, setSt] = useState<MarketStatus | null>(null);
  useEffect(() => {
    setSt(marketStatus());
    const t = setInterval(() => setSt(marketStatus()), 20000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className={cn("inline-flex h-8 items-center gap-2 whitespace-nowrap rounded-full border bg-card px-3 text-xs font-medium", className)}
      title={st && !st.calendarKnown ? "Holiday calendar for this year is not loaded; weekends only." : "NSE regular session 09:15-15:30 IST"}>
      <span className={cn("size-2 rounded-full", st?.open ? "bg-emerald-500 text-emerald-500 [animation:pulse-ring_1.6s_infinite]" : "bg-slate-400")} />
      <span>NSE {st ? (st.open ? "Open" : "Closed") : "…"}<span className="max-[430px]:hidden">{st ? (st.open ? "" : st.label === "Closed" ? "" : ` · ${st.label}`) : ""}</span></span>
      <span className="text-muted-foreground tnum">{st ? `${st.time} IST` : ""}</span>
    </span>
  );
}

/** DemoDataBanner (also explains a fallback to demo data, and labels end-of-day data honestly). */
export function DataBanner({ source, className }: { source: DataSource | { kind: "demo"; label: string; fallbackReason?: string }; className?: string }) {
  if (source.kind === "demo") {
    return (
      <div role="note" className={cn("flex items-start gap-2 rounded-xl border border-warn-border bg-warn-bg px-3.5 py-2.5 text-[13px] text-warn-fg", className)}>
        <FlaskConical className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          <b className="font-semibold">DEMO DATA, not real prices.</b>{" "}
          {source.fallbackReason ? `${source.fallbackReason} The agents used fictional sample data instead. ` : "Prices are fictional samples. "}
          The agent conversation is simulated from the analysis.
        </span>
      </div>
    );
  }
  return (
    <div role="note" className={cn("flex items-start gap-2 rounded-xl border bg-card px-3.5 py-2.5 text-[13px] text-muted-foreground", className)}>
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span><b className="font-semibold text-foreground">End-of-day data, not real-time NSE prices.</b> Source: {source.label}. Entry, stop-loss and target are research scenarios, not guaranteed prices.</span>
    </div>
  );
}

const STEPS: { id: Stage; label: string }[] = [
  { id: "scan", label: "Scan" }, { id: "analyze", label: "Analyze" }, { id: "debate", label: "Debate" }, { id: "decide", label: "Decide" },
];

/** ResearchProgress: Scan -> Analyze -> Debate -> Decide */
export function ResearchProgress({ stage, done, className }: { stage: Stage | null; done?: boolean; className?: string }) {
  const at = done ? STEPS.length : stage ? STEPS.findIndex((s) => s.id === stage) : -1;
  return (
    <ol className={cn("flex items-center", className)} aria-label="Research progress">
      {STEPS.map((s, i) => {
        const state = i < at ? "done" : i === at ? "active" : "todo";
        return (
          <li key={s.id} className="flex items-center" aria-current={state === "active" ? "step" : undefined}>
            {i > 0 && <span className={cn("mx-1.5 h-0.5 w-3 rounded-full sm:mx-2 sm:w-10", i <= at ? "bg-primary" : "bg-border")} />}
            <span className="flex items-center gap-1.5">
              <span className={cn("grid size-6 place-items-center rounded-full text-[11px] font-bold tnum transition-colors",
                state === "done" && "bg-primary text-primary-foreground",
                state === "active" && "bg-primary-soft text-primary ring-2 ring-primary",
                state === "todo" && "bg-muted text-muted-foreground")}>
                {state === "done" ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
              </span>
              <span className={cn("text-xs font-semibold", state === "todo" ? "text-muted-foreground" : "text-foreground")}>{s.label}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
