import { NextResponse } from 'next/server';

// Generates a simple sitemap.xml including static routes and dynamic market pages
export async function GET() {
  const baseUrl = 'https://northline-finance.com';

  // Static routes to include
  const staticRoutes = ['/', '/markets', '/screener', '/calendar', '/news', '/chat'];

  // Try to fetch markets from the internal API route
  let marketUrls: string[] = [];
  try {
    const res = await fetch(`${baseUrl}/api/markets`);
    if (res.ok) {
      const markets = await res.json();
      marketUrls = markets
        .filter((m: any) => m && m.symbol)
        .map((m: any) => `/markets/${encodeURIComponent(m.symbol.toLowerCase())}`);
    }
  } catch (e) {
    // fallback: no dynamic market urls
    console.warn('Could not fetch markets for sitemap:', e);
  }

  const urls = [...staticRoutes, ...marketUrls];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((path) => `  <url>\n    <loc>${baseUrl}${path}</loc>\n  </url>`).join('\n') +
    `\n</urlset>`;

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
