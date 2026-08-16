import { db } from '../core/db';
import type { Depth } from './context';

export interface RunRow {
  id: string;
  created_at: number;
  updated_at: number;
  finished_at: number | null;
  status: string;
  phase: string | null;
  progress: number;
  query: string;
  depth: Depth;
  spec_json: string | null;
  verdict_json: string | null;
  usage_json: string | null;
  error: string | null;
}

export function getRun(id: string): RunRow | null {
  return (db().prepare('SELECT * FROM runs WHERE id = ?').get(id) as RunRow | undefined) ?? null;
}

export function listRuns(limit = 40): RunRow[] {
  return db()
    .prepare('SELECT * FROM runs ORDER BY created_at DESC LIMIT ?')
    .all(limit) as RunRow[];
}

export function getEvents(runId: string, afterSeq = 0) {
  return db()
    .prepare(
      'SELECT seq, ts, phase, agent, type, message, data_json FROM events WHERE run_id = ? AND seq > ? ORDER BY seq',
    )
    .all(runId, afterSeq) as Array<{
    seq: number;
    ts: number;
    phase: string | null;
    agent: string | null;
    type: string;
    message: string | null;
    data_json: string | null;
  }>;
}

export function getRunReports(runId: string) {
  return db()
    .prepare('SELECT section, agent, title, content, created_at FROM reports WHERE run_id = ? ORDER BY rowid')
    .all(runId) as Array<{ section: string; agent: string; title: string; content: string; created_at: number }>;
}

export function getRunMessages(runId: string) {
  return db()
    .prepare('SELECT role, content, created_at FROM messages WHERE run_id = ? ORDER BY created_at')
    .all(runId) as Array<{ role: string; content: string; created_at: number }>;
}

export function getRunArtifacts(runId: string) {
  return db()
    .prepare('SELECT ref, kind, source, url, title, as_of FROM artifacts WHERE run_id = ? ORDER BY rowid')
    .all(runId) as Array<{
    ref: string;
    kind: string;
    source: string;
    url: string | null;
    title: string;
    as_of: string | null;
  }>;
}

export function eventPayload(row: ReturnType<typeof getEvents>[number]) {
  return {
    seq: row.seq,
    ts: row.ts,
    phase: row.phase,
    agent: row.agent,
    type: row.type,
    message: row.message,
    data: row.data_json ? JSON.parse(row.data_json) : undefined,
  };
}
