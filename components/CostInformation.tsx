'use client';

import { Info } from 'lucide-react';

interface CostInformationProps {
  data: {
    ter?: number; // Total Expense Ratio (for ETFs)
    managementFee?: number;
    tradingCost?: number;
    spread?: number;
    minimumInvestment?: number;
    taxDragEstimate?: number;
  };
  assetType: 'stock' | 'etf' | 'crypto';
}

export default function CostInformation({ data, assetType }: CostInformationProps) {
  const CostRow = ({ 
    label, 
    value, 
    tooltip 
  }: { 
    label: string; 
    value: string; 
    tooltip?: string;
  }) => (
    <div className="flex justify-between items-center py-3 border-b border-gray-800 last:border-0">
      <div className="flex items-center gap-2">
        <span className="text-gray-400 text-sm">{label}</span>
        {tooltip && (
          <div className="group relative">
            <Info className="w-4 h-4 text-gray-500 cursor-help" />
            <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-48 p-2 bg-gray-800 text-xs text-gray-300 rounded-lg shadow-lg z-10">
              {tooltip}
            </div>
          </div>
        )}
      </div>
      <span className="text-white font-medium text-sm">{value}</span>
    </div>
  );

  const formatPercent = (num: number | undefined) => {
    if (num === undefined || num === null) return 'N/A';
    return `${num.toFixed(2)}%`;
  };

  const formatCurrency = (num: number | undefined) => {
    if (num === undefined || num === null) return 'N/A';
    return `$${num.toLocaleString()}`;
  };

  // Different costs for different asset types
  const renderCosts = () => {
    if (assetType === 'etf') {
      return (
        <>
          <CostRow 
            label="Total Expense Ratio (TER)" 
            value={formatPercent(data.ter)}
            tooltip="Annual fund operating expenses as a percentage of total assets"
          />
          <CostRow 
            label="Management Fee" 
            value={formatPercent(data.managementFee)}
            tooltip="Fee paid to fund managers for portfolio management"
          />
          <CostRow 
            label="Trading Cost (Est.)" 
            value={formatPercent(data.tradingCost)}
            tooltip="Estimated cost of buying/selling fund holdings"
          />
          <CostRow 
            label="Bid-Ask Spread" 
            value={formatPercent(data.spread)}
            tooltip="Difference between buying and selling price"
          />
          <CostRow 
            label="Minimum Investment" 
            value={formatCurrency(data.minimumInvestment)}
          />
          <CostRow 
            label="Tax Drag (Est.)" 
            value={formatPercent(data.taxDragEstimate)}
            tooltip="Estimated impact of taxes on returns"
          />
        </>
      );
    } else if (assetType === 'stock') {
      return (
        <>
          <CostRow 
            label="Trading Commission" 
            value={data.tradingCost ? formatCurrency(data.tradingCost) : '$0 - $10'}
            tooltip="Broker commission per trade (varies by broker)"
          />
          <CostRow 
            label="Bid-Ask Spread" 
            value={formatPercent(data.spread)}
            tooltip="Cost of immediate execution"
          />
          <CostRow 
            label="Short-Term Capital Gains Tax" 
            value="Up to 37%"
            tooltip="Gains on assets held less than 1 year (US)"
          />
          <CostRow 
            label="Long-Term Capital Gains Tax" 
            value="0% - 20%"
            tooltip="Gains on assets held more than 1 year (US)"
          />
          <CostRow 
            label="Dividend Tax" 
            value="0% - 37%"
            tooltip="Tax on dividend income (varies by type)"
          />
          <CostRow 
            label="Foreign Tax Withholding" 
            value="0% - 30%"
            tooltip="Tax withheld on foreign investments"
          />
        </>
      );
    } else if (assetType === 'crypto') {
      return (
        <>
          <CostRow 
            label="Trading Fee" 
            value={data.tradingCost ? formatPercent(data.tradingCost) : '0.1% - 1%'}
            tooltip="Exchange trading fee per transaction"
          />
          <CostRow 
            label="Network Fee" 
            value="Variable"
            tooltip="Blockchain transaction fee (gas fee)"
          />
          <CostRow 
            label="Spread" 
            value={formatPercent(data.spread)}
            tooltip="Difference between buy and sell price"
          />
          <CostRow 
            label="Withdrawal Fee" 
            value="Variable"
            tooltip="Fee to withdraw to external wallet"
          />
          <CostRow 
            label="Capital Gains Tax" 
            value="0% - 37%"
            tooltip="Tax on crypto gains (treated as property in US)"
          />
          <CostRow 
            label="Minimum Purchase" 
            value={formatCurrency(data.minimumInvestment) || '$1 - $10'}
          />
        </>
      );
    }
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-lg font-semibold">Cost Information</h3>
        <div className="px-2 py-1 bg-blue-500/10 text-blue-400 text-xs rounded">
          {assetType.toUpperCase()}
        </div>
      </div>
      
      <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
        <p className="text-xs text-yellow-400">
          <strong>Disclaimer:</strong> Tax rates and fees are estimates and vary by jurisdiction, 
          broker, and individual circumstances. Consult a tax professional for accurate information.
        </p>
      </div>

      <div>
        {renderCosts()}
      </div>

      <div className="mt-6 p-4 bg-gray-800/50 rounded-lg">
        <h4 className="text-sm font-semibold mb-2">Total Cost Impact</h4>
        <p className="text-xs text-gray-400 mb-2">
          Consider all costs when making investment decisions:
        </p>
        <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside">
          <li>Trading costs reduce your initial investment</li>
          <li>Annual fees compound over time</li>
          <li>Taxes can significantly impact net returns</li>
          <li>Frequent trading increases total costs</li>
        </ul>
      </div>
    </div>
  );
}
