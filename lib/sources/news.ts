import { httpGet, TTL } from '../net/http';
import { parseRss } from '../net/html';
import { search } from './web';
import type { AssetRef, NewsItem } from './types';

function googleNewsUrl(query: string, window: string): string {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(`${query} when:${window}`)}&hl=en-US&gl=US&ceid=US:en`;
}

async function googleNews(query: string, window = '14d', limit = 30): Promise<NewsItem[]> {
  const res = await httpGet(googleNewsUrl(query, window), { ttl: TTL.news, tolerateError: true });
  if (res.status !== 200) return [];
  return parseRss(res.body, limit).map((item) => ({
    title: item.title.replace(/\s+-\s+[^-]{2,40}$/, '').trim(),
    url: item.link,
    published: item.published,
    source: item.source,
    summary: item.summary,
  }));
}

function dedupe(items: NewsItem[]): NewsItem[] {
  const seen = new Set<string>();
  const out: NewsItem[] = [];
  for (const item of items) {
    const key = item.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').slice(0, 9).join(' ');
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function scoreRecency(item: NewsItem): number {
  if (!item.published) return 0;
  const ts = Date.parse(item.published);
  if (Number.isNaN(ts)) return 0;
  return ts;
}

/** Headlines for an asset, newest first, deduplicated across feeds. */
export async function getNews(asset: AssetRef, limit = 30, window = '14d'): Promise<NewsItem[]> {
  const queries =
    asset.kind === 'crypto'
      ? [`${asset.name} crypto`, `${asset.symbol} price`]
      : [`"${asset.symbol}" stock`, `${asset.name}`];

  const batches = await Promise.all(queries.map((q) => googleNews(q, window, limit).catch(() => [])));
  const merged = dedupe(batches.flat()).sort((a, b) => scoreRecency(b) - scoreRecency(a));
  return merged.slice(0, limit);
}

/** Targeted news search, e.g. "NVDA export restrictions" over the last quarter. */
export async function searchNews(query: string, window = '90d', limit = 20): Promise<NewsItem[]> {
  const [feed, web] = await Promise.all([
    googleNews(query, window, limit).catch(() => [] as NewsItem[]),
    search(`${query} news`, Math.ceil(limit / 2)).catch(() => []),
  ]);
  const fromWeb: NewsItem[] = web.map((r) => ({
    title: r.title,
    url: r.url,
    published: r.published,
    summary: r.snippet,
    source: (() => {
      try {
        return new URL(r.url).hostname.replace(/^www\./, '');
      } catch {
        return undefined;
      }
    })(),
  }));
  return dedupe([...feed, ...fromWeb]).slice(0, limit);
}

/** Macro and market-wide headlines, for regime context. */
export async function getMarketNews(limit = 20): Promise<NewsItem[]> {
  const batches = await Promise.all([
    googleNews('stock market outlook Federal Reserve inflation', '7d', limit),
    googleNews('S&P 500 rally selloff treasury yields', '7d', limit),
  ]);
  return dedupe(batches.flat()).sort((a, b) => scoreRecency(b) - scoreRecency(a)).slice(0, limit);
}
