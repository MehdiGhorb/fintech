export type Bar = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type Action = "buy" | "sell" | "hold";

export type Direction = "up" | "down" | "flat";

export type Quote = {
  symbol: string;
  name: string;
  price: number;
  prevClose: number;
  change: number;
  changePct: number;
  open: number;
  high: number;
  low: number;
  volume: number;
};

export type ForecastPoint = {
  date: string;
  close: number;
  lo: number;
  hi: number;
};

export type Forecast = {
  horizonDays: number;
  direction: Direction;
  expectedPct: number;
  lowPct: number;
  highPct: number;
  expectedPrice: number;
  lowPrice: number;
  highPrice: number;
  confidence: number;
  summary: string;
  path: ForecastPoint[];
};

export type Performance = {
  directionalAcc: number;
  sharpe: number;
  maxDrawdown: number;
  sample: number;
};

export type Order = {
  action: "buy" | "sell";
  symbol: string;
  name: string;
  weight: number;
  reason: string;
  isSelected: boolean;
};

export type BookPosition = {
  symbol: string;
  name: string;
  qty: number;
  entry: number;
  last: number;
  value: number;
  pnl: number;
  pnlPct: number;
  predRet: number;
  predEnd: number;
};

export type BookFill = {
  t: string;
  symbol: string;
  side: "buy" | "sell";
  qty: number;
  px: number;
  note: string;
};

export type Book = {
  budget: number;
  cash: number;
  equity: number;
  pnl: number;
  pnlPct: number;
  origin: string | null;
  asOf: string | null;
  model: string;
  horizon: number;
  nLong: number;
  nUniverse: number;
  broker: string;
  positions: BookPosition[];
  cashNames: { symbol: string; name: string; predRet: number }[];
  fills: BookFill[];
  marks: { d: string; equity: number }[];
};

export type DeskPayload = {
  asOf: string;
  source: string;
  marketOpen: boolean;
  quote: Quote;
  series: { date: string; close: number }[];
  forecast: Forecast;
  performance: Performance;
  orders: Order[];
  selected: {
    action: Action;
    weight: number;
    reason: string;
  };
  book?: Book;
};
