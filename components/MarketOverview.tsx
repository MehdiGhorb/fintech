'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';

interface MarketStats {
  totalMarketCap: number;
  avgChange: number;
  activeStocks: number;
  topGainerChange: number;
  topLoserChange: number;
}

export default function MarketOverview() {
  const [stats, setStats] = useState<MarketStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/markets');
      const data = await response.json();

      const totalMarketCap = data.reduce((sum: number, stock: any) => 
        sum + (stock.marketCap || 0), 0
      );

      const avgChange = data.reduce((sum: number, stock: any) => 
        sum + stock.change24h, 0
      ) / data.length;

      const changes = data.map((s: any) => s.change24h).sort((a: number, b: number) => b - a);

      setStats({
        totalMarketCap,
        avgChange,
        activeStocks: data.length,
        topGainerChange: changes[0],
        topLoserChange: changes[changes.length - 1],
      });
    } catch (error) {
      console.error('Error fetching market stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-900 border-b border-gray-800 animate-pulse">
        <div className="container mx-auto px-4 py-3">
          <div className="h-6 bg-gray-800 rounded w-full"></div>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="bg-gray-900 border-b border-gray-800">
      <div className="container mx-auto px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Activity size={16} className="text-blue-400" />
            <span className="text-gray-400">Market Cap:</span>
            <span className="font-bold text-white">
              ${(stats.totalMarketCap / 1e12).toFixed(2)}T
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-gray-400">Avg 24h Change:</span>
            <span className={`font-bold flex items-center gap-1 ${
              stats.avgChange >= 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {stats.avgChange >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              {stats.avgChange >= 0 ? '+' : ''}{stats.avgChange.toFixed(2)}%
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-gray-400">Active Markets:</span>
            <span className="font-bold text-white">{stats.activeStocks}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-gray-400">Top Gainer:</span>
            <span className="font-bold text-green-400">
              +{stats.topGainerChange.toFixed(2)}%
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-gray-400">Top Loser:</span>
            <span className="font-bold text-red-400">
              {stats.topLoserChange.toFixed(2)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
