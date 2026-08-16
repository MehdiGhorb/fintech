import { parseSvelteData, pickNode } from '../net/devalue';
import { httpGet, TTL, tryJson } from '../net/http';
import * as cheerio from 'cheerio';
import type {
  AnalystView,
  AssetRef,
  Bar,
  CompanyProfile,
  FinancialStatement,
  Quote,
  StatGroup,
  Statistics,
} from './types';

const BASE = 'https://stockanalysis.com';

interface SearchHit {
  id: string;
  s: string;
  t: string;
  n: string;
}

/** Resolves a free-text name or ticker to a stockanalysis.com listing. */
export async function searchListings(query: string): Promise<AssetRef[]> {
  const data = await tryJson<{ data?: SearchHit[] }>(
    `${BASE}/api/search?q=${encodeURIComponent(query)}`,
    { ttl: TTL.search },
  );
  if (!data?.data) return [];
  return data.data.slice(0, 12).map((hit) => {
    const type = hit.t;
    // 's' = US stock, 'e' = US ETF, anything else is an international listing
    // whose `s` field already carries the exchange path segment.
    const saPath =
      type === 's'
        ? `/stocks/${hit.s.toLowerCase()}`
        : type === 'e'
          ? `/etf/${hit.s.toLowerCase()}`
          : `/quote/${hit.s.toLowerCase()}`;
    return {
      kind: type === 'e' ? 'etf' : 'stock',
      symbol: hit.s.toUpperCase().split('/').pop() || hit.s.toUpperCase(),
      name: hit.n,
      saPath,
    } satisfies AssetRef;
  });
}

/** Fetches and hydrates a page's server data payload. */
async function pageData(saPath: string, sub = ''): Promise<unknown[]> {
  const path = `${saPath.replace(/\/$/, '')}${sub ? `/${sub}` : ''}/__data.json`;
  const res = await httpGet(`${BASE}${path}`, {
    ttl: TTL.fundamentals,
    headers: { Accept: 'application/json' },
    tolerateError: true,
  });
  if (res.status !== 200 || !res.body) return [];
  try {
    return parseSvelteData(res.body);
  } catch {
    return [];
  }
}

function quoteKind(saPath: string): 's' | 'e' | 'q' {
  if (saPath.startsWith('/etf/')) return 'e';
  if (saPath.startsWith('/stocks/')) return 's';
  return 'q';
}

export async function getQuote(asset: AssetRef): Promise<Quote | null> {
  if (!asset.saPath) return null;
  const symbol = asset.saPath.split('/').filter(Boolean).slice(1).join('/');
  const kind = quoteKind(asset.saPath);
  const data = await tryJson<{ data?: Record<string, unknown> }>(
    `${BASE}/api/quotes/${kind}/${symbol}`,
    { ttl: TTL.quote },
  );
  const q = data?.data as Record<string, number | string | undefined> | undefined;
  if (!q || typeof q.p !== 'number') return null;
  return {
    symbol: asset.symbol,
    price: q.p as number,
    open: q.o as number,
    high: q.h as number,
    low: q.l as number,
    previousClose: q.cl as number,
    changePercent: q.cp as number,
    volume: q.v as number,
    extendedPrice: q.ep as number,
    extendedChangePercent: q.ecp as number,
    marketState: q.ms as string,
    asOf: q.u as string,
    high52: q.h52 as number,
    low52: q.l52 as number,
  };
}

interface HistoryRow {
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
  a: number;
  v: number;
}

/**
 * Daily OHLCV. `range` accepts the site's own tokens (1Y, 5Y, 10Y, MAX) —
 * we request generously and let the caller slice.
 */
export async function getHistory(asset: AssetRef, range = '10Y'): Promise<Bar[]> {
  if (!asset.saPath) return [];
  const segments = asset.saPath.split('/').filter(Boolean);
  const kind = quoteKind(asset.saPath);
  const symbol = segments.slice(1).join('/');
  const data = await tryJson<{ data?: HistoryRow[] }>(
    `${BASE}/api/symbol/${kind}/${symbol}/history?range=${range}&period=Daily`,
    { ttl: TTL.prices },
  );
  if (!data?.data?.length) return [];
  return data.data
    .filter((r) => typeof r.c === 'number' && r.t)
    .map((r) => ({
      date: r.t,
      open: r.o,
      high: r.h,
      low: r.l,
      close: r.c,
      adjClose: typeof r.a === 'number' ? r.a : r.c,
      volume: r.v ?? 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function asString(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return String(v);
  return String(v);
}

export async function getStatistics(asset: AssetRef): Promise<Statistics | null> {
  if (!asset.saPath) return null;
  const nodes = await pageData(asset.saPath, 'statistics');
  const node = nodes.find(
    (n) => n && typeof n === 'object' && 'ratios' in (n as object) && 'margins' in (n as object),
  ) as Record<string, { text?: string; data?: Array<Record<string, unknown>> }> | undefined;
  if (!node) return null;

  const groups: StatGroup[] = [];
  const flat: Record<string, string> = {};
  for (const [label, section] of Object.entries(node)) {
    if (!section || typeof section !== 'object' || !Array.isArray(section.data)) continue;
    const metrics: Array<{ name: string; value: string }> = [];
    for (const item of section.data) {
      const name = asString(item.title);
      const value = asString(item.value);
      if (!name || !value || value === '[PRO]') continue;
      metrics.push({ name, value });
      flat[name] = value;
    }
    if (metrics.length || section.text) {
      groups.push({ label, summary: asString(section.text), metrics });
    }
  }
  return groups.length ? { symbol: asset.symbol, groups, flat } : null;
}

export async function getCompanyProfile(asset: AssetRef): Promise<CompanyProfile | null> {
  if (!asset.saPath) return null;
  const nodes = await pageData(asset.saPath, 'company');
  const node = pickNode<Record<string, any>>(nodes, ['profile', 'description']);
  if (!node) return null;
  const profile = node.profile ?? {};
  const details = node.details ?? {};
  const contact = node.contact ?? {};
  const description = cheerio
    .load(node.description ?? '')('body')
    .text()
    .replace(/\s+/g, ' ')
    .trim();

  return {
    symbol: asset.symbol,
    name: profile.name ?? asset.name,
    description,
    sector: profile.sector?.value,
    industry: profile.industry?.value,
    country: profile.country,
    founded: profile.founded,
    ipoDate: profile.ipoDate,
    employees: profile.employees?.value,
    ceo: profile.ceo,
    website: contact.website,
    address: asString(contact.address).replace(/<br\s*\/?>/g, ', '),
    fiscalYear: details.fiscalYear,
    sic: details.sic,
    cik: details.cik,
    executives: Array.isArray(node.executives)
      ? node.executives.map((e: any) => ({ name: asString(e.Name), title: asString(e.Title) }))
      : [],
  };
}

function buildStatement(
  title: string,
  period: 'annual' | 'quarterly',
  rowDefs: Array<{ id?: unknown; title?: unknown }>,
  data: Record<string, unknown>,
): FinancialStatement | null {
  const periods = Array.isArray(data.datekey) ? (data.datekey as unknown[]).map(asString) : [];
  const fiscalYears = Array.isArray(data.fiscalYear) ? (data.fiscalYear as unknown[]).map(asString) : [];
  const quarters = Array.isArray(data.fiscalQuarter) ? (data.fiscalQuarter as unknown[]).map(asString) : [];
  const labelled = periods.map((p, i) => {
    const fy = fiscalYears[i];
    const fq = quarters[i];
    return period === 'quarterly' && fy && fq ? `${fy} ${fq} (${p})` : fy ? `FY${fy} (${p})` : p;
  });

  const rows = rowDefs
    .map((row) => {
      const key = asString(row.id);
      const series = data[key];
      const values = Array.isArray(series)
        ? (series as unknown[]).map((v) => (typeof v === 'number' ? v : null))
        : [];
      return { label: asString(row.title) || key, key, values };
    })
    .filter((r) => r.values.length && r.values.some((v) => v !== null));

  if (!rows.length) return null;
  return { statement: title, period, periods: labelled, fiscalYears, rows };
}

/**
 * Financial statements. `statement` is one of the site's own tabs:
 * '' (overview), 'income-statement', 'balance-sheet', 'cash-flow-statement', 'ratios'.
 *
 * The overview tab groups rows into `sections`, while the individual statement
 * tabs return a flat `map` of row definitions plus a column-oriented
 * `financialData`. Both shapes are normalised here.
 */
export async function getFinancials(
  asset: AssetRef,
  statement: '' | 'income-statement' | 'balance-sheet' | 'cash-flow-statement' | 'ratios' = '',
  period: 'annual' | 'quarterly' = 'annual',
): Promise<FinancialStatement[]> {
  if (!asset.saPath) return [];
  const sub = ['financials', statement].filter(Boolean).join('/');
  const suffix = period === 'quarterly' ? '?p=quarterly' : '';
  const path = `${asset.saPath.replace(/\/$/, '')}/${sub}/__data.json${suffix}`;
  const res = await httpGet(`${BASE}${path}`, {
    ttl: TTL.fundamentals,
    headers: { Accept: 'application/json' },
    tolerateError: true,
  });
  if (res.status !== 200 || !res.body) return [];

  let nodes: unknown[];
  try {
    nodes = parseSvelteData(res.body);
  } catch {
    return [];
  }
  const node = pickNode<Record<string, any>>(nodes, ['statement', 'financialData']);
  if (!node) return [];

  const out: FinancialStatement[] = [];

  if (Array.isArray(node.sections) && node.sections.length) {
    for (const section of node.sections) {
      if (!section?.data || typeof section.data !== 'object') continue;
      const built = buildStatement(
        asString(section.title) || statement || 'Overview',
        period,
        section.rows ?? [],
        section.data,
      );
      if (built) out.push(built);
    }
    return out;
  }

  if (node.financialData && typeof node.financialData === 'object' && Array.isArray(node.map)) {
    const built = buildStatement(
      asString(node.statement) || statement || 'Statement',
      period,
      node.map,
      node.financialData,
    );
    if (built) out.push(built);
  }
  return out;
}

/** TTM snapshot of every ratio the site tracks, straight from the ratios tab. */
export async function getTtmMetrics(asset: AssetRef): Promise<Record<string, number> | null> {
  if (!asset.saPath) return null;
  const res = await httpGet(`${BASE}${asset.saPath.replace(/\/$/, '')}/financials/ratios/__data.json`, {
    ttl: TTL.fundamentals,
    headers: { Accept: 'application/json' },
    tolerateError: true,
  });
  if (res.status !== 200 || !res.body) return null;
  const node = pickNode<Record<string, any>>(parseSvelteData(res.body), ['ttmPrior']);
  const ttm = node?.ttm ?? node?.ttmPrior;
  if (!ttm || typeof ttm !== 'object') return null;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(ttm)) if (typeof v === 'number') out[k] = v;
  return Object.keys(out).length ? out : null;
}

export async function getAnalystView(asset: AssetRef): Promise<AnalystView | null> {
  if (!asset.saPath) return null;
  const nodes = await pageData(asset.saPath, 'forecast');
  const node = pickNode<Record<string, any>>(nodes, ['targets']);
  if (!node) return null;

  const targets = node.targets ?? {};
  const history = Array.isArray(node.recommendations)
    ? node.recommendations.map((r: any) => ({
        date: asString(r.date),
        consensus: r.consensus,
        strongBuy: r.strongBuy,
        buy: r.buy,
        hold: r.hold,
        sell: r.sell,
        strongSell: r.strongSell,
        total: r.total,
        score: r.score,
      }))
    : [];

  const recentActions = Array.isArray(node.ratings)
    ? node.ratings.map((r: any) => ({
        firm: r.firm,
        analyst: r.analyst,
        date: asString(r.date),
        action: r.action_rt,
        ratingNew: r.rating_new,
        ratingOld: r.rating_old,
        targetNew: typeof r.pt_now === 'number' ? r.pt_now : null,
        targetOld: typeof r.pt_old === 'number' ? r.pt_old : null,
        analystSuccessRate: r.scores?.success_rate ?? null,
        analystAvgReturn: r.scores?.avg_return ?? null,
      }))
    : [];

  const estimates: AnalystView['estimates'] = [];
  const table = node.estimates?.table?.annual;
  if (table && Array.isArray(table.dates)) {
    table.dates.forEach((date: unknown, i: number) => {
      const num = (arr: unknown) =>
        Array.isArray(arr) && typeof arr[i] === 'number' ? (arr[i] as number) : null;
      estimates.push({
        period: asString(date),
        fiscalYear: Array.isArray(table.fiscalYear) ? asString(table.fiscalYear[i]) : undefined,
        revenue: num(table.revenue),
        revenueGrowth: num(table.revenueGrowth),
        eps: num(table.eps),
        epsGrowth: num(table.epsGrowth),
        analysts: num(table.analysts),
        forwardPe: num(table.peForward),
        grossMargin: num(table.grossMargin),
        freeCashFlow: num(table.freeCashFlow),
      });
    });
  }

  const consensus = history.length ? history[history.length - 1].consensus : undefined;
  return {
    symbol: asset.symbol,
    targetLow: targets.low,
    targetHigh: targets.high,
    targetMedian: targets.median,
    targetAverage: targets.average,
    targetCount: targets.count,
    targetUpdated: targets.updated,
    consensus,
    history,
    recentActions,
    estimates,
  };
}

/** Revenue by segment and geography, when the site has it. */
export async function getRevenueBreakdown(asset: AssetRef): Promise<Record<string, unknown> | null> {
  if (!asset.saPath) return null;
  const nodes = await pageData(asset.saPath, 'revenue');
  const node = nodes.find(
    (n) => n && typeof n === 'object' && ('segments' in (n as object) || 'revenue' in (n as object)),
  );
  return (node as Record<string, unknown>) ?? null;
}

/** ETF holdings and exposure. */
export async function getEtfHoldings(asset: AssetRef): Promise<Record<string, unknown> | null> {
  if (!asset.saPath?.startsWith('/etf/')) return null;
  const nodes = await pageData(asset.saPath, 'holdings');
  const node = nodes.find((n) => n && typeof n === 'object' && 'holdings' in (n as object));
  return (node as Record<string, unknown>) ?? null;
}

/** Recent news headlines the site aggregates for the ticker. */
export async function getSiteNews(asset: AssetRef): Promise<Array<Record<string, unknown>>> {
  if (!asset.saPath) return [];
  const nodes = await pageData(asset.saPath, '');
  const node = nodes.find((n) => n && typeof n === 'object' && 'news' in (n as object)) as
    | { news?: Array<Record<string, unknown>> }
    | undefined;
  return node?.news ?? [];
}

/** Screener-backed peer set within the same industry. */
export async function getIndustryPeers(industry: string, limit = 25): Promise<Array<Record<string, unknown>>> {
  const slug = industry.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const nodes = await pageData(`/stocks/industry/${slug}`, '');
  const node = nodes.find((n) => n && typeof n === 'object' && 'data' in (n as object)) as
    | { data?: Array<Record<string, unknown>> }
    | undefined;
  return (node?.data ?? []).slice(0, limit);
}

/** Screener query against the site's stock list, e.g. for peer multiples. */
export async function screen(
  metrics: string[],
  limit = 30,
): Promise<Array<Record<string, unknown>>> {
  const cols = ['s', 'n', ...metrics].join(',');
  const data = await tryJson<{ data?: { data?: Array<Record<string, unknown>> } }>(
    `${BASE}/api/screener/s/f?m=marketCap&s=desc&c=${encodeURIComponent(cols)}&cn=${limit}&i=stocks`,
    { ttl: TTL.fundamentals },
  );
  return data?.data?.data ?? [];
}
