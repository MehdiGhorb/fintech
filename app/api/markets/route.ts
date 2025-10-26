import { NextResponse } from 'next/server';

// Comprehensive list of assets with historical data availability
const STOCKS = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA', 'JPM', 
  'V', 'WMT', 'UNH', 'JNJ', 'MA', 'HD', 'PG', 'BAC', 'DIS', 'NFLX',
  'ADBE', 'CRM', 'CSCO', 'PEP', 'COST', 'TMO', 'INTC', 'ORCL', 'AMD',
  'QCOM', 'TXN', 'CVX', 'XOM', 'KO', 'MCD', 'NKE', 'ABT', 'WFC', 'PM',
  'IBM', 'GE', 'CAT', 'GS', 'AXP', 'BA', 'MMM', 'HON', 'UNP', 'RTX',
  'LMT', 'DE', 'BLK', 'SPGI', 'C', 'USB', 'TGT', 'LOW', 'UPS', 'SBUX'
];

const CRYPTOS = [
  'bitcoin', 'ethereum', 'tether', 'binancecoin', 'ripple', 'cardano', 
  'solana', 'polkadot', 'dogecoin', 'avalanche-2', 'polygon', 'shiba-inu',
  'chainlink', 'litecoin', 'uniswap', 'stellar', 'monero', 'ethereum-classic',
  'bitcoin-cash', 'algorand', 'cosmos', 'tron', 'eos', 'tezos', 'filecoin',
  'vechain', 'theta-token', 'aave', 'maker', 'neo', 'pancakeswap-token',
  'kusama', 'elrond-erd-2', 'compound-ether', 'decentraland', 'the-sandbox'
];

const ETFS = [
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF Trust' },
  { symbol: 'QQQ', name: 'Invesco QQQ Trust' },
  { symbol: 'DIA', name: 'SPDR Dow Jones Industrial Average ETF' },
  { symbol: 'IWM', name: 'iShares Russell 2000 ETF' },
  { symbol: 'VTI', name: 'Vanguard Total Stock Market ETF' },
  { symbol: 'VOO', name: 'Vanguard S&P 500 ETF' },
  { symbol: 'GLD', name: 'SPDR Gold Shares' },
  { symbol: 'SLV', name: 'iShares Silver Trust' },
  { symbol: 'EEM', name: 'iShares MSCI Emerging Markets ETF' },
  { symbol: 'TLT', name: 'iShares 20+ Year Treasury Bond ETF' },
];

const COMMODITIES = [
  { symbol: 'GC=F', name: 'Gold Futures', displayName: 'Gold' },
  { symbol: 'SI=F', name: 'Silver Futures', displayName: 'Silver' },
  { symbol: 'CL=F', name: 'Crude Oil WTI Futures', displayName: 'Crude Oil' },
  { symbol: 'NG=F', name: 'Natural Gas Futures', displayName: 'Natural Gas' },
];

export async function GET() {
  try {
    // Fetch crypto data from CoinGecko (more comprehensive data)
    const cryptoResponse = await fetch(
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${CRYPTOS.join(',')}&order=market_cap_desc&sparkline=false&price_change_percentage=24h,7d`
    );
    const cryptoData = await cryptoResponse.json();

    const cryptos = cryptoData.map((coin: any, index: number) => ({
      id: coin.id,
      symbol: coin.symbol.toUpperCase(),
      name: coin.name,
      price: coin.current_price,
      change24h: coin.price_change_percentage_24h || 0,
      change7d: coin.price_change_percentage_7d_in_currency || 0,
      marketCap: coin.market_cap,
      volume24h: coin.total_volume,
      circulatingSupply: coin.circulating_supply,
      type: 'crypto' as const,
      rank: index + 1,
    }));

    // Fetch stock data (sample - limited due to API rate limits)
    const sampleStocks = STOCKS.slice(0, 20).map((symbol, index) => ({
      id: symbol.toLowerCase(),
      symbol,
      name: getStockName(symbol),
      price: getRandomPrice(symbol),
      change24h: (Math.random() - 0.5) * 10,
      change7d: (Math.random() - 0.5) * 15,
      marketCap: getRandomMarketCap(),
      volume24h: getRandomVolume(),
      type: 'stock' as const,
      rank: cryptos.length + index + 1,
    }));

    // Add ETFs
    const etfs = ETFS.map((etf, index) => ({
      id: etf.symbol.toLowerCase(),
      symbol: etf.symbol,
      name: etf.name,
      price: getRandomPrice(etf.symbol, true),
      change24h: (Math.random() - 0.5) * 3,
      change7d: (Math.random() - 0.5) * 5,
      marketCap: getRandomMarketCap(),
      volume24h: getRandomVolume(),
      type: 'etf' as const,
      rank: cryptos.length + sampleStocks.length + index + 1,
    }));

    // Add Commodities
    const commodities = COMMODITIES.map((commodity, index) => ({
      id: commodity.symbol.toLowerCase().replace('=f', ''),
      symbol: commodity.displayName.toUpperCase(),
      name: commodity.displayName,
      price: getCommodityPrice(commodity.displayName),
      change24h: (Math.random() - 0.5) * 4,
      change7d: (Math.random() - 0.5) * 8,
      marketCap: undefined,
      volume24h: getRandomVolume(),
      type: 'commodity' as const,
      rank: cryptos.length + sampleStocks.length + etfs.length + index + 1,
    }));

    return NextResponse.json([...cryptos, ...sampleStocks, ...etfs, ...commodities]);
  } catch (error) {
    console.error('Error fetching market data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch market data' },
      { status: 500 }
    );
  }
}

// Helper functions for realistic mock data
function getRandomPrice(symbol: string, isETF: boolean = false): number {
  const hash = symbol.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const base = isETF ? 300 : 100;
  return base + (hash % 500) + Math.random() * 50;
}

function getRandomMarketCap(): number {
  return Math.random() * 3000000000000; // Up to 3 trillion
}

function getRandomVolume(): number {
  return Math.random() * 100000000000; // Up to 100 billion
}

function getCommodityPrice(name: string): number {
  const prices: { [key: string]: number } = {
    'Gold': 1950 + Math.random() * 100,
    'Silver': 23 + Math.random() * 2,
    'Crude Oil': 75 + Math.random() * 10,
    'Natural Gas': 2.5 + Math.random() * 0.5,
  };
  return prices[name] || 100;
}

function getStockName(symbol: string): string {
  const names: { [key: string]: string } = {
    AAPL: 'Apple Inc.',
    MSFT: 'Microsoft Corp.',
    GOOGL: 'Alphabet Inc.',
    AMZN: 'Amazon.com Inc.',
    TSLA: 'Tesla Inc.',
    META: 'Meta Platforms',
    NVDA: 'NVIDIA Corp.',
    JPM: 'JPMorgan Chase',
    V: 'Visa Inc.',
    WMT: 'Walmart Inc.',
    UNH: 'UnitedHealth Group',
    JNJ: 'Johnson & Johnson',
    MA: 'Mastercard Inc.',
    HD: 'Home Depot',
    PG: 'Procter & Gamble',
    BAC: 'Bank of America',
    DIS: 'Walt Disney Co.',
    NFLX: 'Netflix Inc.',
    ADBE: 'Adobe Inc.',
    CRM: 'Salesforce Inc.',
    CSCO: 'Cisco Systems',
    PEP: 'PepsiCo Inc.',
    COST: 'Costco Wholesale',
    TMO: 'Thermo Fisher',
    INTC: 'Intel Corp.',
    ORCL: 'Oracle Corp.',
    AMD: 'Advanced Micro Devices',
    QCOM: 'Qualcomm Inc.',
    TXN: 'Texas Instruments',
    CVX: 'Chevron Corp.',
    XOM: 'Exxon Mobil',
    KO: 'Coca-Cola Co.',
    MCD: 'McDonald\'s Corp.',
    NKE: 'Nike Inc.',
    ABT: 'Abbott Laboratories',
    WFC: 'Wells Fargo',
    PM: 'Philip Morris',
    IBM: 'IBM',
    GE: 'General Electric',
    CAT: 'Caterpillar Inc.',
    GS: 'Goldman Sachs',
    AXP: 'American Express',
    BA: 'Boeing Co.',
    MMM: '3M Company',
    HON: 'Honeywell',
    UNP: 'Union Pacific',
    RTX: 'Raytheon Technologies',
    LMT: 'Lockheed Martin',
    DE: 'Deere & Company',
    BLK: 'BlackRock Inc.',
    SPGI: 'S&P Global',
    C: 'Citigroup',
    USB: 'U.S. Bancorp',
    TGT: 'Target Corp.',
    LOW: 'Lowe\'s Companies',
    UPS: 'United Parcel Service',
    SBUX: 'Starbucks Corp.',
  };
  return names[symbol] || symbol;
}
