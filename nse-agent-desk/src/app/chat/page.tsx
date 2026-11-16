"use client";

import { Hash, Layers, Lock } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AgentAvatar } from "@/components/desk/agent-avatar";
import { AnalysisToolbar } from "@/components/desk/analysis-toolbar";
import { MessageFeed } from "@/components/desk/message-feed";
import { PageHeader } from "@/components/desk/shell";
import { istTime } from "@/lib/format";
import { displayName, TEAM, THREADS } from "@/lib/team";
import type { Message } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useDesk } from "@/store/desk";

const ALL = { id: "all", title: "All Messages", members: [] as (keyof typeof TEAM)[] };
const LIST = [ALL, ...THREADS];

export default function ChatPage() {
  const [thread, setThread] = useState("all");
  const messages = useDesk((s) => s.messages);
  const shown = useDesk((s) => s.shown);
  const typing = useDesk((s) => s.typing);
  const times = useDesk((s) => s.times);
  const seen = useDesk((s) => s.seen);
  const markSeen = useDesk((s) => s.markSeen);

  const visible = useMemo(() => messages.slice(0, shown), [messages, shown]);
  const pending = messages[shown];
  const inThread = (m: Message, id: string) => id === "all" || m.thread === id;
  const list = visible.filter((m) => inThread(m, thread));
  const typingHere = typing && pending && inThread(pending, thread) ? typing : null;

  useEffect(() => { markSeen(thread); markSeen("all"); }, [thread, shown, markSeen]);

  const stats = useMemo(() => {
    const s: Record<string, { count: number; last?: Message }> = Object.fromEntries(LIST.map((t) => [t.id, { count: 0 }]));
    for (const m of visible) for (const id of ["all", m.thread]) { s[id].count++; s[id].last = m; }
    return s;
  }, [visible]);

  const current = LIST.find((t) => t.id === thread)!;

  return (
    <>
      <PageHeader title="Team Chat" subtitle="Watch the agents talk one-to-one. The feed is read-only." />
      <div className="space-y-4">
        <div className="hidden md:block"><AnalysisToolbar /></div>
        <div className="card grid h-[calc(100dvh-13.25rem)] min-h-[360px] overflow-hidden md:h-[calc(100dvh-17.5rem)] md:grid-cols-[280px_1fr]">
          {/* conversations */}
          <aside className="flex gap-2 overflow-x-auto border-b bg-muted/40 p-2 scroll-thin md:flex-col md:gap-0.5 md:overflow-y-auto md:border-b-0 md:border-r" aria-label="Conversations">
            <div className="hidden px-2 pb-1.5 pt-1 text-[10.5px] font-semibold uppercase tracking-widest text-muted-foreground md:block">Conversations</div>
            {LIST.map((t) => {
              const st = stats[t.id];
              const on = t.id === thread;
              const unread = on ? 0 : Math.max(0, st.count - (seen[t.id] ?? 0));
              const isTyping = typing && pending && inThread(pending, t.id);
              return (
                <button key={t.id} type="button" onClick={() => setThread(t.id)} aria-current={on ? "true" : undefined}
                  className={cn("flex shrink-0 items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors md:w-full",
                    on ? "bg-card shadow-card ring-1 ring-border" : "hover:bg-muted")}>
                  <span className="flex w-9 shrink-0 justify-center">
                    {t.members.length === 2
                      ? <span className="flex">{t.members.map((p, i) => <AgentAvatar key={p} who={p} size={24} className={i ? "-ml-2.5 rounded-full ring-2 ring-card" : ""} />)}</span>
                      : <span className="grid size-8 place-items-center rounded-lg bg-primary-soft text-primary">{t.id === "all" ? <Layers className="size-4" /> : <Hash className="size-4" />}</span>}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[13px] font-semibold">{t.title}</span>
                      {st.last && times[st.last.id] && <time className="hidden shrink-0 text-[10.5px] text-muted-foreground tnum md:inline">{istTime(times[st.last.id])}</time>}
                    </span>
                    <span className="hidden truncate text-xs text-muted-foreground md:block">
                      {isTyping ? <em className="font-medium not-italic text-primary">{displayName(typing!)} is typing…</em>
                        : st.last ? `${displayName(st.last.sender)}: ${st.last.text}` : "No messages yet"}
                    </span>
                  </span>
                  {unread > 0 && <span className="rounded-full bg-primary px-1.5 text-[10.5px] font-bold leading-[18px] text-primary-foreground tnum">{unread}</span>}
                </button>
              );
            })}
          </aside>

          {/* messages */}
          <section className="flex min-h-0 min-w-0 flex-col">
            <header className="flex items-center gap-3 border-b px-5 py-3">
              {current.members.length === 2 && <span className="flex">{current.members.map((p, i) => <AgentAvatar key={p} who={p} size={32} className={i ? "-ml-3 rounded-full ring-2 ring-card" : ""} />)}</span>}
              <div className="min-w-0">
                <h2 className="truncate text-[15px] font-semibold">{current.title}</h2>
                <p className="truncate text-xs text-muted-foreground">
                  {thread === "all" ? "Every conversation, in order" : thread === "team" ? "All four agents · announcements"
                    : current.members.map((p) => `${TEAM[p].name} · ${TEAM[p].title}`).join("  |  ")}
                </p>
              </div>
              <span className="ml-auto text-xs text-muted-foreground tnum">{list.length} message{list.length === 1 ? "" : "s"}</span>
            </header>
            <MessageFeed key={thread} messages={list} times={times} typing={typingHere}
              empty={messages.length ? "No messages in this conversation yet." : "Run an analysis to start the conversation."} />
            <footer className="flex items-center justify-center gap-1.5 border-t bg-muted/40 px-4 py-2 text-[11.5px] text-muted-foreground">
              <Lock className="size-3 shrink-0" /> Read-only feed<span className="hidden sm:inline">. Agent messages are simulated from the analysis results.</span>
            </footer>
          </section>
        </div>
      </div>
    </>
  );
}
