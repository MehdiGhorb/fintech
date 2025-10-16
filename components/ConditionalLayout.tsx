'use client';

import { usePathname } from 'next/navigation';
import Navigation from './Navigation';
import MarketOverview from './MarketOverview';
import { MainContent } from './ChatbotContext';

export default function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isHomePage = pathname === '/';

  if (isHomePage) {
    // Homepage - just the intelligent chat, no navigation or layout
    return <>{children}</>;
  }

  // Other pages - full layout with navigation
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
