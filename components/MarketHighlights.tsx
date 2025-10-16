'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, AlertCircle, Calendar } from 'lucide-react';
import Link from 'next/link';

interface Stock {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change24h: number;
}

interface CalendarEvent {
  date: string;
  event: string;
  symbol?: string;
  type: string;
  importance: string;
}

export default function MarketHighlights() {
  const [topGainers, setTopGainers] = useState<Stock[]>([]);
  const [topLosers, setTopLosers] = useState<Stock[]>([]);
  const [todayEvents, setTodayEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch markets data
      const marketsResponse = await fetch('/api/markets');
      const marketsData = await marketsResponse.json();

      // Sort by change percentage
      const sorted = [...marketsData].sort((a, b) => b.change24h - a.change24h);
      setTopGainers(sorted.slice(0, 3));
      setTopLosers(sorted.slice(-3).reverse());

      // Fetch calendar data
      const calendarResponse = await fetch('/api/calendar');
      const calendarData = await calendarResponse.json();
      
      // Get today's date
      const today = new Date().toISOString().split('T')[0];
      const todaysEvents = calendarData
        .filter((event: CalendarEvent) => event.date === today)
        .slice(0, 3);
      
      setTodayEvents(todaysEvents);
    } catch (error) {
      console.error('Error fetching highlights:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="grid md:grid-cols-3 gap-6 mb-12 animate-pulse">
        <div className="h-64 bg-gray-800 rounded-xl"></div>
        <div className="h-64 bg-gray-800 rounded-xl"></div>
        <div className="h-64 bg-gray-800 rounded-xl"></div>
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-3 gap-6 mb-12">
      {/* Top Gainers */}
      <div className="bg-gradient-to-br from-green-500/10 to-transparent border border-green-500/20 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="text-green-400" size={24} />
          <h3 className="text-xl font-bold text-green-400">Top Gainers</h3>
        </div>
        <div className="space-y-3">
          {topGainers.map((stock, index) => (
            <Link
              key={stock.id}
              href={`/markets/${stock.id}`}
              className="block p-3 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors"
            >
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-bold text-white">{stock.symbol}</div>
                  <div className="text-sm text-gray-400">${stock.price.toFixed(2)}</div>
                </div>
                <div className="text-right">
                  <div className="text-green-400 font-bold">
                    +{stock.change24h.toFixed(2)}%
                  </div>
                  <div className="text-xs text-gray-500">#{index + 1}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Top Losers */}
      <div className="bg-gradient-to-br from-red-500/10 to-transparent border border-red-500/20 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingDown className="text-red-400" size={24} />
          <h3 className="text-xl font-bold text-red-400">Top Losers</h3>
        </div>
        <div className="space-y-3">
          {topLosers.map((stock, index) => (
            <Link
              key={stock.id}
              href={`/markets/${stock.id}`}
              className="block p-3 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors"
            >
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-bold text-white">{stock.symbol}</div>
                  <div className="text-sm text-gray-400">${stock.price.toFixed(2)}</div>
                </div>
                <div className="text-right">
                  <div className="text-red-400 font-bold">
                    {stock.change24h.toFixed(2)}%
                  </div>
                  <div className="text-xs text-gray-500">#{index + 1}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Today's Events */}
      <div className="bg-gradient-to-br from-blue-500/10 to-transparent border border-blue-500/20 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="text-blue-400" size={24} />
          <h3 className="text-xl font-bold text-blue-400">Today's Events</h3>
        </div>
        {todayEvents.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <AlertCircle size={32} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">No events scheduled for today</p>
            <Link href="/calendar" className="text-blue-400 hover:underline text-sm mt-2 inline-block">
              View upcoming events →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {todayEvents.map((event, index) => (
              <div
                key={index}
                className="p-3 bg-gray-800/50 rounded-lg"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    {event.symbol && (
                      <Link
                        href={`/markets/${event.symbol.toLowerCase()}`}
                        className="font-bold text-blue-400 hover:underline"
                      >
                        {event.symbol}
                      </Link>
                    )}
                    <div className="text-sm text-white mt-1">{event.event}</div>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    event.importance === 'high' 
                      ? 'bg-red-500/20 text-red-400' 
                      : event.importance === 'medium'
                      ? 'bg-yellow-500/20 text-yellow-400'
                      : 'bg-gray-500/20 text-gray-400'
                  }`}>
                    {event.importance.toUpperCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
        <Link 
          href="/calendar" 
          className="mt-4 block text-center text-sm text-blue-400 hover:underline"
        >
          View full calendar →
        </Link>
      </div>
    </div>
  );
}
