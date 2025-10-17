import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Define available tools for the AI
const tools = [
  {
    type: 'function' as const,
    function: {
      name: 'show_stock_chart',
      description: 'Display a price chart for a single stock or cryptocurrency. Use this when user explicitly asks to see a chart, view price movement, or show stock/crypto visualization.',
      parameters: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'The stock/crypto symbol (e.g., TSLA, AAPL, BTC, ETH)',
          },
        },
        required: ['symbol'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'compare_stocks',
      description: 'Compare multiple stocks or cryptocurrencies side by side with a comparison chart. Use when user wants to compare, contrast, or see multiple assets together.',
      parameters: {
        type: 'object',
        properties: {
          symbols: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of 2-4 stock/crypto symbols to compare (e.g., ["TSLA", "AAPL"])',
          },
        },
        required: ['symbols'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_market_data',
      description: 'Fetch current market data including prices and price changes for stocks and cryptocurrencies. Use this when you need live market information to answer questions about current prices, market performance, or trends.',
      parameters: {
        type: 'object',
        properties: {
          symbols: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional: Specific symbols to fetch. If not provided, returns top market assets.',
          },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_news',
      description: 'Fetch latest financial news articles. Use when user asks about news, recent events, or market updates.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
];

export async function POST(request: NextRequest) {
  try {
    const { messages } = await request.json();

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    const systemMessage = `You are an expert financial AI assistant with a natural, human-like personality.

PERSONALITY:
- Be conversational and friendly, like talking to a knowledgeable friend
- Respond naturally to greetings and casual conversation
- Show enthusiasm when discussing markets and investments
- Be concise but thorough (60-100 words typically)
- Write in plain text, NO markdown formatting
- Use emojis sparingly (1-2 max) to add warmth

CAPABILITIES:
You have access to tools to:
- Show stock/crypto charts (show_stock_chart)
- Compare multiple assets (compare_stocks)
- Get live market data (get_market_data)
- Fetch financial news (get_news)

IMPORTANT RULES:
- ONLY use tools when the user clearly wants that data
- If user says "don't show chart" or "no chart" - DO NOT call show_stock_chart or compare_stocks
- For casual questions about an asset, use get_market_data to get info, then respond conversationally
- Always respect user preferences about visualization vs text-only responses
- When discussing prices/performance, you can call get_market_data to get current info
- Be smart about context - understand the full meaning of the user's request

Examples:
- "Hi" → Just greet naturally, no tools
- "What do you think about BTC?" → Use get_market_data, respond with analysis
- "What do you think about BTC? Don't show chart" → Use get_market_data, text response only
- "Show me Tesla chart" → Use show_stock_chart
- "Compare Tesla and Apple" → Use compare_stocks
- "Latest market news" → Use get_news`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: systemMessage },
        ...messages,
      ],
      tools,
      tool_choice: 'auto',
      temperature: 0.7,
      max_tokens: 500,
    });

    const responseMessage = completion.choices[0].message;

    return NextResponse.json({
      message: responseMessage.content,
      toolCalls: responseMessage.tool_calls,
    });
  } catch (error: any) {
    console.error('Error in intelligent chat API:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process request' },
      { status: 500 }
    );
  }
}
