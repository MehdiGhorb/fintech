import { NextResponse } from 'next/server';
import { z } from 'zod';
import { loadCredentials } from '@/lib/core/keystore';
import { startRun } from '@/lib/agents/orchestrator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const Body = z.object({
  query: z.string().min(2).max(4000),
  depth: z.enum(['quick', 'standard', 'deep', 'exhaustive']).optional(),
});

export async function POST(request: Request) {
  if (!loadCredentials()) {
    return NextResponse.json({ error: 'Add an API key first.' }, { status: 401 });
  }
  const json = await request.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Send a research request.' }, { status: 400 });
  }
  try {
    const { runId } = await startRun({ query: parsed.data.query, depth: parsed.data.depth });
    return NextResponse.json({ runId });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not start the analysis.' },
      { status: 500 },
    );
  }
}
