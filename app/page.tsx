'use client';

import IntelligentChat from '@/components/IntelligentChat';
import AuthModal from '@/components/auth/AuthModal';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function HomeContent() {
  const searchParams = useSearchParams();
  const authMode = searchParams.get('auth');

  return (
    <>
      <IntelligentChat />
      {authMode && (
        <Suspense fallback={null}>
          <AuthModal />
        </Suspense>
      )}
    </>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <HomeContent />
    </Suspense>
  );
}
