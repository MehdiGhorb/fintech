/** Descriptive statistics and distribution utilities used across the quant layer. */

export function mean(xs: number[]): number {
  if (!xs.length) return NaN;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function variance(xs: number[], sample = true): number {
  if (xs.length < 2) return NaN;
  const m = mean(xs);
  const ss = xs.reduce((a, x) => a + (x - m) ** 2, 0);
  return ss / (xs.length - (sample ? 1 : 0));
}

export function stdev(xs: number[], sample = true): number {
  return Math.sqrt(variance(xs, sample));
}

export function skewness(xs: number[]): number {
  const n = xs.length;
  if (n < 3) return NaN;
  const m = mean(xs);
  const s = stdev(xs, false);
  if (!s) return NaN;
  return xs.reduce((a, x) => a + ((x - m) / s) ** 3, 0) / n;
}

/** Excess kurtosis: 0 for a normal distribution. */
export function kurtosis(xs: number[]): number {
  const n = xs.length;
  if (n < 4) return NaN;
  const m = mean(xs);
  const s = stdev(xs, false);
  if (!s) return NaN;
  return xs.reduce((a, x) => a + ((x - m) / s) ** 4, 0) / n - 3;
}

/** Linear-interpolated quantile, matching the common "type 7" definition. */
export function quantile(xs: number[], p: number): number {
  if (!xs.length) return NaN;
  const sorted = [...xs].sort((a, b) => a - b);
  if (p <= 0) return sorted[0];
  if (p >= 1) return sorted[sorted.length - 1];
  const pos = (sorted.length - 1) * p;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (pos - lo) * (sorted[hi] - sorted[lo]);
}

export function median(xs: number[]): number {
  return quantile(xs, 0.5);
}

export function autocorrelation(xs: number[], lag: number): number {
  const n = xs.length;
  if (n <= lag + 2) return NaN;
  const m = mean(xs);
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    den += (xs[i] - m) ** 2;
    if (i >= lag) num += (xs[i] - m) * (xs[i - lag] - m);
  }
  return den ? num / den : NaN;
}

export function correlation(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return NaN;
  const a = xs.slice(-n);
  const b = ys.slice(-n);
  const ma = mean(a);
  const mb = mean(b);
  let cov = 0;
  let va = 0;
  let vb = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - ma;
    const db = b[i] - mb;
    cov += da * db;
    va += da * da;
    vb += db * db;
  }
  return va && vb ? cov / Math.sqrt(va * vb) : NaN;
}

export interface Regression {
  slope: number;
  intercept: number;
  r2: number;
  /** Standard error of the slope, for judging whether a trend is real. */
  slopeStdError: number;
  tStat: number;
  observations: number;
}

/** Ordinary least squares of y on x. */
export function linearRegression(xs: number[], ys: number[]): Regression {
  const n = Math.min(xs.length, ys.length);
  const x = xs.slice(-n);
  const y = ys.slice(-n);
  const mx = mean(x);
  const my = mean(y);
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (x[i] - mx) * (y[i] - my);
    sxx += (x[i] - mx) ** 2;
  }
  const slope = sxx ? sxy / sxx : 0;
  const intercept = my - slope * mx;

  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < n; i++) {
    const pred = intercept + slope * x[i];
    ssRes += (y[i] - pred) ** 2;
    ssTot += (y[i] - my) ** 2;
  }
  const r2 = ssTot ? 1 - ssRes / ssTot : 0;
  const residualVar = n > 2 ? ssRes / (n - 2) : NaN;
  const slopeStdError = sxx ? Math.sqrt(residualVar / sxx) : NaN;
  return {
    slope,
    intercept,
    r2,
    slopeStdError,
    tStat: slopeStdError ? slope / slopeStdError : NaN,
    observations: n,
  };
}

/** Standard normal CDF via Abramowitz-Stegun; accurate to ~1e-7. */
export function normalCdf(z: number): number {
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const erf =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-x * x);
  return 0.5 * (1 + sign * erf);
}

/** Inverse standard normal CDF (Acklam's rational approximation). */
export function normalQuantile(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const pLow = 0.02425;

  if (p < pLow) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > 1 - pLow) {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  const q = p - 0.5;
  const r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
    (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

/**
 * Hurst exponent by rescaled-range analysis. Above 0.5 suggests trending
 * (momentum) behaviour, below 0.5 suggests mean reversion.
 */
export function hurstExponent(series: number[]): number {
  if (series.length < 64) return NaN;
  const sizes: number[] = [];
  for (let s = 8; s <= Math.floor(series.length / 2); s = Math.floor(s * 1.6)) sizes.push(s);
  const xs: number[] = [];
  const ys: number[] = [];

  for (const size of sizes) {
    const chunks = Math.floor(series.length / size);
    const rs: number[] = [];
    for (let c = 0; c < chunks; c++) {
      const chunk = series.slice(c * size, (c + 1) * size);
      const m = mean(chunk);
      let cumulative = 0;
      let min = 0;
      let max = 0;
      for (const v of chunk) {
        cumulative += v - m;
        min = Math.min(min, cumulative);
        max = Math.max(max, cumulative);
      }
      const s = stdev(chunk);
      if (s > 0 && max - min > 0) rs.push((max - min) / s);
    }
    if (rs.length) {
      xs.push(Math.log(size));
      ys.push(Math.log(mean(rs)));
    }
  }
  if (xs.length < 3) return NaN;
  return linearRegression(xs, ys).slope;
}

/** Mersenne-ish deterministic PRNG so simulations are reproducible per run. */
export function makeRng(seed = 42): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 4294967296;
  };
}

/** Box-Muller standard normal draw. */
export function normalDraw(rng: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function round(value: number, dp = 4): number {
  if (!Number.isFinite(value)) return NaN;
  const f = 10 ** dp;
  return Math.round(value * f) / f;
}
