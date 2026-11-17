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
| **Mubashir** | Research Analyst | Combines both reports, finds agreement and conflict, rates risk, sets entry / stop-loss / target. Checks the charts of the top candidates on **1M, 1D, 4H, 1H and 30m** and finds each one's **best buy area** from 1-month, 3-month, 6-month and 1-year history |
| **Final Decision** | Portfolio Head | Challenges conflicts, applies the sector cap and capital limits, gives STRONG BUY / BUY / WATCH / AVOID, announces the picks |

Rules worth knowing:

- Target = Entry + 2 × (Entry − Stop-loss)
- Quantity = floor((Capital × Risk %) / (Entry − Stop-loss)), capped so the total never exceeds your capital
- No more than 2 picks from one sector
- Final picks stay hidden until Final Decision announces them in the chat

## Mubashir's earnings and size check

**Stock lists:** Large (Nifty 50), Mid cap (30 stocks), Small cap (30 stocks), All caps, or My List. The mid and small lists are starter presets of well-known NSE stocks, not an official index; edit them in `src/lib/market/universe.ts`.

**Size:** market cap = shares outstanding × last price. Stocks below **₹300 Cr** are left out (`MIN_MARKET_CAP_CR`). The rest are labelled by approximate rupee bands: Large ≥ ₹1,00,000 Cr, Mid ≥ ₹30,000 Cr, otherwise Small. India's official classification is by rank (top 100 large, next 150 mid), so adjust `LARGE_CAP_MIN_CR` and `MID_CAP_MIN_CR` to match the latest AMFI list. Small caps are treated as at least medium risk.

**EPS over one year:** EPS for the last 12 months (sum of the last 4 quarters) against the 12 months before; if fewer than 8 quarters are available, the latest fiscal year against the one before. Score: +5 for growth of 20% or more, +3 for 10-20%, +1 for 0-10%, -4 if EPS fell, -6 if loss-making. Final Decision never gives STRONG BUY with falling EPS, and never BUY while loss-making.

With demo data off, market cap and EPS come from Yahoo Finance's fundamentals data (unofficial, untested from the build environment). If a stock's data can't be loaded it's marked "Unknown" and kept, with a note that its size wasn't verified.

## Mubashir's chart check

For the top candidates (at least 12), Mubashir reads five timeframes:

| Timeframe | Built from | Bullish when |
|-----------|-----------|--------------|
| 1M | daily bars grouped by month | price above a rising 6-month average |
| 1D | daily bars | price above EMA20, EMA20 above EMA50 |
| 4H | hourly bars, two per day (09:15-13:15, 13:15-15:30) | same EMA rule |
| 1H | Yahoo 60-minute bars (~6 months) | same EMA rule |
| 30m | Yahoo 30-minute bars (~60 days) | same EMA rule |

Each bullish timeframe adds 1.5 points to the combined score and each bearish one takes 1.5 away.

**Best buy area:** for the 1M, 3M, 6M and 1Y windows he finds the highest swing low below today's price and the price where the most volume traded. Levels within one ATR of each other are grouped; the group confirmed by the most windows is the buy zone. The plan is **In buy zone** (price within 1% of it), **Wait for dip** (up to 6% above) or **Extended** (more than 6% above). Final Decision's announcement says how to enter each pick.

If intraday data can't be loaded, 4H, 1H and 30m are marked as not rated. In demo mode the intraday candles are generated to match the demo daily prices.

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

To add real model commentary under each report, set an API key in `.env.local` (see `.env.example`) and switch on **AI notes**. Keys stay on the server.

- **NVIDIA (free developer key):** sign in at [build.nvidia.com](https://build.nvidia.com), create an API key, and set `NVIDIA_API_KEY`. The default model is `meta/llama-3.3-70b-instruct`; change it with `NVIDIA_MODEL` to any chat model in NVIDIA's catalog. Free access is rate-limited.
- **Claude:** set `ANTHROPIC_API_KEY` (and optionally `STOCK_AGENT_MODEL`).

If both are set, `AI_PROVIDER` picks one. NVIDIA provides AI models only, not stock prices or news.

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
