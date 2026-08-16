import crypto from 'node:crypto';
import { db } from '../core/db';

const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

// The SEC's fair-access policy requires a User-Agent that identifies the caller.
const SEC_UA = process.env.SEC_USER_AGENT || 'Northline Finance research/1.0 (personal research tool)';

/** Minimum milliseconds between requests to the same host. */
const HOST_INTERVAL: Record<string, number> = {
  'data.sec.gov': 130,
  'www.sec.gov': 130,
  'efts.sec.gov': 200,
  'stockanalysis.com': 220,
  'api.coingecko.com': 2600,
  'query1.finance.yahoo.com': 900,
  'query2.finance.yahoo.com': 900,
  'news.google.com': 500,
  'www.bing.com': 800,
  default: 350,
};

const lastHit = new Map<string, number>();
const hostQueue = new Map<string, Promise<void>>();

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

/** Serialises requests per host and spaces them out, so we stay a polite client. */
async function throttle(host: string): Promise<void> {
  const interval = HOST_INTERVAL[host] ?? HOST_INTERVAL.default;
  const prior = hostQueue.get(host) ?? Promise.resolve();
  let release: () => void = () => {};
  const gate = new Promise<void>((r) => (release = r));
  hostQueue.set(
    host,
    prior.then(() => gate),
  );
  await prior;
  const wait = interval - (Date.now() - (lastHit.get(host) ?? 0));
  if (wait > 0) await sleep(wait);
  lastHit.set(host, Date.now());
  // Let the next caller for this host proceed once our spacing is satisfied.
  setTimeout(release, 0);
}

export interface FetchOptions {
  /** Cache time-to-live in seconds. 0 disables caching. */
  ttl?: number;
  headers?: Record<string, string>;
  timeoutMs?: number;
  retries?: number;
  method?: string;
  body?: string;
  /** Treat non-2xx as a value rather than throwing. */
  tolerateError?: boolean;
}

export interface FetchResult {
  url: string;
  status: number;
  body: string;
  fromCache: boolean;
}

function cacheKey(url: string, method: string, body?: string): string {
  return crypto.createHash('sha1').update(`${method} ${url} ${body ?? ''}`).digest('hex');
}

function readCache(key: string): FetchResult | null {
  const row = db()
    .prepare('SELECT url, status, body, expires_at FROM http_cache WHERE key = ?')
    .get(key) as { url: string; status: number; body: string; expires_at: number } | undefined;
  if (!row) return null;
  if (row.expires_at < Date.now()) return null;
  return { url: row.url, status: row.status, body: row.body, fromCache: true };
}

function writeCache(key: string, res: FetchResult, ttl: number): void {
  db()
    .prepare(
      `INSERT INTO http_cache (key, url, status, body, fetched_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET status=excluded.status, body=excluded.body,
         fetched_at=excluded.fetched_at, expires_at=excluded.expires_at`,
    )
    .run(key, res.url, res.status, res.body, Date.now(), Date.now() + ttl * 1000);
}

function defaultHeaders(url: string): Record<string, string> {
  const host = new URL(url).host;
  const isSec = host.endsWith('sec.gov');
  return {
    'User-Agent': isSec ? SEC_UA : BROWSER_UA,
    Accept: 'text/html,application/xhtml+xml,application/xml,application/json;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    ...(isSec ? {} : { Referer: `https://${host}/` }),
  };
}

export async function httpGet(url: string, opts: FetchOptions = {}): Promise<FetchResult> {
  const method = opts.method ?? 'GET';
  const ttl = opts.ttl ?? 900;
  const key = cacheKey(url, method, opts.body);

  if (ttl > 0) {
    const hit = readCache(key);
    if (hit) return hit;
  }

  const retries = opts.retries ?? 3;
  const host = new URL(url).host;
  let lastErr: unknown = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    await throttle(host);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 25_000);
    try {
      const response = await fetch(url, {
        method,
        headers: { ...defaultHeaders(url), ...(opts.headers ?? {}) },
        body: opts.body,
        signal: controller.signal,
        redirect: 'follow',
      });
      const body = await response.text();
      const result: FetchResult = { url, status: response.status, body, fromCache: false };

      if (response.ok) {
        if (ttl > 0) writeCache(key, result, ttl);
        return result;
      }
      // 404 and other client errors won't fix themselves on retry.
      if (response.status === 429 || response.status >= 500) {
        lastErr = new Error(`HTTP ${response.status} for ${url}`);
        await sleep(Math.min(12_000, 900 * 2 ** attempt) + Math.random() * 400);
        continue;
      }
      if (opts.tolerateError) return result;
      throw new Error(`HTTP ${response.status} for ${url}`);
    } catch (err) {
      lastErr = err;
      if (attempt < retries) await sleep(Math.min(8_000, 700 * 2 ** attempt) + Math.random() * 300);
    } finally {
      clearTimeout(timer);
    }
  }

  if (opts.tolerateError) {
    return { url, status: 0, body: '', fromCache: false };
  }
  throw lastErr instanceof Error ? lastErr : new Error(`Failed to fetch ${url}`);
}

export async function httpJson<T = unknown>(url: string, opts: FetchOptions = {}): Promise<T> {
  const res = await httpGet(url, { ...opts, headers: { Accept: 'application/json', ...(opts.headers ?? {}) } });
  return JSON.parse(res.body) as T;
}

export async function tryJson<T = unknown>(url: string, opts: FetchOptions = {}): Promise<T | null> {
  try {
    return await httpJson<T>(url, opts);
  } catch {
    return null;
  }
}

export const TTL = {
  quote: 120,
  prices: 1800,
  fundamentals: 21_600,
  filings: 21_600,
  filingText: 604_800,
  news: 900,
  search: 3600,
  page: 86_400,
  macro: 3600,
} as const;
