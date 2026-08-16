import { correlation, linearRegression, mean, stdev } from './stats';
import { TRADING_DAYS } from './vol';

export interface BetaResult {
  beta: number;
  alphaAnnualPercent: number;
  r2: number;
  correlation: number;
  observations: number;
  /** Portion of variance not explained by the benchmark. */
  idiosyncraticSharePercent: number;
}

/** Regresses asset returns on benchmark returns. */
export function computeBeta(assetReturns: number[], benchmarkReturns: number[]): BetaResult | null {
  const n = Math.min(assetReturns.length, benchmarkReturns.length);
  if (n < 60) return null;
  const y = assetReturns.slice(-n);
  const x = benchmarkReturns.slice(-n);
  const reg = linearRegression(x, y);
  return {
    beta: reg.slope,
    alphaAnnualPercent: reg.intercept * TRADING_DAYS * 100,
    r2: reg.r2,
    correlation: correlation(x, y),
    observations: n,
    idiosyncraticSharePercent: (1 - reg.r2) * 100,
  };
}

export interface RiskMetrics {
  annualisedReturnPercent: number;
  annualisedVolPercent: number;
  sharpe: number;
  sortino: number;
  /** Return divided by the worst drawdown — how much pain per unit of gain. */
  calmar: number;
  maxDrawdownPercent: number;
  downsideDeviationPercent: number;
  bestDayPercent: number;
  worstDayPercent: number;
  positiveDayShare: number;
  var95DailyPercent: number;
  expectedShortfall95DailyPercent: number;
}

export function riskMetrics(returns: number[], riskFreeRate = 0.04): RiskMetrics {
  const annualReturn = mean(returns) * TRADING_DAYS;
  const annualVol = stdev(returns) * Math.sqrt(TRADING_DAYS);
  const downside = returns.filter((r) => r < 0);
  const downsideDev = downside.length ? Math.sqrt(mean(downside.map((r) => r * r))) * Math.sqrt(TRADING_DAYS) : NaN;

  let peak = 0;
  let cumulative = 0;
  let maxDd = 0;
  for (const r of returns) {
    cumulative += r;
    peak = Math.max(peak, cumulative);
    maxDd = Math.min(maxDd, cumulative - peak);
  }
  const maxDrawdownPercent = (Math.exp(maxDd) - 1) * 100;

  const sorted = [...returns].sort((a, b) => a - b);
  const varIndex = Math.max(0, Math.floor(sorted.length * 0.05) - 1);
  const var95 = sorted[varIndex] ?? sorted[0];
  const tail = sorted.slice(0, varIndex + 1);

  return {
    annualisedReturnPercent: annualReturn * 100,
    annualisedVolPercent: annualVol * 100,
    sharpe: annualVol ? (annualReturn - riskFreeRate) / annualVol : NaN,
    sortino: downsideDev ? (annualReturn - riskFreeRate) / downsideDev : NaN,
    calmar: maxDrawdownPercent ? (annualReturn * 100) / Math.abs(maxDrawdownPercent) : NaN,
    maxDrawdownPercent,
    downsideDeviationPercent: downsideDev * 100,
    bestDayPercent: (Math.exp(Math.max(...returns)) - 1) * 100,
    worstDayPercent: (Math.exp(Math.min(...returns)) - 1) * 100,
    positiveDayShare: (returns.filter((r) => r > 0).length / returns.length) * 100,
    var95DailyPercent: (Math.exp(var95) - 1) * 100,
    expectedShortfall95DailyPercent: tail.length ? (Math.exp(mean(tail)) - 1) * 100 : NaN,
  };
}

export interface PositionPlan {
  /** Full Kelly fraction of capital, given the win rate and payoff ratio. */
  kellyFraction: number;
  /** What we actually recommend: Kelly scaled down, since edge estimates are noisy. */
  recommendedFraction: number;
  fractionNote: string;
  entryPrice: number;
  stopPrice: number;
  targetPrice: number;
  stopDistancePercent: number;
  targetDistancePercent: number;
  rewardToRisk: number;
  /** Expected value per unit risked, from the probability and payoff. */
  expectancy: number;
  /** Position size such that hitting the stop costs `riskBudget` of capital. */
  sizeAsPercentOfCapital: number;
  breakEvenWinRate: number;
}

/**
 * Kelly sizing from a win probability and payoff ratio, then deliberately
 * fractioned down. Full Kelly is optimal only if the probabilities are exactly
 * right, and they never are, so a quarter-to-half Kelly is the practical choice.
 */
export function positionPlan(params: {
  entryPrice: number;
  stopPrice: number;
  targetPrice: number;
  winProbability: number;
  /** Share of capital lost if the stop is hit, e.g. 0.01 for 1%. */
  riskBudget?: number;
  kellyScale?: number;
}): PositionPlan {
  const { entryPrice, stopPrice, targetPrice } = params;
  const riskBudget = params.riskBudget ?? 0.01;
  const kellyScale = params.kellyScale ?? 0.35;
  const p = Math.max(0.001, Math.min(0.999, params.winProbability));

  const riskPerShare = Math.abs(entryPrice - stopPrice);
  const rewardPerShare = Math.abs(targetPrice - entryPrice);
  const rewardToRisk = riskPerShare ? rewardPerShare / riskPerShare : NaN;

  // Kelly for a binary payoff of b to 1.
  const b = rewardToRisk;
  const kelly = Number.isFinite(b) && b > 0 ? (p * (b + 1) - 1) / b : NaN;
  const recommended = Number.isFinite(kelly) ? Math.max(0, kelly * kellyScale) : 0;

  const stopDistancePercent = entryPrice ? (riskPerShare / entryPrice) * 100 : NaN;
  const sizeAsPercentOfCapital = stopDistancePercent ? (riskBudget * 100 * 100) / stopDistancePercent : NaN;

  return {
    kellyFraction: kelly,
    recommendedFraction: recommended,
    fractionNote: `Kelly scaled to ${(kellyScale * 100).toFixed(0)}% because the win probability is an estimate, not a known quantity.`,
    entryPrice,
    stopPrice,
    targetPrice,
    stopDistancePercent,
    targetDistancePercent: entryPrice ? (rewardPerShare / entryPrice) * 100 : NaN,
    rewardToRisk,
    expectancy: Number.isFinite(b) ? p * b - (1 - p) : NaN,
    sizeAsPercentOfCapital: Math.min(100, sizeAsPercentOfCapital),
    breakEvenWinRate: Number.isFinite(b) && b > 0 ? (1 / (1 + b)) * 100 : NaN,
  };
}

/**
 * Volatility-scaled stop distance. A stop should reflect how much the asset
 * normally moves, not a round percentage.
 */
export function atrStop(params: {
  entryPrice: number;
  atr: number;
  direction: 'long' | 'short';
  multiple?: number;
}): number {
  const multiple = params.multiple ?? 2;
  const offset = params.atr * multiple;
  return params.direction === 'long' ? params.entryPrice - offset : params.entryPrice + offset;
}

/** Correlation of the asset against a set of benchmarks, for concentration risk. */
export function correlationMatrix(
  target: number[],
  others: Array<{ symbol: string; returns: number[] }>,
): Array<{ symbol: string; correlation: number; beta: number | null }> {
  return others
    .map((o) => {
      const n = Math.min(target.length, o.returns.length);
      if (n < 60) return { symbol: o.symbol, correlation: NaN, beta: null };
      const reg = linearRegression(o.returns.slice(-n), target.slice(-n));
      return {
        symbol: o.symbol,
        correlation: correlation(target.slice(-n), o.returns.slice(-n)),
        beta: reg.slope,
      };
    })
    .filter((r) => Number.isFinite(r.correlation))
    .sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
}
