"use client";

import { LogIn, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/desk/shell";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/segmented";
import { cn } from "@/lib/utils";
import { DESK_API, useAuth } from "@/store/auth";

export default function LoginPage() {
  const router = useRouter();
  const { user, login, register, init, ready } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState(""); const [email, setEmail] = useState("");
  const [password, setPassword] = useState(""); const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);

  useEffect(() => { if (!ready) init(); }, [ready, init]);
  useEffect(() => { if (user) router.replace("/positions"); }, [user, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    try { if (mode === "login") await login(email, password); else await register(name, email, password, confirm); }
    catch (x) { setErr((x as Error).message); }
    setBusy(false);
  }

  return (
    <>
      <PageHeader title={mode === "login" ? "Log in" : "Create account"} subtitle="Your NSE Agent Desk login keeps your Zerodha accounts on every device." />
      {!DESK_API ? (
        <div className="card max-w-md p-5 text-[13.5px] text-muted-foreground">Logins aren&apos;t switched on for this site (NEXT_PUBLIC_DESK_API is not set).</div>
      ) : (
        <form onSubmit={submit} className="card mx-auto w-full max-w-md space-y-4 p-5">
          <div role="tablist" className="well grid grid-cols-2 rounded-xl p-1">
            {([["login", "Log in"], ["register", "Sign up"]] as const).map(([v, l]) => (
              <button key={v} type="button" role="tab" aria-selected={mode === v} onClick={() => { setMode(v); setErr(null); }}
                className={cn("rounded-lg py-1.5 text-[13px] font-medium", mode === v ? "raised font-semibold text-foreground" : "text-muted-foreground")}>{l}</button>
            ))}
          </div>
          {mode === "register" && <Field label="Name"><input aria-label="Name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required /></Field>}
          <Field label="Email"><input aria-label="Email" className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></Field>
          <Field label="Password"><input aria-label="Password" className={inputClass} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={mode === "register" ? 8 : undefined} required /></Field>
          {mode === "register" && <Field label="Confirm password"><input aria-label="Confirm password" className={inputClass} type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required /></Field>}
          {err && <p className="text-[12.5px] font-medium text-neg" role="alert">{err}</p>}
          <Button type="submit" className="w-full" disabled={busy}>{mode === "login" ? <LogIn /> : <UserPlus />}{busy ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}</Button>
        </form>
      )}
    </>
  );
}
