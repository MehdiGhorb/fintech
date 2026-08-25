import type { Bar } from "./types";

export type FeatureRow = {
  date: string;
  close: number;
  volume: number;
  ret_1: number | null;
  ret_5: number | null;
  rsi_14: number | null;
  macd_hist: number | null;
  sma20_ratio: number | null;
  sma50_ratio: number | null;
  realized_vol_20: number | null;
  volume_z_20: number | null;
};

function mean(xs: number[]) {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function std(xs: number[], ddof = 1) {
  if (xs.length <= ddof) return 0;
  const m = mean(xs);
  const v = xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - ddof);
  return Math.sqrt(v);
}

function ewm(values: readonly (number | null)[], alpha: number, minPeriods: number) {
  const out: (number | null)[] = Array(values.length).fill(null);
  let prev: number | null = null;
  let count = 0;
  for (let i = 0; i < values.length; i += 1) {
    const x = values[i];
    if (x == null) continue;
    prev = prev == null ? x : alpha * x + (1 - alpha) * prev;
    count += 1;
    if (count >= minPeriods) out[i] = prev;
  }
  return out;
}

function rollingMean(values: (number | null)[], n: number, minPeriods: number) {
  const out: (number | null)[] = Array(values.length).fill(null);
  for (let i = 0; i < values.length; i += 1) {
    const slice: number[] = [];
    for (let j = Math.max(0, i - n + 1); j <= i; j += 1) {
      const v = values[j];
      if (v != null) slice.push(v);
    }
    if (slice.length >= minPeriods) out[i] = mean(slice);
  }
  return out;
}

function rollingStd(values: (number | null)[], n: number, minPeriods: number) {
  const out: (number | null)[] = Array(values.length).fill(null);
  for (let i = 0; i < values.length; i += 1) {
    const slice: number[] = [];
    for (let j = Math.max(0, i - n + 1); j <= i; j += 1) {
      const v = values[j];
      if (v != null) slice.push(v);
    }
    if (slice.length >= minPeriods) out[i] = std(slice);
  }
  return out;
}

/** Causal technicals matching the trading bot feature set. */
export function addTechnicals(bars: Bar[]): FeatureRow[] {
  const n = bars.length;
  const close = bars.map((b) => b.close);
  const vol = bars.map((b) => b.volume);
  const ret1: (number | null)[] = close.map((c, i) => (i === 0 || close[i - 1] <= 0 ? null : Math.log(c / close[i - 1])));
  const ret5: (number | null)[] = close.map((c, i) => (i < 5 || close[i - 5] <= 0 ? null : Math.log(c / close[i - 5])));

  const delta: (number | null)[] = close.map((c, i) => (i === 0 ? null : c - close[i - 1]));
  const gain = delta.map((d) => (d == null ? null : Math.max(d, 0)));
  const loss = delta.map((d) => (d == null ? null : Math.max(-d, 0)));
  const avgGain = ewm(gain, 1 / 14, 14);
  const avgLoss = ewm(loss, 1 / 14, 14);
  const rsi = avgGain.map((g, i) => {
    const l = avgLoss[i];
    if (g == null || l == null) return null;
    const rs = g / (l + 1e-12);
    return 100 - 100 / (1 + rs);
  });

  const ema12 = ewm(close.map((c) => c), 2 / 13, 1);
  const ema26 = ewm(close.map((c) => c), 2 / 27, 1);
  const macd = ema12.map((a, i) => (a == null || ema26[i] == null ? null : a - (ema26[i] as number)));
  const signal = ewm(macd, 2 / 10, 1);
  const hist = macd.map((m, i) => (m == null || signal[i] == null ? null : m - (signal[i] as number)));

  const sma20 = rollingMean(close.map((c) => c), 20, 5);
  const sma50 = rollingMean(close.map((c) => c), 50, 10);
  const vol20 = rollingStd(ret1, 20, 5);
  const volMean = rollingMean(vol.map((v) => v), 20, 5);
  const volStd = rollingStd(vol.map((v) => v), 20, 5);

  const rows: FeatureRow[] = [];
  for (let i = 0; i < n; i += 1) {
    const s20 = sma20[i];
    const s50 = sma50[i];
    const rv = vol20[i];
    const vs = volStd[i];
    rows.push({
      date: bars[i].date,
      close: close[i],
      volume: vol[i],
      ret_1: ret1[i],
      ret_5: ret5[i],
      rsi_14: rsi[i],
      macd_hist: hist[i],
      sma20_ratio: s20 ? close[i] / s20 - 1 : null,
      sma50_ratio: s50 ? close[i] / s50 - 1 : null,
      realized_vol_20: rv != null ? rv * Math.sqrt(252) : null,
      volume_z_20: vs ? (vol[i] - (volMean[i] ?? vol[i])) / (vs + 1e-12) : null,
    });
  }
  return rows;
}
