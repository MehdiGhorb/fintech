import { httpGet, TTL } from '../net/http';
import { getHistory } from './stockanalysis';
import type { AssetRef, Bar } from './types';

/**
 * Liquid ETFs stand in for the macro factors we care about. Their relative
 * moves tell us about rates, credit, the dollar and risk appetite without
 * needing a paid macro feed.
 */
const PROXIES: Array<{ symbol: string; label: string; reads: string }> = [
  { symbol: 'SPY', label: 'S&P 500', reads: 'broad equity risk appetite' },
  { symbol: 'QQQ', label: 'Nasdaq 100', reads: 'large-cap growth/duration' },
  { symbol: 'IWM', label: 'Russell 2000', reads: 'domestic cyclicals and small-cap credit sensitivity' },
  { symbol: 'RSP', label: 'S&P 500 equal weight', reads: 'breadth versus mega-cap concentration' },
  { symbol: 'TLT', label: '20y+ Treasuries', reads: 'long-end duration' },
  { symbol: 'IEF', label: '7-10y Treasuries', reads: 'belly of the curve' },
  { symbol: 'HYG', label: 'High-yield credit', reads: 'credit stress' },
  { symbol: 'LQD', label: 'Investment-grade credit', reads: 'IG spreads and duration' },
  { symbol: 'UUP', label: 'US dollar index', reads: 'dollar direction' },
  { symbol: 'GLD', label: 'Gold', reads: 'real rates and debasement hedging' },
  { symbol: 'USO', label: 'Crude oil', reads: 'energy input costs and inflation impulse' },
  { symbol: 'XLK', label: 'Technology', reads: 'tech leadership' },
  { symbol: 'SMH', label: 'Semiconductors', reads: 'AI/semi cycle' },
  { symbol: 'XLF', label: 'Financials', reads: 'lending conditions' },
  { symbol: 'XLE', label: 'Energy', reads: 'commodity cycle' },
  { symbol: 'XLP', label: 'Staples', reads: 'defensive rotation' },
  { symbol: 'XLU', label: 'Utilities', reads: 'defensive rotation and bond proxy' },
  { symbol: 'XLV', label: 'Healthcare', reads: 'defensive quality' },
];

export interface MacroProxy {
  symbol: string;
  label: string;
  reads: string;
  price?: number;
  changePercent1w?: number;
  changePercent1m?: number;
  changePercent3m?: number;
  changePercent12m?: number;
  /** Distance from the 200-day moving average, in percent. */
  vs200dma?: number;
}

export interface YieldCurve {
  date: string;
  yields: Record<string, number>;
  spread2s10s: number | null;
  spread3m10y: number | null;
  /** Change in the 10-year yield over roughly one month, in basis points. */
  change10yBp1m: number | null;
  change2yBp1m: number | null;
  inverted: boolean;
}

export interface MacroSnapshot {
  asOf: string;
  vix: { last: number | null; change5d: number | null; percentile1y: number | null; regime: string } | null;
  yieldCurve: YieldCurve | null;
  proxies: MacroProxy[];
}

function pctChange(bars: Bar[], lookback: number): number | undefined {
  if (bars.length <= lookback) return undefined;
  const now = bars[bars.length - 1].adjClose;
  const then = bars[bars.length - 1 - lookback].adjClose;
  if (!then) return undefined;
  return ((now - then) / then) * 100;
}

async function proxyStats(entry: (typeof PROXIES)[number]): Promise<MacroProxy> {
  const asset: AssetRef = { kind: 'etf', symbol: entry.symbol, name: entry.label, saPath: `/etf/${entry.symbol.toLowerCase()}` };
  try {
    const bars = await getHistory(asset, '2Y');
    if (!bars.length) return { ...entry };
    const last = bars[bars.length - 1].adjClose;
    const window = bars.slice(-200);
    const sma200 = window.reduce((s, b) => s + b.adjClose, 0) / window.length;
    return {
      ...entry,
      price: last,
      changePercent1w: pctChange(bars, 5),
      changePercent1m: pctChange(bars, 21),
      changePercent3m: pctChange(bars, 63),
      changePercent12m: pctChange(bars, 252),
      vs200dma: sma200 ? ((last - sma200) / sma200) * 100 : undefined,
    };
  } catch {
    return { ...entry };
  }
}

async function getVix(): Promise<MacroSnapshot['vix']> {
  const res = await httpGet('https://cdn.cboe.com/api/global/us_indices/daily_prices/VIX_History.csv', {
    ttl: TTL.macro,
    tolerateError: true,
    timeoutMs: 40_000,
  });
  if (res.status !== 200 || !res.body) return null;
  const rows = res.body.trim().split('\n').slice(1);
  const closes: number[] = [];
  for (const row of rows) {
    const close = parseFloat(row.split(',')[4]);
    if (Number.isFinite(close)) closes.push(close);
  }
  if (!closes.length) return null;
  const last = closes[closes.length - 1];
  const prior = closes[closes.length - 6];
  const window = closes.slice(-252);
  const below = window.filter((v) => v <= last).length;
  const percentile = (below / window.length) * 100;
  const regime =
    last < 14 ? 'complacent' : last < 20 ? 'calm' : last < 28 ? 'elevated' : last < 40 ? 'stressed' : 'panic';
  return {
    last,
    change5d: prior ? ((last - prior) / prior) * 100 : null,
    percentile1y: percentile,
    regime,
  };
}

async function getYieldCurve(): Promise<YieldCurve | null> {
  const year = new Date().getUTCFullYear();
  const fetchYear = async (y: number) => {
    const res = await httpGet(
      `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_yield_curve&field_tdr_date_value=${y}`,
      { ttl: TTL.macro, tolerateError: true, timeoutMs: 40_000 },
    );
    return res.status === 200 ? res.body : '';
  };

  let xml = await fetchYear(year);
  // Early in January the current year's file may still be empty.
  if (!xml || !xml.includes('BC_10YEAR')) xml = await fetchYear(year - 1);
  if (!xml) return null;

  // The feed is an OData document with namespaced tags (`<d:BC_10YEAR>`), which
  // CSS selectors handle poorly, so read the fields directly.
  const TENORS: Record<string, string> = {
    BC_1MONTH: '1M', BC_3MONTH: '3M', BC_6MONTH: '6M', BC_1YEAR: '1Y',
    BC_2YEAR: '2Y', BC_3YEAR: '3Y', BC_5YEAR: '5Y', BC_7YEAR: '7Y',
    BC_10YEAR: '10Y', BC_20YEAR: '20Y', BC_30YEAR: '30Y',
  };
  const rows: Array<{ date: string; yields: Record<string, number> }> = [];
  for (const block of xml.split(/<m:properties>/).slice(1)) {
    const date = block.match(/<d:NEW_DATE[^>]*>([^<]+)</)?.[1]?.slice(0, 10);
    if (!date) continue;
    const yields: Record<string, number> = {};
    for (const [tag, label] of Object.entries(TENORS)) {
      const v = parseFloat(block.match(new RegExp(`<d:${tag}[^>]*>([^<]+)<`))?.[1] ?? '');
      if (Number.isFinite(v)) yields[label] = v;
    }
    if (Object.keys(yields).length) rows.push({ date, yields });
  }
  rows.sort((a, b) => a.date.localeCompare(b.date));
  if (!rows.length) return null;

  const latest = rows[rows.length - 1];
  const monthAgo = rows[Math.max(0, rows.length - 22)];
  const y = latest.yields;
  const spread2s10s = y['10Y'] !== undefined && y['2Y'] !== undefined ? y['10Y'] - y['2Y'] : null;
  const spread3m10y = y['10Y'] !== undefined && y['3M'] !== undefined ? y['10Y'] - y['3M'] : null;

  return {
    date: latest.date,
    yields: y,
    spread2s10s,
    spread3m10y,
    change10yBp1m:
      y['10Y'] !== undefined && monthAgo.yields['10Y'] !== undefined
        ? (y['10Y'] - monthAgo.yields['10Y']) * 100
        : null,
    change2yBp1m:
      y['2Y'] !== undefined && monthAgo.yields['2Y'] !== undefined
        ? (y['2Y'] - monthAgo.yields['2Y']) * 100
        : null,
    inverted: spread2s10s !== null && spread2s10s < 0,
  };
}

export async function getMacroSnapshot(subset?: string[]): Promise<MacroSnapshot> {
  const wanted = subset?.length ? PROXIES.filter((p) => subset.includes(p.symbol)) : PROXIES;
  const [vix, yieldCurve, proxies] = await Promise.all([
    getVix().catch(() => null),
    getYieldCurve().catch(() => null),
    Promise.all(wanted.map(proxyStats)),
  ]);
  return {
    asOf: new Date().toISOString(),
    vix,
    yieldCurve,
    proxies: proxies.filter((p) => p.price !== undefined),
  };
}

/** Daily bars for a macro proxy, so the quant layer can compute correlations. */
export async function getProxyBars(symbol: string, range = '5Y'): Promise<Bar[]> {
  return getHistory(
    { kind: 'etf', symbol, name: symbol, saPath: `/etf/${symbol.toLowerCase()}` },
    range,
  );
}
