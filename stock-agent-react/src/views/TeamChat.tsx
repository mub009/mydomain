import { useEffect, useMemo, useRef } from "react";
import { ChatMessage } from "../components/ChatMessage";
import { Avatar, TypingDots } from "../components/ui";
import type { AgentName, Message } from "../lib/types";
import { displayName, TEAM, THREADS } from "../team";

interface Props {
  messages: Message[];
  shown: number;
  typing: AgentName | null;
  times: Record<number, string>;
  thread: string;
  onThread: (id: string) => void;
  seen: Record<string, number>;
}

export function TeamChat({ messages, shown, typing, times, thread, onThread, seen }: Props) {
  const visible = messages.slice(0, shown);
  const pending = messages[shown];
  const inThread = (m: Message) => thread === "all" || m.thread === thread || (thread === "team" && m.kind === "system");
  const list = visible.filter(inThread);
  const typingHere = typing && pending && inThread(pending);
  const paneRef = useRef<HTMLDivElement>(null);
  useEffect(() => { paneRef.current?.scrollTo({ top: paneRef.current.scrollHeight, behavior: "smooth" }); }, [list.length, typingHere]);

  const stats = useMemo(() => {
    const s: Record<string, { count: number; last?: Message }> = {};
    for (const t of [{ id: "all" }, ...THREADS]) s[t.id] = { count: 0 };
    for (const m of visible) {
      for (const id of ["all", m.thread]) { s[id].count++; s[id].last = m; }
    }
    return s;
  }, [visible]);

  const current = THREADS.find((t) => t.id === thread);
  const typingThread = typing && pending ? pending.thread : null;

  return (
    <div className="chat-layout card">
      <aside className="threads">
        <div className="threads-title">Conversations</div>
        {[{ id: "all", title: "All messages", members: [] as (keyof typeof TEAM)[] }, ...THREADS].map((t) => {
          const st = stats[t.id];
          const unread = t.id === thread ? 0 : Math.max(0, st.count - (seen[t.id] ?? 0));
          return (
            <button key={t.id} className={`thread ${t.id === thread ? "on" : ""}`} onClick={() => onThread(t.id)}>
              <span className="thread-avatars">
                {t.members.length === 2 ? t.members.map((p) => <Avatar key={p} who={p} size={22} />)
                  : <span className="hash">{t.id === "all" ? "≡" : "#"}</span>}
              </span>
              <span className="thread-text">
                <span className="thread-name">{t.title}</span>
                <span className="thread-last">
                  {typingThread === t.id || (t.id === "all" && typing) ? <em>{displayName(typing!)} is typing…</em>
                    : st.last ? `${displayName(st.last.sender)}: ${st.last.text}` : "No messages yet"}
                </span>
              </span>
              {unread > 0 && <span className="unread">{unread}</span>}
            </button>
          );
        })}
      </aside>

      <section className="pane">
        <header className="pane-head">
          <div>
            <h2>{thread === "all" ? "All messages" : current?.title}</h2>
            <p className="muted">
              {thread === "all" ? "Every conversation in order" :
                current?.members.map((p) => `${TEAM[p].name} · ${TEAM[p].title}`).join("   |   ")}
            </p>
          </div>
        </header>
        <div className="pane-body" ref={paneRef}>
          {list.map((m) => <ChatMessage key={m.id} m={m} time={times[m.id]} />)}
          {typingHere && (
            <div className="typing-row"><Avatar who={typing!} size={28} /> {displayName(typing!)} is typing <TypingDots /></div>
          )}
          {!list.length && !typingHere && <div className="empty">No messages in this conversation yet.</div>}
        </div>
      </section>
    </div>
  );
}
