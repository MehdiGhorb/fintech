'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { TrendingUp, Newspaper, BarChart3, Calendar } from 'lucide-react';

export default function Navigation() {
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path;

  return (
    <nav className="border-b border-gray-900 bg-black/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2" aria-label="Northline Finance home">
          <span className="text-sm font-medium text-gray-400">Northline Finance</span>
        </Link>
        
        <div className="flex items-center gap-1">
          <Link 
            href="/markets" 
            className={`px-3 py-1.5 text-xs transition-colors rounded-lg ${
              isActive('/markets') 
                ? 'text-gray-200 bg-gray-900' 
                : 'text-gray-500 hover:text-gray-300 hover:bg-gray-900'
            }`}
          >
            <TrendingUp size={14} className="inline mr-1.5" />
            Markets
          </Link>
          <Link 
            href="/screener" 
            className={`px-3 py-1.5 text-xs transition-colors rounded-lg ${
              isActive('/screener') 
                ? 'text-gray-200 bg-gray-900' 
                : 'text-gray-500 hover:text-gray-300 hover:bg-gray-900'
            }`}
          >
            <BarChart3 size={14} className="inline mr-1.5" />
            Screener
          </Link>
          <Link 
            href="/calendar" 
            className={`px-3 py-1.5 text-xs transition-colors rounded-lg ${
              isActive('/calendar') 
                ? 'text-gray-200 bg-gray-900' 
                : 'text-gray-500 hover:text-gray-300 hover:bg-gray-900'
            }`}
          >
            <Calendar size={14} className="inline mr-1.5" />
            Calendar
          </Link>
          <Link 
            href="/news" 
            className={`px-3 py-1.5 text-xs transition-colors rounded-lg ${
              isActive('/news') 
                ? 'text-gray-200 bg-gray-900' 
                : 'text-gray-500 hover:text-gray-300 hover:bg-gray-900'
            }`}
          >
            <Newspaper size={14} className="inline mr-1.5" />
            News
          </Link>
        </div>
      </div>
    </nav>
  );
}
