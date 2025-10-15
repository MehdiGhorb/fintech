# FinTech Analysis Platform

A modern, comprehensive financial analysis application built with Next.js 14, featuring real-time market data, interactive charts, AI-powered insights, and financial news.

## Features

### 📈 Markets
- Real-time stock and cryptocurrency data
- Interactive price charts with multiple timeframes (1D, 1W, 1M, 3M, 1Y, 5Y)
- Technical analysis with RSI, moving averages, support/resistance levels
- 10 popular assets tracked (5 stocks + 5 cryptocurrencies)

### 📰 News
- Latest financial news from multiple sources
- Real-time updates on market-affecting events
- Clean, modern card-based layout

### 🤖 AI Chat Assistant
- OpenAI GPT-4 powered financial advisor
- Context-aware responses based on current market data and news
- Investment insights and analysis
- Educational information about markets and trends

### 🎨 Design
- Modern, professional dark theme
- Fully responsive design
- Smooth animations and transitions
- Clean, intuitive navigation

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **AI**: OpenAI GPT-4
- **Data Sources**:
  - Alpha Vantage (Stock data)
  - CoinGecko (Cryptocurrency data)
  - NewsAPI (Financial news)

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Then edit `.env` and add your API keys:

```env
# Required for AI Chat
OPENAI_API_KEY=your_openai_api_key_here

# Required for stock data (Get free key at https://www.alphavantage.co/support/#api-key)
ALPHA_VANTAGE_API_KEY=your_alpha_vantage_key_here

# Optional for news (Get free key at https://newsapi.org/register)
NEWS_API_KEY=your_news_api_key_here

# Optional for CoinGecko Pro (Free tier works without key)
COINGECKO_API_KEY=
```

### 3. Get API Keys

#### OpenAI (Required for Chat)
1. Go to https://platform.openai.com/
2. Sign up or log in
3. Navigate to API keys section
4. Create a new API key
5. Copy and paste into `.env`

#### Alpha Vantage (Required for Stocks)
1. Go to https://www.alphavantage.co/support/#api-key
2. Enter your email
3. Get your free API key
4. Copy and paste into `.env`

#### NewsAPI (Optional but recommended)
1. Go to https://newsapi.org/register
2. Sign up for free account
3. Get your API key
4. Copy and paste into `.env`

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

### Markets Page
- View real-time prices for 10 assets
- Filter by stocks or cryptocurrencies
- Click any asset to view detailed charts and technical analysis
- Switch between different timeframes

### News Page
- Browse latest financial news
- Click articles to read full stories
- Stay updated on market-affecting events

### Chat Page
- Ask questions about market trends
- Get AI-powered investment insights
- Receive analysis based on current data and news
- Use suggested questions or ask your own

## Project Structure

```
fintech/
├── app/
│   ├── api/
│   │   ├── chat/route.ts          # OpenAI chat endpoint
│   │   ├── markets/route.ts       # Market data endpoint
│   │   ├── markets/[id]/route.ts  # Individual asset data
│   │   └── news/route.ts          # News feed endpoint
│   ├── chat/page.tsx              # AI Chat page
│   ├── markets/
│   │   ├── page.tsx               # Markets dashboard
│   │   └── [id]/page.tsx          # Asset detail page
│   ├── news/page.tsx              # News feed page
│   ├── layout.tsx                 # Root layout
│   ├── page.tsx                   # Home page
│   └── globals.css                # Global styles
├── components/
│   ├── MarketsDashboard.tsx       # Market overview cards
│   ├── Navigation.tsx             # Top navigation bar
│   ├── PriceChart.tsx            # Interactive price chart
│   └── TechnicalAnalysis.tsx     # Technical indicators
├── .env                           # Environment variables (create this)
├── .env.example                   # Example env file
├── next.config.mjs                # Next.js configuration
├── package.json                   # Dependencies
├── tailwind.config.ts             # Tailwind configuration
└── tsconfig.json                  # TypeScript configuration
```

## Notes

- The app uses free API tiers, which have rate limits
- Alpha Vantage has a limit of 5 API requests per minute on free tier
- For production use, consider upgrading to paid API plans
- The AI chat provides educational information, not financial advice
- Always do your own research before making investment decisions

## Future Enhancements

Potential features for future versions:
- User authentication and portfolios
- Watchlist functionality
- Price alerts
- More technical indicators
- Backtesting tools
- Social sentiment analysis
- More data sources

## License

MIT

## Disclaimer

This application is for educational purposes only. The information provided should not be considered as financial advice. Always consult with a qualified financial advisor before making investment decisions.
