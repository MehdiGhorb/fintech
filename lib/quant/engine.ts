import type { Bar } from '../sources/types';
import * as ind from './indicators';
import { simulateHorizon, shrinkDrift, analyticProbAbove, type ForecastResult } from './forecast';
import { computeBeta, correlationMatrix, riskMetrics, type BetaResult, type RiskMetrics } from './risk';
import { autocorrelation, hurstExponent, kurtosis, linearRegression, mean, quantile, skewness, stdev } from './stats';
import { logReturns, TRADING_DAYS, volProfile, type VolProfile } from './vol';

export interface TrendRead {
  /** Position relative to key moving averages. */
  price: number;
  sma20: number | null;
  sma50: number | null;
  sma100: number | null;
  sma200: number | null;
  vs20Percent: number | null;
  vs50Percent: number | null;
  vs200Percent: number | null;
  goldenCross: boolean | null;
  /** Slope of a log-price regression over 63 days, annualised. */
  regressionSlopeAnnualPercent: number;
  regressionR2: number;
  regressionTStat: number;
  /** Whether the trend is statistically distinguishable from noise. */
  trendSignificant: boolean;
  structure: 'uptrend' | 'downtrend' | 'range';
  adx: number | null;
  adxRead: string;
  hurst: number;
  hurstRead: string;
  lag1Autocorrelation: number;
  meanReversionRead: string;
}

export interface MomentumRead {
  rsi14: number | null;
  rsiRead: string;
  macd: number | null;
  macdSignal: number | null;
  macdHistogram: number | null;
  macdRead: string;
  stochasticK: number | null;
  percentB: number | null;
  bandwidth: number | null;
  bandwidthPercentile: number;
  return1w: number | null;
  return1m: number | null;
  return3m: number | null;
  return6m: number | null;
  return12m: number | null;
  /** 12-month return excluding the last month, the classic momentum factor. */
  momentum12m1m: number | null;
  distanceFrom52wHighPercent: number | null;
  distanceFrom52wLowPercent: number | null;
  volumeTrendPercent: number | null;
  obvSlope: number;
}

export interface DistributionRead {
  observations: number;
  annualisedVolPercent: number;
  skewness: number;
  excessKurtosis: number;
  fatTailNote: string;
  dailyQuantilesPercent: Record<string, number>;
  /** Largest single-day moves in the sample, to calibrate tail expectations. */
  worstDaysPercent: number[];
  bestDaysPercent: number[];
  gapRiskNote: string;
}

export interface SeasonalityRead {
  byMonth: Array<{ month: string; averageReturnPercent: number; positiveShare: number; samples: number }>;
  currentMonthNote: string;
}

export interface QuantReport {
  symbol: string;
  asOf: string;
  barsAnalysed: number;
  firstDate: string;
  lastDate: string;
  spot: number;
  trend: TrendRead;
  momentum: MomentumRead;
  volatility: VolProfile;
  distribution: DistributionRead;
  risk: RiskMetrics;
  beta: BetaResult | null;
  correlations: Array<{ symbol: string; correlation: number; beta: number | null }>;
  levels: {
    supportResistance: ind.SupportResistance[];
    volumeProfile: Array<{ price: number; volumeShare: number }>;
    fibonacci: Array<{ label: string; price: number }>;
    atr14: number | null;
    atrPercent: number | null;
    drawdown: { max: number; current: number };
  };
  seasonality: SeasonalityRead;
  forecast: ForecastResult;
  forecastCrossCheck: { analyticProbUpPercent: number; simulatedProbUpPercent: number; agreementNote: string };
  driftNote: string;
  caveats: string[];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function pct(bars: Bar[], lookback: number): number | null {
  if (bars.length <= lookback) return null;
  const now = bars[bars.length - 1].adjClose;
  const then = bars[bars.length - 1 - lookback].adjClose;
  return then ? ((now - then) / then) * 100 : null;
}

function last<T>(series: Array<T | null>): T | null {
  for (let i = series.length - 1; i >= 0; i--) {
    if (series[i] !== null && series[i] !== undefined) return series[i] as T;
  }
  return null;
}

function buildTrend(bars: Bar[], closes: number[]): TrendRead {
  const price = closes[closes.length - 1];
  const sma20 = last(ind.sma(closes, 20));
  const sma50 = last(ind.sma(closes, 50));
  const sma100 = last(ind.sma(closes, 100));
  const sma200 = last(ind.sma(closes, 200));

  const window = closes.slice(-63);
  const logs = window.map((c) => Math.log(c));
  const reg = linearRegression(
    logs.map((_, i) => i),
    logs,
  );
  const annualSlope = (Math.exp(reg.slope * TRADING_DAYS) - 1) * 100;
  const trendSignificant = Math.abs(reg.tStat) > 2;

  const adxSeries = ind.adx(bars, 14);
  const adxValue = last(adxSeries.map((a) => a.adx));
  const returns = logReturns(closes);
  const hurst = hurstExponent(returns.slice(-500));
  const lag1 = autocorrelation(returns.slice(-252), 1);

  const above50 = sma50 !== null && price > sma50;
  const above200 = sma200 !== null && price > sma200;
  const structure: TrendRead['structure'] =
    above50 && above200 && annualSlope > 0
      ? 'uptrend'
      : !above50 && !above200 && annualSlope < 0
        ? 'downtrend'
        : 'range';

  return {
    price,
    sma20,
    sma50,
    sma100,
    sma200,
    vs20Percent: sma20 ? ((price - sma20) / sma20) * 100 : null,
    vs50Percent: sma50 ? ((price - sma50) / sma50) * 100 : null,
    vs200Percent: sma200 ? ((price - sma200) / sma200) * 100 : null,
    goldenCross: sma50 !== null && sma200 !== null ? sma50 > sma200 : null,
    regressionSlopeAnnualPercent: annualSlope,
    regressionR2: reg.r2,
    regressionTStat: reg.tStat,
    trendSignificant,
    structure,
    adx: adxValue,
    adxRead:
      adxValue === null
        ? 'Not enough data for a trend-strength read.'
        : adxValue > 40
          ? 'Very strong directional trend; pullbacks tend to be shallow.'
          : adxValue > 25
            ? 'Established trend; trend-following entries have an edge here.'
            : adxValue > 20
              ? 'Emerging trend, not yet decisive.'
              : 'No trend. Range-trading and mean-reversion logic apply, breakout signals are unreliable.',
    hurst,
    hurstRead: Number.isFinite(hurst)
      ? hurst > 0.55
        ? `Hurst ${hurst.toFixed(2)} indicates persistence: moves tend to continue, so momentum entries are favoured.`
        : hurst < 0.45
          ? `Hurst ${hurst.toFixed(2)} indicates anti-persistence: moves tend to reverse, favouring fading extremes.`
          : `Hurst ${hurst.toFixed(2)} is close to a random walk, so neither momentum nor mean reversion has a structural edge.`
      : 'Insufficient history for a Hurst estimate.',
    lag1Autocorrelation: lag1,
    meanReversionRead: Number.isFinite(lag1)
      ? Math.abs(lag1) < 0.05
        ? 'Daily returns show almost no serial correlation, as expected for a liquid asset.'
        : lag1 < 0
          ? `Negative lag-1 autocorrelation (${lag1.toFixed(3)}): short-term reversal tendency.`
          : `Positive lag-1 autocorrelation (${lag1.toFixed(3)}): short-term follow-through tendency.`
      : 'Insufficient data.',
  };
}

function buildMomentum(bars: Bar[], closes: number[]): MomentumRead {
  const rsiValue = last(ind.rsi(closes, 14));
  const macdSeries = ind.macd(closes);
  const macdLast = macdSeries[macdSeries.length - 1];
  const bands = ind.bollinger(closes, 20, 2);
  const bandLast = bands[bands.length - 1];
  const bandwidths = bands.map((b) => b.bandwidth).filter((v): v is number => v !== null);
  const stoch = ind.stochastic(bars);
  const obvSeries = ind.obv(bars);

  const obvWindow = obvSeries.slice(-63);
  const obvReg = linearRegression(
    obvWindow.map((_, i) => i),
    obvWindow,
  );

  const r12 = pct(bars, 252);
  const r1 = pct(bars, 21);
  const recentVolume = mean(bars.slice(-21).map((b) => b.volume));
  const baseVolume = mean(bars.slice(-126, -21).map((b) => b.volume));

  const window52 = bars.slice(-252);
  const high52 = window52.length ? Math.max(...window52.map((b) => b.high)) : null;
  const low52 = window52.length ? Math.min(...window52.map((b) => b.low)) : null;
  const price = closes[closes.length - 1];

  return {
    rsi14: rsiValue,
    rsiRead:
      rsiValue === null
        ? 'No RSI available.'
        : rsiValue > 75
          ? 'Overbought. In strong trends RSI can stay stretched, so this is a caution on entry timing, not a sell signal.'
          : rsiValue > 60
            ? 'Firmly bullish momentum without being extreme.'
            : rsiValue > 45
              ? 'Neutral momentum.'
              : rsiValue > 30
                ? 'Weak momentum.'
                : 'Oversold. Bounces are common but oversold readings persist in downtrends.',
    macd: macdLast?.macd ?? null,
    macdSignal: macdLast?.signal ?? null,
    macdHistogram: macdLast?.histogram ?? null,
    macdRead:
      macdLast?.histogram == null
        ? 'No MACD available.'
        : macdLast.histogram > 0
          ? 'MACD above its signal line: momentum is positive.'
          : 'MACD below its signal line: momentum is negative.',
    stochasticK: last(stoch.map((s) => s.k)),
    percentB: bandLast?.percentB ?? null,
    bandwidth: bandLast?.bandwidth ?? null,
    bandwidthPercentile:
      bandLast?.bandwidth != null && bandwidths.length
        ? ind.percentileRank(bandwidths.slice(-504), bandLast.bandwidth)
        : NaN,
    return1w: pct(bars, 5),
    return1m: r1,
    return3m: pct(bars, 63),
    return6m: pct(bars, 126),
    return12m: r12,
    momentum12m1m: r12 !== null && r1 !== null ? r12 - r1 : null,
    distanceFrom52wHighPercent: high52 ? ((price - high52) / high52) * 100 : null,
    distanceFrom52wLowPercent: low52 ? ((price - low52) / low52) * 100 : null,
    volumeTrendPercent: baseVolume ? ((recentVolume - baseVolume) / baseVolume) * 100 : null,
    obvSlope: obvReg.slope,
  };
}

function buildDistribution(returns: number[]): DistributionRead {
  const pctReturns = returns.map((r) => (Math.exp(r) - 1) * 100);
  const sorted = [...pctReturns].sort((a, b) => a - b);
  const kurt = kurtosis(returns);

  return {
    observations: returns.length,
    annualisedVolPercent: stdev(returns) * Math.sqrt(TRADING_DAYS) * 100,
    skewness: skewness(returns),
    excessKurtosis: kurt,
    fatTailNote: Number.isFinite(kurt)
      ? kurt > 3
        ? `Excess kurtosis of ${kurt.toFixed(1)} means extreme days are far more common than a normal distribution implies. Any model assuming normality will understate tail risk, which is why the forecast bootstraps real residuals.`
        : `Excess kurtosis of ${kurt.toFixed(1)} is moderate; return tails are only somewhat heavier than normal.`
      : 'Insufficient data for a tail read.',
    dailyQuantilesPercent: {
      p1: quantile(pctReturns, 0.01),
      p5: quantile(pctReturns, 0.05),
      p25: quantile(pctReturns, 0.25),
      p50: quantile(pctReturns, 0.5),
      p75: quantile(pctReturns, 0.75),
      p95: quantile(pctReturns, 0.95),
      p99: quantile(pctReturns, 0.99),
    },
    worstDaysPercent: sorted.slice(0, 5),
    bestDaysPercent: sorted.slice(-5).reverse(),
    gapRiskNote:
      'Daily bars understate event risk: earnings and news gaps happen between sessions, so stops can fill well past their trigger.',
  };
}

function buildSeasonality(bars: Bar[]): SeasonalityRead {
  const buckets = new Map<number, number[]>();
  for (let i = 1; i < bars.length; i++) {
    const month = new Date(`${bars[i].date}T00:00:00Z`).getUTCMonth();
    const prev = bars[i - 1].adjClose;
    if (!prev) continue;
    const r = (bars[i].adjClose - prev) / prev;
    if (!buckets.has(month)) buckets.set(month, []);
    buckets.get(month)!.push(r);
  }

  const byMonth = MONTHS.map((label, m) => {
    const rs = buckets.get(m) ?? [];
    return {
      month: label,
      averageReturnPercent: rs.length ? mean(rs) * 21 * 100 : NaN,
      positiveShare: rs.length ? (rs.filter((r) => r > 0).length / rs.length) * 100 : NaN,
      samples: rs.length,
    };
  });

  const currentMonth = new Date().getUTCMonth();
  const current = byMonth[currentMonth];
  return {
    byMonth,
    currentMonthNote: Number.isFinite(current.averageReturnPercent)
      ? `${current.month} has averaged ${current.averageReturnPercent.toFixed(1)}% over the sample with ${current.positiveShare.toFixed(
          0,
        )}% of days positive. With only a few years of history this is weak evidence and should never drive a decision on its own.`
      : 'Not enough history for a seasonality read.',
  };
}

export interface EngineInput {
  symbol: string;
  bars: Bar[];
  horizonDays: number;
  /** Benchmark bars for beta, typically SPY. */
  benchmarkBars?: Bar[];
  /** Extra series for a correlation read. */
  peerSeries?: Array<{ symbol: string; bars: Bar[] }>;
  riskFreeRate?: number;
  /** Crypto daily bars are synthesised from closes, so range estimators are skipped. */
  syntheticBars?: boolean;
}

/**
 * Runs every deterministic computation the agents rely on. Nothing here calls a
 * model: the numbers are fixed inputs to the reasoning that follows.
 */
export function runQuantEngine(input: EngineInput): QuantReport {
  const bars = input.bars.filter((b) => b.close > 0);
  if (bars.length < 60) {
    throw new Error(`Only ${bars.length} price bars available for ${input.symbol}; need at least 60 for analysis.`);
  }

  const closes = bars.map((b) => b.adjClose);
  const returns = logReturns(closes);
  const spot = closes[closes.length - 1];

  const vol = volProfile(bars, returns);
  const drift = shrinkDrift(returns);
  const forecast = simulateHorizon({
    spot,
    returns,
    horizonDays: input.horizonDays,
    garch: vol.garch,
    annualDrift: drift.annualDrift,
  });

  const analyticProbUp = analyticProbAbove(
    spot,
    spot,
    drift.annualDrift,
    (vol.garch?.currentVol ?? vol.realized21d) || vol.realized252d,
    input.horizonDays,
  );

  const atrSeries = ind.atr(bars, 14);
  const atr14 = last(atrSeries);
  const dd = ind.drawdown(closes);

  const benchmarkReturns = input.benchmarkBars ? logReturns(input.benchmarkBars.map((b) => b.adjClose)) : null;

  const caveats: string[] = [];
  if (input.syntheticBars) {
    caveats.push(
      'Daily highs and lows were synthesised from consecutive closes, so range-based volatility estimators (Parkinson, Garman-Klass) and ATR are approximations.',
    );
  }
  if (!vol.garch?.converged) {
    caveats.push('The GARCH fit did not converge cleanly; the volatility forecast falls back to a simpler estimate.');
  }
  if (bars.length < 500) {
    caveats.push(`Only ${bars.length} bars of history are available, which limits regime and seasonality inference.`);
  }
  if (vol.garch && vol.garch.persistence > 0.99) {
    caveats.push(
      'GARCH persistence is near 1, meaning volatility shocks decay very slowly. Long-horizon variance estimates are unstable in this regime.',
    );
  }

  return {
    symbol: input.symbol,
    asOf: new Date().toISOString(),
    barsAnalysed: bars.length,
    firstDate: bars[0].date,
    lastDate: bars[bars.length - 1].date,
    spot,
    trend: buildTrend(bars, closes),
    momentum: buildMomentum(bars, closes),
    volatility: vol,
    distribution: buildDistribution(returns),
    risk: riskMetrics(returns, input.riskFreeRate ?? 0.04),
    beta: benchmarkReturns ? computeBeta(returns, benchmarkReturns) : null,
    correlations: input.peerSeries?.length
      ? correlationMatrix(
          returns,
          input.peerSeries.map((p) => ({ symbol: p.symbol, returns: logReturns(p.bars.map((b) => b.adjClose)) })),
        )
      : [],
    levels: {
      supportResistance: ind.supportResistance(bars.slice(-400)),
      volumeProfile: input.syntheticBars ? [] : ind.volumeProfile(bars.slice(-250)),
      fibonacci: ind.fibonacci(bars),
      atr14,
      atrPercent: atr14 && spot ? (atr14 / spot) * 100 : null,
      drawdown: { max: dd.max, current: dd.current },
    },
    seasonality: buildSeasonality(bars),
    forecast,
    forecastCrossCheck: {
      analyticProbUpPercent: analyticProbUp,
      simulatedProbUpPercent: forecast.probUp,
      agreementNote:
        Number.isFinite(analyticProbUp) && Math.abs(analyticProbUp - forecast.probUp) < 4
          ? 'The lognormal closed form and the bootstrap simulation agree, so the distribution is not being driven by a few outlier paths.'
          : 'The simulation differs from the lognormal closed form, which is expected when returns are skewed or fat-tailed; trust the simulation.',
    },
    driftNote: drift.note,
    caveats,
  };
}

/**
 * Condenses the report into the text an agent reads. Values are pre-formatted so
 * the model never has to do arithmetic or unit conversion.
 */
export function formatQuantReport(report: QuantReport): string {
  const n = (v: number | null | undefined, dp = 2, suffix = '') =>
    v === null || v === undefined || !Number.isFinite(v) ? 'n/a' : `${v.toFixed(dp)}${suffix}`;
  const t = report.trend;
  const m = report.momentum;
  const v = report.volatility;
  const f = report.forecast;
  const lines: string[] = [];

  lines.push(`QUANTITATIVE REPORT — ${report.symbol}`);
  lines.push(
    `Price ${n(report.spot)} | ${report.barsAnalysed} daily bars from ${report.firstDate} to ${report.lastDate}`,
  );

  lines.push('\n## Trend structure');
  lines.push(
    `Structure: ${t.structure}. Price vs SMA20 ${n(t.vs20Percent, 1, '%')}, vs SMA50 ${n(t.vs50Percent, 1, '%')}, vs SMA200 ${n(t.vs200Percent, 1, '%')}. Golden cross: ${t.goldenCross === null ? 'n/a' : t.goldenCross}.`,
  );
  lines.push(
    `63-day log-price regression: ${n(t.regressionSlopeAnnualPercent, 1, '%')} annualised, R²=${n(t.regressionR2)}, t=${n(t.regressionTStat)} → trend is ${t.trendSignificant ? 'statistically significant' : 'NOT statistically distinguishable from noise'}.`,
  );
  lines.push(`ADX ${n(t.adx, 1)}: ${t.adxRead}`);
  lines.push(t.hurstRead);
  lines.push(t.meanReversionRead);

  lines.push('\n## Momentum and positioning');
  lines.push(`RSI(14) ${n(m.rsi14, 1)}: ${m.rsiRead}`);
  lines.push(`MACD ${n(m.macd, 3)} vs signal ${n(m.macdSignal, 3)} (hist ${n(m.macdHistogram, 3)}): ${m.macdRead}`);
  lines.push(
    `Returns: 1w ${n(m.return1w, 1, '%')}, 1m ${n(m.return1m, 1, '%')}, 3m ${n(m.return3m, 1, '%')}, 6m ${n(m.return6m, 1, '%')}, 12m ${n(m.return12m, 1, '%')}. 12-1 momentum ${n(m.momentum12m1m, 1, '%')}.`,
  );
  lines.push(
    `Distance from 52w high ${n(m.distanceFrom52wHighPercent, 1, '%')}, from 52w low ${n(m.distanceFrom52wLowPercent, 1, '%')}. Bollinger %B ${n(m.percentB)}, bandwidth percentile ${n(m.bandwidthPercentile, 0, '%')}.`,
  );
  lines.push(
    `Volume last month vs prior 5 months: ${n(m.volumeTrendPercent, 1, '%')}. OBV slope ${m.obvSlope > 0 ? 'positive (accumulation)' : 'negative (distribution)'}.`,
  );

  lines.push('\n## Volatility');
  lines.push(
    `Annualised realised vol: 21d ${n(v.realized21d * 100, 1, '%')}, 63d ${n(v.realized63d * 100, 1, '%')}, 252d ${n(v.realized252d * 100, 1, '%')}. EWMA ${n(v.ewma * 100, 1, '%')}. Parkinson ${n(v.parkinson21d * 100, 1, '%')}.`,
  );
  lines.push(`Current 21d vol sits at the ${n(v.volPercentile, 0)}th percentile of its 3-year range. Regime: ${v.volRegime}. ${v.termStructureNote}`);
  if (v.garch) {
    lines.push(
      `GARCH(1,1): omega=${v.garch.omega.toExponential(2)}, alpha=${n(v.garch.alpha, 3)}, beta=${n(v.garch.beta, 3)}, persistence=${n(v.garch.persistence, 3)}. Conditional vol now ${n(v.garch.currentVol * 100, 1, '%')} versus long-run ${n(v.garch.longRunVol * 100, 1, '%')}.`,
    );
    lines.push(
      v.garch.currentVol > v.garch.longRunVol
        ? 'Conditional vol is above its long-run level, so the model expects volatility to decay toward the mean over the horizon.'
        : 'Conditional vol is below its long-run level, so the model expects volatility to drift higher over the horizon.',
    );
  }

  lines.push('\n## Return distribution');
  const d = report.distribution;
  lines.push(
    `Skewness ${n(d.skewness)}, excess kurtosis ${n(d.excessKurtosis, 1)}. ${d.fatTailNote}`,
  );
  lines.push(
    `Daily return quantiles: 1% ${n(d.dailyQuantilesPercent.p1, 1, '%')}, 5% ${n(d.dailyQuantilesPercent.p5, 1, '%')}, 50% ${n(d.dailyQuantilesPercent.p50, 2, '%')}, 95% ${n(d.dailyQuantilesPercent.p95, 1, '%')}, 99% ${n(d.dailyQuantilesPercent.p99, 1, '%')}.`,
  );
  lines.push(`Worst days in sample: ${d.worstDaysPercent.map((x) => `${x.toFixed(1)}%`).join(', ')}. ${d.gapRiskNote}`);

  lines.push('\n## Risk metrics (trailing, full sample)');
  const r = report.risk;
  lines.push(
    `Annualised return ${n(r.annualisedReturnPercent, 1, '%')}, vol ${n(r.annualisedVolPercent, 1, '%')}, Sharpe ${n(r.sharpe)}, Sortino ${n(r.sortino)}, Calmar ${n(r.calmar)}.`,
  );
  lines.push(
    `Max drawdown ${n(r.maxDrawdownPercent, 1, '%')} (current drawdown from peak ${n(report.levels.drawdown.current, 1, '%')}). Positive days ${n(r.positiveDayShare, 0, '%')}. Daily VaR95 ${n(r.var95DailyPercent, 2, '%')}, ES95 ${n(r.expectedShortfall95DailyPercent, 2, '%')}.`,
  );
  if (report.beta) {
    lines.push(
      `Beta to benchmark ${n(report.beta.beta)} (R²=${n(report.beta.r2)}), annualised alpha ${n(report.beta.alphaAnnualPercent, 1, '%')}, idiosyncratic share of variance ${n(report.beta.idiosyncraticSharePercent, 0, '%')}.`,
    );
  }
  if (report.correlations.length) {
    lines.push(
      `Correlations: ${report.correlations.slice(0, 8).map((c) => `${c.symbol} ${c.correlation.toFixed(2)}`).join(', ')}.`,
    );
  }

  lines.push('\n## Price levels');
  lines.push(`ATR(14) ${n(report.levels.atr14)} (${n(report.levels.atrPercent, 1, '%')} of price) — use this to scale stops.`);
  if (report.levels.supportResistance.length) {
    lines.push(
      `Key levels: ${report.levels.supportResistance
        .slice(0, 8)
        .map((l) => `${l.kind} ${l.level.toFixed(2)} (${l.touches} touches, ${l.distancePercent >= 0 ? '+' : ''}${l.distancePercent.toFixed(1)}%)`)
        .join('; ')}.`,
    );
  }
  if (report.levels.volumeProfile.length) {
    lines.push(
      `Highest-volume price zones: ${report.levels.volumeProfile.slice(0, 4).map((z) => `${z.price.toFixed(2)} (${z.volumeShare.toFixed(1)}% of volume)`).join(', ')}.`,
    );
  }

  lines.push(`\n## Horizon forecast (${f.horizonDays} trading days)`);
  lines.push(`Method: ${f.method} across ${f.paths.toLocaleString()} paths. ${report.driftNote}`);
  lines.push(
    `Probability of finishing above today's price: ${n(f.probUp, 1, '%')}. Expected return ${n(f.expectedReturnPercent, 2, '%')}, median outcome ${n(f.median)}.`,
  );
  lines.push(
    `Terminal price quantiles: 5% ${n(f.quantiles.p5)}, 25% ${n(f.quantiles.p25)}, 50% ${n(f.quantiles.p50)}, 75% ${n(f.quantiles.p75)}, 95% ${n(f.quantiles.p95)}.`,
  );
  lines.push(
    `Probability of closing at or above: ${f.probAbove.map((p) => `+${p.movePercent}% (${p.price.toFixed(2)}) ${p.probability.toFixed(1)}%`).join(', ')}.`,
  );
  lines.push(
    `Probability of closing at or below: ${f.probBelow.map((p) => `${p.movePercent}% (${p.price.toFixed(2)}) ${p.probability.toFixed(1)}%`).join(', ')}.`,
  );
  lines.push(
    `Probability of TOUCHING a level at any point (relevant for stops and limit orders): ${f.touchProbabilities.map((p) => `${p.movePercent > 0 ? '+' : ''}${p.movePercent}% ${p.probabilityTouch.toFixed(1)}%`).join(', ')}.`,
  );
  lines.push(
    `Horizon volatility ${n(f.horizonVolPercent, 1, '%')}. VaR95 over the horizon ${n(f.var95Percent, 1, '%')}, expected shortfall ${n(f.expectedShortfall95Percent, 1, '%')}. Average path max drawdown ${n(f.expectedMaxDrawdownPercent, 1, '%')}, max run-up ${n(f.expectedMaxRunupPercent, 1, '%')}.`,
  );
  lines.push(report.forecastCrossCheck.agreementNote);

  lines.push('\n## Seasonality');
  lines.push(report.seasonality.currentMonthNote);

  if (report.caveats.length) {
    lines.push('\n## Model caveats');
    for (const c of report.caveats) lines.push(`- ${c}`);
  }
  lines.push(
    '\nIMPORTANT: these probabilities describe the historical statistical process only. They contain no information about fundamentals, catalysts, or news. They are a baseline to be adjusted by judgement, not a forecast on their own.',
  );

  return lines.join('\n');
}
