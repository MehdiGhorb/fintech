/* Focused checks for the pieces that needed fixing. npx tsx scripts/smoke2.ts */
import { resolveAsset } from '../lib/sources/resolve';
import * as sa from '../lib/sources/stockanalysis';
import * as sec from '../lib/sources/sec';
import * as macro from '../lib/sources/macro';
import { search } from '../lib/sources/web';

function head(s: string) {
  console.log(`\n${'='.repeat(66)}\n${s}\n${'='.repeat(66)}`);
}

async function main() {
  const asset = (await resolveAsset('NVDA'))!;

  head('QUARTERLY INCOME STATEMENT');
  const q = await sa.getFinancials(asset, 'income-statement', 'quarterly');
  console.log('statements:', q.map((s) => `${s.statement} rows=${s.rows.length} cols=${s.periods.length}`));
  console.log('periods:', q[0]?.periods.slice(0, 6));
  for (const r of (q[0]?.rows ?? []).slice(0, 6)) {
    console.log(`  ${r.label.padEnd(26)} ${r.values.slice(0, 5).join(', ')}`);
  }

  head('BALANCE SHEET (annual)');
  const bs = await sa.getFinancials(asset, 'balance-sheet', 'annual');
  console.log('periods:', bs[0]?.periods);
  for (const r of (bs[0]?.rows ?? []).slice(0, 6)) {
    console.log(`  ${r.label.padEnd(26)} ${r.values.slice(0, 4).join(', ')}`);
  }

  head('CASH FLOW (annual)');
  const cf = await sa.getFinancials(asset, 'cash-flow-statement', 'annual');
  console.log('rows:', cf[0]?.rows.slice(0, 5).map((r) => r.label));

  head('TTM METRICS');
  const ttm = await sa.getTtmMetrics(asset);
  console.log(Object.entries(ttm ?? {}).slice(0, 20));

  head('10-K TEXT + SECTIONS');
  const tenKs = await sec.getFilings('0001045810', ['10-K'], 1);
  console.log('filing:', tenKs[0]?.form, tenKs[0]?.filedAt, tenKs[0]?.url);
  if (tenKs[0]) {
    const text = await sec.getFilingText(tenKs[0]);
    console.log('length:', text.length);
    const sections = sec.extractFilingSections(text);
    for (const [k, v] of Object.entries(sections)) console.log(`  ${k.padEnd(34)} ${v.length} chars`);
    const risk = sections['Item 1A — Risk Factors'];
    if (risk) console.log('\nRisk factors excerpt:\n', risk.slice(0, 500));
  }

  head('YIELD CURVE');
  const snap = await macro.getMacroSnapshot(['SPY']);
  console.log(JSON.stringify(snap.yieldCurve, null, 1));

  head('WEB SEARCH (en-US)');
  const results = await search('NVIDIA data center revenue guidance analysis', 6);
  results.forEach((r) => console.log(` - ${r.title.slice(0, 78)}\n   ${r.url.slice(0, 95)}`));

  head('EDGAR FULL-TEXT SEARCH');
  const hits = await sec.fullTextSearch('"export license" China data center', { forms: ['10-Q'], limit: 4 });
  hits.forEach((h) => console.log(` - ${h.form} ${h.filedAt} ${h.companyName?.slice(0, 40)}`));
}

main().catch((e) => {
  console.error('FAILED', e);
  process.exit(1);
});
