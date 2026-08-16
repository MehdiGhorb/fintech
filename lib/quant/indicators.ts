import type { Bar } from '../sources/types';
import { mean, quantile, stdev } from './stats';

/** Simple moving average series, aligned to the input (leading nulls). */
export function sma(values: number[], period: number): Array<number | null> {
  const out: Array<number | null> = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    out.push(i >= period - 1 ? sum / period : null);
  }
  return out;
}

export function ema(values: number[], period: number): Array<number | null> {
  const out: Array<number | null> = [];
  const k = 2 / (period + 1);
  let prev: number | null = null;
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      out.push(null);
      continue;
    }
    if (prev === null) {
      prev = mean(values.slice(0, period));
    } else {
      prev = values[i] * k + prev * (1 - k);
    }
    out.push(prev);
  }
  return out;
}

/** Wilder's smoothing, used by RSI, ATR and ADX. */
function wilder(values: number[], period: number): Array<number | null> {
  const out: Array<number | null> = [];
  let prev: number | null = null;
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      out.push(null);
      continue;
    }
    if (prev === null) prev = mean(values.slice(0, period));
    else prev = (prev * (period - 1) + values[i]) / period;
    out.push(prev);
  }
  return out;
}

export function rsi(closes: number[], period = 14): Array<number | null> {
  const gains: number[] = [0];
  const losses: number[] = [0];
  for (let i = 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    gains.push(Math.max(0, change));
    losses.push(Math.max(0, -change));
  }
  const avgGain = wilder(gains.slice(1), period);
  const avgLoss = wilder(losses.slice(1), period);
  const out: Array<number | null> = [null];
  for (let i = 0; i < avgGain.length; i++) {
    const g = avgGain[i];
    const l = avgLoss[i];
    if (g === null || l === null) {
      out.push(null);
      continue;
    }
    if (l === 0) {
      out.push(100);
      continue;
    }
    out.push(100 - 100 / (1 + g / l));
  }
  return out;
}

export interface MacdPoint {
  macd: number | null;
  signal: number | null;
  histogram: number | null;
}

export function macd(closes: number[], fast = 12, slow = 26, signalPeriod = 9): MacdPoint[] {
  const fastEma = ema(closes, fast);
  const slowEma = ema(closes, slow);
  const line = closes.map((_, i) =>
    fastEma[i] !== null && slowEma[i] !== null ? (fastEma[i] as number) - (slowEma[i] as number) : null,
  );
  const defined = line.filter((v): v is number => v !== null);
  const signalDefined = ema(defined, signalPeriod);
  const offset = line.findIndex((v) => v !== null);

  return line.map((value, i) => {
    if (value === null || offset < 0) return { macd: null, signal: null, histogram: null };
    const signal = signalDefined[i - offset] ?? null;
    return {
      macd: value,
      signal,
      histogram: signal === null ? null : value - signal,
    };
  });
}

export function trueRange(bars: Bar[]): number[] {
  return bars.map((bar, i) => {
    if (i === 0) return bar.high - bar.low;
    const prevClose = bars[i - 1].close;
    return Math.max(bar.high - bar.low, Math.abs(bar.high - prevClose), Math.abs(bar.low - prevClose));
  });
}

export function atr(bars: Bar[], period = 14): Array<number | null> {
  return wilder(trueRange(bars), period);
}

export interface BollingerPoint {
  middle: number | null;
  upper: number | null;
  lower: number | null;
  /** Where price sits inside the band: 0 at the lower band, 1 at the upper. */
  percentB: number | null;
  /** Band width relative to the middle, a squeeze/expansion gauge. */
  bandwidth: number | null;
}

export function bollinger(closes: number[], period = 20, mult = 2): BollingerPoint[] {
  const middles = sma(closes, period);
  return closes.map((close, i) => {
    const middle = middles[i];
    if (middle === null) return { middle: null, upper: null, lower: null, percentB: null, bandwidth: null };
    const window = closes.slice(i - period + 1, i + 1);
    const sd = stdev(window, false);
    const upper = middle + mult * sd;
    const lower = middle - mult * sd;
    return {
      middle,
      upper,
      lower,
      percentB: upper === lower ? null : (close - lower) / (upper - lower),
      bandwidth: middle ? ((upper - lower) / middle) * 100 : null,
    };
  });
}

export interface AdxPoint {
  adx: number | null;
  plusDi: number | null;
  minusDi: number | null;
}

/** Average Directional Index — measures trend strength regardless of direction. */
export function adx(bars: Bar[], period = 14): AdxPoint[] {
  const plusDm: number[] = [0];
  const minusDm: number[] = [0];
  for (let i = 1; i < bars.length; i++) {
    const up = bars[i].high - bars[i - 1].high;
    const down = bars[i - 1].low - bars[i].low;
    plusDm.push(up > down && up > 0 ? up : 0);
    minusDm.push(down > up && down > 0 ? down : 0);
  }
  const tr = wilder(trueRange(bars), period);
  const plus = wilder(plusDm, period);
  const minus = wilder(minusDm, period);

  const dx: number[] = [];
  const diPlus: Array<number | null> = [];
  const diMinus: Array<number | null> = [];
  for (let i = 0; i < bars.length; i++) {
    const t = tr[i];
    if (!t || plus[i] === null || minus[i] === null) {
      diPlus.push(null);
      diMinus.push(null);
      dx.push(NaN);
      continue;
    }
    const p = ((plus[i] as number) / t) * 100;
    const m = ((minus[i] as number) / t) * 100;
    diPlus.push(p);
    diMinus.push(m);
    dx.push(p + m ? (Math.abs(p - m) / (p + m)) * 100 : NaN);
  }
  const valid = dx.map((v) => (Number.isFinite(v) ? v : 0));
  const smoothed = wilder(valid, period);
  return bars.map((_, i) => ({
    adx: diPlus[i] === null ? null : smoothed[i],
    plusDi: diPlus[i],
    minusDi: diMinus[i],
  }));
}

/** On-balance volume: cumulative signed volume, a crude flow proxy. */
export function obv(bars: Bar[]): number[] {
  const out: number[] = [0];
  for (let i = 1; i < bars.length; i++) {
    const dir = Math.sign(bars[i].close - bars[i - 1].close);
    out.push(out[i - 1] + dir * bars[i].volume);
  }
  return out;
}

/** Volume-weighted average price over a trailing window. */
export function vwap(bars: Bar[], period = 20): Array<number | null> {
  return bars.map((_, i) => {
    if (i < period - 1) return null;
    const window = bars.slice(i - period + 1, i + 1);
    let pv = 0;
    let v = 0;
    for (const bar of window) {
      const typical = (bar.high + bar.low + bar.close) / 3;
      pv += typical * bar.volume;
      v += bar.volume;
    }
    return v ? pv / v : null;
  });
}

export interface StochasticPoint {
  k: number | null;
  d: number | null;
}

export function stochastic(bars: Bar[], period = 14, smoothing = 3): StochasticPoint[] {
  const raw: Array<number | null> = bars.map((bar, i) => {
    if (i < period - 1) return null;
    const window = bars.slice(i - period + 1, i + 1);
    const high = Math.max(...window.map((b) => b.high));
    const low = Math.min(...window.map((b) => b.low));
    return high === low ? null : ((bar.close - low) / (high - low)) * 100;
  });
  const defined = raw.filter((v): v is number => v !== null);
  const smoothedD = sma(defined, smoothing);
  const offset = raw.findIndex((v) => v !== null);
  return raw.map((k, i) => ({ k, d: k === null || offset < 0 ? null : smoothedD[i - offset] ?? null }));
}

export interface SupportResistance {
  level: number;
  kind: 'support' | 'resistance';
  /** How many separate swing points cluster at this level. */
  touches: number;
  /** Distance from the latest close, in percent. */
  distancePercent: number;
}

/**
 * Finds swing highs and lows, then clusters nearby pivots into levels. Levels
 * are labelled by where they sit relative to the current price, since a broken
 * resistance acts as support afterwards.
 */
export function supportResistance(bars: Bar[], lookback = 5, tolerance = 0.015): SupportResistance[] {
  if (bars.length < lookback * 2 + 5) return [];
  const last = bars[bars.length - 1].close;
  const pivots: number[] = [];

  for (let i = lookback; i < bars.length - lookback; i++) {
    const window = bars.slice(i - lookback, i + lookback + 1);
    if (bars[i].high === Math.max(...window.map((b) => b.high))) pivots.push(bars[i].high);
    if (bars[i].low === Math.min(...window.map((b) => b.low))) pivots.push(bars[i].low);
  }

  const clusters: number[][] = [];
  for (const price of pivots) {
    const match = clusters.find((c) => Math.abs(mean(c) - price) / price < tolerance);
    if (match) match.push(price);
    else clusters.push([price]);
  }

  return clusters
    .map((prices) => {
      const level = mean(prices);
      return {
        level,
        kind: (level >= last ? 'resistance' : 'support') as 'support' | 'resistance',
        touches: prices.length,
        distancePercent: ((level - last) / last) * 100,
      };
    })
    .filter((l) => Math.abs(l.distancePercent) < 45)
    .sort((a, b) => Math.abs(a.distancePercent) - Math.abs(b.distancePercent))
    .slice(0, 12);
}

/** Price levels where the most volume has traded, i.e. the volume profile. */
export function volumeProfile(bars: Bar[], buckets = 24): Array<{ price: number; volumeShare: number }> {
  if (!bars.length) return [];
  const lows = Math.min(...bars.map((b) => b.low));
  const highs = Math.max(...bars.map((b) => b.high));
  if (highs <= lows) return [];
  const width = (highs - lows) / buckets;
  const bins = new Array(buckets).fill(0);
  let total = 0;
  for (const bar of bars) {
    const typical = (bar.high + bar.low + bar.close) / 3;
    const idx = Math.min(buckets - 1, Math.max(0, Math.floor((typical - lows) / width)));
    bins[idx] += bar.volume;
    total += bar.volume;
  }
  if (!total) return [];
  return bins
    .map((v, i) => ({ price: lows + width * (i + 0.5), volumeShare: (v / total) * 100 }))
    .sort((a, b) => b.volumeShare - a.volumeShare)
    .slice(0, 8);
}

/** Maximum peak-to-trough decline over the series, plus the current drawdown. */
export function drawdown(closes: number[]): { max: number; current: number; peakIndex: number; troughIndex: number } {
  let peak = closes[0] ?? 0;
  let peakIdx = 0;
  let max = 0;
  let maxPeak = 0;
  let maxTrough = 0;
  for (let i = 0; i < closes.length; i++) {
    if (closes[i] > peak) {
      peak = closes[i];
      peakIdx = i;
    }
    const dd = peak ? (closes[i] - peak) / peak : 0;
    if (dd < max) {
      max = dd;
      maxPeak = peakIdx;
      maxTrough = i;
    }
  }
  const runningPeak = Math.max(...closes);
  const current = runningPeak ? (closes[closes.length - 1] - runningPeak) / runningPeak : 0;
  return { max: max * 100, current: current * 100, peakIndex: maxPeak, troughIndex: maxTrough };
}

/** Fibonacci retracement levels across the most recent swing. */
export function fibonacci(bars: Bar[], lookback = 120): Array<{ label: string; price: number }> {
  const window = bars.slice(-lookback);
  if (window.length < 10) return [];
  const high = Math.max(...window.map((b) => b.high));
  const low = Math.min(...window.map((b) => b.low));
  const range = high - low;
  if (!range) return [];
  return [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1].map((r) => ({
    label: `${(r * 100).toFixed(1)}%`,
    price: high - range * r,
  }));
}

/** Percentile rank of the latest value inside its own history. */
export function percentileRank(values: number[], value: number): number {
  if (!values.length) return NaN;
  const below = values.filter((v) => v <= value).length;
  return (below / values.length) * 100;
}

export { quantile };
