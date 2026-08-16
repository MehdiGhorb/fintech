import fs from 'node:fs';
import path from 'node:path';
import type { AnalysisSpec, Depth, Dossier } from './context';

const SKILLS_DIR = path.join(process.cwd(), 'skills');

const cache = new Map<string, string>();

export function loadSkill(name: string): string {
  const hit = cache.get(name);
  if (hit) return hit;
  const file = path.join(SKILLS_DIR, name.endsWith('.md') ? name : `${name}.md`);
  const text = fs.readFileSync(file, 'utf8');
  cache.set(name, text);
  return text;
}

export function houseMethod(): string {
  return loadSkill('00-house-method');
}

export function agentSystem(skillFile: string, extra?: string): string {
  const parts = [
    houseMethod(),
    '',
    loadSkill(skillFile),
    '',
    'Cite evidence as [E12] using the refs the tools return. If a tool fails, say so and work with what you have — do not invent a substitute number.',
  ];
  if (extra) parts.push('', extra);
  return parts.join('\n');
}

export function briefing(spec: AnalysisSpec, dossier: Dossier): string {
  const a = dossier.asset;
  const q = dossier.quote;
  const p = dossier.profile;
  const stats = dossier.statistics;
  const lines: string[] = [
    `# Assignment`,
    `User request: ${spec.request}`,
    `Subject: ${a.name} (${a.symbol}) — ${a.kind}${a.exchange ? `, ${a.exchange}` : ''}${a.saPath ? ` — https://stockanalysis.com${a.saPath}` : ''}`,
    `Horizon: ${spec.horizonLabel} (${spec.horizonDays} trading days)`,
    `Objective: ${spec.objective} | Directional bias: ${spec.direction} | Risk tolerance: ${spec.riskTolerance}`,
  ];
  if (spec.focusAreas.length) lines.push(`Focus: ${spec.focusAreas.join('; ')}`);
  if (spec.notes) lines.push(`Notes from intake: ${spec.notes}`);
  if (spec.comparisons.length) {
    lines.push(`Comparisons requested: ${spec.comparisons.map((c) => `${c.symbol} (${c.name})`).join(', ')}`);
  }

  lines.push('', '# Snapshot');
  if (q) {
    lines.push(
      `Last price ${q.price}${q.changePercent != null ? ` (${q.changePercent >= 0 ? '+' : ''}${q.changePercent}% on the session)` : ''}${q.asOf ? `, as of ${q.asOf}` : ''}${q.high52 && q.low52 ? `. 52-week range ${q.low52}–${q.high52}` : ''}.`,
    );
  }
  if (p) {
    lines.push(
      `${p.name}. ${p.sector ?? 'n/a'} / ${p.industry ?? 'n/a'}. CEO ${p.ceo ?? 'n/a'}, ${p.employees?.toLocaleString() ?? 'n/a'} employees, fiscal year ${p.fiscalYear ?? 'n/a'}, CIK ${p.cik ?? 'n/a'}.`,
    );
    if (p.description) lines.push(p.description.slice(0, 900));
  }
  if (stats?.flat) {
    const pick = (...keys: string[]) =>
      keys
        .map((k) => (stats.flat[k] ? `${k}: ${stats.flat[k]}` : null))
        .filter(Boolean)
        .join(' | ');
    lines.push(
      pick(
        'Market Cap',
        'Enterprise Value',
        'PE Ratio',
        'Forward PE',
        'PS Ratio',
        'Gross Margin',
        'Operating Margin',
        'Profit Margin',
        'Return on Capital (ROIC)',
        'Revenue Growth (YoY)',
        'Debt / Equity',
        'Earnings Date',
      ),
    );
  }

  if (dossier.financials.length) {
    lines.push('', '# Annual financials (newest first)');
    for (const stmt of dossier.financials.slice(0, 4)) {
      lines.push(`## ${stmt.statement} — ${stmt.periods.slice(0, 5).join(' | ')}`);
      for (const row of stmt.rows.slice(0, 8)) {
        lines.push(`  ${row.label}: ${row.values.slice(0, 5).map(fmt).join(' | ')}`);
      }
    }
  }

  if (dossier.quarterlyFinancials.length) {
    const inc = dossier.quarterlyFinancials[0];
    lines.push('', `# Recent quarters — ${inc.statement}`);
    lines.push(inc.periods.slice(0, 6).join(' | '));
    for (const row of inc.rows.slice(0, 10)) {
      lines.push(`  ${row.label}: ${row.values.slice(0, 6).map(fmt).join(' | ')}`);
    }
  }

  if (dossier.analysts) {
    const v = dossier.analysts;
    lines.push(
      '',
      `# Sell-side`,
      `Consensus ${v.consensus ?? 'n/a'}. Targets: low ${v.targetLow ?? 'n/a'}, median ${v.targetMedian ?? 'n/a'}, avg ${v.targetAverage ?? 'n/a'}, high ${v.targetHigh ?? 'n/a'} (n=${v.targetCount ?? '?'}, ${v.targetUpdated ?? ''}).`,
    );
    if (v.recentActions[0]) {
      const a0 = v.recentActions[0];
      lines.push(
        `Latest action: ${a0.date} ${a0.firm} ${a0.action} ${a0.ratingNew}, PT ${a0.targetNew ?? 'n/a'}.`,
      );
    }
  }

  if (dossier.news.length) {
    lines.push('', '# Recent headlines');
    for (const n of dossier.news.slice(0, 12)) {
      lines.push(`- ${n.title}${n.source ? ` (${n.source}` : ''}${n.published ? `, ${n.published}` : ''}${n.source ? ')' : ''} ${n.url}`);
    }
  }

  if (dossier.filings.length) {
    lines.push('', '# Recent filings');
    for (const f of dossier.filings.slice(0, 8)) {
      lines.push(`- ${f.form} ${f.filedAt} ${f.url}`);
    }
  }

  if (dossier.crypto) {
    const c = dossier.crypto;
    lines.push(
      '',
      '# Token',
      `${c.name} rank ${c.marketCapRank ?? 'n/a'}, mcap ${c.marketCap ?? 'n/a'}, FDV ${c.fullyDilutedValuation ?? 'n/a'}, ATH ${c.ath ?? 'n/a'} (${c.athChangePercent?.toFixed(1) ?? 'n/a'}%).`,
      (c.description || '').slice(0, 800),
    );
  }

  if (dossier.quantText) {
    lines.push('', '# Quantitative engine (computed, not estimated)');
    lines.push(dossier.quantText);
  }

  lines.push(
    '',
    'The snapshot above is a starting pack, not a complete file. Use tools to read filings, verify numbers, pull peers, and open the pages that actually matter for your section. Do not restate the snapshot — add what it does not contain.',
  );

  return lines.join('\n');
}

function fmt(v: number | null): string {
  if (v === null || v === undefined) return 'n/a';
  const abs = Math.abs(v);
  if (abs >= 1e12) return `${(v / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  return String(v);
}

export function reportsBlock(
  reports: Array<{ agent?: string; name?: string; title?: string; role?: string; content: string }>,
  label = 'Desk memos so far',
): string {
  if (!reports.length) return '';
  return (
    `# ${label}\n\n` +
    reports
      .map((r) => `## ${r.title ?? r.role ?? r.name} (${r.agent ?? r.name})\n\n${r.content}`)
      .join('\n\n---\n\n')
  );
}

export function depthHint(depth: Depth): string {
  switch (depth) {
    case 'quick':
      return 'This is a quick pass. Prioritise the two or three things that decide the outcome. Still cite. Do not skip the disconfirming case.';
    case 'standard':
      return 'Standard depth. Cover your full deliverable. Go to primary sources for any number the call will rest on.';
    case 'deep':
      return 'Deep pass. Read the actual filing items, not summaries. Open multiple independent sources. Run more than one valuation scenario. Hunt for what the snapshot omitted.';
    case 'exhaustive':
      return 'Exhaustive. Leave no major filing item, competitor, or catalyst unread. If a document might change the conclusion, read it. Use the full tool budget.';
  }
}
