'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ChatPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to home since chat is now in side panel
    router.push('/');
  }, [router]);

  return (
    <div className="container mx-auto px-4 py-8 flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="text-6xl mb-4">🤖</div>
        <h1 className="text-2xl font-bold mb-2">AI Assistant is now in the side panel!</h1>
        <p className="text-gray-400">Redirecting you to the home page...</p>
      </div>
    </div>
  );
}
