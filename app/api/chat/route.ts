import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { messages, marketContext, newsContext, pageContext } = await request.json();

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    // Build system message with context
    const systemMessage = `You are an expert financial advisor AI assistant. You provide SHORT, CONCISE, and ACTIONABLE insights.

CRITICAL INSTRUCTIONS:
- Keep responses under 100 words
- Be direct and to the point
- Use bullet points when listing multiple items
- No unnecessary explanations
- Focus on actionable insights
- Use emojis sparingly for visual clarity

${pageContext ? `CURRENT CONTEXT: ${pageContext}\n` : ''}
${marketContext ? `MARKET DATA: ${marketContext}\n` : ''}
${newsContext ? `RECENT NEWS: ${newsContext}\n` : ''}

Provide professional financial analysis considering:
- Current price trends and momentum
- Technical indicators
- Market sentiment from news
- Risk factors
- Long-term vs short-term perspectives

Always end with: "⚠️ Not financial advice - do your own research."`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: systemMessage },
        ...messages,
      ],
      temperature: 0.7,
      max_tokens: 250, // Limit response length
    });

    return NextResponse.json({
      message: completion.choices[0].message.content,
    });
  } catch (error: any) {
    console.error('Error in chat API:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process chat request' },
      { status: 500 }
    );
  }
}
