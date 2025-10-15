'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, Calendar, Building2 } from 'lucide-react';
import { format } from 'date-fns';
import AssistantPanel from '@/components/AssistantPanel';

interface NewsArticle {
  id: string;
  title: string;
  description: string;
  url: string;
  image: string;
  source: string;
  publishedAt: string;
}

export default function NewsPage() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNews();
  }, []);

  const fetchNews = async () => {
    try {
      const response = await fetch('/api/news');
      const data = await response.json();
      setArticles(data);
    } catch (error) {
      console.error('Error fetching news:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="container mx-auto px-4 py-8">
      <Link 
        href="/"
        className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft size={20} />
        Back to Home
      </Link>

      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4">Financial News</h1>
        <p className="text-gray-400">
          Stay updated with the latest news affecting financial markets
        </p>
      </div>

      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-gray-800/50 border border-gray-700 rounded-xl overflow-hidden animate-pulse">
              <div className="h-48 bg-gray-700"></div>
              <div className="p-6">
                <div className="h-4 bg-gray-700 rounded w-3/4 mb-3"></div>
                <div className="h-4 bg-gray-700 rounded w-full mb-2"></div>
                <div className="h-4 bg-gray-700 rounded w-2/3"></div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {articles.map((article) => (
            <article
              key={article.id}
              className="bg-gray-800/50 border border-gray-700 rounded-xl overflow-hidden hover:border-purple-500 transition-all hover:shadow-lg hover:shadow-purple-500/10 group"
            >
              {article.image && (
                <div className="h-48 overflow-hidden bg-gray-900">
                  <img
                    src={article.image}
                    alt={article.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
              
              <div className="p-6">
                <div className="flex items-center gap-4 mb-3 text-sm text-gray-500">
                  <div className="flex items-center gap-1">
                    <Building2 size={14} />
                    {article.source}
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar size={14} />
                    {format(new Date(article.publishedAt), 'MMM dd')}
                  </div>
                </div>

                <h2 className="text-xl font-semibold mb-3 group-hover:text-purple-400 transition-colors line-clamp-2">
                  {article.title}
                </h2>

                <p className="text-gray-400 text-sm mb-4 line-clamp-3">
                  {article.description}
                </p>

                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-purple-400 hover:text-purple-300 transition-colors"
                >
                  Read more
                  <ExternalLink size={16} />
                </a>
              </div>
            </article>
          ))}
        </div>
      )}
      </div>

      <AssistantPanel context={{ page: 'news' }} />
    </>
  );
}
