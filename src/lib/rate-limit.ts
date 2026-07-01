type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const store = new Map<string, RateLimitEntry>();

const MAX_STORE_SIZE = 10_000;

function pruneExpired(now: number) {
  if (store.size <= MAX_STORE_SIZE) return;
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
    if (store.size <= MAX_STORE_SIZE * 0.75) break;
  }
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { success: boolean; retryAfterMs: number } {
  const now = Date.now();
  pruneExpired(now);

  const entry = store.get(key);
  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true, retryAfterMs: 0 };
  }

  if (entry.count >= limit) {
    return { success: false, retryAfterMs: entry.resetAt - now };
  }

  entry.count += 1;
  return { success: true, retryAfterMs: 0 };
}
