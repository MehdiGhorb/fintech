import { SYMBOLS } from "./universe";
import type { Bar } from "./types";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

const FETCH_INIT: RequestInit = {
  headers: {
    "User-Agent": UA,
    Accept: "application/json,text/csv,*/*",
    Referer: "https://www.nasdaq.com/",
  },
  cache: "no-store",
};

export type SeriesPack = {
  bars: Record<string, Bar[]>;
  source: string;
  livePrice?: number;
};

type Cache = { at: number; pack: SeriesPack };
let cache: Cache | null = null;
const CACHE_MS = 5 * 60 * 1000;

function ymd(tsSec: number) {
  return new Date(tsSec * 1000).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

function todayNY() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

function yearAgoNY() {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - 1);
  return d.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

function num(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const n = Number(value.replace(/[$,+%]/g, "").replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

function clean(bars: Bar[]) {
  const out: Bar[] = [];
  for (const bar of bars) {
    if (!bar.date || !Number.isFinite(bar.close) || bar.close <= 0) continue;
    out.push(bar);
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  const seen = new Set<string>();
  return out.filter((bar) => {
    if (seen.has(bar.date)) return false;
    seen.add(bar.date);
    return true;
  });
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, FETCH_INIT);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

async function mapPool<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    const chunk = await Promise.all(items.slice(i, i + size).map(fn));
    out.push(...chunk);
  }
  return out;
}

type NasdaqHist = {
  data?: {
    tradesTable?: {
      rows?: Array<{ date?: string; close?: string; volume?: string; open?: string; high?: string; low?: string }>;
    };
  };
};

function nasdaqDate(input: string) {
  const [m, d, y] = input.split("/");
  if (!y) return "";
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

async function nasdaqHistory(symbol: string): Promise<Bar[]> {
  const url = `https://api.nasdaq.com/api/quote/${encodeURIComponent(symbol)}/historical?assetclass=stocks&fromdate=${yearAgoNY()}&todate=${todayNY()}&limit=9999`;
  const data = await getJson<NasdaqHist>(url);
  const rows = data.data?.tradesTable?.rows ?? [];
  const bars: Bar[] = [];
  for (const row of rows) {
    if (!row.date) continue;
    const close = num(row.close);
    const open = num(row.open) ?? close;
    const high = num(row.high) ?? close;
    const low = num(row.low) ?? close;
    const volume = num(row.volume) ?? 0;
    if (close == null || open == null || high == null || low == null) continue;
    bars.push({ date: nasdaqDate(row.date), open, high, low, close, volume: volume ?? 0 });
  }
  return clean(bars);
}

type NasdaqInfo = {
  data?: {
    primaryData?: { lastSalePrice?: string; volume?: string };
  };
};

async function nasdaqLive(symbol: string): Promise<{ price: number; volume: number } | null> {
  try {
    const url = `https://api.nasdaq.com/api/quote/${encodeURIComponent(symbol)}/info?assetclass=stocks`;
    const data = await getJson<NasdaqInfo>(url);
    const price = num(data.data?.primaryData?.lastSalePrice);
    const volume = num(data.data?.primaryData?.volume) ?? 0;
    if (price == null) return null;
    return { price, volume: volume ?? 0 };
  } catch {
    return null;
  }
}

type YahooChart = {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: (number | null)[];
          high?: (number | null)[];
          low?: (number | null)[];
          close?: (number | null)[];
          volume?: (number | null)[];
        }>;
      };
    }>;
  };
};

async function yahooChart(symbol: string): Promise<Bar[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1y&includePrePost=false`;
  const data = await getJson<YahooChart>(url);
  const result = data.chart?.result?.[0];
  const ts = result?.timestamp ?? [];
  const q = result?.indicators?.quote?.[0];
  if (!q || !ts.length) return [];
  const bars: Bar[] = [];
  for (let i = 0; i < ts.length; i += 1) {
    const close = num(q.close?.[i]);
    const open = num(q.open?.[i]) ?? close;
    const high = num(q.high?.[i]) ?? close;
    const low = num(q.low?.[i]) ?? close;
    const volume = num(q.volume?.[i]) ?? 0;
    if (close == null || open == null || high == null || low == null) continue;
    bars.push({ date: ymd(ts[i]), open, high, low, close, volume: volume ?? 0 });
  }
  return clean(bars);
}

async function oneSymbol(symbol: string): Promise<Bar[]> {
  try {
    const bars = await nasdaqHistory(symbol);
    if (bars.length >= 60) return bars;
  } catch {
    // try yahoo
  }
  try {
    const bars = await yahooChart(symbol);
    if (bars.length >= 60) return bars;
  } catch {
    // empty
  }
  return [];
}

function overlayLive(bars: Bar[], live: { price: number; volume: number } | null) {
  if (!live || bars.length === 0) return bars;
  const last = bars[bars.length - 1];
  if (last.date !== todayNY()) return bars;
  return [
    ...bars.slice(0, -1),
    {
      ...last,
      close: live.price,
      high: Math.max(last.high, live.price),
      low: Math.min(last.low, live.price),
      volume: live.volume || last.volume,
    },
  ];
}

export async function loadUniverse(preferred?: string): Promise<SeriesPack> {
  if (cache && Date.now() - cache.at < CACHE_MS && (!preferred || cache.pack.bars[preferred])) {
    const pack: SeriesPack = { bars: { ...cache.pack.bars }, source: cache.pack.source };
    if (preferred) {
      const live = await nasdaqLive(preferred);
      if (pack.bars[preferred]) pack.bars[preferred] = overlayLive(pack.bars[preferred], live);
      if (live) pack.livePrice = live.price;
    }
    return pack;
  }

  const bars: Record<string, Bar[]> = {};
  await mapPool(SYMBOLS, 8, async (symbol) => {
    const series = await oneSymbol(symbol);
    if (series.length >= 60) bars[symbol] = series;
    return symbol;
  });

  if (preferred && !bars[preferred]) {
    throw new Error(`Could not load prices for ${preferred}`);
  }
  if (Object.keys(bars).length === 0) {
    throw new Error("Could not load market prices");
  }

  const source = "Nasdaq";
  cache = { at: Date.now(), pack: { bars, source } };

  const pack: SeriesPack = { bars: { ...bars }, source };
  if (preferred && pack.bars[preferred]) {
    const live = await nasdaqLive(preferred);
    pack.bars[preferred] = overlayLive(pack.bars[preferred], live);
    if (live) pack.livePrice = live.price;
  }
  return pack;
}

export function usMarketOpen(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const weekday = parts.find((p) => p.type === "weekday")?.value;
  const hour = Number(parts.find((p) => p.type === "hour")?.value);
  const minute = Number(parts.find((p) => p.type === "minute")?.value);
  if (weekday === "Sat" || weekday === "Sun") return false;
  const mins = hour * 60 + minute;
  return mins >= 9 * 60 + 30 && mins < 16 * 60;
}
