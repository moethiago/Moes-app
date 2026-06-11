// ============================================================
// api/feed.js — returns JSON of top approved stories per category
// Frontend calls this on page load
// ============================================================

import { CATEGORIES, TRUSTED_SOURCES } from './_lib/sources.js';
import { kvReady, kvPipeline, zrevrange } from './_lib/kv.js';
import { rankFeed } from './_lib/rank-core.js';
import { clusterByEmbedding } from './_lib/embed-core.js';


export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');

  if (!kvReady()) return res.status(500).json({ error: 'KV not configured' });

  try {
    // For each category, get the top 20 most recent IDs from the sorted set,
    // then fetch the story objects, then filter to those with score >= 7
    const perCat = {};

    // Fetch all category IDs in parallel.
    // Read up to 200 per category (was 20 — which silently bumped still-fresh
    // stories out of view within hours once newer ones arrived). The 48h TTL +
    // trim are the only things that should remove a story, not a display cap.
    const idsPerCat = await Promise.all(
      CATEGORIES.map(c => zrevrange('cat:' + c, 0, 199))
    );

    // Build a flat list of GET commands for one pipeline
    const allIds = [];
    const catOfId = {};
    idsPerCat.forEach((ids, i) => {
      const cat = CATEGORIES[i];
      (ids || []).forEach(id => {
        allIds.push(id);
        catOfId[id] = cat;
      });
    });

    if (!allIds.length) {
      return res.status(200).json({ ok: true, stories: [], perCat: {} });
    }

    const jsonResults = await kvPipeline(allIds.map(id => ['GET', 'story:' + id]));
    const stories = jsonResults
      .map(j => { try { return JSON.parse(j); } catch { return null; } })
      .filter(s => {
        if (!s || !s.score) return false;
        return s.score >= 5;  // same bar for all; rewrite gave each a fair shot
      });

    const weightByUrl = {};
    for (const src of TRUSTED_SOURCES) weightByUrl[src.url] = src.weight || 5;
    const sourceWeightOf = s => weightByUrl[s.sourceUrl] || 5;

    // Per category: dedup (kill repeats) but keep EVERYTHING approved,
    // ordered NEWEST-FIRST. No cap, no cross-source ranking battle.
    const final = [];
    for (const cat of CATEGORIES) {
      const catStories = stories.filter(s => s.cat === cat);
      // dedup via the ranker (clusters near-duplicates, picks best rep)
      const deduped = rankFeed(catStories, sourceWeightOf, {
        cosThreshold: 0.85,
        simThreshold: 0.5,
        clusterByEmbedding,
      });
      // re-sort newest-first (rankFeed sorts by blended score; we want recency)
      deduped.sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0));
      perCat[cat] = deduped.length;
      for (const s of deduped) {
        final.push({
          id:        s.id,
          title:     s.rewritten || s.title,
          url:       s.url,
          cat:       s.cat,
          score:     s.score,
          pubTs:     s.publishedAt,
          firstSeen: s.firstSeenAt,
          sources:   s._corroboration || 1,
        });
      }
    }

    return res.status(200).json({ ok: true, count: final.length, perCat, stories: final });
  } catch (e) {
    console.error('feed error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}