import type { Instrument } from "./types";

export type Candle = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

function hash(input: string) {
  let value = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    value ^= input.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function rng(seed: number) {
  let state = seed || 1;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

export function mockSeries(instrument: Instrument, days = 180): Candle[] {
  const random = rng(hash(instrument.symbol));
  const base =
    instrument.kind === "exchange" ? 4800 + (hash(instrument.id) % 8000) / 10 : 40 + (hash(instrument.symbol) % 420);
  const rows: Candle[] = [];
  let price = base;
  const start = new Date("2026-01-02T00:00:00Z");

  for (let i = 0; i < days; i += 1) {
    const day = new Date(start);
    day.setUTCDate(start.getUTCDate() + i);
    if (day.getUTCDay() === 0 || day.getUTCDay() === 6) continue;
    const drift = 0.00035;
    const shock = (random() - 0.48) * 0.028;
    const open = price;
    const close = Math.max(1, open * (1 + drift + shock));
    const high = Math.max(open, close) * (1 + random() * 0.012);
    const low = Math.min(open, close) * (1 - random() * 0.012);
    rows.push({
      date: day.toISOString().slice(0, 10),
      open: round(open),
      high: round(high),
      low: round(low),
      close: round(close),
      volume: Math.round(1_200_000 + random() * 8_000_000),
    });
    price = close;
  }
  return rows;
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}

export function mockNews(instrument: Instrument) {
  const subject = instrument.kind === "exchange" ? instrument.name : instrument.symbol;
  return [
    {
      time: "09:14",
      source: "Reuters",
      title: `${subject} opens mixed as rates stay in focus`,
    },
    {
      time: "11:02",
      source: "Bloomberg",
      title: `Flows into ${instrument.venue} heavy; ${subject} volume above 20-day average`,
    },
    {
      time: "13:40",
      source: "WSJ",
      title: `Analysts split on near-term path for ${subject}`,
    },
    {
      time: "15:06",
      source: "FT",
      title: `Macro calendar: CPI tomorrow — ${subject} implied move 1.4%`,
    },
  ];
}

export function mockCompany(instrument: Instrument) {
  if (instrument.kind === "exchange") {
    return [
      ["Venue", instrument.name],
      ["Region", instrument.region],
      ["Session", "09:30–16:00 local"],
      ["Listed names", "2,400+"],
      ["Primary index", instrument.symbol === "NASDAQ" ? "NDX" : "Benchmark composite"],
      ["Currency", instrument.region === "United Kingdom" ? "GBP" : instrument.region === "Japan" ? "JPY" : "USD"],
    ];
  }
  const mcap = instrument.kind === "etf" ? "AUM $48.2B" : "$1.12T";
  return [
    ["Symbol", instrument.symbol],
    ["Name", instrument.name],
    ["Venue", instrument.venue],
    ["Type", instrument.kind === "etf" ? "ETF" : "Common stock"],
    [instrument.kind === "etf" ? "AUM" : "Market cap", mcap],
    ["Sector", instrument.kind === "etf" ? "Broad / thematic" : "Placeholder — live data later"],
    ["Next earnings", instrument.kind === "stock" ? "2026-10-22" : "—"],
    ["PE / yield", instrument.kind === "stock" ? "28.4 / 0.6%" : "Dist. yield 1.4%"],
  ];
}

export function mockAccuracy() {
  return [
    { label: "Hit rate", value: "54.8%" },
    { label: "MAE (21d)", value: "3.1%" },
    { label: "Brier", value: "0.21" },
    { label: "Sample", value: "126 calls" },
  ];
}
