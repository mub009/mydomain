# NSE Agent Desk

An AI stock research desk for the Indian market (NSE / Nifty 50). Four AI agents scan stocks, talk to each other one-to-one in real time, debate, and announce a final list of picks.

> Research tool only, not investment advice. Entry, stop-loss and target are research scenarios, not guaranteed prices. The scoring rules are simple technical signals and have not been backtested.

## The team

| Agent | Role | What they do |
|-------|------|--------------|
| **News Agent** | Pre-market news & sentiment | Collects stock news, sorts it into positive and negative, sends the positive stocks to Momentum Agent and Trend Agent (+6 on their scores) and flags the negative ones |
| **Volatility Agent** | India VIX analysis | Tracks India VIX: level, 1-day and 5-day change, regime; lists the likely reasons for the move and the stocks expected to move next (high-beta "at risk" or "likely up", low-beta "holds up") |
| **Macro Agent** | Gold · crude · USD/INR | Tracks Gold, Brent crude and USD/INR, finds which stocks depend on them, and tells Research Agent about tailwinds and headwinds before it combines the lists |
| **Momentum Agent** | Short-term trades (1-10 days) | EMA 9/21, RSI 14, MACD, 20-day breakout, relative volume, 5-day return |
| **Trend Agent** | Positional trades (~1 month) | SMA 20/50/200, 1-month return, strength vs Nifty 50, distance from 52-week high |
| **Research Agent** | Combines signals, risk & charts. Leads the research desk (Performance, Valuation and Growth Agents) | Combines both reports, finds agreement and conflict, rates risk, sets entry / stop-loss / target. Checks the charts of the top candidates on **1M, 1D, 4H, 1H and 30m** and finds each one's **best buy area** from 1-month, 3-month, 6-month and 1-year history |
| **Decision Agent** | Final picks & portfolio rules | Challenges conflicts, applies the sector cap and capital limits, gives STRONG BUY / BUY / WATCH / AVOID, announces the picks |

Rules worth knowing:

- Target = Entry + 2 × (Entry − Stop-loss)
- Quantity = floor((Capital × Risk %) / (Entry − Stop-loss)), capped so the total never exceeds your capital
- No more than 2 picks from one sector
- Final picks stay hidden until Decision Agent announces them in the chat

## Research Agent's earnings and size check

**Stock lists:** Large (Nifty 50), Mid cap (30 stocks), Small cap (30 stocks), All caps, or My List. The mid and small lists are starter presets of well-known NSE stocks, not an official index; edit them in `src/lib/market/universe.ts`.

**Size:** market cap = shares outstanding × last price. Stocks below **₹300 Cr** are left out (`MIN_MARKET_CAP_CR`). The rest are labelled by approximate rupee bands: Large ≥ ₹1,00,000 Cr, Mid ≥ ₹30,000 Cr, otherwise Small. India's official classification is by rank (top 100 large, next 150 mid), so adjust `LARGE_CAP_MIN_CR` and `MID_CAP_MIN_CR` to match the latest AMFI list. Small caps are treated as at least medium risk.

**EPS over one year:** EPS for the last 12 months (sum of the last 4 quarters) against the 12 months before; if fewer than 8 quarters are available, the latest fiscal year against the one before. Score: +5 for growth of 20% or more, +3 for 10-20%, +1 for 0-10%, -4 if EPS fell, -6 if loss-making. Decision Agent never gives STRONG BUY with falling EPS, and never BUY while loss-making.

With demo data off, market cap and EPS come from Yahoo Finance's fundamentals data (unofficial). If a stock's data can't be loaded it's marked "Unknown" and kept, with a note that its size wasn't verified.

## Research desk: seven sub-agents

Seven sub-agents report to the Research Agent on the top candidates (at least 12) before it ranks them. Performance, Valuation, Growth, Profitability and Seasonality together move the score by at most ±10; red flags take up to 10 more off; the entry call adds ±2. They talk in the **Research desk** chat thread, and each stock's panel shows their figures.

| Agent | Checks | Points |
|---|---|---|
| **Performance Agent** | Absolute return **YTD** (since the last close of the previous year, compared with the Nifty 50), **annualised 5-year return** (CAGR from weekly prices) and **expected 1-year return** | +1 for 5Y ≥ 15% a year, −1 if negative; +1 if YTD beats the Nifty by 5 points, −1 if it lags by 10; +1 for expected ≥ 15%, −1 if negative |
| **Valuation Agent** | **TTM P/E** against the median P/E of its sector in this run, **P/B** (market cap ÷ equity) and **P/CFO** (market cap ÷ operating cash flow) | +2 for P/E ≤ 0.8× sector, −1 above 1.2×, −2 above 1.5×; −1 if loss-making; −1 if P/CFO is more than 1.5× P/E (profits not backed by cash) or cash flow is negative |
| **Growth Agent** | **3-year CAGR** of revenue, operating cash flow and net profit, from the last four annual reports | Average ≥ 15%: +3, ≥ 10%: +2, ≥ 5%: +1, below 0: −2; loss-making now: −2 |
| **Profitability Agent** | **ROE** (latest year), **net margin** and profit in how many of the last years, **cash conversion** (3-year operating cash flow ÷ net profit) | ROE ≥ 20%: +2, ≥ 15%: +1, below 8%: −1; loss-making now: −2; a loss in an earlier year: −1; cash conversion ≥ 1: +1, below 0.7: −1 |
| **Red Flag Agent** | **ASM** and **GSM** surveillance lists, **promoter pledge**, **unsolicited tips** (exchange alert list, or a pump-like pattern: up 25% in 10 days on 3× volume in a non-large-cap), **default probability** (1-year, naive Merton distance-to-default from market cap, debt, share-price volatility and last year's return) | Each severe flag −4, each caution −1 (at most −10). Severe: GSM, ASM long-term stage II or later, pledge above 50%, named in a tip alert, default probability above 5%. **A severe flag stops a BUY: the Decision Agent caps the stock at WATCH.** |
| **Seasonality Agent** | **Seasonal price trend:** each calendar month's return over up to 10 years (average and share of years it rose), for this month and next. **Seasonal results:** revenue and profit by fiscal quarter (Q1 Apr–Jun) against the average quarter; Yahoo gives only the last ~5 quarters, so this is a light check. **Dividends:** every ex-date with amount, yield, the price move on the ex-date (the price normally drops by about the dividend) and the trading days to get back to the pre-dividend price; the next ex-date is estimated from last year's months | +2 when this month and next rose in 70%+ of years by 2%+ on average, +1 at 60%+, −1 at 45% or less, −2 at 35% or less and negative (needs 5+ years); ±1 when the coming results quarter is usually 5% above/below average; +1 for a dividend yield of 2% or more (at most ±3) |
| **Entry Point Agent** | Fundamentals (valuation + growth + profitability points) and technicals (5-timeframe chart check, RSI, buy zone) | **Buy now** (+2) when the price is in the buy zone, fundamentals are not weak and the chart is not falling; **Buy on dip** (+1) with the zone price; **Wait** (0); **Avoid** (−2) on a severe red flag or weak business with a falling chart |

**Expected return:** with live data, the analysts' mean 12-month price target from Yahoo when it exists. Otherwise an estimate: 3-year EPS growth (capped −10% to +25%) plus up to ±8 for the P/E against its sector. It's a rough guide, not a forecast. Banks and NBFCs skip P/CFO, cash-flow growth, cash conversion and the default model, because cash flow and debt work differently for lenders. In demo mode every figure is a sample.

**Where the red-flag data comes from (live mode):** ASM, GSM and pledge data are read from NSE's website on a best-effort basis; NSE often blocks automated requests. For a reliable check, save the lists to `.data/surveillance.json`:

```json
{ "asOf": "2026-11-14", "asm": { "SYMBOL": "LT Stage II" }, "gsm": { "SYMBOL": "Stage I" },
  "unsolicited": ["SYMBOL"], "pledge": { "SYMBOL": 12.5 } }
```

Anything that couldn't be checked is shown as "not checked", never as clear.

## Search any NSE stock

The search box at the top of every page (press **/** to jump to it) finds any NSE-listed company by name or symbol. Pick one and it opens in the stock window with the agents' full research on live data, even if it isn't in your current run and you haven't run an analysis:

- The stock is analysed together with up to 9 peers from its sector (topped up with Nifty 50 leaders), so the sector check, valuation medians and relative strength have something to compare with. This takes a few seconds; a stock you've already opened reopens instantly.
- It always gets the research desk, the 5-timeframe chart check and the Black Points Analyst, even if it didn't pass a scan (the report says it was checked on request).
- If it can't be analysed, the window says why: market cap below the ₹300 Cr minimum, too little price history (new listings), or a symbol Yahoo Finance doesn't know.
- A stock that is in your current run opens from that run instead.

## My Stocks: search and groups

Choose **My Stocks** in the Universe control to analyse your own group (3 to 150 stocks):

- **Search** by company name or symbol: suggestions are NSE listings from Yahoo Finance's search, with each company's sector and industry. Old names of renamed companies still work (Zomato finds ETERNAL, Tata Motors finds TMPV and TMCV).
- **Sectors:** type a sector (bank, pharma, IT…) to add all of its stocks from the built-in lists at once.
- **Paste a list:** `tcs, infosys, hdfc bank, tata steel` adds the first NSE match for each name and lists any it couldn't find.
- **Saved groups:** "Save as group" names the list; saved groups appear as buttons to load again. My Stocks and the groups are kept in this browser.
- Stocks outside the built-in lists get their sector from the search, so the sector check and sector cap still work for them.

## Stock view: full chart

Click any stock (table row, chip or chart point) to open it in a centred, nearly full-screen window with a close button:

- **Full price chart** (TradingView lightweight-charts) with real Yahoo prices: **daily candles over 1 year by default**. Change the **range** (1D, 5D, 1M, 3M, 6M, YTD, 1Y, 2Y, 5Y, Max) and the **bar size** (1m, 2m, 5m, 15m, 30m, 1H, 1D, 1W, 1M). Yahoo's limits apply: 1-minute bars cover 7 days, 2- to 30-minute bars 60 days, hourly bars 1 year; picking one adjusts the other. Candles, bars or line; volume; 20/50 moving averages; the entry, stop-loss, target and buy zone as lines; OHLC and volume for the bar under the pointer; scroll to zoom, drag to pan. Times are IST.
- **Header:** latest price and today's change, with the analysis entry price.
- **Research, Forecast and Company** tabs beside the chart; **Full chart** hides them.

## Black Points Analyst (downside risks)

Reports to the Research Agent. Every stock that passed the Momentum Agent's scan (swing, 1-10 days) or the Trend Agent's scan (positional, ~1 month) is checked before the Decision Agent can shortlist it:

1. The Research Agent sends the candidates to the Black Points Analyst.
2. The analyst checks business outlook, sector conditions, financial health and near-term events.
3. It sends the Decision Agent a structured report per stock and holding period.
4. The Decision Agent applies it. A **verified material red flag** excludes the stock from the affected shortlist. **Missing, stale, conflicting or news-only evidence** puts it in **Needs Review** and holds it out of that shortlist. No technical score or agent vote can override either. A stock cleared for only one holding period is re-planned for that period.

| Check | What counts |
|---|---|
| Structural decline | Revenue falling two years in a row (company statements); headlines about the product being replaced or demand shrinking |
| Sector pressure | Sector-wide only when industry data (sector index lagging and down 5%+ over 3 months, or median peer revenue down 5%+) **and** at least two companies' disclosures (falling revenue or margins in their results, or pressure headlines) agree |
| Company weakness | Debt repayment stress (debt/equity above 1.5 with interest cover below 2), poor cash flow (material only with interest cover below 3, since group accounts with a lending arm depress cash flow), revenue far below sector peers, customer losses, repeated project delays |
| Governance & events | Auditor resignation, adverse audit opinion, regulatory orders or probes (SEBI orders read directly), exchange surveillance and heavy pledges (from the Red Flag Agent), results and ex-dividend dates inside the holding period (reported, don't change the status) |

Each finding lists the stock's sector and subsector, why it passed the scan, the red flag and whether it hits the company or the whole sector, the evidence with its date, source and link, and the impact on each holding period (Eligible, Excluded or Needs Review).

**Verification:** a finding is *verified* only with a primary source: an exchange filing, a SEBI order, the company's financial statements, the exchange surveillance list or sector index data. Headlines alone are *unverified*; headlines contradicted by the company's figures are *conflicting*; financials older than 18 months are *stale*. Banks, NBFCs and insurers skip the revenue and cash-flow tests.

**Sources (live):** company statements and calendar from Yahoo Finance; the newest SEBI orders (Chairperson/Members, adjudication, settlement) from sebi.gov.in; Google News headlines from the last 180 days. **NSE and BSE block automated access**, so exchange filings are read from `.data/filings.json` if you add them:

```json
[{ "symbol": "ACME", "date": "2026-11-02", "title": "Resignation of Statutory Auditor", "url": "https://www.bseindia.com/..." }]
```

Set `BLACK_POINTS_STRICT=1` to also hold a stock for review when its news check could not run. Excluded and held stocks stay visible in the Screener's **Flagged Stocks** tab with the evidence and the final decision; the stock window shows the same report.

## Research Agent's chart check

For the top candidates (at least 12), Research Agent reads five timeframes:

| Timeframe | Built from | Bullish when |
|-----------|-----------|--------------|
| 1M | daily bars grouped by month | price above a rising 6-month average |
| 1D | daily bars | price above EMA20, EMA20 above EMA50 |
| 4H | hourly bars, two per day (09:15-13:15, 13:15-15:30) | same EMA rule |
| 1H | Yahoo 60-minute bars (~6 months) | same EMA rule |
| 30m | Yahoo 30-minute bars (~60 days) | same EMA rule |

Each bullish timeframe adds 1.5 points to the combined score and each bearish one takes 1.5 away.

**Best buy area:** for the 1M, 3M, 6M and 1Y windows it finds the highest swing low below today's price and the price where the most volume traded. Levels within one ATR of each other are grouped; the group confirmed by the most windows is the buy zone. The plan is **In buy zone** (price within 1% of it), **Wait for dip** (up to 6% above) or **Extended** (more than 6% above). Decision Agent's announcement says how to enter each pick.

If intraday data can't be loaded, 4H, 1H and 30m are marked as not rated. In demo mode the intraday candles are generated to match the demo daily prices.

## Forecast (prediction chart)

Each stock's panel has a **Forecast** tab: the last 60 days of price, then the likely range for the next **10 trading days** or **1 month**.

- **How:** 2,000 possible price paths, built by re-sampling the stock's own daily moves from the past year (so big up and down days are included), scaled to its recent volatility, with half of its past average trend (past trends often fade).
- **Shown:** the middle path, the 50% and 80% ranges, and the entry, stop-loss and target lines.
- **Odds:** how often the price touched the target before the stop-loss, the stop-loss first, or neither in that time.
- **Track record:** for each week of the past year, the same 80% range is built from data available then and checked against the real price later. Near 80% means the ranges have been reliable for that stock; well below means its moves have been bigger than expected.

This shows what has been normal for the stock, not what will happen. News, results and shocks can push the price outside any range.

## Macro Agent: Gold, crude and USD/INR

Before Research Agent combines the lists, the Macro Agent reports how **Gold**, **Brent crude** and **USD/INR** moved (1 day, 5 days, 1 month, trend) and which stocks that helps or hurts.

- **Known links** (`src/lib/macro/exposure.ts`, edit to add stocks): a weaker rupee helps IT and pharma exporters and textile exporters; costlier crude hurts oil marketing companies (BPCL, HPCL), paint makers and tyre makers and helps ONGC; BPCL/HPCL also pay for crude in dollars. Reliance (crude) and Titan (gold) are marked mixed.
- **Measured links:** each stock's daily-return correlation with the factor over ~120 days. It confirms (+1) or questions (−1) a known link; a stock with no known link but a correlation of 0.4+ is listed as a measured link.
- **When a move matters:** 1-month move of at least 2% for gold, 3% for crude, 0.7% for USD/INR.
- **Score effect:** tailwind or headwind of 2 points, +1 for a move twice the threshold, ±1 from the measured check; at most ±4 per stock. Mixed links get a note but no points.

Shown in a Gold · Crude · USD/INR card on the Overview, a Macro exposure section in an affected stock's panel, and the Macro Agent & Research Agent chat thread.

Data: live mode uses Yahoo daily bars for gold futures (GC=F, converted to ₹ per 10 g with USD/INR, without import duty or GST), Brent futures (BZ=F) and USD/INR (INR=X). Demo mode uses sample series, and demo stocks with a known link really move with their factor so the measured check has something to find.

## Sector check

When you open a stock, its panel starts with a **Sector check**, and the Overview has a **Sector Strength** table ranking every sector.

Each sector's line is its NSE sector index where Yahoo has one (Nifty Bank, IT, Pharma, Auto, FMCG, Metal, Energy, Realty, Infrastructure; live data only), otherwise the average of the sector's stocks in the run (needs at least 2). Against the Nifty 50:

| State | Meaning | Effect on the stock's score |
|-------|---------|------------------------------|
| Leading | beating the Nifty over 1 month, lead not shrinking | +3 |
| Weakening | beating the Nifty, but the lead shrank over the last 10 days | −1 |
| Improving | behind the Nifty, but the gap closed over the last 10 days | +1 |
| Lagging | behind the Nifty, gap not closing | −3 |

A change counts only if it's more than 0.1 points, so a steady trend isn't read as a turn. The rank also uses the 3-month return and breadth (% of the sector's stocks above their 50-day average). The panel shows 1- and 3-month returns, the lead over the Nifty, breadth, a 60-day sector vs Nifty chart and the sector's strongest stocks. Research Agent reports the sector states to Decision Agent in the chat.

## Diversification (Portfolio balance)

Research Agent checks how spread out the money is, in two places:

- **Positions page:** your open positions, weighted by current value.
- **Overview, under Final Picks:** the day's picks, weighted by the suggested investment (enter your capital for real weights).

| Check | Limit |
|-------|-------|
| One sector | 30% of the money |
| One stock | 20% |
| Small caps | 30% |
| Sectors | at least 3 when you hold 3+ stocks |
| Stocks that move together | daily moves correlated 0.8+ over 60 days count almost as one holding |

Score out of 100: how many "effective" sectors and stocks the money is spread over, minus a penalty for each limit broken (4 points a little over, 9 at 1.25× the limit, 25 at 1.5× or more). Grade: 80+ A, 60-79 B, 40-59 C, below 40 D. Suggestions: which stock to trim, and up to three BUY or STRONG BUY stocks from the latest analysis in sectors you hold little of. Change the limits with the `NEXT_PUBLIC_MAX_*_PCT` settings.

## Company: peers, balance sheet, cash flow, owners

Open any stock and choose the **Company** tab:

- **Balance sheet & cash-flow quality:** Research Agent grades the company A-D on cash conversion (operating cash flow ÷ net profit over 3 years, counted double), free cash flow (years positive out of 4), debt/equity, current ratio, return on equity and interest cover. A loss-making company can't grade above C. Banks and NBFCs are graded only on ROE and profit growth, because debt and cash flow work differently for lenders.
- **Peers:** the closest companies by market cap in the same sector, from the current run's stock list (use "All caps" for more), with size, P/E, EPS growth, ROE, debt/equity, cash conversion, quality grade and verdict. Click a peer to open it.
- **Profit vs cash flow:** net profit, operating cash flow and free cash flow for 4 years.
- **Balance sheet:** revenue, profit, assets, liabilities, equity, debt, cash, capital spending, debt/equity and current ratio by fiscal year (₹ Cr).
- **Who owns it:** holder groups, largest holders, promoter trend and pledges where available.

Data: with demo data off, statements come from Yahoo Finance's annual fundamentals and holders from Yahoo's holders data (both unofficial). Yahoo groups FIIs and DIIs together as "institutions" and doesn't show the official promoter split or pledges; each stock links to its NSE page for the official quarterly shareholding pattern. In demo mode all figures are samples and holder names are generic placeholders.

## Follow-up on trades you take

Open any stock (from Final Picks, the Screener, or a chip in the chat) and press **Track this trade**. Enter what you actually bought: buy price, quantity, stop-loss and target (pre-filled from the analysis). The exit plan is:

- **Stop-loss:** exit if price falls to it
- **First exit** (buy price + 1× risk): book half and move the stop-loss up to your buy price
- **Target:** exit the rest

The **Positions** page shows each trade's price on a rail from stop to target, profit and loss, and its alerts. The server checks open positions every `POSITION_CHECK_MINUTES` (default 5) during NSE hours and sends follow-up alerts:

| Alert | When | From |
|-------|------|------|
| In loss | 3% or more below the buy price | Momentum Agent |
| Close to stop-loss | within 1% above the stop | Momentum Agent |
| Stop-loss hit, exit now | at or below the stop | Momentum Agent |
| First exit reached | at buy + 1× risk (stop moves to cost) | Trend Agent |
| Near the exit area | within 2% of the target | Trend Agent |
| Target reached, exit | at or above the target | Trend Agent |

Alerts appear in the app (bell, pop-ups, Positions page), as desktop notifications (press **Enable desktop alerts**), and on your phone if you set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`. Each alert fires once per trade; "close to stop-loss" fires again after a recovery.

Notes: live prices come from Yahoo's 5-minute bars, which are delayed, so a stop can be hit before the alert arrives. The checks run only while the server is running. Trades tracked from a demo run follow a simulated price that moves every minute. Positions are saved to `.data/positions.json`; the app has no login, so don't expose it to the internet.

## The 9 AM news session

With `MORNING_SESSION_ENABLED=true`, the server runs the whole team by itself at `MORNING_SESSION_TIME` (default 09:00 IST, before the 09:15 open) on NSE trading days. It skips weekends and the holidays in `calendar.ts`, and runs at most once a day. The run is saved to `.data/morning-session.json`; the Overview shows when it last ran and a **Replay 9 AM session** button plays its conversation back.

The schedule lives in the Next.js server process, so it only fires while `npm start` (or `npm run dev`) is running. On a serverless host, call `POST /api/session` from an external cron at 09:00 IST with `Authorization: Bearer <SESSION_TRIGGER_TOKEN>`.

News: demo mode uses fictional sample headlines, clearly labelled. With demo off, `NEWS_PROVIDER=google` reads Google News RSS and matches headlines to company names. Sentiment is a keyword score, good for sorting headlines but not a substitute for reading them. The Volatility Agent's reasons are inferences from prices and headlines; results, RBI policy, expiry and global cues can also move VIX.

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

- **Live data (default):** prices, financials, holders and analyst targets from Yahoo Finance; headlines from Google News; India VIX, gold, crude and USD/INR from Yahoo. Yahoo is unofficial and delayed, labelled as such in the UI; it is **not** real-time NSE data. Yahoo leaves today's daily close empty, so the latest price is used for today's bar. If live prices can't be loaded, the run stops with an error: it never switches to sample prices on its own.
- **Demo data (switch on to use):** fictional sample prices, clearly labelled, for trying the app offline.
- **Behind an HTTPS proxy** (for example a cloud sandbox), start the server with `NODE_USE_ENV_PROXY=1` so Node's `fetch` uses `HTTPS_PROXY`.
- **ASM/GSM and pledges:** NSE's website blocks automated requests, so save the lists to `.data/surveillance.json` (see the research desk section) for a reliable check.
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
        │   Server-Sent Events:                     │ Momentum + Trend Agents scan
        └── progress · message · result  <──────────┤ Research Agent analyses
                                                    │ Decision Agent decides
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
