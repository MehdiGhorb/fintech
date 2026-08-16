import * as cheerio from 'cheerio';

const STRIP = 'script,style,noscript,svg,iframe,form,button,nav,footer,header,aside,link,meta';
const BOILERPLATE_HINTS = [
  'cookie', 'subscribe', 'newsletter', 'advertisement', 'sign up', 'sign in',
  'related articles', 'most popular', 'share this', 'follow us',
];

export interface ExtractedPage {
  title: string;
  text: string;
  links: Array<{ href: string; text: string }>;
}

/**
 * Pulls the readable body out of an HTML document. Scores candidate containers
 * by text density so we keep article bodies and drop chrome.
 */
export function extractPage(html: string, baseUrl?: string): ExtractedPage {
  const $ = cheerio.load(html);
  $(STRIP).remove();
  $('[aria-hidden="true"], [role="navigation"], [role="banner"]').remove();

  const title = ($('meta[property="og:title"]').attr('content') || $('title').first().text() || '').trim();

  let best = '';
  let bestScore = 0;
  const candidates = $('article, main, [role="main"], .article-body, .articleBody, #content, .content, .post-content, body');
  candidates.each((_, el) => {
    const node = $(el);
    const text = normaliseText(node.text());
    const markup = node.html() ?? '';
    // Prefer prose over link farms.
    const linkPenalty = (markup.match(/<a\s/gi)?.length ?? 0) * 45;
    const score = text.length - linkPenalty;
    if (score > bestScore) {
      bestScore = score;
      best = text;
    }
  });

  if (!best) best = normaliseText($('body').text());

  const links: Array<{ href: string; text: string }> = [];
  $('a[href]').each((_, el) => {
    const raw = $(el).attr('href');
    if (!raw) return;
    const text = normaliseText($(el).text()).slice(0, 160);
    if (!text) return;
    try {
      links.push({ href: baseUrl ? new URL(raw, baseUrl).toString() : raw, text });
    } catch {
      /* ignore unparseable hrefs */
    }
  });

  return { title, text: dropBoilerplateLines(best), links: links.slice(0, 200) };
}

const BLOCK_TAGS =
  'p|div|br|tr|li|h1|h2|h3|h4|h5|h6|table|thead|tbody|section|article|header|footer|blockquote|dd|dt|pre';

/**
 * Converts markup to text while preserving block boundaries as newlines.
 * Cheerio's `.text()` concatenates without separators, which destroys the line
 * structure that SEC filings need for section detection.
 */
export function htmlToText(html: string): string {
  const withBreaks = html
    .replace(/<\s*(?:script|style|head)[\s\S]*?<\/\s*(?:script|style|head)\s*>/gi, ' ')
    .replace(new RegExp(`<\\s*/?\\s*(?:${BLOCK_TAGS})(?:\\s[^>]*)?>`, 'gi'), '\n')
    .replace(/<\s*\/?\s*td(?:\s[^>]*)?>/gi, ' \t ')
    .replace(/<[^>]+>/g, '');
  return normaliseText(decodeEntities(withBreaks));
}

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–',
  mdash: '—', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', hellip: '…', reg: '®', trade: '™',
};

export function decodeEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => safeCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => safeCodePoint(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[String(name).toLowerCase()] ?? m);
}

function safeCodePoint(code: number): string {
  try {
    return String.fromCodePoint(code);
  } catch {
    return '';
  }
}

export function normaliseText(input: string): string {
  return input
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l, i, arr) => l.length > 0 || (i > 0 && arr[i - 1].length > 0))
    .join('\n')
    .trim();
}

function dropBoilerplateLines(text: string): string {
  return text
    .split('\n')
    .filter((line) => {
      if (line.length > 90) return true;
      const lower = line.toLowerCase();
      return !BOILERPLATE_HINTS.some((h) => lower.includes(h));
    })
    .join('\n');
}

/** Extracts HTML tables as row arrays, useful for filing exhibits and stat pages. */
export function extractTables(html: string, limit = 12): string[][][] {
  const $ = cheerio.load(html);
  const tables: string[][][] = [];
  $('table').each((_, el) => {
    if (tables.length >= limit) return;
    const rows: string[][] = [];
    $(el)
      .find('tr')
      .each((__, tr) => {
        const cells: string[] = [];
        $(tr)
          .find('th,td')
          .each((___, td) => {
            cells.push(normaliseText($(td).text()));
          });
        if (cells.some((c) => c.length)) rows.push(cells);
      });
    if (rows.length > 1) tables.push(rows);
  });
  return tables;
}

export interface RssItem {
  title: string;
  link: string;
  published?: string;
  source?: string;
  summary?: string;
}

export function parseRss(xml: string, limit = 40): RssItem[] {
  const $ = cheerio.load(xml, { xmlMode: true });
  const items: RssItem[] = [];
  $('item').each((_, el) => {
    if (items.length >= limit) return;
    const node = $(el);
    const title = normaliseText(node.find('title').first().text());
    let link = node.find('link').first().text().trim();
    if (!link) link = node.find('guid').first().text().trim();
    if (!title) return;
    items.push({
      title,
      link,
      published: node.find('pubDate').first().text().trim() || undefined,
      source: normaliseText(node.find('source').first().text()) || undefined,
      summary: normaliseText(
        cheerio.load(node.find('description').first().text() || '', { xmlMode: false })('body').text(),
      ).slice(0, 400) || undefined,
    });
  });
  return items;
}

/** Trims text to a token-ish budget, keeping the head and tail which carry the most signal. */
export function clampText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const head = Math.floor(maxChars * 0.7);
  const tail = maxChars - head - 40;
  return `${text.slice(0, head)}\n\n[… ${text.length - maxChars} characters omitted …]\n\n${text.slice(-tail)}`;
}
