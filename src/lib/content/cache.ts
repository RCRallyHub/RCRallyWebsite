// Lightweight in-memory TTL cache for the content data-access layer.
//
// Goal: content edits made in /portal should appear on the live site within
// seconds, with no git commit / no Netlify rebuild — but every page render
// shouldn't have to round-trip to Turso either. A short TTL (default 30s)
// absorbs most of a traffic burst between edits while keeping edits visible
// quickly. This intentionally stays simple (single Node process, in-memory)
// — see the plan's "Caching pass" phase for anything more elaborate.
const DEFAULT_TTL_MS = 30_000;

type Entry<T> = { value: T; expiresAt: number };
const store = new Map<string, Entry<unknown>>();

/**
 * Returns the cached value for `key` if still fresh, otherwise calls
 * `fetcher()`, caches the result for `ttlMs`, and returns it.
 */
export async function cached<T>(key: string, fetcher: () => Promise<T>, ttlMs = DEFAULT_TTL_MS): Promise<T> {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.expiresAt > now) {
    return hit.value as T;
  }
  const value = await fetcher();
  store.set(key, { value, expiresAt: now + ttlMs });
  return value;
}

/** Clears the whole cache (or just one key) — useful right after an admin write. */
export function invalidateCache(key?: string): void {
  if (key) store.delete(key);
  else store.clear();
}
