"use client";

import { ArrowDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { istDate } from "@/lib/format";
import { displayName } from "@/lib/team";
import type { AgentName, Message } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AgentAvatar } from "./agent-avatar";
import { ChatMessage } from "./chat-message";
import { TypingIndicator } from "./primitives";

/**
 * A scrolling list of messages. It follows the newest message automatically,
 * unless the reader has scrolled up; then it shows a "New messages" button.
 */
export function MessageFeed({ messages, times, typing, compact, empty, className }: {
  messages: Message[]; times: Record<number, number>; typing: AgentName | null; compact?: boolean; empty: string; className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  const [behind, setBehind] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (pinned.current) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    else if (messages.length) setBehind(true);
  }, [messages.length, typing]);

  const onScroll = () => {
    const el = ref.current!;
    pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    if (pinned.current) setBehind(false);
  };
  const jump = () => { pinned.current = true; setBehind(false); ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: "smooth" }); };

  const firstTime = messages.length ? times[messages[0].id] : undefined;
  return (
    <div className={cn("relative min-h-0 flex-1", className)}>
      <div ref={ref} onScroll={onScroll} className={cn("flex h-full flex-col gap-3.5 overflow-y-auto scroll-thin", compact ? "px-3.5 py-3" : "px-5 py-4")}
        aria-live="polite" aria-label="Agent messages">
        {firstTime && (
          <div className="flex items-center gap-3 text-[11px] font-medium text-muted-foreground">
            <span className="h-px flex-1 bg-border" />{istDate(firstTime)}<span className="h-px flex-1 bg-border" />
          </div>
        )}
        {messages.map((m) => <ChatMessage key={m.id} m={m} time={times[m.id]} compact={compact} />)}
        {typing && typing !== "System" && (
          <div className="flex items-center gap-2 text-xs italic text-muted-foreground">
            <AgentAvatar who={typing} size={compact ? 24 : 28} /> {displayName(typing)} is typing <TypingIndicator />
          </div>
        )}
        {!messages.length && !typing && <p className="m-auto max-w-56 text-center text-[13px] text-muted-foreground">{empty}</p>}
      </div>
      {behind && (
        <button type="button" onClick={jump}
          className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground shadow-lg">
          <ArrowDown className="size-3.5" /> New messages
        </button>
      )}
    </div>
  );
}
