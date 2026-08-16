import type { ToolSchema } from '../llm/types';
import { clampText } from '../net/html';
import { formatQuantReport, runQuantEngine } from '../quant/engine';
import { horizonToDays } from '../quant/forecast';
import { discountedCashFlow, multiplesValuation, reverseDcfGrowth } from '../quant/valuation';
import { positionPlan, atrStop } from '../quant/risk';
import * as crypto from '../sources/crypto';
import * as macro from '../sources/macro';
import * as news from '../sources/news';
import { resolveAsset } from '../sources/resolve';
import * as sa from '../sources/stockanalysis';
import * as sec from '../sources/sec';
import * as web from '../sources/web';
import type { Dossier } from './context';
import { RunContext } from './context';

export interface ToolDefinition {
  schema: ToolSchema;
  run: (args: Record<string, any>) => Promise<string>;
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function fmtMoney(v: number | null): string {
  if (v === null) return 'n/a';
  const abs = Math.abs(v);
  if (abs >= 1e12) return `${(v / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(v / 1e3).toFixed(2)}K`;
  return v.toFixed(2);
}

function tableFromStatement(s: {
  statement: string;
  periods: string[];
  rows: Array<{ label: string; values: Array<number | null> }>;
}, maxCols = 8): string {
  const cols = s.periods.slice(0, maxCols);
  const header = ['Line item', ...cols].join(' | ');
  const body = s.rows
    .map((r) => [r.label, ...r.values.slice(0, maxCols).map((v) => (v === null ? 'n/a' : fmtMoney(v)))].join(' | '))
    .join('\n');
  return `### ${s.statement}\n${header}\n${body}`;
}

/**
 * Builds the tool set for a run. Tools write their results into the evidence
 * store and return the citation ref inline, so every downstream claim can be
 * traced to a source.
 */
export function buildTools(ctx: RunContext, dossier: Dossier, agentName: string): Record<string, ToolDefinition> {
  const asset = dossier.asset;
  const cik = asset.cik || dossier.profile?.cik || null;

  const tools: Record<string, ToolDefinition> = {};

  const def = (
    name: string,
    description: string,
    parameters: Record<string, unknown>,
    run: (args: Record<string, any>) => Promise<string>,
  ) => {
    tools[name] = { schema: { name, description, parameters }, run };
  };

  const obj = (props: Record<string, unknown>, required: string[] = []) => ({
    type: 'object',
    properties: props,
    required,
    additionalProperties: false,
  });

  def(
    'web_search',
    'Search the open web. Use precise, information-dense queries. Returns titles, URLs and snippets; follow up with read_url on the most promising results.',
    obj(
      {
        query: { type: 'string', description: 'Search query. Be specific, e.g. "NVIDIA Q2 FY2027 data center revenue guidance analyst reaction".' },
        limit: { type: 'integer', description: 'Number of results, 1-10. Default 6.' },
      },
      ['query'],
    ),
    async (args) => {
      const results = await web.search(String(args.query), Math.min(10, Number(args.limit) || 6));
      if (!results.length) return 'No results. Try different wording or a narrower query.';
      const ref = ctx.addArtifact({
        kind: 'search',
        source: 'web-search',
        title: `Web search: ${args.query}`,
        data: results,
      });
      return `[${ref}] ${results.length} results for "${args.query}":\n${results
        .map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.snippet ?? ''}`)
        .join('\n')}`;
    },
  );

  def(
    'read_url',
    'Fetch a web page and return its readable text. Use this to actually read articles, transcripts, investor pages and press releases rather than relying on snippets.',
    obj(
      {
        url: { type: 'string', description: 'Full URL to read.' },
        maxChars: { type: 'integer', description: 'Character budget, default 14000.' },
      },
      ['url'],
    ),
    async (args) => {
      const page = await web.readPage(String(args.url), Math.min(40_000, Number(args.maxChars) || 14_000));
      if (!page.text) return `Could not read ${args.url} (status ${page.status}). The page may be paywalled or JavaScript-only. Try another source.`;
      const ref = ctx.addArtifact({
        kind: 'page',
        source: new URL(page.url).hostname.replace(/^www\./, ''),
        title: page.title || page.url,
        url: page.url,
        text: page.text,
      });
      return `[${ref}] ${page.title || page.url}\nSource: ${page.url}\n\n${page.text}`;
    },
  );

  def(
    'search_news',
    'Search news coverage over a time window. Good for catalysts, guidance changes, regulatory events and management commentary.',
    obj(
      {
        query: { type: 'string' },
        window: { type: 'string', description: 'Recency window like 7d, 30d, 90d, 1y. Default 30d.' },
        limit: { type: 'integer', description: 'Default 12.' },
      },
      ['query'],
    ),
    async (args) => {
      const items = await news.searchNews(
        String(args.query),
        String(args.window || '30d'),
        Math.min(30, Number(args.limit) || 12),
      );
      if (!items.length) return 'No news found for that query and window.';
      const ref = ctx.addArtifact({
        kind: 'news',
        source: 'news-search',
        title: `News: ${args.query} (${args.window || '30d'})`,
        data: items,
      });
      return `[${ref}] ${items.length} headlines for "${args.query}":\n${items
        .map((n) => `- ${n.title} [${n.source ?? '?'}${n.published ? `, ${n.published}` : ''}]\n  ${n.url}`)
        .join('\n')}`;
    },
  );

  def(
    'get_financial_statement',
    'Full financial statements for the subject company, as reported. Returns up to 8 periods of line items.',
    obj({
      statement: {
        type: 'string',
        enum: ['overview', 'income-statement', 'balance-sheet', 'cash-flow-statement', 'ratios'],
      },
      period: { type: 'string', enum: ['annual', 'quarterly'] },
    }),
    async (args) => {
      const statement = (args.statement === 'overview' ? '' : args.statement) as any;
      const period = args.period === 'quarterly' ? 'quarterly' : 'annual';
      const data = await sa.getFinancials(asset, statement ?? '', period);
      if (!data.length) return 'No statement data available for this asset.';
      const text = data.map((s) => tableFromStatement(s)).join('\n\n');
      const ref = ctx.addArtifact({
        kind: 'financials',
        source: 'stockanalysis.com',
        title: `${asset.symbol} ${args.statement || 'overview'} (${period})`,
        url: `https://stockanalysis.com${asset.saPath}/financials/`,
        data,
      });
      return `[${ref}] ${asset.symbol} — ${args.statement || 'overview'}, ${period}. Values in currency units.\n\n${clampText(text, 12_000)}`;
    },
  );

  def(
    'get_key_statistics',
    'Valuation multiples, margins, returns on capital, balance-sheet strength, short interest, earnings date, Altman Z and Piotroski F scores for the subject.',
    obj({}),
    async () => {
      const stats = dossier.statistics ?? (await sa.getStatistics(asset));
      if (!stats) return 'No statistics available for this asset.';
      const ref = ctx.addArtifact({
        kind: 'statistics',
        source: 'stockanalysis.com',
        title: `${asset.symbol} key statistics`,
        url: `https://stockanalysis.com${asset.saPath}/statistics/`,
        data: stats,
      });
      const body = stats.groups
        .map((g) => `${g.label}: ${g.summary}\n  ${g.metrics.map((m) => `${m.name}=${m.value}`).join(' | ')}`)
        .join('\n');
      return `[${ref}] ${asset.symbol} statistics:\n${body}`;
    },
  );

  def(
    'get_analyst_estimates',
    'Sell-side price targets, consensus rating history over the last 12 months, recent rating actions with each analyst\'s own track record, and forward revenue/EPS estimates.',
    obj({}),
    async () => {
      const view = dossier.analysts ?? (await sa.getAnalystView(asset));
      if (!view) return 'No analyst coverage data available.';
      const ref = ctx.addArtifact({
        kind: 'analysts',
        source: 'stockanalysis.com',
        title: `${asset.symbol} analyst estimates and targets`,
        url: `https://stockanalysis.com${asset.saPath}/forecast/`,
        data: view,
      });
      const lines = [
        `Targets: low ${view.targetLow ?? 'n/a'}, median ${view.targetMedian ?? 'n/a'}, average ${view.targetAverage ?? 'n/a'}, high ${view.targetHigh ?? 'n/a'} across ${view.targetCount ?? '?'} analysts (updated ${view.targetUpdated ?? 'n/a'}). Consensus: ${view.consensus ?? 'n/a'}.`,
        'Consensus history (oldest to newest):',
        ...view.history.slice(-8).map(
          (h) => `  ${h.date}: strongBuy ${h.strongBuy ?? 0}, buy ${h.buy ?? 0}, hold ${h.hold ?? 0}, sell ${h.sell ?? 0}, strongSell ${h.strongSell ?? 0} (score ${h.score?.toFixed(2) ?? 'n/a'})`,
        ),
        'Recent actions:',
        ...view.recentActions.slice(0, 10).map(
          (a) =>
            `  ${a.date} ${a.firm ?? '?'} (${a.analyst ?? '?'}): ${a.action ?? ''} ${a.ratingNew ?? ''}${a.ratingOld ? ` from ${a.ratingOld}` : ''}, target ${a.targetNew ?? 'n/a'}${a.targetOld ? ` from ${a.targetOld}` : ''}. Analyst hit rate ${a.analystSuccessRate ?? 'n/a'}%, avg return ${a.analystAvgReturn ?? 'n/a'}%`,
        ),
        'Forward estimates:',
        ...view.estimates.slice(-6).map(
          (e) =>
            `  ${e.fiscalYear ?? e.period}: revenue ${fmtMoney(num(e.revenue))} (growth ${e.revenueGrowth?.toFixed(1) ?? 'n/a'}%), EPS ${e.eps ?? 'n/a'} (growth ${e.epsGrowth?.toFixed(1) ?? 'n/a'}%), forward P/E ${e.forwardPe?.toFixed(1) ?? 'n/a'}, ${e.analysts ?? '?'} analysts`,
        ),
      ];
      return `[${ref}] ${lines.join('\n')}`;
    },
  );

  def(
    'get_company_profile',
    'Business description, sector and industry, headcount, CEO, the executive roster, fiscal calendar, and identifiers for the subject company.',
    obj({}),
    async () => {
      const profile = dossier.profile ?? (await sa.getCompanyProfile(asset));
      if (!profile) return 'No company profile available (this may be an ETF or crypto asset).';
      const ref = ctx.addArtifact({
        kind: 'profile',
        source: 'stockanalysis.com',
        title: `${asset.symbol} company profile`,
        url: `https://stockanalysis.com${asset.saPath}/company/`,
        data: profile,
      });
      return `[${ref}] ${profile.name} (${profile.symbol})
Sector: ${profile.sector ?? 'n/a'} | Industry: ${profile.industry ?? 'n/a'} | Country: ${profile.country ?? 'n/a'}
Founded ${profile.founded ?? 'n/a'}, IPO ${profile.ipoDate ?? 'n/a'}, employees ${profile.employees ?? 'n/a'}
CEO: ${profile.ceo ?? 'n/a'} | Fiscal year: ${profile.fiscalYear ?? 'n/a'} | SIC ${profile.sic ?? 'n/a'} | CIK ${profile.cik ?? 'n/a'}
Website: ${profile.website ?? 'n/a'}

Description: ${profile.description}

Executives:
${profile.executives.map((e) => `- ${e.name} — ${e.title}`).join('\n')}`;
    },
  );

  if (cik) {
    def(
      'list_sec_filings',
      'List the subject company\'s recent SEC filings. Use this to find the latest 10-K, 10-Q, 8-K, DEF 14A (proxy, for executive pay) or Form 4 (insider trades).',
      obj({
        forms: { type: 'array', items: { type: 'string' }, description: 'e.g. ["10-K","10-Q","8-K"]. Omit for all forms.' },
        limit: { type: 'integer', description: 'Default 15.' },
      }),
      async (args) => {
        const forms = Array.isArray(args.forms) && args.forms.length ? args.forms.map(String) : undefined;
        const filings = await sec.getFilings(cik, forms, Math.min(40, Number(args.limit) || 15));
        if (!filings.length) return 'No filings found for those form types.';
        const ref = ctx.addArtifact({
          kind: 'filings',
          source: 'SEC EDGAR',
          title: `${asset.symbol} filings ${forms?.join('/') ?? ''}`.trim(),
          url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}`,
          data: filings,
        });
        return `[${ref}] Filings:\n${filings
          .map((f) => `- ${f.form} filed ${f.filedAt}${f.reportDate ? ` (period ${f.reportDate})` : ''}: ${f.url}`)
          .join('\n')}`;
      },
    );

    def(
      'read_sec_filing',
      'Read a filing from EDGAR. For a 10-K or 10-Q you can request a specific item, which is the reliable way to read the risk factors or MD&A without blowing the context budget.',
      obj(
        {
          form: { type: 'string', description: 'Form type, e.g. 10-K, 10-Q, 8-K, DEF 14A.' },
          index: { type: 'integer', description: '0 for the most recent filing of that form, 1 for the one before, etc. Default 0.' },
          section: {
            type: 'string',
            description:
              'Optional item to extract: "risk factors", "mda", "business", "legal", "controls", or "list" to see which items were detected.',
          },
          maxChars: { type: 'integer', description: 'Default 18000.' },
        },
        ['form'],
      ),
      async (args) => {
        const form = String(args.form).toUpperCase();
        const index = Math.max(0, Number(args.index) || 0);
        const filings = await sec.getFilings(cik, [form], index + 1);
        const filing = filings[index];
        if (!filing) return `No ${form} filing found at index ${index}.`;

        const text = await sec.getFilingText(filing);
        if (!text) return `Could not retrieve the ${form} document at ${filing.url}.`;

        const budget = Math.min(45_000, Number(args.maxChars) || 18_000);
        const wanted = String(args.section ?? '').toLowerCase();
        let body = text;
        let label = `${form} filed ${filing.filedAt}`;

        if (wanted) {
          const sections = sec.extractFilingSections(text);
          const keys = Object.keys(sections);
          if (wanted === 'list') {
            return `[${form} ${filing.filedAt}] Detected items: ${keys.join(', ') || 'none — the document may be a wrapper or an exhibit'}. Full text is ${text.length} characters.`;
          }
          const alias: Record<string, string> = {
            'risk factors': 'Risk Factors',
            risks: 'Risk Factors',
            mda: 'MD&A',
            'md&a': 'MD&A',
            management: 'MD&A',
            business: 'Business',
            legal: 'Legal',
            controls: 'Controls',
            properties: 'Properties',
          };
          const needle = alias[wanted] ?? wanted;
          const match = keys.find((k) => k.toLowerCase().includes(needle.toLowerCase()));
          if (match) {
            body = sections[match];
            label = `${form} ${filing.filedAt} — ${match}`;
          } else {
            return `Item "${args.section}" not found in the ${form}. Detected items: ${keys.join(', ') || 'none'}. Call again with section="list" or omit section to read the whole document.`;
          }
        }

        const ref = ctx.addArtifact({
          kind: 'filing',
          source: 'SEC EDGAR',
          title: `${asset.symbol} ${label}`,
          url: filing.url,
          asOf: filing.filedAt,
          text: clampText(body, 120_000),
        });
        return `[${ref}] ${asset.symbol} ${label}\nSource: ${filing.url}\n\n${clampText(body, budget)}`;
      },
    );

    def(
      'get_reported_fundamentals',
      'Authoritative XBRL fundamentals straight from the company\'s SEC filings, as time series. Use this to verify any number that matters, or to build your own ratios and trends.',
      obj({
        concepts: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Optional subset, e.g. ["Revenues","NetIncomeLoss","OperatingCashFlow","CapEx","StockholdersEquity","SharesOutstanding","StockCompensation","LongTermDebt","Inventory","Receivables","DeferredRevenue","ShareBuybacks","Goodwill"]. Omit for all.',
        },
        periods: { type: 'integer', description: 'How many recent periods per concept. Default 10.' },
      }),
      async (args) => {
        const facts = dossier.secFacts ?? (await sec.getKeyFacts(cik));
        if (!facts) return 'No XBRL data available for this filer.';
        const wanted = Array.isArray(args.concepts) && args.concepts.length ? args.concepts.map(String) : null;
        const periods = Math.min(28, Number(args.periods) || 10);
        const entries = Object.entries(facts as Record<string, any[]>).filter(
          ([k]) => !wanted || wanted.some((w) => k.toLowerCase() === w.toLowerCase()),
        );
        if (!entries.length) return `No matching concepts. Available: ${Object.keys(facts).join(', ')}`;

        const ref = ctx.addArtifact({
          kind: 'xbrl',
          source: 'SEC XBRL',
          title: `${asset.symbol} reported fundamentals`,
          url: `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`,
          data: Object.fromEntries(entries),
        });
        const body = entries
          .map(([concept, series]) => {
            const rows = series
              .slice(-periods)
              .map(
                (p: any) =>
                  `${p.fiscalYear ?? ''}${p.fiscalPeriod ?? ''} ending ${p.end}: ${fmtMoney(num(p.value))} [${p.form}]`,
              )
              .join('; ');
            return `${concept}: ${rows}`;
          })
          .join('\n');
        return `[${ref}] ${asset.symbol} as-reported fundamentals (source: SEC XBRL):\n${body}`;
      },
    );

    def(
      'get_insider_activity',
      'Recent Form 4 insider transactions with the officer or director name, role, transaction code and size. Buying by operating executives is a stronger signal than selling, which is often scheduled.',
      obj({ limit: { type: 'integer', description: 'Number of Form 4 filings to parse. Default 12.' } }),
      async (args) => {
        const trades = await sec.getInsiderTrades(cik, Math.min(25, Number(args.limit) || 12));
        if (!trades.length) return 'No recent Form 4 filings parsed.';
        const ref = ctx.addArtifact({
          kind: 'insiders',
          source: 'SEC Form 4',
          title: `${asset.symbol} insider transactions`,
          data: trades,
        });
        return `[${ref}] Insider transactions (code A/P = acquired or purchased, D/S = disposed or sold, G = gift, M = option exercise):\n${trades
          .map(
            (t) =>
              `- ${t.filedAt} ${t.owner} (${t.role ?? 'n/a'}): ${t.transactionType ?? '?'} ${t.shares?.toLocaleString() ?? '?'} shares${t.pricePerShare ? ` at ${t.pricePerShare}` : ''}${t.value ? `, value ${fmtMoney(t.value)}` : ''}, holding ${t.sharesOwnedAfter?.toLocaleString() ?? '?'} after`,
          )
          .join('\n')}`;
      },
    );

    def(
      'search_filings_fulltext',
      'Full-text search across EDGAR filing bodies. Use it to find where a specific topic, customer, product or risk is discussed — across this company or its whole industry.',
      obj(
        {
          query: { type: 'string', description: 'Use quotes for exact phrases, e.g. "\\"export license\\" China".' },
          entity: { type: 'string', description: 'Optional ticker or company name to restrict to one filer.' },
          forms: { type: 'array', items: { type: 'string' }, description: 'e.g. ["10-K","8-K"].' },
          dateFrom: { type: 'string', description: 'YYYY-MM-DD.' },
          limit: { type: 'integer' },
        },
        ['query'],
      ),
      async (args) => {
        const hits = await sec.fullTextSearch(String(args.query), {
          entity: args.entity ? String(args.entity) : undefined,
          forms: Array.isArray(args.forms) && args.forms.length ? args.forms.map(String) : undefined,
          dateFrom: args.dateFrom ? String(args.dateFrom) : undefined,
          limit: Math.min(25, Number(args.limit) || 10),
        });
        if (!hits.length) return 'No filings matched. EDGAR full-text search ANDs all terms, so try fewer or broader terms.';
        const ref = ctx.addArtifact({
          kind: 'filing-search',
          source: 'SEC EDGAR full-text search',
          title: `EDGAR search: ${args.query}`,
          data: hits,
        });
        return `[${ref}] ${hits.length} matches for ${args.query}:\n${hits
          .map((h) => `- ${h.form} ${h.filedAt} ${h.companyName}: ${h.url}`)
          .join('\n')}`;
      },
    );
  }

  def(
    'get_quant_report',
    'The full deterministic quantitative report for the subject: trend structure with statistical significance, momentum, GARCH volatility, return distribution, risk metrics, beta, support and resistance, and the Monte Carlo horizon forecast with probabilities. These numbers are computed in code, not estimated.',
    obj({}),
    async () => {
      if (!dossier.quantText) return 'The quantitative report is unavailable for this asset.';
      const ref = ctx.addArtifact({
        kind: 'quant',
        source: 'Northline quant engine',
        title: `${asset.symbol} quantitative report`,
        text: dossier.quantText,
        data: dossier.quant ?? undefined,
      });
      return `[${ref}]\n${dossier.quantText}`;
    },
  );

  def(
    'analyse_other_symbol',
    'Run the same quantitative engine on a different symbol — a peer, a benchmark or a supplier. Use it for relative strength and for checking whether a move is company-specific or sector-wide.',
    obj(
      {
        symbol: { type: 'string', description: 'Ticker or name, e.g. AMD, SMH, MSFT.' },
        horizon: { type: 'string', description: 'Horizon label like 1w, 1m, 3m. Defaults to the run horizon.' },
      },
      ['symbol'],
    ),
    async (args) => {
      const other = await resolveAsset(String(args.symbol));
      if (!other) return `Could not resolve "${args.symbol}".`;
      const bars =
        other.kind === 'crypto'
          ? await crypto.getCryptoHistory(other, 900)
          : await sa.getHistory(other, '5Y');
      if (bars.length < 60) return `Not enough price history for ${other.symbol}.`;
      const report = runQuantEngine({
        symbol: other.symbol,
        bars,
        horizonDays: args.horizon ? horizonToDays(String(args.horizon)) : dossier.quant?.forecast.horizonDays ?? 21,
        syntheticBars: other.kind === 'crypto',
      });
      const text = formatQuantReport(report);
      const ref = ctx.addArtifact({
        kind: 'quant',
        source: 'Northline quant engine',
        title: `${other.symbol} quantitative report`,
        text,
        data: report,
      });
      return `[${ref}]\n${clampText(text, 9000)}`;
    },
  );

  def(
    'compare_peers',
    'Side-by-side valuation and quality metrics for a set of tickers. Use it to judge whether the subject is cheap or expensive against its actual comparables rather than against a memory of typical multiples.',
    obj(
      {
        symbols: { type: 'array', items: { type: 'string' }, description: 'Up to 6 peer tickers.' },
      },
      ['symbols'],
    ),
    async (args) => {
      const symbols = (Array.isArray(args.symbols) ? args.symbols : []).map(String).slice(0, 6);
      if (!symbols.length) return 'Provide at least one peer symbol.';
      const rows: string[] = [];
      const collected: Record<string, unknown> = {};
      for (const symbol of symbols) {
        const peer = await resolveAsset(symbol);
        if (!peer) {
          rows.push(`${symbol}: could not resolve`);
          continue;
        }
        const stats = await sa.getStatistics(peer);
        if (!stats) {
          rows.push(`${peer.symbol}: no statistics`);
          continue;
        }
        collected[peer.symbol] = stats.flat;
        const pick = (k: string) => stats.flat[k] ?? 'n/a';
        rows.push(
          `${peer.symbol}: mktcap ${pick('Market Cap')}, P/E ${pick('PE Ratio')}, fwd P/E ${pick('Forward PE')}, P/S ${pick('PS Ratio')}, EV/EBITDA ${pick('EV/EBITDA')}, gross margin ${pick('Gross Margin')}, op margin ${pick('Operating Margin')}, ROIC ${pick('Return on Capital (ROIC)')}, rev growth ${pick('Revenue Growth (YoY)')}, D/E ${pick('Debt / Equity')}, 52w change ${pick('52-Week Price Change')}`,
        );
      }
      const ref = ctx.addArtifact({
        kind: 'peers',
        source: 'stockanalysis.com',
        title: `Peer comparison: ${symbols.join(', ')}`,
        data: collected,
      });
      return `[${ref}] Peer comparison:\n${rows.join('\n')}`;
    },
  );

  def(
    'compute_dcf',
    'Run a discounted cash flow model with explicit assumptions. The arithmetic is done in code, so state the assumptions you believe and read off the result. Run it more than once to build a scenario range.',
    obj(
      {
        baseFreeCashFlow: { type: 'number', description: 'Starting annual free cash flow in currency units (not millions).' },
        sharesOutstanding: { type: 'number' },
        netDebt: { type: 'number', description: 'Debt minus cash. Use a negative number for a net cash position.' },
        growthPath: {
          type: 'array',
          items: { type: 'number' },
          description: 'Growth rate per forecast year as decimals, e.g. [0.25,0.2,0.15,0.12,0.1,0.08,0.06,0.05,0.04,0.03].',
        },
        discountRate: { type: 'number', description: 'WACC or cost of equity as a decimal, e.g. 0.095.' },
        terminalGrowth: { type: 'number', description: 'Perpetual growth as a decimal, typically 0.02-0.03.' },
        scenarioName: { type: 'string' },
      },
      ['baseFreeCashFlow', 'sharesOutstanding', 'growthPath', 'discountRate', 'terminalGrowth'],
    ),
    async (args) => {
      const result = discountedCashFlow({
        baseFreeCashFlow: Number(args.baseFreeCashFlow),
        sharesOutstanding: Number(args.sharesOutstanding),
        netDebt: Number(args.netDebt) || 0,
        growthPath: (args.growthPath as number[]).map(Number),
        discountRate: Number(args.discountRate),
        terminalGrowth: Number(args.terminalGrowth),
      });
      if (!result) return 'Invalid inputs: the discount rate must exceed terminal growth and shares outstanding must be positive.';
      const spot = dossier.quant?.spot ?? dossier.quote?.price ?? null;
      const upside = spot ? ((result.fairValuePerShare - spot) / spot) * 100 : null;
      const ref = ctx.addArtifact({
        kind: 'valuation',
        source: 'Northline DCF',
        title: `DCF ${args.scenarioName ? `(${args.scenarioName})` : ''} for ${asset.symbol}`,
        data: result,
      });
      return `[${ref}] DCF${args.scenarioName ? ` — ${args.scenarioName}` : ''}
Fair value per share: ${result.fairValuePerShare.toFixed(2)}${upside !== null ? ` (${upside >= 0 ? '+' : ''}${upside.toFixed(1)}% vs spot ${spot!.toFixed(2)})` : ''}
Enterprise value ${fmtMoney(result.enterpriseValue)}, equity value ${fmtMoney(result.equityValue)}
Present value of explicit forecast ${fmtMoney(result.presentValueExplicit)}, terminal ${fmtMoney(result.presentValueTerminal)}
Terminal value is ${(result.terminalShare * 100).toFixed(0)}% of enterprise value${result.terminalShare > 0.75 ? ' — that is a high share, so the output is very sensitive to the discount rate and terminal growth' : ''}.
Projected FCF: ${result.projectedCashFlows.map((c) => `Y${c.year} ${fmtMoney(c.cashFlow)}`).join(', ')}`;
    },
  );

  def(
    'reverse_dcf',
    'Solve for the free cash flow growth rate the current market price already implies. This reframes valuation as "what would have to be true", which is more robust than a single fair-value estimate.',
    obj(
      {
        marketCap: { type: 'number' },
        baseFreeCashFlow: { type: 'number' },
        netDebt: { type: 'number', description: 'Negative for net cash.' },
        discountRate: { type: 'number' },
        terminalGrowth: { type: 'number' },
        years: { type: 'integer', description: 'Explicit forecast years, default 10.' },
      },
      ['marketCap', 'baseFreeCashFlow', 'discountRate', 'terminalGrowth'],
    ),
    async (args) => {
      const result = reverseDcfGrowth({
        marketCap: Number(args.marketCap),
        baseFreeCashFlow: Number(args.baseFreeCashFlow),
        netDebt: Number(args.netDebt) || 0,
        discountRate: Number(args.discountRate),
        terminalGrowth: Number(args.terminalGrowth),
        years: Number(args.years) || 10,
      });
      if (!Number.isFinite(result.impliedAnnualGrowth)) return 'Could not solve — check that free cash flow is positive and the discount rate exceeds terminal growth.';
      const ref = ctx.addArtifact({
        kind: 'valuation',
        source: 'Northline reverse DCF',
        title: `Reverse DCF for ${asset.symbol}`,
        data: result,
      });
      return `[${ref}] At the current price, the market is implying free cash flow growth of ${(result.impliedAnnualGrowth * 100).toFixed(1)}% per year for ${args.years || 10} years (then ${(Number(args.terminalGrowth) * 100).toFixed(1)}% in perpetuity, discounted at ${(Number(args.discountRate) * 100).toFixed(1)}%). Converged: ${result.converged}. Judge whether that growth is plausible given the business, the market size and the competition.`;
    },
  );

  def(
    'compute_multiples_and_sizing',
    'Two calculators: relative valuation from per-share metrics and multiples, and position sizing from an entry, stop and target (reward-to-risk, Kelly fraction, break-even win rate).',
    obj({
      multiples: {
        type: 'object',
        description: 'Optional. Fields: epsTtm, epsForward, salesPerShare, peerPe, historicalPe, peerEvSales.',
        additionalProperties: true,
      },
      sizing: {
        type: 'object',
        description: 'Optional. Fields: entryPrice, stopPrice, targetPrice, winProbability (0-1), riskBudget (default 0.01).',
        additionalProperties: true,
      },
    }),
    async (args) => {
      const out: string[] = [];
      if (args.multiples) {
        const m = multiplesValuation({
          epsTtm: num(args.multiples.epsTtm),
          epsForward: num(args.multiples.epsForward),
          salesPerShare: num(args.multiples.salesPerShare),
          peerPe: num(args.multiples.peerPe),
          historicalPe: num(args.multiples.historicalPe),
          peerEvSales: num(args.multiples.peerEvSales),
        });
        out.push(
          m
            ? `Multiples valuation: ${m.estimates.map((e) => `${e.basis} → ${e.impliedPrice.toFixed(2)}`).join('; ')}. Range ${m.low.toFixed(2)}–${m.high.toFixed(2)}, median ${m.median.toFixed(2)}.`
            : 'Multiples valuation: not enough inputs.',
        );
      }
      if (args.sizing) {
        const plan = positionPlan({
          entryPrice: Number(args.sizing.entryPrice),
          stopPrice: Number(args.sizing.stopPrice),
          targetPrice: Number(args.sizing.targetPrice),
          winProbability: Number(args.sizing.winProbability),
          riskBudget: num(args.sizing.riskBudget) ?? 0.01,
        });
        out.push(
          `Position plan: entry ${plan.entryPrice.toFixed(2)}, stop ${plan.stopPrice.toFixed(2)} (${plan.stopDistancePercent.toFixed(1)}% away), target ${plan.targetPrice.toFixed(2)} (${plan.targetDistancePercent.toFixed(1)}% away). Reward:risk ${plan.rewardToRisk.toFixed(2)}:1. Break-even win rate ${plan.breakEvenWinRate.toFixed(0)}%. Expectancy ${plan.expectancy.toFixed(2)}R. Full Kelly ${(plan.kellyFraction * 100).toFixed(1)}% of capital, recommended ${(plan.recommendedFraction * 100).toFixed(1)}%. Sizing to risk ${((num(args.sizing.riskBudget) ?? 0.01) * 100).toFixed(1)}% of capital implies a ${plan.sizeAsPercentOfCapital.toFixed(1)}% position.`,
        );
      }
      if (!out.length) return 'Provide a "multiples" object, a "sizing" object, or both.';
      const atrValue = dossier.quant?.levels.atr14;
      if (atrValue && dossier.quant) {
        out.push(
          `For reference, a 2×ATR stop from spot ${dossier.quant.spot.toFixed(2)} sits at ${atrStop({ entryPrice: dossier.quant.spot, atr: atrValue, direction: 'long' }).toFixed(2)} for a long and ${atrStop({ entryPrice: dossier.quant.spot, atr: atrValue, direction: 'short' }).toFixed(2)} for a short.`,
        );
      }
      const ref = ctx.addArtifact({
        kind: 'calculation',
        source: 'Northline calculators',
        title: `Valuation and sizing calculation for ${asset.symbol}`,
        data: { args, output: out },
      });
      return `[${ref}] ${out.join('\n')}`;
    },
  );

  def(
    'get_macro_context',
    'Cross-asset macro state: the Treasury yield curve with recent changes, the VIX regime and its percentile, and the trend in equity, credit, dollar, commodity and sector proxies.',
    obj({}),
    async () => {
      const snapshot = dossier.macro ?? (await macro.getMacroSnapshot());
      const ref = ctx.addArtifact({
        kind: 'macro',
        source: 'US Treasury, CBOE, ETF proxies',
        title: 'Macro and cross-asset snapshot',
        data: snapshot,
      });
      const yc = snapshot.yieldCurve;
      const lines = [
        yc
          ? `Yield curve ${yc.date}: ${Object.entries(yc.yields).map(([k, v]) => `${k} ${v}%`).join(', ')}. 2s10s ${yc.spread2s10s?.toFixed(2)}pp, 3m10y ${yc.spread3m10y?.toFixed(2)}pp, ${yc.inverted ? 'INVERTED' : 'positively sloped'}. 10y moved ${yc.change10yBp1m?.toFixed(0)}bp and 2y ${yc.change2yBp1m?.toFixed(0)}bp over the past month.`
          : 'Yield curve unavailable.',
        snapshot.vix
          ? `VIX ${snapshot.vix.last?.toFixed(2)} (${snapshot.vix.regime}), ${snapshot.vix.percentile1y?.toFixed(0)}th percentile of the past year, ${snapshot.vix.change5d?.toFixed(1)}% over 5 days.`
          : 'VIX unavailable.',
        'Cross-asset trend (percent change):',
        ...snapshot.proxies.map(
          (p) =>
            `  ${p.symbol} ${p.label} — 1w ${p.changePercent1w?.toFixed(1) ?? 'n/a'}%, 1m ${p.changePercent1m?.toFixed(1) ?? 'n/a'}%, 3m ${p.changePercent3m?.toFixed(1) ?? 'n/a'}%, 12m ${p.changePercent12m?.toFixed(1) ?? 'n/a'}%, vs 200dma ${p.vs200dma?.toFixed(1) ?? 'n/a'}% (${p.reads})`,
        ),
      ];
      return `[${ref}] ${lines.join('\n')}`;
    },
  );

  def(
    'wikipedia_background',
    'Encyclopaedic background on a company, person, technology or industry. Useful for history, founder background and structural context that news coverage assumes you already know.',
    obj({ topic: { type: 'string' }, full: { type: 'boolean', description: 'True for the full article.' } }, ['topic']),
    async (args) => {
      const topic = String(args.topic);
      const text = args.full ? await web.wikiArticle(topic, 16_000) : '';
      const summary = await web.wikiSummary(topic);
      if (!text && !summary) return `No Wikipedia entry found for "${topic}".`;
      const ref = ctx.addArtifact({
        kind: 'reference',
        source: 'Wikipedia',
        title: `Wikipedia: ${summary?.title ?? topic}`,
        url: summary?.url,
        text: text || summary?.extract,
      });
      return `[${ref}] ${summary?.title ?? topic}\n${text || summary?.extract}`;
    },
  );

  if (asset.kind === 'crypto') {
    def(
      'get_crypto_fundamentals',
      'Token fundamentals: supply schedule and dilution, market cap versus fully diluted valuation, exchange liquidity, developer activity, community size and all-time-high drawdown.',
      obj({}),
      async () => {
        const market = dossier.crypto ?? (await crypto.getCryptoMarket(asset));
        if (!market) return 'No token data available.';
        const context = await crypto.getCryptoContext();
        const ref = ctx.addArtifact({
          kind: 'crypto',
          source: 'CoinGecko',
          title: `${asset.symbol} token fundamentals`,
          data: { market, context },
        });
        const dilution =
          market.maxSupply && market.circulatingSupply
            ? `${(((market.maxSupply - market.circulatingSupply) / market.circulatingSupply) * 100).toFixed(1)}% of circulating supply still to be issued`
            : market.totalSupply && market.circulatingSupply
              ? `${(((market.totalSupply - market.circulatingSupply) / market.circulatingSupply) * 100).toFixed(1)}% of circulating supply not yet in circulation`
              : 'supply schedule unclear';
        return `[${ref}] ${market.name} (${market.symbol}), rank ${market.marketCapRank ?? 'n/a'}
Price ${market.price}, market cap ${fmtMoney(market.marketCap ?? null)}, FDV ${fmtMoney(market.fullyDilutedValuation ?? null)}, 24h volume ${fmtMoney(market.volume24h ?? null)}
Volume/market cap ${market.volume24h && market.marketCap ? ((market.volume24h / market.marketCap) * 100).toFixed(1) : 'n/a'}% — a liquidity and turnover gauge
Supply: circulating ${market.circulatingSupply?.toLocaleString() ?? 'n/a'}, total ${market.totalSupply?.toLocaleString() ?? 'n/a'}, max ${market.maxSupply?.toLocaleString() ?? 'none'} → ${dilution}
Performance: 24h ${market.change24h?.toFixed(1) ?? 'n/a'}%, 7d ${market.change7d?.toFixed(1) ?? 'n/a'}%, 30d ${market.change30d?.toFixed(1) ?? 'n/a'}%, 1y ${market.change1y?.toFixed(1) ?? 'n/a'}%
All-time high ${market.ath ?? 'n/a'} on ${market.athDate?.slice(0, 10) ?? 'n/a'}, currently ${market.athChangePercent?.toFixed(1) ?? 'n/a'}% below it
Categories: ${market.categories.slice(0, 8).join(', ') || 'n/a'}
Developer activity: ${JSON.stringify(market.developer ?? {}).slice(0, 400)}
Top venues: ${(market.tickers ?? []).map((t) => `${t.market} ${fmtMoney(t.volume)}`).join(', ')}
Market context: ${JSON.stringify(context ?? {}).slice(0, 600)}
Description: ${market.description.slice(0, 1500)}`;
      },
    );
  }

  return tools;
}
