import { complete, modelFor, parseJsonLoose } from '../llm/client';
import type { Message, ToolSchema } from '../llm/types';
import { clampText } from '../net/html';
import { RunContext } from './context';
import type { ToolDefinition } from './tools';

export interface AgentSpec {
  name: string;
  /** Short label shown in the UI. */
  role: string;
  systemPrompt: string;
  task: string;
  tools?: Record<string, ToolDefinition>;
  /** Tool names this agent may use; omit to allow all. */
  allowedTools?: string[];
  maxToolCalls?: number;
  temperature?: number;
  maxTokens?: number;
  tier?: 'deep' | 'fast';
  /** Ask for structured output instead of prose. */
  jsonSchema?: { name: string; schema: Record<string, unknown> };
  section?: string;
}

export interface AgentResult {
  name: string;
  role: string;
  content: string;
  json?: unknown;
  toolCallsMade: number;
  citations: string[];
}

const MAX_TOOL_RESULT_CHARS = 30_000;

/**
 * Runs one agent to completion: a tool-use loop bounded by a call budget,
 * followed by a final written answer.
 */
export async function runAgent(ctx: RunContext, spec: AgentSpec): Promise<AgentResult> {
  ctx.checkCancelled();
  const budget = spec.maxToolCalls ?? 8;
  const toolMap = spec.tools ?? {};
  const usableNames = spec.allowedTools?.length
    ? spec.allowedTools.filter((n) => toolMap[n])
    : Object.keys(toolMap);
  const schemas: ToolSchema[] = usableNames.map((n) => toolMap[n].schema);

  ctx.emit({ type: 'agent-start', agent: spec.name, message: spec.role });

  const messages: Message[] = [
    { role: 'system', content: spec.systemPrompt },
    { role: 'user', content: spec.task },
  ];

  let toolCallsMade = 0;
  let finalText = '';
  const model = modelFor(spec.tier ?? 'deep');

  for (let turn = 0; turn < budget + 3; turn++) {
    ctx.checkCancelled();
    const remaining = budget - toolCallsMade;
    const canUseTools = schemas.length > 0 && remaining > 0;

    // On the last pass, drop the tools so the model is forced to answer.
    const response = await complete({
      messages,
      tools: canUseTools ? schemas : undefined,
      model,
      temperature: spec.temperature,
      maxTokens: spec.maxTokens ?? 6000,
      jsonSchema: canUseTools ? undefined : spec.jsonSchema,
    });
    ctx.addUsage(response.usage);

    if (response.text?.trim()) {
      finalText = response.text.trim();
    }

    if (!response.toolCalls.length) break;

    if (response.text?.trim()) {
      ctx.emit({
        type: 'agent-thought',
        agent: spec.name,
        message: clampText(response.text.trim(), 700),
      });
    }

    messages.push({ role: 'assistant', content: response.text ?? '', toolCalls: response.toolCalls });

    for (const call of response.toolCalls) {
      ctx.checkCancelled();
      const tool = toolMap[call.name];
      if (!tool) {
        messages.push({
          role: 'tool',
          toolCallId: call.id,
          content: `Unknown tool "${call.name}". Available: ${usableNames.join(', ')}.`,
        });
        continue;
      }
      if (toolCallsMade >= budget) {
        messages.push({
          role: 'tool',
          toolCallId: call.id,
          content: 'Tool budget exhausted. Write your final analysis now using what you already have.',
        });
        continue;
      }

      toolCallsMade++;
      const summary = summariseArgs(call.args);
      ctx.emit({
        type: 'tool-call',
        agent: spec.name,
        message: `${call.name}(${summary})`,
        data: { tool: call.name, args: call.args, index: toolCallsMade, budget },
      });

      let output: string;
      try {
        output = await tool.run(call.args);
      } catch (err) {
        output = `Tool error: ${err instanceof Error ? err.message : String(err)}. Try a different approach or another source.`;
        ctx.emit({ type: 'warning', agent: spec.name, message: `${call.name} failed: ${output.slice(0, 200)}` });
      }

      ctx.emit({
        type: 'tool-result',
        agent: spec.name,
        message: `${call.name} → ${output.length.toLocaleString()} chars`,
        data: { tool: call.name, preview: clampText(output, 400) },
      });

      messages.push({ role: 'tool', toolCallId: call.id, content: clampText(output, MAX_TOOL_RESULT_CHARS) });
    }

    // Keep the transcript from growing without bound on long tool loops.
    trimTranscript(messages);
  }

  if (!finalText) {
    finalText = '(The agent produced no written output.)';
    ctx.emit({ type: 'warning', agent: spec.name, message: 'Agent returned no content.' });
  }

  const json = spec.jsonSchema ? parseJsonLoose<unknown>(finalText) : undefined;
  const citations = [...new Set(finalText.match(/\bE\d+\b/g) ?? [])];

  ctx.emit({
    type: 'agent-finish',
    agent: spec.name,
    message: `${spec.role} complete — ${toolCallsMade} tool calls, ${citations.length} citations`,
    data: { toolCallsMade, citations },
  });

  if (spec.section) {
    ctx.saveReport(spec.section, spec.name, spec.role, finalText, json ?? undefined);
  }

  return { name: spec.name, role: spec.role, content: finalText, json, toolCallsMade, citations };
}

function summariseArgs(args: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(args)) {
    let s: string;
    if (typeof v === 'string') s = v.length > 70 ? `${v.slice(0, 70)}…` : v;
    else if (Array.isArray(v)) s = `[${v.slice(0, 5).join(', ')}${v.length > 5 ? ', …' : ''}]`;
    else if (v && typeof v === 'object') s = '{…}';
    else s = String(v);
    parts.push(`${k}: ${s}`);
  }
  return parts.join(', ').slice(0, 200);
}

/**
 * Drops the middle of long tool outputs once the transcript grows large, keeping
 * the system prompt, the task, and the most recent exchanges intact.
 */
function trimTranscript(messages: Message[], maxChars = 340_000): void {
  const total = messages.reduce((a, m) => a + m.content.length, 0);
  if (total <= maxChars) return;

  let excess = total - maxChars;
  // Walk oldest-first, skipping the system prompt and initial task.
  for (let i = 2; i < messages.length - 6 && excess > 0; i++) {
    const m = messages[i];
    if (m.role !== 'tool' || m.content.length < 2000) continue;
    const target = Math.max(800, m.content.length - excess);
    const trimmed = clampText(m.content, target);
    excess -= m.content.length - trimmed.length;
    m.content = trimmed;
  }
}

/** Runs agents with bounded concurrency, tolerating individual failures. */
export async function runAgentsInParallel(
  ctx: RunContext,
  specs: AgentSpec[],
  maxParallel: number,
): Promise<AgentResult[]> {
  const results: AgentResult[] = [];
  const queue = [...specs];

  const worker = async () => {
    while (queue.length) {
      ctx.checkCancelled();
      const spec = queue.shift();
      if (!spec) break;
      try {
        results.push(await runAgent(ctx, spec));
      } catch (err) {
        if (err instanceof Error && err.message === 'Run cancelled') throw err;
        const message = err instanceof Error ? err.message : String(err);
        ctx.emit({ type: 'error', agent: spec.name, message: `${spec.role} failed: ${message}` });
        results.push({
          name: spec.name,
          role: spec.role,
          content: `(This analyst failed to complete: ${message})`,
          toolCallsMade: 0,
          citations: [],
        });
      }
    }
  };

  await Promise.all(Array.from({ length: Math.max(1, Math.min(maxParallel, specs.length)) }, worker));
  // Preserve the requested ordering for a stable report layout.
  return specs.map((s) => results.find((r) => r.name === s.name)!).filter(Boolean);
}
