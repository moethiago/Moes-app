// ============================================================
// api/ingest.js — pulls trusted RSS, writes new stories to KV.
// NO Claude calls. Cheap. Safe to run every 30 minutes.
// ============================================================

import { TRUSTED_SOURCES, CATEGORIES, assignCategory } from './lib/sources.js';
import { fetchSource, storyId } from './lib/ingest-core.js';
import { kvReady, kvPipeline, lpush, ltrim } from './lib/kv.js';

const INGEST_MAX_AGE_H = 18;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const started = Date.now();

  if (!kvReady()) return res.status(500).json({ error: 'KV not configured' });

  try {
    // 1. Pull every trusted source in parallel
    const allItems = (
      await Promise.all(TRUSTED_SOURCES.map(s => fetchSource(s, INGEST_MAX_AGE_H)))
    ).flat();

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

    // 4. Check which IDs are already in KV (single pipeline)
    const existsResults = await kvPipeline(batch.map(it => ['EXISTS', 'story:' + it.id]));
    const trulyNew = batch.filter((_, i) => existsResults[i] === 0);

    if (!trulyNew.length) {
      await logRun({ phase: 'ingest', ingested: 0, candidates: allItems.length, durationMs: Date.now() - started });
      return res.status(200).json({ ok: true, phase: 'ingest', ingested: 0, candidates: allItems.length });
    }

    // 5. Write new stories + index by category (one pipeline call)
    const now = Math.floor(Date.now() / 1000);
    const writes = [];
    for (const it of trulyNew) {
      const storyObj = {
        id: it.id,
        title: it.title,
        url: it.url,
        sourceUrl: it.sourceUrl,
        cat: it.cat,
        publishedAt: it.publishedAt,
        firstSeenAt: now,
        score: null,        // unscored
        rewritten: null,    // will be set by score worker
      };
      writes.push(['SET', 'story:' + it.id, JSON.stringify(storyObj), 'EX', String(48 * 3600)]);
      // sorted set by publishedAt for "latest" queries
      writes.push(['ZADD', 'cat:' + it.cat, String(it.publishedAt), it.id]);
      // queue for scoring
      writes.push(['SADD', 'unscored:' + it.cat, it.id]);
    }
    // Trim sorted sets to recent only (keep 50 per cat, expire score < 24h ago)
    const cutoff = now - 24 * 3600;
    for (const cat of CATEGORIES) {
      writes.push(['ZREMRANGEBYSCORE', 'cat:' + cat, '-inf', String(cutoff)]);
    }
    await kvPipeline(writes);

    const ingestedPerCat = {};
    trulyNew.forEach(it => { ingestedPerCat[it.cat] = (ingestedPerCat[it.cat] || 0) + 1; });

    await logRun({
      phase: 'ingest',
      ingested: trulyNew.length,
      candidates: allItems.length,
      perCat: ingestedPerCat,
      durationMs: Date.now() - started,
    });

    return res.status(200).json({
      ok: true,
      phase: 'ingest',
      ingested: trulyNew.length,
      candidates: allItems.length,
      perCat: ingestedPerCat,
      durationMs: Date.now() - started,
    });
  } catch (e) {
    console.error('ingest error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}

async function logRun(entry) {
  try {
    entry.ts = Math.floor(Date.now() / 1000);
    await lpush('runs', entry);
    await ltrim('runs', 0, 99);   // keep last 100
  } catch (e) {}
}
