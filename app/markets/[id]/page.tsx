'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, TrendingUp, TrendingDown } from 'lucide-react';
import AdvancedChart from '@/components/AdvancedChart';
import StockStatistics from '@/components/StockStatistics';
import CostInformation from '@/components/CostInformation';
import TechnicalAnalysis from '@/components/TechnicalAnalysis';
import AssistantPanel from '@/components/AssistantPanel';

interface AssetDetails {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  marketCap?: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  type: 'stock' | 'crypto' | 'etf';
  historicalData: Array<{
    time: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>;
  statistics?: {
    previousClose: number;
    open: number;
    dayLow: number;
    dayHigh: number;
    volume: number;
    avgVolume: number;
    marketCap?: number;
    peRatio?: number;
    eps?: number;
    dividendYield?: number;
    exDividendDate?: string;
    week52Low: number;
    week52High: number;
    beta?: number;
  };
  costs?: {
    ter?: number;
    managementFee?: number;
    tradingCost?: number;
    spread?: number;
    minimumInvestment?: number;
    taxDragEstimate?: number;
  };
}

export default function AssetDetailPage({ params }: { params: { id: string } }) {
  const [asset, setAsset] = useState<AssetDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('1Y');

  useEffect(() => {
    fetchAssetDetails();
  }, [params.id, timeRange]);

  const fetchAssetDetails = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/markets/${params.id}?range=${timeRange}`);
      const data = await response.json();
      setAsset(data);
    } catch (error) {
      console.error('Error fetching asset details:', error);
    } finally {
      setLoading(false);
    }
  };

  const timeRanges = [
    { label: '1D', value: '1D' },
    { label: '1W', value: '1W' },
    { label: '1M', value: '1M' },
    { label: '3M', value: '3M' },
    { label: '6M', value: '6M' },
    { label: '1Y', value: '1Y' },
    { label: '5Y', value: '5Y' },
    { label: 'MAX', value: 'MAX' },
  ];

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-700 rounded w-1/4 mb-8"></div>
          <div className="h-96 bg-gray-800 rounded-xl mb-6"></div>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="h-32 bg-gray-800 rounded-xl"></div>
            <div className="h-32 bg-gray-800 rounded-xl"></div>
            <div className="h-32 bg-gray-800 rounded-xl"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-gray-400">Asset not found</p>
      </div>
    );
  }

  return (
    <>
      <div className="container mx-auto px-4 py-8">
      <Link 
        href="/markets"
        className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft size={20} />
        Back to Markets
      </Link>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-4xl font-bold">{asset.symbol}</h1>
          <span className="px-3 py-1 bg-gray-800 rounded-lg text-sm text-gray-400 uppercase">
            {asset.type}
          </span>
        </div>
        <p className="text-gray-400 text-lg mb-4">{asset.name}</p>
        
        <div className="flex items-baseline gap-4">
          <div className="text-5xl font-bold">
            ${typeof asset.price === 'number' 
              ? asset.price.toLocaleString(undefined, { 
                  minimumFractionDigits: 2, 
                  maximumFractionDigits: asset.price > 100 ? 2 : 6 
                })
              : '0.00'}
          </div>
          <div className={`flex items-center gap-2 text-2xl font-medium ${
            asset.change24h >= 0 ? 'text-green-400' : 'text-red-400'
          }`}>
            {asset.change24h >= 0 ? <TrendingUp size={28} /> : <TrendingDown size={28} />}
            {asset.change24h >= 0 ? '+' : ''}{typeof asset.change24h === 'number' ? asset.change24h.toFixed(2) : '0.00'}%
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid md:grid-cols-4 gap-4 mb-8">
        {asset.marketCap && (
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
            <div className="text-gray-400 text-sm mb-1">Market Cap</div>
            <div className="text-xl font-bold">
              ${(asset.marketCap / 1e9).toFixed(2)}B
            </div>
          </div>
        )}
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
          <div className="text-gray-400 text-sm mb-1">24h Volume</div>
          <div className="text-xl font-bold">
            ${typeof asset.volume24h === 'number' ? (asset.volume24h / 1e6).toFixed(2) : '0'}M
          </div>
        </div>
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
          <div className="text-gray-400 text-sm mb-1">24h High</div>
          <div className="text-xl font-bold text-green-400">
            ${typeof asset.high24h === 'number' ? asset.high24h.toFixed(2) : '0.00'}
          </div>
        </div>
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
          <div className="text-gray-400 text-sm mb-1">24h Low</div>
          <div className="text-xl font-bold text-red-400">
            ${typeof asset.low24h === 'number' ? asset.low24h.toFixed(2) : '0.00'}
          </div>
        </div>
      </div>

      {/* Chart Section */}
      <div className="mb-8">
        <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-6">
          {/* Time Range Selector */}
          <div className="flex justify-end mb-4 gap-2">
            {timeRanges.map((range) => (
              <button
                key={range.value}
                onClick={() => setTimeRange(range.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  timeRange === range.value
                    ? 'bg-white text-black'
                    : 'bg-gray-800/50 text-gray-400 hover:bg-gray-800 border border-gray-700/50'
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
          
          <AdvancedChart 
            data={asset.historicalData}
            symbol={asset.symbol}
          />
        </div>
      </div>

      {/* Statistics and Cost Information */}
      <div className="mb-8">
        {asset.statistics && (
          <StockStatistics data={asset.statistics} />
        )}
      </div>

      <div className="mb-8">
        <CostInformation 
          data={asset.costs || {}}
          assetType={asset.type}
        />
      </div>

      {/* Technical Analysis */}
      <TechnicalAnalysis 
        data={asset.historicalData.map(d => ({ 
          timestamp: new Date(d.time).getTime(), 
          price: d.close 
        }))} 
        symbol={asset.symbol} 
      />
      </div>

      <AssistantPanel 
        context={{ 
          page: 'asset-detail', 
          assetSymbol: asset.symbol,
          assetName: asset.name,
          assetPrice: asset.price
        }} 
      />
    </>
  );
}
