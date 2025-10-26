import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const { searchParams } = new URL(request.url);
  const timeRange = searchParams.get('range') || '1Y'; // Default 1 year

  // Calculate days based on time range
  const daysMap: { [key: string]: number } = {
    '1D': 1,
    '1W': 7,
    '1M': 30,
    '3M': 90,
    '6M': 180,
    '1Y': 365,
    '5Y': 1825,
    'MAX': 7300, // ~20 years (from 2005)
  };
  const days = daysMap[timeRange] || 365;

  try {
    // Check if it's a crypto or stock
    const cryptoIds = [
      'bitcoin', 'ethereum', 'tether', 'binancecoin', 'ripple', 'cardano', 
      'solana', 'polkadot', 'dogecoin', 'avalanche-2', 'polygon', 'shiba-inu',
      'chainlink', 'litecoin', 'uniswap', 'stellar', 'monero'
    ];
    const isCrypto = cryptoIds.includes(id.toLowerCase());

    if (isCrypto) {
      // Fetch crypto data from CoinGecko with extended range
      const response = await fetch(
        `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=${days}`
      );
      const data = await response.json();

      // Fetch current data
      const currentResponse = await fetch(
        `https://api.coingecko.com/api/v3/coins/${id}`
      );
      const currentData = await currentResponse.json();

      // Fetch OHLC data (max available)
      const ohlcResponse = await fetch(
        `https://api.coingecko.com/api/v3/coins/${id}/ohlc?vs_currency=usd&days=${Math.min(days, 365)}`
      );
      const ohlcData = await ohlcResponse.json();

      // Calculate 52-week high/low
      const prices = data.prices.map((p: [number, number]) => p[1]);
      const week52High = Math.max(...prices);
      const week52Low = Math.min(...prices);
      
      // Format historical data for candlestick chart
      const historicalData = ohlcData.map((candle: number[]) => ({
        time: new Date(candle[0]).toISOString().split('T')[0],
        open: candle[1],
        high: candle[2],
        low: candle[3],
        close: candle[4],
        volume: currentData.market_data.total_volume.usd / ohlcData.length, // Estimated
      }));

      const currentPrice = currentData.market_data.current_price.usd;
      const previousClose = historicalData[historicalData.length - 2]?.close || currentPrice;

      return NextResponse.json({
        id,
        symbol: currentData.symbol.toUpperCase(),
        name: currentData.name,
        price: currentPrice,
        change24h: currentData.market_data.price_change_percentage_24h,
        marketCap: currentData.market_data.market_cap.usd,
        volume24h: currentData.market_data.total_volume.usd,
        high24h: currentData.market_data.high_24h.usd,
        low24h: currentData.market_data.low_24h.usd,
        type: 'crypto',
        historicalData,
        statistics: {
          previousClose,
          open: currentData.market_data.current_price.usd,
          dayLow: currentData.market_data.low_24h.usd,
          dayHigh: currentData.market_data.high_24h.usd,
          volume: currentData.market_data.total_volume.usd,
          avgVolume: currentData.market_data.total_volume.usd,
          marketCap: currentData.market_data.market_cap.usd,
          week52Low,
          week52High,
        },
        costs: {
          tradingCost: 0.5, // 0.5% average exchange fee
          spread: 0.1,
          minimumInvestment: 10,
        },
      });
    } else {
      // Fetch stock data from Alpha Vantage
      const apiKey = process.env.ALPHA_VANTAGE_API_KEY || 'demo';
      
      // Get quote
      const quoteResponse = await fetch(
        `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${id.toUpperCase()}&apikey=${apiKey}`
      );
      const quoteData = await quoteResponse.json();
      const quote = quoteData['Global Quote'];

      // Get daily data
      const dailyResponse = await fetch(
        `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${id.toUpperCase()}&outputsize=full&apikey=${apiKey}`
      );
      const dailyData = await dailyResponse.json();
      const timeSeries = dailyData['Time Series (Daily)'];

      // Get overview data for additional statistics
      const overviewResponse = await fetch(
        `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${id.toUpperCase()}&apikey=${apiKey}`
      );
      const overviewData = await overviewResponse.json();

      // Format historical data for candlestick chart
      const historicalData = timeSeries
        ? Object.entries(timeSeries)
            .slice(0, 365)
            .reverse()
            .map(([date, data]: [string, any]) => ({
              time: date,
              open: parseFloat(data['1. open']),
              high: parseFloat(data['2. high']),
              low: parseFloat(data['3. low']),
              close: parseFloat(data['4. close']),
              volume: parseFloat(data['5. volume']),
            }))
        : [];

      // Calculate 52-week high/low
      const prices = historicalData.slice(-252).map(d => d.close); // ~252 trading days in a year
      const week52High = Math.max(...prices);
      const week52Low = Math.min(...prices);

      const currentPrice = parseFloat(quote['05. price']);
      const previousClose = parseFloat(quote['08. previous close']);

      // Determine asset type (stock or ETF)
      const assetType = overviewData.AssetType === 'ETF' ? 'etf' : 'stock';

      return NextResponse.json({
        id: id.toLowerCase(),
        symbol: id.toUpperCase(),
        name: overviewData.Name || getStockName(id.toUpperCase()),
        price: currentPrice,
        change24h: parseFloat(quote['10. change percent'].replace('%', '')),
        volume24h: parseFloat(quote['06. volume']),
        high24h: parseFloat(quote['03. high']),
        low24h: parseFloat(quote['04. low']),
        type: assetType,
        historicalData,
        statistics: {
          previousClose,
          open: parseFloat(quote['02. open']),
          dayLow: parseFloat(quote['04. low']),
          dayHigh: parseFloat(quote['03. high']),
          volume: parseFloat(quote['06. volume']),
          avgVolume: historicalData.slice(-20).reduce((sum, d) => sum + d.volume, 0) / 20,
          marketCap: overviewData.MarketCapitalization ? parseFloat(overviewData.MarketCapitalization) : undefined,
          peRatio: overviewData.PERatio ? parseFloat(overviewData.PERatio) : undefined,
          eps: overviewData.EPS ? parseFloat(overviewData.EPS) : undefined,
          dividendYield: overviewData.DividendYield ? parseFloat(overviewData.DividendYield) * 100 : undefined,
          exDividendDate: overviewData.ExDividendDate || undefined,
          week52Low,
          week52High,
          beta: overviewData.Beta ? parseFloat(overviewData.Beta) : undefined,
        },
        costs: assetType === 'etf' 
          ? {
              ter: 0.5, // Example TER
              managementFee: 0.3,
              tradingCost: 0.05,
              spread: 0.01,
              minimumInvestment: 100,
              taxDragEstimate: 0.2,
            }
          : {
              tradingCost: 5,
              spread: 0.02,
            },
      });
    }
  } catch (error) {
    console.error(`Error fetching data for ${id}:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch asset data' },
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
  };
  return names[symbol] || symbol;
}
