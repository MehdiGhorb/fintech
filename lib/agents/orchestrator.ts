import { complete, parseJsonLoose } from '../llm/client';
import { horizonToDays } from '../quant/forecast';
import { resolveAsset, resolveMany } from '../sources/resolve';
import type { AssetRef } from '../sources/types';
import { db, uid } from '../core/db';
import {
  DEPTH_SETTINGS,
  RunContext,
  type AnalysisSpec,
  type Depth,
  type Dossier,
} from './context';
import { buildDossier } from './dossier';
import { agentSystem, briefing, depthHint, houseMethod, reportsBlock } from './prompts';
import { runAgent, runAgentsInParallel, type AgentResult, type AgentSpec } from './runner';
import { buildTools } from './tools';

export interface StartInput {
  query: string;
  depth?: Depth;
}

const INTAKE_SCHEMA = {
  name: 'intake',
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      primaryQuery: { type: 'string', description: 'The ticker, company, ETF or token to analyse.' },
      comparisons: { type: 'array', items: { type: 'string' } },
      horizonLabel: { type: 'string', description: 'e.g. 1w, 1m, 3m, 1y' },
      objective: {
        type: 'string',
        enum: ['directional-trade', 'position-entry', 'hold-or-sell', 'research', 'comparison'],
      },
      direction: { type: 'string', enum: ['long-bias', 'short-bias', 'neutral'] },
      riskTolerance: { type: 'string', enum: ['conservative', 'moderate', 'aggressive'] },
      focusAreas: { type: 'array', items: { type: 'string' } },
      notes: { type: 'string' },
    },
    required: ['primaryQuery', 'horizonLabel', 'objective', 'direction', 'riskTolerance'],
  },
};

const VERDICT_SCHEMA = {
  name: 'verdict',
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      action: { type: 'string', enum: ['BUY', 'ADD', 'HOLD', 'REDUCE', 'SELL', 'SHORT', 'AVOID'] },
      conviction: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
      horizon: { type: 'string' },
      thesis: { type: 'string' },
      entryLow: { type: 'number' },
      entryHigh: { type: 'number' },
      stop: { type: 'number' },
      target: { type: 'number' },
      sizePercentOfCapital: { type: 'number' },
      probabilityUp: { type: 'number' },
      expectedReturnPercent: { type: 'number' },
      scenarios: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            name: { type: 'string' },
            probability: { type: 'number' },
            price: { type: 'number' },
            narrative: { type: 'string' },
          },
        },
      },
    },
    required: ['action', 'conviction', 'horizon', 'thesis'],
  },
};

interface RoleDef {
  name: string;
  role: string;
  skill: string;
  section: string;
  tools?: string[];
  tier?: 'deep' | 'fast';
  when?: (spec: AnalysisSpec, dossier: Dossier) => boolean;
  core?: boolean;
}

const ANALYSTS: RoleDef[] = [
  {
    name: 'business',
    role: 'Business & moat',
    skill: 'business-analyst',
    section: 'business',
    core: true,
    when: (_s, d) => d.asset.kind === 'stock',
    tools: [
      'get_company_profile',
      'get_financial_statement',
      'get_reported_fundamentals',
      'read_sec_filing',
      'list_sec_filings',
      'search_filings_fulltext',
      'web_search',
      'read_url',
      'wikipedia_background',
      'get_key_statistics',
    ],
  },
  {
    name: 'forensics',
    role: 'Accounting forensics',
    skill: 'forensics-analyst',
    section: 'forensics',
    when: (_s, d) => d.asset.kind === 'stock',
    tools: [
      'get_financial_statement',
      'get_reported_fundamentals',
      'get_key_statistics',
      'list_sec_filings',
      'read_sec_filing',
      'search_filings_fulltext',
      'get_insider_activity',
    ],
  },
  {
    name: 'valuation',
    role: 'Valuation',
    skill: 'valuation-analyst',
    section: 'valuation',
    core: true,
    when: (_s, d) => d.asset.kind !== 'crypto',
    tools: [
      'get_key_statistics',
      'get_analyst_estimates',
      'get_financial_statement',
      'get_reported_fundamentals',
      'compute_dcf',
      'reverse_dcf',
      'compute_multiples_and_sizing',
      'compare_peers',
      'get_quant_report',
    ],
  },
  {
    name: 'management',
    role: 'Management & capital allocation',
    skill: 'management-analyst',
    section: 'management',
    when: (_s, d) => d.asset.kind === 'stock',
    tools: [
      'get_company_profile',
      'read_sec_filing',
      'list_sec_filings',
      'get_insider_activity',
      'wikipedia_background',
      'web_search',
      'read_url',
      'get_financial_statement',
    ],
  },
  {
    name: 'competitive',
    role: 'Competition',
    skill: 'competitive-analyst',
    section: 'competitive',
    when: (_s, d) => d.asset.kind !== 'crypto',
    tools: [
      'web_search',
      'read_url',
      'compare_peers',
      'analyse_other_symbol',
      'get_company_profile',
      'search_news',
      'wikipedia_background',
      'get_key_statistics',
    ],
  },
  {
    name: 'catalyst',
    role: 'Catalysts & events',
    skill: 'catalyst-analyst',
    section: 'catalyst',
    core: true,
    tools: [
      'search_news',
      'web_search',
      'read_url',
      'list_sec_filings',
      'read_sec_filing',
      'get_analyst_estimates',
      'get_key_statistics',
    ],
  },
  {
    name: 'sentiment',
    role: 'Positioning & sentiment',
    skill: 'sentiment-analyst',
    section: 'sentiment',
    tools: [
      'search_news',
      'web_search',
      'read_url',
      'get_analyst_estimates',
      'get_insider_activity',
      'get_key_statistics',
    ],
  },
  {
    name: 'macro',
    role: 'Macro & regime',
    skill: 'macro-analyst',
    section: 'macro',
    core: true,
    tools: ['get_macro_context', 'web_search', 'search_news', 'read_url', 'analyse_other_symbol'],
  },
  {
    name: 'technical',
    role: 'Market structure',
    skill: 'technical-analyst',
    section: 'technical',
    core: true,
    tools: ['get_quant_report', 'analyse_other_symbol', 'get_macro_context', 'compute_multiples_and_sizing'],
  },
  {
    name: 'quant',
    role: 'Quantitative strategy',
    skill: 'quant-strategist',
    section: 'quant',
    core: true,
    tools: ['get_quant_report', 'compute_multiples_and_sizing', 'analyse_other_symbol', 'get_macro_context'],
  },
  {
    name: 'crypto',
    role: 'Token economics',
    skill: 'crypto-analyst',
    section: 'crypto',
    core: true,
    when: (_s, d) => d.asset.kind === 'crypto',
    tools: [
      'get_crypto_fundamentals',
      'web_search',
      'read_url',
      'search_news',
      'get_quant_report',
      'wikipedia_background',
      'analyse_other_symbol',
      'get_macro_context',
    ],
  },
];

export async function startRun(input: StartInput): Promise<{ runId: string }> {
  const depth: Depth = input.depth ?? 'standard';
  const runId = uid('run');
  const now = Date.now();
  db()
    .prepare(
      `INSERT INTO runs (id, created_at, updated_at, status, phase, progress, query, depth)
       VALUES (?, ?, ?, 'running', 'intake', 0, ?, ?)`,
    )
    .run(runId, now, now, input.query, depth);

  const ctx = new RunContext(runId, depth);
  activeRuns.set(runId, ctx);

  void execute(ctx, input.query, depth).catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    ctx.emit({ type: 'error', message });
    finish(ctx, 'error', message);
  });

  return { runId };
}

export function getActiveRun(runId: string): RunContext | null {
  return activeRuns.get(runId) ?? null;
}

export function cancelRun(runId: string): boolean {
  const ctx = activeRuns.get(runId);
  if (!ctx) return false;
  ctx.cancelled = true;
  ctx.emit({ type: 'warning', message: 'Cancellation requested.' });
  return true;
}

const activeRuns = new Map<string, RunContext>();

async function execute(ctx: RunContext, query: string, depth: Depth): Promise<void> {
  const settings = DEPTH_SETTINGS[depth];
  ctx.setPhase('intake', 'Reading the request and identifying the asset.', 4);

  const spec = await parseIntake(ctx, query);
  db()
    .prepare('UPDATE runs SET spec_json = ?, updated_at = ? WHERE id = ?')
    .run(JSON.stringify(spec), Date.now(), ctx.runId);

  ctx.setPhase('dossier', `Building the research file on ${spec.primary.symbol}.`, 10);
  const dossier = await buildDossier(ctx, spec);
  const pack = briefing(spec, dossier);
  const tools = buildTools(ctx, dossier, 'desk');
  const hint = depthHint(depth);

  const analysts = ANALYSTS.filter((r) => {
    if (r.when && !r.when(spec, dossier)) return false;
    if (settings.analystSet === 'core' && !r.core) return false;
    return true;
  });

  ctx.setPhase('analysts', `Running ${analysts.length} specialist analysts in parallel.`, 18);
  const analystSpecs: AgentSpec[] = analysts.map((r) => ({
    name: r.name,
    role: r.role,
    section: r.section,
    systemPrompt: agentSystem(r.skill),
    task: `${pack}\n\n${hint}\n\nProduce your full deliverable for ${spec.primary.symbol} over a ${spec.horizonLabel} horizon.`,
    tools,
    allowedTools: r.tools,
    maxToolCalls: settings.toolCallsPerAgent,
    tier: r.tier ?? 'deep',
  }));

  const analystResults = await runAgentsInParallel(ctx, analystSpecs, settings.maxParallel);
  const analystMemos = memos(analystResults);

  ctx.setPhase('debate', 'Bull and bear researchers arguing from the file.', 55);
  const debateTask = `${pack}\n\n${hint}\n\n${reportsBlock(analystMemos, 'Specialist memos')}\n\nWrite your case for ${spec.primary.symbol} over ${spec.horizonLabel}. Cite. Quantify.`;

  const [bull, bear] = await Promise.all([
    runAgent(ctx, {
      name: 'bull',
      role: 'Bull researcher',
      section: 'bull',
      systemPrompt: agentSystem('bull-researcher'),
      task: debateTask + '\n\nYou are the BULL. Build the strongest honest long case.',
      tools,
      allowedTools: ['web_search', 'read_url', 'get_quant_report', 'compute_dcf', 'reverse_dcf', 'get_analyst_estimates'],
      maxToolCalls: Math.max(2, Math.floor(settings.toolCallsPerAgent / 3)),
    }),
    runAgent(ctx, {
      name: 'bear',
      role: 'Bear researcher',
      section: 'bear',
      systemPrompt: agentSystem('bear-researcher'),
      task: debateTask + '\n\nYou are the BEAR. Build the strongest honest short/avoid case.',
      tools,
      allowedTools: ['web_search', 'read_url', 'get_quant_report', 'read_sec_filing', 'get_reported_fundamentals'],
      maxToolCalls: Math.max(2, Math.floor(settings.toolCallsPerAgent / 3)),
    }),
  ]);

  let extraBull = bull;
  let extraBear = bear;
  if (settings.debateRounds > 1) {
    ctx.setPhase('rebuttal', 'Second debate round — each side answers the other.', 62);
    const round2 = `${reportsBlock([bull, bear], 'Opening arguments')}\n\nRebut the other side's load-bearing claims. Concede what you must. Do not repeat your opening.`;
    extraBull = await runAgent(ctx, {
      name: 'bull-rebuttal',
      role: 'Bull rebuttal',
      section: 'bull',
      systemPrompt: agentSystem('bull-researcher'),
      task: round2,
      maxToolCalls: 0,
    });
    extraBear = await runAgent(ctx, {
      name: 'bear-rebuttal',
      role: 'Bear rebuttal',
      section: 'bear',
      systemPrompt: agentSystem('bear-researcher'),
      task: round2,
      maxToolCalls: 0,
    });
  }

  ctx.setPhase('red-team', 'Attacking the desk’s reasoning.', 70);
  const red = await runAgent(ctx, {
    name: 'red-team',
    role: 'Red team',
    section: 'red-team',
    systemPrompt: agentSystem('red-team'),
    task: `${pack}\n\n${reportsBlock([...analystMemos, extraBull, extraBear], 'Full desk output')}\n\nAudit the reasoning. Do not produce a directional view.`,
    tools,
    allowedTools: ['get_reported_fundamentals', 'get_quant_report', 'get_key_statistics'],
    maxToolCalls: Math.min(4, settings.toolCallsPerAgent),
  });

  ctx.setPhase('decision', 'Portfolio manager writing the call.', 78);
  const pm = await runAgent(ctx, {
    name: 'pm',
    role: 'Portfolio manager',
    section: 'decision',
    systemPrompt: agentSystem('portfolio-manager'),
    task: `${pack}\n\n${hint}\n\n${reportsBlock([...analystMemos, extraBull, extraBear, red], 'Desk file')}\n\nWrite the call. Then emit the structured verdict fields.`,
    jsonSchema: VERDICT_SCHEMA,
    maxTokens: 7000,
    maxToolCalls: 0,
  });

  ctx.setPhase('risk', 'Risk manager reviewing the plan.', 86);
  const risk = await runAgent(ctx, {
    name: 'risk',
    role: 'Risk manager',
    section: 'risk',
    systemPrompt: agentSystem('risk-manager'),
    task: `${pack}\n\n${reportsBlock([pm, extraBull, extraBear, red], 'Proposed call and residual debate')}\n\nImpose constraints. Use the sizing calculator if you need numbers.`,
    tools,
    allowedTools: ['get_quant_report', 'compute_multiples_and_sizing', 'get_macro_context'],
    maxToolCalls: 3,
  });

  ctx.setPhase('audit', 'Fact-checking load-bearing numbers.', 92);
  const artifacts = ctx.listArtifacts();
  const audit = await runAgent(ctx, {
    name: 'fact-check',
    role: 'Fact-checker',
    section: 'audit',
    systemPrompt: agentSystem('fact-checker'),
    task: `${reportsBlock([pm, risk], 'Decision memos')}\n\nEvidence catalogue:\n${artifacts
      .map((a) => `${a.ref} [${a.kind}] ${a.title}${a.url ? ` — ${a.url}` : ''} (${a.source})`)
      .join('\n')}\n\nAudit the memos. For any cited [E#], you may ask get_quant_report or get_key_statistics to re-read a source of truth.`,
    tools,
    allowedTools: ['get_quant_report', 'get_key_statistics', 'get_reported_fundamentals', 'get_analyst_estimates'],
    maxToolCalls: Math.min(6, settings.toolCallsPerAgent),
  });

  const verdict = (pm.json as Record<string, unknown> | undefined) ?? parseJsonLoose(pm.content);
  const compiled = compileReport(spec, dossier, [...analystResults, extraBull, extraBear, red, pm, risk, audit], verdict);

  ctx.saveReport('final', 'desk', `${spec.primary.symbol} — ${spec.horizonLabel} call`, compiled, verdict ?? undefined);
  db()
    .prepare('UPDATE runs SET verdict_json = ? WHERE id = ?')
    .run(JSON.stringify({ spec, verdict, usage: ctx.usage, symbol: spec.primary.symbol }), ctx.runId);

  remember(ctx, spec, dossier, verdict);
  finish(ctx, 'done');
}

async function parseIntake(ctx: RunContext, query: string): Promise<AnalysisSpec> {
  let parsed: {
    primaryQuery?: string;
    comparisons?: string[];
    horizonLabel?: string;
    objective?: AnalysisSpec['objective'];
    direction?: AnalysisSpec['direction'];
    riskTolerance?: AnalysisSpec['riskTolerance'];
    focusAreas?: string[];
    notes?: string;
  } | null = null;

  try {
    const response = await complete({
      messages: [
        {
          role: 'system',
          content:
            'Extract a structured research assignment from the user. If they name no horizon, default to 1m. If they name no bias, default to neutral. primaryQuery should be a ticker or a company/token name, not a sentence.',
        },
        { role: 'user', content: query },
      ],
      jsonSchema: INTAKE_SCHEMA,
      model: undefined,
      maxTokens: 800,
      temperature: 0,
    });
    ctx.addUsage(response.usage);
    parsed = parseJsonLoose(response.text);
  } catch (err) {
    ctx.emit({
      type: 'warning',
      message: `Intake model call failed (${err instanceof Error ? err.message : err}); falling back to heuristics.`,
    });
  }

  const primaryQuery = parsed?.primaryQuery?.trim() || guessSymbol(query) || query;
  const primary = await resolveAsset(primaryQuery);
  if (!primary) {
    throw new Error(`Could not resolve "${primaryQuery}" to a stock, ETF or token. Try a ticker (NVDA, SPY, BTC).`);
  }

  const comparisonQueries = parsed?.comparisons?.filter(Boolean) ?? [];
  const comparisons: AssetRef[] = comparisonQueries.length ? await resolveMany(comparisonQueries) : [];
  const horizonLabel = parsed?.horizonLabel || guessHorizon(query) || '1m';

  ctx.emit({
    type: 'agent-thought',
    agent: 'intake',
    message: `Subject ${primary.symbol} (${primary.name}), horizon ${horizonLabel}, objective ${parsed?.objective ?? 'research'}`,
  });

  return {
    request: query,
    primary,
    comparisons,
    horizonLabel,
    horizonDays: horizonToDays(horizonLabel),
    objective: parsed?.objective ?? 'research',
    direction: parsed?.direction ?? 'neutral',
    riskTolerance: parsed?.riskTolerance ?? 'moderate',
    focusAreas: parsed?.focusAreas ?? [],
    notes: parsed?.notes ?? '',
  };
}

function guessSymbol(query: string): string | null {
  const dollar = query.match(/\$([A-Z]{1,5})\b/);
  if (dollar) return dollar[1];
  const caps = query.match(/\b([A-Z]{1,5})\b/);
  return caps?.[1] ?? null;
}

function guessHorizon(query: string): string | null {
  const m = query.match(/\b(\d+\s*(?:day|days|week|weeks|month|months|year|years)|this week|next week|short term|long term)\b/i);
  if (!m) return null;
  const t = m[1].toLowerCase().replace(/\s+/g, '');
  if (t.includes('day')) return t.replace('days', 'd').replace('day', 'd');
  if (t.includes('week')) return t.includes('next') || t === 'thisweek' ? '1w' : t.replace('weeks', 'w').replace('week', 'w');
  if (t.includes('month')) return t.replace('months', 'm').replace('month', 'm');
  if (t.includes('year') || t.includes('long')) return t.replace('years', 'y').replace('year', 'y') || '1y';
  if (t.includes('short')) return '2w';
  return null;
}

function memos(results: AgentResult[]): Array<{ agent: string; title: string; content: string }> {
  return results.map((r) => ({ agent: r.name, title: r.role, content: r.content }));
}

function compileReport(
  spec: AnalysisSpec,
  dossier: Dossier,
  results: AgentResult[],
  verdict: unknown,
): string {
  const v = (verdict ?? {}) as Record<string, any>;
  const by = Object.fromEntries(results.map((r) => [r.name, r]));
  const price = dossier.quote?.price ?? dossier.quant?.spot;
  const header = [
    `# ${spec.primary.name} (${spec.primary.symbol}) — ${spec.horizonLabel} call`,
    '',
    v.action
      ? `**${v.action}** · ${v.conviction ?? ''} conviction · ${v.horizon ?? spec.horizonLabel}${price ? ` · last ${price}` : ''}`
      : `Horizon ${spec.horizonLabel}${price ? ` · last ${price}` : ''}`,
    v.thesis ? `\n${v.thesis}` : '',
  ];

  if (v.entryLow || v.stop || v.target) {
    header.push(
      '',
      `Entry ${v.entryLow ?? '—'}–${v.entryHigh ?? v.entryLow ?? '—'} · stop ${v.stop ?? '—'} · target ${v.target ?? '—'} · size ${v.sizePercentOfCapital != null ? `${v.sizePercentOfCapital}% of capital` : '—'}`,
    );
  }
  if (Array.isArray(v.scenarios) && v.scenarios.length) {
    header.push('', 'Scenarios:');
    for (const s of v.scenarios) {
      header.push(`- ${s.name} (${s.probability}%): ${s.price}${s.narrative ? ` — ${s.narrative}` : ''}`);
    }
  }

  const order = [
    'pm',
    'risk',
    'fact-check',
    'bull',
    'bull-rebuttal',
    'bear',
    'bear-rebuttal',
    'red-team',
    'business',
    'crypto',
    'forensics',
    'valuation',
    'management',
    'competitive',
    'catalyst',
    'sentiment',
    'macro',
    'technical',
    'quant',
  ];

  const body: string[] = [];
  for (const name of order) {
    const r = by[name];
    if (!r?.content) continue;
    body.push(`\n---\n\n## ${r.role}\n\n${r.content}`);
  }

  return `${header.filter(Boolean).join('\n')}\n${body.join('\n')}\n`;
}

function remember(
  ctx: RunContext,
  spec: AnalysisSpec,
  dossier: Dossier,
  verdict: unknown,
): void {
  try {
    const v = (verdict ?? {}) as Record<string, any>;
    db()
      .prepare(
        `INSERT INTO memory (id, run_id, symbol, created_at, horizon, horizon_end, entry_price, verdict_json, thesis)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        uid('mem'),
        ctx.runId,
        spec.primary.symbol,
        Date.now(),
        spec.horizonLabel,
        null,
        dossier.quote?.price ?? dossier.quant?.spot ?? null,
        JSON.stringify(v),
        typeof v.thesis === 'string' ? v.thesis : null,
      );
  } catch {
    /* memory is best-effort */
  }
}

function finish(ctx: RunContext, status: 'done' | 'error', error?: string): void {
  db()
    .prepare(
      `UPDATE runs SET status = ?, finished_at = ?, updated_at = ?, progress = ?, error = ?, usage_json = ?, phase = ? WHERE id = ?`,
    )
    .run(
      status,
      Date.now(),
      Date.now(),
      status === 'done' ? 1 : ctx.phase === 'starting' ? 0 : 0.99,
      error ?? null,
      JSON.stringify(ctx.usage),
      status === 'done' ? 'done' : 'error',
      ctx.runId,
    );
  ctx.emit({
    type: 'done',
    message: status === 'done' ? 'Analysis complete.' : error,
    data: { status, usage: ctx.usage },
  });
  activeRuns.delete(ctx.runId);
}

export async function followUp(runId: string, message: string): Promise<string> {
  const row = db()
    .prepare('SELECT query, depth, spec_json, status FROM runs WHERE id = ?')
    .get(runId) as { query: string; depth: Depth; spec_json: string | null; status: string } | undefined;
  if (!row) throw new Error('Unknown run');
  if (row.status === 'running') throw new Error('The analysis is still running.');

  const spec = row.spec_json ? (JSON.parse(row.spec_json) as AnalysisSpec) : null;
  const reports = db()
    .prepare('SELECT agent, title, content FROM reports WHERE run_id = ? ORDER BY rowid')
    .all(runId) as Array<{ agent: string; title: string; content: string }>;
  const history = db()
    .prepare('SELECT role, content FROM messages WHERE run_id = ? ORDER BY created_at')
    .all(runId) as Array<{ role: string; content: string }>;

  db()
    .prepare('INSERT INTO messages (id, run_id, role, content, created_at) VALUES (?,?,?,?,?)')
    .run(uid('msg'), runId, 'user', message, Date.now());

  const ctx = new RunContext(runId, row.depth);
  // Follow-ups reuse the run's evidence store but should not look like a new analysis phase.
  const dossier: Dossier = spec
    ? {
        asset: spec.primary,
        quote: null,
        bars: [],
        quant: null,
        quantText: '',
        profile: null,
        statistics: null,
        financials: [],
        quarterlyFinancials: [],
        ttmMetrics: null,
        analysts: null,
        news: [],
        macro: null,
        crypto: null,
        secFacts: null,
        filings: [],
        insiders: [],
        peers: [],
        syntheticBars: spec.primary.kind === 'crypto',
      }
    : ({} as Dossier);

  const tools = spec ? buildTools(ctx, dossier, 'followup') : {};
  const transcript = history
    .map((m) => `${m.role === 'user' ? 'User' : 'Desk'}: ${m.content}`)
    .join('\n\n');

  const result = await runAgent(ctx, {
    name: 'followup',
    role: 'Follow-up',
    systemPrompt: `${houseMethod()}

You are answering a follow-up on a completed research file. Use the memos. If you need a fresh number or a page, use a tool. Do not pretend the original call has changed unless the new evidence actually changes it — if it does, say so explicitly.`,
    task: `Original request: ${row.query}\n\n${reportsBlock(reports, 'Completed file')}\n\n${transcript ? `Prior follow-up:\n${transcript}\n\n` : ''}User: ${message}`,
    tools,
    maxToolCalls: 6,
  });

  db()
    .prepare('INSERT INTO messages (id, run_id, role, content, created_at) VALUES (?,?,?,?,?)')
    .run(uid('msg'), runId, 'assistant', result.content, Date.now());

  return result.content;
}
