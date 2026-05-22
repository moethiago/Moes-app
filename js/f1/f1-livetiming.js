// ============================================================
// f1-livetiming.js — OpenF1 live timing tower
// Depends on: f1-data.js
// ============================================================

var liveTimingTimer = null;

// Safari-safe fetch with manual timeout (AbortSignal.timeout broken on iOS)
function fetchWithTimeout(url, ms) {
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

async function fetchOpenF1Live() {
  try {
    var sessions = await fetchWithTimeout('https://api.openf1.org/v1/sessions?year=2026', 8000);
    if (!sessions || !sessions.length) return null;
    var latest = sessions.reduce(function(a, b) { return a.session_key > b.session_key ? a : b; });
    var sessionKey = latest.session_key;
    var results = await Promise.all([
      fetchWithTimeout('https://api.openf1.org/v1/position?session_key='  + sessionKey, 6000),
      fetchWithTimeout('https://api.openf1.org/v1/intervals?session_key=' + sessionKey, 6000),
      fetchWithTimeout('https://api.openf1.org/v1/drivers?session_key='   + sessionKey, 6000),
      fetchWithTimeout('https://api.openf1.org/v1/laps?session_key='      + sessionKey, 6000),
    ]);
    var positions = results[0] || [];
    var intervals = results[1] || [];
    var drivers   = results[2] || [];
    var laps      = results[3] || [];
    if (!positions.length && !drivers.length) return null;
    return { sessionKey: sessionKey, positions: positions, intervals: intervals, drivers: drivers, laps: laps, sessionName: latest.session_name };
  } catch(e) { return null; }
}

function renderLiveTiming(data) {
  var container = document.getElementById('f1-live-timing');
  if (!container || !data) return;
  var { positions, intervals, drivers, laps, sessionName } = data;

  var driverMap = {};
  drivers.forEach(function(d) { driverMap[d.driver_number] = d; });

  var latestPos = {};
  positions.forEach(function(p) {
    var k = p.driver_number;
    if (!latestPos[k] || p.date > latestPos[k].date) latestPos[k] = p;
  });

  var latestInt = {};
  intervals.forEach(function(i) {
    var k = i.driver_number;
    if (!latestInt[k] || i.date > latestInt[k].date) latestInt[k] = i;
  });

  var latestLap = {};
  laps.forEach(function(l) {
    var k = l.driver_number;
    if (!latestLap[k] || l.lap_number > (latestLap[k].lap_number || 0)) latestLap[k] = l;
  });

  var sorted = Object.values(latestPos).sort(function(a, b) { return a.position - b.position; });
  if (!sorted.length) return;

  var maxLap = Math.max.apply(null, Object.values(latestLap).map(function(l) { return l.lap_number || 0; }));

  var html = '<div class="f1-lt-header"><span class="f1-lt-session">' + (sessionName || 'Live') + '</span>';
  if (maxLap) html += '<span class="f1-lt-lap">Lap ' + maxLap + '</span>';
  html += '</div><div class="f1-lt-list">';

  sorted.slice(0, 20).forEach(function(p) {
    var num    = p.driver_number;
    var driver = driverMap[num] || {};
    var name   = driver.last_name || ('Car ' + num);
    var team   = (driver.team_name || '').toLowerCase().replace(/\s+/g,'_').replace(/-/g,'_');
    var col    = TEAM_COLORS[team] || '#8a8fa8';
    var gap    = latestInt[num] ? (latestInt[num].gap_to_leader || latestInt[num].interval || '') : '';
    var lapN   = latestLap[num] ? latestLap[num].lap_number : '';
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
    var data = await fetchOpenF1Live();
    if (data) renderLiveTiming(data);
  }
  update();
  liveTimingTimer = setInterval(update, 5000);
}

function stopLiveTiming() {
  if (liveTimingTimer) { clearInterval(liveTimingTimer); liveTimingTimer = null; }
  var container = document.getElementById('f1-live-timing');
  if (container) container.innerHTML = '';
}
