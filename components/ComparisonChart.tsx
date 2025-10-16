'use client';

import { useEffect, useRef } from 'react';
import { createChart, ColorType, IChartApi } from 'lightweight-charts';

interface StockData {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
}

interface ComparisonChartProps {
  stocks: StockData[];
}

const CHART_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444'];

export default function ComparisonChart({ stocks }: ComparisonChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current || stocks.length === 0) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#9CA3AF',
      },
      grid: {
        vertLines: { color: '#1F2937' },
        horzLines: { color: '#1F2937' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 320,
      timeScale: {
        borderColor: '#374151',
      },
      rightPriceScale: {
        borderColor: '#374151',
      },
    });

    // Create a line series for each stock
    stocks.forEach((stock, index) => {
      const lineSeries = chart.addLineSeries({
        color: CHART_COLORS[index % CHART_COLORS.length],
        lineWidth: 2,
        title: stock.symbol,
      });

      // Generate mock data for comparison
      const now = Date.now() / 1000;
      const data = [];
      const basePrice = stock.price / (1 + stock.change24h / 100);

      for (let i = 30; i >= 0; i--) {
        const time = now - i * 24 * 60 * 60;
        const randomVariation = (Math.random() - 0.5) * (stock.price * 0.02);
        const progressTowardChange = (30 - i) / 30;
        const calculatedPrice = basePrice + (basePrice * stock.change24h / 100) * progressTowardChange + randomVariation;

        data.push({
          time: time as any,
          value: calculatedPrice,
        });
      }

      lineSeries.setData(data);
    });

    chart.timeScale().fitContent();
    chartRef.current = chart;

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [stocks]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 flex-wrap">
        {stocks.map((stock, index) => (
          <div key={stock.symbol} className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
            />
            <span className="text-sm font-medium text-gray-300">{stock.symbol}</span>
            <span className={`text-xs ${stock.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {stock.change24h >= 0 ? '+' : ''}{stock.change24h.toFixed(2)}%
            </span>
          </div>
        ))}
      </div>
      <div ref={chartContainerRef} className="w-full" />
    </div>
  );
}
