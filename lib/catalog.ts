import type { AIModel, AgentConfig, AgentType, Instrument } from "./types";

export const EXCHANGES: Instrument[] = [
  { id: "nyse", kind: "exchange", symbol: "NYSE", name: "New York Stock Exchange", venue: "NYSE", region: "United States" },
  { id: "nasdaq", kind: "exchange", symbol: "NASDAQ", name: "Nasdaq", venue: "NASDAQ", region: "United States" },
  { id: "lse", kind: "exchange", symbol: "LSE", name: "London Stock Exchange", venue: "LSE", region: "United Kingdom" },
  { id: "tse", kind: "exchange", symbol: "TSE", name: "Tokyo Stock Exchange", venue: "TSE", region: "Japan" },
  { id: "hkex", kind: "exchange", symbol: "HKEX", name: "Hong Kong Stock Exchange", venue: "HKEX", region: "Hong Kong" },
  { id: "euronext", kind: "exchange", symbol: "ENX", name: "Euronext", venue: "Euronext", region: "Europe" },
  { id: "sse", kind: "exchange", symbol: "SSE", name: "Shanghai Stock Exchange", venue: "SSE", region: "China" },
  { id: "asx", kind: "exchange", symbol: "ASX", name: "Australian Securities Exchange", venue: "ASX", region: "Australia" },
  { id: "tsx", kind: "exchange", symbol: "TSX", name: "Toronto Stock Exchange", venue: "TSX", region: "Canada" },
  { id: "nse", kind: "exchange", symbol: "NSE", name: "National Stock Exchange of India", venue: "NSE", region: "India" },
];

export const STOCKS: Instrument[] = [
  { id: "aapl", kind: "stock", symbol: "AAPL", name: "Apple", venue: "NASDAQ", region: "United States" },
  { id: "msft", kind: "stock", symbol: "MSFT", name: "Microsoft", venue: "NASDAQ", region: "United States" },
  { id: "googl", kind: "stock", symbol: "GOOGL", name: "Alphabet", venue: "NASDAQ", region: "United States" },
  { id: "amzn", kind: "stock", symbol: "AMZN", name: "Amazon", venue: "NASDAQ", region: "United States" },
  { id: "nvda", kind: "stock", symbol: "NVDA", name: "NVIDIA", venue: "NASDAQ", region: "United States" },
  { id: "meta", kind: "stock", symbol: "META", name: "Meta Platforms", venue: "NASDAQ", region: "United States" },
  { id: "tsla", kind: "stock", symbol: "TSLA", name: "Tesla", venue: "NASDAQ", region: "United States" },
  { id: "brkb", kind: "stock", symbol: "BRK.B", name: "Berkshire Hathaway", venue: "NYSE", region: "United States" },
  { id: "jpm", kind: "stock", symbol: "JPM", name: "JPMorgan Chase", venue: "NYSE", region: "United States" },
  { id: "v", kind: "stock", symbol: "V", name: "Visa", venue: "NYSE", region: "United States" },
  { id: "unh", kind: "stock", symbol: "UNH", name: "UnitedHealth", venue: "NYSE", region: "United States" },
  { id: "xom", kind: "stock", symbol: "XOM", name: "Exxon Mobil", venue: "NYSE", region: "United States" },
  { id: "jnj", kind: "stock", symbol: "JNJ", name: "Johnson & Johnson", venue: "NYSE", region: "United States" },
  { id: "wmt", kind: "stock", symbol: "WMT", name: "Walmart", venue: "NYSE", region: "United States" },
  { id: "pg", kind: "stock", symbol: "PG", name: "Procter & Gamble", venue: "NYSE", region: "United States" },
  { id: "ma", kind: "stock", symbol: "MA", name: "Mastercard", venue: "NYSE", region: "United States" },
  { id: "hd", kind: "stock", symbol: "HD", name: "Home Depot", venue: "NYSE", region: "United States" },
  { id: "lly", kind: "stock", symbol: "LLY", name: "Eli Lilly", venue: "NYSE", region: "United States" },
  { id: "avgo", kind: "stock", symbol: "AVGO", name: "Broadcom", venue: "NASDAQ", region: "United States" },
  { id: "cost", kind: "stock", symbol: "COST", name: "Costco", venue: "NASDAQ", region: "United States" },
];

export const ETFS: Instrument[] = [
  { id: "spy", kind: "etf", symbol: "SPY", name: "SPDR S&P 500 ETF", venue: "NYSE Arca", region: "United States" },
  { id: "qqq", kind: "etf", symbol: "QQQ", name: "Invesco QQQ Trust", venue: "NASDAQ", region: "United States" },
  { id: "vti", kind: "etf", symbol: "VTI", name: "Vanguard Total Stock Market", venue: "NYSE Arca", region: "United States" },
  { id: "iwm", kind: "etf", symbol: "IWM", name: "iShares Russell 2000", venue: "NYSE Arca", region: "United States" },
  { id: "dia", kind: "etf", symbol: "DIA", name: "SPDR Dow Jones Industrial Average", venue: "NYSE Arca", region: "United States" },
  { id: "eem", kind: "etf", symbol: "EEM", name: "iShares MSCI Emerging Markets", venue: "NYSE Arca", region: "United States" },
  { id: "efa", kind: "etf", symbol: "EFA", name: "iShares MSCI EAFE", venue: "NYSE Arca", region: "United States" },
  { id: "gld", kind: "etf", symbol: "GLD", name: "SPDR Gold Shares", venue: "NYSE Arca", region: "United States" },
  { id: "tlt", kind: "etf", symbol: "TLT", name: "iShares 20+ Year Treasury Bond", venue: "NASDAQ", region: "United States" },
  { id: "vnq", kind: "etf", symbol: "VNQ", name: "Vanguard Real Estate", venue: "NYSE Arca", region: "United States" },
  { id: "xlf", kind: "etf", symbol: "XLF", name: "Financial Select Sector SPDR", venue: "NYSE Arca", region: "United States" },
  { id: "xlk", kind: "etf", symbol: "XLK", name: "Technology Select Sector SPDR", venue: "NYSE Arca", region: "United States" },
  { id: "xle", kind: "etf", symbol: "XLE", name: "Energy Select Sector SPDR", venue: "NYSE Arca", region: "United States" },
  { id: "xlv", kind: "etf", symbol: "XLV", name: "Health Care Select Sector SPDR", venue: "NYSE Arca", region: "United States" },
  { id: "arkk", kind: "etf", symbol: "ARKK", name: "ARK Innovation ETF", venue: "NYSE Arca", region: "United States" },
  { id: "vwo", kind: "etf", symbol: "VWO", name: "Vanguard FTSE Emerging Markets", venue: "NYSE Arca", region: "United States" },
  { id: "bnd", kind: "etf", symbol: "BND", name: "Vanguard Total Bond Market", venue: "NASDAQ", region: "United States" },
  { id: "hyg", kind: "etf", symbol: "HYG", name: "iShares iBoxx High Yield Corporate Bond", venue: "NYSE Arca", region: "United States" },
  { id: "slv", kind: "etf", symbol: "SLV", name: "iShares Silver Trust", venue: "NYSE Arca", region: "United States" },
  { id: "soxx", kind: "etf", symbol: "SOXX", name: "iShares Semiconductor ETF", venue: "NASDAQ", region: "United States" },
];

export const MODELS: { id: AIModel; label: string; vendor: string }[] = [
  { id: "gpt-4o", label: "GPT-4o", vendor: "OpenAI" },
  { id: "gpt-4o-mini", label: "GPT-4o mini", vendor: "OpenAI" },
  { id: "o3", label: "o3", vendor: "OpenAI" },
  { id: "claude-4-sonnet", label: "Claude 4 Sonnet", vendor: "Anthropic" },
  { id: "claude-4-opus", label: "Claude 4 Opus", vendor: "Anthropic" },
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", vendor: "Google" },
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", vendor: "Google" },
];

export const AGENT_META: Record<
  AgentType,
  { label: string; short: string; description: string; defaultName: string; tools: string[] }
> = {
  market: {
    label: "Market Feed",
    short: "Data",
    description: "Pulls live and historical prices — open, high, low, close, volume, and related metadata.",
    defaultName: "Market Feed",
    tools: ["OHLCV", "Volume", "Corporate actions", "Index constituents", "Session calendar"],
  },
  research: {
    label: "Research",
    short: "Research",
    description: "Fundamental analysis — filings, earnings, news, competitors, and valuation language.",
    defaultName: "Research",
    tools: ["SEC filings", "Earnings transcripts", "News", "Competitors", "Valuation notes"],
  },
  trading: {
    label: "Trading",
    short: "Trading",
    description: "Technical model that reads market data and produces predictions and signals.",
    defaultName: "Trading",
    tools: ["Trend", "Momentum", "Volatility", "Mean reversion", "Pattern scan"],
  },
  risk: {
    label: "Risk",
    short: "Risk",
    description: "Watches exposure, drawdown, position size, and stop rules before anything is acted on.",
    defaultName: "Risk",
    tools: ["Drawdown", "Position limits", "Stop-loss", "Correlation", "VaR"],
  },
};

const DEFAULT_INSTRUCTIONS: Record<AgentType, string> = {
  market:
    "Collect clean, timestamped market data for the workspace instrument. Prefer adjusted prices. Flag missing bars, halted sessions, and corporate actions. Output a structured quote snapshot plus a trailing OHLCV window. Do not interpret — only fetch and normalize.",
  research:
    "Read filings, earnings, and reputable news for the workspace instrument. Summarize what changed, why it matters, and how competitors compare. Separate fact from opinion. Cite the source type (10-K, 10-Q, 8-K, transcript, news). No trade recommendations.",
  trading:
    "Use only data passed in from connected agents. Produce a directional view (long / flat / short), a confidence score, and a short rationale grounded in technical structure. Never override risk limits. If data is stale or incomplete, return no-trade.",
  risk:
    "Review proposed trades against max drawdown, position cap, and stop-loss. Block anything that breaches a limit. Report current exposure in plain language. Prefer capital preservation over activity.",
};

export function defaultConfig(type: AgentType): AgentConfig {
  const meta = AGENT_META[type];
  return {
    name: meta.defaultName,
    instructions: DEFAULT_INSTRUCTIONS[type],
    model: type === "research" ? "claude-4-sonnet" : type === "trading" ? "gpt-4o" : "gpt-4o-mini",
    temperature: type === "research" ? 0.3 : 0.1,
    maxTokens: 2048,
    maxIterations: 8,
    cadence: type === "market" ? "1m" : type === "trading" ? "15m" : type === "risk" ? "5m" : "1h",
    memory: type === "research" ? "persistent" : "session",
    enabled: true,
    tools: meta.tools.slice(0, 3),
    fields: ["open", "high", "low", "close", "volume"],
    lookbackDays: 252,
    sources: ["SEC filings", "Earnings transcripts", "News"],
    horizon: "swing",
    confidence: 0.6,
    longOnly: true,
    maxDrawdown: 0.12,
    maxPosition: 0.25,
    stopLoss: 0.06,
  };
}

export function suggestedWorkspaceName(instrument: Instrument) {
  if (instrument.kind === "exchange") return `${instrument.symbol} desk`;
  return `${instrument.symbol} board`;
}
