# 🚀 Quick Start - Run in 3 Steps!

## Step 1: Add Your OpenAI API Key

Open the `.env` file and add your OpenAI API key:

```env
OPENAI_API_KEY=sk-your-actual-key-here
```

**Don't have one?** Get it at: https://platform.openai.com/api-keys

---

## Step 2: Run the App

In your terminal, run:

```bash
npm run dev
```

Wait for:
```
▲ Next.js 14.2.5
- Local: http://localhost:3000
✓ Ready in 2.5s
```

---

## Step 3: Open in Browser

Go to: **http://localhost:3000**

---

## 🎉 That's It!

You should now see:
- 📊 **Main page** with 10 market cards
- 🤖 **AI Assistant panel** on the right side
- 📈 **Clean navigation** at the top

### Try This:
1. **Ask the assistant:** "What are the current market trends?"
2. **Click on Bitcoin** in the market cards
3. **See the context change** - Assistant now knows you're viewing Bitcoin
4. **Ask:** "Should I buy Bitcoin now?"
5. **Get specific analysis** about Bitcoin!

---

## 🎨 Features to Explore

### 1. Context-Aware Chat
- Navigate to different pages
- Watch the assistant context badge update
- Ask relevant questions for each page

### 2. Interactive Charts
- Click any market card
- View detailed price charts
- Switch timeframes (1D, 1W, 1M, 1Y, 5Y)
- See technical analysis (RSI, SMA, support/resistance)

### 3. Financial News
- Click "News" in navigation
- Browse latest financial articles
- Ask assistant about news impact

### 4. UI Controls
- **Minimize**: Bottom-left icon in assistant panel
- **Close**: X button to hide panel completely
- **Reopen**: Click floating button at bottom-right

---

## ⚠️ Troubleshooting

### "OpenAI API key not configured"
→ Make sure you added the key to `.env` file

### "Rate limit exceeded"
→ Alpha Vantage free tier has 5 requests/min. Wait 1 minute.

### Port already in use
→ Kill the process: `lsof -ti:3000 | xargs kill -9`

### Chat not responding
→ Check console for errors. Verify OpenAI API key is correct.

---

## 💰 API Costs

**Free Tiers Available:**
- ✅ CoinGecko (Crypto data) - FREE
- ✅ Alpha Vantage (Stocks) - FREE (5 req/min)
- ✅ NewsAPI - FREE (100 req/day)
- 💰 OpenAI - Pay per use (~$0.01-0.10 per conversation)

For testing: **Should cost less than $1/day** 

---

## 📸 What You'll See

```
┌─────────────────────────────────────────────────────────┐
│  FinTech        [Markets] [News]              🤖 Panel  │
├──────────────────────────────────┬─────────────────────┤
│                                  │ AI Assistant         │
│  Financial Analysis Platform     │ ┌─────────────────┐ │
│                                  │ │ Chat messages   │ │
│  [Market Cards Grid]             │ │                 │ │
│  📈 AAPL  📈 BTC  📈 ETH         │ │                 │ │
│  📈 MSFT  📈 TSLA 📈 SOL         │ └─────────────────┘ │
│                                  │ [Quick Actions]     │
│  [Navigation Cards]              │ [Input] [Send]      │
│  📈 Markets  📰 News             │ ⚠️ Disclaimer       │
└──────────────────────────────────┴─────────────────────┘
```

---

## 🎯 Enjoy Your FinTech Platform!

You now have a **fully functional financial analysis app** with:
- ✅ Real-time market data
- ✅ Interactive charts
- ✅ AI-powered insights
- ✅ Financial news
- ✅ Beautiful UI
- ✅ Context-aware assistant

**Happy analyzing! 📈🚀**
