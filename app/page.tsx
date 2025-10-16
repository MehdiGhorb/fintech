import Link from 'next/link';
import MarketsDashboard from '@/components/MarketsDashboard';
import MarketHighlights from '@/components/MarketHighlights';
import AssistantPanel from '@/components/AssistantPanel';

export default function Home() {
  return (
    <>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-12 text-center animate-slide-up">
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            Financial Analysis Platform
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Real-time market data, comprehensive charts, AI-powered insights, and latest financial news
          </p>
        </div>

        {/* Market Highlights - Top Gainers/Losers & Today's Events */}
        <MarketHighlights />

        <MarketsDashboard />

      <div className="mt-12 grid md:grid-cols-2 gap-6">
        <Link href="/markets" className="group p-6 bg-gray-800/50 border border-gray-700 rounded-xl hover:border-blue-500 transition-all hover:shadow-lg hover:shadow-blue-500/20">
          <div className="text-3xl mb-3">📈</div>
          <h3 className="text-xl font-semibold mb-2 group-hover:text-blue-400 transition-colors">Markets</h3>
          <p className="text-gray-400">Explore stocks and cryptocurrencies with interactive charts and technical analysis</p>
        </Link>

        <Link href="/news" className="group p-6 bg-gray-800/50 border border-gray-700 rounded-xl hover:border-purple-500 transition-all hover:shadow-lg hover:shadow-purple-500/20">
          <div className="text-3xl mb-3">📰</div>
          <h3 className="text-xl font-semibold mb-2 group-hover:text-purple-400 transition-colors">News</h3>
          <p className="text-gray-400">Stay updated with the latest financial news affecting global markets</p>
        </Link>
      </div>
      </div>
      
      <AssistantPanel context={{ page: 'home' }} />
    </>
  );
}
