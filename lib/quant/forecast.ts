import { makeRng, mean, normalCdf, normalDraw, quantile, stdev } from './stats';
import { TRADING_DAYS, type GarchFit } from './vol';

export interface ForecastInput {
  spot: number;
  returns: number[];
  horizonDays: number;
  garch: GarchFit | null;
  /**
   * Annualised drift to use. Pure historical drift extrapolates recent trends
   * too aggressively, so callers usually pass a shrunk estimate.
   */
  annualDrift: number;
  paths?: number;
  seed?: number;
}

export interface ForecastResult {
  horizonDays: number;
  spot: number;
  /** Median simulated terminal price. */
  median: number;
  mean: number;
  quantiles: Record<string, number>;
  probUp: number;
  /** Probability of finishing above these thresholds, as percentages. */
  probAbove: Array<{ movePercent: number; price: number; probability: number }>;
  probBelow: Array<{ movePercent: number; price: number; probability: number }>;
  expectedReturnPercent: number;
  /** 5% worst-case terminal return, and the average of that tail. */
  var95Percent: number;
  expectedShortfall95Percent: number;
  /** Annualised vol used for the horizon, from GARCH when available. */
  horizonVolPercent: number;
  annualisedVolPercent: number;
  /** Highest and lowest points touched along the paths, on average. */
  expectedMaxDrawdownPercent: number;
  expectedMaxRunupPercent: number;
  /** Chance price touches a level at any point, not just at expiry. */
  touchProbabilities: Array<{ movePercent: number; price: number; probabilityTouch: number }>;
  method: string;
  paths: number;
}

/**
 * Simulates the terminal price distribution over a horizon.
 *
 * Innovations are bootstrapped from the GARCH standardised residuals rather than
 * drawn from a normal, so the simulation inherits the asset's real fat tails and
 * skew. Volatility follows the fitted GARCH recursion, which reproduces
 * clustering — a week after a shock is genuinely riskier than a calm week.
 */
export function simulateHorizon(input: ForecastInput): ForecastResult {
  const { spot, returns, horizonDays, garch } = input;
  const paths = input.paths ?? 20_000;
  const rng = makeRng(input.seed ?? 20260816);

  const dailyDrift = input.annualDrift / TRADING_DAYS;
  const innovations =
    garch?.standardisedResiduals && garch.standardisedResiduals.length > 100
      ? garch.standardisedResiduals
      : null;
  const fallbackDailyVol = stdev(returns.slice(-252)) || stdev(returns);

  const terminal: number[] = new Array(paths);
  const drawdowns: number[] = new Array(paths);
  const runups: number[] = new Array(paths);
  const touchUp: number[] = [0.02, 0.05, 0.1, 0.2].map(() => 0);
  const touchDown: number[] = [0.02, 0.05, 0.1, 0.2].map(() => 0);
  const upLevels = [0.02, 0.05, 0.1, 0.2];
  const downLevels = [0.02, 0.05, 0.1, 0.2];

  const persistence = garch ? garch.alpha + garch.beta : 0;
  const longRunDaily = garch ? garch.omega / (1 - persistence) : 0;
  const startVariance = garch ? (garch.currentVol / Math.sqrt(TRADING_DAYS)) ** 2 : fallbackDailyVol ** 2;

  for (let p = 0; p < paths; p++) {
    let logPrice = Math.log(spot);
    let variance = startVariance;
    let peak = logPrice;
    let trough = logPrice;
    const hitUp = new Array(upLevels.length).fill(false);
    const hitDown = new Array(downLevels.length).fill(false);

    for (let d = 0; d < horizonDays; d++) {
      const z = innovations ? innovations[Math.floor(rng() * innovations.length)] : normalDraw(rng);
      const vol = Math.sqrt(variance);
      const shock = vol * z;
      // Ito correction keeps the arithmetic drift interpretation intact.
      logPrice += dailyDrift - 0.5 * variance + shock;
      if (garch) variance = longRunDaily + persistence * (variance - longRunDaily) + garch.alpha * (shock * shock - variance);
      if (!(variance > 1e-12)) variance = startVariance;

      peak = Math.max(peak, logPrice);
      trough = Math.min(trough, logPrice);
      const rel = Math.exp(logPrice - Math.log(spot)) - 1;
      for (let i = 0; i < upLevels.length; i++) if (!hitUp[i] && rel >= upLevels[i]) hitUp[i] = true;
      for (let i = 0; i < downLevels.length; i++) if (!hitDown[i] && rel <= -downLevels[i]) hitDown[i] = true;
    }

    terminal[p] = Math.exp(logPrice);
    drawdowns[p] = (Math.exp(trough - peak) - 1) * 100;
    runups[p] = (Math.exp(peak - Math.log(spot)) - 1) * 100;
    for (let i = 0; i < upLevels.length; i++) if (hitUp[i]) touchUp[i]++;
    for (let i = 0; i < downLevels.length; i++) if (hitDown[i]) touchDown[i]++;
  }

  const sorted = [...terminal].sort((a, b) => a - b);
  const qs: Record<string, number> = {};
  for (const p of [0.01, 0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 0.95, 0.99]) {
    qs[`p${Math.round(p * 100)}`] = quantile(sorted, p);
  }

  const terminalReturns = terminal.map((t) => (t / spot - 1) * 100);
  const probUp = (terminal.filter((t) => t > spot).length / paths) * 100;
  const var95 = quantile(terminalReturns, 0.05);
  const tail = terminalReturns.filter((r) => r <= var95);

  const horizonVariance = garch
    ? sumGarchVariance(garch, horizonDays)
    : fallbackDailyVol ** 2 * horizonDays;
  const horizonVolPercent = Math.sqrt(horizonVariance) * 100;

  return {
    horizonDays,
    spot,
    median: quantile(sorted, 0.5),
    mean: mean(terminal),
    quantiles: qs,
    probUp,
    probAbove: [0.02, 0.05, 0.1, 0.2].map((m) => ({
      movePercent: m * 100,
      price: spot * (1 + m),
      probability: (terminal.filter((t) => t >= spot * (1 + m)).length / paths) * 100,
    })),
    probBelow: [0.02, 0.05, 0.1, 0.2].map((m) => ({
      movePercent: -m * 100,
      price: spot * (1 - m),
      probability: (terminal.filter((t) => t <= spot * (1 - m)).length / paths) * 100,
    })),
    expectedReturnPercent: mean(terminalReturns),
    var95Percent: var95,
    expectedShortfall95Percent: tail.length ? mean(tail) : var95,
    horizonVolPercent,
    annualisedVolPercent: Math.sqrt((horizonVariance / horizonDays) * TRADING_DAYS) * 100,
    expectedMaxDrawdownPercent: mean(drawdowns),
    expectedMaxRunupPercent: mean(runups),
    touchProbabilities: [
      ...upLevels.map((m, i) => ({
        movePercent: m * 100,
        price: spot * (1 + m),
        probabilityTouch: (touchUp[i] / paths) * 100,
      })),
      ...downLevels.map((m, i) => ({
        movePercent: -m * 100,
        price: spot * (1 - m),
        probabilityTouch: (touchDown[i] / paths) * 100,
      })),
    ],
    method: innovations
      ? 'GARCH(1,1) variance path with innovations bootstrapped from standardised residuals'
      : 'Constant-volatility geometric Brownian motion with normal innovations',
    paths,
  };
}

function sumGarchVariance(fit: GarchFit, horizonDays: number): number {
  const persistence = fit.alpha + fit.beta;
  const longRunDaily = fit.omega / (1 - persistence);
  let variance = (fit.currentVol / Math.sqrt(TRADING_DAYS)) ** 2;
  let total = 0;
  for (let h = 0; h < horizonDays; h++) {
    total += variance;
    variance = longRunDaily + persistence * (variance - longRunDaily);
  }
  return total;
}

/**
 * Closed-form sanity check on the simulation: probability of finishing above a
 * level under lognormal assumptions.
 */
export function analyticProbAbove(
  spot: number,
  target: number,
  annualDrift: number,
  annualVol: number,
  horizonDays: number,
): number {
  const t = horizonDays / TRADING_DAYS;
  const sigma = annualVol * Math.sqrt(t);
  if (!(sigma > 0)) return NaN;
  const m = (annualDrift - 0.5 * annualVol ** 2) * t;
  const z = (Math.log(target / spot) - m) / sigma;
  return (1 - normalCdf(z)) * 100;
}

/**
 * Blends historical drift toward zero. Raw trailing drift is a famously noisy
 * predictor, so we shrink it hard and cap it, which keeps the forecast honest
 * about how little the past says about the mean.
 */
export function shrinkDrift(
  returns: number[],
  opts: { shrink?: number; capAnnual?: number } = {},
): { annualDrift: number; rawAnnualDrift: number; note: string } {
  const shrink = opts.shrink ?? 0.25;
  const cap = opts.capAnnual ?? 0.35;
  const window = returns.slice(-TRADING_DAYS * 2);
  const raw = mean(window) * TRADING_DAYS;
  const shrunk = Math.max(-cap, Math.min(cap, raw * shrink));
  return {
    annualDrift: shrunk,
    rawAnnualDrift: raw,
    note: `Trailing 2-year drift of ${(raw * 100).toFixed(1)}% annualised shrunk by ${(shrink * 100).toFixed(0)}% to ${(
      shrunk * 100
    ).toFixed(1)}% and capped at ±${(cap * 100).toFixed(0)}%, because realised drift is a weak out-of-sample predictor.`,
  };
}

/** Horizon lengths in trading days for the standard labels. */
export const HORIZON_DAYS: Record<string, number> = {
  '1d': 1,
  '3d': 3,
  '1w': 5,
  '2w': 10,
  '1m': 21,
  '6w': 30,
  '2m': 42,
  '3m': 63,
  '6m': 126,
  '9m': 189,
  '1y': 252,
  '2y': 504,
  '3y': 756,
};

export function horizonToDays(label: string): number {
  const key = label.toLowerCase().replace(/\s+/g, '');
  if (HORIZON_DAYS[key]) return HORIZON_DAYS[key];
  const match = key.match(/^(\d+)(d|w|m|y)$/);
  if (match) {
    const n = parseInt(match[1], 10);
    const unit = match[2];
    const factor = unit === 'd' ? 1 : unit === 'w' ? 5 : unit === 'm' ? 21 : 252;
    return Math.max(1, n * factor);
  }
  return 21;
}
