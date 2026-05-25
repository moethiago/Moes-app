// ============================================================
// api/f1-grid.js — official FIA starting grid
// Fetches from OpenF1 /starting_grid, caches in KV.
// Separate from qualifying results — reflects FIA-confirmed
// positions including any penalties applied after qualifying.
// ============================================================

import { cached, TTL } from './lib/cache.js';

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
