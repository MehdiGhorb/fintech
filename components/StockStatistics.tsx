'use client';

interface StockStatisticsProps {
  data: {
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
}

export default function StockStatistics({ data }: StockStatisticsProps) {
  const formatNumber = (num: number | undefined, decimals: number = 2) => {
    if (num === undefined || num === null) return 'N/A';
    return num.toLocaleString(undefined, { 
      minimumFractionDigits: decimals, 
      maximumFractionDigits: decimals 
    });
  };

  const formatVolume = (num: number | undefined) => {
    if (num === undefined || num === null) return 'N/A';
    if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
    return num.toString();
  };

  const formatMarketCap = (num: number | undefined) => {
    if (num === undefined || num === null) return 'N/A';
    if (num >= 1e12) return `${(num / 1e12).toFixed(2)}T`;
    if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
    return formatNumber(num, 0);
  };

  const StatRow = ({ label, value }: { label: string; value: string | number }) => (
    <div className="flex justify-between py-3 border-b border-gray-800 last:border-0">
      <span className="text-gray-400 text-sm">{label}</span>
      <span className="text-white font-medium text-sm">{value}</span>
    </div>
  );

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* Left Column */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4">Trading Information</h3>
        <div>
          <StatRow label="Previous Close" value={`$${formatNumber(data.previousClose)}`} />
          <StatRow label="Open" value={`$${formatNumber(data.open)}`} />
          <StatRow 
            label="Day's Range" 
            value={`$${formatNumber(data.dayLow)} - $${formatNumber(data.dayHigh)}`} 
          />
          <StatRow 
            label="52 Week Range" 
            value={`$${formatNumber(data.week52Low)} - $${formatNumber(data.week52High)}`} 
          />
          <StatRow label="Volume" value={formatVolume(data.volume)} />
          <StatRow label="Avg. Volume" value={formatVolume(data.avgVolume)} />
        </div>
      </div>

      {/* Right Column */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4">Key Statistics</h3>
        <div>
          <StatRow label="Market Cap" value={formatMarketCap(data.marketCap)} />
          <StatRow label="P/E Ratio (TTM)" value={data.peRatio ? formatNumber(data.peRatio) : 'N/A'} />
          <StatRow label="EPS (TTM)" value={data.eps ? `$${formatNumber(data.eps)}` : 'N/A'} />
          <StatRow 
            label="Dividend & Yield" 
            value={data.dividendYield ? `${formatNumber(data.dividendYield)}%` : 'N/A'} 
          />
          <StatRow 
            label="Ex-Dividend Date" 
            value={data.exDividendDate || 'N/A'} 
          />
          <StatRow label="Beta (5Y Monthly)" value={data.beta ? formatNumber(data.beta) : 'N/A'} />
        </div>
      </div>
    </div>
  );
}
