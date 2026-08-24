"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { mockAccuracy, mockCompany, mockNews, mockSeries } from "@/lib/market";
import type { Instrument } from "@/lib/types";

export function MarketPane({ instrument }: { instrument: Instrument }) {
  const series = mockSeries(instrument);
  const last = series[series.length - 1];
  const prev = series[series.length - 2];
  const change = last && prev ? last.close / prev.close - 1 : 0;
  const news = mockNews(instrument);
  const company = mockCompany(instrument);
  const accuracy = mockAccuracy();

  return (
    <div className="h-full overflow-y-auto px-5 py-5">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-mute">
            {instrument.venue} · {instrument.kind}
          </p>
          <h2 className="mt-1 text-2xl font-medium tracking-tight">
            {instrument.symbol}
            <span className="ml-3 text-base font-normal text-mute">{instrument.name}</span>
          </h2>
        </div>
        {last && (
          <div className="text-right">
            <div className="font-mono text-2xl">{last.close.toFixed(2)}</div>
            <div className="font-mono text-sm text-mute">
              {change >= 0 ? "+" : ""}
              {(change * 100).toFixed(2)}%
            </div>
          </div>
        )}
      </div>

      <section className="rounded-xl border border-line p-4">
        <h3 className="text-sm font-medium">Price</h3>
        <p className="mb-3 text-xs text-mute">Placeholder series for UI review. Live feed is not wired yet.</p>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series}>
              <CartesianGrid stroke="rgb(var(--line))" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "rgb(var(--mute))" }} minTickGap={28} />
              <YAxis
                domain={["auto", "auto"]}
                tick={{ fontSize: 11, fill: "rgb(var(--mute))" }}
                width={56}
              />
              <Tooltip
                contentStyle={{
                  background: "rgb(var(--paper))",
                  border: "1px solid rgb(var(--line))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Line type="monotone" dataKey="close" stroke="rgb(var(--ink))" strokeWidth={1.4} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <section className="rounded-xl border border-line p-4">
          <h3 className="text-sm font-medium">Predictions</h3>
          <p className="mt-1 text-xs text-mute">Empty until a Trading agent runs.</p>
          <div className="mt-4 space-y-3 font-mono text-sm">
            <Row k="Horizon" v="21 sessions" />
            <Row k="Bias" v="—" />
            <Row k="Confidence" v="—" />
            <Row k="Last signal" v="Idle" />
          </div>
        </section>

        <section className="rounded-xl border border-line p-4">
          <h3 className="text-sm font-medium">Accuracy</h3>
          <p className="mt-1 text-xs text-mute">Shown after walk-forward results exist.</p>
          <div className="mt-4 space-y-3 font-mono text-sm">
            {accuracy.map((item) => (
              <Row key={item.label} k={item.label} v={item.value} />
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-line p-4">
          <h3 className="text-sm font-medium">Company</h3>
          <div className="mt-4 space-y-3 font-mono text-sm">
            {company.map(([k, v]) => (
              <Row key={k} k={k} v={v} />
            ))}
          </div>
        </section>
      </div>

      <section className="mt-4 rounded-xl border border-line p-4">
        <h3 className="text-sm font-medium">News</h3>
        <p className="mt-1 text-xs text-mute">Placeholder headlines for layout only.</p>
        <ul className="mt-4 divide-y divide-line">
          {news.map((item) => (
            <li key={item.title} className="flex gap-4 py-3">
              <span className="w-12 shrink-0 font-mono text-xs text-mute">{item.time}</span>
              <div>
                <p className="text-sm">{item.title}</p>
                <p className="mt-0.5 text-xs text-mute">{item.source}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-mute">{k}</span>
      <span className="text-right">{v}</span>
    </div>
  );
}
