'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { TrendingUp, TrendingDown, Search, Star, StarOff, ChevronDown, ChevronUp } from 'lucide-react';

interface Asset {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  change7d?: number;
  marketCap?: number;
  volume24h?: number;
  circulatingSupply?: number;
  type: 'stock' | 'crypto' | 'etf' | 'commodity';
  rank?: number;
}

type SortKey = 'rank' | 'name' | 'price' | 'change24h' | 'change7d' | 'marketCap' | 'volume24h';
type SortOrder = 'asc' | 'desc';

export default function MarketsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'stock' | 'crypto' | 'etf' | 'commodity'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [watchlist, setWatchlist] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>('rank');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  useEffect(() => {
    fetchMarketData();
    // Load watchlist from localStorage
    const saved = localStorage.getItem('market_watchlist');
    if (saved) {
      setWatchlist(new Set(JSON.parse(saved)));
    }
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

  const toggleWatchlist = (assetId: string) => {
    const newWatchlist = new Set(watchlist);
    if (newWatchlist.has(assetId)) {
      newWatchlist.delete(assetId);
    } else {
      newWatchlist.add(assetId);
    }
    setWatchlist(newWatchlist);
    localStorage.setItem('market_watchlist', JSON.stringify(Array.from(newWatchlist)));
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('desc');
    }
  };

  const sortedAssets = [...assets].sort((a, b) => {
    let aVal: any = a[sortKey];
    let bVal: any = b[sortKey];
    
    if (aVal === undefined) aVal = 0;
    if (bVal === undefined) bVal = 0;
    
    if (sortKey === 'name') {
      aVal = a.name.toLowerCase();
      bVal = b.name.toLowerCase();
    }
    
    if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const filteredAssets = sortedAssets.filter((asset) => {
    const matchesFilter = filter === 'all' || asset.type === filter;
    const matchesSearch = 
      asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.symbol.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const formatNumber = (num: number, decimals: number = 2) => {
    return num.toLocaleString(undefined, { 
      minimumFractionDigits: decimals, 
      maximumFractionDigits: decimals 
    });
  };

  const formatLargeNumber = (num?: number) => {
    if (!num) return 'N/A';
    if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    return `$${num.toFixed(2)}`;
  };

  const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
    if (sortKey !== columnKey) return <ChevronDown size={14} className="opacity-30" />;
    return sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
  };

  // Mini Line Chart Component (SVG-based sparkline)
  const MiniLineChart = ({ change7d }: { change7d?: number }) => {
    // Generate realistic price movement data
    const points = 20;
    const data: number[] = [];
    let value = 100;
    
    for (let i = 0; i < points; i++) {
      const randomChange = (Math.random() - 0.5) * 8;
      value += randomChange;
      data.push(Math.max(0, value));
    }
    
    // Normalize data to fit in our SVG viewBox
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    
    // Create SVG path
    const width = 120;
    const height = 40;
    const padding = 2;
    
    const points_str = data
      .map((val, i) => {
        const x = (i / (data.length - 1)) * (width - 2 * padding) + padding;
        const y = height - padding - ((val - min) / range) * (height - 2 * padding);
        return `${x},${y}`;
      })
      .join(' ');
    
    const isPositive = change7d ? change7d >= 0 : Math.random() > 0.5;
    const color = isPositive ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)';
    
    return (
      <svg width={width} height={height} className="overflow-visible">
        <polyline
          points={points_str}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  };

  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-[1600px] mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-1">
            Today's Cryptocurrency Prices by Market Cap
          </h1>
          <p className="text-gray-400 text-sm">
            The global crypto market cap is <span className="text-white font-semibold">$2.5T</span>, a{' '}
            <span className="text-green-400 font-semibold">+2.31%</span> increase over the last day.
          </p>
        </div>

        {/* Filters and Search */}
        <div className="flex flex-col md:flex-row gap-3 mb-4">
          <div className="flex gap-1.5 overflow-x-auto">
            {[
              { key: 'all', label: 'All' },
              { key: 'crypto', label: 'Cryptocurrencies' },
              { key: 'stock', label: 'Stocks' },
              { key: 'etf', label: 'ETFs' },
              { key: 'commodity', label: 'Commodities' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key as any)}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap text-xs ${
                  filter === tab.key
                    ? 'bg-white text-black'
                    : 'bg-gray-900/50 text-gray-400 hover:bg-gray-800 border border-gray-800/50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative flex-1 md:max-w-xs">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={18} />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-gray-900/50 border border-gray-800/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-600 text-xs"
            />
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="bg-gray-900/30 border border-gray-800/50 rounded-xl overflow-hidden">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="border-b border-gray-800/50 px-4 py-3.5 animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="h-4 bg-gray-800 rounded w-8"></div>
                  <div className="h-8 w-8 bg-gray-800 rounded-full"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-800 rounded w-32 mb-2"></div>
                    <div className="h-3 bg-gray-800 rounded w-20"></div>
                  </div>
                  <div className="h-5 bg-gray-800 rounded w-24"></div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-gray-900/30 border border-gray-800/50 rounded-xl overflow-hidden shadow-xl">
            {/* Table Header */}
            <div className="hidden md:grid md:grid-cols-[auto_50px_2fr_1fr_1fr_1fr_1.5fr_1.5fr_120px] gap-4 px-4 py-3 border-b border-gray-800 bg-gray-900/50">
              <div className="text-gray-400 text-xs font-medium"></div>
              <div className="text-gray-400 text-xs font-medium text-left">#</div>
              <button 
                onClick={() => handleSort('name')}
                className="text-gray-400 text-xs font-medium text-left flex items-center gap-1 hover:text-white transition-colors"
              >
                Name <SortIcon columnKey="name" />
              </button>
              <button 
                onClick={() => handleSort('price')}
                className="text-gray-400 text-xs font-medium text-right flex items-center justify-end gap-1 hover:text-white transition-colors"
              >
                Price <SortIcon columnKey="price" />
              </button>
              <button 
                onClick={() => handleSort('change24h')}
                className="text-gray-400 text-xs font-medium text-right flex items-center justify-end gap-1 hover:text-white transition-colors"
              >
                24h % <SortIcon columnKey="change24h" />
              </button>
              <button 
                onClick={() => handleSort('change7d')}
                className="text-gray-400 text-xs font-medium text-right flex items-center justify-end gap-1 hover:text-white transition-colors"
              >
                7d % <SortIcon columnKey="change7d" />
              </button>
              <button 
                onClick={() => handleSort('marketCap')}
                className="text-gray-400 text-xs font-medium text-right flex items-center justify-end gap-1 hover:text-white transition-colors"
              >
                Market Cap <SortIcon columnKey="marketCap" />
              </button>
              <button 
                onClick={() => handleSort('volume24h')}
                className="text-gray-400 text-xs font-medium text-right flex items-center justify-end gap-1 hover:text-white transition-colors"
              >
                Volume(24h) <SortIcon columnKey="volume24h" />
              </button>
              <div className="text-gray-400 text-xs font-medium text-center">Last 7 Days</div>
            </div>

            {/* Table Body */}
            {filteredAssets.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                No assets found matching your criteria
              </div>
            ) : (
              filteredAssets.map((asset, index) => (
                <Link
                  key={asset.id}
                  href={`/markets/${asset.id}`}
                  className="grid grid-cols-1 md:grid-cols-[auto_50px_2fr_1fr_1fr_1fr_1.5fr_1.5fr_120px] gap-4 px-4 py-3 border-b border-gray-800/30 hover:bg-gray-800/20 transition-all group cursor-pointer"
                >
                  {/* Watchlist Star */}
                  <div className="hidden md:flex items-center">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        toggleWatchlist(asset.id);
                      }}
                      className="text-gray-700 hover:text-yellow-400 transition-colors"
                      aria-label="Add to watchlist"
                    >
                      {watchlist.has(asset.id) ? (
                        <Star size={16} className="fill-yellow-400 text-yellow-400" />
                      ) : (
                        <StarOff size={16} />
                      )}
                    </button>
                  </div>

                  {/* Rank */}
                  <div className="hidden md:flex items-center text-gray-500 text-xs font-medium">
                    {asset.rank || index + 1}
                  </div>

                  {/* Name & Symbol */}
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-[10px] flex-shrink-0">
                      {asset.symbol.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-white font-medium text-sm group-hover:text-blue-400 transition-colors truncate">
                        {asset.name}
                      </div>
                      <div className="text-gray-500 text-xs font-medium">{asset.symbol}</div>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="flex items-center justify-start md:justify-end">
                    <span className="text-white font-medium text-sm">
                      ${formatNumber(asset.price, asset.price > 100 ? 2 : asset.price > 1 ? 4 : 6)}
                    </span>
                  </div>

                  {/* 24h Change */}
                  <div className="flex items-center justify-start md:justify-end">
                    <div className={`flex items-center gap-0.5 font-medium text-sm ${
                      asset.change24h >= 0 ? 'text-green-500' : 'text-red-500'
                    }`}>
                      {asset.change24h >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                      {asset.change24h >= 0 ? '+' : ''}{formatNumber(asset.change24h)}%
                    </div>
                  </div>

                  {/* 7d Change */}
                  <div className="hidden md:flex items-center justify-end">
                    {asset.change7d !== undefined ? (
                      <div className={`font-medium text-sm ${
                        asset.change7d >= 0 ? 'text-green-500' : 'text-red-500'
                      }`}>
                        {asset.change7d >= 0 ? '+' : ''}{formatNumber(asset.change7d)}%
                      </div>
                    ) : (
                      <span className="text-gray-700 text-sm">--</span>
                    )}
                  </div>

                  {/* Market Cap */}
                  <div className="hidden md:flex items-center justify-end">
                    <span className="text-gray-300 text-sm">
                      {formatLargeNumber(asset.marketCap)}
                    </span>
                  </div>

                  {/* Volume 24h */}
                  <div className="hidden md:flex items-center justify-end">
                    <div className="text-right">
                      <div className="text-gray-300 text-sm">
                        {formatLargeNumber(asset.volume24h)}
                      </div>
                      {asset.circulatingSupply && (
                        <div className="text-gray-600 text-xs">
                          {formatLargeNumber(asset.circulatingSupply)} {asset.symbol}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Mini Line Chart */}
                  <div className="hidden md:flex items-center justify-center">
                    <MiniLineChart change7d={asset.change7d} />
                  </div>
                </Link>
              ))
            )}
          </div>
        )}

        {/* Pagination Info */}
        <div className="mt-4 text-center text-gray-500 text-xs">
          Showing 1 - {filteredAssets.length} out of {filteredAssets.length}
        </div>
      </div>
    </div>
  );
}
