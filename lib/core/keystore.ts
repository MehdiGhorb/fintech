import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DATA_DIR, KEYS_PATH, ensureDataDir } from './paths';

export type Provider = 'openai' | 'anthropic' | 'openrouter';

export interface Credentials {
  provider: Provider;
  apiKey: string;
  model?: string;
  fastModel?: string;
  baseUrl?: string;
  savedAt: number;
}

const SALT_PATH = path.join(DATA_DIR, '.salt');

/**
 * The key file is encrypted with a locally generated salt so that the API key is
 * never sitting on disk as readable text. This guards against accidental leaks
 * (commits, log dumps, backups) — it is not protection against someone who
 * already has read access to the data directory.
 */
function encryptionKey(): Buffer {
  ensureDataDir();
  let salt: Buffer;
  if (fs.existsSync(SALT_PATH)) {
    salt = fs.readFileSync(SALT_PATH);
  } else {
    salt = crypto.randomBytes(32);
    fs.writeFileSync(SALT_PATH, salt, { mode: 0o600 });
  }
  const material = `${os.hostname()}:${os.userInfo().username}:northline`;
  return crypto.scryptSync(material, salt, 32);
}

export function saveCredentials(input: Omit<Credentials, 'savedAt'>): Credentials {
  ensureDataDir();
  const creds: Credentials = { ...input, savedAt: Date.now() };
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const payload = Buffer.concat([cipher.update(JSON.stringify(creds), 'utf8'), cipher.final()]);
  const envelope = {
    v: 1,
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    data: payload.toString('base64'),
  };
  fs.writeFileSync(KEYS_PATH, JSON.stringify(envelope), { mode: 0o600 });
  cached = creds;
  return creds;
}

let cached: Credentials | null = null;

export function loadCredentials(): Credentials | null {
  if (cached) return cached;

  // An env var wins so the app still works in a throwaway shell.
  const envKey = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.OPENROUTER_API_KEY;
  if (envKey) {
    const provider: Provider = process.env.ANTHROPIC_API_KEY
      ? 'anthropic'
      : process.env.OPENROUTER_API_KEY
        ? 'openrouter'
        : 'openai';
    cached = {
      provider,
      apiKey: envKey,
      model: process.env.NORTHLINE_MODEL,
      fastModel: process.env.NORTHLINE_FAST_MODEL,
      savedAt: 0,
    };
    return cached;
  }

  if (!fs.existsSync(KEYS_PATH)) return null;
  try {
    const envelope = JSON.parse(fs.readFileSync(KEYS_PATH, 'utf8'));
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      encryptionKey(),
      Buffer.from(envelope.iv, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
    const plain = Buffer.concat([
      decipher.update(Buffer.from(envelope.data, 'base64')),
      decipher.final(),
    ]).toString('utf8');
    cached = JSON.parse(plain) as Credentials;
    return cached;
  } catch {
    return null;
  }
}

export function clearCredentials(): void {
  cached = null;
  if (fs.existsSync(KEYS_PATH)) fs.rmSync(KEYS_PATH);
}

export function credentialStatus(): { configured: boolean; provider?: Provider; model?: string; keyHint?: string } {
  const creds = loadCredentials();
  if (!creds) return { configured: false };
  return {
    configured: true,
    provider: creds.provider,
    model: creds.model,
    keyHint: `${creds.apiKey.slice(0, 6)}…${creds.apiKey.slice(-4)}`,
  };
}
