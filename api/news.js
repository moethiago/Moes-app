// ============================================================
// news.js — Vercel handler
// COST SAFE: zero Claude web search calls. Claude used ONLY
// for scoring headlines from free RSS/GDELT/NewsData sources.
// Estimated cost: ~$0.01 per day at 30min intervals.
// ============================================================

import { preFilter, RSS_SOURCES, GOOGLE_NEWS_SOURCES, GDELT_QUERIES, NEWSDATA_QUERIES, CAT_PROMPTS } from './lib/news-sources.js';
import { isSimilar, dedupKey, fetchRSS, fetchGDELT, fetchNewsData, callClaudeScorer } from './lib/news-helpers.js';
import { getCurrentFeed, writeFeed } from './lib/news-github.js';

const CATEGORIES        = ['F1','FOOTBALL','BAYERN','SPL','KSA'];
const FEED_RETENTION_H  = 24;   // drop stories older than 24h
const INGEST_MAX_AGE_H  = 18;   // only ingest stories published in last 18h
const MAX_PER_CAT       = 6;    // max stories shown per category
const MAX_CANDIDATES    = 25;   // max candidates sent to Claude per category

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const apiKey      = process.env.ANTHROPIC_API_KEY;
  const newsDataKey = process.env.NEWSDATA_API_KEY;

  // Fail immediately if no API key — don't burn credits on a broken run
  if (!apiKey) return res.status(500).json({ error: 'No Anthropic API key' });

  const now = Math.floor(Date.now() / 1000);

  try {
    // 1. Load existing feed from GitHub
    const { items: existingItems, sha, fullContent } = await getCurrentFeed();
    if (!sha || !fullContent) {
      return res.status(500).json({ error: 'Could not read feed from GitHub' });
    }

    // 2. Drop stale stories
    const existing = existingItems.filter(i =>
      (now - (i.pubTs || i.ts)) < FEED_RETENTION_H * 3600
    );

    // 3. Build dedup set
    const seenTitles = new Set(existing.map(i => dedupKey(i.title)));

    // 4. Fetch FREE sources only (no Claude web search, no Twitter)
    const [rssResults, gdeltResults, newsdataResults] = await Promise.all([
      Promise.all([...RSS_SOURCES, ...GOOGLE_NEWS_SOURCES].map(src =>
        fetchRSS(src, seenTitles, INGEST_MAX_AGE_H)
      )),
      Promise.all(GDELT_QUERIES.map(q => fetchGDELT(q, seenTitles))),
      Promise.all(NEWSDATA_QUERIES.map(q => fetchNewsData(q, newsDataKey, seenTitles))),
    ]);

    const allNew = [
      ...rssResults.flat(),
      ...gdeltResults.flat(),
      ...newsdataResults.flat(),
    ];

    console.log('Ingested: RSS=' + rssResults.flat().length +
                ' GDELT=' + gdeltResults.flat().length +
                ' NewsData=' + newsdataResults.flat().length +
                ' Total=' + allNew.length);

    // 5. Skip Claude entirely if nothing new came in
    if (allNew.length === 0) {
      console.log('No new candidates — skipping Claude, keeping existing feed');
      return res.status(200).json({
        ok: true, stories: existing.length, ingested: 0, candidates: 0, approved: 0,
      });
    }

    // 6. Fuzzy dedup against existing feed
    const trulyNew = allNew.filter(item =>
      !existing.some(ex => ex.cat === item.cat && isSimilar(item.title, ex.title))
    );

    // 7. Fuzzy dedup within new batch
    const uniqueNew = [];
    for (const item of trulyNew) {
      if (!uniqueNew.some(kept => kept.cat === item.cat && isSimilar(item.title, kept.title))) {
        uniqueNew.push(item);
      }
    }

    console.log('Unique new candidates: ' + uniqueNew.length);

    // 8. Skip Claude if still nothing after dedup
    if (uniqueNew.length === 0) {
      console.log('All candidates already in feed — skipping Claude');
      return res.status(200).json({
        ok: true, stories: existing.length, ingested: allNew.length, candidates: 0, approved: 0,
      });
    }

    // 9. Claude scoring — ONLY for categories that have new candidates
    const approvedArrays = await Promise.all(
      CATEGORIES.map(async (cat) => {
        const catItems = uniqueNew
          .filter(i => i.cat === cat)
          .sort((a, b) => (b.pubTs || 0) - (a.pubTs || 0))
          .slice(0, MAX_CANDIDATES);
        if (!catItems.length) return [];
        const result = await callClaudeScorer(catItems, cat, apiKey);
        console.log(cat + ': ' + result.length + ' approved / ' + catItems.length + ' candidates');
        return result;
      })
    );

    const approved = approvedArrays.flat();
    approved.forEach(item => {
      item.ts = now;
      if (!item.pubTs) item.pubTs = now;
    });

    // 10. Merge, final dedup, sort by publish time, cap per category
    const merged = [...existing, ...approved];
    const finalDeduped = [];
    for (const item of merged) {
      if (!finalDeduped.some(kept => kept.cat === item.cat && isSimilar(item.title, kept.title))) {
        finalDeduped.push(item);
      }
    }

    const final = CATEGORIES.map(cat =>
      finalDeduped
        .filter(i => i.cat === cat)
        .sort((a, b) => (b.pubTs || b.ts) - (a.pubTs || a.ts))
        .slice(0, MAX_PER_CAT)
    ).flat();

    console.log('Final feed: ' + final.length + ' stories');

    // 11. Write back to GitHub
    await writeFeed(final, fullContent, sha);

    return res.status(200).json({
      ok: true,
      stories: final.length,
      ingested: allNew.length,
      candidates: uniqueNew.length,
      approved: approved.length,
    });

  } catch (e) {
    console.error('Handler error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}