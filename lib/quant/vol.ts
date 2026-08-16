import type { Bar } from '../sources/types';
import { mean, stdev } from './stats';

export const TRADING_DAYS = 252;

/** Log returns from a close series. */
export function logReturns(closes: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1] > 0 && closes[i] > 0) out.push(Math.log(closes[i] / closes[i - 1]));
  }
  return out;
}

/** Close-to-close annualised volatility over a trailing window. */
export function realizedVol(returns: number[], window = 21): number {
  const slice = returns.slice(-window);
  if (slice.length < 5) return NaN;
  return stdev(slice) * Math.sqrt(TRADING_DAYS);
}

/**
 * Parkinson estimator uses the intraday range, which is roughly five times more
 * efficient than close-to-close for the same sample size.
 */
export function parkinsonVol(bars: Bar[], window = 21): number {
  const slice = bars.slice(-window).filter((b) => b.high > 0 && b.low > 0 && b.high > b.low);
  if (slice.length < 5) return NaN;
  const factor = 1 / (4 * Math.log(2));
  const sum = slice.reduce((a, b) => a + Math.log(b.high / b.low) ** 2, 0);
  return Math.sqrt((factor * sum) / slice.length) * Math.sqrt(TRADING_DAYS);
}

/** Garman-Klass adds the open-close move, capturing overnight drift better. */
export function garmanKlassVol(bars: Bar[], window = 21): number {
  const slice = bars.slice(-window).filter((b) => b.high > b.low && b.open > 0 && b.close > 0);
  if (slice.length < 5) return NaN;
  const sum = slice.reduce((a, b) => {
    const hl = Math.log(b.high / b.low) ** 2;
    const co = Math.log(b.close / b.open) ** 2;
    return a + 0.5 * hl - (2 * Math.log(2) - 1) * co;
  }, 0);
  const v = sum / slice.length;
  return v > 0 ? Math.sqrt(v) * Math.sqrt(TRADING_DAYS) : NaN;
}

/** Exponentially weighted volatility (RiskMetrics convention, lambda 0.94). */
export function ewmaVol(returns: number[], lambda = 0.94): number {
  if (returns.length < 10) return NaN;
  let variance = returns.slice(0, 20).reduce((a, r) => a + r * r, 0) / Math.min(20, returns.length);
  for (const r of returns.slice(20)) {
    variance = lambda * variance + (1 - lambda) * r * r;
  }
  return Math.sqrt(variance * TRADING_DAYS);
}

export interface GarchFit {
  omega: number;
  alpha: number;
  beta: number;
  /** alpha + beta: how persistent volatility shocks are. */
  persistence: number;
  /** Annualised long-run volatility implied by the fit. */
  longRunVol: number;
  /** Annualised one-step-ahead conditional volatility. */
  currentVol: number;
  logLikelihood: number;
  converged: boolean;
  /** Standardised residuals, used to bootstrap simulation innovations. */
  standardisedResiduals: number[];
  conditionalVol: number[];
}

function garchLogLikelihood(returns: number[], omega: number, alpha: number, beta: number, unconditional: number) {
  let variance = unconditional;
  let ll = 0;
  const vols: number[] = [];
  const resid: number[] = [];
  for (const r of returns) {
    if (variance <= 1e-12) return null;
    ll += -0.5 * (Math.log(2 * Math.PI) + Math.log(variance) + (r * r) / variance);
    vols.push(Math.sqrt(variance));
    resid.push(r / Math.sqrt(variance));
    variance = omega + alpha * r * r + beta * variance;
  }
  return { ll, vols, resid, nextVariance: variance };
}

/**
 * Fits a GARCH(1,1) on demeaned daily log returns by grid-refined maximum
 * likelihood. A coarse-to-fine search is used instead of a gradient optimiser
 * because the surface is well behaved in the (alpha, beta) simplex and this
 * needs no numerical-optimisation dependency.
 */
export function fitGarch(returns: number[]): GarchFit | null {
  const demeaned = returns.map((r) => r - mean(returns));
  if (demeaned.length < 120) return null;
  const unconditional = demeaned.reduce((a, r) => a + r * r, 0) / demeaned.length;
  if (!(unconditional > 0)) return null;

  let best = { alpha: 0.08, beta: 0.9, ll: -Infinity };
  let alphaRange = { lo: 0.01, hi: 0.3 };
  let betaRange = { lo: 0.55, hi: 0.985 };

  for (let pass = 0; pass < 4; pass++) {
    const steps = 14;
    const aStep = (alphaRange.hi - alphaRange.lo) / steps;
    const bStep = (betaRange.hi - betaRange.lo) / steps;
    for (let i = 0; i <= steps; i++) {
      const alpha = alphaRange.lo + aStep * i;
      for (let j = 0; j <= steps; j++) {
        const beta = betaRange.lo + bStep * j;
        // Stationarity constraint; also keeps omega positive.
        if (alpha + beta >= 0.9995 || alpha <= 0 || beta <= 0) continue;
        const omega = unconditional * (1 - alpha - beta);
        if (omega <= 0) continue;
        const fit = garchLogLikelihood(demeaned, omega, alpha, beta, unconditional);
        if (fit && fit.ll > best.ll) best = { alpha, beta, ll: fit.ll };
      }
    }
    alphaRange = { lo: Math.max(1e-4, best.alpha - aStep), hi: Math.min(0.6, best.alpha + aStep) };
    betaRange = { lo: Math.max(1e-4, best.beta - bStep), hi: Math.min(0.9994, best.beta + bStep) };
  }

  const omega = unconditional * (1 - best.alpha - best.beta);
  const final = garchLogLikelihood(demeaned, omega, best.alpha, best.beta, unconditional);
  if (!final) return null;

  const persistence = best.alpha + best.beta;
  return {
    omega,
    alpha: best.alpha,
    beta: best.beta,
    persistence,
    longRunVol: Math.sqrt((omega / (1 - persistence)) * TRADING_DAYS),
    currentVol: Math.sqrt(final.nextVariance * TRADING_DAYS),
    logLikelihood: final.ll,
    converged: Number.isFinite(best.ll) && persistence < 0.9995,
    standardisedResiduals: final.resid,
    conditionalVol: final.vols.map((v) => v * Math.sqrt(TRADING_DAYS)),
  };
}

export interface VolProfile {
  realized21d: number;
  realized63d: number;
  realized252d: number;
  parkinson21d: number;
  garmanKlass21d: number;
  ewma: number;
  garch: GarchFit | null;
  /** Where current 21-day vol sits within its own 3-year distribution. */
  volPercentile: number;
  /** Short vol above long vol means the market is in an expansion phase. */
  volRegime: 'compressing' | 'stable' | 'expanding';
  termStructureNote: string;
}

export function volProfile(bars: Bar[], returns: number[]): VolProfile {
  const realized21d = realizedVol(returns, 21);
  const realized63d = realizedVol(returns, 63);
  const realized252d = realizedVol(returns, 252);

  // Rolling 21-day vol history for a percentile read.
  const rolling: number[] = [];
  for (let i = 21; i <= returns.length; i++) {
    const v = stdev(returns.slice(i - 21, i)) * Math.sqrt(TRADING_DAYS);
    if (Number.isFinite(v)) rolling.push(v);
  }
  const recent = rolling.slice(-756);
  const below = recent.filter((v) => v <= realized21d).length;
  const volPercentile = recent.length ? (below / recent.length) * 100 : NaN;

  const ratio = realized63d ? realized21d / realized63d : 1;
  const volRegime = ratio > 1.15 ? 'expanding' : ratio < 0.85 ? 'compressing' : 'stable';

  return {
    realized21d,
    realized63d,
    realized252d,
    parkinson21d: parkinsonVol(bars, 21),
    garmanKlass21d: garmanKlassVol(bars, 21),
    ewma: ewmaVol(returns),
    garch: fitGarch(returns),
    volPercentile,
    volRegime,
    termStructureNote:
      volRegime === 'expanding'
        ? 'Short-dated realised vol is running above the 3-month baseline: position sizes should shrink and stops widen.'
        : volRegime === 'compressing'
          ? 'Vol is compressing versus the 3-month baseline, which historically precedes range expansion in either direction.'
          : 'Vol is broadly in line with its 3-month baseline.',
  };
}

/**
 * Multi-step GARCH variance forecast. Variance mean-reverts toward the long-run
 * level at rate (alpha+beta), so the horizon variance is the sum of the path.
 */
export function garchHorizonVariance(fit: GarchFit, horizonDays: number): number {
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
