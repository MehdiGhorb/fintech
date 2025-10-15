import { NextResponse } from 'next/server';

// Expanded list of popular stocks and cryptocurrencies
const STOCKS = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA', 'JPM', 
  'V', 'WMT', 'UNH', 'JNJ', 'MA', 'HD', 'PG', 'BAC', 'DIS', 'NFLX',
  'ADBE', 'CRM', 'CSCO', 'PEP', 'COST', 'TMO', 'INTC'
];

const CRYPTOS = [
  'bitcoin', 'ethereum', 'binancecoin', 'cardano', 'solana', 
  'ripple', 'polkadot', 'dogecoin', 'avalanche-2', 'polygon',
  'chainlink', 'litecoin', 'uniswap', 'stellar', 'monero'
];

export async function GET() {
  try {
    // Fetch stock data from Alpha Vantage
    const stockPromises = STOCKS.map(async (symbol) => {
      try {
        const apiKey = process.env.ALPHA_VANTAGE_API_KEY || 'demo';
        const response = await fetch(
          `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${apiKey}`
        );
        const data = await response.json();
        const quote = data['Global Quote'];
        
        if (quote && quote['05. price']) {
          return {
            id: symbol.toLowerCase(),
            symbol,
            name: getStockName(symbol),
            price: parseFloat(quote['05. price']),
            change24h: parseFloat(quote['10. change percent'].replace('%', '')),
            type: 'stock' as const,
          };
        }
        return null;
      } catch (error) {
        console.error(`Error fetching ${symbol}:`, error);
        return null;
      }
    });

    // Fetch crypto data from CoinGecko
    const cryptoResponse = await fetch(
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${CRYPTOS.join(',')}&order=market_cap_desc&sparkline=false`
    );
    const cryptoData = await cryptoResponse.json();

    const cryptos = cryptoData.map((coin: any) => ({
      id: coin.id,
      symbol: coin.symbol.toUpperCase(),
      name: coin.name,
      price: coin.current_price,
      change24h: coin.price_change_percentage_24h,
      type: 'crypto' as const,
    }));

    const stocks = (await Promise.all(stockPromises)).filter((s) => s !== null);

    return NextResponse.json([...stocks, ...cryptos]);
  } catch (error) {
    console.error('Error fetching market data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch market data' },
      { status: 500 }
    );
  }
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
  };
  return names[symbol] || symbol;
}
