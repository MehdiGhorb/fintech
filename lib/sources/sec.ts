import * as cheerio from 'cheerio';
import { httpGet, TTL, tryJson } from '../net/http';
import { clampText, htmlToText, normaliseText } from '../net/html';
import type { Filing, InsiderTrade } from './types';

const DATA = 'https://data.sec.gov';
const ARCHIVES = 'https://www.sec.gov/Archives/edgar/data';

export function padCik(cik: string | number): string {
  return String(cik).replace(/\D/g, '').padStart(10, '0');
}

interface SubmissionsResponse {
  cik: string;
  name: string;
  tickers?: string[];
  sicDescription?: string;
  filings?: {
    recent?: {
      accessionNumber: string[];
      filingDate: string[];
      reportDate: string[];
      form: string[];
      primaryDocument: string[];
      primaryDocDescription: string[];
    };
  };
}

export async function getSubmissions(cik: string): Promise<SubmissionsResponse | null> {
  return tryJson<SubmissionsResponse>(`${DATA}/submissions/CIK${padCik(cik)}.json`, {
    ttl: TTL.filings,
  });
}

export async function getFilings(cik: string, forms?: string[], limit = 20): Promise<Filing[]> {
  const subs = await getSubmissions(cik);
  const recent = subs?.filings?.recent;
  if (!recent) return [];
  const wanted = forms?.map((f) => f.toUpperCase());
  const bare = String(Number(padCik(cik)));
  const out: Filing[] = [];

  for (let i = 0; i < recent.form.length && out.length < limit; i++) {
    const form = recent.form[i];
    if (wanted && !wanted.some((w) => form.toUpperCase() === w || form.toUpperCase().startsWith(`${w}/`))) continue;
    const accession = recent.accessionNumber[i];
    const nodash = accession.replace(/-/g, '');
    out.push({
      form,
      filedAt: recent.filingDate[i],
      reportDate: recent.reportDate[i] || undefined,
      accession,
      primaryDoc: recent.primaryDocument[i],
      url: `${ARCHIVES}/${bare}/${nodash}/${recent.primaryDocument[i]}`,
      description: recent.primaryDocDescription?.[i] || undefined,
    });
  }
  return out;
}

/** Downloads a filing's primary document and reduces it to readable text. */
export async function getFilingText(filing: Filing, maxChars = 400_000): Promise<string> {
  const res = await httpGet(filing.url, { ttl: TTL.filingText, tolerateError: true, timeoutMs: 60_000 });
  if (res.status !== 200 || !res.body) return '';
  return clampText(htmlToText(res.body), maxChars);
}

const ITEM_PATTERNS: Array<{ key: string; body: string }> = [
  { key: 'Item 1 — Business', body: 'business' },
  { key: 'Item 1A — Risk Factors', body: 'risk\\s+factors' },
  { key: 'Item 1B — Unresolved Staff Comments', body: 'unresolved\\s+staff' },
  { key: 'Item 2 — Properties', body: 'properties' },
  { key: 'Item 3 — Legal Proceedings', body: 'legal\\s+proceedings' },
  { key: 'Item 5 — Market for Common Equity', body: 'market\\s+for' },
  { key: 'Item 7 — MD&A', body: "management[’']?s?\\s+discussion" },
  { key: 'Item 7A — Market Risk', body: 'quantitative\\s+and\\s+qualitative' },
  { key: 'Item 8 — Financial Statements', body: 'financial\\s+statements' },
  { key: 'Item 9A — Controls and Procedures', body: 'controls\\s+and\\s+procedures' },
];

const ITEM_NUMBERS: Record<string, string> = {
  'Item 1 — Business': '1',
  'Item 1A — Risk Factors': '1a',
  'Item 1B — Unresolved Staff Comments': '1b',
  'Item 2 — Properties': '2',
  'Item 3 — Legal Proceedings': '3',
  'Item 5 — Market for Common Equity': '5',
  'Item 7 — MD&A': '7',
  'Item 7A — Market Risk': '7a',
  'Item 8 — Financial Statements': '8',
  'Item 9A — Controls and Procedures': '9a',
};

/**
 * Splits a 10-K/10-Q into its numbered items.
 *
 * Filings are laid out as HTML tables, so headings can appear mid-line and are
 * repeated in the table of contents. We collect every candidate heading offset,
 * cut the document at those points, and keep the longest block per item — the
 * table-of-contents match yields a short block and loses to the real section.
 */
export function extractFilingSections(text: string): Record<string, string> {
  const marks: Array<{ key: string; at: number }> = [];

  for (const { key, body } of ITEM_PATTERNS) {
    const num = ITEM_NUMBERS[key];
    const re = new RegExp(`item\\s*${num}\\s*[.:)\\-–—]?\\s*(?:${body})`, 'gi');
    for (const match of text.matchAll(re)) {
      if (match.index !== undefined) marks.push({ key, at: match.index });
    }
  }
  if (!marks.length) return {};
  marks.sort((a, b) => a.at - b.at);

  const sections: Record<string, string> = {};
  for (let i = 0; i < marks.length; i++) {
    const end = i + 1 < marks.length ? marks[i + 1].at : text.length;
    const body = text.slice(marks[i].at, end).trim();
    const existing = sections[marks[i].key];
    if (!existing || body.length > existing.length) sections[marks[i].key] = body;
  }

  // Drop stubs that are really just table-of-contents rows.
  for (const [key, value] of Object.entries(sections)) {
    if (value.length < 400) delete sections[key];
  }
  return sections;
}

/** Concepts worth pulling from XBRL, keyed by the tags companies actually use. */
const CONCEPTS: Record<string, string[]> = {
  Revenues: [
    'RevenueFromContractWithCustomerExcludingAssessedTax',
    'RevenueFromContractWithCustomerIncludingAssessedTax',
    'Revenues',
    'SalesRevenueNet',
  ],
  CostOfRevenue: ['CostOfRevenue', 'CostOfGoodsAndServicesSold'],
  GrossProfit: ['GrossProfit'],
  OperatingIncomeLoss: ['OperatingIncomeLoss'],
  NetIncomeLoss: ['NetIncomeLoss'],
  EpsDiluted: ['EarningsPerShareDiluted'],
  ResearchAndDevelopment: ['ResearchAndDevelopmentExpense'],
  SellingGeneralAdmin: ['SellingGeneralAndAdministrativeExpense', 'GeneralAndAdministrativeExpense'],
  OperatingCashFlow: ['NetCashProvidedByUsedInOperatingActivities'],
  CapEx: ['PaymentsToAcquirePropertyPlantAndEquipment'],
  ShareBuybacks: ['PaymentsForRepurchaseOfCommonStock'],
  DividendsPaid: ['PaymentsOfDividendsCommonStock', 'PaymentsOfDividends'],
  StockCompensation: ['ShareBasedCompensation'],
  CashAndEquivalents: ['CashAndCashEquivalentsAtCarryingValue'],
  ShortTermInvestments: ['ShortTermInvestments', 'MarketableSecuritiesCurrent'],
  Inventory: ['InventoryNet'],
  Receivables: ['AccountsReceivableNetCurrent'],
  TotalCurrentAssets: ['AssetsCurrent'],
  TotalAssets: ['Assets'],
  TotalCurrentLiabilities: ['LiabilitiesCurrent'],
  LongTermDebt: ['LongTermDebtNoncurrent', 'LongTermDebt'],
  TotalLiabilities: ['Liabilities'],
  StockholdersEquity: ['StockholdersEquity'],
  SharesOutstanding: ['CommonStockSharesOutstanding', 'WeightedAverageNumberOfDilutedSharesOutstanding'],
  Goodwill: ['Goodwill'],
  DeferredRevenue: ['ContractWithCustomerLiabilityCurrent', 'DeferredRevenueCurrent'],
};

export interface FactPoint {
  end: string;
  start?: string;
  value: number;
  fiscalYear?: number;
  fiscalPeriod?: string;
  form?: string;
  filed?: string;
  unit: string;
}

/**
 * Authoritative fundamentals straight from XBRL. Returns per-concept time
 * series so agents can reason about trends rather than a single snapshot.
 */
export async function getKeyFacts(cik: string): Promise<Record<string, FactPoint[]> | null> {
  const raw = await tryJson<any>(`${DATA}/api/xbrl/companyfacts/CIK${padCik(cik)}.json`, {
    ttl: TTL.filings,
    timeoutMs: 60_000,
  });
  if (!raw?.facts) return null;
  const gaap = raw.facts['us-gaap'] ?? {};
  const dei = raw.facts.dei ?? {};

  const out: Record<string, FactPoint[]> = {};
  for (const [name, tags] of Object.entries(CONCEPTS)) {
    for (const tag of tags) {
      const entry = gaap[tag] ?? dei[tag];
      if (!entry?.units) continue;
      const unitKey = Object.keys(entry.units)[0];
      const points = (entry.units[unitKey] ?? []) as any[];
      const series = points
        .filter((p) => typeof p.val === 'number' && p.end)
        // Annual and quarterly reports only; drop the duplicated amended noise.
        .filter((p) => p.form === '10-K' || p.form === '10-Q' || p.form === '20-F')
        .map((p) => ({
          end: p.end,
          start: p.start,
          value: p.val,
          fiscalYear: p.fy,
          fiscalPeriod: p.fp,
          form: p.form,
          filed: p.filed,
          unit: unitKey,
        }))
        .sort((a, b) => a.end.localeCompare(b.end));

      // Deduplicate on period end, keeping the most recently filed value.
      const byEnd = new Map<string, FactPoint>();
      for (const p of series) {
        const key = `${p.start ?? ''}|${p.end}`;
        const prior = byEnd.get(key);
        if (!prior || (p.filed ?? '') > (prior.filed ?? '')) byEnd.set(key, p);
      }
      const deduped = [...byEnd.values()].sort((a, b) => a.end.localeCompare(b.end));
      if (deduped.length) {
        out[name] = deduped.slice(-28);
        break;
      }
    }
  }
  return Object.keys(out).length ? out : null;
}

/** Parses Form 4 ownership XML into structured insider transactions. */
export async function getInsiderTrades(cik: string, limit = 20): Promise<InsiderTrade[]> {
  const filings = await getFilings(cik, ['4'], limit);
  const bare = String(Number(padCik(cik)));
  const trades: InsiderTrade[] = [];

  for (const filing of filings) {
    const nodash = filing.accession.replace(/-/g, '');
    const index = await tryJson<{ directory?: { item?: Array<{ name: string }> } }>(
      `${ARCHIVES}/${bare}/${nodash}/index.json`,
      { ttl: TTL.filingText },
    );
    const xmlName = index?.directory?.item?.find(
      (it) => it.name.endsWith('.xml') && !it.name.startsWith('xsl') && !/^R\d/.test(it.name),
    )?.name;
    if (!xmlName) continue;

    const doc = await httpGet(`${ARCHIVES}/${bare}/${nodash}/${xmlName}`, {
      ttl: TTL.filingText,
      tolerateError: true,
    });
    if (doc.status !== 200) continue;

    const $ = cheerio.load(doc.body, { xmlMode: true });
    const owner = normaliseText($('reportingOwnerId rptOwnerName').first().text()) || 'Unknown';
    const rel = $('reportingOwnerRelationship');
    const roles: string[] = [];
    if (rel.find('isDirector').text().match(/1|true/i)) roles.push('Director');
    if (rel.find('isOfficer').text().match(/1|true/i)) roles.push(normaliseText(rel.find('officerTitle').text()) || 'Officer');
    if (rel.find('isTenPercentOwner').text().match(/1|true/i)) roles.push('10% owner');

    $('nonDerivativeTransaction').each((_, el) => {
      const node = $(el);
      const shares = parseFloat(node.find('transactionShares value').first().text()) || null;
      const price = parseFloat(node.find('transactionPricePerShare value').first().text()) || null;
      const code = normaliseText(node.find('transactionCode').first().text());
      const disposed = normaliseText(node.find('transactionAcquiredDisposedCode value').first().text());
      trades.push({
        filedAt: filing.filedAt,
        owner,
        role: roles.join(', ') || undefined,
        transactionType: `${code}${disposed ? ` (${disposed === 'A' ? 'acquired' : 'disposed'})` : ''}`,
        shares,
        pricePerShare: price,
        value: shares && price ? shares * price : null,
        sharesOwnedAfter:
          parseFloat(node.find('sharesOwnedFollowingTransaction value').first().text()) || null,
        url: filing.url,
      });
    });
  }
  return trades;
}

export interface FullTextHit {
  title: string;
  form: string;
  filedAt: string;
  cik: string;
  companyName: string;
  url: string;
  snippetSource: string;
}

/**
 * EDGAR full-text search across filing bodies — the way to find, say, every
 * 8-K in the last year that mentions a specific customer or product line.
 */
export async function fullTextSearch(
  query: string,
  opts: {
    forms?: string[];
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
    /** Ticker or company name to scope the search to a single filer. */
    entity?: string;
  } = {},
): Promise<FullTextHit[]> {
  const params = new URLSearchParams({ q: query });
  if (opts.forms?.length) params.set('forms', opts.forms.join(','));
  if (opts.entity) params.set('entityName', opts.entity);
  if (opts.dateFrom) params.set('startdt', opts.dateFrom);
  if (opts.dateTo) params.set('enddt', opts.dateTo);

  const data = await tryJson<any>(`https://efts.sec.gov/LATEST/search-index?${params}`, {
    ttl: TTL.search,
    headers: { Accept: 'application/json' },
  });
  const hits = data?.hits?.hits ?? [];
  return hits.slice(0, opts.limit ?? 15).map((h: any) => {
    const src = h._source ?? {};
    const [accession, doc] = String(h._id ?? '').split(':');
    const cik = String(src.ciks?.[0] ?? '').replace(/^0+/, '');
    return {
      title: doc ?? '',
      form: src.root_form ?? src.form ?? src.file_type ?? '',
      filedAt: src.file_date ?? '',
      cik,
      companyName: String(src.display_names?.[0] ?? '').replace(/\s+\(CIK[^)]*\)/, '').trim(),
      url: accession && cik ? `${ARCHIVES}/${cik}/${accession.replace(/-/g, '')}/${doc ?? ''}` : '',
      snippetSource: src.file_type ?? '',
    };
  });
}

/** Institutional 13F holders of a ticker, via full-text search on the ticker. */
export async function findCikByTicker(ticker: string): Promise<string | null> {
  const data = await tryJson<Record<string, { cik_str: number; ticker: string }>>(
    'https://www.sec.gov/files/company_tickers.json',
    { ttl: 604_800 },
  );
  if (!data) return null;
  for (const entry of Object.values(data)) {
    if (entry.ticker?.toUpperCase() === ticker.toUpperCase()) return padCik(entry.cik_str);
  }
  return null;
}
