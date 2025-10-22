'use client';

import { usePathname } from 'next/navigation';
import Navigation from './Navigation';
import MarketOverview from './MarketOverview';
import { MainContent } from './ChatbotContext';

export default function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isHomePage = pathname === '/';

  if (isHomePage) {
    // Homepage - navigation + intelligent chat, no market overview
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
        <Navigation />
        {children}
      </div>
    );
  }

  // Other pages - full layout with navigation and market overview
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
      <Navigation />
      <MarketOverview />
      <MainContent>
        {children}
      </MainContent>
    </div>
  );
}
