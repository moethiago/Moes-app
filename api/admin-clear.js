
// ==== INLINED SHARED CODE (was lib/) ====

// ---- sources.js ----
// ============================================================
// sources.js — trusted RSS sources whitelist
// EDIT THIS FILE to add/remove sources
// ============================================================

const TRUSTED_SOURCES = [
  // F1 — official + top-tier
  { url:'https://www.formula1.com/en/latest/all.xml',                     cat:'F1',       weight:10 },
  { url:'https://feeds.bbci.co.uk/sport/formula1/rss.xml',                cat:'F1',       weight:9  },
  { url:'https://www.autosport.com/rss/f1/news/',                         cat:'F1',       weight:8  },
  { url:'https://racefans.net/feed/',                                     cat:'F1',       weight:7  },
  { url:'https://www.motorsport.com/rss/f1/news/',                        cat:'F1',       weight:8  },
  { url:'https://www.the-race.com/formula-1/feed/',                       cat:'F1',       weight:8  },
  { url:'https://www.planetf1.com/feed',                                  cat:'F1',       weight:7  },
  { url:'https://www.reddit.com/r/formula1/top/.rss?t=day&limit=15',      cat:'F1',       weight:7  },

  // Football — top-tier neutral outlets only
  { url:'https://feeds.bbci.co.uk/sport/football/rss.xml',                cat:'FOOTBALL', weight:10 },
  { url:'https://www.theguardian.com/football/premierleague/rss',         cat:'FOOTBALL', weight:9  },
  { url:'https://www.theguardian.com/football/laliga/rss',                cat:'FOOTBALL', weight:9  },
  { url:'https://www.theguardian.com/football/serieafootball/rss',        cat:'FOOTBALL', weight:9  },
  { url:'https://www.theguardian.com/football/bundesligafootball/rss',    cat:'FOOTBALL', weight:9  },
  { url:'https://www.skysports.com/rss/11095',                            cat:'FOOTBALL', weight:8  },
  { url:'https://www.espn.com/espn/rss/soccer/news',                      cat:'FOOTBALL', weight:8  },
  { url:'https://onefootball.com/en/rss',                                 cat:'FOOTBALL', weight:7  },
  { url:'https://www.reddit.com/r/soccer/top/.rss?t=day&limit=15',        cat:'FOOTBALL', weight:7  },
  { url:'https://www.reddit.com/r/PremierLeague/top/.rss?t=day&limit=10', cat:'FOOTBALL', weight:7  },
  { url:'https://www.reddit.com/r/LaLiga/top/.rss?t=day&limit=10',        cat:'FOOTBALL', weight:7  },

  // Bayern — official + dedicated
  { url:'https://www.bundesliga.com/rss/en/rss-news.rss',                 cat:'BAYERN',   weight:10 },
  { url:'https://www.theguardian.com/football/bundesligafootball/rss',    cat:'BAYERN',   weight:8  },
  { url:'https://weltfussball.de/rss/news_fc-bayern-muenchen.xml',        cat:'BAYERN',   weight:7  },
  { url:'https://www.reddit.com/r/fcbayern/top/.rss?t=day&limit=15',      cat:'BAYERN',   weight:8  },

  // SPL — region-specific
  { url:'https://www.arabnews.com/cat/5/rss.xml',                         cat:'SPL',      weight:10 },
  { url:'https://saudigazette.com.sa/rssFeed/74',                         cat:'SPL',      weight:8  },
  { url:'https://www.reddit.com/r/syrianfootball/top/.rss?t=day&limit=5', cat:'SPL',      weight:5  },

  // KSA — economy/general news
  { url:'https://www.arabnews.com/rss.xml',                               cat:'KSA',      weight:9  },
  { url:'https://www.arabnews.com/economy/rss.xml',                       cat:'KSA',      weight:10 },
  { url:'https://en.majalla.com/rss.xml',                                 cat:'KSA',      weight:8  },
  { url:'https://www.reddit.com/r/saudiarabia/top/.rss?t=day&limit=10',   cat:'KSA',      weight:6  },
];

// Curated "hub" accounts — a breaker + an aggregator per topic that
// already collect everything for that topic. Quality over quantity:
// following the hubs gives the signal of 20 accounts without the noise.
// Confirmed with Moaath.
const TWITTER_ACCOUNTS = [
  // F1
  { handle:'F1',            cat:'F1',       weight:10 },
  { handle:'planet_f1',     cat:'F1',       weight:8  },
  // Football (general) — aggregator hubs
  { handle:'433',           cat:'FOOTBALL', weight:8  },
  { handle:'bleacherreport',cat:'FOOTBALL', weight:8  },
  // Bayern
  { handle:'iMiaSanMia',    cat:'BAYERN',   weight:10 },
  { handle:'FCBayernEN',    cat:'BAYERN',   weight:9  },
  // SPL / Saudi football
  { handle:'koorashow_ksa', cat:'SPL',      weight:10 },
  // KSA news / economy
  { handle:'azk_sa',        cat:'KSA',      weight:9  },
  { handle:'thesaudi_post', cat:'KSA',      weight:9  },
];

const CATEGORIES = ['F1','FOOTBALL','BAYERN','SPL','KSA'];

const CAT_KEYWORDS = {
  BAYERN: ['bayern','muenchen','munich','fc bayern'],
};

function assignCategory(title, sourceCat) {
  const lower = title.toLowerCase();
  if (sourceCat === 'FOOTBALL' || sourceCat === 'BAYERN') {
    const hasBayern = CAT_KEYWORDS.BAYERN.some(k => lower.includes(k));
    if (hasBayern) return 'BAYERN';
    if (sourceCat === 'BAYERN') return null;
  }
  return sourceCat;
}

// ==== END INLINED ====

// ============================================================
// api/admin-clear.js — one-time maintenance endpoint.
// Wipes all story:* keys and the cat:* indexes so the next ingest
// repopulates everything FRESH (with embeddings + Twitter sources).
// Protected by DEPLOY_SECRET. Visit:
//   /api/admin-clear?secret=YOUR_SECRET
// Optional: &dry=1 to preview counts without deleting.
// ============================================================


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