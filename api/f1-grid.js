
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
// api/f1-grid.js — official FIA starting grid
// Fetches from OpenF1 /starting_grid, caches in KV.
// Separate from qualifying results — reflects FIA-confirmed
// positions including any penalties applied after qualifying.
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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  var round = req.query.round;  // e.g. "R6"
  var type  = req.query.type;   // "sprint" or "race"
  var time  = req.query.time;   // ISO time of the qualifying session that set this grid

  if (!round || !type) return res.status(400).json({ error: 'round and type required' });

  var cacheKey = 'f1:grid:' + round + ':' + type;

  try {
    var result = await cached(cacheKey, TTL.F1_RESULTS, async function() {
      if (!time) return null;
      var sessKey = await resolveSessionKey(time);
      if (!sessKey) return null;

      var grid    = await fetchOF1('/starting_grid?session_key=' + sessKey, 10000);
      var drivers = await fetchOF1('/drivers?session_key=' + sessKey, 8000);

      if (!grid || !grid.length) return null;  // FIA not published yet

      var driverMap = {};
      if (drivers) drivers.forEach(function(d) { driverMap[d.driver_number] = d; });

      // Sort by grid_position, fallback to array index when null
      var sorted = grid.slice().sort(function(a, b) {
        return (a.grid_position || 99) - (b.grid_position || 99);
      });
      sorted.forEach(function(entry, i) {
        if (!entry.grid_position) entry.grid_position = i + 1;
      });

      return sorted.map(function(entry) {
        var drv = driverMap[entry.driver_number] || {};
        return {
          pos:     entry.grid_position,
          num:     entry.driver_number,
          name:    drv.last_name || ('Car ' + entry.driver_number),
          team:    drv.team_name || '',
          penalty: !!entry.grid_penalty,
        };
      });
    });

    return res.status(200).json({
      ok:         true,
      cached:     result.fromCache,
      ageSeconds: result.ageSeconds,
      round:      round,
      type:       type,
      published:  !!result.data,
      grid:       result.data || null,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
