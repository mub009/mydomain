# Indian Stock AI Agents (React)

A React web app where four AI agents analyse Indian (NSE) stocks, talk to each other, and agree on a final list of good stocks.

```
 Lotappi  (short-term, 1-10 days) ──┐
                                    ├──> Mubashir (analyst) ──> Final Decision ──> GOOD STOCKS
 Mayavi   (short-month, ~1 month) ──┘          ▲                    │
                                               └──── questions ─────┘
```

| # | Agent | Job | What it looks at |
|---|-------|-----|------------------|
| 1 | **Lotappi** | Finds **short-term** stocks (1-10 days) | EMA 9/21, RSI momentum zone, 20-day breakout, volume spike, MACD histogram, 5-day return |
| 2 | **Mayavi** | Finds **short-month** stocks (~1 month) | Price vs SMA 20/50/200, 1-month return, strength vs Nifty 50, MACD, RSI, 52-week high |
| 3 | **Mubashir** | **Analyses** Lotappi's and Mayavi's reports | Combines scores, finds agreement/conflict, rates risk, picks the horizon, sets entry / stop-loss / target (2:1 reward-to-risk) |
| 4 | **Final Decision** | **Decides** | Asks Mubashir about conflicts, then gives STRONG BUY / BUY / WATCH / AVOID and the final picks (plus share quantity if you enter capital) |

The app shows each agent working live, the full conversation between them, the final picks, and a sortable table of all stocks. Results can be downloaded as JSON.

## Run

```bash
cd stock-agent-react
npm install
npm run dev          # open http://localhost:5173
```

Prices come from Yahoo Finance through the Vite dev-server proxy (`/yahoo`), so the browser has no CORS problems. If prices can't be loaded, the app falls back to demo data and says so. Tick **Demo data** to try it offline. Demo prices are synthetic, not real market data.

## AI commentary with Claude (optional)

```bash
cp .env.example .env
# put your key in .env:  ANTHROPIC_API_KEY=sk-ant-...
npm run dev
```

Each agent then also explains its findings in plain language. The key stays in the Vite proxy (`/claude`) and is never sent to the browser. Scores and picks always come from the fixed rules, so results are the same with or without AI.

## Deploying

`npm run build` creates a static site in `dist/`, but the `/yahoo` and `/claude` proxies only exist in `npm run dev` / `npm run preview`. To host it publicly you need the same two proxy routes on your server (for example in nginx or your existing backend).

## Tests

```bash
npm test
```

## Code layout

```
src/lib/indicators.ts        RSI, EMA/SMA, MACD, ATR, returns
src/lib/data.ts              Yahoo Finance + demo data, Nifty 50 list
src/lib/bus.ts               message bus the agents talk through
src/lib/agents/*.ts          Lotappi, Mayavi, Mubashir, FinalDecision
src/lib/pipeline.ts          runs the four agents in order
src/components/*.tsx         UI: agent flow, picks, table, conversation
```

## Disclaimer

Educational research tool only, not investment advice. The rules are simple technical signals and have not been backtested. Do your own research or consult a SEBI-registered investment adviser before trading.
