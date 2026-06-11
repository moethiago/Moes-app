// ============================================================
// api/admin-clear.js — one-time maintenance endpoint.
// Wipes all story:* keys and the cat:* indexes so the next ingest
// repopulates everything FRESH (with embeddings + Twitter sources).
// Protected by DEPLOY_SECRET. Visit:
//   /api/admin-clear?secret=YOUR_SECRET
// Optional: &dry=1 to preview counts without deleting.
// ============================================================

import { CATEGORIES } from './_lib/sources.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const secret = req.query.secret;
  if (!secret || secret !== process.env.DEPLOY_SECRET) {
    return res.status(403).json({ error: 'Forbidden — bad or missing secret' });
  }

  const URL   = process.env.KV_REST_API_URL   || process.env.UPSTASH_REDIS_REST_URL;
  const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!URL || !TOKEN) return res.status(500).json({ error: 'KV not configured' });

  const dry = req.query.dry === '1';

  async function kvCall(cmd) {
    const r = await fetch(URL, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify(cmd),
    });
    const j = await r.json();
    return j.result;
  }

  try {
    // 1. SCAN for all story:* keys (cursor-based, batches of 200)
    let cursor = '0';
    const storyKeys = [];
    let guard = 0;
    do {
      const out = await kvCall(['SCAN', cursor, 'MATCH', 'story:*', 'COUNT', '200']);
      // Upstash returns [nextCursor, [keys...]]
      cursor = out && out[0] ? out[0] : '0';
      const batch = (out && out[1]) || [];
      for (const k of batch) storyKeys.push(k);
      guard++;
    } while (cursor !== '0' && guard < 100);

    const catKeys = (CATEGORIES || []).map(c => 'cat:' + c);
    const unscoredKeys = (CATEGORIES || []).map(c => 'unscored:' + c);

    if (dry) {
      return res.status(200).json({
        ok: true, dryRun: true,
        wouldDelete: { stories: storyKeys.length, catIndexes: catKeys.length, unscoredSets: unscoredKeys.length },
      });
    }

    // 2. Delete in chunks (DEL accepts multiple keys)
    let deleted = 0;
    for (let i = 0; i < storyKeys.length; i += 100) {
      const chunk = storyKeys.slice(i, i + 100);
      if (chunk.length) { await kvCall(['DEL', ...chunk]); deleted += chunk.length; }
    }
    // 3. Clear category indexes AND the unscored queues (critical: otherwise
    //    stale unscored IDs block fresh stories via dedup, and only some
    //    categories re-populate).
    for (const ck of catKeys) await kvCall(['DEL', ck]);
    for (const uk of unscoredKeys) await kvCall(['DEL', uk]);

    return res.status(200).json({
      ok: true,
      cleared: { stories: deleted, catIndexes: catKeys.length, unscoredSets: unscoredKeys.length },
      next: 'Run /api/ingest now, then /api/score, to repopulate fresh.',
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}