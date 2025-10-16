'use client';

import { useState, useEffect, useRef } from 'react';
import { Send, Loader2, X, Sparkles, Minimize2 } from 'lucide-react';
import { useChatbot } from './ChatbotContext';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AssistantPanelProps {
  context?: {
    page: string;
    assetSymbol?: string;
    assetName?: string;
    assetPrice?: number;
  };
}

export default function AssistantPanel({ context }: AssistantPanelProps) {
  const { isChatbotOpen, setIsChatbotOpen } = useChatbot();
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: '👋 Hi! I\'m your AI financial assistant. Ask me about any market trends, investment insights, or analysis.',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      // Fetch market and news data for context
      const [marketsRes, newsRes] = await Promise.all([
        fetch('/api/markets'),
        fetch('/api/news'),
      ]);
      const markets = await marketsRes.json();
      const news = await newsRes.json();

      // Build context string
      let contextString = '';
      if (context?.assetSymbol) {
        contextString = `User is viewing ${context.assetSymbol} (${context.assetName}) at $${context.assetPrice}`;
      } else if (context?.page === 'markets') {
        contextString = 'User is viewing the markets dashboard';
      } else if (context?.page === 'news') {
        contextString = 'User is viewing financial news';
      }

      const marketContext = markets
        .slice(0, 10)
        .map((asset: any) => `${asset.symbol}: $${asset.price} (${asset.change24h >= 0 ? '+' : ''}${asset.change24h.toFixed(2)}%)`)
        .join(', ');

      const newsContext = news
        .slice(0, 5)
        .map((article: any) => article.title)
        .join('; ');

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messages.slice(-6), // Only send last 6 messages for context
          marketContext,
          newsContext,
          pageContext: contextString,
        }),
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.message },
      ]);
    } catch (error: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `⚠️ Error: ${error.message}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const quickActions = [
    { label: '📈 Market trends?', query: 'What are the current market trends?' },
    { label: '🎯 Best opportunities?', query: 'What are the best investment opportunities right now?' },
    { label: '📰 News impact?', query: 'How is recent news affecting markets?' },
  ];

  if (!isChatbotOpen) {
    return (
      <button
        onClick={() => setIsChatbotOpen(true)}
        className="fixed right-6 bottom-6 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white p-4 rounded-full shadow-lg hover:shadow-2xl transition-all z-50 group"
      >
        <Sparkles size={24} className="group-hover:rotate-12 transition-transform" />
      </button>
    );
  }

  if (isMinimized) {
    return (
      <div className="fixed right-6 bottom-6 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50">
        <div className="flex items-center justify-between p-4 w-64">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-blue-400" />
            <span className="font-medium text-sm">AI Assistant</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setIsMinimized(false)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <Sparkles size={18} />
            </button>
            <button
              onClick={() => setIsChatbotOpen(false)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed right-0 top-16 bottom-0 w-full lg:w-96 bg-gray-900/95 backdrop-blur-sm border-l border-gray-700 shadow-2xl z-40 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gradient-to-r from-blue-500/10 to-purple-500/10">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-blue-400" />
          <h3 className="font-semibold text-sm">AI Assistant</h3>
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsMinimized(true)}
            className="text-gray-400 hover:text-white transition-colors p-1"
            title="Minimize"
          >
            <Minimize2 size={16} />
          </button>
          <button
            onClick={() => setIsChatbotOpen(false)}
            className="text-gray-400 hover:text-white transition-colors p-1"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Context Badge */}
      {context && (
        <div className="px-4 py-2 bg-blue-500/10 border-b border-gray-700">
          <div className="text-xs text-blue-400">
            {context.assetSymbol ? (
              <>Viewing <span className="font-semibold">{context.assetSymbol}</span></>
            ) : (
              <>On {context.page} page</>
            )}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 scroll-smooth">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                message.role === 'user'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-800 text-gray-100'
              }`}
            >
              {message.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-800 rounded-2xl px-3 py-2">
              <Loader2 className="animate-spin text-gray-400" size={16} />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Actions */}
      {messages.length === 1 && !loading && (
        <div className="px-4 py-2 border-t border-gray-700">
          <div className="text-xs text-gray-500 mb-2">Quick actions:</div>
          <div className="flex flex-col gap-1">
            {quickActions.map((action, index) => (
              <button
                key={index}
                onClick={() => setInput(action.query)}
                className="px-2 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs text-left transition-colors"
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-gray-700">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything..."
            className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-3 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              <Send size={16} />
            )}
          </button>
        </div>
      </form>

      {/* Disclaimer */}
      <div className="px-4 py-2 bg-yellow-500/5 border-t border-yellow-500/20">
        <p className="text-[10px] text-yellow-400/80">
          Educational info only. Not financial advice.
        </p>
      </div>
    </div>
  );
}
