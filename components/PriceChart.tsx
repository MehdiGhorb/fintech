'use client';

import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';

interface PriceChartProps {
  data: { timestamp: number; price: number }[];
  timeframe: '1D' | '1W' | '1M' | '3M' | '1Y' | '5Y';
}

export default function PriceChart({ data, timeframe }: PriceChartProps) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];

    const now = Date.now();
    const timeRanges = {
      '1D': 24 * 60 * 60 * 1000,
      '1W': 7 * 24 * 60 * 60 * 1000,
      '1M': 30 * 24 * 60 * 60 * 1000,
      '3M': 90 * 24 * 60 * 60 * 1000,
      '1Y': 365 * 24 * 60 * 60 * 1000,
      '5Y': 5 * 365 * 24 * 60 * 60 * 1000,
    };

    const cutoffTime = now - timeRanges[timeframe];
    const filtered = data.filter((d) => d.timestamp >= cutoffTime);

    return filtered.map((d) => ({
      timestamp: d.timestamp,
      price: d.price,
      date: format(new Date(d.timestamp), timeframe === '1D' ? 'HH:mm' : 'MMM dd, yyyy'),
    }));
  }, [data, timeframe]);

  const priceChange = useMemo(() => {
    if (chartData.length < 2) return 0;
    const first = chartData[0].price;
    const last = chartData[chartData.length - 1].price;
    return ((last - first) / first) * 100;
  }, [chartData]);

  const isPositive = priceChange >= 0;

  return (
    <div>
      <div className="mb-4">
        <span className={`text-2xl font-bold ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
          {isPositive ? '+' : ''}{priceChange.toFixed(2)}%
        </span>
        <span className="text-gray-400 ml-2">for selected period</span>
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis 
            dataKey="date" 
            stroke="#666"
            tick={{ fill: '#999' }}
          />
          <YAxis 
            stroke="#666"
            tick={{ fill: '#999' }}
            domain={['auto', 'auto']}
            tickFormatter={(value) => `$${value.toLocaleString()}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1a1a1a',
              border: '1px solid #333',
              borderRadius: '8px',
              color: '#fff',
            }}
            formatter={(value: number) => [`$${value.toFixed(2)}`, 'Price']}
          />
          <Line
            type="monotone"
            dataKey="price"
            stroke={isPositive ? '#4ade80' : '#f87171'}
            strokeWidth={2}
            dot={false}
            animationDuration={300}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
