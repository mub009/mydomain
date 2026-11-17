"use client";

import { AlertOctagon, AlertTriangle, BellRing, CheckCircle2, Info, LineChart, X } from "lucide-react";
import Link from "next/link";
import { Dialog } from "radix-ui";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/segmented";
import { inr, istTime } from "@/lib/format";
import { exitPlan } from "@/lib/positions/rules";
import type { PositionAlert, Severity } from "@/lib/positions/types";
import { TEAM } from "@/lib/team";
import type { Decision } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useDesk } from "@/store/desk";
import { usePositions } from "@/store/positions";
import { AgentAvatar } from "./agent-avatar";

export const SEVERITY: Record<Severity, { Icon: typeof Info; cls: string; label: string }> = {
  critical: { Icon: AlertOctagon, cls: "border-neg/50 bg-[var(--avoid-bg)] text-[var(--avoid-fg)]", label: "Exit now" },
  warning: { Icon: AlertTriangle, cls: "border-[var(--watch-fg)]/40 bg-[var(--watch-bg)] text-[var(--watch-fg)]", label: "Warning" },
  good: { Icon: CheckCircle2, cls: "border-pos/40 bg-[var(--buy-bg)] text-[var(--buy-fg)]", label: "Exit area" },
  info: { Icon: Info, cls: "border-primary/40 bg-primary-soft text-primary", label: "Heads-up" },
};

/** One follow-up alert, written by the agent who sent it. */
export function AlertItem({ a, compact }: { a: PositionAlert; compact?: boolean }) {
  const s = SEVERITY[a.severity];
  return (
    <div className={cn("flex gap-2.5", !a.read && "font-medium")}>
      <AgentAvatar who={a.from} size={compact ? 26 : 32} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 py-px text-[10.5px] font-bold", s.cls)}><s.Icon className="size-3" />{s.label}</span>
          <b className="text-[13px]">{a.title}</b>
          <time className="ml-auto text-[11px] font-normal text-muted-foreground tnum">{istTime(a.at)} IST</time>
        </div>
        {!compact && <p className="mt-0.5 text-[12.5px] font-normal leading-relaxed">{a.text}</p>}
        <div className="text-[11px] font-normal text-muted-foreground"><span style={{ color: TEAM[a.from].color }}>{TEAM[a.from].name}</span> · price {inr(a.price)}</div>
      </div>
    </div>
  );
}

/** Pop-up toasts for new alerts. */
export function AlertToasts() {
  const toasts = usePositions((s) => s.toasts);
  const dismiss = usePositions((s) => s.dismissToast);
  useEffect(() => {
    if (!toasts.length) return;
    const t = setTimeout(() => dismiss(toasts[0].id), 12000);
    return () => clearTimeout(t);
  }, [toasts, dismiss]);
  return (
    <div className="pointer-events-none fixed bottom-20 right-4 z-[60] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2 lg:bottom-4" aria-live="assertive">
      {toasts.map(({ id, alert }) => (
        <div key={id} role="alert" className={cn("pointer-events-auto card relative border-l-4 p-3 pr-8 shadow-xl", alert.severity === "critical" ? "border-l-neg" : alert.severity === "warning" ? "border-l-[var(--watch-fg)]" : alert.severity === "good" ? "border-l-pos" : "border-l-primary")}>
          <AlertItem a={alert} />
          <button type="button" onClick={() => dismiss(id)} aria-label="Dismiss" className="absolute right-2 top-2 rounded p-1 text-muted-foreground hover:bg-muted"><X className="size-3.5" /></button>
          <Link href="/positions" onClick={() => dismiss(id)} className="mt-1 block text-right text-xs font-semibold text-primary hover:underline">Open positions</Link>
        </div>
      ))}
    </div>
  );
}

/** Header bell with unread count. */
export function AlertsBell({ className }: { className?: string }) {
  const unread = usePositions((s) => s.alerts.filter((a) => !a.read).length);
  return (
    <Link href="/positions#alerts" aria-label={`${unread} unread alerts`}
      className={cn("relative grid size-8 place-items-center rounded-full border bg-card text-muted-foreground hover:text-foreground", className)}>
      <BellRing className="size-4" />
      {unread > 0 && <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-neg px-1 text-center text-[10px] font-bold leading-4 text-white tnum">{unread}</span>}
    </Link>
  );
}

/** "Track this trade": record what you bought so the agents can follow it up. */
export function TrackTradeButton({ d, size = "sm", className }: { d: Decision; size?: "sm" | "default"; className?: string }) {
  const source = useDesk((s) => s.result?.source.kind);
  const add = usePositions((s) => s.add);
  const tracked = usePositions((s) => s.positions.some((p) => p.status === "open" && p.symbol === d.symbol));
  const [open, setOpen] = useState(false);
  const [buy, setBuy] = useState(String(d.entry));
  const [qty, setQty] = useState(String(d.quantity || 1));
  const [stop, setStop] = useState(String(d.stopLoss));
  const [target, setTarget] = useState(String(d.target));
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const plan = exitPlan(Number(buy), Number(stop), Number(target));

  async function save() {
    setBusy(true); setErr(null);
    const e = await add({ symbol: d.symbol, qty: Number(qty), buyPrice: Number(buy), stop: Number(stop), target: Number(target), feed: source === "demo" ? "demo" : "live" });
    setBusy(false);
    if (e) setErr(e); else setOpen(false);
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button size={size} variant={tracked ? "outline" : "default"} className={className} disabled={tracked} onClick={(e) => e.stopPropagation()}>
          <LineChart />{tracked ? "Tracking" : "Track this trade"}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-black/40" />
        <Dialog.Content className="card fixed left-1/2 top-1/2 z-[71] w-[min(440px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <Dialog.Title className="text-lg font-bold">Track {d.symbol}</Dialog.Title>
          <Dialog.Description className="mt-0.5 text-[13px] text-muted-foreground">
            Enter what you actually bought. Lotappi and Mayavi will follow it up and alert you on losses, the stop-loss and the exit area.
          </Dialog.Description>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Field label="Buy price (₹)"><input className={inputClass} inputMode="decimal" value={buy} onChange={(e) => setBuy(e.target.value)} /></Field>
            <Field label="Quantity"><input className={inputClass} inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))} /></Field>
            <Field label="Stop-loss (₹)"><input className={inputClass} inputMode="decimal" value={stop} onChange={(e) => setStop(e.target.value)} /></Field>
            <Field label="Target (₹)"><input className={inputClass} inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} /></Field>
          </div>
          {plan.risk > 0 && Number(target) > Number(buy) && (
            <div className="mt-3 rounded-lg bg-muted/60 p-3 text-[12.5px] leading-relaxed tnum">
              <b>Exit plan</b><br />
              Stop-loss {inr(Number(stop))} · risk {inr(plan.risk * Number(qty || 0), 0)} in total<br />
              First exit {inr(Math.min(plan.partial, Number(target)))}: book half, move the stop to {inr(Number(buy))}<br />
              Target {inr(Number(target))}: exit the rest
            </div>
          )}
          {source === "demo" && <p className="mt-2 text-[11.5px] text-warn-fg">Demo run: this position follows a simulated price that moves every minute.</p>}
          {err && <p className="mt-2 text-[12.5px] font-medium text-neg">{err}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <Dialog.Close asChild><Button variant="outline">Cancel</Button></Dialog.Close>
            <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Start tracking"}</Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
