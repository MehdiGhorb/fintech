'use client';

import { useEffect, useRef } from 'react';
import { createChart, ColorType, IChartApi } from 'lightweight-charts';

interface MiniChartProps {
  symbol: string;
  price: number;
  change24h: number;
}

export default function MiniChart({ symbol, price, change24h }: MiniChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#6B7280',
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

    const lineSeries = chart.addLineSeries({
      color: change24h >= 0 ? '#10B981' : '#EF4444',
      lineWidth: 2,
    });

    // Generate mock price data for demonstration
    const now = Date.now() / 1000;
    const data = [];
    const basePrice = price / (1 + change24h / 100);
    
    for (let i = 30; i >= 0; i--) {
      const time = now - i * 24 * 60 * 60;
      const randomVariation = (Math.random() - 0.5) * (price * 0.02);
      const progressTowardChange = (30 - i) / 30;
      const calculatedPrice = basePrice + (basePrice * change24h / 100) * progressTowardChange + randomVariation;
      
      data.push({
        time: time as any,
        value: calculatedPrice,
      });
    }

    lineSeries.setData(data);
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
  }, [symbol, price, change24h]);

  return <div ref={chartContainerRef} className="w-full" />;
}
