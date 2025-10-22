'use client'

import AuthModal from '@/components/auth/AuthModal';
import { Suspense } from 'react';

export default function RegisterPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AuthModal />
    </Suspense>
  );
}
