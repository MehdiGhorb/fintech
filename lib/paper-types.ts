export type PaperFill = {
  t: string;
  symbol: string;
  side: "buy" | "sell";
  qty: number;
  px: number;
  note: string;
};

export type PaperPosition = {
  symbol: string;
  name: string;
  group: string;
  qty: number;
  entry: number;
  last: number;
  predRet: number;
  predEnd: number;
  path: number[];
  opened?: string;
  asOf?: string;
  open?: number;
  high?: number;
  low?: number;
  value?: number;
  pnl?: number;
  pnlPct?: number;
};

export type PaperSignal = {
  symbol: string;
  name: string;
  group: string;
  last: number;
  predEnd: number;
  predRet: number;
  path: number[];
  long: boolean;
  open: number;
  high: number;
  low: number;
  date: string;
};

export type PaperState = {
  budget: number;
  cash: number;
  equity: number;
  origin: string | null;
  asOf: string | null;
  updatedAt?: string;
  model: string;
  horizon: number;
  nLong?: number;
  nUniverse?: number;
  broker?: string;
  positions: PaperPosition[];
  fills: PaperFill[];
  marks: { d: string; equity: number; cash: number }[];
  signals: Record<string, PaperSignal>;
};
