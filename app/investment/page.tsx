'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { MessageSquare, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface InvestmentAllocation {
  category: string;
  percentage: number;
  description?: string;
}

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#6366f1'];

export default function InvestmentPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [strategy, setStrategy] = useState<InvestmentAllocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [userInfo, setUserInfo] = useState<any>(null);

  useEffect(() => {
    loadInvestmentStrategy();
  }, []);

  const loadInvestmentStrategy = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);

      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('investment_strategy, investment_user_info')
          .eq('id', session.user.id)
          .single();

        if (profile?.investment_strategy) {
          setStrategy(profile.investment_strategy);
        }
        if (profile?.investment_user_info) {
          setUserInfo(profile.investment_user_info);
        }
      }
    } catch (error) {
      console.error('Error loading investment strategy:', error);
    } finally {
      setLoading(false);
    }
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-3">
          <p className="text-white font-semibold">{payload[0].name}</p>
          <p className="text-blue-400">{payload[0].value}%</p>
          {payload[0].payload.description && (
            <p className="text-gray-400 text-sm mt-1">{payload[0].payload.description}</p>
          )}
        </div>
      );
    }
    return null;
  };

  if (!user) {
    return (
      <div className="container mx-auto px-6 py-8">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-white mb-4">Sign in to view your investment strategy</h2>
          <p className="text-gray-400">Create an account to get personalized investment advice</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Investment Strategy</h1>
          <p className="text-gray-400">Personalized portfolio allocation based on your profile</p>
        </div>
        {strategy.length > 0 && (
          <button
            onClick={() => router.push('/chat')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <RefreshCw size={20} />
            Update Strategy
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : strategy.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="max-w-2xl text-center space-y-6">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-900/20 border border-blue-800/50 rounded-full mb-4">
              <MessageSquare size={40} className="text-blue-500" />
            </div>
            <h2 className="text-2xl font-bold text-white">No Investment Strategy Yet</h2>
            <p className="text-gray-400 text-lg">
              Chat with our AI assistant to create a personalized investment strategy tailored to your:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              <div className="p-4 bg-gray-900/50 border border-gray-800 rounded-lg text-left">
                <h3 className="text-white font-semibold mb-2">Personal Profile</h3>
                <ul className="text-gray-400 text-sm space-y-1">
                  <li>• Age & Life Stage</li>
                  <li>• Risk Tolerance</li>
                  <li>• Financial Goals</li>
                </ul>
              </div>
              <div className="p-4 bg-gray-900/50 border border-gray-800 rounded-lg text-left">
                <h3 className="text-white font-semibold mb-2">Financial Details</h3>
                <ul className="text-gray-400 text-sm space-y-1">
                  <li>• Income Level</li>
                  <li>• Investment Timeline</li>
                  <li>• Current Assets</li>
                </ul>
              </div>
            </div>
            <button
              onClick={() => router.push('/chat')}
              className="mt-8 flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors mx-auto"
            >
              <MessageSquare size={20} />
              Start Chat to Create Strategy
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Pie Chart */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-6">Portfolio Allocation</h2>
            <ResponsiveContainer width="100%" height={400}>
              <PieChart>
                <Pie
                  data={strategy}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percentage }) => `${name}: ${percentage}%`}
                  outerRadius={120}
                  fill="#8884d8"
                  dataKey="percentage"
                  nameKey="category"
                >
                  {strategy.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Breakdown */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white mb-6">Allocation Breakdown</h2>
            {strategy.map((item, index) => (
              <div
                key={item.category}
                className="p-4 bg-gray-900/50 border border-gray-800 rounded-lg hover:border-gray-700 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <h3 className="text-white font-semibold">{item.category}</h3>
                  </div>
                  <span className="text-2xl font-bold text-white">{item.percentage}%</span>
                </div>
                {item.description && (
                  <p className="text-gray-400 text-sm mt-2 ml-7">{item.description}</p>
                )}
              </div>
            ))}

            {/* User Info Summary */}
            {userInfo && (
              <div className="mt-8 p-4 bg-blue-900/20 border border-blue-800/50 rounded-lg">
                <h3 className="text-white font-semibold mb-3">Based on Your Profile</h3>
                <div className="space-y-2 text-sm">
                  {userInfo.age && (
                    <p className="text-gray-300">
                      <span className="text-gray-500">Age:</span> {userInfo.age}
                    </p>
                  )}
                  {userInfo.riskTolerance && (
                    <p className="text-gray-300">
                      <span className="text-gray-500">Risk Tolerance:</span> {userInfo.riskTolerance}
                    </p>
                  )}
                  {userInfo.investmentGoal && (
                    <p className="text-gray-300">
                      <span className="text-gray-500">Goal:</span> {userInfo.investmentGoal}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
