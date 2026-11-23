"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Download, FastForward, Loader2, Play, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, inputClass, Segmented } from "@/components/ui/segmented";
import { StockGroupPicker } from "./stock-group-picker";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { type Speed, symbolsOf, useBusy, useDesk } from "@/store/desk";
import { BIG_UNIVERSES, isBigUniverse } from "@/lib/market/lists";

export function AnalysisToolbar() {
  const s = useDesk();
  const busy = useBusy();
  const symbols = symbolsOf(s);
  const big = isBigUniverse(s.universe);
  // How many stocks the big list really has (downloaded from NSE on the server, kept for a day).
  const [count, setCount] = useState<Record<string, { count: number; from: string }>>({});
  useEffect(() => {
    if (!big || count[s.universe] || s.demo) return;
    let live = true;
    fetch(`/api/universe?list=${s.universe}`).then((r) => r.json())
      .then((r) => { if (live && r.count) setCount((c) => ({ ...c, [r.id]: { count: r.count, from: r.from } })); })
      .catch(() => { /* the hint keeps the rough number */ });
    return () => { live = false; };
  }, [big, s.universe, s.demo, count]);
  const known = big ? count[s.universe] : undefined;
  const valid = big || (symbols.length >= 3 && symbols.length <= 150);
  const playing = !s.running && busy;
  const [open, setOpen] = useState(false); // phones: settings folded away so Run Analysis stays in view
  const UNI: Record<string, string> = { large: "Large caps", mid: "Mid caps", small: "Small caps", all: "All caps", custom: "My Stocks", nifty500: "Nifty 500", allnse: "All NSE stocks" };

  function exportJson() {
    if (!s.result) return;
    const data = { ...s.result, conversation: s.messages.map((m) => ({ ...m, time: s.times[m.id] ? new Date(s.times[m.id]).toISOString() : undefined })) };
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    a.download = `nse-agent-desk-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <section className="card flex flex-wrap items-end gap-x-4 gap-y-3 p-3.5" aria-label="Analysis controls">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
        className="flex w-full items-center gap-2.5 rounded-xl text-left md:hidden">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary"><SlidersHorizontal className="size-4" /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold">Analysis settings</span>
          <span className="block truncate text-xs text-muted-foreground">{UNI[s.universe]} · top {s.top} · {s.risk}% risk{s.capital ? ` · ₹${Number(s.capital).toLocaleString("en-IN")}` : ""}{s.demo ? " · demo data" : ""}</span>
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      <div className={cn("contents", !open && "max-md:hidden")}>
      <Field label="Universe">
        <Segmented label="Stock universe" value={s.universe} onChange={(universe) => s.set({ universe })}
          options={[{ value: "large", label: "Large" }, { value: "mid", label: "Mid" }, { value: "small", label: "Small" }, { value: "all", label: "All caps" }, { value: "nifty500", label: "Nifty 500" }, { value: "allnse", label: "All NSE" }, { value: "custom", label: "My Stocks" }]} />
      </Field>

      <Field label="Top picks">
        <Segmented label="Top N selections" value={s.top} onChange={(top) => s.set({ top })} options={[3, 5, 10, 15, 20, 25].map((v) => ({ value: v, label: String(v) }))} />
      </Field>
      <Field label="Capital (₹)">
        <input className={cn(inputClass, "w-32")} inputMode="numeric" value={s.capital} placeholder="optional"
          onChange={(e) => s.set({ capital: e.target.value.replace(/[^\d]/g, "").slice(0, 11) })} aria-label="Capital in rupees" />
      </Field>
      <Field label="Risk / trade">
        <Segmented label="Risk per trade" value={s.risk} onChange={(risk) => s.set({ risk })} options={[0.5, 1, 2, 3].map((v) => ({ value: v, label: `${v}%` }))} />
      </Field>
      <Field label="Chat speed">
        <Segmented<Speed> label="Chat speed" value={s.speed} onChange={(speed) => s.set({ speed })}
          options={[{ value: "slow", label: "Slow" }, { value: "normal", label: "Normal" }, { value: "fast", label: "Fast" }]} />
      </Field>
      <div className="flex h-9 items-center gap-4">
        <label className="flex items-center gap-2 text-[13px] font-medium"><Switch checked={s.demo} onCheckedChange={(demo) => s.set({ demo })} />Demo data</label>
        <label className={cn("flex items-center gap-2 text-[13px] font-medium", !s.config?.aiAvailable && "text-muted-foreground")}
          title={s.config?.aiAvailable ? `Real model notes (${s.config.aiModel})` : "Set NVIDIA_API_KEY or ANTHROPIC_API_KEY on the server to enable AI notes"}>
          <Switch checked={s.aiNotes && Boolean(s.config?.aiAvailable)} disabled={!s.config?.aiAvailable} onCheckedChange={(aiNotes) => s.set({ aiNotes })} />AI notes
        </label>
      </div>
      </div>
      <div className="flex w-full flex-wrap items-center gap-2 md:ml-auto md:w-auto [&>button:last-child]:max-md:flex-1">
        {busy && s.messages.length > 0 && <Button variant="outline" onClick={s.skip}><FastForward />Skip to End</Button>}
        {s.result && !busy && <Button variant="outline" onClick={exportJson}><Download />Export JSON</Button>}
        <Button onClick={s.run} disabled={busy || !valid} className="min-w-40">
          {busy ? <Loader2 className="animate-spin" /> : <Play />}
          {s.running ? s.progress ?? "Working…" : playing ? "Agents talking…" : "Run Analysis"}
        </Button>
      </div>
      {s.universe === "custom" && <div className="w-full border-t border-[var(--edge)] pt-3"><StockGroupPicker /></div>}
      {big && (
        <p className="w-full text-xs text-muted-foreground">
          {BIG_UNIVERSES[s.universe as keyof typeof BIG_UNIVERSES].label}: a quick scan checks {known ? `${known.count.toLocaleString("en-IN")}${known.from === "nse" ? " NSE" : " built-in"}` : BIG_UNIVERSES[s.universe as keyof typeof BIG_UNIVERSES].about} stocks, then the agents research the strongest 150 in full. Takes 1-2 minutes{s.demo ? " (demo data uses the built-in 110 stocks)" : ""}.
        </p>
      )}
      {!valid && s.universe !== "custom" && <p className="w-full text-xs text-neg">Enter between 3 and 150 NSE symbols.</p>}
    </section>
  );
}
