// ============================================================
// api/stats.js — recent ingest + score runs (for diagnostic)
// ============================================================

import { kvReady, lrange, zcard } from './_lib/kv.js';
import { CATEGORIES } from './_lib/sources.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (!kvReady()) return res.status(500).json({ error: 'KV not configured' });

  try {
    const runs = await lrange('runs', 0, 49);
    const now = Math.floor(Date.now() / 1000);
    const day = 24 * 3600;

    // Aggregate cost in last 24h
    let cost24h = 0;
    let ingest24h = 0;
    let approved24h = 0;
    for (const r of runs) {
      if (!r || !r.ts || r.ts < now - day) continue;
      if (r.cost)     cost24h     += r.cost;
      if (r.ingested) ingest24h   += r.ingested;
      if (r.approved) approved24h += r.approved;
    }

    // Latest counts per category
    const counts = {};
    for (const cat of CATEGORIES) {
      counts[cat] = await zcard('cat:' + cat);
    }

    return res.status(200).json({
      ok: true,
      summary: {
        cost24h: Math.round(cost24h * 10000) / 10000,
        ingest24h,
        approved24h,
        catCounts: counts,
      },
      recentRuns: runs.slice(0, 20),
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
