/**
 * SvelteKit serialises server-loaded data with `devalue`, which flattens the
 * object graph into an array where integers are pointers to other slots. Sites
 * built on SvelteKit expose this at `<route>/__data.json`, which gives us clean
 * structured data instead of scraping rendered tables.
 */

const HOLE = -2;
const NAN = -3;
const POS_INF = -4;
const NEG_INF = -5;
const NEG_ZERO = -6;

export function unflatten(flat: unknown[]): unknown {
  const memo = new Map<number, unknown>();

  function hydrate(index: number): unknown {
    if (index === -1) return undefined;
    if (index === HOLE) return undefined;
    if (index === NAN) return NaN;
    if (index === POS_INF) return Infinity;
    if (index === NEG_INF) return -Infinity;
    if (index === NEG_ZERO) return -0;
    if (memo.has(index)) return memo.get(index);

    const value = flat[index];

    if (Array.isArray(value)) {
      // A leading string tag marks devalue's custom types (Date, Map, Set, ...).
      if (typeof value[0] === 'string') {
        const [tag, payload] = value as [string, number];
        switch (tag) {
          case 'Date': {
            const d = new Date(flat[payload] as string);
            memo.set(index, d);
            return d;
          }
          case 'Set': {
            const set = new Set<unknown>();
            memo.set(index, set);
            for (let i = 1; i < value.length; i++) set.add(hydrate(value[i] as number));
            return set;
          }
          case 'Map': {
            const map = new Map<unknown, unknown>();
            memo.set(index, map);
            for (let i = 1; i < value.length; i += 2) {
              map.set(hydrate(value[i] as number), hydrate(value[i + 1] as number));
            }
            return map;
          }
          case 'BigInt': {
            const b = BigInt(flat[payload] as string);
            memo.set(index, b);
            return b;
          }
          default:
            break;
        }
      }
      const arr: unknown[] = [];
      memo.set(index, arr);
      for (const slot of value) {
        arr.push(typeof slot === 'number' ? hydrate(slot) : slot);
      }
      return arr;
    }

    if (value && typeof value === 'object') {
      const obj: Record<string, unknown> = {};
      memo.set(index, obj);
      for (const [k, slot] of Object.entries(value as Record<string, unknown>)) {
        obj[k] = typeof slot === 'number' ? hydrate(slot) : slot;
      }
      return obj;
    }

    memo.set(index, value);
    return value;
  }

  return hydrate(0);
}

interface SvelteDataPayload {
  type?: string;
  nodes?: Array<{ type?: string; data?: unknown[] } | null>;
}

/**
 * Returns every hydrated data node from a `__data.json` response. Callers pick
 * the node that carries what they need, since node ordering follows the route's
 * layout hierarchy and is not stable across pages.
 */
export function parseSvelteData(raw: string): unknown[] {
  const payload = JSON.parse(raw) as SvelteDataPayload;
  const out: unknown[] = [];
  for (const node of payload.nodes ?? []) {
    if (node && node.type === 'data' && Array.isArray(node.data)) {
      try {
        out.push(unflatten(node.data));
      } catch {
        /* a malformed node should not sink the whole page */
      }
    }
  }
  return out;
}

/** Finds the first hydrated node that contains all of the given keys. */
export function pickNode<T = Record<string, unknown>>(nodes: unknown[], keys: string[]): T | null {
  for (const node of nodes) {
    if (node && typeof node === 'object' && keys.every((k) => k in (node as Record<string, unknown>))) {
      return node as T;
    }
  }
  return null;
}
