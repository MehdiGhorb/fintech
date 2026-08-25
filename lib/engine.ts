import { nameOf } from "./universe";
import { addTechnicals, type FeatureRow } from "./technical";
import type { Action, Bar, DeskPayload, Direction, Order } from "./types";

const HORIZON = 5;
const MAX_WEIGHT = 0.15;
const HOLD_CUT = 0.12;
const COST_BPS = 10;
const WARMUP = 60;

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

function nz(n: number | null | undefined) {
  return n == null || !Number.isFinite(n) ? 0 : n;
}

export type Stance = {
  score: number;
  weight: number;
  action: Action;
  confidence: number;
  reason: string;
};

function parts(row: FeatureRow) {
  const trend = clamp(nz(row.sma50_ratio) / 0.08, -1, 1);
  const swing = clamp(nz(row.sma20_ratio) / 0.04, -1, 1);
  const macd = clamp(nz(row.macd_hist) / (row.close * 0.002 + 1e-9), -1, 1);
  const mom = clamp(nz(row.ret_5) / 0.06, -1, 1);
  const rsi = clamp((nz(row.rsi_14) - 50) / 25, -1, 1);
  return [
    {
      w: 0.35 * trend,
      text:
        nz(row.sma50_ratio) >= 0
          ? "Price is above the 50-day average"
          : "Price is below the 50-day average",
    },
    {
      w: 0.2 * swing,
      text:
        nz(row.sma20_ratio) >= 0
          ? "It is holding above the 20-day average"
          : "It is sitting under the 20-day average",
    },
    {
      w: 0.2 * macd,
      text: nz(row.macd_hist) >= 0 ? "MACD momentum is positive" : "MACD momentum is negative",
    },
    {
      w: 0.15 * mom,
      text: nz(row.ret_5) >= 0 ? "The last week has been strong" : "The last week has been weak",
    },
    {
      w: 0.1 * rsi,
      text:
        nz(row.rsi_14) >= 70
          ? `RSI is stretched (${nz(row.rsi_14).toFixed(0)})`
          : nz(row.rsi_14) <= 30
            ? `RSI looks oversold (${nz(row.rsi_14).toFixed(0)})`
            : `RSI is neutral (${nz(row.rsi_14).toFixed(0)})`,
    },
  ];
}

export function stanceFrom(row: FeatureRow): Stance {
  const items = parts(row);
  const score = clamp(
    items.reduce((s, p) => s + p.w, 0),
    -1,
    1,
  );
  const agree = items.filter((p) => Math.sign(p.w) === Math.sign(score) || score === 0).length;
  const action: Action = score >= HOLD_CUT ? "buy" : score <= -HOLD_CUT ? "sell" : "hold";
  const aligned = items
    .filter((p) => (action === "hold" ? true : Math.sign(p.w) === (action === "buy" ? 1 : -1)))
    .sort((a, b) => Math.abs(b.w) - Math.abs(a.w))
    .slice(0, 2)
    .map((p) => p.text);
  const reason =
    action === "hold"
      ? "Signals disagree, so the model stays flat."
      : aligned.join(". ") + ".";
  return {
    score,
    weight: Math.abs(score) * MAX_WEIGHT,
    action,
    confidence: agree / items.length,
    reason,
  };
}

function nextWeekdays(from: string, count: number) {
  const out: string[] = [];
  const d = new Date(`${from}T20:00:00Z`);
  while (out.length < count) {
    d.setUTCDate(d.getUTCDate() + 1);
    const day = d.getUTCDay();
    if (day === 0 || day === 6) continue;
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function forecastFrom(rows: FeatureRow[], stance: Stance) {
  const last = rows[rows.length - 1];
  const rets = rows.slice(-20).map((r) => r.ret_1).filter((x): x is number => x != null);
  const mu = rets.length ? rets.reduce((a, b) => a + b, 0) / rets.length : 0;
  const vol =
    rets.length > 2
      ? Math.sqrt(rets.reduce((s, r) => s + (r - mu) ** 2, 0) / (rets.length - 1))
      : 0.01;
  const point = mu * HORIZON + stance.score * vol * Math.sqrt(HORIZON);
  const band = 1.28 * vol * Math.sqrt(HORIZON);
  const q10 = point - band;
  const q90 = point + band;
  const expectedPct = (Math.exp(point) - 1) * 100;
  const lowPct = (Math.exp(q10) - 1) * 100;
  const highPct = (Math.exp(q90) - 1) * 100;
  const direction: Direction = expectedPct > 0.25 ? "up" : expectedPct < -0.25 ? "down" : "flat";
  const verb = direction === "up" ? "rise" : direction === "down" ? "fall" : "stay roughly flat";
  const mag = `${Math.abs(expectedPct).toFixed(1)}%`;
  const summary =
    direction === "flat"
      ? `Over the next ${HORIZON} trading days, the model expects little net move.`
      : `Over the next ${HORIZON} trading days, the model expects this name to ${verb} about ${mag}.`;

  const future = [
    { date: last.date, close: last.close, lo: last.close, hi: last.close },
    ...nextWeekdays(last.date, HORIZON).map((date, i) => {
      const t = (i + 1) / HORIZON;
      return {
        date,
        close: last.close * Math.exp(point * t),
        lo: last.close * Math.exp(q10 * t),
        hi: last.close * Math.exp(q90 * t),
      };
    }),
  ];

  return {
    horizonDays: HORIZON,
    direction,
    expectedPct,
    lowPct,
    highPct,
    expectedPrice: last.close * Math.exp(point),
    lowPrice: last.close * Math.exp(q10),
    highPrice: last.close * Math.exp(q90),
    confidence: stance.confidence,
    summary,
    future,
  };
}

function performanceFrom(rows: FeatureRow[]) {
  const preds: number[] = [];
  const y5: number[] = [];
  const y1: number[] = [];
  for (let i = WARMUP; i < rows.length - HORIZON; i += 1) {
    const pred = stanceFrom(rows[i]).score;
    if (Math.abs(pred) < 1e-9) continue;
    const later = rows[i + HORIZON].close;
    const next = rows[i + 1].close;
    if (later <= 0 || next <= 0 || rows[i].close <= 0) continue;
    preds.push(pred);
    y5.push(Math.log(later / rows[i].close));
    y1.push(Math.log(next / rows[i].close));
  }
  const n = preds.length;
  if (n < 20) {
    return { directionalAcc: 0, sharpe: 0, maxDrawdown: 0, sample: n };
  }
  let hits = 0;
  const strat: number[] = [];
  let prevSign = Math.sign(preds[0]);
  for (let i = 0; i < n; i += 1) {
    const s = Math.sign(preds[i]);
    if (s === Math.sign(y5[i]) && s !== 0) hits += 1;
    const flip = Math.abs(s - prevSign) > 0 ? 1 : 0;
    strat.push(s * y1[i] - (COST_BPS / 1e4) * flip);
    prevSign = s;
  }
  const m = strat.reduce((a, b) => a + b, 0) / strat.length;
  const sd = Math.sqrt(strat.reduce((a, b) => a + (b - m) ** 2, 0) / (strat.length - 1));
  const sharpe = sd < 1e-12 ? 0 : Math.sqrt(252) * m / sd;
  let equity = 1;
  let peak = 1;
  let maxDd = 0;
  for (const r of strat) {
    equity *= 1 + r;
    peak = Math.max(peak, equity);
    maxDd = Math.min(maxDd, equity / peak - 1);
  }
  return {
    directionalAcc: hits / n,
    sharpe,
    maxDrawdown: maxDd,
    sample: n,
  };
}

export function buildDesk(symbol: string, pack: { bars: Record<string, Bar[]>; source: string; livePrice?: number }, marketOpen: boolean): DeskPayload {
  const selectedBars = pack.bars[symbol];
  if (!selectedBars?.length) {
    throw new Error(`No price history for ${symbol}`);
  }

  const selectedRows = addTechnicals(selectedBars);
  const lastBar = selectedBars[selectedBars.length - 1];
  const prev = selectedBars[selectedBars.length - 2] ?? lastBar;
  const lastRow = selectedRows[selectedRows.length - 1];
  const selected = stanceFrom(lastRow);
  const forecast = forecastFrom(selectedRows, selected);
  const performance = performanceFrom(selectedRows);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const price = pack.livePrice ?? lastBar.close;
  const prevClose = pack.livePrice != null && lastBar.date !== today ? lastBar.close : prev.close;

  const scored: { symbol: string; stance: Stance }[] = [];
  for (const [tick, bars] of Object.entries(pack.bars)) {
    if (bars.length < WARMUP) continue;
    const rows = addTechnicals(bars);
    scored.push({ symbol: tick, stance: stanceFrom(rows[rows.length - 1]) });
  }

  const orders: Order[] = scored
    .filter((s) => s.stance.action !== "hold")
    .sort((a, b) => b.stance.weight - a.stance.weight)
    .slice(0, 10)
    .map((s) => ({
      action: s.stance.action as "buy" | "sell",
      symbol: s.symbol,
      name: nameOf(s.symbol),
      weight: s.stance.weight,
      reason: s.stance.reason,
      isSelected: s.symbol === symbol,
    }));

  const todayHigh = lastBar.high;
  const todayLow = lastBar.low;

  return {
    asOf: lastBar.date,
    source: pack.source,
    marketOpen,
    quote: {
      symbol,
      name: nameOf(symbol),
      price,
      prevClose,
      change: price - prevClose,
      changePct: prevClose ? ((price - prevClose) / prevClose) * 100 : 0,
      open: lastBar.open,
      high: todayHigh,
      low: todayLow,
      volume: lastBar.volume,
    },
    series: selectedBars.map((b) => ({ date: b.date, close: b.close })),
    forecast: {
      horizonDays: forecast.horizonDays,
      direction: forecast.direction,
      expectedPct: forecast.expectedPct,
      lowPct: forecast.lowPct,
      highPct: forecast.highPct,
      expectedPrice: forecast.expectedPrice,
      lowPrice: forecast.lowPrice,
      highPrice: forecast.highPrice,
      confidence: forecast.confidence,
      summary: forecast.summary,
      path: forecast.future,
    },
    performance,
    orders,
    selected: {
      action: selected.action,
      weight: selected.weight,
      reason: selected.reason,
    },
  };
}

export { HORIZON };
