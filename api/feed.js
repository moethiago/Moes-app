
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


// ---- kv.js ----
// ============================================================
// kv.js — thin wrapper around Upstash Redis REST API
// Works with both Vercel KV and direct Upstash env vars
// ============================================================

const URL =
  process.env.KV_REST_API_URL ||
  process.env.UPSTASH_REDIS_REST_URL;

const TOKEN =
  process.env.KV_REST_API_TOKEN ||
  process.env.UPSTASH_REDIS_REST_TOKEN;

function kvReady() {
  return !!URL && !!TOKEN;
}

async function call(command) {
  if (!URL || !TOKEN) throw new Error('KV not configured');
  const res = await fetch(URL, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + TOKEN,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  });
  if (!res.ok) throw new Error('KV error ' + res.status + ': ' + await res.text());
  const data = await res.json();
  return data.result;
}

// ----- key/value -----
async function kvGet(key) {
  const raw = await call(['GET', key]);
  if (raw == null) return null;
  try { return JSON.parse(raw); } catch { return raw; }
}

async function kvSet(key, value, ttlSeconds) {
  const v = typeof value === 'string' ? value : JSON.stringify(value);
  if (ttlSeconds) return call(['SET', key, v, 'EX', String(ttlSeconds)]);
  return call(['SET', key, v]);
}

async function kvDel(key) {
  return call(['DEL', key]);
}

async function kvExists(key) {
  return (await call(['EXISTS', key])) === 1;
}

// ----- pipeline (batches multiple commands in one round-trip) -----
async function kvPipeline(commands) {
  if (!URL || !TOKEN) throw new Error('KV not configured');
  if (!commands.length) return [];
  const res = await fetch(URL + '/pipeline', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + TOKEN,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commands),
  });
  if (!res.ok) throw new Error('KV pipeline error ' + res.status + ': ' + await res.text());
  const data = await res.json();
  return data.map(r => r.result);
}

// ----- sorted set helpers (for time-indexed category lists) -----
async function zadd(key, score, member) {
  return call(['ZADD', key, String(score), member]);
}

async function zrevrange(key, start, stop) {
  return call(['ZRANGE', key, String(start), String(stop), 'REV']);
}

async function zrem(key, member) {
  return call(['ZREM', key, member]);
}

async function zcard(key) {
  return call(['ZCARD', key]);
}

// remove sorted set members with score below given threshold (for retention)
async function zremrangebyscore(key, min, max) {
  return call(['ZREMRANGEBYSCORE', key, String(min), String(max)]);
}

// ----- list helpers (for run log) -----
async function lpush(key, value) {
  const v = typeof value === 'string' ? value : JSON.stringify(value);
  return call(['LPUSH', key, v]);
}

async function ltrim(key, start, stop) {
  return call(['LTRIM', key, String(start), String(stop)]);
}

async function lrange(key, start, stop) {
  const items = await call(['LRANGE', key, String(start), String(stop)]);
  return (items || []).map(s => { try { return JSON.parse(s); } catch { return s; } });
}


// ---- rank-core.js ----
// ============================================================
// rank-core.js — better news filtering for the feed.
// Adds on top of the existing exact-hash dedup:
//   1) semantic near-duplicate clustering (Jaccard on title tokens)
//   2) cross-source corroboration boost (big stories surface)
//   3) blended ranking: aiScore × sourceWeight × timeDecay × corroboration
// Pure JS, no extra API calls, runs in the feed handler.
// ============================================================

const RANK_STOP = new Set([
  'the','and','for','with','this','that','from','news','about','has','have','are','was','were',
  'will','would','should','could','their','they','them','says','said','after','before','into','over',
  'as','to','of','in','on','at','by','an','a','is','it','be','or','but','not','our','his','her','its',
  'new','more','than','out','off','up','down','set','via','amid','how','why','what','who'
]);

// Normalise a title into a Set of meaningful tokens.
function tokenSet(title) {
  const toks = (title || '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !RANK_STOP.has(w));
  return new Set(toks);
}

// Jaccard similarity between two token sets (0..1).
function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

// Entity-aware similarity. Headlines covering the same event share the
// key NAMES even when the verbs/phrasing differ ("Verstappen wins Monaco"
// vs "Max takes victory in Monaco"). We give shared longer tokens (likely
// names/places) extra weight, and also accept a high overlap-coefficient
// (shared / smaller set) which catches short rewrites Jaccard misses.
function titleSimilarity(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0, interWeight = 0, aw = 0, bw = 0;
  const w = t => (t.length >= 6 ? 2 : 1); // long tokens ~ proper nouns
  for (const t of a) { aw += w(t); if (b.has(t)) { inter++; interWeight += w(t); } }
  for (const t of b) bw += w(t);
  const weightedJaccard = interWeight / (aw + bw - interWeight);
  const overlapCoef = inter / Math.min(a.size, b.size); // shared / smaller
  return Math.max(weightedJaccard, overlapCoef * 0.85);
}

// Cluster near-duplicate stories. Stories with Jaccard >= threshold
// on their titles are grouped. Returns array of clusters (each an
// array of the original story objects).
function clusterStories(stories, threshold = 0.5) {
  const withTokens = stories.map(s => ({ s, tok: tokenSet(s.title) }));
  const clusters = [];
  for (const item of withTokens) {
    let placed = false;
    for (const c of clusters) {
      // compare against the cluster's representative (first item)
      if (titleSimilarity(item.tok, c.repTok) >= threshold) {
        c.items.push(item.s);
        placed = true;
        break;
      }
    }
    if (!placed) clusters.push({ repTok: item.tok, items: [item.s] });
  }
  return clusters.map(c => c.items);
}

// Pick the representative of a cluster: highest source weight, then earliest.
function pickRepresentative(cluster, sourceWeightOf) {
  return cluster.slice().sort((a, b) => {
    const wa = sourceWeightOf(a), wb = sourceWeightOf(b);
    if (wb !== wa) return wb - wa;             // higher authority first
    return (a.publishedAt || 0) - (b.publishedAt || 0); // earliest first
  })[0];
}

// Time decay: 1.0 now, halves every `halfLifeH` hours.
function timeDecay(publishedAtSec, halfLifeH = 8) {
  const ageH = (Date.now() / 1000 - (publishedAtSec || 0)) / 3600;
  if (ageH <= 0) return 1;
  return Math.pow(0.5, ageH / halfLifeH);
}

// Blended final rank for a representative story.
//   aiScore       : 0..10 editorial score
//   sourceWeight  : 1..10 from sources.js
//   corroboration : number of distinct sources covering the cluster
function blendedRank(story, sourceWeight, corroboration) {
  const ai    = (story.score || 0) / 10;                  // 0..1
  const src   = (sourceWeight || 5) / 10;                 // 0..1
  const decay = timeDecay(story.publishedAt);             // 0..1
  // corroboration boost: 1 source = 1.0, 2 = 1.25, 3 = 1.4, capped ~1.6
  const corr  = 1 + Math.min(0.6, Math.log2(Math.max(1, corroboration)) * 0.25);
  return ai * (0.5 + 0.5 * src) * decay * corr;
}

// Full pipeline: take scored stories + a source-weight lookup, return
// deduped + ranked list. Each returned story gets _corroboration and _rank.
// If stories carry an `embedding` field, clustering uses real cosine
// similarity (accurate); otherwise it falls back to title-token similarity.
function rankFeed(stories, sourceWeightOf, opts = {}) {
  const simThreshold = opts.simThreshold ?? 0.5;
  const cosThreshold = opts.cosThreshold ?? 0.85;
  const haveEmbeddings = stories.some(s => Array.isArray(s.embedding));

  let clusters;
  if (haveEmbeddings && typeof opts.clusterByEmbedding === 'function') {
    clusters = opts.clusterByEmbedding(stories, cosThreshold);
  } else {
    clusters = clusterStories(stories, simThreshold);
  }

  const out = [];
  for (const cluster of clusters) {
    const rep = pickRepresentative(cluster, sourceWeightOf);
    const sources = new Set(cluster.map(s => s.sourceUrl || s.sourceCat));
    rep._corroboration = sources.size;
    rep._clusterSize = cluster.length;
    rep._rank = blendedRank(rep, sourceWeightOf(rep), sources.size);
    out.push(rep);
  }
  out.sort((a, b) => b._rank - a._rank);
  return out;
}


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
// ==== END INLINED ====

// ============================================================
// api/feed.js — returns JSON of top approved stories per category
// Frontend calls this on page load
// ============================================================





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