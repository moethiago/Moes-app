// ============================================================
// f1-session.js — session results + official grid
// Does NOT call OpenF1 directly.
// Calls /api/f1-results and /api/f1-grid on Vercel instead.
// Results are cached in KV and survive OpenF1 lockdowns.
// Depends on: f1-data.js (F1_CALENDAR, SESSION_DURATION, TEAM_COLORS)
// ============================================================

var VERCEL_BASE = 'https://moes-app-two.vercel.app';

// Safari-safe fetch
function safeFetch(url, ms) {
  return new Promise(function(resolve) {
    var done  = false;
    var timer = setTimeout(function() { if (!done) { done = true; resolve(null); } }, ms || 10000);
    fetch(url).then(function(r) {
      if (done) return; done = true; clearTimeout(timer);
      if (!r.ok) { resolve(null); return; }
      r.json().then(function(d) { resolve(d); }).catch(function() { resolve(null); });
    }).catch(function() { if (!done) { done = true; clearTimeout(timer); resolve(null); } });
  });
}

// ── PHASE DETECTION ──────────────────────────────────────────

function getWeekendPhase() {
  var now     = Date.now();
  var weekend = getCurrentRaceWeekend();
  if (!weekend) return { weekend: null, lastSession: null, nextSession: null };
  var lastSession = null;
  var nextSession = null;
  for (var i = 0; i < weekend.sessions.length; i++) {
    var sess  = weekend.sessions[i];
    var start = Date.parse(sess.time);
    var dur   = (SESSION_DURATION[sess.name] || 90) * 60 * 1000;
    var end   = start + dur;
    if (now > end)     lastSession = { sess: sess, start: start, end: end, idx: i };
    if (start > now && !nextSession) nextSession = { sess: sess, start: start, idx: i };
  }
  return { weekend: weekend, lastSession: lastSession, nextSession: nextSession };
}

// Map our session names to API param names
function sessionParam(name) {
  var map = {
    'Practice 1':        'practice-1',
    'Practice 2':        'practice-2',
    'Practice 3':        'practice-3',
    'Sprint Qualifying': 'sprint-qualifying',
    'Sprint Race':       'sprint-race',
    'Qualifying':        'qualifying',
    'Race':              'race',
  };
  return map[name] || name.toLowerCase().replace(/\s+/g, '-');
}

// ── MAIN ENTRY POINT ─────────────────────────────────────────

async function loadSessionData() {
  var phase = getWeekendPhase();

  if (!phase.weekend) {
    loadLastRaceFullResults();
    hideGrid();
    return;
  }

  if (phase.lastSession) {
    fetchAndRenderResults(phase.lastSession.sess, phase.weekend);
  } else {
    var el = document.getElementById('f1-session-results');
    if (el) el.innerHTML = '<div class="f1-session-empty">No sessions completed yet this weekend</div>';
  }

  // Show official grid after qualifying sessions
  if (phase.lastSession) {
    var lastName = phase.lastSession.sess.name;
    if (lastName === 'Sprint Qualifying') {
      fetchAndRenderGrid(phase.lastSession.sess, phase.weekend, 'sprint', 'Sprint Grid');
    } else if (lastName === 'Qualifying') {
      fetchAndRenderGrid(phase.lastSession.sess, phase.weekend, 'race', 'Race Grid');
    } else {
      hideGrid();
    }
  } else {
    hideGrid();
  }
}

// ── FETCH + RENDER RESULTS ────────────────────────────────────

async function fetchAndRenderResults(sess, weekend) {
  var el = document.getElementById('f1-session-results');
  if (!el) return;
  el.innerHTML = '<div class="f1-api-loading"><div class="f1-spinner"></div><span>Loading ' + sess.name + '...</span></div>';

  var url = VERCEL_BASE + '/api/f1-results'
    + '?round=' + encodeURIComponent(weekend.round)
    + '&session=' + encodeURIComponent(sessionParam(sess.name))
    + '&time=' + encodeURIComponent(sess.time);

  var data = await safeFetch(url, 15000);

  if (!data || !data.results || !data.results.length) {
    el.innerHTML = '<div class="f1-session-empty">Results not available yet</div>';
    return;
  }

  var isRace = sess.name === 'Race' || sess.name === 'Sprint Race';
  el.innerHTML = renderResultsList(data.results, sess.name, isRace);
}

function renderResultsList(results, sessName, isRace) {
  var html = '<div class="f1-sess-header">'
    + '<span>' + sessName + ' Results</span>'
    + '<span class="f1-sess-count">' + results.length + ' drivers</span>'
    + '</div>';
  html += '<div class="f1-sess-list">';

  results.forEach(function(r) {
    var col = TEAM_COLORS[(r.team || '').toLowerCase().replace(/\s+/g,'_').replace(/-/g,'_')] || '#8a8fa8';
    var pc  = r.pos === 1 ? 'p1' : r.pos === 2 ? 'p2' : r.pos === 3 ? 'p3' : '';
    var fl  = r.fastestLap ? ' <span class="fl-badge">FL</span>' : '';

    var timeOrGap;
    if (isRace) {
      timeOrGap = '<span class="f1-sess-gap">' + (r.gap || '') + '</span>';
    } else {
      var gapStr = r.pos === 1 ? (r.pos === 1 && sessName.indexOf('Qualifying') > -1 ? 'POLE' : 'BEST') : ('+' + r.gap + 's');
      timeOrGap = '<span class="f1-sess-time">' + formatLapTime(r.time) + '</span>'
                + '<span class="f1-sess-gap' + (r.pos === 1 ? ' pole' : '') + '">' + gapStr + '</span>';
    }

    html += '<div class="f1-sess-row">'
      + '<span class="f1-pos ' + pc + '">' + r.pos + '</span>'
      + '<span class="f1-num" style="background:' + col + '22;color:' + col + '">' + r.num + '</span>'
      + '<span class="f1-sess-name">' + r.name + fl + '</span>'
      + timeOrGap
      + '</div>';
  });

  html += '</div>';
  return html;
}

// ── FETCH + RENDER OFFICIAL GRID ──────────────────────────────

async function fetchAndRenderGrid(sess, weekend, type, label) {
  var wrapper = document.getElementById('f1-next-grid');
  if (!wrapper) return;
  wrapper.style.display = 'block';
  wrapper.innerHTML = '<div class="f1-api-loading"><div class="f1-spinner"></div><span>Loading ' + label + '...</span></div>';

  var url = VERCEL_BASE + '/api/f1-grid'
    + '?round=' + encodeURIComponent(weekend.round)
    + '&type='  + encodeURIComponent(type)
    + '&time='  + encodeURIComponent(sess.time);

  var data = await safeFetch(url, 15000);

  if (!data) {
    wrapper.innerHTML = '<div class="card" style="padding:14px;text-align:center;color:#888;font-size:13px;">Could not load ' + label + '</div>';
    return;
  }

  if (!data.published || !data.grid || !data.grid.length) {
    wrapper.innerHTML = '<div class="card" style="padding:14px;">'
      + '<div class="f1-sess-header" style="border:none;padding:0 0 8px;"><span>' + label + '</span></div>'
      + '<div style="font-size:13px;color:#aaa;text-align:center;padding:8px 0;">Official grid not yet published</div>'
      + '<div style="font-size:11px;color:#666;text-align:center;margin-top:4px;">FIA releases 1-3 hours after qualifying</div>'
      + '</div>';
    return;
  }

  renderGridGraphic(wrapper, data.grid, label);
}

function renderGridGraphic(el, grid, label) {
  var html = '<div class="f1-grid-header">' + label + '</div>';
  html += '<div class="f1-grid-container">';

  for (var i = 0; i < grid.length; i += 2) {
    var left  = grid[i];
    var right = grid[i + 1];
    html += '<div class="f1-grid-row">';
    html += renderGridSlot(left);
    html += right ? renderGridSlot(right) : '<div class="f1-grid-slot empty"></div>';
    html += '</div>';
  }

  html += '</div>';
  el.innerHTML = html;
}

function renderGridSlot(entry) {
  var col = TEAM_COLORS[(entry.team || '').toLowerCase().replace(/\s+/g,'_').replace(/-/g,'_')] || '#8a8fa8';
  var pc  = entry.pos <= 3 ? 'top3' : '';
  var pen = entry.penalty ? ' <span class="f1-grid-penalty">P</span>' : '';

  return '<div class="f1-grid-slot ' + pc + '" style="border-left:3px solid ' + col + '">'
    + '<span class="f1-grid-pos">' + entry.pos + pen + '</span>'
    + '<div class="f1-grid-info">'
    + '<span class="f1-grid-name">' + entry.name + '</span>'
    + '<span class="f1-grid-team">' + entry.team + '</span>'
    + '</div>'
    + '<span class="f1-grid-num" style="color:' + col + '">' + entry.num + '</span>'
    + '</div>';
}

function hideGrid() {
  var el = document.getElementById('f1-next-grid');
  if (el) el.style.display = 'none';
}

// ── LAST RACE FULL RESULTS (outside race weekend) ─────────────

async function loadLastRaceFullResults() {
  var el = document.getElementById('f1-session-results');
  if (!el) return;
  el.innerHTML = '<div class="f1-api-loading"><div class="f1-spinner"></div><span>Loading last race...</span></div>';

  try {
    var data = await safeFetch('https://api.jolpi.ca/ergast/f1/current/last/results.json?limit=25', 8000);
    if (!data) throw new Error('no response');
    var race = data.MRData && data.MRData.RaceTable && data.MRData.RaceTable.Races[0];
    if (!race || !race.Results) { el.innerHTML = '<div class="f1-session-empty">No results</div>'; return; }

    var html = '<div class="f1-sess-header">'
      + '<span>Last Race - ' + race.raceName + '</span>'
      + '<span class="f1-sess-count">' + race.Results.length + ' drivers</span>'
      + '</div><div class="f1-sess-list">';

    race.Results.forEach(function(r) {
      var pos  = parseInt(r.position);
      var cid  = r.Constructor.constructorId;
      var col  = TEAM_COLORS[cid] || '#8a8fa8';
      var gap  = r.status === 'Finished' ? (r.Time ? r.Time.time : '') : r.status;
      var pts  = parseFloat(r.points) > 0 ? '+' + r.points + 'pts' : '';
      var fl   = r.FastestLap && r.FastestLap.rank === '1';
      var pc   = pos === 1 ? 'p1' : pos === 2 ? 'p2' : pos === 3 ? 'p3' : '';
      html += '<div class="f1-sess-row">'
        + '<span class="f1-pos ' + pc + '">' + pos + '</span>'
        + '<span class="f1-num" style="background:' + col + '22;color:' + col + '">' + r.Driver.permanentNumber + '</span>'
        + '<span class="f1-sess-name">' + r.Driver.familyName + (fl ? ' <span class="fl-badge">FL</span>' : '') + '</span>'
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

// ── HELPERS ───────────────────────────────────────────────────

function formatLapTime(seconds) {
  if (!seconds || seconds <= 0) return '--:--.---';
  var m  = Math.floor(seconds / 60);
  var s  = Math.floor(seconds % 60);
  var ms = Math.round((seconds % 1) * 1000);
  return m + ':' + String(s).padStart(2,'0') + '.' + String(ms).padStart(3,'0');
}

// ── INIT ─────────────────────────────────────────────────────

function initSessionSection() {
  loadSessionData();
  setInterval(loadSessionData, 3 * 60 * 1000);
}
