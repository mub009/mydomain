# NSE Agent Desk

An AI stock research desk for the Indian market (NSE / Nifty 50). Four AI agents scan stocks, talk to each other one-to-one in real time, debate, and announce a final list of picks.

> Research tool only, not investment advice. Entry, stop-loss and target are research scenarios, not guaranteed prices. The scoring rules are simple technical signals and have not been backtested.

## The team

| Agent | Role | What they do |
|-------|------|--------------|
| **Morning Session** | News Scout | Collects stock news, sorts it into positive and negative, sends the positive stocks to Lotappi and Mayavi (+6 on their scores) and flags the negative ones |
| **IV Index Agent** | Volatility Analyst | Tracks India VIX: level, 1-day and 5-day change, regime; lists the likely reasons for the move and the stocks expected to move next (high-beta "at risk" or "likely up", low-beta "holds up") |
| **Lotappi** | Short-term Trader (1-10 days) | EMA 9/21, RSI 14, MACD, 20-day breakout, relative volume, 5-day return |
| **Mayavi** | Positional Trader (~1 month) | SMA 20/50/200, 1-month return, strength vs Nifty 50, distance from 52-week high |
| **Mubashir** | Research Analyst | Combines both reports, finds agreement and conflict, rates risk, sets entry / stop-loss / target |
| **Final Decision** | Portfolio Head | Challenges conflicts, applies the sector cap and capital limits, gives STRONG BUY / BUY / WATCH / AVOID, announces the picks |

Rules worth knowing:

- Target = Entry + 2 × (Entry − Stop-loss)
- Quantity = floor((Capital × Risk %) / (Entry − Stop-loss)), capped so the total never exceeds your capital
- No more than 2 picks from one sector
- Final picks stay hidden until Final Decision announces them in the chat

## The 9 AM Morning Session

With `MORNING_SESSION_ENABLED=true`, the server runs the whole team by itself at `MORNING_SESSION_TIME` (default 09:00 IST, before the 09:15 open) on NSE trading days. It skips weekends and the holidays in `calendar.ts`, and runs at most once a day. The run is saved to `.data/morning-session.json`; the Overview shows when it last ran and a **Replay 9 AM session** button plays its conversation back.

The schedule lives in the Next.js server process, so it only fires while `npm start` (or `npm run dev`) is running. On a serverless host, call `POST /api/session` from an external cron at 09:00 IST with `Authorization: Bearer <SESSION_TRIGGER_TOKEN>`.

News: demo mode uses fictional sample headlines, clearly labelled. With demo off, `NEWS_PROVIDER=google` reads Google News RSS and matches headlines to company names. Sentiment is a keyword score, good for sorting headlines but not a substitute for reading them. The IV Index agent's reasons are inferences from prices and headlines; results, RBI policy, expiry and global cues can also move VIX.

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
