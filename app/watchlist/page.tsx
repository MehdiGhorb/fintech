'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, TrendingUp, TrendingDown, Search } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

interface WatchlistItem {
  symbol: string;
  name: string;
  price?: number;
  change24h?: number;
}

export default function WatchlistPage() {
  const [user, setUser] = useState<any>(null);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSymbol, setNewSymbol] = useState('');
  const [newName, setNewName] = useState('');

  useEffect(() => {
    loadWatchlist();
  }, []);

  const loadWatchlist = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);

      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('watchlist')
          .eq('id', session.user.id)
          .single();

        if (profile?.watchlist) {
          setWatchlist(profile.watchlist);
        }
      }
    } catch (error) {
      console.error('Error loading watchlist:', error);
    } finally {
      setLoading(false);
    }
  };

  const addToWatchlist = async () => {
    if (!user || !newSymbol.trim()) return;

    const newItem: WatchlistItem = {
      symbol: newSymbol.toUpperCase().trim(),
      name: newName.trim() || newSymbol.toUpperCase().trim(),
    };

    const updatedWatchlist = [...watchlist, newItem];

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ watchlist: updatedWatchlist })
        .eq('id', user.id);

      if (!error) {
        setWatchlist(updatedWatchlist);
        setNewSymbol('');
        setNewName('');
        setShowAddModal(false);
      }
    } catch (error) {
      console.error('Error adding to watchlist:', error);
    }
  };

  const removeFromWatchlist = async (symbol: string) => {
    if (!user) return;

    const updatedWatchlist = watchlist.filter(item => item.symbol !== symbol);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ watchlist: updatedWatchlist })
        .eq('id', user.id);

      if (!error) {
        setWatchlist(updatedWatchlist);
      }
    } catch (error) {
      console.error('Error removing from watchlist:', error);
    }
  };

  const filteredWatchlist = watchlist.filter(item =>
    item.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!user) {
    return (
      <div className="container mx-auto px-6 py-8">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-white mb-4">Sign in to view your watchlist</h2>
          <p className="text-gray-400">Create an account to start tracking your favorite stocks</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-white">My Watchlist</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={20} />
          Add Stock
        </button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={20} />
          <input
            type="text"
            placeholder="Search watchlist..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>
      </div>

      {/* Watchlist Items */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : filteredWatchlist.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400">
            {searchTerm ? 'No stocks found' : 'Your watchlist is empty. Add stocks to start tracking.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredWatchlist.map((item) => (
            <div
              key={item.symbol}
              className="flex items-center justify-between p-4 bg-gray-900/50 border border-gray-800 rounded-lg hover:border-gray-700 transition-colors"
            >
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-semibold text-white">{item.symbol}</h3>
                  <span className="text-sm text-gray-400">{item.name}</span>
                </div>
                {item.price && (
                  <div className="flex items-center gap-4 mt-2">
                    <span className="text-xl text-gray-300">${item.price.toFixed(2)}</span>
                    {item.change24h !== undefined && (
                      <span className={`flex items-center gap-1 text-sm ${item.change24h >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {item.change24h >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                        {item.change24h >= 0 ? '+' : ''}{item.change24h.toFixed(2)}%
                      </span>
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={() => removeFromWatchlist(item.symbol)}
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-900/20 rounded-lg transition-colors"
              >
                <Trash2 size={20} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold text-white mb-6">Add to Watchlist</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Symbol *</label>
                <input
                  type="text"
                  placeholder="AAPL"
                  value={newSymbol}
                  onChange={(e) => setNewSymbol(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Name (optional)</label>
                <input
                  type="text"
                  placeholder="Apple Inc."
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setNewSymbol('');
                  setNewName('');
                }}
                className="flex-1 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={addToWatchlist}
                disabled={!newSymbol.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
