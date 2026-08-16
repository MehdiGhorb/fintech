import { NextResponse } from 'next/server';
import { z } from 'zod';
import { clearCredentials, credentialStatus, saveCredentials, type Provider } from '@/lib/core/keystore';
import { suggestedModels, verifyKey } from '@/lib/llm/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const status = credentialStatus();
  const suggested = status.provider ? suggestedModels(status.provider) : suggestedModels('openai');
  return NextResponse.json({ ...status, suggested });
}

const Body = z.object({
  provider: z.enum(['openai', 'anthropic', 'openrouter']),
  apiKey: z.string().min(8),
  model: z.string().optional(),
  fastModel: z.string().optional(),
  baseUrl: z.string().url().optional(),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Provide a provider and an API key.' }, { status: 400 });
  }
  const { provider, apiKey, model, fastModel, baseUrl } = parsed.data;
  const check = await verifyKey(provider as Provider, apiKey, baseUrl);
  if (!check.ok) {
    return NextResponse.json({ error: check.error || 'Key was rejected by the provider.' }, { status: 400 });
  }
  saveCredentials({
    provider: provider as Provider,
    apiKey,
    model: model || suggestedModels(provider as Provider).deep,
    fastModel: fastModel || suggestedModels(provider as Provider).fast,
    baseUrl,
  });
  return NextResponse.json({
    ok: true,
    ...credentialStatus(),
    models: (check.models ?? []).slice(0, 80),
    suggested: suggestedModels(provider as Provider),
  });
}

export async function DELETE() {
  clearCredentials();
  return NextResponse.json({ ok: true, configured: false });
}
