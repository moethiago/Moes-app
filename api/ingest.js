// ============================================================
// api/ingest.js — pulls trusted RSS, writes new stories to KV
// NO Claude calls. Safe to run every 30 minutes.
// ============================================================

import { TRUSTED_SOURCES, TWITTER_ACCOUNTS, CATEGORIES, assignCategory } from './lib/sources.js';
import { fetchSource, storyId } from './lib/ingest-core.js';
import { kvReady, kvGet, kvSet } from './lib/kv.js';
import { embedText } from './lib/embed-core.js';
import { fetchTwitterAccounts } from './lib/twitter-core.js';

// Allow up to 60s (Vercel default is 10s). Ingest does many network calls.
export const config = { maxDuration: 60 };


const INGEST_MAX_AGE_H = 18;
const STORY_TTL        = 48 * 3600; // 48h TTL on each story

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const started = Date.now();

  if (!kvReady()) return res.status(500).json({ error: 'KV not configured' });

  try {
    // 1. Pull every trusted RSS source in parallel
    const rssItems = (
      await Promise.all(TRUSTED_SOURCES.map(s => fetchSource(s, INGEST_MAX_AGE_H)))
    ).flat();

    // 1b. Pull curated breaking-news Twitter/X accounts (TwitterAPI.io).
    //     No-ops cleanly if TWITTERAPI_IO_KEY isn't set.
    let twitterItems = [];
    try {
      twitterItems = await fetchTwitterAccounts(
        TWITTER_ACCOUNTS, process.env.TWITTERAPI_IO_KEY, INGEST_MAX_AGE_H
      );
    } catch (e) { /* twitter optional */ }

    const allItems = rssItems.concat(twitterItems);

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

    // 4. Batch-check existence in PARALLEL (was sequential — caused timeouts)
    const now = Math.floor(Date.now() / 1000);
    let ingested = 0;
    let requeued = 0;
    const ingestedPerCat = {};

    const existResults = await Promise.all(
      batch.map(it => kvCall(['GET', 'story:' + it.id]).catch(() => null))
    );

    const newOnes = [];
    const requeueOps = [];
    for (let i = 0; i < batch.length; i++) {
      const it = batch[i];
      const existing = existResults[i];
      if (existing !== null && existing !== undefined) {
        // exists — re-queue if it's still unscored so it can't get orphaned
        try {
          const obj = typeof existing === 'string' ? JSON.parse(existing) : existing;
          if (obj && (obj.score === null || obj.score === undefined)) {
            requeueOps.push(['ZADD', 'cat:' + obj.cat, String(obj.publishedAt || it.publishedAt), obj.id]);
            requeueOps.push(['SADD', 'unscored:' + obj.cat, obj.id]);
            requeued++;
          }
        } catch (e) {}
        continue;
      }
      newOnes.push(it);
    }

    // Hobby-tier functions are killed at ~10s. Embedding is the slow part,
    // so cap how many NEW stories we process per run; the rest are caught
    // on the next cron cycle (every 30 min). Freshest first.
    const MAX_NEW_PER_RUN = 25;
    newOnes.sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0));
    const deferred = Math.max(0, newOnes.length - MAX_NEW_PER_RUN);
    const toProcess = newOnes.slice(0, MAX_NEW_PER_RUN);

    // Embed all NEW stories in PARALLEL (the slow part — was one-by-one)
    const embeddings = await Promise.all(
      toProcess.map(it =>
        embedText(it.title, process.env.GEMINI_API_KEY).catch(() => null)
      )
    );

    // Build all writes, then fire them together
    const writeOps = [...requeueOps];
    const setPromises = [];
    for (let i = 0; i < toProcess.length; i++) {
      const it = toProcess[i];
      const storyObj = {
        id: it.id, title: it.title, url: it.url, sourceUrl: it.sourceUrl,
        cat: it.cat, publishedAt: it.publishedAt, firstSeenAt: now,
        score: null, rewritten: null, embedding: embeddings[i],
      };
      setPromises.push(kvSet('story:' + it.id, storyObj, STORY_TTL));
      writeOps.push(['ZADD', 'cat:' + it.cat, String(it.publishedAt), it.id]);
      writeOps.push(['SADD', 'unscored:' + it.cat, it.id]);
      ingested++;
      ingestedPerCat[it.cat] = (ingestedPerCat[it.cat] || 0) + 1;
    }
    await Promise.all(setPromises);
    // fire index + queue ops in parallel batches
    await Promise.all(writeOps.map(op => kvCall(op).catch(() => null)));

    // 5. Trim old stories from sorted sets (older than 48h, matching story TTL)
    const cutoff = now - 48 * 3600;
    for (const cat of CATEGORIES) {
      await kvCall(['ZREMRANGEBYSCORE', 'cat:' + cat, '-inf', String(cutoff)]);
    }

    // 6. Log the run
    await logRun({
      phase:      'ingest',
      ingested,
      requeued,
      deferred,
      candidates: batch.length,
      perCat:     ingestedPerCat,
      durationMs: Date.now() - started,
    });

    return res.status(200).json({
      ok:         true,
      phase:      'ingest',
      ingested,
      requeued,
      deferred,
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