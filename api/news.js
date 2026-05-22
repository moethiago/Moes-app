// ============================================================
// news.js — Vercel handler (entry point)
// ============================================================

import { REJECT_PHRASES, preFilter, RSS_SOURCES, GOOGLE_NEWS_SOURCES, GDELT_QUERIES, NEWSDATA_QUERIES, TWITTER_QUERIES, WEB_SEARCH_QUERIES, CAT_PROMPTS } from './lib/news-sources.js';
import { isSimilar, dedupKey, fetchRSS, fetchGDELT, fetchNewsData, claudeWebSearch, callClaudeScorer } from './lib/news-helpers.js';
import { getCurrentFeed, writeFeed } from './lib/news-github.js';

// ===== MAIN HANDLER ============================================
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const apiKey      = process.env.ANTHROPIC_API_KEY;
  const newsDataKey = process.env.NEWSDATA_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'No Anthropic API key' });

  const now = Math.floor(Date.now() / 1000);

  // ---- KEY CHANGE: separate retention windows ----
  // Retain stories in feed for 24h MAX (was 72h). Old news is bad news.
  const FEED_RETENTION_HOURS = 24;
  // Only INGEST stories published in the last 18h.
  const INGEST_MAX_AGE_HOURS = 18;

  const CATEGORIES = ['F1','FOOTBALL','BAYERN','SPL','KSA'];

  try {
    const { items: existingItems, sha, fullContent } = await getCurrentFeed();

    // 1. Drop existing items older than retention window (by PUBLISH time, not add time)
    const existing = existingItems.filter(i => (now - (i.pubTs || i.ts)) < FEED_RETENTION_HOURS * 3600);

    // 2. Build dedup set from existing
    const seenTitles = new Set(existing.map(i => dedupKey(i.title)));

    // 3. Fetch all streams in parallel
    const [rssResults, gdeltResults, newsdataResults, twitterResults, webResults] = await Promise.all([
      Promise.all([...RSS_SOURCES, ...GOOGLE_NEWS_SOURCES].map(src => fetchRSS(src, seenTitles, INGEST_MAX_AGE_HOURS))),
      Promise.all(GDELT_QUERIES.map(q => fetchGDELT(q, seenTitles))),
      Promise.all(NEWSDATA_QUERIES.map(q => fetchNewsData(q, newsDataKey, seenTitles))),
      Promise.all(TWITTER_QUERIES.map(q => claudeWebSearch(q.query, q.cat, apiKey, true))),
      Promise.all(WEB_SEARCH_QUERIES.map(q => claudeWebSearch(q.query, q.cat, apiKey, false))),
    ]);

    const rssItems      = rssResults.flat();
    const gdeltItems    = gdeltResults.flat();
    const newsdataItems = newsdataResults.flat();
    const twitterItems  = twitterResults.flat().filter(item => {
      if (!preFilter(item.title)) return false;
      const k = dedupKey(item.title);
      if (seenTitles.has(k)) return false;
      seenTitles.add(k);
      return true;
    });
    const webItems = webResults.flat().filter(item => {
      if (!preFilter(item.title)) return false;
      const k = dedupKey(item.title);
      if (seenTitles.has(k)) return false;
      seenTitles.add(k);
      return true;
    });

    console.log('Ingested: RSS=' + rssItems.length + ' GDELT=' + gdeltItems.length +
                ' NewsData=' + newsdataItems.length + ' Twitter=' + twitterItems.length + ' Web=' + webItems.length);

    const allNew = [...rssItems, ...gdeltItems, ...newsdataItems, ...twitterItems, ...webItems];

    // 4. Fuzzy dedup against existing (stricter)
    const trulyNew = allNew.filter(newItem =>
      !existing.some(ex => ex.cat === newItem.cat && isSimilar(newItem.title, ex.title))
    );

    // 5. Fuzzy dedup within the new batch
    const uniqueNew = [];
    for (const item of trulyNew) {
      if (!uniqueNew.some(kept => kept.cat === item.cat && isSimilar(item.title, kept.title))) {
        uniqueNew.push(item);
      }
    }

    console.log('Unique new candidates: ' + uniqueNew.length);

    // 6. Claude editorial scoring per category
    const approvedArrays = await Promise.all(
      CATEGORIES.map(async (cat) => {
        const catItems = uniqueNew.filter(i => i.cat === cat).sort((a,b) => b.pubTs - a.pubTs).slice(0, 30);
        if (!catItems.length) return [];
        const result = await callClaudeScorer(catItems, cat, apiKey);
        console.log(cat + ': ' + result.length + ' approved / ' + catItems.length + ' candidates');
        return result;
      })
    );
    const approved = approvedArrays.flat();

    // 7. Stamp newly approved with current time as "added to feed"
    //    but KEEP their original pubTs for display.
    approved.forEach(item => {
      item.ts = now;
      if (!item.pubTs) item.pubTs = now;
    });

    // 8. Merge existing + new, dedup again, sort by pubTs desc, cap 6 per cat
    const all = [...existing, ...approved];
    const finalDeduped = [];
    for (const item of all) {
      if (!finalDeduped.some(kept => kept.cat === item.cat && isSimilar(item.title, kept.title))) {
        finalDeduped.push(item);
      }
    }

    const final = CATEGORIES.map(cat =>
      finalDeduped
        .filter(i => i.cat === cat)
        .sort((a,b) => (b.pubTs || b.ts) - (a.pubTs || a.ts))   // newest first by PUBLISH time
        .slice(0, 6)
    ).flat();

    console.log('Final feed: ' + final.length + ' stories');

    if (sha && fullContent) {
      await writeFeed(final, fullContent, sha);
    }

    return res.status(200).json({
      ok: true,
      stories: final.length,
      ingested: rssItems.length + gdeltItems.length + newsdataItems.length + twitterItems.length + webItems.length,
      candidates: uniqueNew.length,
      approved: approved.length,
    });
  } catch (e) {
    console.error('Handler error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}
