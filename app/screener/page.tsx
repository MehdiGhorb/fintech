'use client';

import { useState, useEffect } from 'react';
import { Filter, Search, TrendingUp, TrendingDown } from 'lucide-react';
import Link from 'next/link';
import AssistantPanel from '@/components/AssistantPanel';

interface Stock {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  marketCap?: number;
  volume24h: number;
  peRatio?: number;
  sector?: string;
}

export default function ScreenerPage() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [filteredStocks, setFilteredStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minMarketCap, setMinMarketCap] = useState('');
  const [maxMarketCap, setMaxMarketCap] = useState('');
  const [minPE, setMinPE] = useState('');
  const [maxPE, setMaxPE] = useState('');
  const [minVolume, setMinVolume] = useState('');
  const [sector, setSector] = useState('all');

  useEffect(() => {
    fetchStocks();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [stocks, searchTerm, minPrice, maxPrice, minMarketCap, maxMarketCap, minPE, maxPE, minVolume, sector]);

  const fetchStocks = async () => {
    try {
      const response = await fetch('/api/markets');
      const data = await response.json();
      setStocks(data);
      setFilteredStocks(data);
    } catch (error) {
      console.error('Error fetching stocks:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...stocks];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(stock => 
        stock.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
        stock.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Price filter
    if (minPrice) {
      filtered = filtered.filter(stock => stock.price >= parseFloat(minPrice));
    }
    if (maxPrice) {
      filtered = filtered.filter(stock => stock.price <= parseFloat(maxPrice));
    }

    // Market cap filter
    if (minMarketCap) {
      filtered = filtered.filter(stock => stock.marketCap && stock.marketCap >= parseFloat(minMarketCap) * 1e9);
    }
    if (maxMarketCap) {
      filtered = filtered.filter(stock => stock.marketCap && stock.marketCap <= parseFloat(maxMarketCap) * 1e9);
    }

    // P/E ratio filter
    if (minPE) {
      filtered = filtered.filter(stock => stock.peRatio && stock.peRatio >= parseFloat(minPE));
    }
    if (maxPE) {
      filtered = filtered.filter(stock => stock.peRatio && stock.peRatio <= parseFloat(maxPE));
    }

    // Volume filter
    if (minVolume) {
      filtered = filtered.filter(stock => stock.volume24h >= parseFloat(minVolume) * 1e6);
    }

    // Sector filter
    if (sector !== 'all') {
      filtered = filtered.filter(stock => stock.sector === sector);
    }

    setFilteredStocks(filtered);
  };

  const resetFilters = () => {
    setSearchTerm('');
    setMinPrice('');
    setMaxPrice('');
    setMinMarketCap('');
    setMaxMarketCap('');
    setMinPE('');
    setMaxPE('');
    setMinVolume('');
    setSector('all');
  };

  if (loading) {
    return (
      <>
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-700 rounded w-1/4 mb-8"></div>
            <div className="h-64 bg-gray-800 rounded-xl mb-6"></div>
          </div>
        </div>
        <AssistantPanel context={{ page: 'screener' }} />
      </>
    );
  }

  return (
    <>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Stock Screener</h1>
          <p className="text-gray-400">Filter and discover stocks based on your criteria</p>
      </div>

      {/* Filters Section */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Filter size={20} className="text-blue-400" />
            <h2 className="text-xl font-semibold">Filters</h2>
          </div>
          <button
            onClick={resetFilters}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors"
          >
            Reset All
          </button>
        </div>

        {/* Search */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">Search</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by symbol or name..."
              className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Price Range */}
          <div>
            <label className="block text-sm font-medium mb-2">Price Range ($)</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                placeholder="Min"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
              />
              <input
                type="number"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                placeholder="Max"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Market Cap Range */}
          <div>
            <label className="block text-sm font-medium mb-2">Market Cap (B)</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={minMarketCap}
                onChange={(e) => setMinMarketCap(e.target.value)}
                placeholder="Min"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
              />
              <input
                type="number"
                value={maxMarketCap}
                onChange={(e) => setMaxMarketCap(e.target.value)}
                placeholder="Max"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* P/E Ratio Range */}
          <div>
            <label className="block text-sm font-medium mb-2">P/E Ratio</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={minPE}
                onChange={(e) => setMinPE(e.target.value)}
                placeholder="Min"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
              />
              <input
                type="number"
                value={maxPE}
                onChange={(e) => setMaxPE(e.target.value)}
                placeholder="Max"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Volume */}
          <div>
            <label className="block text-sm font-medium mb-2">Min Volume (M)</label>
            <input
              type="number"
              value={minVolume}
              onChange={(e) => setMinVolume(e.target.value)}
              placeholder="Min volume"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-xl font-semibold">
            Results ({filteredStocks.length})
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-800/50">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-400">Symbol</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-400">Name</th>
                <th className="px-6 py-3 text-right text-sm font-medium text-gray-400">Price</th>
                <th className="px-6 py-3 text-right text-sm font-medium text-gray-400">Change</th>
                <th className="px-6 py-3 text-right text-sm font-medium text-gray-400">Market Cap</th>
                <th className="px-6 py-3 text-right text-sm font-medium text-gray-400">Volume</th>
                <th className="px-6 py-3 text-right text-sm font-medium text-gray-400">P/E</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filteredStocks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                    No stocks match your criteria
                  </td>
                </tr>
              ) : (
                filteredStocks.map((stock) => (
                  <tr key={stock.id} className="hover:bg-gray-800/50 transition-colors">
                    <td className="px-6 py-4">
                      <Link href={`/markets/${stock.id}`} className="font-bold text-blue-400 hover:text-blue-300">
                        {stock.symbol}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-gray-300">{stock.name}</td>
                    <td className="px-6 py-4 text-right font-medium">
                      ${stock.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className={`flex items-center justify-end gap-1 ${
                        stock.change24h >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {stock.change24h >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                        <span>{stock.change24h >= 0 ? '+' : ''}{stock.change24h.toFixed(2)}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right text-gray-300">
                      {stock.marketCap ? `$${(stock.marketCap / 1e9).toFixed(2)}B` : 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-right text-gray-300">
                      ${(stock.volume24h / 1e6).toFixed(2)}M
                    </td>
                    <td className="px-6 py-4 text-right text-gray-300">
                      {stock.peRatio ? stock.peRatio.toFixed(2) : 'N/A'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      </div>

      <AssistantPanel context={{ page: 'screener' }} />
    </>
  );
}
