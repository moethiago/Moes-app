// ============================================================
// f1-livetiming.js — OpenF1 live timing tower, INCREMENTAL.
//
// Old version fetched the ENTIRE session history (positions,
// intervals, laps — tens of MB during a race) every 5 seconds,
// which crashed Safari. This version:
//   - fetches drivers ONCE per session
//   - fetches only rows newer than the last poll (date> filter)
//   - keeps latest-state maps in memory
//   - polls every 10s (kinder to OpenF1 during live sessions)
// Payload per poll: ~KBs instead of ~MBs.
// ============================================================

var liveTimingTimer = null;

// In-memory live state
var ltSessionKey   = null;
var ltSessionName  = '';
var ltDriverMap    = {};   // num -> driver object (fetched once)
var ltLatestPos    = {};   // num -> {position, date}
var ltLatestInt    = {};   // num -> {gap_to_leader, interval, date}
var ltLatestLap    = {};   // num -> lap_number
var ltLastPollISO  = null; // ISO timestamp of last successful poll

function ltFetch(url, ms) {
  return new Promise(function(resolve) {
    var done  = false;
    var timer = setTimeout(function() {
      if (!done) { done = true; resolve(null); }
    }, ms);
    fetch(url).then(function(r) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (!r.ok) { resolve(null); return; }
      r.json().then(function(d) { resolve(d); }).catch(function() { resolve(null); });
    }).catch(function() {
      if (!done) { done = true; clearTimeout(timer); resolve(null); }
    });
  });
}

function ltReset() {
  ltSessionKey  = null;
  ltSessionName = '';
  ltDriverMap   = {};
  ltLatestPos   = {};
  ltLatestInt   = {};
  ltLatestLap   = {};
  ltLastPollISO = null;
}

// One-time per session: find the latest session + load drivers
async function ltInitSession() {
  var sessions = await ltFetch('https://api.openf1.org/v1/sessions?year=2026', 8000);
  if (!sessions || !sessions.length) return false;
  var latest = sessions.reduce(function(a, b) { return a.session_key > b.session_key ? a : b; });

  if (latest.session_key !== ltSessionKey) {
    ltReset();
    ltSessionKey  = latest.session_key;
    ltSessionName = latest.session_name || 'Live';
    var drivers = await ltFetch('https://api.openf1.org/v1/drivers?session_key=' + ltSessionKey, 8000);
    (drivers || []).forEach(function(d) { ltDriverMap[d.driver_number] = d; });
    // Seed initial state from the recent window only (last 30 min),
    // NOT the whole session — this is what prevents the crash.
    var seedISO = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    await ltPollIncrement(seedISO);
  }
  return true;
}

// Fetch only rows newer than sinceISO and merge into state maps
async function ltPollIncrement(sinceISO) {
  var base = 'https://api.openf1.org/v1';
  var qs   = '?session_key=' + ltSessionKey + '&date>' + encodeURIComponent(sinceISO);

  var results = await Promise.all([
    ltFetch(base + '/position'  + qs, 7000),
    ltFetch(base + '/intervals' + qs, 7000),
    ltFetch(base + '/laps?session_key=' + ltSessionKey + '&date_start>' + encodeURIComponent(sinceISO), 7000),
  ]);

  var positions = results[0] || [];
  var intervals = results[1] || [];
  var laps      = results[2] || [];

  positions.forEach(function(p) {
    var k = p.driver_number;
    if (!ltLatestPos[k] || p.date > ltLatestPos[k].date) ltLatestPos[k] = p;
  });
  intervals.forEach(function(i) {
    var k = i.driver_number;
    if (!ltLatestInt[k] || i.date > ltLatestInt[k].date) ltLatestInt[k] = i;
  });
  laps.forEach(function(l) {
    var k = l.driver_number;
    if (!ltLatestLap[k] || l.lap_number > ltLatestLap[k]) ltLatestLap[k] = l.lap_number;
  });

  ltLastPollISO = new Date().toISOString();
  return positions.length + intervals.length + laps.length;
}

function ltRender() {
  var container = document.getElementById('f1-live-timing');
  if (!container) return;

  var sorted = Object.values(ltLatestPos).sort(function(a, b) { return a.position - b.position; });
  if (!sorted.length) return;

  var lapNums = Object.values(ltLatestLap);
  var maxLap = lapNums.length ? Math.max.apply(null, lapNums) : 0;

  var html = '<div class="f1-lt-header"><span class="f1-lt-session">' + ltSessionName + '</span>';
  if (maxLap) html += '<span class="f1-lt-lap">Lap ' + maxLap + '</span>';
  html += '</div><div class="f1-lt-list">';

  sorted.slice(0, 22).forEach(function(p) {
    var num    = p.driver_number;
    var driver = ltDriverMap[num] || {};
    var name   = driver.last_name || ('Car ' + num);
    var team   = (driver.team_name || '').toLowerCase().replace(/\s+/g,'_').replace(/-/g,'_');
    var col    = (typeof TEAM_COLORS !== 'undefined' && TEAM_COLORS[team]) || '#8a8fa8';
    var intRow = ltLatestInt[num];
    var gap    = intRow ? (intRow.gap_to_leader || intRow.interval || '') : '';
    var lapN   = ltLatestLap[num] || '';
    html += '<div class="f1-lt-row">'
      + '<span class="f1-lt-pos">' + p.position + '</span>'
      + '<span class="f1-lt-num" style="background:' + col + '22;color:' + col + '">' + num + '</span>'
      + '<span class="f1-lt-name">' + name + '</span>'
      + '<span class="f1-lt-gap">' + (gap || (p.position === 1 ? 'LEAD' : '')) + '</span>'
      + '<span class="f1-lt-lap">' + (lapN || '') + '</span>'
      + '</div>';
  });

  html += '</div>';
  container.innerHTML = html;
}

function startLiveTiming() {
  var container = document.getElementById('f1-live-timing');
  if (!container || liveTimingTimer) return;

  async function update() {
    try {
      var ok = await ltInitSession();
      if (!ok) return;
      if (ltLastPollISO) {
        // small overlap so no rows are missed between polls
        var since = new Date(new Date(ltLastPollISO).getTime() - 5000).toISOString();
        await ltPollIncrement(since);
      }
      ltRender();
    } catch(e) { /* never let a poll error kill the loop */ }
  }

  update();
  liveTimingTimer = setInterval(update, 10000);
}

function stopLiveTiming() {
  if (liveTimingTimer) { clearInterval(liveTimingTimer); liveTimingTimer = null; }
  var container = document.getElementById('f1-live-timing');
  if (container) container.innerHTML = '';
}
