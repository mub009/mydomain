import { useState } from "react";
import { AgentFlow, type Stage } from "./components/AgentFlow";
import { AllStocks } from "./components/AllStocks";
import { Conversation } from "./components/Conversation";
import { Picks } from "./components/Picks";
import { NIFTY50 } from "./lib/data";
import { aiAvailable, aiModel } from "./lib/llm";
import { runAgents } from "./lib/pipeline";
import type { Message, RunResult } from "./lib/types";

type Tab = "picks" | "all" | "chat";

export default function App() {
  const [universe, setUniverse] = useState<"nifty" | "custom">("nifty");
  const [custom, setCustom] = useState("RELIANCE, TCS, INFY, HDFCBANK, SBIN, TATAMOTORS, ITC, LT");
  const [top, setTop] = useState(5);
  const [capital, setCapital] = useState("");
  const [risk, setRisk] = useState(1);
  const [demo, setDemo] = useState(false);
  const [useAI, setUseAI] = useState(aiAvailable);

  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState<Stage>("Idle");
  const [detail, setDetail] = useState<string>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [result, setResult] = useState<RunResult>();
  const [error, setError] = useState<string>();
  const [tab, setTab] = useState<Tab>("chat");

  const symbols = universe === "nifty" ? NIFTY50
    : [...new Set(custom.split(/[\s,]+/).map((s) => s.trim().toUpperCase()).filter(Boolean))];

  async function run() {
    setRunning(true); setMessages([]); setResult(undefined); setError(undefined); setTab("chat");
    try {
      const res = await runAgents({
        symbols, top, demo, useAI, riskPerTrade: risk,
        capital: Number(capital) > 0 ? Number(capital) : undefined,
        onMessage: (m) => setMessages((ms) => [...ms, m]),
        onStage: (s, d) => { setStage(s); setDetail(d); },
      });
      setResult(res); setTab("picks");
    } catch (e) {
      setError((e as Error).message); setStage("Idle");
    } finally {
      setRunning(false);
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

  return (
    <div className="app">
      <header className="top">
        <div>
          <h1>Indian Stock AI Agents</h1>
          <p className="muted">Four agents analyse NSE stocks, talk to each other and pick the good ones.</p>
        </div>
      </header>

      <section className="panel settings">
        <div className="field">
          <label>Stocks</label>
          <div className="seg">
            <button className={universe === "nifty" ? "on" : ""} onClick={() => setUniverse("nifty")}>Nifty 50</button>
            <button className={universe === "custom" ? "on" : ""} onClick={() => setUniverse("custom")}>My list</button>
          </div>
          {universe === "custom" && (
            <textarea value={custom} onChange={(e) => setCustom(e.target.value)} rows={2}
              placeholder="NSE symbols, comma separated" />
          )}
        </div>
        <div className="field small">
          <label htmlFor="top">Top picks</label>
          <input id="top" type="number" min={1} max={20} value={top} onChange={(e) => setTop(Math.max(1, Number(e.target.value)))} />
        </div>
        <div className="field small">
          <label htmlFor="cap">Capital (₹, optional)</label>
          <input id="cap" type="number" min={0} placeholder="e.g. 200000" value={capital} onChange={(e) => setCapital(e.target.value)} />
        </div>
        <div className="field small">
          <label htmlFor="risk">Risk per trade (%)</label>
          <input id="risk" type="number" min={0.1} max={5} step={0.1} value={risk} onChange={(e) => setRisk(Number(e.target.value))} />
        </div>
        <div className="field toggles">
          <label className="check"><input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} /> Demo data (offline, not real prices)</label>
          <label className="check" title={aiAvailable ? "" : "Add ANTHROPIC_API_KEY to .env to enable"}>
            <input type="checkbox" checked={useAI} disabled={!aiAvailable} onChange={(e) => setUseAI(e.target.checked)} />
            AI commentary {aiAvailable ? `(${aiModel})` : "(no API key)"}
          </label>
        </div>
        <button className="run" onClick={run} disabled={running || !symbols.length}>
          {running ? "Agents working…" : `Run agents on ${symbols.length} stocks`}
        </button>
      </section>

      <AgentFlow stage={stage} detail={detail} />

      {error && <div className="error">Error: {error}</div>}
      {result?.mode === "demo" && (
        <div className="warn">{demo ? "Demo data: synthetic prices, not real market data." :
          "Live data could not be loaded, so the agents used DEMO data (not real prices). Run with `npm run dev` so the Yahoo proxy works."}</div>
      )}
      {result && result.skipped.length > 0 && <div className="warn">Skipped: {result.skipped.join(", ")}</div>}

      <nav className="tabs">
        <button className={tab === "picks" ? "on" : ""} onClick={() => setTab("picks")} disabled={!result}>
          Final picks{result ? ` (${result.picks.length})` : ""}
        </button>
        <button className={tab === "all" ? "on" : ""} onClick={() => setTab("all")} disabled={!result}>All stocks</button>
        <button className={tab === "chat" ? "on" : ""} onClick={() => setTab("chat")}>
          Agent conversation{messages.length ? ` (${messages.length})` : ""}
        </button>
        {result && <button className="dl" onClick={download}>Download JSON</button>}
      </nav>

      <section className="panel">
        {tab === "picks" && result && (
          <>
            <p className="muted">
              {result.mode.toUpperCase()} data · Nifty 1 month {result.indexRet21d >= 0 ? "+" : ""}{result.indexRet21d}%
              {result.watchlist.length > 0 && <> · Watchlist: {result.watchlist.map((w) => w.symbol).join(", ")}</>}
            </p>
            <Picks picks={result.picks} />
          </>
        )}
        {tab === "all" && result && <AllStocks rows={result.all} />}
        {tab === "chat" && <Conversation messages={messages} />}
      </section>

      <footer className="disc">
        Educational research tool only, not investment advice. The rules are simple technical signals and have not been
        backtested. Do your own research or consult a SEBI-registered adviser before trading.
      </footer>
    </div>
  );
}
