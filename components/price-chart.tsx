"use client";

import { useMemo } from "react";
import { useTheme } from "next-themes";
import { Area, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DeskPayload } from "@/lib/types";
import { formatMoney } from "@/lib/format";

const RANGES = [
  { id: "1M", days: 22 },
  { id: "3M", days: 66 },
  { id: "6M", days: 132 },
  { id: "1Y", days: 260 },
] as const;

export type RangeId = (typeof RANGES)[number]["id"];

export function PriceChart({
  data,
  range,
  onRange,
}: {
  data: DeskPayload;
  range: RangeId;
  onRange: (id: RangeId) => void;
}) {
  const { theme } = useTheme();
  const dark = theme === "dark";
  const ink = dark ? "#f5f5f5" : "#171717";
  const mute = dark ? "#a3a3a3" : "#737373";
  const fill = dark ? "rgba(245,245,245,0.12)" : "rgba(10,10,10,0.08)";

  const chartData = useMemo(() => {
    const days = RANGES.find((item) => item.id === range)?.days ?? 132;
    const history = data.series.slice(-days).map((row) => ({
      date: row.date,
      price: row.close as number | undefined,
      forecast: undefined as number | undefined,
    }));
    if (history.length) {
      history[history.length - 1].forecast = history[history.length - 1].price;
    }
    const future = data.forecast.path.slice(1).map((row) => ({
      date: row.date,
      price: undefined as number | undefined,
      forecast: row.close,
    }));
    return [...history, ...future];
  }, [data, range]);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs text-mute">Solid line is history. Dotted line is FinCast’s next 21 sessions.</p>
        <div className="flex rounded-md border border-line p-0.5">
          {RANGES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onRange(item.id)}
              className={`h-7 rounded px-2 font-mono text-[11px] ${
                range === item.id ? "bg-ink text-paper" : "text-mute hover:text-ink"
              }`}
            >
              {item.id}
            </button>
          ))}
        </div>
      </div>
      <div className="h-56 w-full">
        <ResponsiveContainer>
          <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <XAxis dataKey="date" hide />
            <YAxis
              domain={["auto", "auto"]}
              width={64}
              tick={{ fill: mute, fontSize: 11, fontFamily: "var(--font-mono)" }}
              tickFormatter={(value: number) =>
                value >= 10000 ? `${(value / 1000).toFixed(0)}k` : Number(value).toFixed(0)
              }
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0].payload as { price?: number; forecast?: number };
                const value = row.price ?? row.forecast;
                if (value == null) return null;
                return (
                  <div className="rounded-md border border-line bg-paper px-2.5 py-1.5 text-xs">
                    <p className="font-mono text-mute">{String(label)}</p>
                    <p className="mt-0.5 font-mono">{formatMoney(value)}</p>
                  </div>
                );
              }}
            />
            <Area
              type="monotone"
              dataKey="price"
              stroke={ink}
              strokeWidth={1.5}
              fill={fill}
              isAnimationActive={false}
              connectNulls={false}
            />
            <Line
              type="monotone"
              dataKey="forecast"
              stroke={ink}
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
              isAnimationActive={false}
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
