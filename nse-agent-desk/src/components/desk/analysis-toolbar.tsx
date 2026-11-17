"use client";

import { Download, FastForward, Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, inputClass, Segmented } from "@/components/ui/segmented";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { type Speed, symbolsOf, useBusy, useDesk } from "@/store/desk";

export function AnalysisToolbar() {
  const s = useDesk();
  const busy = useBusy();
  const symbols = symbolsOf(s);
  const valid = symbols.length >= 3 && symbols.length <= 150;
  const playing = !s.running && busy;

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
      <Field label="Universe">
        <Segmented label="Stock universe" value={s.universe} onChange={(universe) => s.set({ universe })}
          options={[{ value: "large", label: "Large" }, { value: "mid", label: "Mid" }, { value: "small", label: "Small" }, { value: "all", label: "All caps" }, { value: "custom", label: "My List" }]} />
      </Field>
      {s.universe === "custom" && (
        <Field label={`Symbols (${symbols.length})`} className="min-w-52 flex-1">
          <input className={cn(inputClass, !valid && "border-neg")} value={s.custom} onChange={(e) => s.set({ custom: e.target.value })}
            placeholder="RELIANCE, TCS, INFY…" aria-label="Custom NSE symbols, comma separated" aria-invalid={!valid} />
        </Field>
      )}
      <Field label="Top picks">
        <Segmented label="Top N selections" value={s.top} onChange={(top) => s.set({ top })} options={[3, 5, 10, 15].map((v) => ({ value: v, label: String(v) }))} />
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
      <div className="ml-auto flex flex-wrap items-center gap-2">
        {busy && s.messages.length > 0 && <Button variant="outline" onClick={s.skip}><FastForward />Skip to End</Button>}
        {s.result && !busy && <Button variant="outline" onClick={exportJson}><Download />Export JSON</Button>}
        <Button onClick={s.run} disabled={busy || !valid} className="min-w-40">
          {busy ? <Loader2 className="animate-spin" /> : <Play />}
          {s.running ? s.progress ?? "Working…" : playing ? "Agents talking…" : "Run Analysis"}
        </Button>
      </div>
      {!valid && <p className="w-full text-xs text-neg">Enter between 3 and 150 NSE symbols.</p>}
    </section>
  );
}
