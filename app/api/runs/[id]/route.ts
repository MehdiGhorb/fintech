import { NextResponse } from 'next/server';
import { getRun, getRunArtifacts, getRunMessages, getRunReports } from '@/lib/agents/queries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const run = getRun(params.id);
  if (!run) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let spec = null;
  let verdict = null;
  try {
    spec = run.spec_json ? JSON.parse(run.spec_json) : null;
  } catch {
    /* ignore */
  }
  try {
    verdict = run.verdict_json ? JSON.parse(run.verdict_json) : null;
  } catch {
    /* ignore */
  }

  const reports = getRunReports(run.id);
  const final = reports.find((r) => r.section === 'final') ?? reports.find((r) => r.agent === 'pm');

  return NextResponse.json({
    id: run.id,
    createdAt: run.created_at,
    finishedAt: run.finished_at,
    status: run.status,
    phase: run.phase,
    progress: run.progress,
    query: run.query,
    depth: run.depth,
    error: run.error,
    usage: run.usage_json ? JSON.parse(run.usage_json) : null,
    spec,
    verdict: verdict?.verdict ?? verdict,
    reports,
    messages: getRunMessages(run.id),
    artifacts: getRunArtifacts(run.id),
    report: final?.content ?? null,
  });
}
