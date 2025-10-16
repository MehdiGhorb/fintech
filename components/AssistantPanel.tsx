'use client';

import { useState, useEffect, useRef } from 'react';
import { Send, Loader2, X, Sparkles, Minimize2, Copy, Check, TrendingUp, LineChart, Newspaper, BarChart3 } from 'lucide-react';
import { useChatbot } from './ChatbotContext';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
}

interface AssistantPanelProps {
  context?: {
    page: string;
    assetSymbol?: string;
    assetName?: string;
    assetPrice?: number;
  };
}

const SUGGESTED_PROMPTS = [
  { icon: TrendingUp, text: "What are top market trends?" },
  { icon: LineChart, text: "Analyze market sentiment" },
  { icon: Newspaper, text: "Summarize latest news" },
  { icon: BarChart3, text: "Investment opportunities?" },
];

export default function AssistantPanel({ context }: AssistantPanelProps) {
  const { isChatbotOpen, setIsChatbotOpen } = useChatbot();
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: '👋 Hi! I\'m your AI financial assistant. I can help you with market analysis, investment insights, and financial questions. How can I assist you today?',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isChatbotOpen && !isMinimized) {
      inputRef.current?.focus();
    }
  }, [isChatbotOpen, isMinimized]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent, promptText?: string) => {
    e.preventDefault();
    const userMessage = promptText || input.trim();
    if (!userMessage || loading) return;

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    // Add empty assistant message for streaming
    const assistantMessageIndex = messages.length + 1;
    setMessages((prev) => [...prev, { role: 'assistant', content: '', isStreaming: true }]);

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
        // Simulate streaming effect
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
          // Random delay between 30-80ms for natural typing effect
          await new Promise(resolve => setTimeout(resolve, Math.random() * 50 + 30));
        }
      }
    } catch (error) {
      console.error('Error:', error);
      setMessages((prev) => {
        const newMessages = [...prev];
        newMessages[assistantMessageIndex] = {
          role: 'assistant',
          content: 'Sorry, something went wrong. Please check your connection and try again.',
          isStreaming: false,
        };
        return newMessages;
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handlePromptClick = (text: string) => {
    handleSubmit({ preventDefault: () => {} } as React.FormEvent, text);
  };

  if (!isChatbotOpen) {
    return (
      <button
        onClick={() => setIsChatbotOpen(true)}
        className="fixed right-6 bottom-6 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white p-4 rounded-full shadow-lg hover:shadow-2xl transition-all z-50 group animate-pulse hover:animate-none"
      >
        <Sparkles size={24} className="group-hover:rotate-12 transition-transform" />
      </button>
    );
  }

  if (isMinimized) {
    return (
      <div className="fixed right-6 bottom-6 bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl shadow-2xl z-50 backdrop-blur-sm">
        <div className="flex items-center justify-between p-4 w-72">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Sparkles size={18} className="text-blue-400" />
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            </div>
            <span className="font-semibold text-sm">AI Assistant</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setIsMinimized(false)}
              className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-gray-700 rounded-lg"
            >
              <Sparkles size={16} />
            </button>
            <button
              onClick={() => setIsChatbotOpen(false)}
              className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-gray-700 rounded-lg"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed right-0 top-16 bottom-0 w-full lg:w-96 bg-gradient-to-b from-gray-900 to-black border-l border-gray-800 shadow-2xl z-40 flex flex-col backdrop-blur-xl">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-blue-500/10">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 bg-blue-500 blur-lg opacity-50 rounded-full"></div>
            <Sparkles size={20} className="text-blue-400 relative z-10" />
          </div>
          <div>
            <h3 className="font-bold text-sm">AI Financial Assistant</h3>
            <div className="flex items-center gap-1.5 text-xs text-green-400">
              <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
              Online
            </div>
          </div>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setIsMinimized(true)}
            className="text-gray-400 hover:text-white transition-all p-2 hover:bg-gray-800 rounded-lg"
            title="Minimize"
          >
            <Minimize2 size={16} />
          </button>
          <button
            onClick={() => setIsChatbotOpen(false)}
            className="text-gray-400 hover:text-white transition-all p-2 hover:bg-gray-800 rounded-lg"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Context Badge */}
      {context?.assetSymbol && (
        <div className="px-4 py-2.5 bg-gradient-to-r from-blue-500/20 to-purple-500/20 border-b border-gray-800">
          <div className="text-xs flex items-center gap-2">
            <TrendingUp size={14} className="text-blue-400" />
            <span className="text-gray-300">
              Analyzing <span className="font-bold text-white">{context.assetSymbol}</span>
              {context.assetPrice && <span className="text-gray-400 ml-1">${context.assetPrice.toFixed(2)}</span>}
            </span>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth custom-scrollbar">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn`}
          >
            <div className={`max-w-[85%] group ${message.role === 'user' ? 'order-2' : 'order-1'}`}>
              <div
                className={`rounded-2xl px-4 py-3 ${
                  message.role === 'user'
                    ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/20'
                    : 'bg-gray-800 text-gray-100 border border-gray-700'
                }`}
              >
                <div className="text-sm leading-relaxed break-words prose prose-invert prose-sm max-w-none">
                  {message.content}
                  {message.isStreaming && (
                    <span className="inline-block w-1 h-4 bg-blue-400 ml-1 animate-pulse"></span>
                  )}
                </div>
              </div>
              
              {message.role === 'assistant' && !message.isStreaming && message.content && (
                <button
                  onClick={() => copyToClipboard(message.content, index)}
                  className="mt-1.5 ml-2 text-xs text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1 opacity-0 group-hover:opacity-100"
                >
                  {copiedIndex === index ? (
                    <><Check size={12} /> Copied</>
                  ) : (
                    <><Copy size={12} /> Copy</>
                  )}
                </button>
              )}
            </div>
          </div>
        ))}
        
        {loading && !messages.some(m => m.isStreaming) && (
          <div className="flex justify-start animate-fadeIn">
            <div className="bg-gray-800 border border-gray-700 rounded-2xl px-4 py-3 flex items-center gap-2.5">
              <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
              <span className="text-sm text-gray-300">Thinking...</span>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Prompts - Show only when no messages */}
      {messages.length === 1 && (
        <div className="px-4 pb-3 space-y-2">
          <p className="text-xs text-gray-500 mb-2">Suggested questions:</p>
          <div className="grid grid-cols-2 gap-2">
            {SUGGESTED_PROMPTS.map((prompt, index) => (
              <button
                key={index}
                onClick={() => handlePromptClick(prompt.text)}
                className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-600 rounded-xl text-xs text-left transition-all group"
              >
                <prompt.icon size={14} className="text-blue-400 group-hover:scale-110 transition-transform" />
                <span className="text-gray-300 group-hover:text-white">{prompt.text}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-gray-800 bg-gray-900/50">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask me anything..."
            disabled={loading}
            className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm placeholder-gray-500 disabled:opacity-50 transition-all"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="px-4 py-3 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 disabled:from-gray-700 disabled:to-gray-700 text-white rounded-xl transition-all disabled:cursor-not-allowed shadow-lg hover:shadow-xl disabled:shadow-none"
          >
            <Send size={18} />
          </button>
        </form>
        <p className="text-xs text-gray-600 mt-2 text-center">
          AI can make mistakes. Verify important information.
        </p>
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #374151;
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #4b5563;
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
