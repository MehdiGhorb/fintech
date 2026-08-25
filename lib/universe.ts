export type Name = {
  symbol: string;
  name: string;
};

/** Same DJIA 30 universe as the technical trading bot. */
export const DJIA: Name[] = [
  { symbol: "AAPL", name: "Apple" },
  { symbol: "AMGN", name: "Amgen" },
  { symbol: "AMZN", name: "Amazon" },
  { symbol: "AXP", name: "American Express" },
  { symbol: "BA", name: "Boeing" },
  { symbol: "CAT", name: "Caterpillar" },
  { symbol: "CRM", name: "Salesforce" },
  { symbol: "CSCO", name: "Cisco" },
  { symbol: "CVX", name: "Chevron" },
  { symbol: "DIS", name: "Disney" },
  { symbol: "GS", name: "Goldman Sachs" },
  { symbol: "HD", name: "Home Depot" },
  { symbol: "HON", name: "Honeywell" },
  { symbol: "IBM", name: "IBM" },
  { symbol: "JNJ", name: "Johnson & Johnson" },
  { symbol: "JPM", name: "JPMorgan Chase" },
  { symbol: "KO", name: "Coca-Cola" },
  { symbol: "MCD", name: "McDonald's" },
  { symbol: "MMM", name: "3M" },
  { symbol: "MRK", name: "Merck" },
  { symbol: "MSFT", name: "Microsoft" },
  { symbol: "NKE", name: "Nike" },
  { symbol: "NVDA", name: "NVIDIA" },
  { symbol: "PG", name: "Procter & Gamble" },
  { symbol: "SHW", name: "Sherwin-Williams" },
  { symbol: "TRV", name: "Travelers" },
  { symbol: "UNH", name: "UnitedHealth" },
  { symbol: "V", name: "Visa" },
  { symbol: "VZ", name: "Verizon" },
  { symbol: "WMT", name: "Walmart" },
];

export const SYMBOLS = DJIA.map((item) => item.symbol);

export function nameOf(symbol: string) {
  return DJIA.find((item) => item.symbol === symbol)?.name ?? symbol;
}

export function isListed(symbol: string) {
  return SYMBOLS.includes(symbol.toUpperCase());
}
