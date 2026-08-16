import { TTL, tryJson } from '../net/http';
import type { AssetRef, Bar } from './types';

const CG = 'https://api.coingecko.com/api/v3';

export async function searchCoins(query: string): Promise<AssetRef[]> {
  const data = await tryJson<{ coins?: Array<{ id: string; symbol: string; name: string; market_cap_rank?: number }> }>(
    `${CG}/search?query=${encodeURIComponent(query)}`,
    { ttl: TTL.search },
  );
  if (!data?.coins) return [];
  return data.coins
    .filter((c) => c.market_cap_rank === undefined || c.market_cap_rank === null || c.market_cap_rank < 600)
    .slice(0, 10)
    .map((c) => ({
      kind: 'crypto' as const,
      symbol: c.symbol.toUpperCase(),
      name: c.name,
      coingeckoId: c.id,
      currency: 'USD',
    }));
}

export interface CryptoMarket {
  id: string;
  symbol: string;
  name: string;
  description: string;
  categories: string[];
  price: number;
  marketCap?: number;
  fullyDilutedValuation?: number;
  volume24h?: number;
  circulatingSupply?: number;
  totalSupply?: number;
  maxSupply?: number;
  ath?: number;
  athChangePercent?: number;
  athDate?: string;
  change24h?: number;
  change7d?: number;
  change30d?: number;
  change1y?: number;
  marketCapRank?: number;
  /** GitHub activity — a rough proxy for whether the project is alive. */
  developer?: Record<string, unknown>;
  community?: Record<string, unknown>;
  links?: Record<string, unknown>;
  genesisDate?: string;
  hashingAlgorithm?: string;
  tickers?: Array<{ market: string; volume: number; trustScore?: string }>;
}

export async function getCryptoMarket(asset: AssetRef): Promise<CryptoMarket | null> {
  if (!asset.coingeckoId) return null;
  const data = await tryJson<any>(
    `${CG}/coins/${asset.coingeckoId}?localization=false&tickers=true&market_data=true&community_data=true&developer_data=true&sparkline=false`,
    { ttl: TTL.quote },
  );
  if (!data?.market_data) return null;
  const md = data.market_data;
  return {
    id: data.id,
    symbol: (data.symbol ?? '').toUpperCase(),
    name: data.name,
    description: String(data.description?.en ?? '')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 4000),
    categories: (data.categories ?? []).filter(Boolean),
    price: md.current_price?.usd,
    marketCap: md.market_cap?.usd,
    fullyDilutedValuation: md.fully_diluted_valuation?.usd,
    volume24h: md.total_volume?.usd,
    circulatingSupply: md.circulating_supply,
    totalSupply: md.total_supply,
    maxSupply: md.max_supply,
    ath: md.ath?.usd,
    athChangePercent: md.ath_change_percentage?.usd,
    athDate: md.ath_date?.usd,
    change24h: md.price_change_percentage_24h,
    change7d: md.price_change_percentage_7d,
    change30d: md.price_change_percentage_30d,
    change1y: md.price_change_percentage_1y,
    marketCapRank: data.market_cap_rank,
    developer: data.developer_data,
    community: data.community_data,
    links: {
      homepage: (data.links?.homepage ?? []).filter(Boolean),
      whitepaper: data.links?.whitepaper,
      repos: data.links?.repos_url?.github ?? [],
      twitter: data.links?.twitter_screen_name,
      subreddit: data.links?.subreddit_url,
    },
    genesisDate: data.genesis_date,
    hashingAlgorithm: data.hashing_algorithm,
    tickers: (data.tickers ?? []).slice(0, 12).map((t: any) => ({
      market: t.market?.name,
      volume: t.converted_volume?.usd,
      trustScore: t.trust_score,
    })),
  };
}

export async function getCryptoHistory(asset: AssetRef, days = 730): Promise<Bar[]> {
  if (!asset.coingeckoId) return [];
  const data = await tryJson<{
    prices?: Array<[number, number]>;
    total_volumes?: Array<[number, number]>;
  }>(`${CG}/coins/${asset.coingeckoId}/market_chart?vs_currency=usd&days=${days}&interval=daily`, {
    ttl: TTL.prices,
  });
  if (!data?.prices?.length) return [];

  const volumes = new Map((data.total_volumes ?? []).map(([t, v]) => [new Date(t).toISOString().slice(0, 10), v]));
  // CoinGecko's free daily series is close-only, so we synthesise a bar from
  // consecutive closes. Range-based estimators are skipped downstream for crypto.
  const bars: Bar[] = [];
  let prev: number | null = null;
  for (const [ts, close] of data.prices) {
    const date = new Date(ts).toISOString().slice(0, 10);
    if (bars.length && bars[bars.length - 1].date === date) continue;
    const open = prev ?? close;
    bars.push({
      date,
      open,
      high: Math.max(open, close),
      low: Math.min(open, close),
      close,
      adjClose: close,
      volume: volumes.get(date) ?? 0,
    });
    prev = close;
  }
  return bars;
}

/** Broad crypto market context: total cap, BTC dominance, and majors. */
export async function getCryptoContext(): Promise<Record<string, unknown> | null> {
  const global = await tryJson<any>(`${CG}/global`, { ttl: TTL.macro });
  const majors = await tryJson<any[]>(
    `${CG}/coins/markets?vs_currency=usd&ids=bitcoin,ethereum,solana&price_change_percentage=24h,7d,30d`,
    { ttl: TTL.macro },
  );
  if (!global?.data) return null;
  return {
    totalMarketCapUsd: global.data.total_market_cap?.usd,
    totalVolumeUsd: global.data.total_volume?.usd,
    btcDominance: global.data.market_cap_percentage?.btc,
    ethDominance: global.data.market_cap_percentage?.eth,
    marketCapChange24h: global.data.market_cap_change_percentage_24h_usd,
    majors: (majors ?? []).map((m) => ({
      symbol: (m.symbol ?? '').toUpperCase(),
      price: m.current_price,
      change24h: m.price_change_percentage_24h_in_currency,
      change7d: m.price_change_percentage_7d_in_currency,
      change30d: m.price_change_percentage_30d_in_currency,
    })),
  };
}
