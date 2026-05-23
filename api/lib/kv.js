// ============================================================
// kv.js — thin wrapper around Upstash Redis REST API
// Works with both Vercel KV and direct Upstash env vars
// ============================================================

const URL =
  process.env.KV_REST_API_URL ||
  process.env.UPSTASH_REDIS_REST_URL;

const TOKEN =
  process.env.KV_REST_API_TOKEN ||
  process.env.UPSTASH_REDIS_REST_TOKEN;

export function kvReady() {
  return !!URL && !!TOKEN;
}

async function call(command) {
  if (!URL || !TOKEN) throw new Error('KV not configured');
  const res = await fetch(URL, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + TOKEN,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  });
  if (!res.ok) throw new Error('KV error ' + res.status + ': ' + await res.text());
  const data = await res.json();
  return data.result;
}

// ----- key/value -----
export async function kvGet(key) {
  const raw = await call(['GET', key]);
  if (raw == null) return null;
  try { return JSON.parse(raw); } catch { return raw; }
}

export async function kvSet(key, value, ttlSeconds) {
  const v = typeof value === 'string' ? value : JSON.stringify(value);
  if (ttlSeconds) return call(['SET', key, v, 'EX', String(ttlSeconds)]);
  return call(['SET', key, v]);
}

export async function kvDel(key) {
  return call(['DEL', key]);
}

export async function kvExists(key) {
  return (await call(['EXISTS', key])) === 1;
}

// ----- pipeline (batches multiple commands in one round-trip) -----
export async function kvPipeline(commands) {
  if (!URL || !TOKEN) throw new Error('KV not configured');
  if (!commands.length) return [];
  const res = await fetch(URL + '/pipeline', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + TOKEN,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commands),
  });
  if (!res.ok) throw new Error('KV pipeline error ' + res.status + ': ' + await res.text());
  const data = await res.json();
  return data.map(r => r.result);
}

// ----- sorted set helpers (for time-indexed category lists) -----
export async function zadd(key, score, member) {
  return call(['ZADD', key, String(score), member]);
}

export async function zrevrange(key, start, stop) {
  return call(['ZRANGE', key, String(start), String(stop), 'REV']);
}

export async function zrem(key, member) {
  return call(['ZREM', key, member]);
}

export async function zcard(key) {
  return call(['ZCARD', key]);
}

// remove sorted set members with score below given threshold (for retention)
export async function zremrangebyscore(key, min, max) {
  return call(['ZREMRANGEBYSCORE', key, String(min), String(max)]);
}

// ----- list helpers (for run log) -----
export async function lpush(key, value) {
  const v = typeof value === 'string' ? value : JSON.stringify(value);
  return call(['LPUSH', key, v]);
}

export async function ltrim(key, start, stop) {
  return call(['LTRIM', key, String(start), String(stop)]);
}

export async function lrange(key, start, stop) {
  const items = await call(['LRANGE', key, String(start), String(stop)]);
  return (items || []).map(s => { try { return JSON.parse(s); } catch { return s; } });
}
