'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { TrendingUp, TrendingDown, ArrowLeft } from 'lucide-react';
import AssistantPanel from '@/components/AssistantPanel';

interface Asset {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  type: 'stock' | 'crypto';
}

export default function MarketsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'stock' | 'crypto'>('all');

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

  const filteredAssets = assets.filter((asset) => 
    filter === 'all' || asset.type === filter
  );

  return (
    <>
      <div className="container mx-auto px-4 py-8">
      <Link 
        href="/"
        className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft size={20} />
        Back to Home
      </Link>

      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4">Markets</h1>
        <p className="text-gray-400 mb-6">
          Real-time market data for popular stocks and cryptocurrencies
        </p>

        <div className="flex gap-3">
          <button
            onClick={() => setFilter('all')}
            className={`px-6 py-2 rounded-lg font-medium transition-all ${
              filter === 'all'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            All Assets
          </button>
          <button
            onClick={() => setFilter('stock')}
            className={`px-6 py-2 rounded-lg font-medium transition-all ${
              filter === 'stock'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            Stocks
          </button>
          <button
            onClick={() => setFilter('crypto')}
            className={`px-6 py-2 rounded-lg font-medium transition-all ${
              filter === 'crypto'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            Crypto
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 animate-pulse">
              <div className="h-4 bg-gray-700 rounded w-3/4 mb-3"></div>
              <div className="h-8 bg-gray-700 rounded w-1/2 mb-2"></div>
              <div className="h-4 bg-gray-700 rounded w-1/4"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredAssets.map((asset) => (
            <Link
              key={asset.id}
              href={`/markets/${asset.id}`}
              className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 hover:border-blue-500 transition-all hover:shadow-lg hover:shadow-blue-500/10 cursor-pointer group"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="text-xs text-gray-500 uppercase mb-1">{asset.type}</div>
                  <div className="text-xl font-bold text-gray-200 group-hover:text-blue-400 transition-colors">
                    {asset.symbol}
                  </div>
                  <div className="text-sm text-gray-500">{asset.name}</div>
                </div>
                {asset.change24h >= 0 ? (
                  <TrendingUp className="text-green-400" size={24} />
                ) : (
                  <TrendingDown className="text-red-400" size={24} />
                )}
              </div>

              <div className="text-3xl font-bold mb-2">
                ${asset.price.toLocaleString(undefined, { 
                  minimumFractionDigits: 2, 
                  maximumFractionDigits: asset.price > 100 ? 2 : 6 
                })}
              </div>

              <div className={`text-lg font-medium ${asset.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {asset.change24h >= 0 ? '+' : ''}{asset.change24h.toFixed(2)}%
                <span className="text-sm text-gray-500 ml-2">24h</span>
              </div>
            </Link>
          ))}
        </div>
      )}
      </div>

      <AssistantPanel context={{ page: 'markets' }} />
    </>
  );
}
