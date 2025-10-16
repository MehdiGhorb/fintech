'use client';

import { useState, useEffect } from 'react';
import { Calendar, DollarSign, TrendingUp, AlertCircle } from 'lucide-react';
import AssistantPanel from '@/components/AssistantPanel';

interface EconomicEvent {
  date: string;
  time: string;
  event: string;
  symbol?: string;
  type: 'earnings' | 'dividend' | 'split' | 'economic';
  importance: 'low' | 'medium' | 'high';
  estimate?: string;
}

export default function CalendarPage() {
  const [selectedType, setSelectedType] = useState<'all' | 'earnings' | 'dividend' | 'split' | 'economic'>('all');
  const [events, setEvents] = useState<EconomicEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCalendarData();
  }, []);

  const fetchCalendarData = async () => {
    try {
      const response = await fetch('/api/calendar');
      const data = await response.json();
      setEvents(data);
    } catch (error) {
      console.error('Error fetching calendar data:', error);
    } finally {
      setLoading(false);
    }
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
        <AssistantPanel context={{ page: 'calendar' }} />
      </>
    );
  }

  const filteredEvents = selectedType === 'all' 
    ? events 
    : events.filter(e => e.type === selectedType);

  const groupedEvents = filteredEvents.reduce((acc, event) => {
    if (!acc[event.date]) {
      acc[event.date] = [];
    }
    acc[event.date].push(event);
    return acc;
  }, {} as Record<string, EconomicEvent[]>);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'earnings':
        return <TrendingUp size={16} className="text-blue-400" />;
      case 'dividend':
        return <DollarSign size={16} className="text-green-400" />;
      case 'economic':
        return <AlertCircle size={16} className="text-yellow-400" />;
      default:
        return <Calendar size={16} className="text-gray-400" />;
    }
  };

  const getImportanceColor = (importance: string) => {
    switch (importance) {
      case 'high':
        return 'bg-red-500/20 text-red-400 border-red-500/50';
      case 'medium':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
      case 'low':
        return 'bg-gray-500/20 text-gray-400 border-gray-500/50';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/50';
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Economic Calendar</h1>
          <p className="text-gray-400">Track upcoming earnings, dividends, and economic events</p>
        </div>

      {/* Filter Buttons */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'all', label: 'All Events', icon: Calendar },
            { key: 'earnings', label: 'Earnings', icon: TrendingUp },
            { key: 'dividend', label: 'Dividends', icon: DollarSign },
            { key: 'economic', label: 'Economic Data', icon: AlertCircle },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setSelectedType(key as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                selectedType === key
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Events List */}
      <div className="space-y-6">
        {Object.entries(groupedEvents).map(([date, dayEvents]) => (
          <div key={date} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-6 py-4 bg-gray-800/50 border-b border-gray-800">
              <h2 className="text-xl font-semibold">{formatDate(date)}</h2>
            </div>
            
            <div className="divide-y divide-gray-800">
              {dayEvents.map((event, idx) => (
                <div key={idx} className="px-6 py-4 hover:bg-gray-800/30 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="mt-1">
                        {getTypeIcon(event.type)}
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          {event.symbol && (
                            <span className="font-bold text-blue-400">{event.symbol}</span>
                          )}
                          <span className="text-lg font-medium">{event.event}</span>
                          <span className={`px-2 py-1 rounded text-xs font-medium border ${getImportanceColor(event.importance)}`}>
                            {event.importance.toUpperCase()}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm text-gray-400">
                          <span className="flex items-center gap-1">
                            <Calendar size={14} />
                            {event.time}
                          </span>
                          {event.estimate && (
                            <span className="text-gray-500">{event.estimate}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {event.symbol && (
                      <a
                        href={`/markets/${event.symbol.toLowerCase()}`}
                        className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors"
                      >
                        View Stock
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {filteredEvents.length === 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <Calendar size={48} className="mx-auto mb-4 text-gray-600" />
          <h3 className="text-xl font-semibold mb-2">No Events Found</h3>
          <p className="text-gray-400">Try selecting a different event type</p>
        </div>
      )}
      </div>

      <AssistantPanel context={{ page: 'calendar' }} />
    </>
  );
}
