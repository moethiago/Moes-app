// ============================================================
// f1-session.js — session results + race grid
// Depends on: f1-data.js (TEAM_COLORS, F1_CALENDAR, SESSION_DURATION)
//
// Renders two cards that appear below the countdown:
//   1. LAST SESSION RESULTS — practice times, quali grid, sprint/race results
//   2. NEXT GRID — visual two-column starting grid (after qualifying)
// ============================================================

var sessionCache = {};  // { sessionKey: { data, fetchedAt } }

// ── OPENF1 ENDPOINTS ──────────────────────────────────────────────────────────

function openf1(path, ms) {
  return fetchWithTimeout('https://api.openf1.org/v1' + path, ms || 8000);
}

// ── PHASE DETECTION ──────────────────────────────────────────────────────────
// Returns what just finished and what's next so we know what to show

function getWeekendPhase() {
  var now = Date.now();
  var weekend = getCurrentRaceWeekend();
  if (!weekend) return { weekend: null, lastSession: null, nextSession: null };

  var lastSession = null;
  var nextSession = null;

  for (var i = 0; i < weekend.sessions.length; i++) {
    var sess     = weekend.sessions[i];
    var start    = Date.parse(sess.time);
    var dur      = (SESSION_DURATION[sess.name] || 90) * 60 * 1000;
    var end      = start + dur;
    if (now > end) lastSession = { sess: sess, start: start, end: end, idx: i };
    if (now < start && !nextSession) nextSession = { sess: sess, start: start, idx: i };
  }

  return { weekend: weekend, lastSession: lastSession, nextSession: nextSession };
}

// ── MAIN ENTRY POINT ──────────────────────────────────────────────────────────

async function loadSessionData() {
  var phase = getWeekendPhase();
  if (!phase.weekend) {
    // Not a race weekend — show last race results only
    loadLastRaceFullResults();
    hideGrid();
    return;
  }

  if (phase.lastSession) {
    fetchSessionResults(phase.lastSession.sess, phase.weekend);
  }

  // Show grid if the session before the next session is a qualifying type
  if (phase.nextSession) {
    var nextName = phase.nextSession.sess.name;
    // Show sprint grid before Sprint Race, show race grid before Race
    if (nextName === 'Sprint Race' && phase.lastSession && phase.lastSession.sess.name === 'Sprint Qualifying') {
      fetchGrid(phase.lastSession.sess, 'Sprint Grid');
    } else if (nextName === 'Race' && phase.lastSession && phase.lastSession.sess.name === 'Qualifying') {
      fetchGrid(phase.lastSession.sess, 'Race Grid');
    } else {
      hideGrid();
    }
  } else {
    // All sessions done — show race results as grid
    hideGrid();
  }
}

// ── FETCH + RENDER SESSION RESULTS ───────────────────────────────────────────

async function fetchSessionResults(sess, weekend) {
  var el = document.getElementById('f1-session-results');
  if (!el) return;
  el.innerHTML = '<div class="f1-api-loading"><div class="f1-spinner"></div><span>Loading ' + sess.name + ' results...</span></div>';

  try {
    // Get the OpenF1 session key for this session
    var sessKey = await getSessionKey(weekend, sess);
    if (!sessKey) {
      el.innerHTML = '<div class="f1-session-empty">Results not available yet</div>';
      return;
    }

    if (sess.name === 'Practice 1' || sess.name === 'Practice 2' || sess.name === 'Practice 3') {
      await renderPracticeResults(el, sessKey, sess.name);
    } else if (sess.name === 'Sprint Qualifying' || sess.name === 'Qualifying') {
      await renderQualiResults(el, sessKey, sess.name);
    } else if (sess.name === 'Sprint Race' || sess.name === 'Race') {
      await renderRaceResults(el, sessKey, sess.name);
    }
  } catch (e) {
    el.innerHTML = '<div class="f1-session-empty">Could not load results</div>';
  }
}

async function getSessionKey(weekend, sess) {
  // Match by date proximity ONLY — OpenF1 session names vary and cannot be trusted
  // e.g. "Sprint Qualifying" may be stored as "Sprint Shootout" or "Qualifying"
  var cacheKey = 'sesskey:' + weekend.round + ':' + sess.name;
  if (sessionCache[cacheKey] && sessionCache[cacheKey].data) return sessionCache[cacheKey].data;

  var sessions = await openf1('/sessions?year=2026', 10000);
  if (!sessions || !sessions.length) return null;

  var sessStart = Date.parse(sess.time);
  var TOLERANCE = 12 * 3600 * 1000; // 12 hours — same day match

  // Find the OpenF1 session whose start date is closest to our calendar time
  var best = null;
  var bestDiff = Infinity;
  sessions.forEach(function(s) {
    if (!s.date_start) return;
    var sDate = new Date(s.date_start).getTime();
    var diff  = Math.abs(sDate - sessStart);
    if (diff < TOLERANCE && diff < bestDiff) {
      best     = s;
      bestDiff = diff;
    }
  });

  if (!best) {
    console.warn('getSessionKey: no match for', sess.name, 'at', sess.time);
    return null;
  }

  console.log('getSessionKey: matched', sess.name, '->', best.session_name, 'key:', best.session_key);
  sessionCache[cacheKey] = { data: best.session_key };
  return best.session_key;
}

// ── PRACTICE RESULTS ─────────────────────────────────────────────────────────

async function renderPracticeResults(el, sessKey, sessName) {
  var [laps, drivers] = await Promise.all([
    openf1('/laps?session_key=' + sessKey + '&is_pit_out_lap=false', 10000),
    openf1('/drivers?session_key=' + sessKey, 8000),
  ]);

  if (!laps || !drivers) { el.innerHTML = '<div class="f1-session-empty">No data</div>'; return; }

  var driverMap = {};
  drivers.forEach(function(d) { driverMap[d.driver_number] = d; });

  // Best lap per driver
  var bestLaps = {};
  laps.forEach(function(l) {
    var n = l.driver_number;
    if (!l.lap_duration || l.lap_duration <= 0) return;
    if (!bestLaps[n] || l.lap_duration < bestLaps[n].lap_duration) bestLaps[n] = l;
  });

  var sorted = Object.values(bestLaps).sort(function(a, b) { return a.lap_duration - b.lap_duration; });
  if (!sorted.length) { el.innerHTML = '<div class="f1-session-empty">No lap data yet</div>'; return; }

  var best = sorted[0].lap_duration;

  var html = '<div class="f1-sess-header"><span>' + sessName + ' Results</span><span class="f1-sess-count">' + sorted.length + ' drivers</span></div>';
  html += '<div class="f1-sess-list">';
  sorted.forEach(function(l, i) {
    var drv = driverMap[l.driver_number] || {};
    var name = (drv.last_name || ('Car ' + l.driver_number));
    var team = (drv.team_name || '').toLowerCase().replace(/\s+/g,'_').replace(/-/g,'_');
    var col  = TEAM_COLORS[team] || '#8a8fa8';
    var gap  = i === 0 ? 'BEST' : '+' + (l.lap_duration - best).toFixed(3) + 's';
    var time = formatLapTime(l.lap_duration);
    var pc   = i === 0 ? 'p1' : i === 1 ? 'p2' : i === 2 ? 'p3' : '';
    html += '<div class="f1-sess-row">'
      + '<span class="f1-pos ' + pc + '">' + (i + 1) + '</span>'
      + '<span class="f1-num" style="background:' + col + '22;color:' + col + '">' + l.driver_number + '</span>'
      + '<span class="f1-sess-name">' + name + '</span>'
      + '<span class="f1-sess-time">' + time + '</span>'
      + '<span class="f1-sess-gap">' + gap + '</span>'
      + '</div>';
  });
  html += '</div>';
  el.innerHTML = html;
}

// ── QUALIFYING RESULTS ────────────────────────────────────────────────────────

async function renderQualiResults(el, sessKey, sessName) {
  var [laps, drivers] = await Promise.all([
    openf1('/laps?session_key=' + sessKey + '&is_pit_out_lap=false', 10000),
    openf1('/drivers?session_key=' + sessKey, 8000),
  ]);

  if (!laps || !drivers) { el.innerHTML = '<div class="f1-session-empty">No data</div>'; return; }

  var driverMap = {};
  drivers.forEach(function(d) { driverMap[d.driver_number] = d; });

  var bestLaps = {};
  laps.forEach(function(l) {
    var n = l.driver_number;
    if (!l.lap_duration || l.lap_duration <= 0) return;
    if (!bestLaps[n] || l.lap_duration < bestLaps[n].lap_duration) bestLaps[n] = l;
  });

  var sorted = Object.values(bestLaps).sort(function(a, b) { return a.lap_duration - b.lap_duration; });
  if (!sorted.length) { el.innerHTML = '<div class="f1-session-empty">No lap data yet</div>'; return; }

  var best = sorted[0].lap_duration;

  var html = '<div class="f1-sess-header"><span>' + sessName + ' Results</span><span class="f1-sess-count">' + sorted.length + ' drivers</span></div>';
  html += '<div class="f1-sess-list">';
  sorted.forEach(function(l, i) {
    var drv  = driverMap[l.driver_number] || {};
    var name = drv.last_name || ('Car ' + l.driver_number);
    var team = (drv.team_name || '').toLowerCase().replace(/\s+/g,'_').replace(/-/g,'_');
    var col  = TEAM_COLORS[team] || '#8a8fa8';
    var gap  = i === 0 ? 'POLE' : '+' + (l.lap_duration - best).toFixed(3) + 's';
    var time = formatLapTime(l.lap_duration);
    var pc   = i === 0 ? 'p1' : i === 1 ? 'p2' : i === 2 ? 'p3' : '';
    html += '<div class="f1-sess-row">'
      + '<span class="f1-pos ' + pc + '">' + (i + 1) + '</span>'
      + '<span class="f1-num" style="background:' + col + '22;color:' + col + '">' + l.driver_number + '</span>'
      + '<span class="f1-sess-name">' + name + '</span>'
      + '<span class="f1-sess-time">' + time + '</span>'
      + '<span class="f1-sess-gap ' + (i === 0 ? 'pole' : '') + '">' + gap + '</span>'
      + '</div>';
  });
  html += '</div>';
  el.innerHTML = html;
}

// ── RACE / SPRINT RACE RESULTS ────────────────────────────────────────────────

async function renderRaceResults(el, sessKey, sessName) {
  var [positions, intervals, drivers, laps] = await Promise.all([
    openf1('/position?session_key=' + sessKey, 10000),
    openf1('/intervals?session_key=' + sessKey, 10000),
    openf1('/drivers?session_key=' + sessKey, 8000),
    openf1('/laps?session_key=' + sessKey, 10000),
  ]);

  if (!positions || !drivers) { el.innerHTML = '<div class="f1-session-empty">No data</div>'; return; }

  var driverMap = {};
  drivers.forEach(function(d) { driverMap[d.driver_number] = d; });

  // Final positions (last known)
  var finalPos = {};
  positions.forEach(function(p) {
    var k = p.driver_number;
    if (!finalPos[k] || p.date > finalPos[k].date) finalPos[k] = p;
  });

  // Final intervals
  var finalInt = {};
  if (intervals) {
    intervals.forEach(function(i) {
      var k = i.driver_number;
      if (!finalInt[k] || i.date > finalInt[k].date) finalInt[k] = i;
    });
  }

  // Fastest lap per driver
  var fastestLap = {};
  if (laps) {
    laps.forEach(function(l) {
      var k = l.driver_number;
      if (!l.lap_duration || l.lap_duration <= 0) return;
      if (!fastestLap[k] || l.lap_duration < fastestLap[k]) fastestLap[k] = l.lap_duration;
    });
  }
  var overallFastest = Object.values(fastestLap).length ? Math.min.apply(null, Object.values(fastestLap)) : 0;

  var sorted = Object.values(finalPos).sort(function(a, b) { return a.position - b.position; });
  if (!sorted.length) { el.innerHTML = '<div class="f1-session-empty">Results not available yet</div>'; return; }

  var html = '<div class="f1-sess-header"><span>' + sessName + ' Results</span><span class="f1-sess-count">' + sorted.length + ' drivers</span></div>';
  html += '<div class="f1-sess-list">';
  sorted.forEach(function(p, i) {
    var drv  = driverMap[p.driver_number] || {};
    var name = drv.last_name || ('Car ' + p.driver_number);
    var team = (drv.team_name || '').toLowerCase().replace(/\s+/g,'_').replace(/-/g,'_');
    var col  = TEAM_COLORS[team] || '#8a8fa8';
    var gap  = finalInt[p.driver_number] ? (finalInt[p.driver_number].gap_to_leader || '') : '';
    var fl   = fastestLap[p.driver_number] && fastestLap[p.driver_number] === overallFastest;
    var pc   = p.position === 1 ? 'p1' : p.position === 2 ? 'p2' : p.position === 3 ? 'p3' : '';
    html += '<div class="f1-sess-row">'
      + '<span class="f1-pos ' + pc + '">' + p.position + '</span>'
      + '<span class="f1-num" style="background:' + col + '22;color:' + col + '">' + p.driver_number + '</span>'
      + '<span class="f1-sess-name">' + name + (fl ? ' <span class="fl-badge">FL</span>' : '') + '</span>'
      + '<span class="f1-sess-gap">' + (p.position === 1 ? 'WIN' : gap || '') + '</span>'
      + '</div>';
  });
  html += '</div>';
  el.innerHTML = html;
}

// ── LAST RACE FULL RESULTS (outside race weekend) ─────────────────────────────

async function loadLastRaceFullResults() {
  var el = document.getElementById('f1-session-results');
  if (!el) return;
  el.innerHTML = '<div class="f1-api-loading"><div class="f1-spinner"></div><span>Loading last race...</span></div>';

  try {
    var res = await fetchWithTimeout('https://api.jolpi.ca/ergast/f1/current/last/results.json?limit=25', 8000);
    if (!res) throw new Error('no response');
    var race = res.MRData && res.MRData.RaceTable && res.MRData.RaceTable.Races[0];
    if (!race || !race.Results) { el.innerHTML = '<div class="f1-session-empty">No results</div>'; return; }

    var html = '<div class="f1-sess-header"><span>Last Race · ' + race.raceName + '</span><span class="f1-sess-count">' + race.Results.length + ' drivers</span></div>';
    html += '<div class="f1-sess-list">';
    race.Results.forEach(function(r) {
      var pos  = parseInt(r.position);
      var name = r.Driver.familyName;
      var cid  = r.Constructor.constructorId;
      var col  = TEAM_COLORS[cid] || '#8a8fa8';
      var gap  = r.status === 'Finished' ? (r.Time ? r.Time.time : '') : r.status;
      var pts  = parseFloat(r.points) > 0 ? '+' + r.points + 'pts' : '';
      var pc   = pos === 1 ? 'p1' : pos === 2 ? 'p2' : pos === 3 ? 'p3' : '';
      var fl   = r.FastestLap && r.FastestLap.rank === '1';
      html += '<div class="f1-sess-row">'
        + '<span class="f1-pos ' + pc + '">' + pos + '</span>'
        + '<span class="f1-num" style="background:' + col + '22;color:' + col + '">' + r.Driver.permanentNumber + '</span>'
        + '<span class="f1-sess-name">' + name + (fl ? ' <span class="fl-badge">FL</span>' : '') + '</span>'
        + '<span class="f1-sess-gap">' + (pos === 1 ? gap || 'WIN' : gap) + '</span>'
        + '<span class="f1-sess-pts">' + pts + '</span>'
        + '</div>';
    });
    html += '</div>';
    el.innerHTML = html;
  } catch (e) {
    el.innerHTML = '<div class="f1-session-empty">Could not load last race results</div>';
  }
}

// ── GRID DISPLAY (official FIA starting grid from OpenF1) ────────────────────
// Uses /starting_grid endpoint which reflects official positions AFTER
// FIA confirmation — including penalties, pit lane starts, disqualifications.
// Only available after FIA releases the grid (usually 1-3h after qualifying).

async function fetchGrid(sess, label) {
  var el = document.getElementById('f1-next-grid');
  if (!el) return;
  el.style.display = 'block';
  el.innerHTML = '<div class="f1-api-loading"><div class="f1-spinner"></div><span>Loading official ' + label + '...</span></div>';

  try {
    var weekend = getCurrentRaceWeekend();
    if (!weekend) { hideGrid(); return; }

    var sessKey = await getSessionKey(weekend, sess);
    if (!sessKey) { hideGrid(); return; }

    // Fetch official grid + driver info in parallel
    var results = await Promise.all([
      openf1('/starting_grid?session_key=' + sessKey, 10000),
      openf1('/drivers?session_key=' + sessKey, 8000),
    ]);

    var grid    = results[0];
    var drivers = results[1];

    // Grid not released yet — FIA hasn't confirmed positions
    if (!grid || !grid.length) {
      var wrapper = document.getElementById('f1-next-grid');
      if (wrapper) {
        wrapper.style.display = 'block';
        wrapper.innerHTML = '<div class="card" style="padding:14px;text-align:center;">'
          + '<div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">' + label + '</div>'
          + '<div style="font-size:13px;color:#aaa;">Official grid not yet published</div>'
          + '<div style="font-size:11px;color:#666;margin-top:4px;">FIA releases grid 1-3h after qualifying ends</div>'
          + '</div>';
      }
      return;
    }

    var driverMap = {};
    if (drivers) {
      drivers.forEach(function(d) { driverMap[d.driver_number] = d; });
    }

    // Sort by grid position (official FIA order)
    var sorted = grid.slice().sort(function(a, b) {
      return (a.grid_position || 99) - (b.grid_position || 99);
    });
    // Assign fallback positions for any null grid_position entries
    sorted.forEach(function(entry, i) {
      if (!entry.grid_position) entry.grid_position = i + 1;
    });

    renderGridGraphic(el, sorted, driverMap, label);

  } catch (e) {
    var wrapper = document.getElementById('f1-next-grid');
    if (wrapper) {
      wrapper.innerHTML = '<div class="card" style="padding:14px;text-align:center;color:#888;font-size:13px;">Could not load ' + label + '</div>';
    }
  }
}

function renderGridGraphic(el, sorted, driverMap, label) {
  var html = '<div class="f1-grid-header">' + label + '</div>';
  html += '<div class="f1-grid-note">Official FIA grid</div>';
  html += '<div class="f1-grid-container">';

  // Real F1 grid: P1 front-left, P2 front-right, P3 back-left, P4 back-right
  for (var i = 0; i < sorted.length; i += 2) {
    var left  = sorted[i];
    var right = sorted[i + 1];
    html += '<div class="f1-grid-row">';
    html += renderGridSlot(left, driverMap, 'left');
    html += right ? renderGridSlot(right, driverMap, 'right') : '<div class="f1-grid-slot empty"></div>';
    html += '</div>';
  }

  html += '</div>';
  el.innerHTML = html;
}

function renderGridSlot(entry, driverMap, side) {
  // entry from /starting_grid: { grid_position, driver_number, ... }
  var pos  = entry.grid_position;
  var num  = entry.driver_number;
  var drv  = driverMap[num] || {};
  var name = drv.last_name || ('Car ' + num);
  var team = (drv.team_name || '').toLowerCase().replace(/\s+/g,'_').replace(/-/g,'_');
  var col  = TEAM_COLORS[team] || '#8a8fa8';
  var pc   = pos <= 3 ? 'top3' : '';

  // Flag any penalty-related position changes with a marker
  // OpenF1 may include a note when position differs from qualifying
  var penaltyNote = entry.grid_penalty ? '<span class="f1-grid-penalty">P</span>' : '';

  return '<div class="f1-grid-slot ' + side + ' ' + pc + '" style="border-left:3px solid ' + col + '">'
    + '<span class="f1-grid-pos">' + pos + penaltyNote + '</span>'
    + '<div class="f1-grid-info">'
    + '<span class="f1-grid-name">' + name + '</span>'
    + '<span class="f1-grid-team">' + (drv.team_name || '') + '</span>'
    + '</div>'
    + '<span class="f1-grid-num" style="color:' + col + '">' + num + '</span>'
    + '</div>';
}

function hideGrid() {
  var el = document.getElementById('f1-next-grid');
  if (el) el.style.display = 'none';
}

// ── HELPERS ───────────────────────────────────────────────────────────────────

function formatLapTime(seconds) {
  if (!seconds || seconds <= 0) return '--:--.---';
  var m  = Math.floor(seconds / 60);
  var s  = Math.floor(seconds % 60);
  var ms = Math.round((seconds % 1) * 1000);
  return m + ':' + String(s).padStart(2,'0') + '.' + String(ms).padStart(3,'0');
}

// ── INIT ─────────────────────────────────────────────────────────────────────

function initSessionSection() {
  loadSessionData();
  // Refresh every 3 minutes — session results update as timing data arrives
  setInterval(loadSessionData, 3 * 60 * 1000);
}