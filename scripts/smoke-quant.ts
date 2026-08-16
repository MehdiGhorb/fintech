/* Validates the quant engine on live data. npx tsx scripts/smoke-quant.ts NVDA 1m */
import { resolveAsset } from '../lib/sources/resolve';
import { getHistory } from '../lib/sources/stockanalysis';
import { getCryptoHistory } from '../lib/sources/crypto';
import { getProxyBars } from '../lib/sources/macro';
import { formatQuantReport, runQuantEngine } from '../lib/quant/engine';
import { horizonToDays } from '../lib/quant/forecast';
import { discountedCashFlow, reverseDcfGrowth, multiplesValuation, qualityFlags } from '../lib/quant/valuation';
import { positionPlan, atrStop } from '../lib/quant/risk';

async function main() {
  const query = process.argv[2] || 'NVDA';
  const horizon = process.argv[3] || '1m';
  const asset = await resolveAsset(query);
  if (!asset) throw new Error('could not resolve');
  console.log('asset:', asset);

  const isCrypto = asset.kind === 'crypto';
  const bars = isCrypto ? await getCryptoHistory(asset, 1200) : await getHistory(asset, '10Y');
  console.log(`bars: ${bars.length}`);

  const [spy, qqq, tlt] = await Promise.all([getProxyBars('SPY'), getProxyBars('QQQ'), getProxyBars('TLT')]);

  const report = runQuantEngine({
    symbol: asset.symbol,
    bars,
    horizonDays: horizonToDays(horizon),
    benchmarkBars: spy,
    peerSeries: [
      { symbol: 'SPY', bars: spy },
      { symbol: 'QQQ', bars: qqq },
      { symbol: 'TLT', bars: tlt },
    ],
    syntheticBars: isCrypto,
  });

  console.log('\n' + formatQuantReport(report));

  console.log('\n\n===== VALUATION SANITY =====');
  const dcf = discountedCashFlow({
    baseFreeCashFlow: 72_064_000_000,
    sharesOutstanding: 24_220_000_000,
    netDebt: -40_360_000_000,
    growthPath: [0.35, 0.28, 0.22, 0.17, 0.13, 0.1, 0.08, 0.06, 0.05, 0.04],
    discountRate: 0.095,
    terminalGrowth: 0.03,
  });
  console.log('DCF fair value/share:', dcf?.fairValuePerShare.toFixed(2), '| terminal share of EV:', dcf?.terminalShare.toFixed(3));

  const rev = reverseDcfGrowth({
    marketCap: 5_450_000_000_000,
    baseFreeCashFlow: 119_080_000_000,
    netDebt: -40_360_000_000,
    discountRate: 0.095,
    terminalGrowth: 0.03,
  });
  console.log('reverse DCF implied 10y FCF growth:', (rev.impliedAnnualGrowth * 100).toFixed(1) + '%', 'converged:', rev.converged);

  console.log('multiples:', multiplesValuation({ epsTtm: 6.53, epsForward: 9.97, peerPe: 28, historicalPe: 45 }));
  const q = qualityFlags({
    netIncome: 159_610_000_000, operatingCashFlow: 125_650_000_000,
    totalAssets: 200_000_000_000, priorTotalAssets: 160_000_000_000,
    priorNetIncome: 100_000_000_000, grossMargin: 74.15, priorGrossMargin: 75.0,
    longTermDebt: 8_000_000_000, priorLongTermDebt: 8_500_000_000,
    currentRatio: 3.44, priorCurrentRatio: 4.1,
    sharesOutstanding: 24_220_000_000, priorSharesOutstanding: 24_490_000_000,
  });
  console.log('quality score:', `${q.score}/${q.maxScore}`, q.flags.map((f) => `${f.test}=${f.pass}`).join(' | '));

  console.log('\n===== POSITION SIZING =====');
  const stop = atrStop({ entryPrice: report.spot, atr: report.levels.atr14 ?? 0, direction: 'long', multiple: 2 });
  const plan = positionPlan({
    entryPrice: report.spot,
    stopPrice: stop,
    targetPrice: report.forecast.quantiles.p75,
    winProbability: report.forecast.probUp / 100,
  });
  console.log(JSON.stringify(plan, null, 1));
}

main().catch((e) => {
  console.error('FAILED', e);
  process.exit(1);
});
