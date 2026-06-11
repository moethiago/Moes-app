
// ==== INLINED SHARED CODE (was lib/) ====

// ---- cache.js ----
// ============================================================
// cache.js — KV-backed cache wrapper for external API calls
// Use this to wrap ANY upstream API call.
// ============================================================

const URL =
  process.env.KV_REST_API_URL ||
  process.env.UPSTASH_REDIS_REST_URL;

const TOKEN =
  process.env.KV_REST_API_TOKEN ||
  process.env.UPSTASH_REDIS_REST_TOKEN;

// ---- raw KV ops (duplicated here so this file is self-contained) ----
async function kvGetRaw(key) {
  if (!URL || !TOKEN) return null;
  try {
    const res = await fetch(URL + '/get/' + encodeURIComponent(key), {
      headers: { 'Authorization': 'Bearer ' + TOKEN }
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.result;
  } catch { return null; }
}

async function kvSetRaw(key, value, ttlSeconds) {
  if (!URL || !TOKEN) return;
  try {
    await fetch(URL, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify(['SET', key, value, 'EX', String(ttlSeconds)])
    });
  } catch {}
}

/**
 * Wrap an async upstream fetcher with KV caching.
 *
 * @param {string}   cacheKey   - unique key, e.g. "cache:football:epl"
 * @param {number}   ttlSeconds - how long to cache (30 = live scores, 3600 = standings)
 * @param {function} fetcher    - async () => data ; called on cache miss
 * @returns {Promise<{data, fromCache, ageSeconds}>}
 */
async function cached(cacheKey, ttlSeconds, fetcher) {
  // 1. Try cache
  const raw = await kvGetRaw(cacheKey);
  if (raw) {
    try {
      const obj = JSON.parse(raw);
      const age = Math.floor(Date.now() / 1000) - (obj._cachedAt || 0);
      return { data: obj.data, fromCache: true, ageSeconds: age };
    } catch {}
  }

  // 2. Cache miss → call upstream
  const data = await fetcher();

  // 3. Store in cache (best-effort, don't fail the request if KV write fails)
  if (data !== null && data !== undefined) {
    kvSetRaw(cacheKey, JSON.stringify({
      _cachedAt: Math.floor(Date.now() / 1000),
      data
    }), ttlSeconds).catch(() => {});
  }

  return { data, fromCache: false, ageSeconds: 0 };
}

/**
 * Manually invalidate a cache key (e.g. when a session ends).
 */
async function invalidate(cacheKey) {
  if (!URL || !TOKEN) return;
  try {
    await fetch(URL, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify(['DEL', cacheKey])
    });
  } catch {}
}

// Standard TTLs (seconds) by data type — use these so we stay consistent
const TTL = {
  LIVE_SCORES:      30,     // live football matches
  UPCOMING_MATCHES: 600,    // 10 min for upcoming fixtures
  STANDINGS:        3600,   // 1 hour for league tables
  F1_LIVE:          5,      // active F1 session
  F1_RESULTS:       86400,  // session is over, results never change
  F1_CALENDAR:      86400,  // 24 hours
  F1_STANDINGS:     3600,   // 1 hour
  WORLD_CUP:        21600,  // 6 hours
};


// ---- leagues.js ----
// ============================================================
// leagues.js — API-Football league IDs + current season
// Edit season here once per year (single source of truth)
// ============================================================

// API-Football labels a season by the YEAR IT STARTS. The 2025-26
// European season is "2025". The backend automatically falls forward to
// SEASON+1 for upcoming fixtures once the new season is scheduled, so this
// only needs bumping when a whole new cycle is fully under way.
const SEASON = 2025;

const LEAGUES = {
  epl:        { id: 39,  season: SEASON },
  laliga:     { id: 140, season: SEASON },
  seriea:     { id: 135, season: SEASON },
  bundesliga: { id: 78,  season: SEASON },
  ligue1:     { id: 61,  season: SEASON },
  ucl:        { id: 2,   season: SEASON },
  spl:        { id: 307, season: SEASON },
  nations:    { id: 5,   season: SEASON },
  worldcup:   { id: 1,   season: SEASON },
};

// ==== END INLINED ====

// ============================================================
// api/football.js — football scores, FREE-TIER BUDGET SAFE
//
// Request budget strategy (API-Football free = 100 req/day):
//  - ?league=X          → schedule + upcoming. Cached 6 HOURS.
//                         (schedules don't change; scores come from live)
//  - ?type=live         → ONE upstream call (fixtures?live=all) for ALL
//                         leagues at once. Cached 60s. This is the only
//                         endpoint the frontend polls.
//  - ?type=standings    → cached 6 hours
//  - ?type=topscorers   → cached 12 hours
//
// Worst case daily upstream usage: ~8 schedule + ~8 standings
// + live polling (1/min only while matches are live) ≈ 60-80/day. Fits.
// ============================================================



const TTL_SCHEDULE  = 6 * 3600;   // 6h  — today's fixture list (times/teams)
const TTL_LIVE      = 60;         // 60s — live scores (shared by all users)
const TTL_STANDINGS = 6 * 3600;   // 6h
const TTL_SCORERS   = 12 * 3600;  // 12h

// league id → our league key (for tagging live matches)
const ID_TO_KEY = {};
Object.keys(LEAGUES).forEach(k => { ID_TO_KEY[LEAGUES[k].id] = k; });

async function fetchFromAPI(path, apiKey) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`https://v3.football.api-sports.io${path}`, {
      headers: {
        'x-apisports-key': apiKey,
        'x-rapidapi-host': 'v3.football.api-sports.io',
      },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error('API error ' + res.status);
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

function simplifyFixture(f) {
  return {
    id:        f.fixture.id,
    leagueId:  f.league ? f.league.id : null,
    leagueKey: f.league ? (ID_TO_KEY[f.league.id] || null) : null,
    status:    f.fixture.status.short,
    elapsed:   f.fixture.status.elapsed,
    time:      f.fixture.date,
    home:      f.teams.home.name,
    homeLogo:  f.teams.home.logo,
    homeScore: f.goals.home,
    away:      f.teams.away.name,
    awayLogo:  f.teams.away.logo,
    awayScore: f.goals.away,
  };
}

function simplifyStanding(s) {
  return {
    rank: s.rank, team: s.team.name, logo: s.team.logo,
    played: s.all.played, win: s.all.win, draw: s.all.draw, lose: s.all.lose,
    gd: s.goalsDiff, points: s.points, form: s.form,
  };
}

function simplifyScorer(p) {
  var stat = (p.statistics && p.statistics[0]) || {};
  return {
    name: p.player.name, photo: p.player.photo,
    team: stat.team ? stat.team.name : '',
    goals: stat.goals ? stat.goals.total : 0,
    assists: stat.goals ? stat.goals.assists : 0,
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey) return res.status(500).json({ error: 'No API key' });

  const league = req.query.league || 'epl';
  const type   = req.query.type || 'fixtures';
  const today  = new Date().toISOString().split('T')[0];

  try {
    // ── LIVE: one upstream call for ALL of today's matches ─────────────
    // /fixtures?date=today returns live + finished + upcoming for the whole
    // world in ONE request. We filter to tracked leagues. This means scores
    // of finished matches update too (live=all would miss them).
    if (type === 'live') {
      const { data, fromCache, ageSeconds } = await cached(
        'cache:football:today-all:' + today,
        150, // 2.5 min — frontend polls every 2 min, server dedupes
        async () => {
          const ld = await fetchFromAPI(`/fixtures?date=${today}&timezone=Asia/Riyadh`, apiKey);
          const all = (ld.response || []).map(simplifyFixture)
            .filter(m => m.leagueKey); // only leagues we track (incl. worldcup)
          const liveStatuses = ['1H','2H','HT','ET','BT','P','LIVE'];
          return {
            live:     all.filter(m => liveStatuses.includes(m.status)),
            finished: all.filter(m => ['FT','AET','PEN'].includes(m.status)),
            today:    all,
            fetchedAt: Date.now(),
          };
        }
      );
      res.setHeader('X-Cache', fromCache ? 'HIT-' + ageSeconds + 's' : 'MISS');
      res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=180');
      return res.status(200).json(data);
    }

    const cfg = LEAGUES[league];
    if (!cfg) return res.status(400).json({ error: 'Unknown league' });

    // ── STANDINGS ───────────────────────────────────────────────────────
    if (type === 'standings') {
      const { data, fromCache, ageSeconds } = await cached(
        'cache:football:standings:' + league,
        TTL_STANDINGS,
        async () => {
          let sd = await fetchFromAPI(`/standings?league=${cfg.id}&season=${cfg.season}`, apiKey);
          let resp = sd.response && sd.response[0];
          let groups = (resp && resp.league && resp.league.standings) || [];
          if (!groups.length) {
            sd = await fetchFromAPI(`/standings?league=${cfg.id}&season=${cfg.season + 1}`, apiKey);
            resp = sd.response && sd.response[0];
            groups = (resp && resp.league && resp.league.standings) || [];
          }
          const table = (groups[0] || []).map(simplifyStanding);
          return { league, standings: table, fetchedAt: Date.now() };
        }
      );
      res.setHeader('X-Cache', fromCache ? 'HIT-' + ageSeconds + 's' : 'MISS');
      return res.status(200).json(data);
    }

    // ── TOP SCORERS ─────────────────────────────────────────────────────
    if (type === 'topscorers') {
      const { data, fromCache, ageSeconds } = await cached(
        'cache:football:scorers:' + league,
        TTL_SCORERS,
        async () => {
          const ps = await fetchFromAPI(`/players/topscorers?league=${cfg.id}&season=${cfg.season}`, apiKey);
          const scorers = (ps.response || []).slice(0, 10).map(simplifyScorer);
          return { league, scorers, fetchedAt: Date.now() };
        }
      );
      res.setHeader('X-Cache', fromCache ? 'HIT-' + ageSeconds + 's' : 'MISS');
      return res.status(200).json(data);
    }

    // ── FIXTURES (schedule) — cached 6h, scores overlaid from live ──────
    const { data, fromCache, ageSeconds } = await cached(
      'cache:football:sched:' + league + ':' + today,
      TTL_SCHEDULE,
      async () => {
        const todayData = await fetchFromAPI(
          `/fixtures?league=${cfg.id}&season=${cfg.season}&date=${today}&timezone=Asia/Riyadh`,
          apiKey
        );
        const fixtures = (todayData.response || []).map(simplifyFixture);

        let upcoming = [];
        try {
          const upcomingData = await fetchFromAPI(
            `/fixtures?league=${cfg.id}&season=${cfg.season}&next=10&timezone=Asia/Riyadh`,
            apiKey
          );
          upcoming = (upcomingData.response || []).map(simplifyFixture);
        } catch (e) { /* upcoming optional */ }

        return { league, fixtures, upcoming, fetchedAt: Date.now() };
      }
    );
    res.setHeader('X-Cache', fromCache ? 'HIT-' + ageSeconds + 's' : 'MISS');
    return res.status(200).json(data);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
