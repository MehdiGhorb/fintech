export type Name = {
  symbol: string;
  name: string;
  group: string;
};

/** 50-name FinCast paper universe. */
export const NAMES: Name[] = [
  { symbol: "AAPL", name: "Apple", group: "tech" },
  { symbol: "MSFT", name: "Microsoft", group: "tech" },
  { symbol: "NVDA", name: "NVIDIA", group: "tech" },
  { symbol: "GOOGL", name: "Alphabet", group: "tech" },
  { symbol: "AMZN", name: "Amazon", group: "tech" },
  { symbol: "META", name: "Meta", group: "tech" },
  { symbol: "AVGO", name: "Broadcom", group: "tech" },
  { symbol: "AMD", name: "AMD", group: "tech" },
  { symbol: "NFLX", name: "Netflix", group: "tech" },
  { symbol: "TSLA", name: "Tesla", group: "tech" },
  { symbol: "ORCL", name: "Oracle", group: "tech" },
  { symbol: "INTC", name: "Intel", group: "tech" },
  { symbol: "CRM", name: "Salesforce", group: "tech" },
  { symbol: "CSCO", name: "Cisco", group: "tech" },
  { symbol: "IBM", name: "IBM", group: "tech" },
  { symbol: "JPM", name: "JPMorgan", group: "finance" },
  { symbol: "GS", name: "Goldman Sachs", group: "finance" },
  { symbol: "V", name: "Visa", group: "finance" },
  { symbol: "MA", name: "Mastercard", group: "finance" },
  { symbol: "BAC", name: "Bank of America", group: "finance" },
  { symbol: "AXP", name: "American Express", group: "finance" },
  { symbol: "UNH", name: "UnitedHealth", group: "health" },
  { symbol: "JNJ", name: "Johnson & Johnson", group: "health" },
  { symbol: "LLY", name: "Eli Lilly", group: "health" },
  { symbol: "ABBV", name: "AbbVie", group: "health" },
  { symbol: "PFE", name: "Pfizer", group: "health" },
  { symbol: "MRK", name: "Merck", group: "health" },
  { symbol: "AMGN", name: "Amgen", group: "health" },
  { symbol: "XOM", name: "Exxon Mobil", group: "energy" },
  { symbol: "CVX", name: "Chevron", group: "energy" },
  { symbol: "COP", name: "ConocoPhillips", group: "energy" },
  { symbol: "WMT", name: "Walmart", group: "consumer" },
  { symbol: "HD", name: "Home Depot", group: "consumer" },
  { symbol: "COST", name: "Costco", group: "consumer" },
  { symbol: "MCD", name: "McDonald's", group: "consumer" },
  { symbol: "NKE", name: "Nike", group: "consumer" },
  { symbol: "PG", name: "Procter & Gamble", group: "consumer" },
  { symbol: "KO", name: "Coca-Cola", group: "consumer" },
  { symbol: "PEP", name: "PepsiCo", group: "consumer" },
  { symbol: "CAT", name: "Caterpillar", group: "industrial" },
  { symbol: "GE", name: "GE", group: "industrial" },
  { symbol: "BA", name: "Boeing", group: "industrial" },
  { symbol: "HON", name: "Honeywell", group: "industrial" },
  { symbol: "MMM", name: "3M", group: "industrial" },
  { symbol: "DIS", name: "Disney", group: "other" },
  { symbol: "T", name: "AT&T", group: "other" },
  { symbol: "VZ", name: "Verizon", group: "other" },
  { symbol: "TRV", name: "Travelers", group: "other" },
  { symbol: "SHW", name: "Sherwin-Williams", group: "other" },
  { symbol: "SPY", name: "S&P 500 ETF", group: "index" },
];

export const DJIA = NAMES;
export const SYMBOLS = NAMES.map((item) => item.symbol);

export function nameOf(symbol: string) {
  return NAMES.find((item) => item.symbol === symbol)?.name ?? symbol;
}

export function isListed(symbol: string) {
  return SYMBOLS.includes(symbol.toUpperCase());
}
