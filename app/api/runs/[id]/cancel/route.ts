import { NextResponse } from 'next/server';
import { cancelRun } from '@/lib/agents/orchestrator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const ok = cancelRun(params.id);
  return NextResponse.json({ ok });
}
