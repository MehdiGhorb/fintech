'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export default function EmailConfirmed() {
  const router = useRouter()

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="max-w-md w-full p-8 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 text-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="h-16 w-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-8 w-8 text-green-600 dark:text-green-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Email Confirmed!
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Your email has been successfully verified. You can now log in to your account.
          </p>
          <Button 
            onClick={() => router.push('/?auth=login')}
            className="mt-4 bg-blue-600 hover:bg-blue-700 text-white"
          >
            Log In to Your Account
          </Button>
        </div>
      </div>
    </div>
  )
}
