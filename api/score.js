// ============================================================
// api/score.js — scores unscored stories with Claude in batches
// Run every 2 hours (or trigger manually from diagnostic page)
// ============================================================

import { CATEGORIES } from './_lib/sources.js';
import { scoreCategory } from './_lib/score-core.js';
import { kvReady, kvPipeline, lpush, ltrim } from './_lib/kv.js';

const MAX_CANDIDATES_PER_CAT = 25;

// Cheap local pre-filter — drops obvious clickbait/opinion BEFORE the paid AI
// pass, so the token budget is spent only on plausible real stories.
const JUNK_PATTERNS = [
  /\bopinion\b/i, /\bcolumn\b/i, /\bwhy \w+ (should|must|could)\b/i,
  /\branking\b/i, /\brated\b/i, /\bbest \d+\b/i, /\btop \d+ /i,
  /\bfans react\b/i, /\breaction\b/i, /\bhere'?s why\b/i,
  /\bthings we learned\b/i, /\bquiz\b/i, /\bpredict/i, /\bvote\b/i,
  /\bwatch:/i, /\bgallery\b/i, /\bin pictures\b/i,
];
function isObviousJunk(title) {
  if (!title) return true;
  return JUNK_PATTERNS.some(re => re.test(title));
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const started = Date.now();

  if (!kvReady()) return res.status(500).json({ error: 'KV not configured' });
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'No Anthropic API key' });

  try {
    // 0. COST GUARD - check yesterday's spend before doing anything expensive
    const costGuard = await checkCostGuard();
    if (costGuard.blocked) {
      return res.status(429).json({
        error: 'Daily cost limit reached',
        cost24h: costGuard.cost24h,
        limit: costGuard.limit,
      });
    }

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
        .filter(s => !isObviousJunk(s.title))
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

const DAILY_COST_LIMIT = 0.50; // $0.50 / day max - hard kill switch

async function checkCostGuard() {
  try {
    const URL   = process.env.KV_REST_API_URL   || process.env.UPSTASH_REDIS_REST_URL;
    const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!URL || !TOKEN) return { blocked: false, cost24h: 0, limit: DAILY_COST_LIMIT };

    const res = await fetch(URL, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify(['LRANGE', 'runs', '0', '99']),
    });
    if (!res.ok) return { blocked: false, cost24h: 0, limit: DAILY_COST_LIMIT };
    const data = await res.json();
    const runs = (data.result || []).map(s => { try { return JSON.parse(s); } catch { return null; } }).filter(Boolean);
    const now = Math.floor(Date.now() / 1000);
    const day = 24 * 3600;
    let cost24h = 0;
    for (const r of runs) {
      if (!r || !r.ts || r.ts < now - day) continue;
      if (r.cost) cost24h += r.cost;
    }
    return { blocked: cost24h >= DAILY_COST_LIMIT, cost24h, limit: DAILY_COST_LIMIT };
  } catch {
    return { blocked: false, cost24h: 0, limit: DAILY_COST_LIMIT };
  }
}

async function logRun(entry) {
  try {
    entry.ts = Math.floor(Date.now() / 1000);
    await lpush('runs', entry);
    await ltrim('runs', 0, 99);
  } catch (e) {}
}
