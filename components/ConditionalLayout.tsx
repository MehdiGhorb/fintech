'use client';

import { usePathname } from 'next/navigation';
import Navigation from './Navigation';

export default function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
      <Navigation />
      {children}
    </div>
  );
}
