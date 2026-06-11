
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


// ---- ingest-core.js ----
// ============================================================
// ingest-core.js — RSS parsing + content hash
// ============================================================


const STOP_WORDS = new Set([
  'the','and','for','with','this','that','from','news','about','has','have','are','was','were',
  'will','would','should','could','their','they','them','says','said','after','before','into','over',
  'as','to','of','in','on','at','by','an','a','is','it','be','or','but','not','our','his','her','its'
]);

// Normalise title and produce stable hash — used as story ID
function storyId(title) {
  const normalized = title
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g,' ')
    .split(' ')
    .filter(w => w.length > 2 && !STOP_WORDS.has(w))
    .sort()
    .join(' ');
  return crypto.createHash('sha1').update(normalized).digest('hex').slice(0, 12);
}

function extractTag(xml, tag) {
  const match = xml.match(new RegExp('<' + tag + '[^>]*>([\\s\\S]*?)<\\/' + tag + '>', 'i'));
  return match ? match[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1').trim() : '';
}

function decodeEntities(s) {
  return (s || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+-\s+[^-]+$/, '')  // drop trailing " - Source Name"
    .trim();
}

function parseRSS(xml, sourceCat, sourceUrl, maxAgeHours) {
  const now = Date.now();
  const maxAge = maxAgeHours * 3600 * 1000;
  const items = xml.match(/<(item|entry)[^>]*>[\s\S]*?<\/\1>/gi) || [];
  const results = [];

  for (const item of items.slice(0, 20)) {
    let title = decodeEntities(extractTag(item, 'title'));
    let link  = extractTag(item, 'link');
    if (!link) {
      const m = item.match(/<link[^>]*href="([^"]+)"/i);
      if (m) link = m[1];
    }
    const pub = extractTag(item, 'pubDate') ||
                extractTag(item, 'published') ||
                extractTag(item, 'updated');

    if (!title || title.length < 12 || !link || !pub) continue;
    const d = new Date(pub);
    if (isNaN(d.getTime())) continue;
    const ts = d.getTime();
    if (now - ts > maxAge) continue;
    if (ts > now + 3600 * 1000) continue; // future-dated junk

    results.push({
      title,
      url: link,
      sourceUrl,
      sourceCat,
      publishedAt: Math.floor(ts / 1000),
    });
  }
  return results;
}

async function fetchSource(src, maxAgeHours) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    const res = await fetch(src.url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MoesApp/3.0)' },
    });
    clearTimeout(timer);
    if (!res.ok) return [];
    const xml = await res.text();
    return parseRSS(xml, src.cat, src.url, maxAgeHours);
  } catch (e) {
    return [];
  }
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

// ---- twitter-core.js ----
// ============================================================
// twitter-core.js — pulls recent tweets from a curated list of
// breaking-news accounts via TwitterAPI.io, mapped to the standard
// story shape {title,url,sourceUrl,sourceCat,publishedAt}.
// Needs TWITTERAPI_IO_KEY env var. No-ops cleanly if absent.
// Cost: ~$0.15 / 1000 tweets, monitored every 2h. ~$1-3/month.
// ============================================================

var TWITTERAPI_BASE = 'https://api.twitterapi.io';

// Pull the latest tweets for one account.
async function fetchAccountTweets(account, apiKey, maxAgeHours) {
  try {
    var ctrl = new AbortController();
    var timer = setTimeout(function(){ ctrl.abort(); }, 9000);
    // last_tweets endpoint: recent tweets for a handle
    var url = TWITTERAPI_BASE + '/twitter/user/last_tweets?userName=' + encodeURIComponent(account.handle);
    var res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'X-API-Key': apiKey },
    });
    clearTimeout(timer);
    if (!res.ok) return [];
    var data = await res.json();
    // Response shapes vary: {tweets:[...]} or {data:{tweets:[...]}} or {data:[...]}
    var tweets = [];
    if (Array.isArray(data.tweets)) tweets = data.tweets;
    else if (data.data && Array.isArray(data.data.tweets)) tweets = data.data.tweets;
    else if (Array.isArray(data.data)) tweets = data.data;
    var now = Date.now();
    var maxAge = (maxAgeHours || 12) * 3600 * 1000;
    var out = [];
    tweets.slice(0, 10).forEach(function(t){
      var text = t.text || t.full_text || '';
      // skip replies and pure retweets (low original-signal)
      if (!text || text.length < 20) return;
      if (text.indexOf('RT @') === 0) return;
      if (t.isReply || t.in_reply_to_status_id) return;
      var created = t.createdAt || t.created_at;
      var ts = created ? Date.parse(created) : now;
      if (isNaN(ts)) ts = now;
      if (now - ts > maxAge) return;
      // first line / trimmed text as the headline
      var title = text.split('\n')[0].replace(/https?:\/\/\S+/g, '').trim();
      if (title.length < 15) return;
      var id = t.id || t.id_str || '';
      out.push({
        title: title,
        url: 'https://x.com/' + account.handle + (id ? '/status/' + id : ''),
        sourceUrl: 'x.com/' + account.handle,
        sourceCat: account.cat,
        publishedAt: Math.floor(ts / 1000),
      });
    });
    return out;
  } catch (e) {
    return [];
  }
}

// Pull all curated accounts. Returns combined story list.
async function fetchTwitterAccounts(accounts, apiKey, maxAgeHours) {
  if (!apiKey || !accounts || !accounts.length) return [];
  var all = [];
  for (var i = 0; i < accounts.length; i++) {
    var rows = await fetchAccountTweets(accounts[i], apiKey, maxAgeHours);
    all = all.concat(rows);
  }
  return all;
}
// ==== END INLINED ====

// ============================================================
// api/ingest.js — pulls trusted RSS, writes new stories to KV
// NO Claude calls. Safe to run every 30 minutes.
// ============================================================






// Allow up to 60s (Vercel default is 10s). Ingest does many network calls.
export const config = { maxDuration: 60 };


const INGEST_MAX_AGE_H = 18;
const STORY_TTL        = 48 * 3600; // 48h TTL on each story

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const started = Date.now();

  if (!kvReady()) return res.status(500).json({ error: 'KV not configured' });

  try {
    // 1. Pull every trusted RSS source in parallel
    const rssItems = (
      await Promise.all(TRUSTED_SOURCES.map(s => fetchSource(s, INGEST_MAX_AGE_H)))
    ).flat();

    // 1b. Pull curated breaking-news Twitter/X accounts (TwitterAPI.io).
    //     No-ops cleanly if TWITTERAPI_IO_KEY isn't set.
    let twitterItems = [];
    try {
      twitterItems = await fetchTwitterAccounts(
        TWITTER_ACCOUNTS, process.env.TWITTERAPI_IO_KEY, INGEST_MAX_AGE_H
      );
    } catch (e) { /* twitter optional */ }

    const allItems = rssItems.concat(twitterItems);

    if (!allItems.length) {
      return res.status(200).json({ ok: true, phase: 'ingest', ingested: 0, candidates: 0 });
    }

    // 2. Re-categorise (e.g. bundesliga story about Bayern -> BAYERN)
    const categorised = allItems
      .map(it => {
        const cat = assignCategory(it.title, it.sourceCat);
        return cat ? { ...it, cat } : null;
      })
      .filter(Boolean);

    // 3. Dedup within this batch by storyId
    const seen = new Map();
    for (const it of categorised) {
      const id = storyId(it.title);
      if (!seen.has(id)) seen.set(id, { ...it, id });
    }
    const batch = Array.from(seen.values());

    console.log('Total candidates after dedup:', batch.length);

    // 4. Batch-check existence in PARALLEL (was sequential — caused timeouts)
    const now = Math.floor(Date.now() / 1000);
    let ingested = 0;
    let requeued = 0;
    const ingestedPerCat = {};

    const existResults = await Promise.all(
      batch.map(it => kvCall(['GET', 'story:' + it.id]).catch(() => null))
    );

    const newOnes = [];
    const requeueOps = [];
    for (let i = 0; i < batch.length; i++) {
      const it = batch[i];
      const existing = existResults[i];
      if (existing !== null && existing !== undefined) {
        // exists — re-queue if it's still unscored so it can't get orphaned
        try {
          const obj = typeof existing === 'string' ? JSON.parse(existing) : existing;
          if (obj && (obj.score === null || obj.score === undefined)) {
            requeueOps.push(['ZADD', 'cat:' + obj.cat, String(obj.publishedAt || it.publishedAt), obj.id]);
            requeueOps.push(['SADD', 'unscored:' + obj.cat, obj.id]);
            requeued++;
          }
        } catch (e) {}
        continue;
      }
      newOnes.push(it);
    }

    // Hobby-tier functions are killed at ~10s. Embedding is the slow part,
    // so cap how many NEW stories we process per run; the rest are caught
    // on the next cron cycle (every 30 min). Freshest first.
    const MAX_NEW_PER_RUN = 25;
    newOnes.sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0));
    const deferred = Math.max(0, newOnes.length - MAX_NEW_PER_RUN);
    const toProcess = newOnes.slice(0, MAX_NEW_PER_RUN);

    // Embed all NEW stories in PARALLEL (the slow part — was one-by-one)
    const embeddings = await Promise.all(
      toProcess.map(it =>
        embedText(it.title, process.env.GEMINI_API_KEY).catch(() => null)
      )
    );

    // Build all writes, then fire them together
    const writeOps = [...requeueOps];
    const setPromises = [];
    for (let i = 0; i < toProcess.length; i++) {
      const it = toProcess[i];
      const storyObj = {
        id: it.id, title: it.title, url: it.url, sourceUrl: it.sourceUrl,
        cat: it.cat, publishedAt: it.publishedAt, firstSeenAt: now,
        score: null, rewritten: null, embedding: embeddings[i],
      };
      setPromises.push(kvSet('story:' + it.id, storyObj, STORY_TTL));
      writeOps.push(['ZADD', 'cat:' + it.cat, String(it.publishedAt), it.id]);
      writeOps.push(['SADD', 'unscored:' + it.cat, it.id]);
      ingested++;
      ingestedPerCat[it.cat] = (ingestedPerCat[it.cat] || 0) + 1;
    }
    await Promise.all(setPromises);
    // fire index + queue ops in parallel batches
    await Promise.all(writeOps.map(op => kvCall(op).catch(() => null)));

    // 5. Trim old stories from sorted sets (older than 48h, matching story TTL)
    const cutoff = now - 48 * 3600;
    for (const cat of CATEGORIES) {
      await kvCall(['ZREMRANGEBYSCORE', 'cat:' + cat, '-inf', String(cutoff)]);
    }

    // 6. Log the run
    await logRun({
      phase:      'ingest',
      ingested,
      requeued,
      deferred,
      candidates: batch.length,
      perCat:     ingestedPerCat,
      durationMs: Date.now() - started,
    });

    return res.status(200).json({
      ok:         true,
      phase:      'ingest',
      ingested,
      requeued,
      deferred,
      candidates: batch.length,
      perCat:     ingestedPerCat,
      durationMs: Date.now() - started,
    });

  } catch (e) {
    console.error('ingest error:', e.message, e.stack);
    return res.status(500).json({ error: e.message });
  }
}

// Direct KV call (bypasses the pipeline wrapper)
async function kvCall(command) {
  const URL   = process.env.KV_REST_API_URL   || process.env.UPSTASH_REDIS_REST_URL;
  const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!URL || !TOKEN) throw new Error('KV not configured');
  const res = await fetch(URL, {
    method:  'POST',
    headers: { 'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body:    JSON.stringify(command),
  });
  if (!res.ok) throw new Error('KV error ' + res.status);
  const data = await res.json();
  return data.result;
}

async function logRun(entry) {
  try {
    const URL   = process.env.KV_REST_API_URL   || process.env.UPSTASH_REDIS_REST_URL;
    const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!URL || !TOKEN) return;
    entry.ts = Math.floor(Date.now() / 1000);
    await fetch(URL, {
      method:  'POST',
      headers: { 'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
      body:    JSON.stringify(['LPUSH', 'runs', JSON.stringify(entry)]),
    });
    await fetch(URL, {
      method:  'POST',
      headers: { 'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
      body:    JSON.stringify(['LTRIM', 'runs', '0', '99']),
    });
  } catch (e) {}
}