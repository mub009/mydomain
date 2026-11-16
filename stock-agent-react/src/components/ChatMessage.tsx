import { Fragment } from "react";
import type { Message } from "../lib/types";
import { displayName, TEAM } from "../team";
import { Avatar, VerdictBadge } from "./ui";

/** Highlight stock symbols the message mentions. */
function withTickers(text: string, tickers: string[]) {
  if (!tickers.length) return text;
  const esc = [...new Set(tickers)].sort((a, b) => b.length - a.length).map((t) => t.replace(/[.*+?^${}()|[\]\\&-]/g, "\\$&"));
  const re = new RegExp(`(?<![A-Z0-9])(${esc.join("|")})(?![A-Z0-9])`, "g");
  return text.split(re).map((part, i) =>
    i % 2 ? <span key={i} className="ticker">{part}</span> : <Fragment key={i}>{part}</Fragment>);
}

export function ChatMessage({ m, time, compact }: { m: Message; time?: string; compact?: boolean }) {
  if (m.kind === "system") return <div className="sys-msg">{m.text}</div>;
  const person = m.sender === "System" ? null : TEAM[m.sender];
  return (
    <div className={`msg ${m.kind === "decision" ? "msg-decision" : ""}`}>
      <Avatar who={m.sender} size={compact ? 28 : 36} />
      <div className="msg-body">
        <div className="msg-head">
          <b>{displayName(m.sender)}</b>
          {!compact && person && <span className="role">{person.title}</span>}
          <span className="to">to {displayName(m.to)}</span>
          {time && <span className="time">{time}</span>}
        </div>
        <div className="msg-text">{withTickers(m.text, m.tickers)}</div>
        {m.rows && m.rows.length > 0 && (
          <table className="mini">
            <tbody>
              {m.rows.map((r) => (
                <tr key={r.symbol}>
                  <td className="sym">{r.symbol}</td>
                  <td className="num">{r.score.toFixed(1)}</td>
                  <td>{["STRONG BUY", "BUY", "WATCH", "AVOID"].includes(r.tag) ? <VerdictBadge v={r.tag} /> : <span className="muted">{r.tag}</span>}</td>
                  {!compact && <td className="muted">{r.note}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {m.aiNote && <div className="ai-note"><span>AI</span>{m.aiNote}</div>}
      </div>
    </div>
  );
}
