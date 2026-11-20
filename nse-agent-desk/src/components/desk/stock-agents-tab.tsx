"use client";

/** Stock window, "Agents" tab: the team discussing this one stock, played back like the live chat. */
import { FastForward, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { stockConversation } from "@/lib/stock-dialogue";
import type { Decision, RunResult } from "@/lib/types";
import { MessageFeed } from "./message-feed";

export function StockAgentsTab({ d, result }: { d: Decision; result: RunResult }) {
  const messages = useMemo(() => stockConversation(d, result), [d, result]);
  const [shown, setShown] = useState(0);
  const [times, setTimes] = useState<Record<number, number>>({});
  const [run, setRun] = useState(0);

  // reveal one message at a time, with a reading pause based on its length
  useEffect(() => {
    if (shown >= messages.length) return;
    const next = messages[shown];
    const delay = shown === 0 ? 300 : Math.min(2200, 650 + next.text.length * 6);
    const tm = setTimeout(() => { setShown((n) => n + 1); setTimes((x) => ({ ...x, [next.id]: Date.now() })); }, delay);
    return () => clearTimeout(tm);
  }, [shown, messages, run]);
  useEffect(() => { setShown(0); setTimes({}); }, [messages]);

  const done = shown >= messages.length;
  const typing = done ? null : messages[shown].sender;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mx-4 mb-2 flex items-center gap-2 text-[12px] text-muted-foreground">
        <span className="min-w-0 flex-1">{done ? `${messages.length} messages. Built from this stock's analysis; every number is from the data.` : `The agents are discussing ${d.symbol}…`}</span>
        {!done ? (
          <button type="button" onClick={() => { const now = Date.now(); setTimes(Object.fromEntries(messages.map((m) => [m.id, now]))); setShown(messages.length); }}
            className="btn-3d inline-flex h-7 items-center gap-1 rounded-lg px-2 text-[12px] font-semibold text-foreground"><FastForward className="size-3.5" />Show all</button>
        ) : (
          <button type="button" onClick={() => { setShown(0); setTimes({}); setRun((n) => n + 1); }}
            className="btn-3d inline-flex h-7 items-center gap-1 rounded-lg px-2 text-[12px] font-semibold text-foreground"><RotateCcw className="size-3.5" />Replay</button>
        )}
      </div>
      <MessageFeed messages={messages.slice(0, shown)} times={times} typing={typing} compact empty="The agents are getting ready…" className="min-h-0 flex-1" />
    </div>
  );
}
