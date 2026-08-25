"use client";

import { useEffect, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { PriceChart, type RangeId } from "@/components/price-chart";
import { DJIA } from "@/lib/universe";
import { formatMoney, formatPct, formatVol, formatWeight, signedClass } from "@/lib/format";
import type { DeskPayload } from "@/lib/types";

const STORAGE_KEY = "desk.symbol";

export function Dashboard() {
  const [symbol, setSymbol] = useState<string | null>(null);
  const [range, setRange] = useState<RangeId>("6M");
  const [data, setData] = useState<DeskPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    setSymbol(saved && DJIA.some((item) => item.symbol === saved) ? saved : "AAPL");
  }, []);

  useEffect(() => {
    if (!symbol) return;
    window.localStorage.setItem(STORAGE_KEY, symbol);
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    fetch(`/api/desk?symbol=${symbol}`, { signal: ctrl.signal })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || "Could not load prices");
        setData(body as DeskPayload);
      })
      .catch((err: Error) => {
        if (err.name === "AbortError") return;
        setError(err.message);
      })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [symbol, reload]);

  const buys = data?.orders.filter((o) => o.action === "buy") ?? [];
  const sells = data?.orders.filter((o) => o.action === "sell") ?? [];

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader
        title="Technical bot"
        subtitle="DJIA 30 · prices, 5-day view, and suggested orders"
        right={
          <label className="flex items-center gap-2">
            <span className="sr-only">Ticker</span>
            <select
              value={symbol ?? "AAPL"}
              onChange={(event) => setSymbol(event.target.value)}
              className="h-8 max-w-[14rem] rounded-md border border-line bg-paper px-2 font-mono text-xs"
            >
              {DJIA.map((item) => (
                <option key={item.symbol} value={item.symbol}>
                  {item.symbol} · {item.name}
                </option>
              ))}
            </select>
          </label>
        }
      />

      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8">
        {error && !data ? (
          <div className="rounded-xl border border-line px-5 py-10">
            <p className="text-sm">Could not load the market.</p>
            <p className="mt-1 text-sm text-mute">{error}</p>
            <button
              type="button"
              onClick={() => setReload((n) => n + 1)}
              className="mt-4 h-8 rounded-md bg-ink px-3 text-xs text-paper"
            >
              Try again
            </button>
          </div>
        ) : !data ? (
          <Skeleton />
        ) : (
          <div className={loading ? "opacity-70" : ""}>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-mute">
              {data.quote.symbol} · DJIA 30 · {data.marketOpen ? "Market open" : "Market closed"} · {data.source}
            </p>
            <h2 className="mt-2 text-2xl font-medium tracking-tight">{data.quote.name}</h2>

            <div className="mt-6 flex flex-wrap items-end gap-x-6 gap-y-2">
              <p className="font-mono text-4xl tracking-tight sm:text-5xl">{formatMoney(data.quote.price)}</p>
              <p className={`pb-1 font-mono text-sm ${signedClass(data.quote.change)}`}>
                {formatMoney(data.quote.change)} ({formatPct(data.quote.changePct)}) today
              </p>
            </div>

            <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Open" value={formatMoney(data.quote.open)} />
              <Stat label="High" value={formatMoney(data.quote.high)} />
              <Stat label="Low" value={formatMoney(data.quote.low)} />
              <Stat label="Volume" value={formatVol(data.quote.volume)} />
            </dl>

            <section className="mt-8 rounded-xl border border-line p-4 sm:p-5">
              <PriceChart data={data} range={range} onRange={setRange} />
            </section>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <section className="rounded-xl border border-line p-5">
                <h3 className="text-sm font-medium">Model</h3>
                <p className="mt-3 text-[15px] leading-relaxed">{data.forecast.summary}</p>
                <p className="mt-3 text-sm text-mute">
                  Typical range {formatPct(data.forecast.lowPct, 1)} to {formatPct(data.forecast.highPct, 1)}
                  {" · "}
                  {Math.round(data.forecast.confidence * 100)}% of the signals agree
                </p>

                <dl className="mt-6 grid grid-cols-3 gap-3 border-t border-line pt-5">
                  <Stat label="Right direction" value={`${Math.round(data.performance.directionalAcc * 100)}%`} />
                  <Stat label="Sharpe" value={data.performance.sharpe.toFixed(2)} />
                  <Stat label="Worst drop" value={formatPct(data.performance.maxDrawdown * 100, 1)} />
                </dl>
                <p className="mt-4 text-xs text-mute">
                  Those three numbers are this model on the last year of {data.quote.symbol}, not a promise.
                  Horizon is 5 trading days, same as the bot.
                </p>
              </section>

              <section className="rounded-xl border border-line p-5">
                <h3 className="text-sm font-medium">Orders</h3>
                <p className="mt-1 text-sm text-mute">
                  Suggested size is capped at 15% of the book, per name.
                </p>

                <div
                  className={`mt-4 rounded-lg border px-3 py-3 ${
                    data.selected.action === "buy"
                      ? "border-up/30"
                      : data.selected.action === "sell"
                        ? "border-down/30"
                        : "border-line"
                  }`}
                >
                  <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-mute">
                    {data.quote.symbol} now
                  </p>
                  <p className="mt-1 text-sm">
                    <span className="font-medium capitalize">{data.selected.action}</span>
                    {data.selected.action !== "hold" ? ` · ${formatWeight(data.selected.weight)}` : null}
                  </p>
                  <p className="mt-1 text-sm text-mute">{data.selected.reason}</p>
                </div>

                <OrderGroup title="Buy" empty="No buy names right now." items={buys} />
                <OrderGroup title="Sell" empty="No sell names right now." items={sells} />
              </section>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-[0.16em] text-mute">{label}</dt>
      <dd className="mt-1 font-mono text-sm">{value}</dd>
    </div>
  );
}

function OrderGroup({
  title,
  empty,
  items,
}: {
  title: string;
  empty: string;
  items: DeskPayload["orders"];
}) {
  return (
    <div className="mt-5">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-mute">{title}</p>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-mute">{empty}</p>
      ) : (
        <ul className="mt-2 divide-y divide-line">
          {items.map((item) => (
            <li key={item.symbol} className="py-3">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm">
                  <span className="font-mono font-medium">{item.symbol}</span>
                  <span className="text-mute"> · {item.name}</span>
                  {item.isSelected ? <span className="text-mute"> · showing</span> : null}
                </p>
                <p className="shrink-0 font-mono text-xs">{formatWeight(item.weight)}</p>
              </div>
              <p className="mt-1 text-sm text-mute">{item.reason}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-3 w-48 rounded bg-line" />
      <div className="mt-3 h-8 w-40 rounded bg-line" />
      <div className="mt-6 h-12 w-56 rounded bg-line" />
      <div className="mt-8 h-56 rounded-xl border border-line" />
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="h-64 rounded-xl border border-line" />
        <div className="h-64 rounded-xl border border-line" />
      </div>
    </div>
  );
}
