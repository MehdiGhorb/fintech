"use client";

import { useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { PriceChart, type RangeId } from "@/components/price-chart";
import { NAMES } from "@/lib/universe";
import { formatMoney, formatPct, signedClass } from "@/lib/format";
import type { DeskPayload } from "@/lib/types";

const STORAGE_KEY = "desk.symbol";

export function Dashboard() {
  const [symbol, setSymbol] = useState<string | null>(null);
  const [range, setRange] = useState<RangeId>("1M");
  const [data, setData] = useState<DeskPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    setSymbol(saved && NAMES.some((item) => item.symbol === saved) ? saved : "AAPL");
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

  const book = data?.book;
  const inBook = useMemo(
    () => new Set(book?.positions.map((p) => p.symbol) ?? []),
    [book],
  );

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader
        title="FinCast paper"
        subtitle="$1,000 · 50 names · 1-month horizon · long predicted-up, else cash"
        right={
          <label className="flex items-center gap-2">
            <span className="sr-only">Ticker</span>
            <select
              value={symbol ?? "AAPL"}
              onChange={(event) => setSymbol(event.target.value)}
              className="h-8 max-w-[16rem] rounded-md border border-line bg-paper px-2 font-mono text-xs"
            >
              {NAMES.map((item) => (
                <option key={item.symbol} value={item.symbol}>
                  {item.symbol} · {item.name}
                </option>
              ))}
            </select>
          </label>
        }
      />

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8">
        {error && !data ? (
          <div className="rounded-xl border border-line px-5 py-10">
            <p className="text-sm">Could not load the desk.</p>
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
            {book ? (
              <section className="mb-10">
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-mute">
                  Paper book · {book.model} · {book.broker} · origin {book.origin ?? "—"}
                </p>
                <div className="mt-4 flex flex-wrap items-end gap-x-8 gap-y-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-mute">Equity</p>
                    <p className="mt-1 font-mono text-4xl tracking-tight sm:text-5xl">
                      {formatMoney(book.equity)}
                    </p>
                  </div>
                  <p className={`pb-1 font-mono text-sm ${signedClass(book.pnl)}`}>
                    {formatMoney(book.pnl)} ({formatPct(book.pnlPct)}) vs $1,000
                  </p>
                </div>
                <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Stat label="Cash" value={formatMoney(book.cash)} />
                  <Stat label="Long" value={`${book.nLong} / ${book.nUniverse || 50}`} />
                  <Stat label="As of" value={book.asOf ?? "—"} />
                  <Stat label="Horizon" value={`${book.horizon} sessions`} />
                </dl>
              </section>
            ) : null}

            <section className="mb-10">
              <h2 className="text-sm font-medium">Open positions</h2>
              <p className="mt-1 text-sm text-mute">
                Equal-weight longs. Names FinCast sees down stay in cash until the next 21-session
                rebalance.
              </p>
              {!book?.positions.length ? (
                <p className="mt-4 text-sm text-mute">
                  No open longs yet. The GPU desk has not published a FinCast book.
                </p>
              ) : (
                <div className="mt-4 overflow-x-auto rounded-xl border border-line">
                  <table className="w-full min-w-[40rem] text-left text-sm">
                    <thead className="font-mono text-[11px] uppercase tracking-[0.14em] text-mute">
                      <tr className="border-b border-line">
                        <th className="px-3 py-2 font-medium">Name</th>
                        <th className="px-3 py-2 text-right font-medium">Shares</th>
                        <th className="px-3 py-2 text-right font-medium">Entry</th>
                        <th className="px-3 py-2 text-right font-medium">Last</th>
                        <th className="px-3 py-2 text-right font-medium">Value</th>
                        <th className="px-3 py-2 text-right font-medium">P&L</th>
                        <th className="px-3 py-2 text-right font-medium">FinCast 1m</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line font-mono">
                      {book.positions.map((p) => (
                        <tr
                          key={p.symbol}
                          className={`cursor-pointer hover:bg-line/40 ${
                            p.symbol === symbol ? "bg-line/50" : ""
                          }`}
                          onClick={() => setSymbol(p.symbol)}
                        >
                          <td className="px-3 py-2">
                            <span className="font-medium">{p.symbol}</span>
                            <span className="ml-2 font-sans text-mute">{p.name}</span>
                          </td>
                          <td className="px-3 py-2 text-right">{p.qty.toFixed(4)}</td>
                          <td className="px-3 py-2 text-right">{formatMoney(p.entry)}</td>
                          <td className="px-3 py-2 text-right">{formatMoney(p.last)}</td>
                          <td className="px-3 py-2 text-right">{formatMoney(p.value)}</td>
                          <td className={`px-3 py-2 text-right ${signedClass(p.pnl)}`}>
                            {formatMoney(p.pnl)} ({formatPct(p.pnlPct)})
                          </td>
                          <td className={`px-3 py-2 text-right ${signedClass(p.predRet)}`}>
                            {formatPct(p.predRet, 1)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-mute">
              {data.quote.symbol} · {inBook.has(data.quote.symbol) ? "in book" : "cash"} ·{" "}
              {data.marketOpen ? "Market open" : "Market closed"} · {data.source}
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
              <Stat label="Volume" value={formatVolSafe(data.quote.volume)} />
            </dl>

            <section className="mt-8 rounded-xl border border-line p-4 sm:p-5">
              <PriceChart data={data} range={range} onRange={setRange} />
            </section>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <section className="rounded-xl border border-line p-5">
                <h3 className="text-sm font-medium">This name</h3>
                <p className="mt-3 text-[15px] leading-relaxed">{data.forecast.summary}</p>
                <p className="mt-3 text-sm text-mute">{data.selected.reason}</p>
              </section>
              <section className="rounded-xl border border-line p-5">
                <h3 className="text-sm font-medium">Cash this month</h3>
                <p className="mt-1 text-sm text-mute">FinCast predicted down or flat. Not held.</p>
                <ul className="mt-3 max-h-64 divide-y divide-line overflow-auto">
                  {(book?.cashNames ?? []).map((n) => (
                    <li key={n.symbol} className="flex items-baseline justify-between gap-3 py-2">
                      <button
                        type="button"
                        className="text-left text-sm"
                        onClick={() => setSymbol(n.symbol)}
                      >
                        <span className="font-mono font-medium">{n.symbol}</span>
                        <span className="text-mute"> · {n.name}</span>
                      </button>
                      <span className={`font-mono text-xs ${signedClass(n.predRet)}`}>
                        {formatPct(n.predRet, 1)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            {book?.fills?.length ? (
              <section className="mt-8">
                <h3 className="text-sm font-medium">Fills</h3>
                <ul className="mt-3 divide-y divide-line rounded-xl border border-line">
                  {book.fills.slice(0, 24).map((f, i) => (
                    <li key={`${f.t}-${f.symbol}-${i}`} className="flex items-baseline justify-between gap-3 px-4 py-2.5">
                      <p className="text-sm">
                        <span className="font-mono font-medium uppercase">{f.side}</span>
                        <span className="text-mute"> · {f.symbol}</span>
                        <span className="text-mute"> · {f.note}</span>
                      </p>
                      <p className="shrink-0 font-mono text-xs">
                        {f.qty.toFixed(4)} @ {formatMoney(f.px)}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        )}
      </main>
    </div>
  );
}

function formatVolSafe(n: number) {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return n.toFixed(0);
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-[0.16em] text-mute">{label}</dt>
      <dd className="mt-1 font-mono text-sm">{value}</dd>
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
    </div>
  );
}
