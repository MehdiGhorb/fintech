import { NextResponse } from 'next/server';
import { z } from 'zod';
import { followUp } from '@/lib/agents/orchestrator';
import { loadCredentials } from '@/lib/core/keystore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const Body = z.object({ message: z.string().min(1).max(4000) });

export async function POST(request: Request, { params }: { params: { id: string } }) {
  if (!loadCredentials()) {
    return NextResponse.json({ error: 'Add an API key first.' }, { status: 401 });
  }
  const json = await request.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'Send a message.' }, { status: 400 });
  try {
    const content = await followUp(params.id, parsed.data.message);
    return NextResponse.json({ content });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Follow-up failed.' },
      { status: 500 },
    );
  }
}
