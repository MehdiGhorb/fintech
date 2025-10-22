'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { TrendingUp, Newspaper, BarChart3, Calendar, LogIn, UserPlus, LogOut, User } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const isActive = (path: string) => pathname === path;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  return (
    <nav className="border-b border-gray-900 bg-black/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2" aria-label="Northline Finance home">
          <span className="text-sm font-medium text-gray-400">Northline Finance</span>
        </Link>
        
        <div className="flex items-center gap-3">
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

          {!loading && (
            <div className="flex items-center gap-2 ml-2 pl-2 border-l border-gray-800">
              {user ? (
                <>
                  <div className="px-3 py-1.5 text-xs text-gray-400 flex items-center gap-1.5">
                    <User size={14} />
                    <span>{user.email?.split('@')[0]}</span>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-900 transition-colors rounded-lg flex items-center gap-1.5"
                  >
                    <LogOut size={14} />
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link 
                    href="/?auth=login" 
                    className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-900 transition-colors rounded-lg flex items-center gap-1.5"
                  >
                    <LogIn size={14} />
                    Login
                  </Link>
                  <Link 
                    href="/?auth=register" 
                    className="px-3 py-1.5 text-xs bg-blue-600 text-white hover:bg-blue-700 transition-colors rounded-lg flex items-center gap-1.5"
                  >
                    <UserPlus size={14} />
                    Sign Up
                  </Link>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
