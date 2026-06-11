// ============================================================
// f1-analytics.js — data-heavy F1 intelligence
// Pulls from Jolpica/Ergast (free). Renders into #f1-analytics.
// Sections: title math, points-gap trend, teammate H2H,
//           form guide, last-race strategy/pitstops, on-this-day.
// ============================================================

var JOLPICA = 'https://api.jolpi.ca/ergast/f1';
var RACES_LEFT_PTS = 25; // max points per remaining GP (sprint adds 8 separately)

function f1Fetch(path, ms) {
  return new Promise(function(resolve) {
    var done = false;
    var t = setTimeout(function(){ if(!done){done=true;resolve(null);} }, ms || 7000);
    fetch(JOLPICA + path).then(function(r){
      if(done) return; done=true; clearTimeout(t);
      if(!r.ok){resolve(null);return;}
      r.json().then(resolve).catch(function(){resolve(null);});
    }).catch(function(){ if(!done){done=true;clearTimeout(t);resolve(null);} });
  });
}

function elAnalytics() { return document.getElementById('f1-analytics'); }

async function loadF1Analytics() {
  var root = elAnalytics();
  if (!root) return;
  root.innerHTML = '<div class="f1-api-loading"><div class="f1-spinner"></div><span>Loading F1 intelligence...</span></div>';

  // On this day (instant, local)
  var blocks = [];
  var otd = (typeof getOnThisDay === 'function') ? getOnThisDay() : null;
  if (otd) blocks.push('<div class="f1a-card f1a-otd"><div class="f1a-h">\u{1F4C5} On This Day</div><div class="f1a-otd-text">' + otd + '</div></div>');

  root.innerHTML = blocks.join('') + '<div id="f1a-async"></div>';

  // Async sections in parallel
  renderTitleMath();
  renderGapTrend();
  renderTeammateH2H();
  renderFormGuide();
  renderLastRaceStrategy();
}

// ---- 1. TITLE PERMUTATIONS / POINTS MATH ----
async function renderTitleMath() {
  var data = await f1Fetch('/current/driverstandings.json?limit=5', 7000);
  var sl = data && data.MRData && data.MRData.StandingsTable && data.MRData.StandingsTable.StandingsLists[0];
  if (!sl) return;
  var round = parseInt(sl.round);
  var totalRounds = (typeof F1_CALENDAR !== 'undefined') ? F1_CALENDAR.length : 24; // auto from calendar (22 GPs + sprint points handled separately)
  var roundsLeft = Math.max(0, totalRounds - round);
  var maxLeft = roundsLeft * RACES_LEFT_PTS;
  var ds = sl.DriverStandings;
  var leader = ds[0];
  var lpts = parseFloat(leader.points);
  var html = '<div class="f1a-card"><div class="f1a-h">\u{1F3C6} Title Math \u00b7 after R' + round + '</div>';
  html += '<div class="f1a-sub">' + roundsLeft + ' rounds left \u00b7 max ' + maxLeft + ' pts still available</div>';
  ds.forEach(function(d) {
    var name = d.Driver.familyName;
    var cid = (d.Constructors && d.Constructors[0] && d.Constructors[0].constructorId) || '';
    if (cid && typeof registerDriverColor === 'function') registerDriverColor(name, cid);
    var col = (typeof driverColor === 'function') ? driverColor(name) : '#e6e6e6';
    var pts = parseFloat(d.points);
    var gap = lpts - pts;
    var alive = pts + maxLeft >= lpts;
    var tag;
    if (d.position === '1') {
      tag = '<span class="f1a-tag lead">LEADER</span>';
    } else if (alive) {
      tag = '<span class="f1a-tag alive">-' + gap + '</span>';
    } else {
      tag = '<span class="f1a-tag dead">OUT</span>';
    }
    html += '<div class="f1a-row"><span class="f1a-pos">' + d.position + '</span><span class="f1a-name" style="color:' + col + '">' + name + '</span><span class="f1a-pts">' + pts + '</span>' + tag + '</div>';
  });
  html += '</div>';
  appendAsync(html);
}

// ---- 2. POINTS-GAP TREND (top driver vs P2 across season) ----
async function renderGapTrend() {
  // pull standings after each round via results is heavy; instead use per-round driverstandings
  var data = await f1Fetch('/current/driverstandings.json?limit=2', 7000);
  var sl = data && data.MRData && data.MRData.StandingsTable && data.MRData.StandingsTable.StandingsLists[0];
  if (!sl) return;
  var round = parseInt(sl.round);
  // fetch standings snapshots for each round (cap requests to last 8 rounds for speed)
  var start = Math.max(1, round - 7);
  var reqs = [];
  for (var r = start; r <= round; r++) reqs.push(f1Fetch('/current/' + r + '/driverstandings.json?limit=2', 6000));
  var snaps = await Promise.all(reqs);
  var points = [];
  snaps.forEach(function(s, i) {
    var l = s && s.MRData && s.MRData.StandingsTable && s.MRData.StandingsTable.StandingsLists[0];
    if (!l || !l.DriverStandings || l.DriverStandings.length < 2) return;
    var gap = parseFloat(l.DriverStandings[0].points) - parseFloat(l.DriverStandings[1].points);
    points.push({ round: start + i, gap: gap });
  });
  if (points.length < 2) return;
  var maxGap = Math.max.apply(null, points.map(function(p){return p.gap;})) || 1;
  var leaderName = sl.DriverStandings[0].Driver.familyName;
  var bars = points.map(function(p) {
    var h = Math.max(4, Math.round((p.gap / maxGap) * 60));
    return '<div class="f1a-bar-col"><div class="f1a-bar" style="height:' + h + 'px"></div><span class="f1a-bar-lbl">R' + p.round + '</span></div>';
  }).join('');
  var html = '<div class="f1a-card"><div class="f1a-h">\u{1F4C8} Lead Gap Trend</div>'
    + '<div class="f1a-sub">' + leaderName + "'s points lead over P2</div>"
    + '<div class="f1a-bars">' + bars + '</div>'
    + '<div class="f1a-sub">Now: +' + points[points.length-1].gap + ' pts</div></div>';
  appendAsync(html);
}

// ---- 3. TEAMMATE HEAD-TO-HEAD ----
async function renderTeammateH2H() {
  var data = await f1Fetch('/current/driverstandings.json?limit=30', 7000);
  var sl = data && data.MRData && data.MRData.StandingsTable && data.MRData.StandingsTable.StandingsLists[0];
  if (!sl) return;
  var byTeam = {};
  sl.DriverStandings.forEach(function(d) {
    var c = d.Constructors && d.Constructors[0];
    if (!c) return;
    if (typeof registerDriverColor === 'function') registerDriverColor(d.Driver.familyName, c.constructorId);
    (byTeam[c.constructorId] = byTeam[c.constructorId] || { name: c.name, drivers: [] }).drivers.push({
      name: d.Driver.familyName, pts: parseFloat(d.points), pos: parseInt(d.position),
      cid: c.constructorId
    });
  });
  var html = '<div class="f1a-card"><div class="f1a-h">\u2694\uFE0F Teammate Battles</div>';
  Object.keys(byTeam).forEach(function(tid) {
    var t = byTeam[tid];
    if (t.drivers.length < 2) return;
    t.drivers.sort(function(a,b){ return b.pts - a.pts; });
    var a = t.drivers[0], b = t.drivers[1];
    var total = (a.pts + b.pts) || 1;
    var aPct = Math.round((a.pts / total) * 100);
    var col = (typeof TEAM_COLORS !== 'undefined' && TEAM_COLORS[tid]) || '#8a8fa8';
    html += '<div class="f1a-h2h">'
      + '<div class="f1a-h2h-top">'
      + '<span class="f1a-h2h-left" style="color:' + col + '">' + a.name + ' <strong>' + a.pts + '</strong></span>'
      + '<span class="f1a-h2h-logo">' + teamLogo(tid, t.name) + '</span>'
      + '<span class="f1a-h2h-right" style="color:' + col + '"><strong>' + b.pts + '</strong> ' + b.name + '</span></div>'
      + '<div class="f1a-h2h-bar"><div class="f1a-h2h-fill" style="width:' + aPct + '%;background:' + col + '"></div></div>'
      + '</div>';
  });
  html += '</div>';
  appendAsync(html);
}

// ---- 4. FORM GUIDE (last 5 race finishes per top driver) ----
async function renderFormGuide() {
  var sd = await f1Fetch('/current/driverstandings.json?limit=5', 6000);
  var sl = sd && sd.MRData && sd.MRData.StandingsTable && sd.MRData.StandingsTable.StandingsLists[0];
  if (!sl) return;
  var round = parseInt(sl.round);
  var start = Math.max(1, round - 4);
  var reqs = [];
  for (var r = start; r <= round; r++) reqs.push(f1Fetch('/current/' + r + '/results.json?limit=30', 6000));
  var races = await Promise.all(reqs);
  // build finishing pos per driver
  var form = {}; // driverId -> [pos,...]
  var nameOf = {};
  races.forEach(function(rd) {
    var race = rd && rd.MRData && rd.MRData.RaceTable && rd.MRData.RaceTable.Races[0];
    if (!race || !race.Results) return;
    race.Results.forEach(function(res) {
      var id = res.Driver.driverId;
      nameOf[id] = res.Driver.familyName;
      (form[id] = form[id] || []).push(parseInt(res.position));
    });
  });
  // show top 5 championship drivers
  var html = '<div class="f1a-card"><div class="f1a-h">\u{1F4CA} Form Guide \u00b7 last 5</div>';
  sl.DriverStandings.forEach(function(d) {
    var id = d.Driver.driverId;
    var nm = d.Driver.familyName;
    var col = (typeof driverColor === 'function') ? driverColor(nm) : '#e6e6e6';
    var arr = form[id] || [];
    var dots = arr.map(function(p) {
      var cls = p === 1 ? 'win' : (p <= 3 ? 'pod' : (p <= 10 ? 'pts' : 'out'));
      return '<span class="f1a-form-dot ' + cls + '">' + p + '</span>';
    }).join('');
    html += '<div class="f1a-form-row"><span class="f1a-name" style="color:' + col + '">' + nm + '</span><span class="f1a-form-dots">' + dots + '</span></div>';
  });
  html += '<div class="f1a-sub">\u{1F7E1} win \u00b7 \u{1F7E2} podium \u00b7 \u{1F535} points \u00b7 \u26AA out</div></div>';
  appendAsync(html);
}

// ---- 5. LAST RACE STRATEGY / PIT STOPS ----
async function renderLastRaceStrategy() {
  var data = await f1Fetch('/current/last/pitstops.json?limit=100', 7000);
  var race = data && data.MRData && data.MRData.RaceTable && data.MRData.RaceTable.Races[0];
  if (!race || !race.PitStops) return;
  var stops = race.PitStops;
  // count stops per driver + fastest stop
  var perDriver = {};
  var fastest = null;
  stops.forEach(function(p) {
    (perDriver[p.driverId] = perDriver[p.driverId] || []).push(p);
    var dur = parseFloat(p.duration);
    if (!isNaN(dur) && (!fastest || dur < parseFloat(fastest.duration))) fastest = p;
  });
  var html = '<div class="f1a-card"><div class="f1a-h">\u{1F6E0}\uFE0F ' + race.raceName.replace(' Grand Prix','') + ' \u00b7 Strategy</div>';
  function cleanName(id) {
    var parts = id.split('_');
    var last = parts[parts.length - 1];
    return last.charAt(0).toUpperCase() + last.slice(1);
  }
  if (fastest) {
    var fn = cleanName(fastest.driverId);
    html += '<div class="f1a-sub">Fastest stop: <strong style="color:' + (typeof driverColor==='function'?driverColor(fn):'#fff') + '">' + fn + '</strong> ' + fastest.duration + 's (lap ' + fastest.lap + ')</div>';
  }
  var ids = Object.keys(perDriver).slice(0, 10);
  ids.forEach(function(id) {
    var arr = perDriver[id];
    var nm = cleanName(id);
    var col = (typeof driverColor === 'function') ? driverColor(nm) : '#e6e6e6';
    var laps = arr.map(function(s){ return 'L' + s.lap; }).join(' \u00b7 ');
    html += '<div class="f1a-strat-row"><span class="f1a-name" style="color:' + col + '">' + nm + '</span><span class="f1a-strat-stops">' + arr.length + ' stop' + (arr.length>1?'s':'') + '</span><span class="f1a-strat-laps">' + laps + '</span></div>';
  });
  html += '</div>';
  appendAsync(html);
}

function appendAsync(html) {
  var c = document.getElementById('f1a-async');
  if (c) c.insertAdjacentHTML('beforeend', html);
}
