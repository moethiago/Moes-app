// ============================================================
// api/score.js — scores unscored stories with Claude in batches
// Run every 2 hours (or trigger manually from diagnostic page)
// ============================================================

import { CATEGORIES } from './lib/sources.js';
import { scoreCategory } from './lib/score-core.js';
import { kvReady, kvPipeline, lpush, ltrim } from './lib/kv.js';

const MAX_CANDIDATES_PER_CAT = 25;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const started = Date.now();

  if (!kvReady()) return res.status(500).json({ error: 'KV not configured' });
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'No Anthropic API key' });

  try {
    // 1. For each category, get unscored IDs
    const unscoredIdsPerCat = await kvPipeline(
      CATEGORIES.map(c => ['SMEMBERS', 'unscored:' + c])
    );
    const totalUnscored = unscoredIdsPerCat.reduce((sum, ids) => sum + (ids || []).length, 0);

    if (totalUnscored === 0) {
      await logRun({ phase: 'score', scored: 0, approved: 0, cost: 0, durationMs: Date.now() - started, note: 'nothing to score' });
      return res.status(200).json({ ok: true, phase: 'score', scored: 0, approved: 0, cost: 0, note: 'nothing to score' });
    }

    // 2. Fetch the full story objects for each cat (cap at 25)
    const perCat = {};
    let totalCost = 0;
    let totalApproved = 0;
    let totalScored = 0;

    for (let i = 0; i < CATEGORIES.length; i++) {
      const cat = CATEGORIES[i];
      const ids = (unscoredIdsPerCat[i] || []).slice(0, MAX_CANDIDATES_PER_CAT);
      if (!ids.length) continue;

      const storyJsons = await kvPipeline(ids.map(id => ['GET', 'story:' + id]));
      const stories = storyJsons
        .map(j => { try { return JSON.parse(j); } catch { return null; } })
        .filter(Boolean)
        .sort((a, b) => b.publishedAt - a.publishedAt);

      const { approved, cost, inputTokens, outputTokens } = await scoreCategory(stories, cat, apiKey);
      totalCost     += cost;
      totalScored   += stories.length;
      totalApproved += approved.length;
      perCat[cat]    = { candidates: stories.length, approved: approved.length, cost, inputTokens, outputTokens };

      // 3. Persist results — update each story with its score
      const writes = [];
      const approvedMap = new Map(approved.map(a => [a.id, a]));
      for (const story of stories) {
        const a = approvedMap.get(story.id);
        if (a) {
          story.score = a.score;
          story.rewritten = a.rewritten;
        } else {
          story.score = 0;   // explicitly mark as rejected
        }
        story.scoredAt = Math.floor(Date.now() / 1000);
        writes.push(['SET', 'story:' + story.id, JSON.stringify(story), 'EX', String(48 * 3600)]);
        // remove from unscored set
        writes.push(['SREM', 'unscored:' + cat, story.id]);
      }
      if (writes.length) await kvPipeline(writes);
    }

    await logRun({
      phase: 'score',
      scored: totalScored,
      approved: totalApproved,
      cost: totalCost,
      perCat,
      durationMs: Date.now() - started,
    });

    return res.status(200).json({
      ok: true,
      phase: 'score',
      scored: totalScored,
      approved: totalApproved,
      cost: totalCost,
      costUsdRounded: Math.round(totalCost * 10000) / 10000,
      perCat,
      durationMs: Date.now() - started,
    });
  } catch (e) {
    console.error('score error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}

async function logRun(entry) {
  try {
    entry.ts = Math.floor(Date.now() / 1000);
    await lpush('runs', entry);
    await ltrim('runs', 0, 99);
  } catch (e) {}
}
