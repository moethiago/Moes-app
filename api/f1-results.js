
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

// ==== END INLINED ====

// ============================================================
// api/f1-results.js — F1 session results
// Checks KV cache first. Falls back to OpenF1 if not cached.
// Results survive OpenF1 lockdowns during live sessions.
// ============================================================


const OPENF1_BASE = 'https://api.openf1.org/v1';

function fetchOF1(path, ms) {
  return new Promise(function(resolve) {
    var done  = false;
    var timer = setTimeout(function() { if (!done) { done = true; resolve(null); } }, ms || 10000);
    fetch(OPENF1_BASE + path).then(function(r) {
      if (done) return; done = true; clearTimeout(timer);
      if (!r.ok) { resolve(null); return; }
      r.json().then(function(d) { resolve(d); }).catch(function() { resolve(null); });
    }).catch(function() { if (!done) { done = true; clearTimeout(timer); resolve(null); } });
  });
}

async function resolveSessionKey(targetTimeISO) {
  var sessions = await fetchOF1('/sessions?year=2026', 10000);
  if (!sessions || !sessions.length) return null;
  var target = new Date(targetTimeISO).getTime();
  var TOLERANCE = 12 * 3600 * 1000;
  var best = null; var bestDiff = Infinity;
  sessions.forEach(function(s) {
    if (!s.date_start) return;
    var diff = Math.abs(new Date(s.date_start).getTime() - target);
    if (diff < TOLERANCE && diff < bestDiff) { best = s; bestDiff = diff; }
  });
  return best ? best.session_key : null;
}

async function fetchPracticeOrQuali(sessKey) {
  var laps    = await fetchOF1('/laps?session_key=' + sessKey + '&is_pit_out_lap=false', 12000);
  var drivers = await fetchOF1('/drivers?session_key=' + sessKey, 8000);
  if (!laps || !drivers) return null;
  var driverMap = {};
  drivers.forEach(function(d) { driverMap[d.driver_number] = d; });
  var bestLaps = {};
  laps.forEach(function(l) {
    var n = l.driver_number;
    if (!l.lap_duration || l.lap_duration <= 0) return;
    if (!bestLaps[n] || l.lap_duration < bestLaps[n].lap_duration) bestLaps[n] = l;
  });
  var sorted = Object.values(bestLaps).sort(function(a, b) { return a.lap_duration - b.lap_duration; });
  if (!sorted.length) return null;
  var best = sorted[0].lap_duration;
  return sorted.map(function(l, i) {
    var drv = driverMap[l.driver_number] || {};
    return {
      pos:  i + 1,
      num:  l.driver_number,
      name: drv.last_name || ('Car ' + l.driver_number),
      team: drv.team_name || '',
      time: l.lap_duration,
      gap:  i === 0 ? 0 : parseFloat((l.lap_duration - best).toFixed(3)),
    };
  });
}

async function fetchRaceResults(sessKey) {
  var positions = await fetchOF1('/position?session_key='  + sessKey, 12000);
  var intervals = await fetchOF1('/intervals?session_key=' + sessKey, 12000);
  var drivers   = await fetchOF1('/drivers?session_key='   + sessKey, 8000);
  var laps      = await fetchOF1('/laps?session_key='      + sessKey, 12000);
  if (!positions || !drivers) return null;
  var driverMap = {};
  drivers.forEach(function(d) { driverMap[d.driver_number] = d; });
  var finalPos = {};
  positions.forEach(function(p) {
    var k = p.driver_number;
    if (!finalPos[k] || p.date > finalPos[k].date) finalPos[k] = p;
  });
  var finalInt = {};
  if (intervals) intervals.forEach(function(i) {
    var k = i.driver_number;
    if (!finalInt[k] || i.date > finalInt[k].date) finalInt[k] = i;
  });
  var fastestLap = {};
  if (laps) laps.forEach(function(l) {
    var k = l.driver_number;
    if (!l.lap_duration || l.lap_duration <= 0) return;
    if (!fastestLap[k] || l.lap_duration < fastestLap[k]) fastestLap[k] = l.lap_duration;
  });
  var overallFastest = Object.values(fastestLap).length ? Math.min.apply(null, Object.values(fastestLap)) : 0;
  var sorted = Object.values(finalPos).sort(function(a, b) { return a.position - b.position; });
  if (!sorted.length) return null;
  return sorted.map(function(p) {
    var drv = driverMap[p.driver_number] || {};
    var gap = finalInt[p.driver_number] ? (finalInt[p.driver_number].gap_to_leader || '') : '';
    return {
      pos:        p.position,
      num:        p.driver_number,
      name:       drv.last_name || ('Car ' + p.driver_number),
      team:       drv.team_name || '',
      gap:        p.position === 1 ? 'WIN' : gap,
      fastestLap: fastestLap[p.driver_number] === overallFastest,
    };
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  var round   = req.query.round;
  var session = req.query.session;
  var time    = req.query.time;
  if (!round || !session) return res.status(400).json({ error: 'round and session required' });
  var cacheKey = 'f1:results:' + round + ':' + session;
  var isRace   = session === 'race' || session === 'sprint-race';
  try {
    var result = await cached(cacheKey, TTL.F1_RESULTS, async function() {
      if (!time) return null;
      var sessKey = await resolveSessionKey(time);
      if (!sessKey) return null;
      return isRace ? await fetchRaceResults(sessKey) : await fetchPracticeOrQuali(sessKey);
    });
    return res.status(200).json({
      ok: true, cached: result.fromCache, ageSeconds: result.ageSeconds,
      session: session, round: round, results: result.data || null,
      note: result.data ? null : 'No data available yet',
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
