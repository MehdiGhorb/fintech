import { db, uid } from '../core/db';
import type { AnalystView, AssetRef, Bar, CompanyProfile, FinancialStatement, NewsItem, Quote, Statistics } from '../sources/types';
import type { QuantReport } from '../quant/engine';
import type { MacroSnapshot } from '../sources/macro';
import type { CryptoMarket } from '../sources/crypto';

export type Horizon = string;

export interface AnalysisSpec {
  /** What the user literally asked for. */
  request: string;
  primary: AssetRef;
  comparisons: AssetRef[];
  horizonLabel: string;
  horizonDays: number;
  objective: 'directional-trade' | 'position-entry' | 'hold-or-sell' | 'research' | 'comparison';
  direction: 'long-bias' | 'short-bias' | 'neutral';
  riskTolerance: 'conservative' | 'moderate' | 'aggressive';
  /** Anything the user specifically wants covered. */
  focusAreas: string[];
  notes: string;
}

export interface Dossier {
  asset: AssetRef;
  quote: Quote | null;
  bars: Bar[];
  quant: QuantReport | null;
  quantText: string;
  profile: CompanyProfile | null;
  statistics: Statistics | null;
  financials: FinancialStatement[];
  quarterlyFinancials: FinancialStatement[];
  ttmMetrics: Record<string, number> | null;
  analysts: AnalystView | null;
  news: NewsItem[];
  macro: MacroSnapshot | null;
  crypto: CryptoMarket | null;
  secFacts: Record<string, unknown> | null;
  filings: Array<{ form: string; filedAt: string; url: string }>;
  insiders: Array<Record<string, unknown>>;
  peers: Array<Record<string, unknown>>;
  syntheticBars: boolean;
}

export type EventType =
  | 'phase'
  | 'agent-start'
  | 'agent-finish'
  | 'agent-thought'
  | 'tool-call'
  | 'tool-result'
  | 'artifact'
  | 'report'
  | 'warning'
  | 'error'
  | 'usage'
  | 'done';

export interface RunEvent {
  seq: number;
  ts: number;
  phase?: string;
  agent?: string;
  type: EventType;
  message?: string;
  data?: unknown;
}

/**
 * Per-run shared state. Holds the evidence store, the event log used for
 * streaming, and the token budget.
 */
export class RunContext {
  private seq = 0;
  private artifactCounter = 0;
  readonly usage = { inputTokens: 0, outputTokens: 0, calls: 0 };
  private listeners = new Set<(event: RunEvent) => void>();
  phase = 'starting';
  cancelled = false;

  constructor(
    readonly runId: string,
    readonly depth: 'quick' | 'standard' | 'deep' | 'exhaustive',
  ) {}

  emit(event: Omit<RunEvent, 'seq' | 'ts'>): RunEvent {
    const full: RunEvent = { ...event, seq: ++this.seq, ts: Date.now(), phase: event.phase ?? this.phase };
    db()
      .prepare(
        'INSERT INTO events (run_id, ts, seq, phase, agent, type, message, data_json) VALUES (?,?,?,?,?,?,?,?)',
      )
      .run(
        this.runId,
        full.ts,
        full.seq,
        full.phase ?? null,
        full.agent ?? null,
        full.type,
        full.message ?? null,
        full.data === undefined ? null : JSON.stringify(full.data),
      );
    for (const listener of this.listeners) {
      try {
        listener(full);
      } catch {
        /* a broken stream must not stop the run */
      }
    }
    return full;
  }

  subscribe(listener: (event: RunEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  setPhase(phase: string, message: string, progress?: number): void {
    this.phase = phase;
    if (progress !== undefined) {
      db().prepare('UPDATE runs SET phase = ?, progress = ?, updated_at = ? WHERE id = ?')
        .run(phase, progress, Date.now(), this.runId);
    } else {
      db().prepare('UPDATE runs SET phase = ?, updated_at = ? WHERE id = ?').run(phase, Date.now(), this.runId);
    }
    this.emit({ type: 'phase', phase, message });
  }

  /**
   * Stores a piece of evidence and returns its citation ref. Agents cite these
   * refs, and the fact-checker resolves them back to the source.
   */
  addArtifact(input: {
    kind: string;
    source: string;
    title: string;
    url?: string;
    asOf?: string;
    data?: unknown;
    text?: string;
  }): string {
    const ref = `E${++this.artifactCounter}`;
    db()
      .prepare(
        `INSERT INTO artifacts (id, run_id, ref, kind, source, url, title, as_of, data_json, text, created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        uid('art'),
        this.runId,
        ref,
        input.kind,
        input.source,
        input.url ?? null,
        input.title,
        input.asOf ?? null,
        input.data === undefined ? null : JSON.stringify(input.data),
        input.text ?? null,
        Date.now(),
      );
    this.emit({
      type: 'artifact',
      message: `${ref}: ${input.title}`,
      data: { ref, source: input.source, url: input.url, kind: input.kind },
    });
    return ref;
  }

  listArtifacts(): Array<{ ref: string; kind: string; source: string; title: string; url: string | null }> {
    return db()
      .prepare('SELECT ref, kind, source, title, url FROM artifacts WHERE run_id = ? ORDER BY rowid')
      .all(this.runId) as Array<{ ref: string; kind: string; source: string; title: string; url: string | null }>;
  }

  getArtifact(ref: string): { ref: string; title: string; source: string; url: string | null; text: string | null; data_json: string | null } | null {
    return (
      (db()
        .prepare('SELECT ref, title, source, url, text, data_json FROM artifacts WHERE run_id = ? AND ref = ?')
        .get(this.runId, ref) as any) ?? null
    );
  }

  saveReport(section: string, agent: string, title: string, content: string, data?: unknown): void {
    db()
      .prepare(
        'INSERT INTO reports (id, run_id, section, agent, title, content, data_json, created_at) VALUES (?,?,?,?,?,?,?,?)',
      )
      .run(uid('rep'), this.runId, section, agent, title, content, data === undefined ? null : JSON.stringify(data), Date.now());
    this.emit({ type: 'report', agent, message: title, data: { section, title, content } });
  }

  getReports(): Array<{ section: string; agent: string; title: string; content: string }> {
    return db()
      .prepare('SELECT section, agent, title, content FROM reports WHERE run_id = ? ORDER BY rowid')
      .all(this.runId) as Array<{ section: string; agent: string; title: string; content: string }>;
  }

  addUsage(u: { inputTokens: number; outputTokens: number; calls: number }): void {
    this.usage.inputTokens += u.inputTokens;
    this.usage.outputTokens += u.outputTokens;
    this.usage.calls += u.calls;
    db()
      .prepare('UPDATE runs SET usage_json = ?, updated_at = ? WHERE id = ?')
      .run(JSON.stringify(this.usage), Date.now(), this.runId);
  }

  checkCancelled(): void {
    if (this.cancelled) throw new Error('Run cancelled');
  }
}

/** How hard each depth setting works. */
export const DEPTH_SETTINGS = {
  quick: { toolCallsPerAgent: 4, debateRounds: 1, maxParallel: 4, readPagesPerAgent: 3, analystSet: 'core' },
  standard: { toolCallsPerAgent: 8, debateRounds: 1, maxParallel: 3, readPagesPerAgent: 5, analystSet: 'full' },
  deep: { toolCallsPerAgent: 16, debateRounds: 2, maxParallel: 3, readPagesPerAgent: 8, analystSet: 'full' },
  exhaustive: { toolCallsPerAgent: 26, debateRounds: 3, maxParallel: 2, readPagesPerAgent: 12, analystSet: 'full' },
} as const;

export type Depth = keyof typeof DEPTH_SETTINGS;
