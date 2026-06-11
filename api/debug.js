
// ==== INLINED SHARED CODE (was lib/) ====

// ---- embed-core.js ----
// ============================================================
// embed-core.js — semantic embeddings via Google Gemini (free tier:
// ~1500 req/day, no card). Used for real near-duplicate detection.
// Set GEMINI_API_KEY in the backend env. Degrades gracefully to
// title-token similarity (rank-core) if the key/API is unavailable.
// ============================================================

const GEMINI_EMBED_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent';

// Embed a single text. Returns number[] or null on failure.
async function embedText(text, apiKey) {
  if (!apiKey || !text) return null;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(GEMINI_EMBED_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      signal: ctrl.signal,
      body: JSON.stringify({
        content: { parts: [{ text }] },
        taskType: 'SEMANTIC_SIMILARITY',
        outputDimensionality: 768,
      }),
    });
    clearTimeout(timer);
    if (!res.ok) {
      // surface the reason in logs to make failures debuggable
      try { console.warn('Gemini embed failed', res.status, (await res.text()).slice(0, 200)); } catch (e) {}
      return null;
    }
    const data = await res.json();
    const vec = (data && data.embedding && data.embedding.values) ||
                (data && data.embeddings && data.embeddings[0] && data.embeddings[0].values);
    return Array.isArray(vec) ? vec : null;
  } catch (e) {
    return null;
  }
}

// Embed several texts. Sequential with a tiny gap to respect rate limits;
// counts are small per ingest cycle. Returns array aligned to input (null on miss).
async function embedBatch(texts, apiKey) {
  const out = [];
  for (const t of texts) {
    out.push(await embedText(t, apiKey));
  }
  return out;
}

function cosine(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// Cluster stories by embedding cosine similarity. Stories must carry
// an `embedding` field (number[]). Stories without one fall back to
// being treated as their own cluster (handled by caller's text dedup).
function clusterByEmbedding(stories, threshold = 0.85) {
  const clusters = [];
  for (const s of stories) {
    if (!s.embedding) { clusters.push([s]); continue; }
    let placed = false;
    for (const c of clusters) {
      const rep = c.find(x => x.embedding);
      if (rep && cosine(s.embedding, rep.embedding) >= threshold) {
        c.push(s); placed = true; break;
      }
    }
    if (!placed) clusters.push([s]);
  }
  return clusters;
}

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
// api/debug.js — one-shot live diagnostic. No cache, plain English.
// Visit: /api/debug?secret=YOUR_SECRET
// Tests, in order:
//   1. Env vars present?
//   2. Gemini embedding call — does it return a real vector?
//   3. KV write -> read -> delete round-trip (same method as ingest)
//   4. TwitterAPI.io — does one account return tweets?
//   5. Live story sample — how many in KV actually have embeddings?
// ============================================================



export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  if (req.query.secret !== process.env.DEPLOY_SECRET) {
    return res.status(403).json({ error: 'bad secret' });
  }

  const out = [];
  const log = (step, ok, msg) => out.push({ step, status: ok ? 'PASS' : 'FAIL', msg });

  // 1. ENV VARS
  const envs = {
    GEMINI_API_KEY:     !!process.env.GEMINI_API_KEY,
    TWITTERAPI_IO_KEY:  !!process.env.TWITTERAPI_IO_KEY,
    ANTHROPIC_API_KEY:  !!process.env.ANTHROPIC_API_KEY,
    KV_REST_API_URL:    !!(process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL),
    KV_REST_API_TOKEN:  !!(process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN),
  };
  for (const k in envs) log('env:' + k, envs[k], envs[k] ? 'set' : 'MISSING — set it in Vercel');

  // 2. GEMINI EMBEDDING — the big one
  if (envs.GEMINI_API_KEY) {
    try {
      const vec = await embedText('Leclerc signs new Ferrari contract', process.env.GEMINI_API_KEY);
      if (Array.isArray(vec) && vec.length > 0) {
        log('gemini:embed', true, 'returned a ' + vec.length + '-number vector. EMBEDDINGS WORK.');
      } else {
        // call the API raw to get the actual error text
        let raw = '';
        try {
          const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
            body: JSON.stringify({ content: { parts: [{ text: 'test' }] }, taskType: 'SEMANTIC_SIMILARITY', outputDimensionality: 768 }),
          });
          raw = 'HTTP ' + r.status + ': ' + (await r.text()).slice(0, 300);
        } catch (e) { raw = 'fetch threw: ' + e.message; }
        log('gemini:embed', false, 'NO vector returned. Raw API said: ' + raw);
      }
    } catch (e) {
      log('gemini:embed', false, 'threw: ' + e.message);
    }
  } else {
    log('gemini:embed', false, 'skipped — no GEMINI_API_KEY');
  }

  // 3. KV ROUND-TRIP (same POST pipeline ingest uses)
  const KV_URL   = process.env.KV_REST_API_URL   || process.env.UPSTASH_REDIS_REST_URL;
  const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  async function kvCall(cmd) {
    const r = await fetch(KV_URL, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + KV_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify(cmd),
    });
    return (await r.json()).result;
  }
  if (KV_URL && KV_TOKEN) {
    try {
      const tk = 'debug:test:' + Date.now();
      await kvCall(['SET', tk, 'hello', 'EX', '60']);
      const got = await kvCall(['GET', tk]);
      await kvCall(['DEL', tk]);
      const gone = await kvCall(['GET', tk]);
      const ok = got === 'hello' && (gone === null || gone === undefined);
      log('kv:roundtrip', ok, ok ? 'write/read/delete all work' : 'mismatch: wrote "hello", read "' + got + '", after del "' + gone + '"');
    } catch (e) {
      log('kv:roundtrip', false, 'threw: ' + e.message);
    }
  }

  // 4. TWITTERAPI.IO — does one account return tweets?
  if (envs.TWITTERAPI_IO_KEY && TWITTER_ACCOUNTS && TWITTER_ACCOUNTS.length) {
    const acct = TWITTER_ACCOUNTS[0];
    try {
      const r = await fetch('https://api.twitterapi.io/twitter/user/last_tweets?userName=' + encodeURIComponent(acct.handle), {
        headers: { 'x-api-key': process.env.TWITTERAPI_IO_KEY },
      });
      if (!r.ok) {
        log('twitter:fetch', false, '@' + acct.handle + ' HTTP ' + r.status + ': ' + (await r.text()).slice(0, 200));
      } else {
        const d = await r.json();
        let tweets = [];
        if (Array.isArray(d.tweets)) tweets = d.tweets;
        else if (d.data && Array.isArray(d.data.tweets)) tweets = d.data.tweets;
        else if (Array.isArray(d.data)) tweets = d.data;
        log('twitter:fetch', tweets.length > 0, '@' + acct.handle + ' returned ' + tweets.length + ' tweets'
          + (tweets[0] ? ' (latest: "' + String(tweets[0].text || '').slice(0, 50) + '...")' : ' — raw keys: ' + Object.keys(d).join(',')));
      }
    } catch (e) {
      log('twitter:fetch', false, 'threw: ' + e.message);
    }
  } else {
    log('twitter:fetch', false, 'skipped — no TWITTERAPI_IO_KEY');
  }

  // 5. HOW MANY STORED STORIES HAVE EMBEDDINGS?
  if (KV_URL && KV_TOKEN) {
    try {
      // scan a few story keys and check their embedding field
      const scan = await kvCall(['SCAN', '0', 'MATCH', 'story:*', 'COUNT', '50']);
      const keys = (scan && scan[1]) || [];
      let withEmb = 0, checked = 0;
      for (const k of keys.slice(0, 15)) {
        const raw = await kvCall(['GET', k]);
        checked++;
        try { if (JSON.parse(raw).embedding) withEmb++; } catch (e) {}
      }
      log('kv:embeddings', withEmb > 0,
        withEmb + ' of ' + checked + ' sampled stories have embeddings'
        + (withEmb === 0 ? ' — run a fresh ingest AFTER confirming gemini:embed passes' : ''));
    } catch (e) {
      log('kv:embeddings', false, 'threw: ' + e.message);
    }
  }

  const verdict = out.every(o => o.status === 'PASS') ? 'ALL GOOD' : 'SOME CHECKS FAILED — see msgs above';
  return res.status(200).json({ verdict, tests: out });
}