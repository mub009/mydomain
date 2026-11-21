"use client";

/** Zerodha holdings and today's positions, read-only, shown on the Positions page. */
import { Check, Copy, Link2, Loader2, LogOut, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { inr, istTime, pct } from "@/lib/format";
import type { BrokerHolding, BrokerPosition } from "@/lib/broker/zerodha";
import { marketStatus } from "@/lib/market/calendar";
import { cn } from "@/lib/utils";
import { useDesk } from "@/store/desk";

interface State {
  configured: boolean; connected: boolean; expired?: boolean; error?: string; at?: string; expiresAt?: string;
  user?: { id: string; name?: string };
  holdings?: BrokerHolding[]; positions?: BrokerPosition[];
  totals?: { invested: number; value: number; pnl: number; pnlPct: number; dayPnl: number; positionsPnl: number };
}

const MSG: Record<string, [string, boolean]> = {
  connected: ["Zerodha connected.", true],
  cancelled: ["Zerodha login was cancelled.", false],
  failed: ["Zerodha login didn't complete. Please try again.", false],
  "not-configured": ["Add your Kite Connect API key and secret first (steps below).", false],
};

const signed = (v: number, digits = 0) => <span className={v >= 0 ? "text-pos" : "text-neg"}>{v >= 0 ? "+" : ""}{inr(v, digits)}</span>;

export function ZerodhaCard() {
  const [s, setS] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<[string, boolean] | null>(null);
  const [copied, setCopied] = useState(false);
  const searchStock = useDesk((x) => x.searchStock);

  const load = useCallback(async () => {
    setBusy(true);
    try { setS(await (await fetch("/api/broker/zerodha", { cache: "no-store" })).json()); }
    catch { setS((x) => x ?? { configured: false, connected: false }); }
    setBusy(false);
  }, []);

  useEffect(() => {
    load();
    const q = new URLSearchParams(window.location.search).get("broker");
    if (q && MSG[q]) { setNote(MSG[q]); window.history.replaceState(null, "", window.location.pathname); }
  }, [load]);

  // Refresh every minute in market hours while connected.
  useEffect(() => {
    if (!s?.connected) return;
    const t = setInterval(() => { if (marketStatus().open) load(); }, 60_000);
    return () => clearInterval(t);
  }, [s?.connected, load]);

  const callback = typeof window !== "undefined" ? `${window.location.origin}/api/broker/zerodha/callback` : "/api/broker/zerodha/callback";

  return (
    <section className="card overflow-hidden" aria-label="Zerodha">
      <header className="flex flex-wrap items-center gap-3 border-b border-[var(--edge)] px-4 py-3">
        <span className="grid size-9 place-items-center rounded-xl bg-[#387ED1] text-[15px] font-black text-white" aria-hidden>Z</span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold">Zerodha</h2>
          <p className="truncate text-xs text-muted-foreground">
            {s?.connected && s.user ? `${s.user.name ?? "Connected"} · ${s.user.id} · read-only${s.at ? ` · updated ${istTime(s.at)} IST` : ""}` : "Your holdings and today's positions, read-only"}
          </p>
        </div>
        {s?.connected && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={load} disabled={busy}><RefreshCw className={cn(busy && "animate-spin")} />Refresh</Button>
            <Button size="sm" variant="ghost" onClick={async () => { setNote(null); await fetch("/api/broker/zerodha/logout", { method: "POST" }); load(); }}><LogOut />Disconnect</Button>
          </div>
        )}
      </header>

      {note && <p className={cn("border-b border-[var(--edge)] px-4 py-2 text-[12.5px] font-medium", note[1] ? "text-pos" : "text-neg")}>{note[0]}</p>}

      {!s ? (
        <p className="flex items-center gap-2 px-4 py-6 text-[13px] text-muted-foreground"><Loader2 className="size-4 animate-spin" />Checking Zerodha…</p>
      ) : !s.configured ? (
        <div className="space-y-3 px-4 py-4 text-[13px] leading-relaxed">
          <p>To connect, create a Kite Connect app once (Zerodha&apos;s official API):</p>
          <ol className="list-decimal space-y-1.5 pl-5 text-muted-foreground">
            <li>Sign in at <a className="font-medium text-primary underline" href="https://developers.kite.trade" target="_blank" rel="noreferrer">developers.kite.trade</a> with your Zerodha account and create an app (the Personal plan covers holdings and positions; check pricing there).</li>
            <li>Set its <b className="text-foreground">Redirect URL</b> to:
              <span className="mt-1 flex items-center gap-2">
                <code className="well min-w-0 flex-1 truncate rounded-lg px-2 py-1 text-[12px]">{callback}</code>
                <button type="button" className="btn-3d grid size-8 shrink-0 place-items-center rounded-lg" aria-label="Copy redirect URL"
                  onClick={() => { navigator.clipboard?.writeText(callback); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
                  {copied ? <Check className="size-4 text-pos" /> : <Copy className="size-4" />}
                </button>
              </span>
            </li>
            <li>Add the app&apos;s API key and secret to the server as <code>KITE_API_KEY</code> and <code>KITE_API_SECRET</code> (on Vercel: Project → Settings → Environment Variables, then redeploy; locally: <code>.env.local</code>). Never paste the secret into a chat.</li>
            <li>Come back here and press <b className="text-foreground">Connect Zerodha</b>.</li>
          </ol>
        </div>
      ) : !s.connected ? (
        <div className="flex flex-wrap items-center gap-3 px-4 py-4">
          <p className="min-w-0 flex-1 basis-64 text-[13px] text-muted-foreground">
            {s.expired ? "Your Zerodha session ended (Kite sessions end at 6:00 AM IST every day). Connect again to refresh." :
              "You log in on Zerodha's own page; this app never sees your password. Access is read-only and ends at 6:00 AM IST each day."}
          </p>
          <Button asChild><a href="/api/broker/zerodha/login"><Link2 />Connect Zerodha</a></Button>
        </div>
      ) : s.error ? (
        <p className="px-4 py-4 text-[13px] text-neg">Couldn&apos;t load from Zerodha: {s.error}</p>
      ) : (
        <div className="space-y-4 p-4">
          {s.totals && (
            <dl className="grid grid-cols-2 gap-3 text-[12px] text-muted-foreground tnum sm:grid-cols-4">
              <div className="well rounded-xl p-3"><dt>Current value</dt><dd className="text-[17px] font-bold text-foreground">{inr(s.totals.value, 0)}</dd><dd>invested {inr(s.totals.invested, 0)}</dd></div>
              <div className="well rounded-xl p-3"><dt>Total P&amp;L</dt><dd className="text-[17px] font-bold">{signed(s.totals.pnl)}</dd><dd>{pct(s.totals.pnlPct)}</dd></div>
              <div className="well rounded-xl p-3"><dt>Today</dt><dd className="text-[17px] font-bold">{signed(s.totals.dayPnl)}</dd><dd>on holdings</dd></div>
              <div className="well rounded-xl p-3"><dt>Positions P&amp;L</dt><dd className="text-[17px] font-bold">{signed(s.totals.positionsPnl)}</dd><dd>{s.positions?.length ?? 0} open today</dd></div>
            </dl>
          )}

          <div>
            <h3 className="mb-2 text-[13px] font-semibold">Holdings <span className="font-normal text-muted-foreground">{s.holdings?.length ?? 0}</span></h3>
            {!s.holdings?.length ? <p className="text-[13px] text-muted-foreground">No holdings.</p> : (<>
              {/* phones: one compact row per holding */}
              <ul className="divide-y rounded-xl border sm:hidden">
                {s.holdings.map((h) => (
                  <li key={h.symbol + h.exchange} className="flex items-center gap-3 px-3 py-2.5 text-[12.5px] tnum">
                    <div className="min-w-0 flex-1">
                      <button type="button" onClick={() => searchStock(h.symbol)} className="font-semibold text-primary">{h.symbol}</button>
                      <div className="text-[11.5px] text-muted-foreground">{h.qty} × {inr(h.avgPrice)} · LTP {inr(h.lastPrice)} <span className={h.dayChangePct >= 0 ? "text-pos" : "text-neg"}>{pct(h.dayChangePct)}</span></div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-semibold">{signed(h.pnl)}</div>
                      <div className={cn("text-[11px]", h.pnlPct >= 0 ? "text-pos" : "text-neg")}>{pct(h.pnlPct)} · {inr(h.value, 0)}</div>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="overflow-x-auto rounded-xl border scroll-thin max-sm:hidden">
                <table className="w-full min-w-[520px] text-left text-[12.5px] tnum">
                  <thead className="bg-muted/60 text-[10.5px] uppercase tracking-wide text-muted-foreground">
                    <tr><th className="px-3 py-2">Stock</th><th className="px-3 py-2 text-right">Qty · Avg</th><th className="px-3 py-2 text-right">LTP · Today</th><th className="px-3 py-2 text-right">Value</th><th className="px-3 py-2 text-right">P&amp;L</th></tr>
                  </thead>
                  <tbody>
                    {s.holdings.map((h) => (
                      <tr key={h.symbol + h.exchange} className="border-t">
                        <td className="px-3 py-2">
                          <button type="button" onClick={() => searchStock(h.symbol)} className="font-semibold text-primary hover:underline" title="Open the agents' analysis">{h.symbol}</button>
                          <span className="ml-1 text-[10.5px] text-muted-foreground">{h.exchange}</span>
                        </td>
                        <td className="px-3 py-2 text-right">{h.qty} · {inr(h.avgPrice)}</td>
                        <td className="px-3 py-2 text-right">{inr(h.lastPrice)} <span className={h.dayChangePct >= 0 ? "text-pos" : "text-neg"}>{pct(h.dayChangePct)}</span></td>
                        <td className="px-3 py-2 text-right">{inr(h.value, 0)}</td>
                        <td className="px-3 py-2 text-right">{signed(h.pnl)} <span className={cn("text-[11px]", h.pnlPct >= 0 ? "text-pos" : "text-neg")}>{pct(h.pnlPct)}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>)}
          </div>

          {!!s.positions?.length && (
            <div>
              <h3 className="mb-2 text-[13px] font-semibold">Today&apos;s positions <span className="font-normal text-muted-foreground">{s.positions.length}</span></h3>
              <div className="overflow-x-auto rounded-xl border scroll-thin">
                <table className="w-full text-left text-[12.5px] tnum">
                  <thead className="bg-muted/60 text-[10.5px] uppercase tracking-wide text-muted-foreground">
                    <tr><th className="px-3 py-2">Stock</th><th className="px-3 py-2 max-sm:hidden">Product</th><th className="px-3 py-2 text-right">Qty · Avg</th><th className="px-3 py-2 text-right">LTP</th><th className="px-3 py-2 text-right">P&amp;L</th></tr>
                  </thead>
                  <tbody>
                    {s.positions.map((p) => (
                      <tr key={p.symbol + p.product + p.exchange} className="border-t">
                        <td className="px-3 py-2"><button type="button" onClick={() => searchStock(p.symbol)} className="font-semibold text-primary hover:underline">{p.symbol}</button></td>
                        <td className="px-3 py-2 text-muted-foreground max-sm:hidden">{p.product}</td>
                        <td className="px-3 py-2 text-right">{p.qty} · {inr(p.avgPrice)}</td>
                        <td className="px-3 py-2 text-right">{inr(p.lastPrice)}</td>
                        <td className="px-3 py-2 text-right">{signed(p.pnl)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <p className="text-[11.5px] text-muted-foreground">From Zerodha, read-only. Tap a stock for the agents&apos; analysis. Refreshes every minute in market hours; the session ends at 6:00 AM IST{s.expiresAt ? ` (${new Date(s.expiresAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })})` : ""}.</p>
        </div>
      )}
    </section>
  );
}
