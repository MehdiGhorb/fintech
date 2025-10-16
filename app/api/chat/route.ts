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
    const systemMessage = `You are an expert financial advisor AI assistant. You provide ULTRA-SHORT, CONCISE insights.

CRITICAL INSTRUCTIONS:
- Keep responses under 60 words (3-4 sentences MAX)
- Write in plain text, NO markdown formatting (no **, --, ##, etc.)
- Be extremely direct and conversational
- Only mention the most important point or two
- Skip obvious information
- Use emojis sparingly (max 1-2 per response)
- NO bullet points, NO lists - just brief paragraphs

${pageContext ? `CURRENT CONTEXT: ${pageContext}\n` : ''}
${marketContext ? `MARKET DATA: ${marketContext}\n` : ''}
${newsContext ? `RECENT NEWS: ${newsContext}\n` : ''}

Give only the key insight or actionable takeaway. Be brief and conversational.

Always end with: "⚠️ Not financial advice."`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: systemMessage },
        ...messages,
      ],
      temperature: 0.7,
      max_tokens: 120, // Force short responses
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
