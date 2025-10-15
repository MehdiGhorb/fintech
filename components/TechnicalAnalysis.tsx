'use client';

import { useMemo } from 'react';

interface TechnicalAnalysisProps {
  data: { timestamp: number; price: number }[];
  symbol: string;
}

export default function TechnicalAnalysis({ data, symbol }: TechnicalAnalysisProps) {
  const analysis = useMemo(() => {
    if (!data || data.length < 50) {
      return {
        sma20: 0,
        sma50: 0,
        rsi: 50,
        support: 0,
        resistance: 0,
        volatility: 0,
        trend: 'neutral' as const,
      };
    }

    const prices = data.map((d) => d.price);
    const recentPrices = prices.slice(-50);
    const currentPrice = prices[prices.length - 1];

    // Simple Moving Averages
    const sma20 = recentPrices.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const sma50 = recentPrices.reduce((a, b) => a + b, 0) / 50;

    // RSI Calculation (simplified)
    const changes = [];
    for (let i = 1; i < recentPrices.length; i++) {
      changes.push(recentPrices[i] - recentPrices[i - 1]);
    }
    const gains = changes.filter((c) => c > 0);
    const losses = changes.filter((c) => c < 0).map((c) => Math.abs(c));
    const avgGain = gains.length > 0 ? gains.reduce((a, b) => a + b, 0) / 14 : 0;
    const avgLoss = losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / 14 : 0;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsi = 100 - 100 / (1 + rs);

    // Support and Resistance
    const recent100 = prices.slice(-100);
    const support = Math.min(...recent100);
    const resistance = Math.max(...recent100);

    // Volatility (standard deviation)
    const mean = recentPrices.reduce((a, b) => a + b, 0) / recentPrices.length;
    const squareDiffs = recentPrices.map((price) => Math.pow(price - mean, 2));
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / recentPrices.length;
    const volatility = Math.sqrt(avgSquareDiff);

    // Trend determination
    let trend: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    if (currentPrice > sma20 && sma20 > sma50) {
      trend = 'bullish';
    } else if (currentPrice < sma20 && sma20 < sma50) {
      trend = 'bearish';
    }

    return {
      sma20,
      sma50,
      rsi,
      support,
      resistance,
      volatility,
      trend,
    };
  }, [data]);

  const getRSIColor = (rsi: number) => {
    if (rsi > 70) return 'text-red-400';
    if (rsi < 30) return 'text-green-400';
    return 'text-yellow-400';
  };

  const getTrendColor = (trend: string) => {
    if (trend === 'bullish') return 'text-green-400';
    if (trend === 'bearish') return 'text-red-400';
    return 'text-gray-400';
  };

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
      <h2 className="text-2xl font-bold mb-6">Technical Analysis</h2>
      
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Trend */}
        <div className="bg-gray-900/50 rounded-lg p-4">
          <div className="text-gray-400 text-sm mb-2">Market Trend</div>
          <div className={`text-2xl font-bold capitalize ${getTrendColor(analysis.trend)}`}>
            {analysis.trend}
          </div>
          <div className="text-xs text-gray-500 mt-2">
            Based on moving averages
          </div>
        </div>

        {/* RSI */}
        <div className="bg-gray-900/50 rounded-lg p-4">
          <div className="text-gray-400 text-sm mb-2">RSI (14)</div>
          <div className={`text-2xl font-bold ${getRSIColor(analysis.rsi)}`}>
            {analysis.rsi.toFixed(2)}
          </div>
          <div className="text-xs text-gray-500 mt-2">
            {analysis.rsi > 70 ? 'Overbought' : analysis.rsi < 30 ? 'Oversold' : 'Neutral'}
          </div>
        </div>

        {/* SMA 20 */}
        <div className="bg-gray-900/50 rounded-lg p-4">
          <div className="text-gray-400 text-sm mb-2">SMA 20</div>
          <div className="text-2xl font-bold">
            ${analysis.sma20.toFixed(2)}
          </div>
          <div className="text-xs text-gray-500 mt-2">
            20-day moving average
          </div>
        </div>

        {/* SMA 50 */}
        <div className="bg-gray-900/50 rounded-lg p-4">
          <div className="text-gray-400 text-sm mb-2">SMA 50</div>
          <div className="text-2xl font-bold">
            ${analysis.sma50.toFixed(2)}
          </div>
          <div className="text-xs text-gray-500 mt-2">
            50-day moving average
          </div>
        </div>

        {/* Support */}
        <div className="bg-gray-900/50 rounded-lg p-4">
          <div className="text-gray-400 text-sm mb-2">Support Level</div>
          <div className="text-2xl font-bold text-green-400">
            ${analysis.support.toFixed(2)}
          </div>
          <div className="text-xs text-gray-500 mt-2">
            100-day low
          </div>
        </div>

        {/* Resistance */}
        <div className="bg-gray-900/50 rounded-lg p-4">
          <div className="text-gray-400 text-sm mb-2">Resistance Level</div>
          <div className="text-2xl font-bold text-red-400">
            ${analysis.resistance.toFixed(2)}
          </div>
          <div className="text-xs text-gray-500 mt-2">
            100-day high
          </div>
        </div>
      </div>

      {/* Analysis Summary */}
      <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
        <h3 className="font-semibold text-blue-400 mb-2">Analysis Summary</h3>
        <p className="text-gray-300 text-sm">
          {analysis.trend === 'bullish' && 
            `${symbol} is showing bullish momentum with price above key moving averages. `}
          {analysis.trend === 'bearish' && 
            `${symbol} is in a bearish trend with price below moving averages. `}
          {analysis.trend === 'neutral' && 
            `${symbol} is trading in a neutral range. `}
          
          {analysis.rsi > 70 && 
            'RSI indicates overbought conditions, suggesting potential for pullback. '}
          {analysis.rsi < 30 && 
            'RSI shows oversold conditions, which may present a buying opportunity. '}
          {analysis.rsi >= 30 && analysis.rsi <= 70 && 
            'RSI is in neutral territory. '}
          
          Support is identified at ${analysis.support.toFixed(2)} with resistance at ${analysis.resistance.toFixed(2)}.
        </p>
        <p className="text-xs text-gray-500 mt-2">
          * This is for educational purposes only and not financial advice.
        </p>
      </div>
    </div>
  );
}
