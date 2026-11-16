# NSE Agent Desk

An AI stock research desk for the Indian market (NSE / Nifty 50). Four AI agents scan stocks, talk to each other one-to-one in real time, debate, and announce a final list of picks.

> Research tool only, not investment advice. Entry, stop-loss and target are research scenarios, not guaranteed prices. The scoring rules are simple technical signals and have not been backtested.

## The team

| Agent | Role | What they do |
|-------|------|--------------|
| **Lotappi** | Short-term Trader (1-10 days) | EMA 9/21, RSI 14, MACD, 20-day breakout, relative volume, 5-day return |
| **Mayavi** | Positional Trader (~1 month) | SMA 20/50/200, 1-month return, strength vs Nifty 50, distance from 52-week high |
| **Mubashir** | Research Analyst | Combines both reports, finds agreement and conflict, rates risk, sets entry / stop-loss / target |
| **Final Decision** | Portfolio Head | Challenges conflicts, applies the sector cap and capital limits, gives STRONG BUY / BUY / WATCH / AVOID, announces the picks |

Rules worth knowing:

- Target = Entry + 2 × (Entry − Stop-loss)
- Quantity = floor((Capital × Risk %) / (Entry − Stop-loss)), capped so the total never exceeds your capital
- No more than 2 picks from one sector
- Final picks stay hidden until Final Decision announces them in the chat

## Run it

```bash
cd nse-agent-desk
npm install
npm run dev        # http://localhost:3000
```

`npm test` runs the engine tests. `npm run build && npm start` runs the production build.

## Screens

- **Overview** (`/`) - controls, KPI cards, final picks, the "Where the Agents Agree" chart, live team chat
- **Team Chat** (`/chat`) - Slack-style read-only feed with one-to-one conversations, typing indicators and unread counts
- **Screener** (`/screener`) - search, sector / risk / RSI / score / verdict filters, sortable columns; select a row for the research drawer
- **Component Showcase** (`/components`) - the 14 reusable components

Light and dark themes, and a mobile layout with a bottom navigation bar.

## Data: demo, end-of-day, and what is *not* claimed

- **Demo data (default):** fictional sample prices for all 50 Nifty stocks, clearly labelled. Every run uses a new random market, so each run reaches its own conclusion.
- **Demo data off:** the server uses the market-data provider chosen by `MARKET_DATA_PROVIDER`. The bundled `yahoo` provider is unofficial end-of-day data, labelled as such in the UI. It is **not** real-time NSE data. If it cannot be reached, the app falls back to demo data and says so.
- **Real-time NSE prices need a licensed source.** Implement `MarketDataProvider` (`src/lib/market/provider.ts`) for your data vendor or broker API and register it in `src/lib/market/index.ts`.

## Agents: simulated vs real model calls

The scores, verdicts and picks come from fixed, tested rules. The chat messages are generated from each run's analysis results, so the conversation is **simulated** and labelled that way.

Set `ANTHROPIC_API_KEY` (see `.env.example`) and switch on **AI notes** to add real model commentary under each report. The key stays on the server.

## How it fits together

```
Browser (Zustand store) ── POST /api/analysis ──> pipeline (server)
        ▲                                           │ load prices (provider)
        │   Server-Sent Events:                     │ Lotappi + Mayavi scan
        └── progress · message · result  <──────────┤ Mubashir analyses
                                                    │ Final Decision decides
            store plays messages back one by one    └ dialogue -> message bus
```

```
src/lib/agents/        scoring rules for the four agents
src/lib/dialogue.ts    the conversation, built from the analysis
src/lib/pipeline.ts    orchestration (server)
src/lib/market/        provider interface, demo + Yahoo providers, NSE calendar, Nifty 50 universe
src/app/api/           SSE analysis endpoint (validated input, server logging), config endpoint
src/store/desk.ts      app state, SSE client, chat playback (speed, skip)
src/components/desk/   the reusable desk components
src/components/ui/     shadcn-style primitives (button, switch, sheet, segmented control)
```

## Before relying on it

- **NSE holidays:** `src/lib/market/calendar.ts` holds the 2026 holiday list. Check it against the NSE circular and add each new year; unknown years fall back to weekends only. Special sessions such as Muhurat trading are not modelled.
- **Sector labels** in `universe.ts` are broad groupings for the sector cap, and index membership changes over time.
