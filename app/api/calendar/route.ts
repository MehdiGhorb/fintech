import { NextResponse } from 'next/server';

export async function GET() {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY || 'demo';

  try {
    // Fetch earnings calendar from Alpha Vantage
    const earningsResponse = await fetch(
      `https://www.alphavantage.co/query?function=EARNINGS_CALENDAR&horizon=3month&apikey=${apiKey}`
    );
    
    const earningsText = await earningsResponse.text();
    
    // Parse CSV data
    const lines = earningsText.trim().split('\n');
    const headers = lines[0].split(',');
    
    const events = lines.slice(1, 50).map(line => { // Get first 50 events
      const values = line.split(',');
      const event: any = {};
      headers.forEach((header, index) => {
        event[header.trim()] = values[index]?.trim() || '';
      });
      return event;
    }).filter(event => event.symbol && event.reportDate);

    // Transform to our format
    const formattedEvents = events.map((event: any) => ({
      date: event.reportDate,
      time: 'Not specified',
      event: 'Quarterly Earnings',
      symbol: event.symbol,
      type: 'earnings',
      importance: 'medium',
      estimate: event.estimate ? `EPS: $${event.estimate}` : undefined,
    }));

    // Add some economic events (these are typically scheduled)
    const economicEvents = [
      {
        date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        time: '08:30 AM',
        event: 'US GDP Report',
        type: 'economic',
        importance: 'high',
      },
      {
        date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        time: '08:30 AM',
        event: 'US Employment Report',
        type: 'economic',
        importance: 'high',
      },
      {
        date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        time: '10:00 AM',
        event: 'Consumer Confidence Index',
        type: 'economic',
        importance: 'medium',
      },
      {
        date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        time: '14:00 PM',
        event: 'Fed Interest Rate Decision',
        type: 'economic',
        importance: 'high',
      },
    ];

    const allEvents = [...formattedEvents, ...economicEvents].sort((a, b) => 
      a.date.localeCompare(b.date)
    );

    return NextResponse.json(allEvents);
  } catch (error) {
    console.error('Error fetching calendar data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch calendar data' },
      { status: 500 }
    );
  }
}
