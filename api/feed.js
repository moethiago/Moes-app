// ============================================================
// api/feed.js — returns JSON of top approved stories per category
// Frontend calls this on page load
// ============================================================

import { CATEGORIES } from './lib/sources.js';
import { kvReady, kvPipeline, zrevrange } from './lib/kv.js';

const MAX_PER_CAT = 6;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');

  if (!kvReady()) return res.status(500).json({ error: 'KV not configured' });

  try {
    // For each category, get the top 20 most recent IDs from the sorted set,
    // then fetch the story objects, then filter to those with score >= 7
    const perCat = {};

    // Fetch all category IDs in parallel
    const idsPerCat = await Promise.all(
      CATEGORIES.map(c => zrevrange('cat:' + c, 0, 19))
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
      .filter(s => s && s.score && s.score >= 7);

    // Group by category, take top N per cat, sorted by publishedAt desc
    const final = [];
    for (const cat of CATEGORIES) {
      const items = stories
        .filter(s => s.cat === cat)
        .sort((a, b) => b.publishedAt - a.publishedAt)
        .slice(0, MAX_PER_CAT);
      perCat[cat] = items.length;
      for (const s of items) {
        final.push({
          title:     s.rewritten || s.title,
          url:       s.url,
          cat:       s.cat,
          score:     s.score,
          pubTs:     s.publishedAt,
          firstSeen: s.firstSeenAt,
        });
      }
    }

    return res.status(200).json({ ok: true, count: final.length, perCat, stories: final });
  } catch (e) {
    console.error('feed error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}
