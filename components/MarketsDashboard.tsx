'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface Asset {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  type: 'stock' | 'crypto';
}

export default function MarketsDashboard() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMarketData();
  }, []);

  const fetchMarketData = async () => {
    try {
      const response = await fetch('/api/markets');
      const data = await response.json();
      setAssets(data);
    } catch (error) {
      console.error('Error fetching market data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4">
        {[...Array(10)].map((_, i) => (
          <div key={i} className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 animate-pulse">
            <div className="h-4 bg-gray-700 rounded w-3/4 mb-3"></div>
            <div className="h-6 bg-gray-700 rounded w-1/2 mb-2"></div>
            <div className="h-4 bg-gray-700 rounded w-1/4"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4">
      {assets.map((asset) => (
        <Link
          key={asset.id}
          href={`/markets/${asset.id}`}
          className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 hover:border-blue-500 transition-all hover:shadow-lg hover:shadow-blue-500/10 cursor-pointer group"
        >
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="text-xs text-gray-500 uppercase mb-1">{asset.type}</div>
              <div className="font-semibold text-gray-200 group-hover:text-blue-400 transition-colors">
                {asset.symbol}
              </div>
              <div className="text-xs text-gray-500">{asset.name}</div>
            </div>
            {asset.change24h >= 0 ? (
              <TrendingUp className="text-green-400" size={20} />
            ) : (
              <TrendingDown className="text-red-400" size={20} />
            )}
          </div>

          <div className="text-2xl font-bold mb-2">
            ${asset.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>

          <div className={`text-sm font-medium ${asset.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {asset.change24h >= 0 ? '+' : ''}{asset.change24h.toFixed(2)}%
          </div>
        </Link>
      ))}
    </div>
  );
}
