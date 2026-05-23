// ============================================================
// api/ingest.js — pulls trusted RSS, writes new stories to KV
// NO Claude calls. Safe to run every 30 minutes.
// ============================================================

import { TRUSTED_SOURCES, CATEGORIES, assignCategory } from './lib/sources.js';
import { fetchSource, storyId } from './lib/ingest-core.js';
import { kvReady, kvGet, kvSet } from './lib/kv.js';

const INGEST_MAX_AGE_H = 18;
const STORY_TTL        = 48 * 3600; // 48h TTL on each story

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const started = Date.now();

  if (!kvReady()) return res.status(500).json({ error: 'KV not configured' });

  try {
    // 1. Pull every trusted source in parallel
    const allItems = (
      await Promise.all(TRUSTED_SOURCES.map(s => fetchSource(s, INGEST_MAX_AGE_H)))
    ).flat();

    if (!allItems.length) {
      return res.status(200).json({ ok: true, phase: 'ingest', ingested: 0, candidates: 0 });
    }

    // 2. Re-categorise (e.g. bundesliga story about Bayern -> BAYERN)
    const categorised = allItems
      .map(it => {
        const cat = assignCategory(it.title, it.sourceCat);
        return cat ? { ...it, cat } : null;
      })
      .filter(Boolean);

    // 3. Dedup within this batch by storyId
    const seen = new Map();
    for (const it of categorised) {
      const id = storyId(it.title);
      if (!seen.has(id)) seen.set(id, { ...it, id });
    }
    const batch = Array.from(seen.values());

    console.log('Total candidates after dedup:', batch.length);

    // 4. Check each story individually — is it already in KV?
    const now = Math.floor(Date.now() / 1000);
    let ingested = 0;
    const ingestedPerCat = {};

    for (const it of batch) {
      const key = 'story:' + it.id;
      const existing = await kvGet(key);

      if (existing !== null) {
        // Already in KV — skip
        continue;
      }

      // New story — write it
      const storyObj = {
        id:          it.id,
        title:       it.title,
        url:         it.url,
        sourceUrl:   it.sourceUrl,
        cat:         it.cat,
        publishedAt: it.publishedAt,
        firstSeenAt: now,
        score:       null,    // unscored
        rewritten:   null,
      };

      // Write the story
      await kvSet(key, storyObj, STORY_TTL);

      // Add to category sorted set (score = publishedAt for time ordering)
      await kvCall(['ZADD', 'cat:' + it.cat, String(it.publishedAt), it.id]);

      // Add to unscored set for the score worker
      await kvCall(['SADD', 'unscored:' + it.cat, it.id]);

      ingested++;
      ingestedPerCat[it.cat] = (ingestedPerCat[it.cat] || 0) + 1;
    }

    // 5. Trim old stories from sorted sets (older than 24h)
    const cutoff = now - 24 * 3600;
    for (const cat of CATEGORIES) {
      await kvCall(['ZREMRANGEBYSCORE', 'cat:' + cat, '-inf', String(cutoff)]);
    }

    // 6. Log the run
    await logRun({
      phase:      'ingest',
      ingested,
      candidates: batch.length,
      perCat:     ingestedPerCat,
      durationMs: Date.now() - started,
    });

    return res.status(200).json({
      ok:         true,
      phase:      'ingest',
      ingested,
      candidates: batch.length,
      perCat:     ingestedPerCat,
      durationMs: Date.now() - started,
    });

  } catch (e) {
    console.error('ingest error:', e.message, e.stack);
    return res.status(500).json({ error: e.message });
  }
}

// Direct KV call (bypasses the pipeline wrapper)
async function kvCall(command) {
  const URL   = process.env.KV_REST_API_URL   || process.env.UPSTASH_REDIS_REST_URL;
  const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!URL || !TOKEN) throw new Error('KV not configured');
  const res = await fetch(URL, {
    method:  'POST',
    headers: { 'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body:    JSON.stringify(command),
  });
  if (!res.ok) throw new Error('KV error ' + res.status);
  const data = await res.json();
  return data.result;
}

async function logRun(entry) {
  try {
    const URL   = process.env.KV_REST_API_URL   || process.env.UPSTASH_REDIS_REST_URL;
    const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!URL || !TOKEN) return;
    entry.ts = Math.floor(Date.now() / 1000);
    await fetch(URL, {
      method:  'POST',
      headers: { 'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
      body:    JSON.stringify(['LPUSH', 'runs', JSON.stringify(entry)]),
    });
    await fetch(URL, {
      method:  'POST',
      headers: { 'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
      body:    JSON.stringify(['LTRIM', 'runs', '0', '99']),
    });
  } catch (e) {}
}