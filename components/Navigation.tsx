'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { TrendingUp, Newspaper, Filter, GitCompare, Calendar } from 'lucide-react';

export default function Navigation() {
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-md border-b border-gray-800">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            FinTech
          </Link>

          <div className="flex gap-4">
            <Link
              href="/markets"
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                isActive('/markets')
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <TrendingUp size={20} />
              <span>Markets</span>
            </Link>

            <Link
              href="/screener"
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                isActive('/screener')
                  ? 'bg-green-500/20 text-green-400'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <Filter size={20} />
              <span>Screener</span>
            </Link>

            <Link
              href="/compare"
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                isActive('/compare')
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <GitCompare size={20} />
              <span>Compare</span>
            </Link>

            <Link
              href="/calendar"
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                isActive('/calendar')
                  ? 'bg-pink-500/20 text-pink-400'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <Calendar size={20} />
              <span>Calendar</span>
            </Link>

            <Link
              href="/news"
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                isActive('/news')
                  ? 'bg-purple-500/20 text-purple-400'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <Newspaper size={20} />
              <span>News</span>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
