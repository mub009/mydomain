"use client";

/** Account settings: profile, password, devices, Zerodha, delete account. */
import { AlertCircle, Check, CheckCircle2, Eye, EyeOff, KeyRound, Link2, Loader2, Lock, LogOut, Mail, MonitorSmartphone, Trash2, User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { initials } from "@/components/desk/account-menu";
import { Input, strength } from "@/components/desk/auth-screen";
import { PageHeader } from "@/components/desk/shell";
import { cn } from "@/lib/utils";
import { DESK_API, useAuth } from "@/store/auth";

type Note = { ok: boolean; text: string } | null;

function Section({ icon: Icon, title, text, children, danger }: { icon: typeof User; title: string; text: string; children: React.ReactNode; danger?: boolean }) {
  return (
    <section className={cn("card grid gap-5 p-5 md:grid-cols-[240px_minmax(0,1fr)] md:p-6", danger && "border-neg/30")}>
      <div>
        <h2 className={cn("flex items-center gap-2 text-[15px] font-semibold", danger && "text-neg")}><Icon className="size-4" />{title}</h2>
        <p className="mt-1 text-[13px] leading-snug text-muted-foreground">{text}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function Message({ note }: { note: Note }) {
  if (!note) return null;
  return (
    <p role={note.ok ? "status" : "alert"} className={cn("flex items-start gap-2 rounded-xl px-3 py-2.5 text-[13px] font-medium", note.ok ? "bg-pos/10 text-pos" : "bg-neg/10 text-neg")}>
      {note.ok ? <CheckCircle2 className="mt-px size-4 shrink-0" /> : <AlertCircle className="mt-px size-4 shrink-0" />}{note.text}
    </p>
  );
}

function SaveButton({ busy, disabled, children, danger }: { busy: boolean; disabled?: boolean; children: React.ReactNode; danger?: boolean }) {
  return (
    <button type="submit" disabled={busy || disabled}
      className={cn("inline-flex h-10 items-center gap-2 rounded-xl px-4 text-[13.5px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50", danger ? "bg-neg hover:brightness-110" : "btn-3d-primary")}>
      {busy && <Loader2 className="size-4 animate-spin" />}{children}
    </button>
  );
}

export default function AccountPage() {
  const router = useRouter();
  const a = useAuth();
  const ids = useId();
  useEffect(() => { if (DESK_API && !a.ready) a.init(); }, [a]);
  useEffect(() => { if (DESK_API && a.ready && !a.user) router.replace("/login"); }, [a.ready, a.user, router]);

  // profile
  const [name, setName] = useState(""); const [email, setEmail] = useState("");
  const [pNote, setPNote] = useState<Note>(null); const [pBusy, setPBusy] = useState(false);
  useEffect(() => { if (a.user) { setName(a.user.name); setEmail(a.user.email); } }, [a.user]);
  const changed = a.user && (name.trim() !== a.user.name || email.trim().toLowerCase() !== a.user.email);

  // password
  const [cur, setCur] = useState(""); const [pw, setPw] = useState(""); const [pw2, setPw2] = useState(""); const [show, setShow] = useState(false);
  const [wNote, setWNote] = useState<Note>(null); const [wBusy, setWBusy] = useState(false);
  const st = strength(pw); const mismatch = pw2.length > 0 && pw2 !== pw;

  // devices
  const [devices, setDevices] = useState<number | null>(null);
  const [dNote, setDNote] = useState<Note>(null); const [dBusy, setDBusy] = useState(false);
  useEffect(() => { if (a.user) a.devices().then(setDevices).catch(() => setDevices(null)); }, [a.user]); // eslint-disable-line react-hooks/exhaustive-deps

  // delete
  const [delOpen, setDelOpen] = useState(false); const [delPw, setDelPw] = useState("");
  const [xNote, setXNote] = useState<Note>(null); const [xBusy, setXBusy] = useState(false);

  const run = async (busy: (b: boolean) => void, note: (n: Note) => void, fn: () => Promise<string>) => {
    busy(true); note(null);
    try { note({ ok: true, text: await fn() }); } catch (e) { note({ ok: false, text: (e as Error).message }); }
    busy(false);
  };

  if (!DESK_API) return (<><PageHeader title="Account" subtitle="Your login and settings." /><div className="card p-5 text-[13.5px] text-muted-foreground">Accounts aren&apos;t switched on for this site yet.</div></>);
  if (!a.user) return (<><PageHeader title="Account" subtitle="Your login and settings." /><p className="flex items-center gap-2 text-[13px] text-muted-foreground"><Loader2 className="size-4 animate-spin" />Loading…</p></>);

  const toggle = (
    <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Hide passwords" : "Show passwords"} className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground">
      {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
    </button>
  );

  return (
    <>
      <PageHeader title="Account settings" subtitle="Your profile, password and logins." />
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="card flex items-center gap-4 p-5">
          <span className="grid size-14 shrink-0 place-items-center rounded-full bg-gradient-to-br from-indigo-400 to-violet-600 text-[18px] font-bold text-white">{initials(a.user.name)}</span>
          <div className="min-w-0">
            <p className="truncate text-[17px] font-bold">{a.user.name}</p>
            <p className="truncate text-[13px] text-muted-foreground">{a.user.email}</p>
          </div>
          <button type="button" onClick={async () => { await a.logout(); router.push("/login"); }}
            className="btn-3d ml-auto inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold text-neg">
            <LogOut className="size-4" />Log out
          </button>
        </div>

        <Section icon={User} title="Profile" text="Your name and the email you log in with.">
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); run(setPBusy, setPNote, async () => { await a.updateProfile(name.trim(), email.trim()); return "Profile saved."; }); }}>
            <Message note={pNote} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input id={`${ids}-n`} label="Full name" icon={User} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required maxLength={100} />
              <Input id={`${ids}-e`} label="Email" icon={Mail} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
            </div>
            <SaveButton busy={pBusy} disabled={!changed || !name.trim()}>Save changes</SaveButton>
          </form>
        </Section>

        <Section icon={KeyRound} title="Password" text="Changing it logs you out on your other devices; this one stays logged in.">
          <form className="space-y-4" onSubmit={(e) => {
            e.preventDefault();
            run(setWBusy, setWNote, async () => {
              const n = await a.changePassword(cur, pw, pw2);
              setCur(""); setPw(""); setPw2("");
              setDevices(1);
              return `Password changed.${n ? ` Logged out on ${n} other device${n > 1 ? "s" : ""}.` : ""}`;
            });
          }}>
            <Message note={wNote} />
            <Input id={`${ids}-c`} label="Current password" icon={Lock} type={show ? "text" : "password"} value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" required right={toggle} />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Input id={`${ids}-p`} label="New password" icon={Lock} type={show ? "text" : "password"} value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" placeholder="At least 8 characters" minLength={8} required />
                {pw && (
                  <div className="flex items-center gap-2.5" aria-live="polite">
                    <div className="grid flex-1 grid-cols-4 gap-1">
                      {[1, 2, 3, 4].map((i) => <span key={i} className={cn("h-1.5 rounded-full", i <= Math.max(st.score, 1) ? (st.score <= 1 ? "bg-neg" : st.score === 2 ? "bg-amber-500" : "bg-pos") : "bg-muted")} />)}
                    </div>
                    <span className={cn("w-16 text-right text-[11.5px] font-semibold", st.score <= 1 ? "text-neg" : st.score === 2 ? "text-amber-600" : "text-pos")}>{st.label}</span>
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <Input id={`${ids}-p2`} label="Confirm new password" icon={Lock} type={show ? "text" : "password"} value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" required
                  right={pw2 && !mismatch ? <Check className="mr-2 size-4 text-pos" aria-label="Passwords match" /> : undefined} />
                {mismatch && <p className="text-[12px] font-medium text-neg">The passwords don&apos;t match.</p>}
              </div>
            </div>
            <SaveButton busy={wBusy} disabled={!cur || pw.length < 8 || mismatch || !pw2}>Change password</SaveButton>
          </form>
        </Section>

        <Section icon={MonitorSmartphone} title="Logged-in devices" text="Phones, laptops and browsers where you're logged in.">
          <div className="space-y-3">
            <Message note={dNote} />
            <p className="text-[13.5px]">{devices === null ? "…" : devices === 1 ? "You're logged in on this device only." : <>You&apos;re logged in on <b>{devices} devices</b>, including this one.</>}</p>
            <button type="button" disabled={dBusy || !devices || devices < 2}
              onClick={() => run(setDBusy, setDNote, async () => { const n = await a.logoutOthers(); setDevices(1); return n ? `Logged out on ${n} other device${n > 1 ? "s" : ""}.` : "No other devices were logged in."; })}
              className="btn-3d inline-flex h-10 items-center gap-2 rounded-xl px-4 text-[13.5px] font-semibold disabled:cursor-not-allowed disabled:opacity-50">
              {dBusy ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}Log out of other devices
            </button>
          </div>
        </Section>

        <Section icon={Link2} title="Zerodha accounts" text="Connected broker accounts, read-only.">
          <p className="text-[13.5px] text-muted-foreground">Connect or disconnect your Zerodha accounts (yours and your family&apos;s) on the Positions page.</p>
          <Link href="/positions" className="btn-3d mt-3 inline-flex h-10 items-center gap-2 rounded-xl px-4 text-[13.5px] font-semibold"><Link2 className="size-4" />Manage Zerodha accounts</Link>
        </Section>

        <Section icon={Trash2} title="Delete account" text="Removes your login, all devices and your connected Zerodha accounts from NSE Agent Desk. This can't be undone." danger>
          {!delOpen ? (
            <button type="button" onClick={() => setDelOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-xl border border-neg/40 px-4 text-[13.5px] font-semibold text-neg hover:bg-neg/10">
              <Trash2 className="size-4" />Delete my account
            </button>
          ) : (
            <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); run(setXBusy, setXNote, async () => { await a.deleteAccount(delPw); router.push("/signup"); return "Account deleted."; }); }}>
              <Message note={xNote} />
              <Input id={`${ids}-d`} label="Type your password to confirm" icon={Lock} type="password" value={delPw} onChange={(e) => setDelPw(e.target.value)} autoComplete="current-password" required />
              <div className="flex flex-wrap gap-2">
                <SaveButton busy={xBusy} disabled={!delPw} danger><Trash2 className="size-4" />Delete permanently</SaveButton>
                <button type="button" onClick={() => { setDelOpen(false); setDelPw(""); setXNote(null); }} className="btn-3d h-10 rounded-xl px-4 text-[13.5px] font-semibold">Cancel</button>
              </div>
            </form>
          )}
        </Section>
      </div>
    </>
  );
}
