import { formatQuantReport, runQuantEngine } from '../quant/engine';
import type { QuantReport } from '../quant/engine';
import { getCryptoHistory, getCryptoMarket } from '../sources/crypto';
import { getMacroSnapshot, getProxyBars } from '../sources/macro';
import { getNews } from '../sources/news';
import { getInsiderTrades, getFilings, getKeyFacts } from '../sources/sec';
import {
  getAnalystView,
  getCompanyProfile,
  getFinancials,
  getHistory,
  getIndustryPeers,
  getQuote,
  getStatistics,
  getTtmMetrics,
} from '../sources/stockanalysis';
import type { AssetRef, Bar } from '../sources/types';
import type { AnalysisSpec, Dossier, RunContext } from './context';

async function settled<T>(label: string, ctx: RunContext, work: Promise<T>, fallback: T): Promise<T> {
  try {
    return await work;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    ctx.emit({ type: 'warning', message: `${label} failed: ${message}` });
    return fallback;
  }
}

function emptyQuant(symbol: string): { quant: QuantReport | null; quantText: string } {
  return { quant: null, quantText: `Quantitative engine could not run for ${symbol}.` };
}

/**
 * Assembles the research file: prices, statements, filings, news, macro and the
 * deterministic quant pack. Failures are isolated so a down source does not kill the run.
 */
export async function buildDossier(ctx: RunContext, spec: AnalysisSpec): Promise<Dossier> {
  const asset = spec.primary;
  const isCrypto = asset.kind === 'crypto';
  ctx.emit({ type: 'agent-thought', agent: 'dossier', message: `Gathering a research file on ${asset.symbol}` });

  const quoteP = settled('quote', ctx, getQuote(asset), null);
  const barsP = settled(
    'history',
    ctx,
    isCrypto ? getCryptoHistory(asset, 1400) : getHistory(asset, '10Y'),
    [] as Bar[],
  );
  const profileP = isCrypto ? Promise.resolve(null) : settled('profile', ctx, getCompanyProfile(asset), null);
  const statsP = isCrypto ? Promise.resolve(null) : settled('statistics', ctx, getStatistics(asset), null);
  const finP = isCrypto
    ? Promise.resolve([])
    : settled('annual financials', ctx, getFinancials(asset, '', 'annual'), []);
  const qFinP = isCrypto
    ? Promise.resolve([])
    : settled('quarterly income', ctx, getFinancials(asset, 'income-statement', 'quarterly'), []);
  const ttmP = isCrypto ? Promise.resolve(null) : settled('ttm metrics', ctx, getTtmMetrics(asset), null);
  const analystsP = isCrypto ? Promise.resolve(null) : settled('analysts', ctx, getAnalystView(asset), null);
  const newsP = settled('news', ctx, getNews(asset, 18, spec.horizonDays <= 10 ? '14d' : '60d'), []);
  const macroP = settled('macro', ctx, getMacroSnapshot(), null);
  const cryptoP = isCrypto ? settled('token', ctx, getCryptoMarket(asset), null) : Promise.resolve(null);
  const spyP = settled('SPY', ctx, getProxyBars('SPY', '10Y'), [] as Bar[]);
  const qqqP = settled('QQQ', ctx, getProxyBars('QQQ', '5Y'), [] as Bar[]);
  const tltP = settled('TLT', ctx, getProxyBars('TLT', '5Y'), [] as Bar[]);

  const [quote, bars, profile, statistics, financials, quarterlyFinancials, ttmMetrics, analysts, news, macro, crypto, spy, qqq, tlt] =
    await Promise.all([
      quoteP, barsP, profileP, statsP, finP, qFinP, ttmP, analystsP, newsP, macroP, cryptoP, spyP, qqqP, tltP,
    ]);

  if (profile?.cik && !asset.cik) asset.cik = profile.cik;

  const cik = asset.cik || profile?.cik || null;
  const [secFacts, filings, insiders] = cik
    ? await Promise.all([
        settled('XBRL', ctx, getKeyFacts(cik), null),
        settled('filings', ctx, getFilings(cik, ['10-K', '10-Q', '8-K', 'DEF 14A', '4'], 18), []),
        settled('insiders', ctx, getInsiderTrades(cik, 10), []),
      ])
    : [null, [], []];

  const peers = profile?.industry
    ? await settled('peers', ctx, getIndustryPeers(profile.industry, 15), [])
    : [];

  let quant: QuantReport | null = null;
  let quantText = '';
  if (bars.length >= 60) {
    try {
      quant = runQuantEngine({
        symbol: asset.symbol,
        bars,
        horizonDays: spec.horizonDays,
        benchmarkBars: spy.length >= 60 ? spy : undefined,
        peerSeries: [
          spy.length >= 60 ? { symbol: 'SPY', bars: spy } : null,
          qqq.length >= 60 ? { symbol: 'QQQ', bars: qqq } : null,
          tlt.length >= 60 ? { symbol: 'TLT', bars: tlt } : null,
        ].filter(Boolean) as Array<{ symbol: string; bars: Bar[] }>,
        syntheticBars: isCrypto,
      });
      quantText = formatQuantReport(quant);
    } catch (err) {
      const fallback = emptyQuant(asset.symbol);
      quantText = `${fallback.quantText} ${err instanceof Error ? err.message : ''}`;
      ctx.emit({ type: 'warning', message: quantText });
    }
  } else {
    quantText = `Only ${bars.length} price bars — the quantitative engine needs 60.`;
    ctx.emit({ type: 'warning', message: quantText });
  }

  const dossier: Dossier = {
    asset,
    quote,
    bars,
    quant,
    quantText,
    profile,
    statistics,
    financials,
    quarterlyFinancials,
    ttmMetrics,
    analysts,
    news,
    macro,
    crypto,
    secFacts,
    filings: filings.map((f) => ({ form: f.form, filedAt: f.filedAt, url: f.url })),
    insiders: insiders as unknown as Array<Record<string, unknown>>,
    peers,
    syntheticBars: isCrypto,
  };

  ctx.addArtifact({
    kind: 'dossier',
    source: 'Northline intake',
    title: `Research file for ${asset.symbol}`,
    data: {
      symbol: asset.symbol,
      kind: asset.kind,
      price: quote?.price,
      bars: bars.length,
      hasQuant: Boolean(quant),
      filings: filings.length,
      news: news.length,
    },
  });
  if (quantText) {
    ctx.addArtifact({
      kind: 'quant',
      source: 'Northline quant engine',
      title: `${asset.symbol} quantitative report`,
      text: quantText,
      data: quant ?? undefined,
    });
  }

  ctx.emit({
    type: 'agent-thought',
    agent: 'dossier',
    message: `${asset.symbol}: ${bars.length} bars, ${filings.length} filings, ${news.length} headlines, quant ${quant ? 'ready' : 'unavailable'}`,
  });

  return dossier;
}
