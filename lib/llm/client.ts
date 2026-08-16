import { loadCredentials, type Credentials, type Provider } from '../core/keystore';
import type { CompletionRequest, CompletionResponse, Message, ToolCall, ToolSchema } from './types';

const DEFAULTS: Record<Provider, { base: string; deep: string; fast: string }> = {
  openai: { base: 'https://api.openai.com/v1', deep: 'gpt-5.1', fast: 'gpt-5.1-mini' },
  anthropic: {
    base: 'https://api.anthropic.com/v1',
    deep: 'claude-sonnet-4-5-20250929',
    fast: 'claude-haiku-4-5-20251001',
  },
  openrouter: { base: 'https://openrouter.ai/api/v1', deep: 'openai/gpt-5.1', fast: 'openai/gpt-5.1-mini' },
};

export class LlmError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly retryable = false,
  ) {
    super(message);
  }
}

function creds(): Credentials {
  const c = loadCredentials();
  if (!c) throw new LlmError('No API key configured. Add one in the app before running an analysis.');
  return c;
}

export function modelFor(tier: 'deep' | 'fast'): string {
  const c = creds();
  const d = DEFAULTS[c.provider];
  if (tier === 'fast') return c.fastModel || c.model || d.fast;
  return c.model || d.deep;
}

function baseUrl(c: Credentials): string {
  return (c.baseUrl || DEFAULTS[c.provider].base).replace(/\/$/, '');
}

async function post(path: string, body: unknown, signal?: AbortSignal): Promise<any> {
  const c = creds();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (c.provider === 'anthropic') {
    headers['x-api-key'] = c.apiKey;
    headers['anthropic-version'] = '2023-06-01';
  } else {
    headers.Authorization = `Bearer ${c.apiKey}`;
  }

  const response = await fetch(`${baseUrl(c)}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal,
  });

  const text = await response.text();
  if (!response.ok) {
    const retryable = response.status === 429 || response.status >= 500;
    throw new LlmError(`${response.status}: ${text.slice(0, 600)}`, response.status, retryable);
  }
  return JSON.parse(text);
}

/** Params that newer reasoning models reject; dropped and retried on 400. */
const PICKY_PARAMS = ['temperature', 'top_p', 'max_tokens', 'parallel_tool_calls'];

function toOpenAiMessages(messages: Message[]): unknown[] {
  return messages.map((m) => {
    if (m.role === 'tool') {
      return { role: 'tool', tool_call_id: m.toolCallId, content: m.content };
    }
    if (m.role === 'assistant' && m.toolCalls?.length) {
      return {
        role: 'assistant',
        content: m.content || null,
        tool_calls: m.toolCalls.map((t) => ({
          id: t.id,
          type: 'function',
          function: { name: t.name, arguments: JSON.stringify(t.args) },
        })),
      };
    }
    return { role: m.role, content: m.content };
  });
}

function toOpenAiTools(tools?: ToolSchema[]): unknown[] | undefined {
  if (!tools?.length) return undefined;
  return tools.map((t) => ({
    type: 'function',
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));
}

async function completeOpenAiStyle(req: CompletionRequest): Promise<CompletionResponse> {
  const model = req.model || modelFor('deep');
  const payload: Record<string, unknown> = {
    model,
    messages: toOpenAiMessages(req.messages),
    max_completion_tokens: req.maxTokens ?? 8000,
  };
  if (req.temperature !== undefined) payload.temperature = req.temperature;
  const tools = toOpenAiTools(req.tools);
  if (tools) payload.tools = tools;
  if (req.jsonSchema) {
    payload.response_format = {
      type: 'json_schema',
      json_schema: { name: req.jsonSchema.name, schema: req.jsonSchema.schema, strict: false },
    };
  }

  let data: any;
  try {
    data = await post('/chat/completions', payload, req.signal);
  } catch (err) {
    if (!(err instanceof LlmError) || err.status !== 400) throw err;
    // Older deployments want max_tokens; newer ones reject temperature. Try the other shape.
    const retry = { ...payload };
    if (/max_completion_tokens/.test(err.message)) {
      retry.max_tokens = retry.max_completion_tokens;
      delete retry.max_completion_tokens;
    }
    for (const p of PICKY_PARAMS) {
      if (err.message.includes(p)) delete retry[p];
    }
    if (/response_format|json_schema/.test(err.message)) delete retry.response_format;
    data = await post('/chat/completions', retry, req.signal);
  }

  const choice = data.choices?.[0];
  const rawCalls = choice?.message?.tool_calls ?? [];
  const toolCalls: ToolCall[] = rawCalls
    .filter((c: any) => c?.function?.name)
    .map((c: any) => ({
      id: c.id ?? `call_${Math.random().toString(36).slice(2)}`,
      name: c.function.name,
      args: safeJson(c.function.arguments),
    }));

  return {
    text: choice?.message?.content ?? '',
    toolCalls,
    stopReason: choice?.finish_reason,
    model,
    usage: {
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
      calls: 1,
    },
  };
}

async function completeAnthropic(req: CompletionRequest): Promise<CompletionResponse> {
  const model = req.model || modelFor('deep');
  const system = req.messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n\n');

  const blocks: unknown[] = [];
  for (const m of req.messages) {
    if (m.role === 'system') continue;
    if (m.role === 'tool') {
      blocks.push({
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: m.toolCallId, content: m.content }],
      });
      continue;
    }
    if (m.role === 'assistant' && m.toolCalls?.length) {
      const content: unknown[] = [];
      if (m.content) content.push({ type: 'text', text: m.content });
      for (const t of m.toolCalls) content.push({ type: 'tool_use', id: t.id, name: t.name, input: t.args });
      blocks.push({ role: 'assistant', content });
      continue;
    }
    blocks.push({ role: m.role, content: [{ type: 'text', text: m.content }] });
  }

  const payload: Record<string, unknown> = {
    model,
    system: system || undefined,
    messages: mergeAdjacent(blocks as Array<{ role: string; content: unknown[] }>),
    max_tokens: req.maxTokens ?? 8000,
  };
  if (req.temperature !== undefined) payload.temperature = req.temperature;
  if (req.tools?.length) {
    payload.tools = req.tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters,
    }));
  }
  if (req.jsonSchema && !req.tools?.length) {
    // Anthropic has no JSON-schema response mode, so force it through a single tool.
    payload.tools = [
      { name: 'emit', description: 'Return the structured result.', input_schema: req.jsonSchema.schema },
    ];
    payload.tool_choice = { type: 'tool', name: 'emit' };
  }

  const data = await post('/messages', payload, req.signal);
  let text = '';
  const toolCalls: ToolCall[] = [];
  for (const block of data.content ?? []) {
    if (block.type === 'text') text += block.text;
    if (block.type === 'tool_use') {
      if (req.jsonSchema && block.name === 'emit' && !req.tools?.length) {
        text = JSON.stringify(block.input);
      } else {
        toolCalls.push({ id: block.id, name: block.name, args: block.input ?? {} });
      }
    }
  }

  return {
    text,
    toolCalls,
    stopReason: data.stop_reason,
    model,
    usage: {
      inputTokens: data.usage?.input_tokens ?? 0,
      outputTokens: data.usage?.output_tokens ?? 0,
      calls: 1,
    },
  };
}

/** Anthropic rejects consecutive messages with the same role. */
function mergeAdjacent(blocks: Array<{ role: string; content: unknown[] }>) {
  const out: Array<{ role: string; content: unknown[] }> = [];
  for (const b of blocks) {
    const prev = out[out.length - 1];
    if (prev && prev.role === b.role) prev.content.push(...b.content);
    else out.push({ role: b.role, content: [...b.content] });
  }
  return out;
}

function safeJson(input: unknown): Record<string, unknown> {
  if (typeof input !== 'string') return (input as Record<string, unknown>) ?? {};
  try {
    return JSON.parse(input || '{}');
  } catch {
    return {};
  }
}

export async function complete(req: CompletionRequest): Promise<CompletionResponse> {
  const provider = creds().provider;
  const attempt = () =>
    provider === 'anthropic' ? completeAnthropic(req) : completeOpenAiStyle(req);

  let lastErr: unknown;
  for (let i = 0; i < 4; i++) {
    try {
      return await attempt();
    } catch (err) {
      lastErr = err;
      const retryable = err instanceof LlmError && err.retryable;
      if (!retryable || i === 3) throw err;
      await new Promise((r) => setTimeout(r, 1500 * 2 ** i + Math.random() * 500));
    }
  }
  throw lastErr;
}

/** Extracts a JSON object from a model response that may be fenced or prose-wrapped. */
export function parseJsonLoose<T>(text: string): T | null {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidates = [fenced?.[1], trimmed].filter(Boolean) as string[];
  for (const c of candidates) {
    try {
      return JSON.parse(c) as T;
    } catch {
      const start = c.search(/[[{]/);
      const end = Math.max(c.lastIndexOf('}'), c.lastIndexOf(']'));
      if (start >= 0 && end > start) {
        try {
          return JSON.parse(c.slice(start, end + 1)) as T;
        } catch {
          /* fall through to next candidate */
        }
      }
    }
  }
  return null;
}

export async function verifyKey(
  provider: Provider,
  apiKey: string,
  baseUrlOverride?: string,
): Promise<{ ok: boolean; models?: string[]; error?: string }> {
  const base = (baseUrlOverride || DEFAULTS[provider].base).replace(/\/$/, '');
  try {
    if (provider === 'anthropic') {
      const res = await fetch(`${base}/models?limit=60`, {
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      });
      if (!res.ok) return { ok: false, error: `${res.status}: ${(await res.text()).slice(0, 300)}` };
      const data = await res.json();
      return { ok: true, models: (data.data ?? []).map((m: any) => m.id) };
    }
    const res = await fetch(`${base}/models`, { headers: { Authorization: `Bearer ${apiKey}` } });
    if (!res.ok) return { ok: false, error: `${res.status}: ${(await res.text()).slice(0, 300)}` };
    const data = await res.json();
    return { ok: true, models: (data.data ?? []).map((m: any) => m.id).sort() };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Could not reach the provider' };
  }
}

export function suggestedModels(provider: Provider): { deep: string; fast: string } {
  return { deep: DEFAULTS[provider].deep, fast: DEFAULTS[provider].fast };
}
