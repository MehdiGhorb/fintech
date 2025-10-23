'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { TrendingUp, Newspaper, Briefcase, Eye, LogIn, UserPlus, LogOut, User, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check current session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setUser(session?.user ?? null);
      
      // Fetch user profile if logged in
      if (session?.user) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('name, family_name')
          .eq('id', session.user.id)
          .single();
        
        setProfile(profileData);
      }
      
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);
      
      // Fetch user profile if logged in
      if (session?.user) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('name, family_name')
          .eq('id', session.user.id)
          .single();
        
        setProfile(profileData);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const isActive = (path: string) => pathname === path;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    router.push('/');
  };

  return (
    <nav className="border-b border-gray-900 bg-black/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="w-full px-6 py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 flex-shrink-0" aria-label="Northline Finance home">
            <span className="text-base font-medium text-gray-400">Northline Finance</span>
          </Link>
          
          <div className="flex items-center gap-4 ml-auto">
            <div className="flex items-center gap-1">
              <Link 
                href="/" 
                className={`px-4 py-2 text-sm transition-colors rounded-lg ${
                  isActive('/') || isActive('/investment')
                    ? 'text-gray-200 bg-gray-900' 
                    : 'text-gray-500 hover:text-gray-300 hover:bg-gray-900'
                }`}
              >
                <Sparkles size={16} className="inline mr-2" />
                Investment
              </Link>
              <Link 
                href="/markets" 
                className={`px-4 py-2 text-sm transition-colors rounded-lg ${
                  isActive('/markets') 
                    ? 'text-gray-200 bg-gray-900' 
                    : 'text-gray-500 hover:text-gray-300 hover:bg-gray-900'
                }`}
              >
                <TrendingUp size={16} className="inline mr-2" />
                Markets
              </Link>
              <Link 
                href="/watchlist" 
                className={`px-4 py-2 text-sm transition-colors rounded-lg ${
                  isActive('/watchlist') 
                    ? 'text-gray-200 bg-gray-900' 
                    : 'text-gray-500 hover:text-gray-300 hover:bg-gray-900'
                }`}
              >
                <Eye size={16} className="inline mr-2" />
                Watchlist
              </Link>
            </div>

            {!loading && (
              <div className="flex items-center gap-2 ml-2 pl-4 border-l border-gray-800">
                {user ? (
                  <>
                    <div className="px-4 py-2 text-sm text-gray-400 flex items-center gap-2">
                      <User size={16} />
                      <span>{profile?.name || user.email?.split('@')[0]}</span>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 hover:bg-gray-900 transition-colors rounded-lg flex items-center gap-2"
                    >
                      <LogOut size={16} />
                      Logout
                    </button>
                  </>
                ) : (
                  <>
                    <Link 
                      href="/?auth=login" 
                      className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 hover:bg-gray-900 transition-colors rounded-lg flex items-center gap-2"
                    >
                      <LogIn size={16} />
                      Login
                    </Link>
                    <Link 
                      href="/?auth=register" 
                      className="px-4 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 transition-colors rounded-lg flex items-center gap-2"
                    >
                      <UserPlus size={16} />
                      Sign Up
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
