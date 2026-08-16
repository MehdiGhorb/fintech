# Northline Finance

Private research desk. You name a stock, ETF or token and a horizon; a swarm of specialist
agents scrapes public sources, a quantitative engine computes the numbers, and a portfolio
manager writes a call. Nothing here is a product for other people. It is a local tool.

## What it does

1. Asks for an OpenAI, Anthropic or OpenRouter key (stored locally, encrypted on disk).
2. Builds a research file: prices, financials, SEC filings, news, macro, token data.
3. Runs a deterministic engine (GARCH volatility, bootstrap Monte Carlo, trend tests, DCF
   helpers). The language model does not do the arithmetic.
4. Runs specialist analysts in parallel, then a bull/bear debate, a red team, a PM, a risk
   manager and a fact-checker.
5. Streams the work into a simple console and keeps the file in local SQLite.

Sources are public pages and filings, not paid market-data APIs: stockanalysis.com,
SEC EDGAR, Google News, Brave search, CBOE VIX, US Treasury, CoinGecko.

## Run it

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Paste a key. Ask something like:

> Analyse NVDA for the next month. I want to make money with a directional view and a clear invalidation.

Depth: **Quick** / **Standard** / **Deep** / **Exhaustive**. Deeper means more reading, more
debate, more tokens.

Data and keys live in `.northline/` (gitignored).

## Layout

```
lib/sources/     scrape and parse
lib/quant/       deterministic math
lib/agents/      tools, runtime, orchestrator
skills/          methodology for each specialist
app/api/         keys, analyse, SSE events, follow-up
```

This is research, not execution, and not advice. You will be wrong sometimes. Size accordingly.
