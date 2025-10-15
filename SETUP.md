# 🚀 Quick Setup Guide

## Prerequisites

Before you start, make sure you have:
- **Node.js** (version 18 or higher) - [Download here](https://nodejs.org/)
- **npm** (comes with Node.js)

Check if installed:
```bash
node --version
npm --version
```

## Step-by-Step Setup

### 1️⃣ Install Dependencies

Open your terminal in the project folder and run:

```bash
npm install
```

This will install all required packages (may take 2-3 minutes).

### 2️⃣ Get Your API Keys

#### 🔑 OpenAI API Key (REQUIRED for AI Chat)

1. Go to: https://platform.openai.com/
2. Sign up or log in
3. Click on your profile → "View API Keys"
4. Click "Create new secret key"
5. Copy the key (starts with `sk-`)
6. **Important**: Add payment method to use the API

#### 🔑 Alpha Vantage API Key (REQUIRED for Stock Data)

1. Go to: https://www.alphavantage.co/support/#api-key
2. Enter your email address
3. Click "GET FREE API KEY"
4. Copy the key you receive

#### 🔑 NewsAPI Key (OPTIONAL but Recommended)

1. Go to: https://newsapi.org/register
2. Fill in your details
3. Verify your email
4. Copy your API key from the dashboard

### 3️⃣ Configure Environment Variables

1. Open the `.env` file in the project root
2. Paste your API keys:

```env
OPENAI_API_KEY=sk-your-actual-openai-key-here
ALPHA_VANTAGE_API_KEY=your-alpha-vantage-key-here
NEWS_API_KEY=your-newsapi-key-here
```

3. Save the file

### 4️⃣ Run the Application

Start the development server:

```bash
npm run dev
```

You should see:
```
▲ Next.js 14.2.5
- Local:        http://localhost:3000
```

### 5️⃣ Open in Browser

Go to: **http://localhost:3000**

You should see the FinTech Analysis Platform! 🎉

## 📱 Testing Each Feature

### Markets Page
1. Click "Markets" in navigation
2. You should see 10 assets (5 stocks + 5 cryptos)
3. Click any asset to see detailed charts
4. Try different timeframes (1D, 1W, 1M, etc.)

### News Page
1. Click "News" in navigation
2. Browse financial news articles
3. Click "Read more" to view full articles

### AI Chat
1. Click "AI Chat" in navigation
2. Try asking: "What are the current market trends?"
3. Or: "Should I invest in Bitcoin long-term?"
4. The AI has access to current market data and news

## 🐛 Troubleshooting

### Error: "Cannot find module..."
**Solution**: Run `npm install` again

### Error: "OpenAI API key not configured"
**Solution**: Make sure you added `OPENAI_API_KEY` to `.env` file

### Error: Rate limit exceeded (Alpha Vantage)
**Solution**: Free tier has 5 requests/minute limit. Wait a minute and try again.

### Chart not loading
**Solution**: Wait a few seconds, data is being fetched from external APIs

### Port 3000 already in use
**Solution**: 
```bash
# Kill the process using port 3000
lsof -ti:3000 | xargs kill -9
# Or use a different port
npm run dev -- -p 3001
```

## 💡 Important Notes

### API Rate Limits
- **Alpha Vantage** (Free): 5 requests/minute, 500/day
- **CoinGecko** (Free): 10-50 requests/minute
- **NewsAPI** (Free): 100 requests/day
- **OpenAI**: Pay-per-use (very cheap for testing)

### Costs
- Most APIs are **FREE** for development
- OpenAI charges per token (usually $0.01-0.10 per conversation)
- Upgrade to paid tiers for production use

### Mock Data
If you don't add API keys:
- Markets will still work (uses CoinGecko without key)
- News will show mock articles
- Chat will show an error message

## 🎯 Next Steps

Once everything is running:

1. **Explore the Features**: Try all three main sections
2. **Customize**: Edit colors, add more stocks, etc.
3. **Deploy**: When ready, deploy to Vercel (free hosting)

### Deploy to Vercel (Optional)

1. Push code to GitHub
2. Go to: https://vercel.com
3. Import your repository
4. Add environment variables in Vercel dashboard
5. Deploy!

## 📚 Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [OpenAI API Docs](https://platform.openai.com/docs)
- [Recharts Documentation](https://recharts.org/)
- [Tailwind CSS](https://tailwindcss.com/docs)

## 🆘 Need Help?

If you encounter any issues:
1. Check the console for error messages
2. Verify all API keys are correct
3. Make sure you're using Node.js 18+
4. Try deleting `node_modules` and running `npm install` again

---

**Enjoy your FinTech Analysis Platform! 🚀📈**
