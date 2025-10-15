'use client';

import { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, CrosshairMode, IChartApi, ISeriesApi } from 'lightweight-charts';
import { TrendingUp, TrendingDown, BarChart3, LineChart as LineChartIcon, CandlestickChart } from 'lucide-react';

interface ChartData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface AdvancedChartProps {
  data: ChartData[];
  symbol: string;
}

export default function AdvancedChart({ data, symbol }: AdvancedChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [chartType, setChartType] = useState<'candlestick' | 'line' | 'area'>('candlestick');
  const [showVolume, setShowVolume] = useState(true);
  const [showMA, setShowMA] = useState(true);

  useEffect(() => {
    if (!chartContainerRef.current || !data || data.length === 0) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#9ca3af',
      },
      grid: {
        vertLines: { color: '#1f2937' },
        horzLines: { color: '#1f2937' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: '#6366f1',
          width: 1,
          style: 3,
          labelBackgroundColor: '#6366f1',
        },
        horzLine: {
          color: '#6366f1',
          width: 1,
          style: 3,
          labelBackgroundColor: '#6366f1',
        },
      },
      rightPriceScale: {
        borderColor: '#2d3748',
        scaleMargins: {
          top: 0.1,
          bottom: showVolume ? 0.3 : 0.1,
        },
      },
      timeScale: {
        borderColor: '#2d3748',
        timeVisible: true,
        secondsVisible: false,
      },
      width: chartContainerRef.current.clientWidth,
      height: 500,
    });

    chartRef.current = chart;

    // Prepare candlestick data (data already in correct format from API)
    const candleData = data.map(d => ({
      time: d.time,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }));

    const lineData = data.map(d => ({
      time: d.time,
      value: d.close, // Use close price for line chart
    }));

    let mainSeries: ISeriesApi<any>;

    if (chartType === 'candlestick') {
      mainSeries = chart.addCandlestickSeries({
        upColor: '#10b981',
        downColor: '#ef4444',
        borderVisible: false,
        wickUpColor: '#10b981',
        wickDownColor: '#ef4444',
      });
      mainSeries.setData(candleData);
    } else if (chartType === 'line') {
      mainSeries = chart.addLineSeries({
        color: '#3b82f6',
        lineWidth: 2,
      });
      mainSeries.setData(lineData);
    } else {
      mainSeries = chart.addAreaSeries({
        topColor: 'rgba(59, 130, 246, 0.4)',
        bottomColor: 'rgba(59, 130, 246, 0.0)',
        lineColor: '#3b82f6',
        lineWidth: 2,
      });
      mainSeries.setData(lineData);
    }

    // Add Moving Averages
    if (showMA && lineData.length > 20) {
      const ma20Data = calculateMA(lineData, 20);
      const ma50Data = calculateMA(lineData, 50);

      const ma20Series = chart.addLineSeries({
        color: '#f59e0b',
        lineWidth: 1,
        title: 'MA20',
      });
      ma20Series.setData(ma20Data);

      if (lineData.length > 50) {
        const ma50Series = chart.addLineSeries({
          color: '#8b5cf6',
          lineWidth: 1,
          title: 'MA50',
        });
        ma50Series.setData(ma50Data);
      }
    }

    // Add Volume
    if (showVolume) {
      const volumeSeries = chart.addHistogramSeries({
        color: '#6366f1',
        priceFormat: {
          type: 'volume',
        },
        priceScaleId: 'volume',
      });

      chart.priceScale('volume').applyOptions({
        scaleMargins: {
          top: 0.8,
          bottom: 0,
        },
      });

      const volumeData = data.map((d, i) => {
        const prevClose = i > 0 ? data[i - 1].close : d.close;
        return {
          time: d.time,
          value: d.volume,
          color: d.close >= prevClose ? 'rgba(16, 185, 129, 0.5)' : 'rgba(239, 68, 68, 0.5)',
        };
      });

      volumeSeries.setData(volumeData);
    }

    chart.timeScale().fitContent();

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
  }, [data, chartType, showVolume, showMA]);

  const calculateMA = (data: any[], period: number) => {
    const result = [];
    for (let i = period - 1; i < data.length; i++) {
      const sum = data.slice(i - period + 1, i + 1).reduce((acc, val) => acc + val.value, 0);
      result.push({
        time: data[i].time,
        value: sum / period,
      });
    }
    return result;
  };

  const priceChange = data.length > 1 ? data[data.length - 1].close - data[0].close : 0;
  const priceChangePercent = data.length > 1 ? (priceChange / data[0].close) * 100 : 0;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      {/* Chart Header */}
      <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold">{symbol}</h3>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold">
              ${data.length > 0 ? data[data.length - 1].close.toFixed(2) : '0.00'}
            </span>
            <div className={`flex items-center gap-1 text-sm font-medium ${
              priceChangePercent >= 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {priceChangePercent >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
              <span>{priceChangePercent >= 0 ? '+' : ''}{priceChangePercent.toFixed(2)}%</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Chart Type Selector */}
          <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setChartType('candlestick')}
              className={`p-2 rounded transition-colors ${
                chartType === 'candlestick' ? 'bg-blue-500 text-white' : 'text-gray-400 hover:text-white'
              }`}
              title="Candlestick"
            >
              <CandlestickChart size={18} />
            </button>
            <button
              onClick={() => setChartType('line')}
              className={`p-2 rounded transition-colors ${
                chartType === 'line' ? 'bg-blue-500 text-white' : 'text-gray-400 hover:text-white'
              }`}
              title="Line"
            >
              <LineChartIcon size={18} />
            </button>
            <button
              onClick={() => setChartType('area')}
              className={`p-2 rounded transition-colors ${
                chartType === 'area' ? 'bg-blue-500 text-white' : 'text-gray-400 hover:text-white'
              }`}
              title="Area"
            >
              <BarChart3 size={18} />
            </button>
          </div>

          {/* Indicators */}
          <div className="flex gap-2">
            <button
              onClick={() => setShowMA(!showMA)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                showMA ? 'bg-blue-500 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              MA
            </button>
            <button
              onClick={() => setShowVolume(!showVolume)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                showVolume ? 'bg-blue-500 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              Vol
            </button>
          </div>
        </div>
      </div>

      {/* Chart Container */}
      <div ref={chartContainerRef} className="relative" />

      {/* Legend */}
      {showMA && (
        <div className="px-6 py-3 border-t border-gray-800 flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 bg-amber-500"></div>
            <span className="text-gray-400">MA20</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 bg-purple-500"></div>
            <span className="text-gray-400">MA50</span>
          </div>
        </div>
      )}
    </div>
  );
}
