
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






// ==== BRIEF (Daily Brief — PDB-style, Groq free tier, cached per Riyadh day) ====
// GET /api/feed?brief=1            -> today's cached brief, or {ok:true,cached:false} (never spends)
// GET /api/feed?brief=1&build=1    -> build + cache (explicit tap in the UI; Groq free tier = SAR 0)
// GET /api/feed?brief=1&build=1&force=1 -> rebuild today's brief
// Keys: brief:<YYYY-MM-DD> (36h TTL), brief:builds:<YYYY-MM-DD> (daily build cap)
const BRIEF_SOURCES = [
  // Saudi — Arabic (Google News SA aggregates Sabq, Okaz, Al Riyadh, SPA, Al Arabiya, Argaam…; gn:true = source name is in the title suffix)
  { url:'https://news.google.com/rss?hl=ar&gl=SA&ceid=SA:ar',                                                                         src:'Google News SA', cat:'KSA',   weight:10, gn:true },
  { url:'https://news.google.com/rss/search?q=%D8%A7%D9%84%D8%B3%D8%B9%D9%88%D8%AF%D9%8A%D8%A9+when:1d&hl=ar&gl=SA&ceid=SA:ar',     src:'Google News SA', cat:'KSA',   weight:9,  gn:true },
  { url:'https://news.google.com/rss/search?q=%D8%A7%D9%84%D8%B1%D9%8A%D8%A7%D8%B6+OR+%D8%A7%D9%84%D9%82%D8%B5%D9%8A%D9%85+when:1d&hl=ar&gl=SA&ceid=SA:ar', src:'Google News SA', cat:'KSA', weight:8, gn:true },
  { url:'https://news.google.com/rss/search?q=%D8%A3%D8%B1%D8%A7%D9%85%D9%83%D9%88+OR+%D8%AA%D8%AF%D8%A7%D9%88%D9%84+OR+%D8%B5%D9%86%D8%AF%D9%88%D9%82+%D8%A7%D9%84%D8%A7%D8%B3%D8%AA%D8%AB%D9%85%D8%A7%D8%B1%D8%A7%D8%AA+when:1d&hl=ar&gl=SA&ceid=SA:ar', src:'Google News SA', cat:'MARKETS', weight:8, gn:true },
  { url:'https://news.google.com/rss/search?q=%D8%AF%D9%88%D8%B1%D9%8A+%D8%B1%D9%88%D8%B4%D9%86+OR+%D8%A7%D9%84%D9%87%D9%84%D8%A7%D9%84+OR+%D8%A7%D9%84%D9%86%D8%B5%D8%B1+OR+%D8%A7%D9%84%D8%A7%D8%AA%D8%AD%D8%A7%D8%AF+OR+%D8%A7%D9%84%D8%A3%D9%87%D9%84%D9%8A+when:1d&hl=ar&gl=SA&ceid=SA:ar', src:'Google News SA', cat:'SPORT', weight:7, gn:true },
  { url:'https://www.okaz.com.sa/rssFeed/0',                              src:'Okaz',          cat:'KSA',     weight:8  },
  // Saudi — English
  { url:'https://www.arabnews.com/rss.xml',                               src:'Arab News',     cat:'KSA',     weight:9  },
  { url:'https://saudigazette.com.sa/rssFeed/74',                         src:'Saudi Gazette', cat:'KSA',     weight:8  },
  { url:'https://en.majalla.com/rss.xml',                                 src:'Al Majalla',    cat:'KSA',     weight:7  },
  { url:'https://feeds.bbci.co.uk/news/world/rss.xml',                    src:'BBC',           cat:'WORLD',   weight:9  },
  { url:'https://www.aljazeera.com/xml/rss/all.xml',                      src:'Al Jazeera',    cat:'WORLD',   weight:8  },
  { url:'https://www.theguardian.com/world/rss',                          src:'The Guardian',  cat:'WORLD',   weight:8  },
  { url:'https://feeds.bbci.co.uk/news/business/rss.xml',                 src:'BBC Business',  cat:'MARKETS', weight:8  },
  { url:'https://www.cnbc.com/id/100727362/device/rss/rss.html',          src:'CNBC',          cat:'MARKETS', weight:7  },
  { url:'https://oilprice.com/rss/main',                                  src:'OilPrice',      cat:'OIL',     weight:8  },
  { url:'https://techcrunch.com/category/artificial-intelligence/feed/',  src:'TechCrunch',    cat:'TECH',    weight:6  },
  { url:'https://www.formula1.com/en/latest/all.xml',                     src:'Formula1.com',  cat:'MOTOR',   weight:5  },
];
const BRIEF_MAX_HEADLINES = 260;
// Default X accounts. cat: KSA (Saudi news), GULF, WORLD, MARKETS, TECH, SPORT, VOICE (Saudi people worth hearing). User additions live in KV key brief:accounts.
const BRIEF_X_DEFAULT = [
  { handle:'spagov',         cat:'KSA',     weight:10 }, { handle:'Sabqorg',        cat:'KSA',     weight:9 },
  { handle:'AjelNews24',     cat:'KSA',     weight:9  }, { handle:'OKAZ_online',    cat:'KSA',     weight:8 },
  { handle:'alekhbariyatv',  cat:'KSA',     weight:9  }, { handle:'SaudiNews50',    cat:'KSA',     weight:8 },
  { handle:'AlArabiya',      cat:'GULF',    weight:9  }, { handle:'AlHadath',       cat:'GULF',    weight:8 },
  { handle:'argaam',         cat:'MARKETS', weight:8  }, { handle:'aleqtisadiah',   cat:'MARKETS', weight:7 },
  { handle:'Reuters',        cat:'WORLD',   weight:9  }, { handle:'BBCBreaking',    cat:'WORLD',   weight:9 },
  { handle:'AJABreaking',    cat:'WORLD',   weight:8  }, { handle:'Spectatorindex', cat:'WORLD',   weight:7 },
  { handle:'arabnews',       cat:'KSA',     weight:7  }, { handle:'Saudi_Gazette',  cat:'KSA',     weight:6 },
  { handle:'SPL',            cat:'SPORT',   weight:6  }, { handle:'SaudiNT',        cat:'SPORT',   weight:5 },
];
const BRIEF_X_SYNDICATION = 'https://syndication.twitter.com/srv/timeline-profile/screen-name/';
const BRIEF_X_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const BRIEF_TRENDS_URL = 'https://trends24.in/saudi-arabia/';
const BRIEF_MAX_AGE_H = 26;
const BRIEF_DAILY_CAP = 6;
const BRIEF_TIERS = new Set(['critical','high','watch']);
const BRIEF_SECTIONS = ['Saudi Arabia','Gulf & Oil','World','Markets','Tech & AI','Sport','Society','Motorsport'];

function briefRiyadhDate(now = Date.now()) {
  return new Date(now + 3 * 3600 * 1000).toISOString().slice(0, 10);
}
function briefExtractTag(xml, tag) {
  const m = xml.match(new RegExp('<' + tag + '[^>]*>([\\s\\S]*?)<\\/' + tag + '>', 'i'));
  return m ? m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1').trim() : '';
}
function briefClean(s) {
  return (s || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}
function briefParseRSS(xml, src) {
  const now = Date.now(), out = [];
  const items = xml.match(/<(item|entry)[^>]*>[\s\S]*?<\/\1>/gi) || [];
  for (const item of items.slice(0, 30)) {
    let title = briefClean(briefExtractTag(item, 'title')); let srcName = src.src;
    if (src.gn) { const m = title.match(/^(.*)\s[-–]\s([^-–]{2,40})$/); if (m) { title = m[1].trim(); srcName = m[2].trim(); } }
    let link = briefClean(briefExtractTag(item, 'link'));
    if (!link) { const m = item.match(/<link[^>]*href="([^"]+)"/i); if (m) link = m[1]; }
    const pub = briefExtractTag(item, 'pubDate') || briefExtractTag(item, 'published') || briefExtractTag(item, 'updated');
    const d = new Date(pub); const ts = d.getTime();
    if (!title || title.length < 12 || !link || isNaN(ts)) continue;
    if (now - ts > BRIEF_MAX_AGE_H * 3600 * 1000 || ts > now + 3600 * 1000) continue;
    out.push({ title, url: link, src: srcName, cat: src.cat, weight: src.weight, publishedAt: Math.floor(ts / 1000) });
  }
  return out;
}
async function briefFetchSource(src) {
  const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(src.url, { signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MoesApp/3.0)' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return briefParseRSS(await r.text(), src);
  } finally { clearTimeout(timer); }
}
async function briefFetchTrends() {
  try {
    const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(BRIEF_TRENDS_URL, { signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh)' } }); clearTimeout(timer);
    if (!r.ok) return [];
    const html = await r.text(); const seen = new Set(); const out = [];
    const re = /trend-link[^>]*>([^<]{2,80})</g; let m;
    while ((m = re.exec(html)) && out.length < 20) { const t = briefClean(m[1]); if (t && !seen.has(t) && !/\d{5,}/.test(t)) { seen.add(t); out.push(t); } }
    return out;
  } catch { return []; }
}
async function briefAccounts() {
  const extra = await kvGet('brief:accounts');
  const list = BRIEF_X_DEFAULT.slice();
  if (Array.isArray(extra)) for (const a of extra) { if (a && a.handle && !list.some(x => x.handle.toLowerCase() === String(a.handle).toLowerCase())) list.push({ handle: String(a.handle).replace(/^@/, ''), cat: a.cat || 'VOICE', weight: Number(a.weight) || 7 }); }
  const removed = Array.isArray(extra) ? extra.filter(a => a && a.remove).map(a => String(a.handle).replace(/^@/, '').toLowerCase()) : [];
  return list.filter(a => !removed.includes(a.handle.toLowerCase()));
}
function briefParseTweets(html, acct) {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('no timeline data');
  const d = JSON.parse(m[1]);
  const entries = (((d.props || {}).pageProps || {}).timeline || {}).entries || [];
  const now = Date.now(), out = [];
  for (const e of entries) {
    const t = e && e.content && e.content.tweet; if (!t) continue;
    const src = t.retweeted_status || t; // RT: use the original text, credit the account for surfacing it
    let text = String(src.full_text || src.text || '').replace(/https?:\/\/t\.co\/\S+/g, '').replace(/\s+/g, ' ').trim();
    if (src.quoted_status && src.quoted_status.full_text) text += ' ⟶ ' + String(src.quoted_status.full_text).replace(/https?:\/\/t\.co\/\S+/g, '').replace(/\s+/g, ' ').trim().slice(0, 160);
    const ts = new Date(src.created_at || t.created_at).getTime();
    if (!text || text.length < 15 || isNaN(ts)) continue;
    if (now - ts > BRIEF_MAX_AGE_H * 3600 * 1000) continue;
    if (/^@\w+/.test(text) && !t.retweeted_status) continue; // skip bare replies
    const id = src.id_str || t.id_str; const user = (src.user && src.user.screen_name) || acct.handle;
    out.push({ title: text.slice(0, 400), url: 'https://x.com/' + user + '/status/' + id, src: '@' + acct.handle, cat: acct.cat, weight: acct.weight,
      publishedAt: Math.floor(ts / 1000), likes: Number(src.favorite_count) || 0, rts: Number(src.retweet_count) || 0 });
  }
  return out;
}
async function briefFetchAccount(acct) {
  const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 9000);
  try {
    const r = await fetch(BRIEF_X_SYNDICATION + encodeURIComponent(acct.handle), { signal: ctrl.signal, headers: { 'User-Agent': BRIEF_X_UA, 'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return briefParseTweets(await r.text(), acct);
  } finally { clearTimeout(timer); }
}
async function briefCollect() {
  const accounts = await briefAccounts();
  const settled = await Promise.allSettled(accounts.map(briefFetchAccount));
  const okSrc = [], failed = []; let all = [];
  settled.forEach((r, i) => {
    const s = accounts[i];
    if (r.status === 'fulfilled' && r.value.length) { okSrc.push('@' + s.handle + ' (' + s.cat + ', ' + r.value.length + ')'); all = all.concat(r.value); }
    else failed.push('@' + s.handle + ' (' + s.cat + '): ' + (r.status === 'rejected' ? (r.reason && r.reason.message) : 'no recent tweets'));
  });
  // dedupe near-identical headlines across sources, keep highest-weight rep
  const clusters = clusterStories(all, 0.5);
  const reps = clusters.map(c => { const rep = c.slice().sort((a, b) => b.weight - a.weight)[0]; rep.corroboration = new Set(c.map(x => x.src)).size; return rep; });
  reps.sort((a, b) => (b.corroboration - a.corroboration) || (b.weight - a.weight) || ((b.likes + 3 * b.rts) - (a.likes + 3 * a.rts)) || (b.publishedAt - a.publishedAt));
  // guarantee Saudi presence: Saudi news + Saudi voices first, then fill
  const ksa = reps.filter(r => r.cat === 'KSA' || r.cat === 'VOICE').slice(0, 150);
  const rest = reps.filter(r => r.cat !== 'KSA' && r.cat !== 'VOICE');
  const picked = ksa.concat(rest).slice(0, BRIEF_MAX_HEADLINES);
  const trends = await briefFetchTrends();
  return { headlines: picked, okSrc, failed, trends };
}
const BRIEF_SYSTEM = `You are the senior briefer preparing the President's Daily Brief for Moaath — Head of Strategy & Performance at a Saudi group, based in Riyadh, owner of a date farm in Qassim. Audience: one executive who reads this in 3 minutes on a phone. Tone: crisp, factual, no hype, no filler, no moralising. British spelling.

RANKING PROFILE (highest first):
1. Saudi Arabia domestic — government decisions, regulation, Vision 2030, PIF, giga-projects, economy, labour, Qassim/agriculture, anything a Riyadh executive must know before Sunday's meetings.
2. Gulf & oil — OPEC+, Brent, GCC politics, Iran/Israel/Yemen as they touch the Kingdom.
3. World — wars, elections, decisions by the US/China/EU that move the region or markets.
4. Markets — Tadawul, Fed, dollar, gold, major corporate moves.
5. Tech & AI — model releases and regulation that change how work is done.
6. Motorsport — only if genuinely major (title-deciding, safety, Saudi GP).
7. Sport & society — Roshn League (Hilal, Nassr, Ittihad, Ahli), Saudi national team, and the social stories the whole country is talking about. These belong in the second layer, not the top items, unless huge.

THE GOAL: after reading this he must know everything his friends who scroll X all day know — nothing they mention tonight should be new to him. So the second layer ("also") must be broad: every distinct story of the day that a Saudi executive would hear about, one line each, Arabic headlines rendered in clear English. Drop only pure spam, ads, opinion columns and non-Saudi local crime.

Return ONLY a JSON object:
{"headline":"<one sentence — the single most important thing today>",
 "items":[{"n":<headline number>,"tier":"critical|high|watch","section":"<one of: ${BRIEF_SECTIONS.join(' | ')}>","title":"<rewritten, ≤12 words, specific>","what":"<1 sentence: what happened, with the key number/name/date>","why":"<1 sentence: why it matters to him specifically — decision, risk or opportunity>"}],
 "also":[{"n":<headline number>,"section":"<one of the sections above>","line":"<one line, ≤22 words, the fact itself with the name/number, no commentary>"}],
 "trending":[{"topic":"<the trend exactly as given>","what":"<≤14 words: what it is about, using the headlines if they explain it; else 'unclear from today's news'>"}],
 "bottomLine":"<2 sentences max: what to watch next 24h>"}
Every line below is a tweet from X (news accounts and Saudi voices), not an article — treat likes/retweets as a signal of what the country is talking about, and quote Saudi voices by handle when their post is the story. Rules: items: 8 to 10, at least 3 from Saudi Arabia if the headlines contain any, exactly one or two 'critical'. also: 25 to 40 lines, at least half Saudi, no duplicates of items, cover Saudi Arabia, Sport, Society, Markets, Gulf, World. trending: explain up to 10 real trends, skip promo/follow-spam. Every "n" must be a number from the list. Never invent facts not in the headlines. No markdown.`;

function briefUserMessage(headlines, trends) {
  return 'Riyadh date: ' + briefRiyadhDate() + (trends && trends.length ? '\nSAUDI X TRENDS RIGHT NOW: ' + trends.join(' · ') : '') + '\nHEADLINES:\n' + briefHeadlineList(headlines);
}
function briefHeadlineList(headlines) {
  const ageH = ts => Math.max(0, Math.round((Date.now() / 1000 - ts) / 3600));
  return headlines.map((h, i) => `[${i + 1}] (${h.src}${h.cat === 'VOICE' ? ' · Saudi voice' : ''}, ${ageH(h.publishedAt)}h ago${h.corroboration > 1 ? ', ' + h.corroboration + ' accounts' : ''}${(h.likes || h.rts) ? ', ' + (h.likes || 0) + '♥ ' + (h.rts || 0) + '↻' : ''}) ${h.title}`).join('\n');
}
function briefParseJSON(text) {
  try { return JSON.parse(String(text || '').replace(/```json|```/g, '').trim()); }
  catch { throw Object.assign(new Error('model returned non-JSON'), { code: 502 }); }
}
async function briefCallGroq(headlines, trends, key) {
  const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 40000);
  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST', signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile', temperature: 0.2, max_tokens: 6000,
        response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: BRIEF_SYSTEM }, { role: 'user', content: briefUserMessage(headlines, trends) }],
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error('groq: ' + (j.error && j.error.message ? j.error.message : r.status)), { code: 502 });
    const text = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
    return { parsed: briefParseJSON(text), usage: j.usage ? (j.usage.total_tokens || null) : null, model: 'groq/' + (j.model || 'llama-3.3-70b-versatile') };
  } finally { clearTimeout(timer); }
}
const BRIEF_GEMINI_MODELS = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-2.5-flash'];
async function briefCallGemini(headlines, trends, key) {
  let lastErr = null;
  for (const model of BRIEF_GEMINI_MODELS) {
    const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 45000);
    try {
      const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent', {
        method: 'POST', signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: BRIEF_SYSTEM }] },
          contents: [{ role: 'user', parts: [{ text: briefUserMessage(headlines, trends) }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 9000, responseMimeType: 'application/json' },
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        lastErr = Object.assign(new Error('gemini ' + model + ': ' + (j.error && j.error.message ? j.error.message : r.status)), { code: 502 });
        if (r.status === 404 || r.status === 400) continue; // model not available on this key -> try next
        throw lastErr;
      }
      const text = j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts && j.candidates[0].content.parts.map(p => p.text || '').join('');
      return { parsed: briefParseJSON(text), usage: j.usageMetadata ? (j.usageMetadata.totalTokenCount || null) : null, model: 'gemini/' + model };
    } finally { clearTimeout(timer); }
  }
  throw lastErr || Object.assign(new Error('gemini: no model available'), { code: 502 });
}
// Engine order: Groq free tier if configured, else Gemini free tier. Both SAR 0. No other engine is ever called.
async function briefCallModel(headlines, trends) {
  if (process.env.GROQ_API_KEY) return briefCallGroq(headlines, trends, process.env.GROQ_API_KEY);
  if (process.env.GEMINI_API_KEY) return briefCallGemini(headlines, trends, process.env.GEMINI_API_KEY);
  throw Object.assign(new Error('no free engine configured (GROQ_API_KEY or GEMINI_API_KEY)'), { code: 500 });
}
function briefValidate(parsed, headlines) {
  if (!parsed || !Array.isArray(parsed.items) || parsed.items.length < 3) throw Object.assign(new Error('brief: too few items'), { code: 502 });
  const seen = new Set(); const items = [];
  for (const it of parsed.items) {
    const n = Number(it.n); const h = headlines[n - 1];
    if (!h || seen.has(n)) continue; seen.add(n);
    const tier = BRIEF_TIERS.has(String(it.tier).toLowerCase()) ? String(it.tier).toLowerCase() : 'watch';
    const section = BRIEF_SECTIONS.includes(it.section) ? it.section : (h.cat === 'KSA' || h.cat === 'VOICE' ? 'Saudi Arabia' : h.cat === 'OIL' || h.cat === 'GULF' ? 'Gulf & Oil' : h.cat === 'SPORT' ? 'Sport' : h.cat === 'MARKETS' ? 'Markets' : h.cat === 'TECH' ? 'Tech & AI' : h.cat === 'MOTOR' ? 'Motorsport' : 'World');
    items.push({ rank: items.length + 1, tier, section, title: String(it.title || h.title).slice(0, 140), what: String(it.what || '').slice(0, 400), why: String(it.why || '').slice(0, 400), url: h.url, source: h.src, publishedAt: h.publishedAt });
    if (items.length >= 10) break;
  }
  if (items.length < 3) throw Object.assign(new Error('brief: items did not map to headlines'), { code: 502 });
  const order = { critical: 0, high: 1, watch: 2 };
  items.sort((a, b) => order[a.tier] - order[b.tier]).forEach((it, i) => { it.rank = i + 1; });
  const also = [];
  for (const a of (Array.isArray(parsed.also) ? parsed.also : [])) {
    const n = Number(a.n); const h = headlines[n - 1];
    if (!h || seen.has(n)) continue; seen.add(n);
    const section = BRIEF_SECTIONS.includes(a.section) ? a.section : (h.cat === 'KSA' || h.cat === 'VOICE' ? 'Saudi Arabia' : h.cat === 'SPORT' ? 'Sport' : h.cat === 'OIL' || h.cat === 'GULF' ? 'Gulf & Oil' : h.cat === 'MARKETS' ? 'Markets' : h.cat === 'TECH' ? 'Tech & AI' : h.cat === 'MOTOR' ? 'Motorsport' : 'World');
    also.push({ section, line: String(a.line || h.title).slice(0, 220), url: h.url, source: h.src, publishedAt: h.publishedAt });
    if (also.length >= 45) break;
  }
  const trending = (Array.isArray(parsed.trending) ? parsed.trending : []).filter(t => t && t.topic).slice(0, 12).map(t => ({ topic: String(t.topic).slice(0, 80), what: String(t.what || '').slice(0, 160) }));
  return { headline: String(parsed.headline || '').slice(0, 300), items, also, trending, bottomLine: String(parsed.bottomLine || '').slice(0, 500) };
}
async function handleBrief(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const date = briefRiyadhDate(); const key = 'brief:' + date;
  const build = String(req.query.build || '') === '1', force = String(req.query.force || '') === '1';
  try {
    if (req.query.probe) { // read-only diagnostic: can this server reach X for one handle?
      const h = String(req.query.probe).replace(/^@/, '').slice(0, 15); const t0 = Date.now();
      try { const r = await fetch(BRIEF_X_SYNDICATION + encodeURIComponent(h), { headers: { 'User-Agent': BRIEF_X_UA, 'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8' } }); const txt = await r.text();
        return res.status(200).json({ ok: true, handle: h, status: r.status, ms: Date.now() - t0, tweets: (txt.match(/"full_text"/g) || []).length, retryAfter: r.headers.get('retry-after') || null, cf: r.headers.get('server') || null });
      } catch (e) { return res.status(200).json({ ok: false, handle: h, error: e.message }); }
    }
    if (String(req.query.resetcap || '') === '1') {
      const editCode = process.env.BRIEF_EDIT_CODE || process.env.DEPLOY_SECRET;
      if (!editCode || String(req.query.code || '') !== editCode) return res.status(401).json({ ok: false, error: 'bad code' });
      await call(['DEL', 'brief:builds:' + date]); return res.status(200).json({ ok: true, reset: true, date });
    }
    if (String(req.query.accounts || '') === '1') {
      if (req.query.add || req.query.remove) {
        const editCode = process.env.BRIEF_EDIT_CODE || process.env.DEPLOY_SECRET; if (!editCode || String(req.query.code || '') !== editCode) return res.status(401).json({ ok: false, error: 'bad code' });
        const cur = (await kvGet('brief:accounts')) || [];
        const list = Array.isArray(cur) ? cur : [];
        const norm = h => String(h).replace(/^@/, '').trim().toLowerCase();
        if (req.query.add) { const h = norm(req.query.add); if (h && /^[a-z0-9_]{1,15}$/.test(h)) { const i = list.findIndex(a => norm(a.handle) === h); const entry = { handle: h, cat: String(req.query.cat || 'VOICE').toUpperCase() }; if (i >= 0) list[i] = entry; else list.push(entry); } }
        if (req.query.remove) { const h = norm(req.query.remove); const i = list.findIndex(a => norm(a.handle) === h); if (i >= 0) list.splice(i, 1); if (BRIEF_X_DEFAULT.some(a => norm(a.handle) === h)) list.push({ handle: h, remove: true }); }
        await kvSet('brief:accounts', list, 0);
      }
      const accounts = await briefAccounts();
      return res.status(200).json({ ok: true, accounts: accounts.map(a => ({ handle: a.handle, cat: a.cat, isDefault: BRIEF_X_DEFAULT.some(d => d.handle.toLowerCase() === a.handle.toLowerCase()) })), editable: !!(process.env.BRIEF_EDIT_CODE || process.env.DEPLOY_SECRET) });
    }
    const cached = await kvGet(key);
    if (cached && !(build && force)) return res.status(200).json({ ok: true, cached: true, brief: cached });
    if (!build) return res.status(200).json({ ok: true, cached: false, date, cost: 'Free · SAR 0' });
    const n = await call(['INCR', 'brief:builds:' + date]); await call(['EXPIRE', 'brief:builds:' + date, '172800']);
    if (Number(n) > BRIEF_DAILY_CAP) return res.status(429).json({ ok: false, error: 'daily build cap reached (' + BRIEF_DAILY_CAP + ')' });
    const { headlines, okSrc, failed, trends } = await briefCollect();
    if (headlines.length < 8) return res.status(503).json({ ok: false, error: 'only ' + headlines.length + ' headlines collected', sources: { ok: okSrc, failed } });
    const { parsed, usage, model } = await briefCallModel(headlines, trends);
    const v = briefValidate(parsed, headlines);
    const brief = { date, generatedAt: Date.now(), headline: v.headline, items: v.items, also: v.also, trending: v.trending, trendsSeen: trends.length, bottomLine: v.bottomLine, headlinesSeen: headlines.length, sources: { ok: okSrc, failed }, engine: model, tokens: usage, costSAR: 0 };
    await kvSet(key, brief, 36 * 3600);
    return res.status(200).json({ ok: true, cached: false, built: true, brief });
  } catch (e) {
    console.error('brief error:', e.message);
    return res.status(e.code || 500).json({ ok: false, error: e.message });
  }
}
// ==== END BRIEF ====

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.query && req.query.brief) return handleBrief(req, res);
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