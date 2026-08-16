export type AssetKind = 'stock' | 'etf' | 'crypto' | 'index' | 'unknown';

export interface AssetRef {
  kind: AssetKind;
  /** Canonical display symbol, e.g. NVDA or BTC. */
  symbol: string;
  name: string;
  exchange?: string;
  currency?: string;
  cik?: string;
  /** stockanalysis.com base path, e.g. /stocks/nvda or /etf/spy */
  saPath?: string;
  coingeckoId?: string;
}

export interface Bar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  adjClose: number;
  volume: number;
}

export interface Quote {
  symbol: string;
  price: number;
  open?: number;
  high?: number;
  low?: number;
  previousClose?: number;
  changePercent?: number;
  volume?: number;
  extendedPrice?: number;
  extendedChangePercent?: number;
  marketState?: string;
  asOf?: string;
  currency?: string;
  high52?: number;
  low52?: number;
}

export interface StatGroup {
  label: string;
  summary: string;
  metrics: Array<{ name: string; value: string }>;
}

export interface Statistics {
  symbol: string;
  groups: StatGroup[];
  /** Flat name → value map across all groups for quick lookups. */
  flat: Record<string, string>;
}

export interface FinancialStatement {
  statement: string;
  period: 'annual' | 'quarterly' | 'ttm';
  /** Column labels, newest first. */
  periods: string[];
  fiscalYears: string[];
  rows: Array<{ label: string; key: string; values: Array<number | null> }>;
}

export interface CompanyProfile {
  symbol: string;
  name: string;
  description: string;
  sector?: string;
  industry?: string;
  country?: string;
  founded?: number;
  ipoDate?: string;
  employees?: number;
  ceo?: string;
  website?: string;
  address?: string;
  fiscalYear?: string;
  sic?: string;
  cik?: string;
  executives: Array<{ name: string; title: string }>;
}

export interface AnalystView {
  symbol: string;
  targetLow?: number;
  targetHigh?: number;
  targetMedian?: number;
  targetAverage?: number;
  targetCount?: number;
  targetUpdated?: string;
  consensus?: string;
  /** Monthly recommendation counts, oldest first — used to measure revision drift. */
  history: Array<{
    date: string;
    consensus?: string;
    strongBuy?: number;
    buy?: number;
    hold?: number;
    sell?: number;
    strongSell?: number;
    total?: number;
    score?: number;
  }>;
  recentActions: Array<{
    firm?: string;
    analyst?: string;
    date?: string;
    action?: string;
    ratingNew?: string;
    ratingOld?: string;
    targetNew?: number | null;
    targetOld?: number | null;
    analystSuccessRate?: number | null;
    analystAvgReturn?: number | null;
  }>;
  estimates: Array<{
    period: string;
    fiscalYear?: string;
    fiscalQuarter?: string;
    revenue?: number | null;
    revenueGrowth?: number | null;
    eps?: number | null;
    epsGrowth?: number | null;
    analysts?: number | null;
    forwardPe?: number | null;
    grossMargin?: number | null;
    freeCashFlow?: number | null;
  }>;
}

export interface NewsItem {
  title: string;
  url: string;
  published?: string;
  source?: string;
  summary?: string;
}

export interface Filing {
  form: string;
  filedAt: string;
  reportDate?: string;
  accession: string;
  primaryDoc: string;
  url: string;
  description?: string;
}

export interface InsiderTrade {
  filedAt: string;
  owner: string;
  role?: string;
  transactionType?: string;
  shares?: number | null;
  pricePerShare?: number | null;
  value?: number | null;
  sharesOwnedAfter?: number | null;
  url: string;
}
