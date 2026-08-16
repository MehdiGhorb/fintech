import * as cheerio from 'cheerio';
import { httpGet, TTL } from '../net/http';
import { clampText, extractPage, normaliseText, parseRss } from '../net/html';

export interface SearchResult {
  title: string;
  url: string;
  snippet?: string;
  published?: string;
}

const NOISE_HOSTS = [
  'pinterest.', 'facebook.com', 'instagram.com', 'tiktok.com', 'quora.com',
  'youtube.com', 'youtu.be',
];

function usable(url: string): boolean {
  return /^https?:\/\//.test(url) && !NOISE_HOSTS.some((h) => url.includes(h));
}

/** Brave serves real organic results as server-rendered HTML with no key. */
async function braveSearch(query: string, limit: number): Promise<SearchResult[]> {
  const res = await httpGet(`https://search.brave.com/search?q=${encodeURIComponent(query)}&source=web`, {
    ttl: TTL.search,
    tolerateError: true,
    timeoutMs: 25_000,
  });
  if (res.status !== 200 || !res.body) return [];

  const $ = cheerio.load(res.body);
  const out: SearchResult[] = [];
  const seen = new Set<string>();

  $('div.snippet[data-pos]').each((_, el) => {
    if (out.length >= limit) return;
    const node = $(el);
    const anchor = node.find('a[href^="http"]').first();
    const href = anchor.attr('href');
    if (!href || !usable(href) || seen.has(href)) return;

    // Anchor text bundles site name and breadcrumb, so prefer the title element
    // and fall back to the trailing breadcrumb segment.
    const title =
      normaliseText(node.find('.title').first().text()) ||
      normaliseText(anchor.text()).split(' › ').pop()?.trim() ||
      '';
    if (title.length < 8) return;

    seen.add(href);
    out.push({
      title: title.slice(0, 220),
      url: href,
      snippet:
        normaliseText(node.find('.snippet-description').first().text()).slice(0, 500) || undefined,
    });
  });
  return out;
}

/** Fallback: Bing's keyless RSS output. Lower quality but usually available. */
async function bingSearch(query: string, limit: number): Promise<SearchResult[]> {
  const res = await httpGet(
    `https://www.bing.com/search?q=${encodeURIComponent(query)}&format=rss&mkt=en-US&setlang=en&count=${Math.min(limit * 2, 30)}`,
    { ttl: TTL.search, tolerateError: true },
  );
  if (res.status !== 200) return [];
  return parseRss(res.body, limit * 2)
    .filter((item) => usable(item.link))
    .slice(0, limit)
    .map((item) => ({ title: item.title, url: item.link, snippet: item.summary, published: item.published }));
}

/** General web search across keyless engines, Brave first. */
export async function search(query: string, limit = 8): Promise<SearchResult[]> {
  const brave = await braveSearch(query, limit).catch(() => [] as SearchResult[]);
  if (brave.length >= Math.min(3, limit)) return brave;

  const bing = await bingSearch(query, limit).catch(() => [] as SearchResult[]);
  const merged = [...brave];
  for (const r of bing) {
    if (!merged.some((m) => m.url === r.url)) merged.push(r);
  }
  return merged.slice(0, limit);
}

export interface ReadResult {
  url: string;
  title: string;
  text: string;
  status: number;
}

/** Fetches a page and reduces it to readable text. */
export async function readPage(url: string, maxChars = 30_000): Promise<ReadResult> {
  const res = await httpGet(url, { ttl: TTL.page, tolerateError: true, timeoutMs: 30_000 });
  if (res.status !== 200 || !res.body) {
    return { url, title: '', text: '', status: res.status };
  }
  // Some feeds hand us XML or plain text rather than a document.
  if (/^\s*[[{]/.test(res.body)) {
    return { url, title: '', text: clampText(res.body, maxChars), status: res.status };
  }
  const page = extractPage(res.body, url);
  return { url, title: page.title, text: clampText(page.text, maxChars), status: res.status };
}

/** Reads several pages concurrently, tolerating individual failures. */
export async function readPages(urls: string[], maxChars = 18_000, concurrency = 4): Promise<ReadResult[]> {
  const out: ReadResult[] = [];
  const queue = [...urls];
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length) {
      const url = queue.shift();
      if (!url) break;
      try {
        out.push(await readPage(url, maxChars));
      } catch {
        out.push({ url, title: '', text: '', status: 0 });
      }
    }
  });
  await Promise.all(workers);
  return out;
}

/** Wikipedia summary — cheap, reliable background on companies and people. */
export async function wikiSummary(topic: string): Promise<{ title: string; extract: string; url: string } | null> {
  const res = await httpGet(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topic.replace(/\s+/g, '_'))}`,
    { ttl: 604_800, tolerateError: true },
  );
  if (res.status !== 200) return null;
  try {
    const data = JSON.parse(res.body);
    if (!data.extract) return null;
    return {
      title: data.title,
      extract: data.extract,
      url: data.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${topic}`,
    };
  } catch {
    return null;
  }
}

/** Full Wikipedia article text, for deeper background on a company or executive. */
export async function wikiArticle(topic: string, maxChars = 20_000): Promise<string> {
  const res = await httpGet(
    `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&format=json&redirects=1&titles=${encodeURIComponent(
      topic,
    )}`,
    { ttl: 604_800, tolerateError: true },
  );
  if (res.status !== 200) return '';
  try {
    const pages = JSON.parse(res.body)?.query?.pages ?? {};
    const first = Object.values(pages)[0] as { extract?: string } | undefined;
    return clampText(first?.extract ?? '', maxChars);
  } catch {
    return '';
  }
}
