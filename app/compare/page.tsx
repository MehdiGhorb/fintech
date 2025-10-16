'use client';

import { useState, useEffect } from 'react';
import { Plus, X, GitCompare } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import AssistantPanel from '@/components/AssistantPanel';

interface CompareStock {
  id: string;
  symbol: string;
  name: string;
  color: string;
  data: Array<{ date: string; price: number }>;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function ComparePage() {
  const [selectedStocks, setSelectedStocks] = useState<CompareStock[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [timeframe, setTimeframe] = useState<'1M' | '3M' | '6M' | '1Y'>('3M');
  const [viewType, setViewType] = useState<'absolute' | 'relative'>('relative');

  const searchStocks = async (term: string) => {
    if (!term) {
      setSearchResults([]);
      return;
    }

    try {
      const response = await fetch('/api/markets');
      const data = await response.json();
      const filtered = data.filter((stock: any) =>
        stock.symbol.toLowerCase().includes(term.toLowerCase()) ||
        stock.name.toLowerCase().includes(term.toLowerCase())
      );
      setSearchResults(filtered.slice(0, 5));
    } catch (error) {
      console.error('Error searching stocks:', error);
    }
  };

  const addStock = async (stock: any) => {
    if (selectedStocks.find(s => s.id === stock.id)) return;
    if (selectedStocks.length >= 6) {
      alert('Maximum 6 stocks allowed');
      return;
    }

    try {
      const response = await fetch(`/api/markets/${stock.id}`);
      const data = await response.json();
      
      const newStock: CompareStock = {
        id: stock.id,
        symbol: stock.symbol,
        name: stock.name,
        color: COLORS[selectedStocks.length],
        data: data.historicalData.map((d: any) => ({
          date: d.time,
          price: d.close,
        })),
      };

      setSelectedStocks([...selectedStocks, newStock]);
      setSearchTerm('');
      setSearchResults([]);
    } catch (error) {
      console.error('Error fetching stock data:', error);
    }
  };

  const removeStock = (id: string) => {
    setSelectedStocks(selectedStocks.filter(s => s.id !== id));
  };

  useEffect(() => {
    if (selectedStocks.length === 0) {
      setChartData([]);
      return;
    }

    // Get date range based on timeframe
    const now = new Date();
    const daysAgo = timeframe === '1M' ? 30 : timeframe === '3M' ? 90 : timeframe === '6M' ? 180 : 365;
    const cutoffDate = new Date(now);
    cutoffDate.setDate(cutoffDate.getDate() - daysAgo);
    const cutoffStr = cutoffDate.toISOString().split('T')[0];

    // Merge data from all stocks
    const dateMap = new Map<string, any>();

    selectedStocks.forEach(stock => {
      const filteredData = stock.data.filter(d => d.date >= cutoffStr);
      const firstPrice = filteredData[0]?.price || 1;

      filteredData.forEach(point => {
        if (!dateMap.has(point.date)) {
          dateMap.set(point.date, { date: point.date });
        }
        
        const value = viewType === 'relative' 
          ? ((point.price - firstPrice) / firstPrice) * 100 
          : point.price;
        
        dateMap.get(point.date)[stock.symbol] = value;
      });
    });

    const merged = Array.from(dateMap.values()).sort((a, b) => 
      a.date.localeCompare(b.date)
    );

    setChartData(merged);
  }, [selectedStocks, timeframe, viewType]);

  return (
    <>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Compare Stocks</h1>
          <p className="text-gray-400">Compare multiple stocks on the same chart</p>
        </div>

      {/* Stock Selector */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <GitCompare size={20} className="text-blue-400" />
          <h2 className="text-xl font-semibold">Select Stocks to Compare</h2>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              searchStocks(e.target.value);
            }}
            placeholder="Search stocks by symbol or name..."
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
          />
          
          {searchResults.length > 0 && (
            <div className="absolute z-10 w-full mt-2 bg-gray-800 border border-gray-700 rounded-lg shadow-xl">
              {searchResults.map(stock => (
                <button
                  key={stock.id}
                  onClick={() => addStock(stock)}
                  className="w-full px-4 py-3 text-left hover:bg-gray-700 transition-colors border-b border-gray-700 last:border-0"
                >
                  <div className="font-bold text-blue-400">{stock.symbol}</div>
                  <div className="text-sm text-gray-400">{stock.name}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Selected Stocks */}
        <div className="flex flex-wrap gap-2">
          {selectedStocks.map(stock => (
            <div
              key={stock.id}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 rounded-lg border-2"
              style={{ borderColor: stock.color }}
            >
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stock.color }}></div>
              <span className="font-medium">{stock.symbol}</span>
              <button
                onClick={() => removeStock(stock.id)}
                className="ml-2 text-gray-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>
          ))}
          {selectedStocks.length === 0 && (
            <div className="text-gray-400 text-sm">Search and add stocks to compare</div>
          )}
        </div>
      </div>

      {/* Chart Controls */}
      {selectedStocks.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            {/* Timeframe */}
            <div className="flex gap-2">
              {(['1M', '3M', '6M', '1Y'] as const).map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    timeframe === tf
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-800 text-gray-400 hover:text-white'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>

            <div className="w-px h-6 bg-gray-700"></div>

            {/* View Type */}
            <div className="flex gap-2">
              <button
                onClick={() => setViewType('relative')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  viewType === 'relative'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                Relative (%)
              </button>
              <button
                onClick={() => setViewType('absolute')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  viewType === 'absolute'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                Absolute ($)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chart */}
      {selectedStocks.length > 0 && chartData.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h3 className="text-xl font-semibold mb-4">
            {viewType === 'relative' ? 'Relative Performance (%)' : 'Price Comparison ($)'}
          </h3>
          <ResponsiveContainer width="100%" height={500}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                dataKey="date" 
                stroke="#9ca3af"
                tick={{ fill: '#9ca3af' }}
              />
              <YAxis 
                stroke="#9ca3af"
                tick={{ fill: '#9ca3af' }}
                tickFormatter={(value) => viewType === 'relative' ? `${value.toFixed(1)}%` : `$${value.toFixed(0)}`}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1f2937', 
                  border: '1px solid #374151',
                  borderRadius: '8px'
                }}
                formatter={(value: any) => 
                  viewType === 'relative' 
                    ? `${value.toFixed(2)}%` 
                    : `$${value.toFixed(2)}`
                }
              />
              <Legend />
              {selectedStocks.map(stock => (
                <Line
                  key={stock.symbol}
                  type="monotone"
                  dataKey={stock.symbol}
                  stroke={stock.color}
                  strokeWidth={2}
                  dot={false}
                  name={stock.symbol}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {selectedStocks.length === 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <GitCompare size={48} className="mx-auto mb-4 text-gray-600" />
          <h3 className="text-xl font-semibold mb-2">No Stocks Selected</h3>
          <p className="text-gray-400">Search and add stocks above to start comparing</p>
        </div>
      )}
      </div>

      <AssistantPanel context={{ page: 'compare' }} />
    </>
  );
}
