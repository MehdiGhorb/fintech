/* Live smoke test of the data + quant layers. Run with: npx tsx scripts/smoke.ts NVDA */
import { resolveAsset } from '../lib/sources/resolve';
import * as sa from '../lib/sources/stockanalysis';
import * as sec from '../lib/sources/sec';
import * as news from '../lib/sources/news';
import * as macro from '../lib/sources/macro';
import * as crypto from '../lib/sources/crypto';
import { search as webSearch, readPage } from '../lib/sources/web';

const q = process.argv[2] || 'NVDA';

function head(label: string) {
  console.log(`\n${'='.repeat(70)}\n${label}\n${'='.repeat(70)}`);
}
function show(label: string, value: unknown, chars = 700) {
  const s = typeof value === 'string' ? value : JSON.stringify(value);
  console.log(`• ${label}: ${s === undefined ? 'undefined' : s.slice(0, chars)}`);
}

async function main() {
  head(`RESOLVE "${q}"`);
  const asset = await resolveAsset(q);
  show('asset', asset);
  if (!asset) return;

  if (asset.kind === 'crypto') {
    head('CRYPTO');
    show('market', await crypto.getCryptoMarket(asset));
    const bars = await crypto.getCryptoHistory(asset, 400);
    show('bars', `${bars.length} bars, last=${JSON.stringify(bars.at(-1))}`);
  } else {
    head('QUOTE / HISTORY');
    show('quote', await sa.getQuote(asset));
    const bars = await sa.getHistory(asset, '5Y');
    show('bars', `${bars.length} bars, first=${bars[0]?.date} last=${JSON.stringify(bars.at(-1))}`);

    head('STATISTICS');
    const stats = await sa.getStatistics(asset);
    show('groups', stats?.groups.map((g) => `${g.label}(${g.metrics.length})`));
    show('flat sample', Object.entries(stats?.flat ?? {}).slice(0, 14));

    head('PROFILE');
    const profile = await sa.getCompanyProfile(asset);
    show('profile', { ...profile, description: profile?.description.slice(0, 160) });

    head('FINANCIALS (annual overview)');
    const fin = await sa.getFinancials(asset, '', 'annual');
    show('statements', fin.map((f) => `${f.statement}: ${f.rows.length} rows / ${f.periods.length} periods`));
    show('periods', fin[0]?.periods);
    show('rows', fin[0]?.rows.slice(0, 4));

    head('FINANCIALS (quarterly income)');
    const qfin = await sa.getFinancials(asset, 'income-statement', 'quarterly');
    show('periods', qfin[0]?.periods);
    show('rows', qfin[0]?.rows.slice(0, 3));

    head('ANALYSTS');
    const av = await sa.getAnalystView(asset);
    show('targets', {
      low: av?.targetLow, high: av?.targetHigh, median: av?.targetMedian,
      avg: av?.targetAverage, n: av?.targetCount, consensus: av?.consensus,
    });
    show('history tail', av?.history.slice(-2));
    show('actions', av?.recentActions.slice(0, 2));
    show('estimates', av?.estimates.slice(0, 3));

    head('SEC');
    const cik = asset.cik || profile?.cik;
    show('cik', cik);
    if (cik) {
      const filings = await sec.getFilings(cik, ['10-K', '10-Q', '8-K'], 6);
      show('filings', filings.map((f) => `${f.form} ${f.filedAt}`));
      const facts = await sec.getKeyFacts(cik);
      show('fact keys', Object.keys(facts ?? {}));
      show('Revenues', facts?.Revenues?.slice(-2));
      show('NetIncomeLoss', facts?.NetIncomeLoss?.slice(-2));
      const insiders = await sec.getInsiderTrades(cik, 5);
      show('insiders', insiders.slice(0, 3));
      if (filings[0]) {
        const text = await sec.getFilingText(filings[0]);
        show('filing text len', text.length);
        show('filing head', text.slice(0, 240));
        const items = await sec.extractFilingSections(text);
        show('sections', Object.entries(items).map(([k, v]) => `${k}:${v.length}`));
      }
    }
  }

  head('NEWS');
  const items = await news.getNews(asset, 10);
  show('count', items.length);
  items.slice(0, 5).forEach((n) => console.log(`   - [${n.source ?? '?'}] ${n.title.slice(0, 90)}`));

  head('WEB SEARCH');
  const results = await webSearch(`${asset.name} outlook analysis`, 5);
  results.forEach((r) => console.log(`   - ${r.title.slice(0, 80)} :: ${r.url.slice(0, 80)}`));
  if (results[0]) {
    const page = await readPage(results[0].url);
    show('page title', page.title);
    show('page text len', page.text.length);
    show('page head', page.text.slice(0, 200));
  }

  head('MACRO');
  const m = await macro.getMacroSnapshot();
  show('vix', m.vix);
  show('proxies', m.proxies.map((p) => `${p.symbol} ${p.changePercent1m?.toFixed(2)}%`));
  show('yieldCurve', m.yieldCurve);
}

main().catch((e) => {
  console.error('FAILED', e);
  process.exit(1);
});
