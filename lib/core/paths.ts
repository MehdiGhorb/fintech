import fs from 'node:fs';
import path from 'node:path';

export const DATA_DIR = process.env.NORTHLINE_DATA_DIR
  ? path.resolve(process.env.NORTHLINE_DATA_DIR)
  : path.join(process.cwd(), '.northline');

export const DB_PATH = path.join(DATA_DIR, 'northline.db');
export const KEYS_PATH = path.join(DATA_DIR, 'credentials.json');

export function ensureDataDir(): string {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
  return DATA_DIR;
}
