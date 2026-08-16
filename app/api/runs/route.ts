import { NextResponse } from 'next/server';
import { listRuns } from '@/lib/agents/queries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const runs = listRuns(50).map((r) => {
    let symbol: string | undefined;
    try {
      symbol = r.spec_json ? JSON.parse(r.spec_json)?.primary?.symbol : undefined;
    } catch {
      /* ignore */
    }
    let action: string | undefined;
    try {
      action = r.verdict_json ? JSON.parse(r.verdict_json)?.verdict?.action : undefined;
    } catch {
      /* ignore */
    }
    return {
      id: r.id,
      createdAt: r.created_at,
      status: r.status,
      phase: r.phase,
      progress: r.progress,
      query: r.query,
      depth: r.depth,
      symbol,
      action,
      error: r.error,
    };
  });
  return NextResponse.json({ runs });
}
