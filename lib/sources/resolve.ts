import { searchListings } from './stockanalysis';
import { searchCoins } from './crypto';
import type { AssetRef } from './types';

const CRYPTO_HINTS = /\b(crypto|coin|token|blockchain|satoshi)\b/i;
const CRYPTO_TICKERS = new Set([
  'BTC', 'ETH', 'SOL', 'XRP', 'ADA', 'DOGE', 'AVAX', 'DOT', 'MATIC', 'LINK', 'LTC',
  'BCH', 'XLM', 'ATOM', 'NEAR', 'APT', 'ARB', 'OP', 'SUI', 'TON', 'TRX', 'SHIB',
  'UNI', 'AAVE', 'INJ', 'SEI', 'TIA', 'PEPE', 'RNDR', 'FIL', 'HBAR', 'ICP', 'ETC',
]);

function cleanQuery(raw: string): string {
  return raw
    .replace(/[$"']/g, '')
    .replace(/\b(stock|shares?|equity|ticker|the)\b/gi, ' ')
    .replace(/-USD$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Maps a free-text asset reference ("nvidia", "NVDA", "bitcoin", "SPY") to a
 * concrete listing. Prefers exact ticker matches, and treats known crypto
 * tickers as crypto even though some are also equity ticker collisions.
 */
export async function resolveAsset(query: string): Promise<AssetRef | null> {
  const cleaned = cleanQuery(query);
  if (!cleaned) return null;
  const upper = cleaned.toUpperCase();
  const cryptoLikely = CRYPTO_TICKERS.has(upper) || CRYPTO_HINTS.test(query) || /-USD$/i.test(query);

  const [listings, coins] = await Promise.all([
    searchListings(cleaned).catch(() => [] as AssetRef[]),
    searchCoins(cleaned).catch(() => [] as AssetRef[]),
  ]);

  const exactListing = listings.find((l) => l.symbol.toUpperCase() === upper);
  const exactCoin = coins.find((c) => c.symbol.toUpperCase() === upper || c.name.toUpperCase() === upper);

  if (cryptoLikely && (exactCoin || coins[0])) return exactCoin ?? coins[0];
  if (exactListing) return exactListing;
  if (exactCoin) return exactCoin;

  // Fall back to whichever name match looks closest.
  const nameMatch = listings.find((l) => l.name.toUpperCase().startsWith(upper));
  return nameMatch ?? listings[0] ?? coins[0] ?? null;
}

export async function resolveMany(queries: string[]): Promise<AssetRef[]> {
  const out: AssetRef[] = [];
  for (const q of queries) {
    const asset = await resolveAsset(q);
    if (asset && !out.some((a) => a.symbol === asset.symbol && a.kind === asset.kind)) out.push(asset);
  }
  return out;
}
