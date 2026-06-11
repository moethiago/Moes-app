// ============================================================
// cache.js — KV-backed cache wrapper for external API calls
// Use this to wrap ANY upstream API call.
// ============================================================

const URL =
  process.env.KV_REST_API_URL ||
  process.env.UPSTASH_REDIS_REST_URL;

const TOKEN =
  process.env.KV_REST_API_TOKEN ||
  process.env.UPSTASH_REDIS_REST_TOKEN;

// ---- raw KV ops (duplicated here so this file is self-contained) ----
async function kvGetRaw(key) {
  if (!URL || !TOKEN) return null;
  try {
    const res = await fetch(URL + '/get/' + encodeURIComponent(key), {
      headers: { 'Authorization': 'Bearer ' + TOKEN }
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.result;
  } catch { return null; }
}

async function kvSetRaw(key, value, ttlSeconds) {
  if (!URL || !TOKEN) return;
  try {
    await fetch(URL, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify(['SET', key, value, 'EX', String(ttlSeconds)])
    });
  } catch {}
}

/**
 * Wrap an async upstream fetcher with KV caching.
 *
 * @param {string}   cacheKey   - unique key, e.g. "cache:football:epl"
 * @param {number}   ttlSeconds - how long to cache (30 = live scores, 3600 = standings)
 * @param {function} fetcher    - async () => data ; called on cache miss
 * @returns {Promise<{data, fromCache, ageSeconds}>}
 */
export async function cached(cacheKey, ttlSeconds, fetcher) {
  // 1. Try cache
  const raw = await kvGetRaw(cacheKey);
  if (raw) {
    try {
      const obj = JSON.parse(raw);
      const age = Math.floor(Date.now() / 1000) - (obj._cachedAt || 0);
      return { data: obj.data, fromCache: true, ageSeconds: age };
    } catch {}
  }

  // 2. Cache miss → call upstream
  const data = await fetcher();

  // 3. Store in cache (best-effort, don't fail the request if KV write fails)
  if (data !== null && data !== undefined) {
    kvSetRaw(cacheKey, JSON.stringify({
      _cachedAt: Math.floor(Date.now() / 1000),
      data
    }), ttlSeconds).catch(() => {});
  }

  return { data, fromCache: false, ageSeconds: 0 };
}

/**
 * Manually invalidate a cache key (e.g. when a session ends).
 */
export async function invalidate(cacheKey) {
  if (!URL || !TOKEN) return;
  try {
    await fetch(URL, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify(['DEL', cacheKey])
    });
  } catch {}
}

// Standard TTLs (seconds) by data type — use these so we stay consistent
export const TTL = {
  LIVE_SCORES:      30,     // live football matches
  UPCOMING_MATCHES: 600,    // 10 min for upcoming fixtures
  STANDINGS:        3600,   // 1 hour for league tables
  F1_LIVE:          5,      // active F1 session
  F1_RESULTS:       86400,  // session is over, results never change
  F1_CALENDAR:      86400,  // 24 hours
  F1_STANDINGS:     3600,   // 1 hour
  WORLD_CUP:        21600,  // 6 hours
};
