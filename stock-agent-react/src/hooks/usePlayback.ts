import { useCallback, useEffect, useRef, useState } from "react";
import type { AgentName, Message } from "../lib/types";

/**
 * Plays messages back one at a time like a live chat: the sender "types"
 * for a moment (longer messages take longer), then the message appears.
 * Messages that arrive while playing are queued.
 */
const istTime = () =>
  new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });

export function usePlayback(messages: Message[], speed: number) {
  const [shown, setShown] = useState(0);
  const [typing, setTyping] = useState<AgentName | null>(null);
  const [times, setTimes] = useState<Record<number, string>>({});
  const skipRef = useRef(false);
  const lenRef = useRef(0);
  lenRef.current = messages.length;

  // A new run starts with an empty list: reset.
  useEffect(() => {
    if (messages.length === 0) { setShown(0); setTyping(null); setTimes({}); skipRef.current = false; }
  }, [messages.length]);

  useEffect(() => {
    if (shown >= messages.length) { setTyping(null); return; }
    const next = messages[shown];
    const instant = skipRef.current || next.kind === "system";
    const delay = instant ? 0 : Math.min(3200, 700 + next.text.length * 14 + (next.rows?.length ?? 0) * 150) / speed;
    setTyping(instant ? null : next.sender);
    const t = setTimeout(() => {
      setTimes((x) => ({ ...x, [next.id]: istTime() }));
      setShown((s) => s + 1);
    }, delay);
    return () => clearTimeout(t);
  }, [shown, messages, speed]);

  /** Show everything now (and any later messages instantly). */
  const skip = useCallback(() => {
    skipRef.current = true;
    const now = istTime();
    setTimes((x) => { const y = { ...x }; messages.forEach((m) => { y[m.id] ??= now; }); return y; });
    setShown(lenRef.current);
    setTyping(null);
  }, [messages]);

  return { shown, typing, times, skip, done: shown >= messages.length && messages.length > 0 };
}
