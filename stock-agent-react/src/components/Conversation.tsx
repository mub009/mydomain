import { displayName } from "../agentsInfo";
import type { Message } from "../lib/types";

export function Conversation({ messages }: { messages: Message[] }) {
  if (!messages.length) return <p className="muted">The agents' conversation will appear here when you run them.</p>;
  return (
    <ol className="chat">
      {messages.map((m) => (
        <li key={m.id} className={`bubble agent-${m.sender}`}>
          <div className="bubble-head">
            <b>{displayName(m.sender)}</b> → {m.to === "ALL" ? "Everyone" : displayName(m.to)}
            <span className="subject">{m.subject}</span>
            <span className="time">{m.time}</span>
          </div>
          <pre>{m.text}</pre>
          {m.aiNote && <div className="ai-note"><span>AI note</span>{m.aiNote}</div>}
        </li>
      ))}
    </ol>
  );
}
