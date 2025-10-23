'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Send, Loader2, TrendingUp, Edit3, Save, X, Sparkles, PieChart as PieChartIcon, Target, AlertCircle, Download, Share2, Zap, TrendingDown, DollarSign } from 'lucide-react';

interface InvestmentAllocation {
  category: string;
  percentage: number;
  description?: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#6366f1', '#f43f5e'];

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [strategy, setStrategy] = useState<InvestmentAllocation[]>([]);
  const [userInfo, setUserInfo] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editedStrategy, setEditedStrategy] = useState<InvestmentAllocation[]>([]);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [showSplitView, setShowSplitView] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestionPrompts = [
    { icon: Sparkles, text: "Create a long-term investment portfolio", color: "from-blue-500 to-cyan-500" },
    { icon: TrendingUp, text: "I'm 30 with moderate risk tolerance", color: "from-purple-500 to-pink-500" },
    { icon: Target, text: "Help me plan for retirement", color: "from-orange-500 to-red-500" },
    { icon: DollarSign, text: "Aggressive growth strategy", color: "from-green-500 to-emerald-500" },
  ];

  useEffect(() => {
    loadInvestmentData();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Check if we should show split view
    if (strategy.length > 0 && !showSplitView && !isAnimating) {
      triggerSplitViewAnimation();
    }
  }, [strategy]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const triggerSplitViewAnimation = () => {
    setIsAnimating(true);
    setTimeout(() => {
      setShowSplitView(true);
      setTimeout(() => {
        setIsAnimating(false);
      }, 800);
    }, 100);
  };

  const loadInvestmentData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);

      if (session?.user) {
        // Load from database if logged in
        const { data: profile } = await supabase
          .from('profiles')
          .select('investment_strategy, investment_user_info, name')
          .eq('id', session.user.id)
          .single();

        if (profile?.investment_strategy && profile.investment_strategy.length > 0) {
          setStrategy(profile.investment_strategy);
          setEditedStrategy(profile.investment_strategy);
          setShowSplitView(true);
        }
        if (profile?.investment_user_info) {
          setUserInfo(profile.investment_user_info);
        }

        if (messages.length === 0) {
          const welcomeMsg: Message = {
            role: 'assistant',
            content: profile?.name 
              ? `Hi ${profile.name}! I'm your investment advisor. ${profile.investment_strategy?.length > 0 ? "I can see your current portfolio allocation. " : ""}I can help you build a personalized investment strategy. What would you like to discuss?`
              : "Hi! I'm your investment advisor. I can help you create a personalized portfolio allocation. What would you like to get started?"
          };
          setMessages([welcomeMsg]);
        }
      } else {
        // Load from localStorage if not logged in
        const savedStrategy = localStorage.getItem('investment_strategy');
        const savedUserInfo = localStorage.getItem('investment_user_info');
        
        if (savedStrategy) {
          const parsedStrategy = JSON.parse(savedStrategy);
          setStrategy(parsedStrategy);
          setEditedStrategy(parsedStrategy);
          setShowSplitView(true);
        }
        if (savedUserInfo) {
          setUserInfo(JSON.parse(savedUserInfo));
        }

        if (messages.length === 0) {
          const welcomeMsg: Message = {
            role: 'assistant',
            content: "Hi! I'm your investment advisor. I can help you create a personalized portfolio allocation. Note: Your data won't be saved after you leave unless you sign in. What would you like to get started?"
          };
          setMessages([welcomeMsg]);
        }
      }
    } catch (error) {
      console.error('Error loading investment data:', error);
      // Still show welcome message even on error
      if (messages.length === 0) {
        const welcomeMsg: Message = {
          role: 'assistant',
          content: "Hi! I'm your investment advisor. I can help you create a personalized portfolio allocation. What would you like to get started?"
        };
        setMessages([welcomeMsg]);
      }
    }
  };

  const handleSendMessage = async (messageText?: string) => {
    const textToSend = messageText || input;
    if (!textToSend.trim() || loading) return;

    const userMessage: Message = { role: 'user', content: textToSend };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setShowQuickActions(false);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const context = {
        currentStrategy: strategy,
        userInfo: userInfo,
        hasStrategy: strategy.length > 0
      };

      const response = await fetch('/api/investment-chat', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify({
          message: textToSend,
          context,
          userId: user?.id || null,
          conversationHistory: messages.slice(-6)
        })
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.response
      };

      setMessages(prev => [...prev, assistantMessage]);

      if (data.strategyUpdated) {
        if (user) {
          // Reload from database if logged in
          await loadInvestmentData();
        } else {
          // Update localStorage if not logged in
          if (data.strategy) {
            setStrategy(data.strategy);
            setEditedStrategy(data.strategy);
            setShowSplitView(true);
            localStorage.setItem('investment_strategy', JSON.stringify(data.strategy));
          }
          if (data.userInfo) {
            setUserInfo(data.userInfo);
            localStorage.setItem('investment_user_info', JSON.stringify(data.userInfo));
          }
        }
      }

    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.'
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestionClick = (text: string) => {
    handleSendMessage(text);
  };

  const handleEditPercentage = (index: number, value: string) => {
    const newStrategy = [...editedStrategy];
    const numValue = parseFloat(value) || 0;
    newStrategy[index].percentage = Math.max(0, Math.min(100, numValue));
    setEditedStrategy(newStrategy);
  };

  const handleSaveEdits = async () => {
    const total = editedStrategy.reduce((sum, item) => sum + item.percentage, 0);
    if (total === 0) return;

    const normalized = editedStrategy.map(item => ({
      ...item,
      percentage: Math.round((item.percentage / total) * 100)
    }));

    try {
      if (user) {
        // Save to database if logged in
        const { error } = await supabase
          .from('profiles')
          .update({
            investment_strategy: normalized
          })
          .eq('id', user.id);

        if (error) throw error;
      } else {
        // Save to localStorage if not logged in
        localStorage.setItem('investment_strategy', JSON.stringify(normalized));
      }

      setStrategy(normalized);
      setEditedStrategy(normalized);
      setEditMode(false);
      
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'I\'ve updated your portfolio allocation. The changes look good!'
      }]);
    } catch (error) {
      console.error('Error saving edits:', error);
    }
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-xl">
          <p className="text-white font-semibold">{payload[0].name}</p>
          <p className="text-blue-400 font-bold">{payload[0].value}%</p>
          {payload[0].payload.description && (
            <p className="text-gray-400 text-sm mt-1 max-w-xs">{payload[0].payload.description}</p>
          )}
        </div>
      );
    }
    return null;
  };

  const quickActions = [
    { label: "Rebalance my portfolio", icon: Target },
    { label: "Review my risk level", icon: AlertCircle },
    { label: "Suggest improvements", icon: TrendingUp },
    { label: "Explain my allocation", icon: PieChartIcon },
  ];

  const handleQuickAction = (action: string) => {
    setInput(action);
    setShowQuickActions(false);
    inputRef.current?.focus();
  };

  const exportPortfolio = () => {
    const data = {
      strategy,
      userInfo,
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `portfolio-${Date.now()}.json`;
    a.click();
  };

  const getPortfolioInsights = () => {
    if (strategy.length === 0) return null;

    const stocksPercentage = strategy
      .filter(s => s.category.toLowerCase().includes('stock'))
      .reduce((sum, s) => sum + s.percentage, 0);

    const bondsPercentage = strategy
      .filter(s => s.category.toLowerCase().includes('bond'))
      .reduce((sum, s) => sum + s.percentage, 0);

    let riskLevel = 'Unknown';
    let riskColor = 'gray';
    
    if (stocksPercentage >= 70) {
      riskLevel = 'Aggressive';
      riskColor = 'red';
    } else if (stocksPercentage >= 50) {
      riskLevel = 'Moderate';
      riskColor = 'yellow';
    } else {
      riskLevel = 'Conservative';
      riskColor = 'green';
    }

    return { stocksPercentage, bondsPercentage, riskLevel, riskColor };
  };

  const insights = getPortfolioInsights();
  const totalPercentage = editedStrategy.reduce((sum, item) => sum + item.percentage, 0);

  // Centered ChatGPT-like view (no portfolio yet)
  if (!showSplitView) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-black to-gray-900 flex items-center justify-center p-4">
        <div className={`w-full max-w-3xl transition-all duration-700 ease-in-out ${
          isAnimating ? 'translate-x-[40%] scale-90 opacity-50' : 'translate-x-0 scale-100 opacity-100'
        }`}>
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 mb-6 animate-pulse">
              <Sparkles size={40} className="text-white" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400">
              Investment Advisor
            </h1>
            <p className="text-gray-400 text-lg">
              Your personalized AI-powered portfolio strategist
            </p>
            {!user && (
              <div className="mt-4 mx-auto max-w-md">
                <p className="text-blue-300/70 text-sm px-4 py-2 bg-blue-900/10 border border-blue-800/30 rounded-lg">
                  💡 Not signed in - your portfolio won't be saved after you leave
                </p>
              </div>
            )}
          </div>

          {/* Suggestion Cards */}
          {messages.length === 1 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8 animate-fade-in">
              {suggestionPrompts.map((prompt, idx) => {
                const Icon = prompt.icon;
                return (
                  <button
                    key={idx}
                    onClick={() => handleSuggestionClick(prompt.text)}
                    disabled={loading}
                    className="group relative p-5 bg-gray-800/50 hover:bg-gray-800 border border-gray-700 hover:border-gray-600 rounded-2xl text-left transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-blue-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className={`absolute inset-0 bg-gradient-to-br ${prompt.color} opacity-0 group-hover:opacity-10 rounded-2xl transition-opacity duration-300`} />
                    <Icon size={24} className={`text-gray-400 group-hover:text-blue-400 transition-colors duration-300 mb-3`} />
                    <p className="text-gray-300 group-hover:text-white transition-colors duration-300 text-sm font-medium">
                      {prompt.text}
                    </p>
                  </button>
                );
              })}
            </div>
          )}

          {/* Chat Messages */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-3xl shadow-2xl backdrop-blur-xl overflow-hidden">
            <div className="max-h-[50vh] overflow-y-auto p-6 space-y-4">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} animate-slide-up`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-5 py-3 ${
                      message.role === 'user'
                        ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/20'
                        : 'bg-gray-800 text-gray-200 border border-gray-700'
                    }`}
                  >
                    <p className="text-sm md:text-base whitespace-pre-wrap leading-relaxed">{message.content}</p>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-gray-800 border border-gray-700 rounded-2xl px-5 py-4 flex items-center gap-3">
                    <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                    <span className="text-gray-400 text-sm">Thinking...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="border-t border-gray-800 p-4 bg-gray-900/80 backdrop-blur-xl">
              <div className="flex gap-3">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && !loading && handleSendMessage()}
                  placeholder="Tell me about your investment goals..."
                  className="flex-1 px-6 py-4 bg-gray-800 border border-gray-700 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                  disabled={loading}
                  autoFocus
                />
                <button
                  onClick={() => handleSendMessage()}
                  disabled={loading || !input.trim()}
                  className="px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-2xl hover:from-blue-700 hover:to-purple-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:scale-105"
                >
                  <Send size={20} />
                </button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <p className="text-center text-gray-600 text-sm mt-6">
            Powered by AI • Personalized for you
          </p>
        </div>
      </div>
    );
  }

  // Split view with animation (portfolio exists)
  return (
    <div className="min-h-screen bg-black">
      <div className="w-full px-6 py-8">
        <div className={`grid grid-cols-1 lg:grid-cols-[1fr_550px] gap-6 h-[calc(100vh-120px)] max-w-[1800px] mx-auto transition-all duration-700 ${
          isAnimating ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
        }`}>
          
          {/* Left Side - Chart & Controls */}
          <div className={`flex flex-col gap-6 transition-all duration-700 ease-out ${
            isAnimating ? 'translate-x-[-100%] opacity-0' : 'translate-x-0 opacity-100'
          }`} style={{ transitionDelay: '200ms' }}>
            
            {/* Portfolio Visualization */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 flex-1 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white">Portfolio Allocation</h2>
                {strategy.length > 0 && (
                  <button
                    onClick={() => {
                      if (editMode) {
                        setEditedStrategy(strategy);
                      }
                      setEditMode(!editMode);
                    }}
                    className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
                  >
                    {editMode ? <X size={16} /> : <Edit3 size={16} />}
                    {editMode ? 'Cancel' : 'Edit'}
                  </button>
                )}
              </div>

              <div className="flex-1 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={editMode ? editedStrategy : strategy}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      fill="#8884d8"
                      paddingAngle={2}
                      dataKey="percentage"
                      nameKey="category"
                      label={({ percentage }) => `${percentage}%`}
                      animationBegin={0}
                      animationDuration={800}
                      animationEasing="ease-out"
                    >
                      {(editMode ? editedStrategy : strategy).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {insights && !editMode && (
                <div className="mb-4 p-3 bg-gray-800/50 border border-gray-700/50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-sm">Risk Level:</span>
                    <span className={`font-semibold text-sm ${
                      insights.riskColor === 'red' ? 'text-red-400' :
                      insights.riskColor === 'yellow' ? 'text-yellow-400' :
                      'text-green-400'
                    }`}>
                      {insights.riskLevel}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                    <span>{insights.stocksPercentage}% Stocks</span>
                    <span>•</span>
                    <span>{insights.bondsPercentage}% Bonds</span>
                  </div>
                </div>
              )}

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {(editMode ? editedStrategy : strategy).map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3 bg-gray-800/50 border border-gray-700/50 rounded-lg"
                    style={{ 
                      animation: `slideInFromLeft 0.5s ease-out ${index * 0.1}s both`
                    }}
                  >
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium text-sm truncate">{item.category}</p>
                      {item.description && (
                        <p className="text-gray-500 text-xs truncate">{item.description}</p>
                      )}
                    </div>
                    {editMode ? (
                      <input
                        type="number"
                        value={item.percentage}
                        onChange={(e) => handleEditPercentage(index, e.target.value)}
                        className="w-16 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm text-center"
                        min="0"
                        max="100"
                      />
                    ) : (
                      <span className="text-white font-bold text-sm">{item.percentage}%</span>
                    )}
                  </div>
                ))}
              </div>

              {editMode && (
                <div className="mt-4 pt-4 border-t border-gray-800">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-gray-400 text-sm">Total:</span>
                    <span className={`font-bold ${totalPercentage === 100 ? 'text-green-500' : 'text-yellow-500'}`}>
                      {totalPercentage}%
                    </span>
                  </div>
                  <button
                    onClick={handleSaveEdits}
                    disabled={totalPercentage === 0}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Save size={16} />
                    Save Changes
                  </button>
                </div>
              )}
            </div>

            {userInfo && Object.keys(userInfo).length > 0 && (
              <div className="bg-blue-900/10 border border-blue-800/30 rounded-xl p-4">
                <h3 className="text-white font-semibold mb-3 text-sm">Your Profile</h3>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(userInfo).map(([key, value]) => (
                    <div key={key} className="text-sm">
                      <span className="text-gray-500 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}:</span>
                      <span className="text-gray-300 ml-2">{value as string}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={exportPortfolio}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors text-sm"
                title="Export portfolio data"
              >
                <Download size={16} />
                Export
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(
                    strategy.map(s => `${s.category}: ${s.percentage}%`).join('\n')
                  );
                  setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: 'Portfolio allocation copied to clipboard!'
                  }]);
                }}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors text-sm"
                title="Copy to clipboard"
              >
                <Share2 size={16} />
                Share
              </button>
            </div>
          </div>

          {/* Right Side - Chat - Animated */}
          <div className={`bg-gray-900/50 border border-gray-800 rounded-xl flex flex-col overflow-hidden transition-all duration-700 ease-out ${
            isAnimating ? 'translate-x-[100%] opacity-0 scale-90' : 'translate-x-0 opacity-100 scale-100'
          }`} style={{ transitionDelay: '100ms' }}>
            <div className="p-4 border-b border-gray-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center">
                  <Sparkles size={20} className="text-white" />
                </div>
                <div>
                  <h3 className="text-white font-semibold">Investment Advisor</h3>
                  <p className="text-gray-500 text-xs">Personalized portfolio guidance</p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                      message.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-800 text-gray-200'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-gray-800 rounded-2xl px-4 py-3">
                    <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t border-gray-800">
              {showQuickActions && (
                <div className="mb-3 grid grid-cols-2 gap-2">
                  {quickActions.map((action, idx) => {
                    const Icon = action.icon;
                    return (
                      <button
                        key={idx}
                        onClick={() => handleQuickAction(action.label)}
                        className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors text-sm"
                      >
                        <Icon size={14} />
                        <span className="truncate">{action.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && !loading && handleSendMessage()}
                  onFocus={() => setShowQuickActions(true)}
                  onBlur={() => setTimeout(() => setShowQuickActions(false), 200)}
                  placeholder="Ask about portfolio allocation..."
                  className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm"
                  disabled={loading}
                />
                <button
                  onClick={() => handleSendMessage()}
                  disabled={loading || !input.trim()}
                  className="px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send size={20} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes slideInFromLeft {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in {
          animation: fade-in 0.6s ease-out;
        }

        .animate-slide-up {
          animation: slide-up 0.4s ease-out;
        }
      `}</style>
    </div>
  );
}
