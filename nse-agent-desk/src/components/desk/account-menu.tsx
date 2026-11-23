"use client";

/** Your NSE Desk login: avatar button → name, email, Account settings, Log out. */
import { ChevronUp, LogIn, LogOut, Settings, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DropdownMenu } from "radix-ui";
import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { DESK_API, useAuth } from "@/store/auth";

export const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";

export function AccountMenu({ compact }: { compact?: boolean }) {
  const router = useRouter();
  const { ready, user, init, logout } = useAuth();
  useEffect(() => { if (DESK_API && !ready) init(); }, [ready, init]);
  if (!DESK_API || !ready) return null;

  if (!user) return compact ? (
    <Link href="/login" className="flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-sidebar-border bg-sidebar-hover px-2 text-[11px] font-semibold text-white">
      <LogIn className="size-3.5" />Log in
    </Link>
  ) : (
    <div className="flex gap-2">
      <Link href="/login" className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-sidebar-hover py-1.5 text-[12.5px] font-semibold text-white hover:bg-white/15"><LogIn className="size-3.5" />Log in</Link>
      <Link href="/signup" className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-sidebar-border py-1.5 text-[12.5px] font-semibold text-white hover:bg-white/10"><UserPlus className="size-3.5" />Sign up</Link>
    </div>
  );

  const avatar = (size: string) => (
    <span className={cn("grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-indigo-400 to-violet-600 font-bold text-white ring-2 ring-white/15", size)}>{initials(user.name)}</span>
  );

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        {compact ? (
          <button type="button" aria-label={`Account: ${user.name}`} className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-white">{avatar("size-7 text-[11px]")}</button>
        ) : (
          <button type="button" className="flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left text-white outline-none hover:bg-sidebar-hover focus-visible:ring-2 focus-visible:ring-white/40 data-[state=open]:bg-sidebar-hover">
            {avatar("size-8 text-[12px]")}
            <span className="min-w-0 flex-1"><b className="block truncate text-[13px] font-semibold">{user.name}</b><span className="block truncate text-[11.5px] text-sidebar-muted">{user.email}</span></span>
            <ChevronUp className="size-4 shrink-0 text-sidebar-muted" />
          </button>
        )}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content side={compact ? "bottom" : "top"} align={compact ? "end" : "start"} sideOffset={8}
          className="card z-[60] w-64 p-1.5 text-[13px] shadow-xl data-[state=open]:animate-in data-[state=open]:fade-in-0">
          <div className="flex items-center gap-2.5 px-2.5 py-2">
            {avatar("size-9 text-[12px]")}
            <span className="min-w-0"><b className="block truncate font-semibold">{user.name}</b><span className="block truncate text-[12px] text-muted-foreground">{user.email}</span></span>
          </div>
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <DropdownMenu.Item onSelect={() => router.push("/account")} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 outline-none data-[highlighted]:bg-muted">
            <Settings className="size-4 text-muted-foreground" />Account settings
          </DropdownMenu.Item>
          <DropdownMenu.Item onSelect={async () => { await logout(); router.push("/login"); }} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-neg outline-none data-[highlighted]:bg-neg/10">
            <LogOut className="size-4" />Log out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
