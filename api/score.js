
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


// ---- score-core.js ----
// ============================================================
// score-core.js — Claude editorial scoring
// Philosophy: judge the EVENT, not the wording. A real confirmed
// development passes even if the headline hedges ("could", "set to").
// Reject only genuine speculation, opinion, and clickbait.
// ============================================================

const NOW_STR = () => new Date().toUTCString();

const COMMON_RULES = `
PROCESS — follow this ORDER for every candidate (critical):
STEP 1 — REWRITE FIRST. Before judging, rewrite the headline into an objective, factual news-wire version. Strip clickbait, hype, emotional verbs, and vague hooks. Expose the REAL subject the original may be hiding. Translate any Arabic to English. Use ONLY facts present in the headline/source — never invent names, numbers, or outcomes.
STEP 2 — THEN SCORE the REWRITTEN version (not the original). Judge whether the clean, factual story describes real news. This prevents good stories from being rejected just because their original headline was baity.
STEP 3 — KEEP or REJECT based on the rewrite.

REWRITING RULES:
- Remove emotional/sensational verbs: "slams","destroys","blasts","shocking","devastating","erupts","breaks silence","in tears". State the plain action instead.
- Un-hide vague hooks: "one insider says X" -> state X directly; "this changes everything" -> state what changed. If you cannot identify the real subject from the text, the rewrite is impossible -> REJECT.
- Convert questions to statements only if the answer is in the text; otherwise REJECT.

REJECT (score 0) AFTER attempting the rewrite if:
- The rewritten story has no clear WHO / WHAT / WHEN — i.e. no concrete, named, verifiable development.
- It is a personal anecdote with no hard news ("how I quit my job"), an opinion/column, a rating/ranking listicle, or a "fans react" piece.
- The only content was the hook itself and nothing factual remains after stripping it.

SCORING the clean rewrite:
- Approve any genuine, concrete development from a trusted source: results, signings, sackings, injuries, official statements, confirmed talks, real reporting with a named subject. Hedge words ("could","set to","in talks") are fine if the event is real.
- A candidate whose source begins with "x.com/" is a tweet from a TRUSTED curated account. Still rewrite it the same way and score it; reject only if nothing factual survives the rewrite.
- Be generous with real developments; be strict on fluff that survives rewriting.`;

const PROMPTS = {
  F1: () => `You are the F1 editor. Today is ${NOW_STR()}.${COMMON_RULES}
10 = confirmed driver signing/sacking, race/session result, FIA penalty
8-9 = contract news, team principal/staff change, factory or technical news with substance
6-7 = any concrete F1 development naming a driver/team (result, update, statement, confirmed talks)
0-5 = REJECT: opinion columns, driver rating lists, "fans react", pure clickbait, contentless speculation
For each story that survives: "title" = your objective factual REWRITE (max 12 words), "score" = score of that rewrite. JSON: [{"idx":0,"title":"...","score":8}]. Return [] if nothing survives the rewrite.`,

  FOOTBALL: () => `You are the Football editor. Today is ${NOW_STR()}.${COMMON_RULES}
Top 5 European leagues + Champions League focus.
10 = title decided, major sacking, transfer with fee confirmed
8-9 = transfer/loan with player+club named, ban, big match result, managerial change
6-7 = any concrete development naming a club/player (result, injury, lineup, confirmed talks, official statement)
0-5 = REJECT: opinion/columns, player rating lists, "fans react", pure clickbait, vague rumour with no named subject
For each story that survives: "title" = your objective factual REWRITE (max 12 words), "score" = score of that rewrite. JSON: [{"idx":0,"title":"...","score":8}]. Return [] if nothing survives the rewrite.`,

  BAYERN: () => `You are the Bayern Munich editor. Today is ${NOW_STR()}.${COMMON_RULES}
MUST relate to FC Bayern Munich men's first team.
10 = transfer with fee, manager sacked/appointed
8-9 = injury with timeline, big match result, contract confirmed
6-7 = any concrete Bayern first-team development (result, lineup, statement, confirmed talks)
0-5 = REJECT: women's team, U19/youth, Germany NT-only stories, opinion, clickbait
For each story that survives: "title" = your objective factual REWRITE (max 12 words), "score" = score of that rewrite. JSON: [{"idx":0,"title":"...","score":8}]. Return [] if nothing survives the rewrite.`,

  SPL: () => `You are the Saudi Pro League editor. Today is ${NOW_STR()}.${COMMON_RULES}
Some headlines arrive in Arabic — TRANSLATE them and write the "title" in clear English. Judge them by the same bar as English ones; do NOT reject a story just because it was Arabic.
10 = title clinched, major signing confirmed
8-9 = result with title impact naming Al Hilal/Nassr/Ittihad/Ahli, sacking
6-7 = any concrete development naming a specific SPL club (result, signing, statement, confirmed talks)
0-5 = REJECT: opinion, clickbait, stories not naming a specific SPL team
For each story that survives: "title" = your objective factual English REWRITE (max 12 words), "score" = score of that rewrite. JSON: [{"idx":0,"title":"...","score":8}]. Return [] if nothing survives the rewrite.`,

  KSA: () => `You are the Saudi Arabia editor (economy, PIF, Vision 2030). Today is ${NOW_STR()}.${COMMON_RULES}
Some headlines arrive in Arabic — TRANSLATE them and write the "title" in clear English. Judge them by the same bar as English ones; do NOT reject a story just because it was Arabic.
10 = multi-billion deal with figures, major royal decree with economic impact
8-9 = PIF announcement with numbers, Vision 2030 milestone with data
6-7 = any concrete economic/policy development (investment, initiative, deal, official announcement)
0-5 = REJECT: pure opinion, religious/Hajj logistics, fluff tourism pieces with no substance, clickbait
For each story that survives: "title" = your objective factual English REWRITE (max 12 words), "score" = score of that rewrite. JSON: [{"idx":0,"title":"...","score":8}]. Return [] if nothing survives the rewrite.`,
};

async function scoreCategory(items, cat, apiKey) {
  if (!apiKey || !items.length) return { approved: [], cost: 0, inputTokens: 0, outputTokens: 0 };
  const lines = items.map((item, i) => {
    const src = (item.sourceUrl || '').indexOf('x.com/') !== -1 ? ' [source: ' + item.sourceUrl + ']' : '';
    return i + ' | ' + item.title + src;
  }).join('\n');
  const prompt = (PROMPTS[cat] || PROMPTS.FOOTBALL)() + '\n\nCandidates:\n' + lines + '\n\nReturn ONLY valid JSON.';

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 25000);
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      signal: ctrl.signal,
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1200,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    clearTimeout(timer);
    if (!res.ok) return { approved: [], cost: 0, inputTokens: 0, outputTokens: 0 };
    const data = await res.json();

    const inputTokens  = data.usage?.input_tokens  || 0;
    const outputTokens = data.usage?.output_tokens || 0;
    // Haiku 4.5 pricing: $1/MTok input, $5/MTok output (approx)
    const cost = (inputTokens / 1_000_000) * 1 + (outputTokens / 1_000_000) * 5;

    const text  = data.content?.[0]?.text || '';
    const match = text.match(/\[[\s\S]*?\]/);
    if (!match) return { approved: [], cost, inputTokens, outputTokens };

    const scored = JSON.parse(match[0])
      .map(s => {
        const idx = parseInt(s.idx);
        if (isNaN(idx) || !items[idx]) return null;
        return {
          ...items[idx],
          score: s.score,
          rewritten: (s.title && s.title.trim()) || items[idx].title,
        };
      })
      .filter(Boolean)
      // Tweets come from curated, trusted accounts — let them through at a
      // lower bar (>=3). Everything else keeps the normal bar (>=5).
      .filter(s => {
        const isTweet = (s.sourceUrl || '').indexOf('x.com/') !== -1;
        return s.score >= 5;  // same bar for all; rewrite gave each a fair shot
      });

    return { approved: scored, cost, inputTokens, outputTokens };
  } catch (e) {
    return { approved: [], cost: 0, inputTokens: 0, outputTokens: 0 };
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

// ==== END INLINED ====

// ============================================================
// api/score.js — scores unscored stories with Claude in batches
// Run every 2 hours (or trigger manually from diagnostic page)
// ============================================================




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
