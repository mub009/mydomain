"use client";

/** Zerodha holdings and today's positions, read-only, shown on the Positions page. */
import { Check, Copy, Eye, EyeOff, KeyRound, Link2, Loader2, Lock, LogOut, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { inr, istTime, pct } from "@/lib/format";
import type { BrokerHolding, BrokerPosition } from "@/lib/broker/zerodha";
import { marketStatus } from "@/lib/market/calendar";
import { cn } from "@/lib/utils";
import { DESK_API, deskApi, useAuth } from "@/store/auth";
import { useDesk } from "@/store/desk";

type Totals = { invested: number; value: number; pnl: number; pnlPct: number; dayPnl: number; positionsPnl: number };
interface Account {
  id?: number; // set by the NSE Desk API
  slot: number; connected: boolean; expired?: boolean; error?: string; expiresAt?: string;
  user?: { id: string; name?: string };
  holdings?: BrokerHolding[]; positions?: BrokerPosition[]; totals?: Totals;
}
/** A Kite Connect app the user saved (NSE Desk API); the secret never comes back. */
interface KiteAppInfo { id: number; label: string | null; apiKey: string; accounts: number }
interface State { configured: boolean; apps: (number | KiteAppInfo)[]; redirectUrl?: string; accounts: Account[]; combined?: Totals; at?: string; expired?: boolean; needLogin?: boolean }

const MSG: Record<string, [string, boolean]> = {
  connected: ["Zerodha account connected.", true],
  cancelled: ["Zerodha login was cancelled.", false],
  failed: ["Zerodha login didn't complete. Please try again.", false],
  "not-configured": ["Add your Kite Connect API key and secret first (steps below).", false],
};

const signed = (v: number, digits = 0) => <span className={v >= 0 ? "text-pos" : "text-neg"}>{v >= 0 ? "+" : ""}{inr(v, digits)}</span>;

function TotalsRow({ t, count }: { t: Totals; count: number }) {
  return (
    <dl className="grid grid-cols-2 gap-3 text-[12px] text-muted-foreground tnum sm:grid-cols-4">
      <div className="well rounded-xl p-3"><dt>Current value</dt><dd className="text-[17px] font-bold text-foreground">{inr(t.value, 0)}</dd><dd>invested {inr(t.invested, 0)}</dd></div>
      <div className="well rounded-xl p-3"><dt>Total P&amp;L</dt><dd className="text-[17px] font-bold">{signed(t.pnl)}</dd><dd>{pct(t.pnlPct)}</dd></div>
      <div className="well rounded-xl p-3"><dt>Today</dt><dd className="text-[17px] font-bold">{signed(t.dayPnl)}</dd><dd>on holdings</dd></div>
      <div className="well rounded-xl p-3"><dt>Positions P&amp;L</dt><dd className="text-[17px] font-bold">{signed(t.positionsPnl)}</dd><dd>{count} open today</dd></div>
    </dl>
  );
}

function AccountView({ a: s, onOpen }: { a: Account; onOpen: (symbol: string) => void }) {
  const searchStock = onOpen;
  return (
    <div className="space-y-4">
      {s.totals && <TotalsRow t={s.totals} count={s.positions?.length ?? 0} />}
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
    </div>
  );
}

/** Save a Kite Connect app (API key and secret) to the user's NSE Desk account. */
function AddKiteApp({ onSaved, first }: { onSaved: () => void; first: boolean }) {
  const [label, setLabel] = useState(""); const [key, setKey] = useState(""); const [secret, setSecret] = useState("");
  const [show, setShow] = useState(false); const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const field = "h-10 w-full rounded-xl border border-[var(--edge)] bg-card px-3 text-[13.5px] outline-none focus:border-primary focus:ring-4 focus:ring-primary/15";
  return (
    <form className="space-y-3" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); setErr(null);
      try { await deskApi("/api/zerodha/apps", { method: "POST", body: JSON.stringify({ label: label.trim() || null, api_key: key.trim(), api_secret: secret.trim() }) }); setLabel(""); setKey(""); setSecret(""); onSaved(); }
      catch (x) { setErr((x as Error).message); }
      setBusy(false);
    }}>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="space-y-1 text-[12.5px] font-medium">Name <span className="font-normal text-muted-foreground">(optional)</span>
          <input className={field} value={label} onChange={(e) => setLabel(e.target.value)} placeholder={first ? "My Zerodha" : "Family"} maxLength={60} /></label>
        <label className="space-y-1 text-[12.5px] font-medium">API key
          <input className={cn(field, "font-mono")} value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" spellCheck={false} required /></label>
        <label className="space-y-1 text-[12.5px] font-medium">API secret
          <span className="relative block">
            <input className={cn(field, "pr-10 font-mono")} type={show ? "text" : "password"} value={secret} onChange={(e) => setSecret(e.target.value)} autoComplete="off" spellCheck={false} required />
            <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Hide secret" : "Show secret"} className="absolute right-1.5 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground hover:bg-muted">
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </span></label>
      </div>
      {err && <p className="text-[12.5px] font-medium text-neg" role="alert">{err}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={busy || !key.trim() || !secret.trim()}>{busy ? <Loader2 className="animate-spin" /> : <KeyRound />}Save app</Button>
        <span className="flex items-center gap-1 text-[11.5px] text-muted-foreground"><Lock className="size-3" />Saved to your account; the secret is stored encrypted and never shown again.</span>
      </div>
    </form>
  );
}

export function ZerodhaCard() {
  const [s, setS] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<[string, boolean] | null>(null);
  const [copied, setCopied] = useState(false);
  const searchStock = useDesk((x) => x.searchStock);
  const { token, ready, init } = useAuth();
  useEffect(() => { if (DESK_API && !ready) init(); }, [ready, init]);
  useEffect(() => { if (DESK_API && ready && !token) setNote(null); }, [ready, token]); // logged out: drop old messages

  // With the NSE Desk API (Laravel), accounts belong to your login; otherwise this site's own routes.
  const load = useCallback(async () => {
    if (DESK_API && !ready) return;
    if (DESK_API && !token) { setS({ configured: true, apps: [], accounts: [], needLogin: true }); return; }
    setBusy(true);
    try { setS(DESK_API ? await deskApi<State>("/api/zerodha") : await (await fetch("/api/broker/zerodha", { cache: "no-store" })).json()); }
    catch { setS((x) => x ?? { configured: false, apps: [], accounts: [] }); }
    setBusy(false);
  }, [ready, token]);

  useEffect(() => {
    load();
    const q = new URLSearchParams(window.location.search).get("broker");
    if (q && MSG[q]) { setNote(MSG[q]); window.history.replaceState(null, "", window.location.pathname); }
  }, [load]);

  const anyConnected = Boolean(s?.accounts.some((a) => a.connected));
  // Refresh every minute in market hours while an account is connected.
  useEffect(() => {
    if (!anyConnected) return;
    const t = setInterval(() => { if (marketStatus().open) load(); }, 60_000);
    return () => clearInterval(t);
  }, [anyConnected, load]);

  const [adding, setAdding] = useState(false);
  const callback = s?.redirectUrl ?? (DESK_API ? `${DESK_API}/api/zerodha/callback` : typeof window !== "undefined" ? `${window.location.origin}/api/broker/zerodha/callback` : "/api/broker/zerodha/callback");
  const connect = async (app: number) => {
    if (!DESK_API) { window.location.href = `/api/broker/zerodha/login?slot=${app}`; return; }
    try { const { url } = await deskApi<{ url: string }>("/api/zerodha/connect", { method: "POST", body: JSON.stringify({ app_id: app }) }); window.location.href = url; }
    catch (e) { setNote([(e as Error).message, false]); }
  };
  const disconnect = async (a: Account) => {
    setNote(null);
    if (DESK_API && a.id) await deskApi(`/api/zerodha/accounts/${a.id}`, { method: "DELETE" }).catch(() => {});
    else await fetch(`/api/broker/zerodha/logout?slot=${a.slot}&user=${encodeURIComponent(a.user?.id ?? "")}`, { method: "POST" });
    load();
  };
  const connected = s?.accounts ?? [];
  // Saved Kite apps (NSE Desk API), or this site's own app slots.
  const apps: KiteAppInfo[] = (s?.apps ?? []).map((x) => (typeof x === "number" ? { id: x, label: x === 1 ? null : `App ${x}`, apiKey: "", accounts: 0 } : x));
  const removeApp = async (a: KiteAppInfo) => {
    if (!window.confirm(`Remove ${a.label ?? "this Kite app"}? Accounts connected through it will be disconnected.`)) return;
    try { await deskApi(`/api/zerodha/apps/${a.id}`, { method: "DELETE" }); setNote(["Kite app removed.", true]); } catch (e) { setNote([(e as Error).message, false]); }
    load();
  };
  const copyBox = (
    <span className="mt-1 flex items-center gap-2">
      <code className="well min-w-0 flex-1 truncate rounded-lg px-2 py-1 text-[12px]">{callback}</code>
      <button type="button" className="btn-3d grid size-8 shrink-0 place-items-center rounded-lg" aria-label="Copy redirect URL"
        onClick={() => { navigator.clipboard?.writeText(callback); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
        {copied ? <Check className="size-4 text-pos" /> : <Copy className="size-4" />}
      </button>
    </span>
  );
  const label = (a: Account) => (a.user ? `${a.user.name ?? "Zerodha"} · ${a.user.id}` : "Zerodha account");
  const end = connected.find((a) => a.expiresAt)?.expiresAt;

  return (
    <section className="card overflow-hidden" aria-label="Zerodha">
      <header className="flex flex-wrap items-center gap-3 border-b border-[var(--edge)] px-4 py-3">
        <span className="grid size-9 place-items-center rounded-xl bg-[#387ED1] text-[15px] font-black text-white" aria-hidden>Z</span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold">Zerodha</h2>
          <p className="truncate text-xs text-muted-foreground">
            {s?.configured ? `${connected.length ? `${connected.length} account${connected.length > 1 ? "s" : ""} connected` : "Not connected"} · read-only${anyConnected && s.at ? ` · updated ${istTime(s.at)} IST` : ""}` : "Your holdings and today's positions, read-only"}
          </p>
        </div>
        {anyConnected && <Button size="sm" variant="outline" onClick={load} disabled={busy}><RefreshCw className={cn(busy && "animate-spin")} />Refresh</Button>}
      </header>

      {note && <p className={cn("border-b border-[var(--edge)] px-4 py-2 text-[12.5px] font-medium", note[1] ? "text-pos" : "text-neg")}>{note[0]}</p>}

      {!s ? (
        <p className="flex items-center gap-2 px-4 py-6 text-[13px] text-muted-foreground"><Loader2 className="size-4 animate-spin" />Checking Zerodha…</p>
      ) : s.needLogin ? (
        <div className="flex flex-wrap items-center gap-3 px-4 py-4">
          <p className="min-w-0 flex-1 basis-64 text-[13px] text-muted-foreground">Log in to your NSE Agent Desk account to connect your Zerodha accounts. They stay linked to your login on every device.</p>
          <Button asChild><a href="/login"><Link2 />Log in</a></Button>
        </div>
      ) : !s.configured && DESK_API ? (
        <div className="space-y-4 px-4 py-4 text-[13px] leading-relaxed">
          <p>Connect Zerodha with your own Kite Connect app (Zerodha&apos;s official API). One-time setup:</p>
          <ol className="list-decimal space-y-1.5 pl-5 text-muted-foreground">
            <li>Sign in at <a className="font-medium text-primary underline" href="https://developers.kite.trade" target="_blank" rel="noreferrer">developers.kite.trade</a> with your Zerodha account and create an app (check pricing there).</li>
            <li>Set its <b className="text-foreground">Redirect URL</b> to:{copyBox}</li>
            <li>Copy the app&apos;s <b className="text-foreground">API key</b> and <b className="text-foreground">API secret</b> into the form below.</li>
          </ol>
          <AddKiteApp first onSaved={() => { setNote(["Kite app saved. Now press Connect Zerodha.", true]); load(); }} />
        </div>
      ) : !s.configured ? (
        <div className="space-y-3 px-4 py-4 text-[13px] leading-relaxed">
          <p>To connect, create a Kite Connect app once (Zerodha&apos;s official API):</p>
          <ol className="list-decimal space-y-1.5 pl-5 text-muted-foreground">
            <li>Sign in at <a className="font-medium text-primary underline" href="https://developers.kite.trade" target="_blank" rel="noreferrer">developers.kite.trade</a> with your Zerodha account and create an app (check pricing there).</li>
            <li>Set its <b className="text-foreground">Redirect URL</b> to:{copyBox}</li>
            <li>Add the app&apos;s API key and secret on this site&apos;s server as <code>KITE_API_KEY</code> and <code>KITE_API_SECRET</code> (on Vercel: Project → Settings → Environment Variables, then redeploy; locally: <code>.env.local</code>). Never paste the secret into a chat.</li>
            <li>Come back here and press <b className="text-foreground">Connect</b>.</li>
          </ol>
        </div>
      ) : (
        <div className="divide-y divide-[var(--edge)]">
          {s.combined && (
            <div className="space-y-2 p-4">
              <h3 className="text-[13px] font-semibold">All accounts <span className="font-normal text-muted-foreground">{connected.length} connected</span></h3>
              <TotalsRow t={s.combined} count={connected.reduce((n, a) => n + (a.positions?.length ?? 0), 0)} />
            </div>
          )}
          {connected.map((a) => (
            <div key={`${a.id ?? a.slot}-${a.user?.id}`} className="space-y-3 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="min-w-0 flex-1 truncate text-[14px] font-semibold">{label(a)}</h3>
                <Button size="sm" variant="ghost" onClick={() => disconnect(a)}><LogOut />Disconnect</Button>
              </div>
              {a.error ? <p className="text-[13px] text-neg">Couldn&apos;t load from Zerodha: {a.error}</p> : <AccountView a={a} onOpen={(sym) => searchStock(sym)} />}
            </div>
          ))}
          <div className="space-y-3 px-4 py-4">
            <p className="text-[13px] text-muted-foreground">
              {s.expired ? "A Zerodha session ended (Kite sessions end at 6:00 AM IST every day). Connect it again. " : ""}
              {connected.length
                ? "To add another Zerodha account (family or your second account), log out on kite.zerodha.com first, then connect and log in with that account's user ID."
                : "You log in on Zerodha's own page; this app never sees your password. Access is read-only and ends at 6:00 AM IST each day."}
            </p>
            {DESK_API ? (
              <ul className="divide-y rounded-xl border">
                {apps.map((app) => (
                  <li key={app.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                    <KeyRound className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <b className="block truncate text-[13px] font-semibold">{app.label ?? "Kite Connect app"}</b>
                      <span className="text-[11.5px] text-muted-foreground"><span className="font-mono">{app.apiKey}</span> · {app.accounts} account{app.accounts === 1 ? "" : "s"} connected</span>
                    </span>
                    <Button size="sm" variant={connected.length ? "outline" : "default"} onClick={() => connect(app.id)}><Link2 />{app.accounts ? "Connect another account" : "Connect Zerodha"}</Button>
                    <Button size="sm" variant="ghost" onClick={() => removeApp(app)} aria-label={`Remove ${app.label ?? "Kite app"}`}><Trash2 /></Button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex flex-wrap gap-2">
                {apps.map((app) => (
                  <Button key={app.id} variant={connected.length ? "outline" : "default"} onClick={() => connect(app.id)}>
                    <Link2 />{connected.length ? "Connect another account" : "Connect Zerodha"}{apps.length > 1 ? ` (app ${app.id})` : ""}
                  </Button>
                ))}
              </div>
            )}
            {DESK_API && (adding ? (
              <div className="space-y-2 rounded-xl border border-dashed p-3">
                <p className="text-[12.5px] text-muted-foreground">Another Kite Connect app, e.g. for a family member&apos;s Zerodha account. Its Redirect URL must be:{copyBox}</p>
                <AddKiteApp first={false} onSaved={() => { setAdding(false); setNote(["Kite app saved.", true]); load(); }} />
              </div>
            ) : (
              <button type="button" onClick={() => setAdding(true)} className="flex items-center gap-1.5 text-[12.5px] font-semibold text-primary hover:underline"><Plus className="size-3.5" />Add another Kite app</button>
            ))}
          </div>
          {anyConnected && (
            <p className="px-4 py-3 text-[11.5px] text-muted-foreground">
              From Zerodha, read-only. Tap a stock for the agents&apos; analysis. Refreshes every minute in market hours; sessions end at 6:00 AM IST{end ? ` (${new Date(end).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })})` : ""}.

            </p>
          )}
        </div>
      )}
    </section>
  );
}
