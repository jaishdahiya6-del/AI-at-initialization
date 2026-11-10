const store = new Map<string, { v: any; exp: number }>();
const inflight = new Map<string, Promise<any>>();

/** TTL cache with request de-duplication (concurrent callers share one upstream call). */
export async function cached<T>(key: string, ttlMs: number | ((v: T) => number), fn: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && hit.exp > Date.now()) return hit.v;
  const running = inflight.get(key);
  if (running) return running;
  const p = fn()
    .then((v) => {
      store.set(key, { v, exp: Date.now() + (typeof ttlMs === 'function' ? ttlMs(v) : ttlMs) });
      return v;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}
export const clearCache = () => store.clear();

export async function mapLimit<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k]); }
  }));
  return out;
}
