import { useEffect, useMemo, useState } from "react";
import { Avatar, type Presence } from "./components/ui";
import { usePlayback } from "./hooks/usePlayback";
import { NIFTY50 } from "./lib/data";
import { aiAvailable, aiModel } from "./lib/llm";
import { runAgents } from "./lib/pipeline";
import type { Message, RunResult } from "./lib/types";
import { PEOPLE, TEAM, type Person } from "./team";
import { Overview } from "./views/Overview";
import { Screener } from "./views/Screener";
import { TeamChat } from "./views/TeamChat";

type View = "overview" | "chat" | "screener";

function marketStatus() {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const mins = now.getHours() * 60 + now.getMinutes();
  const weekday = now.getDay() >= 1 && now.getDay() <= 5;
  const open = weekday && mins >= 555 && mins <= 930; // 09:15 - 15:30 IST
  return { open, time: now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) };
}

export default function App() {
  const [view, setView] = useState<View>("overview");
  const [universe, setUniverse] = useState<"nifty" | "custom">("nifty");
  const [custom, setCustom] = useState("RELIANCE, TCS, INFY, HDFCBANK, SBIN, TATAMOTORS, ITC, LT");
  const [top, setTop] = useState(5);
  const [capital, setCapital] = useState("");
  const [risk, setRisk] = useState(1);
  const [demo, setDemo] = useState(false);
  const [useAI, setUseAI] = useState(aiAvailable);
  const [speed, setSpeed] = useState(1);

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<string>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [result, setResult] = useState<RunResult>();
  const [error, setError] = useState<string>();
  const [thread, setThread] = useState("all");
  const [seen, setSeen] = useState<Record<string, number>>({});
  const [market, setMarket] = useState(marketStatus);

  useEffect(() => { const t = setInterval(() => setMarket(marketStatus()), 30000); return () => clearInterval(t); }, []);

  const { shown, typing, times, skip, done } = usePlayback(messages, speed);

  const symbols = universe === "nifty" ? NIFTY50
    : [...new Set(custom.split(/[\s,]+/).map((s) => s.trim().toUpperCase()).filter(Boolean))];

  // The dashboard reveals the picks only once Final Decision has announced them in the chat.
  const decisionIdx = messages.findIndex((m) => m.kind === "decision");
  const decided = Boolean(result) && decisionIdx >= 0 && shown > decisionIdx;

  // Mark the open thread as read.
  useEffect(() => {
    if (view !== "chat") return;
    const count = messages.slice(0, shown).filter((m) => thread === "all" || m.thread === thread).length;
    setSeen((s) => (s[thread] === count ? s : { ...s, [thread]: count }));
  }, [view, thread, shown, messages]);

  const presence = useMemo(() => {
    const p = {} as Record<Person, Presence>;
    for (const who of PEOPLE) p[who] = typing === who ? "typing" : running || (messages.length && !done) ? "online" : "idle";
    return p;
  }, [typing, running, messages.length, done]);

  const lastLine = (who: Person) => {
    if (typing === who) return "typing…";
    const m = [...messages.slice(0, shown)].reverse().find((x) => x.sender === who);
    return m ? m.text : TEAM[who].focus;
  };

  async function run() {
    setRunning(true); setMessages([]); setResult(undefined); setError(undefined); setSeen({});
    try {
      const res = await runAgents({
        symbols, top, demo, useAI, riskPerTrade: risk,
        capital: Number(capital) > 0 ? Number(capital) : undefined,
        onMessage: (m) => setMessages((ms) => [...ms, m]),
        onProgress: setProgress,
      });
      setResult(res);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false); setProgress(undefined);
    }
  }

  function download() {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `stock-picks-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const busy = running || (messages.length > 0 && !done);
  const unreadChat = view === "chat" ? 0 : Math.max(0, shown - (seen.all ?? 0));

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="logo">₹</span>
          <div><b>NSE Agent Desk</b><span>AI research team</span></div>
        </div>
        <nav className="nav">
          <button className={view === "overview" ? "on" : ""} onClick={() => setView("overview")}>Overview</button>
          <button className={view === "chat" ? "on" : ""} onClick={() => setView("chat")}>
            Team chat {unreadChat > 0 && <span className="unread">{unreadChat}</span>}
          </button>
          <button className={view === "screener" ? "on" : ""} onClick={() => setView("screener")} disabled={!decided}>Screener</button>
        </nav>
        <div className="side-title">Team</div>
        <ul className="people">
          {PEOPLE.map((p) => (
            <li key={p} className={presence[p]}>
              <Avatar who={p} size={34} presence={presence[p]} />
              <div>
                <b>{TEAM[p].name}</b>
                <span className="person-title">{TEAM[p].title}</span>
                <span className="person-line">{lastLine(p)}</span>
              </div>
            </li>
          ))}
        </ul>
        <div className="side-foot">Research tool only. Not investment advice.</div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <h1>{view === "overview" ? "Overview" : view === "chat" ? "Team chat" : "Screener"}</h1>
            <p className="muted">Lotappi and Mayavi scan, Mubashir analyses, Final Decision picks the stocks.</p>
          </div>
          <div className="top-right">
            <span className={`pill ${market.open ? "pill-open" : ""}`}><i />NSE {market.open ? "open" : "closed"} · {market.time} IST</span>
            {result && <span className={`pill ${result.mode === "demo" ? "pill-demo" : ""}`}>{result.mode === "live" ? "Live prices" : "Demo prices"}</span>}
          </div>
        </header>

        <section className="runbar card">
          <div className="seg" role="group" aria-label="Stocks to scan">
            <button className={universe === "nifty" ? "on" : ""} onClick={() => setUniverse("nifty")}>Nifty 50</button>
            <button className={universe === "custom" ? "on" : ""} onClick={() => setUniverse("custom")}>My list</button>
          </div>
          {universe === "custom" && (
            <input className="grow" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="NSE symbols, comma separated" aria-label="My stock list" />
          )}
          <label className="fld">Top<input type="number" min={1} max={20} value={top} onChange={(e) => setTop(Math.max(1, Number(e.target.value)))} /></label>
          <label className="fld">Capital ₹<input type="number" min={0} placeholder="optional" value={capital} onChange={(e) => setCapital(e.target.value)} /></label>
          <label className="fld">Risk %<input type="number" min={0.1} max={5} step={0.1} value={risk} onChange={(e) => setRisk(Number(e.target.value))} /></label>
          <label className="tgl"><input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} />Demo data</label>
          <label className="tgl" title={aiAvailable ? aiModel : "Add ANTHROPIC_API_KEY to .env to enable"}>
            <input type="checkbox" checked={useAI} disabled={!aiAvailable} onChange={(e) => setUseAI(e.target.checked)} />AI notes
          </label>
          <label className="fld">Chat speed
            <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
              <option value={0.5}>Slow</option><option value={1}>Normal</option><option value={2}>Fast</option><option value={4}>Very fast</option>
            </select>
          </label>
          <div className="run-actions">
            {busy && messages.length > 0 && <button className="btn ghost" onClick={skip}>Skip to end</button>}
            {result && !busy && <button className="btn ghost" onClick={download}>Export JSON</button>}
            <button className="btn primary" onClick={run} disabled={busy || !symbols.length}>
              {running ? progress ?? "Working…" : busy ? "Agents talking…" : `Run agents · ${symbols.length} stocks`}
            </button>
          </div>
        </section>

        {error && <div className="alert alert-err">Error: {error}</div>}
        {result?.mode === "demo" && !demo && (
          <div className="alert">Live prices could not be loaded, so the agents used demo data (not real prices). Run the app with <code>npm run dev</code> so the Yahoo Finance proxy works.</div>
        )}
        {result?.mode === "demo" && demo && <div className="alert">Demo data: synthetic prices, not real market data.</div>}

        {view === "overview" && (
          <Overview result={result} decided={decided} running={running} messages={messages} shown={shown}
            typing={typing} times={times} onOpenChat={() => setView("chat")} />
        )}
        {view === "chat" && (
          <TeamChat messages={messages} shown={shown} typing={typing} times={times} thread={thread} onThread={setThread} seen={seen} />
        )}
        {view === "screener" && result && decided && <section className="card"><Screener rows={result.all} /></section>}
      </main>
    </div>
  );
}
