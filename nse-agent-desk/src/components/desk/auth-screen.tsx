"use client";

/** Full-screen log in / sign up: brand panel on the left (desktop), form on the right. */
import { AlertCircle, ArrowLeft, Bot, Check, Eye, EyeOff, Landmark, Link2, Loader2, Lock, Mail, ShieldCheck, Timer, User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { PEOPLE } from "@/lib/team";
import { cn } from "@/lib/utils";
import { DESK_API, useAuth } from "@/store/auth";
import { AgentAvatar } from "./agent-avatar";
import { Logo, ThemeToggle } from "./shell";

const FEATURES = [
  { Icon: Bot, title: "A team of AI agents", text: "Momentum, trend, research desk, Black Points and Decision agents study every stock." },
  { Icon: ShieldCheck, title: "Checked against official sources", text: "NSE prices, SEBI orders, RBI and Fed policy, company filings." },
  { Icon: Timer, title: "Clear trade plans", text: "Entry, stop-loss, target, and how long to hold, with the odds." },
  { Icon: Link2, title: "Your Zerodha accounts, read-only", text: "Holdings and positions for you and your family, on every device." },
];

/** 0-4: length, upper and lower case, a digit, a symbol. */
function strength(p: string): { score: number; label: string } {
  let s = 0;
  if (p.length >= 8) s++;
  if (p.length >= 12) s++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++;
  if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) s++;
  const score = p.length < 8 ? Math.min(s, 1) : s;
  return { score, label: !p ? "" : p.length < 8 ? "Too short" : ["Weak", "Weak", "Fair", "Good", "Strong"][score] };
}

function Input({ id, label, icon: Icon, right, ...rest }: React.InputHTMLAttributes<HTMLInputElement> & { id: string; label: string; icon: typeof Mail; right?: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-[13px] font-medium">{label}</label>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input id={id} {...rest}
          className={cn("h-11 w-full rounded-xl border border-[var(--edge)] bg-card pl-10 text-[14px] shadow-sm outline-none transition placeholder:text-muted-foreground/60",
            "focus:border-primary focus:ring-4 focus:ring-primary/15", right ? "pr-11" : "pr-3")} />
        {right && <span className="absolute right-1.5 top-1/2 -translate-y-1/2">{right}</span>}
      </div>
    </div>
  );
}

export function AuthScreen({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const { user, login, register, init, ready } = useAuth();
  const [name, setName] = useState(""); const [email, setEmail] = useState("");
  const [password, setPassword] = useState(""); const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false); const [agree, setAgree] = useState(false);
  const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const ids = useId();
  const signup = mode === "signup";
  const st = strength(password);
  const mismatch = signup && confirm.length > 0 && confirm !== password;

  useEffect(() => { if (!ready) init(); }, [ready, init]);
  useEffect(() => { if (user) router.replace("/positions"); }, [user, router]);
  useEffect(() => { setErr(null); }, [mode]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (signup && password !== confirm) { setErr("The passwords don't match."); return; }
    setBusy(true); setErr(null);
    try { if (signup) await register(name.trim(), email.trim(), password, confirm); else await login(email.trim(), password); }
    catch (x) {
      const m = (x as Error).message;
      setErr(/failed to fetch|networkerror|load failed/i.test(m) ? "Can't reach the login server right now. Please try again in a moment." : m);
    }
    setBusy(false);
  }

  const toggle = (
    <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Hide password" : "Show password"}
      className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground">
      {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
    </button>
  );

  return (
    <div className="grid min-h-dvh bg-background lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      {/* brand panel */}
      <aside className="relative hidden overflow-hidden bg-sidebar p-10 text-white lg:flex lg:flex-col xl:p-14">
        <div aria-hidden className="pointer-events-none absolute -right-32 -top-32 size-[28rem] rounded-full bg-[radial-gradient(circle,rgb(99_102_241/0.45),transparent_65%)]" />
        <div aria-hidden className="pointer-events-none absolute -bottom-40 -left-24 size-[30rem] rounded-full bg-[radial-gradient(circle,rgb(16_185_129/0.22),transparent_65%)]" />
        <Link href="/" className="relative flex items-center gap-3">
          <Logo />
          <span><b className="block text-[17px] font-bold leading-tight">NSE Agent Desk</b><span className="text-[12px] text-sidebar-muted">AI stock research team</span></span>
        </Link>

        <div className="relative my-auto max-w-lg py-10">
          <h2 className="text-[34px] font-extrabold leading-[1.15] tracking-tight xl:text-[40px]">
            Research Indian stocks with a team of AI agents.
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-sidebar-foreground">
            Every run scans the market, checks the risks and explains each decision, so you see the reasons, not just a tip.
          </p>
          <ul className="mt-8 space-y-4">
            {FEATURES.map(({ Icon, title, text }) => (
              <li key={title} className="flex gap-3.5">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/10 ring-1 ring-white/15"><Icon className="size-5" /></span>
                <span><b className="block text-[14.5px] font-semibold">{title}</b><span className="text-[13px] leading-snug text-sidebar-muted">{text}</span></span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex items-center justify-between gap-4 border-t border-sidebar-border pt-5">
          <div className="flex -space-x-2" aria-label="The AI agents">
            {PEOPLE.slice(0, 9).map((p) => <AgentAvatar key={p} who={p} size={30} className="rounded-full ring-2 ring-sidebar" />)}
            <span className="grid size-[30px] place-items-center rounded-full bg-white/10 text-[11px] font-bold ring-2 ring-sidebar">+{Math.max(0, PEOPLE.length - 9)}</span>
          </div>
          <p className="text-right text-[11.5px] leading-snug text-sidebar-muted">Research tool only,<br />not investment advice.</p>
        </div>
      </aside>

      {/* form */}
      <main className="flex min-h-dvh flex-col px-5 py-5 sm:px-8">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
            <ArrowLeft className="size-4" />Back to the app
          </Link>
          <ThemeToggle />
        </div>

        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-10">
          <div className="mb-7 flex items-center gap-3 lg:hidden">
            <Logo /><b className="text-[16px] font-bold">NSE Agent Desk</b>
          </div>
          <h1 className="text-[28px] font-extrabold tracking-tight">{signup ? "Create your account" : "Welcome back"}</h1>
          <p className="mt-1.5 text-[14px] text-muted-foreground">
            {signup ? "Free to start. Your Zerodha accounts and settings follow you to every device." : "Log in to see your Zerodha accounts and the agents' research."}
          </p>

          {!DESK_API ? (
            <div className="mt-8 flex gap-3 rounded-xl border border-[var(--edge)] bg-muted/50 p-4 text-[13.5px] text-muted-foreground">
              <Landmark className="mt-0.5 size-4 shrink-0" />Accounts aren&apos;t switched on for this site yet.
            </div>
          ) : (
            <form onSubmit={submit} className="mt-8 space-y-4" noValidate={false}>
              {err && (
                <div role="alert" className="flex gap-2.5 rounded-xl border border-neg/30 bg-neg/10 px-3.5 py-3 text-[13px] font-medium text-neg">
                  <AlertCircle className="mt-px size-4 shrink-0" />{err}
                </div>
              )}
              {signup && <Input id={`${ids}-name`} label="Full name" icon={User} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="Your name" required maxLength={100} />}
              <Input id={`${ids}-email`} label="Email" icon={Mail} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com" required />
              <div className="space-y-1.5">
                <Input id={`${ids}-pw`} label="Password" icon={Lock} type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
                  autoComplete={signup ? "new-password" : "current-password"} placeholder={signup ? "At least 8 characters" : "Your password"} minLength={signup ? 8 : undefined} required right={toggle} />
                {signup && password && (
                  <div className="flex items-center gap-2.5" aria-live="polite">
                    <div className="grid flex-1 grid-cols-4 gap-1">
                      {[1, 2, 3, 4].map((i) => (
                        <span key={i} className={cn("h-1.5 rounded-full", i <= Math.max(st.score, 1) ? (st.score <= 1 ? "bg-neg" : st.score === 2 ? "bg-amber-500" : "bg-pos") : "bg-muted")} />
                      ))}
                    </div>
                    <span className={cn("w-16 text-right text-[11.5px] font-semibold", st.score <= 1 ? "text-neg" : st.score === 2 ? "text-amber-600" : "text-pos")}>{st.label}</span>
                  </div>
                )}
              </div>
              {signup && (
                <div className="space-y-1.5">
                  <Input id={`${ids}-pw2`} label="Confirm password" icon={Lock} type={show ? "text" : "password"} value={confirm} onChange={(e) => setConfirm(e.target.value)}
                    autoComplete="new-password" placeholder="Type it again" required aria-invalid={mismatch || undefined}
                    right={confirm && !mismatch ? <Check className="mr-2 size-4 text-pos" aria-label="Passwords match" /> : undefined} />
                  {mismatch && <p className="text-[12px] font-medium text-neg">The passwords don&apos;t match.</p>}
                </div>
              )}
              {signup && (
                <label className="flex items-start gap-2.5 text-[12.5px] leading-snug text-muted-foreground">
                  <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} required className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]" />
                  I understand NSE Agent Desk is a research tool and not investment advice.
                </label>
              )}
              <button type="submit" disabled={busy || (signup && (!agree || mismatch || password.length < 8))}
                className="btn-3d-primary flex h-11 w-full items-center justify-center gap-2 rounded-xl text-[14.5px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
                {busy && <Loader2 className="size-4 animate-spin" />}
                {busy ? (signup ? "Creating your account…" : "Logging in…") : signup ? "Create account" : "Log in"}
              </button>
            </form>
          )}

          <p className="mt-7 text-center text-[13.5px] text-muted-foreground">
            {signup ? "Already have an account? " : "New to NSE Agent Desk? "}
            <Link href={signup ? "/login" : "/signup"} className="font-semibold text-primary hover:underline">{signup ? "Log in" : "Create an account"}</Link>
          </p>
        </div>

        <p className="text-center text-[11.5px] text-muted-foreground">
          <Lock className="mr-1 inline size-3 -translate-y-px" />Your password is sent securely and stored only as a hash. Zerodha access is read-only.
        </p>
      </main>
    </div>
  );
}
