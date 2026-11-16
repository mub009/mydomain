import { useEffect, useRef } from "react";
import { ChatMessage } from "../components/ChatMessage";
import { ScoreMap } from "../components/ScoreMap";
import { Sparkline } from "../components/Sparkline";
import { Avatar, inr, TypingDots, VerdictBadge } from "../components/ui";
import type { AgentName, Message, RunResult } from "../lib/types";
import { displayName } from "../team";

interface Props {
  result?: RunResult;
  decided: boolean;
  running: boolean;
  messages: Message[];
  shown: number;
  typing: AgentName | null;
  times: Record<number, string>;
  onOpenChat: () => void;
}

export function Overview({ result, decided, running, messages, shown, typing, times, onOpenChat }: Props) {
  const feedRef = useRef<HTMLDivElement>(null);
  useEffect(() => { feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" }); }, [shown, typing]);

  const r = decided ? result : undefined;
  const buys = r ? r.all.filter((d) => d.verdict === "STRONG BUY" || d.verdict === "BUY").length : null;
  const agree = r ? r.all.filter((d) => d.agree).length : null;
  const idle = !running && !result;

  return (
    <div className="overview">
      <section className="kpis">
        <Kpi label="Stocks scanned" value={r ? String(r.all.length) : "–"} sub={r ? `${r.mode === "live" ? "Live" : "Demo"} prices` : "Run the agents"} />
        <Kpi label="Buy signals" value={buys === null ? "–" : String(buys)} sub={r ? `${r.picks.length} chosen as final picks` : "After the final decision"} />
        <Kpi label="Both agents agree" value={agree === null ? "–" : String(agree)} sub="Lotappi & Mayavi both ≥ 60" />
        <Kpi label="Nifty 50 · 1 month" value={r ? `${r.indexRet21d >= 0 ? "+" : ""}${r.indexRet21d.toFixed(2)}%` : "–"}
          sub="Benchmark for Mayavi" tone={r ? (r.indexRet21d >= 0 ? "pos" : "neg") : undefined} />
      </section>

      <div className="ov-grid">
        <div className="ov-main">
          <section className="card">
            <header className="card-head">
              <div>
                <h2>Final picks</h2>
                <p className="muted">{r ? (r.watchlist.length ? `Watchlist: ${r.watchlist.map((w) => w.symbol).join(", ")}` : "No watchlist today") : "Announced by Final Decision"}</p>
              </div>
            </header>
            {r ? (
              r.picks.length ? (
                <div className="table-wrap">
                  <table className="data">
                    <thead>
                      <tr><th>Stock</th><th>Verdict</th><th>60-day trend</th><th className="num">Entry</th><th className="num">Stop-loss</th>
                        <th className="num">Target</th><th className="num">Upside</th>
                        {r.picks[0].quantity !== undefined && <th className="num">Qty</th>}</tr>
                    </thead>
                    <tbody>
                      {r.picks.map((d) => (
                        <tr key={d.symbol}>
                          <td><b>{d.symbol}</b><div className="sub">{d.horizon} · risk {d.risk.toLowerCase()}</div></td>
                          <td><VerdictBadge v={d.verdict} /></td>
                          <td><Sparkline data={d.spark} width={84} /></td>
                          <td className="num">{inr(d.entry)}</td>
                          <td className="num neg">{inr(d.stopLoss)}</td>
                          <td className="num pos">{inr(d.target)}</td>
                          <td className="num">+{((d.target / d.entry - 1) * 100).toFixed(1)}%</td>
                          {d.quantity !== undefined && <td className="num">{d.quantity}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <div className="empty">No stock passed the buy rules today. Staying in cash is a valid decision.</div>
            ) : (
              <div className="empty">
                {idle ? "Press Run agents to start the team." : <>Waiting for Final Decision <TypingDots /></>}
              </div>
            )}
          </section>

          <section className="card">
            <header className="card-head">
              <div>
                <h2>Where the agents agree</h2>
                <p className="muted">Each dot is a stock: Lotappi's short-term score against Mayavi's 1-month score.</p>
              </div>
            </header>
            {r ? <ScoreMap rows={r.all} picks={new Set(r.picks.map((p) => p.symbol))} watch={new Set(r.watchlist.map((w) => w.symbol))} />
              : <div className="empty">Appears after the final decision.</div>}
          </section>
        </div>

        <section className="card feed-card">
          <header className="card-head">
            <div>
              <h2>Live team chat</h2>
              <p className="muted">{running || typing ? "Agents are talking now" : messages.length ? "Conversation finished" : "No conversation yet"}</p>
            </div>
            <button className="btn ghost sm" onClick={onOpenChat}>Open chat</button>
          </header>
          <div className="feed" ref={feedRef}>
            {messages.slice(0, shown).map((m) => <ChatMessage key={m.id} m={m} time={times[m.id]} compact />)}
            {typing && (
              <div className="typing-row"><Avatar who={typing} size={24} /> {displayName(typing)} is typing <TypingDots /></div>
            )}
            {!messages.length && <div className="empty">The team's messages will appear here in real time.</div>}
          </div>
        </section>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: "pos" | "neg" }) {
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value ${tone ?? ""}`}>{value}</div>
      <div className="kpi-sub">{sub}</div>
    </div>
  );
}
