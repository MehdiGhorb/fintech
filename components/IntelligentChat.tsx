'use client';

import { useState, useEffect, useRef } from 'react';
import { Send, Loader2, TrendingUp, Newspaper, Calendar, BarChart3, Sparkles, Mic } from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';

// Dynamic import for chart to avoid SSR issues
const MiniChart = dynamic(() => import('./MiniChart'), { ssr: false });
const ComparisonChart = dynamic(() => import('./ComparisonChart'), { ssr: false });

interface Message {
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  chartData?: {
    symbol: string;
    name: string;
    price: number;
    change24h: number;
  };
  comparisonData?: {
    stocks: {
      symbol: string;
      name: string;
      price: number;
      change24h: number;
    }[];
  };
}

const SUGGESTED_PROMPTS = [
  "Compare Tesla and Apple stocks",
  "Show me Microsoft chart",
  "Latest market news",
];

export default function IntelligentChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const detectIntent = (query: string) => {
    const lowerQuery = query.toLowerCase();
    
    // Check for comparison intent
    const comparisonKeywords = ['compare', 'vs', 'versus', 'and'];
    const hasComparisonIntent = comparisonKeywords.some(keyword => lowerQuery.includes(keyword));
    
    // All stock symbols
    const symbols = ['TSLA', 'AAPL', 'GOOGL', 'MSFT', 'AMZN', 'NVDA', 'JPM', 'V', 'WMT', 'BTC', 'ETH'];
    
    // Find all mentioned symbols
    const mentionedSymbols = symbols.filter(symbol => 
      lowerQuery.includes(symbol.toLowerCase()) || 
      lowerQuery.includes(getCompanyName(symbol).toLowerCase())
    );
    
    // If comparison intent and multiple symbols, return comparison
    if (hasComparisonIntent && mentionedSymbols.length >= 2) {
      return { type: 'comparison', symbols: mentionedSymbols.slice(0, 4) }; // Max 4 stocks
    }
    
    // If multiple symbols without comparison keyword, still compare them
    if (mentionedSymbols.length >= 2) {
      return { type: 'comparison', symbols: mentionedSymbols.slice(0, 4) };
    }
    
    // Check for single stock chart
    const stockKeywords = ['stock', 'chart', 'price', 'show', 'display'];
    const hasStockIntent = stockKeywords.some(keyword => lowerQuery.includes(keyword)) || mentionedSymbols.length > 0;
    
    if (hasStockIntent && mentionedSymbols.length === 1) {
      return { type: 'chart', symbol: mentionedSymbols[0] };
    }
    
    // Default to S&P 500 if general market query
    if (lowerQuery.includes('s&p') || lowerQuery.includes('sp500') || lowerQuery.includes('market')) {
      return { type: 'chart', symbol: 'AAPL' };
    }
    
    return { type: 'chat' };
  };

  const getCompanyName = (symbol: string) => {
    const names: Record<string, string> = {
      'TSLA': 'Tesla',
      'AAPL': 'Apple',
      'GOOGL': 'Google',
      'MSFT': 'Microsoft',
      'AMZN': 'Amazon',
      'NVDA': 'Nvidia',
      'JPM': 'JPMorgan',
      'V': 'Visa',
      'WMT': 'Walmart',
      'BTC': 'Bitcoin',
      'ETH': 'Ethereum',
    };
    return names[symbol] || symbol;
  };

  const handleSubmit = async (e: React.FormEvent, promptText?: string) => {
    e.preventDefault();
    const userMessage = promptText || input.trim();
    if (!userMessage || loading) return;

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    const intent = detectIntent(userMessage);
    const assistantMessageIndex = messages.length + 1;

    try {
      // If comparison intent, fetch multiple stocks
      if (intent.type === 'comparison' && intent.symbols) {
        const response = await fetch('/api/markets');
        const markets = await response.json();
        const stocksData = intent.symbols
          .map((sym: string) => markets.find((m: any) => m.symbol === sym))
          .filter(Boolean);

        if (stocksData.length >= 2) {
          setMessages((prev) => [...prev, {
            role: 'assistant',
            content: `Here's a comparison of ${stocksData.map((s: any) => s.symbol).join(', ')}:`,
            comparisonData: { stocks: stocksData },
          }]);
          setLoading(false);
          return;
        }
      }
      
      // If chart intent, fetch stock data and show chart
      if (intent.type === 'chart' && intent.symbol) {
        const response = await fetch('/api/markets');
        const markets = await response.json();
        const stockData = markets.find((m: any) => m.symbol === intent.symbol);

        if (stockData) {
          // Add message with chart
          setMessages((prev) => [...prev, {
            role: 'assistant',
            content: `Here's the ${getCompanyName(intent.symbol!)} (${intent.symbol}) chart:`,
            chartData: stockData,
          }]);
          setLoading(false);
          return;
        }
      }

      // Otherwise, use AI chat
      setMessages((prev) => [...prev, { role: 'assistant', content: '', isStreaming: true }]);

      const [marketsRes, newsRes] = await Promise.all([
        fetch('/api/markets'),
        fetch('/api/news'),
      ]);
      const markets = await marketsRes.json();
      const news = await newsRes.json();

      const marketContext = markets
        .slice(0, 10)
        .map((asset: any) => `${asset.symbol}: $${asset.price} (${asset.change24h >= 0 ? '+' : ''}${asset.change24h.toFixed(2)}%)`)
        .join(', ');

      const newsContext = news
        .slice(0, 5)
        .map((article: any) => article.title)
        .join('; ');

      const response = await fetch('/api/intelligent-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messages.slice(-6),
          marketContext,
          newsContext,
        }),
      });

      const data = await response.json();

      if (data.error) {
        setMessages((prev) => {
          const newMessages = [...prev];
          newMessages[assistantMessageIndex] = {
            role: 'assistant',
            content: 'Sorry, I encountered an error. Please try again.',
            isStreaming: false,
          };
          return newMessages;
        });
      } else {
        // Streaming effect
        const fullResponse = data.message;
        let currentText = '';
        const words = fullResponse.split(' ');

        for (let i = 0; i < words.length; i++) {
          currentText += (i > 0 ? ' ' : '') + words[i];
          setMessages((prev) => {
            const newMessages = [...prev];
            newMessages[assistantMessageIndex] = {
              role: 'assistant',
              content: currentText,
              isStreaming: i < words.length - 1,
            };
            return newMessages;
          });
          await new Promise(resolve => setTimeout(resolve, Math.random() * 50 + 30));
        }
      }
    } catch (error) {
      console.error('Error:', error);
      setMessages((prev) => {
        const newMessages = [...prev];
        newMessages[assistantMessageIndex] = {
          role: 'assistant',
          content: 'Sorry, something went wrong. Please try again.',
          isStreaming: false,
        };
        return newMessages;
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePromptClick = (text: string) => {
    handleSubmit({ preventDefault: () => {} } as React.FormEvent, text);
  };

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Minimalistic Navigation */}
      <nav className="border-b border-gray-900 bg-black/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={20} className="text-gray-500" />
            <span className="text-sm font-medium text-gray-400">FinanceGPT</span>
          </div>
          <div className="flex items-center gap-1">
            <Link href="/markets" className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors rounded-lg hover:bg-gray-900">
              <TrendingUp size={14} className="inline mr-1.5" />
              Markets
            </Link>
            <Link href="/screener" className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors rounded-lg hover:bg-gray-900">
              <BarChart3 size={14} className="inline mr-1.5" />
              Screener
            </Link>
            <Link href="/calendar" className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors rounded-lg hover:bg-gray-900">
              <Calendar size={14} className="inline mr-1.5" />
              Calendar
            </Link>
            <Link href="/news" className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors rounded-lg hover:bg-gray-900">
              <Newspaper size={14} className="inline mr-1.5" />
              News
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col items-center px-6 py-8">
        {messages.length === 0 ? (
          // Empty state - Perplexity style
          <div className="w-full max-w-3xl flex flex-col items-center justify-center flex-1 animate-fade-in">
            <div className="text-center space-y-4 mb-12">
              <h1 className="text-5xl md:text-6xl font-light text-gray-100 tracking-tight">
                Where knowledge begins
              </h1>
              <p className="text-gray-500 text-base">
                Ask anything about financial markets
              </p>
            </div>

            {/* Suggested Prompts */}
            <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-3 mb-8">
              {SUGGESTED_PROMPTS.map((prompt, index) => (
                <button
                  key={index}
                  onClick={() => handlePromptClick(prompt)}
                  className="p-4 text-left bg-gray-900/30 border border-gray-800/50 hover:border-gray-700 hover:bg-gray-900/50 rounded-xl transition-all text-sm text-gray-400 hover:text-gray-200 group"
                >
                  <div className="text-gray-600 group-hover:text-gray-500 transition-colors text-xs mb-1.5 font-medium">
                    Try this:
                  </div>
                  <div className="text-gray-300 group-hover:text-gray-100">
                    {prompt}
                  </div>
                </button>
              ))}
            </div>

            {/* Input Box - Centered */}
            <div className="w-full max-w-2xl">
              <form onSubmit={handleSubmit} className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask anything..."
                  disabled={loading}
                  className="w-full bg-gray-900/50 border border-gray-800 rounded-full px-6 py-4 pr-32 text-base text-gray-100 placeholder-gray-600 focus:outline-none focus:border-gray-700 focus:bg-gray-900 transition-all disabled:opacity-50 shadow-2xl"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  <button
                    type="button"
                    className="p-2.5 text-gray-500 hover:text-gray-300 hover:bg-gray-800 rounded-full transition-colors"
                    title="Voice input (coming soon)"
                  >
                    <Mic size={18} />
                  </button>
                  <button
                    type="submit"
                    disabled={!input.trim() || loading}
                    className="p-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:cursor-not-allowed rounded-full transition-colors shadow-lg disabled:shadow-none"
                  >
                    {loading ? (
                      <Loader2 size={18} className="text-white animate-spin" />
                    ) : (
                      <Send size={18} className="text-white" />
                    )}
                  </button>
                </div>
              </form>
              <p className="text-xs text-gray-600 text-center mt-4">
                AI-powered financial insights. Verify important information.
              </p>
            </div>
          </div>
        ) : (
          // Messages view
          <div className="w-full max-w-4xl flex-1 overflow-y-auto space-y-6 pb-32">
            {messages.map((message, index) => (
              <div key={index} className="space-y-4 animate-fade-in">
                {message.role === 'user' ? (
                  <div className="flex justify-end">
                    <div className="bg-gray-900 border border-gray-800 rounded-2xl px-4 py-3 max-w-2xl">
                      <p className="text-sm text-gray-100">{message.content}</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="prose prose-invert prose-sm max-w-none">
                      <p className="text-sm text-gray-300 leading-relaxed">
                        {message.content}
                        {message.isStreaming && (
                          <span className="inline-block w-1 h-4 bg-gray-500 ml-1 animate-pulse"></span>
                        )}
                      </p>
                    </div>
                    
                    {/* Comparison Chart Display */}
                    {message.comparisonData && (
                      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 animate-slide-up">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-semibold text-gray-100">
                            Stock Comparison
                          </h3>
                        </div>
                        <div className="mb-6">
                          <ComparisonChart stocks={message.comparisonData.stocks} />
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {message.comparisonData.stocks.map((stock) => (
                            <div key={stock.symbol} className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
                              <div className="text-xs text-gray-500 mb-1">{stock.name}</div>
                              <div className="text-lg font-bold text-gray-100">${stock.price.toFixed(2)}</div>
                              <div className={`text-xs ${stock.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {stock.change24h >= 0 ? '+' : ''}{stock.change24h.toFixed(2)}%
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Single Chart Display */}
                    {message.chartData && (
                      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 animate-slide-up">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h3 className="text-lg font-semibold text-gray-100">
                              {message.chartData.name}
                            </h3>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-2xl font-bold text-gray-100">
                                ${message.chartData.price.toFixed(2)}
                              </span>
                              <span className={`text-sm ${message.chartData.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {message.chartData.change24h >= 0 ? '+' : ''}{message.chartData.change24h.toFixed(2)}%
                              </span>
                            </div>
                          </div>
                          <Link
                            href={`/markets/${message.chartData.symbol}`}
                            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-xs text-gray-300 transition-colors"
                          >
                            View Details
                          </Link>
                        </div>
                        <div className="h-80">
                          <MiniChart 
                            symbol={message.chartData.symbol}
                            price={message.chartData.price}
                            change24h={message.chartData.change24h}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            
            {loading && !messages.some(m => m.isStreaming) && (
              <div className="flex items-center gap-2 text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Thinking...</span>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Input Area - Only show when there are messages */}
        {messages.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black to-transparent pt-8 pb-6 px-6">
            <div className="max-w-3xl mx-auto">
              <form onSubmit={handleSubmit} className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask a follow up..."
                  disabled={loading}
                  className="w-full bg-gray-900/50 border border-gray-800 rounded-full px-6 py-4 pr-32 text-base text-gray-100 placeholder-gray-600 focus:outline-none focus:border-gray-700 focus:bg-gray-900 transition-all disabled:opacity-50 shadow-2xl"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  <button
                    type="button"
                    className="p-2.5 text-gray-500 hover:text-gray-300 hover:bg-gray-800 rounded-full transition-colors"
                    title="Voice input (coming soon)"
                  >
                    <Mic size={18} />
                  </button>
                  <button
                    type="submit"
                    disabled={!input.trim() || loading}
                    className="p-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:cursor-not-allowed rounded-full transition-colors shadow-lg disabled:shadow-none"
                  >
                    {loading ? (
                      <Loader2 size={18} className="text-white animate-spin" />
                    ) : (
                      <Send size={18} className="text-white" />
                    )}
                  </button>
                </div>
              </form>
              <p className="text-xs text-gray-600 text-center mt-4">
                AI-powered financial insights. Verify important information.
              </p>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
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
          animation: fade-in 0.4s ease-out;
        }
        .animate-slide-up {
          animation: slide-up 0.5s ease-out;
        }
      `}</style>
    </div>
  );
}
