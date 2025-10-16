import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { messages, marketContext, newsContext } = await request.json();

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    const systemMessage = `You are a professional financial AI assistant. Provide clear, concise insights.

CRITICAL INSTRUCTIONS:
- Keep responses under 80 words (4-5 sentences MAX)
- Write in plain text, NO markdown formatting
- Be extremely direct and conversational
- Focus on the most important insight
- Use emojis sparingly (max 1-2)

${marketContext ? `MARKET DATA: ${marketContext}\n` : ''}
${newsContext ? `RECENT NEWS: ${newsContext}\n` : ''}

Provide actionable financial insights. Be brief and helpful.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: systemMessage },
        ...messages,
      ],
      temperature: 0.7,
      max_tokens: 150,
    });

    return NextResponse.json({
      message: completion.choices[0].message.content,
    });
  } catch (error: any) {
    console.error('Error in intelligent chat API:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process request' },
      { status: 500 }
    );
  }
}
