// ============================================================
// f1-standings.js — driver/constructor standings render + live fetch
// Depends on: f1-data.js
// ============================================================

var currentStandingsView = 'driver';

function switchStandingsView(view) {
  currentStandingsView = view;
  var dBtn = document.getElementById('standings-btn-driver');
  var cBtn = document.getElementById('standings-btn-constructor');
  if (dBtn) dBtn.classList.toggle('active', view === 'driver');
  if (cBtn) cBtn.classList.toggle('active', view === 'constructor');
  renderStandingsView();
}

function renderStandingsView() {
  if (currentStandingsView === 'driver') {
    renderDriverStandings(F1_STANDINGS_FALLBACK, 'Fallback · R4');
    loadLiveDriverStandings();
  } else {
    renderConstructorStandings(F1_CONSTRUCTORS_FALLBACK, 'Fallback · R4');
    loadLiveConstructorStandings();
  }
}

function renderDriverStandings(drivers, round) {
  var body    = document.getElementById('f1-standings-body');
  var roundEl = document.getElementById('f1-standings-round');
  if (!body) return;
  var maxPts = parseFloat(drivers[0].pts || drivers[0].points) || 1;
  if (roundEl) roundEl.textContent = round || '2026';
  var html = '<div class="f1-std-header"><span>POS</span><span>NO</span><span>DRIVER</span><span style="text-align:right">W</span><span style="text-align:right">PTS</span></div>';
  drivers.forEach(function(d) {
    var pos  = d.pos  || parseInt(d.position);
    var num  = d.num  || (d.Driver && d.Driver.permanentNumber);
    var name = d.name || (d.Driver && d.Driver.familyName);
    var cid  = d.cid  || (d.Constructors && d.Constructors[0] && d.Constructors[0].constructorId) || 'default';
    var pts  = parseFloat(d.pts || d.points);
    var wins = d.wins || 0;
    var col  = TEAM_COLORS[cid] || '#8a8fa8';
    registerDriverColor(name, cid);
    var barW = Math.round((pts / maxPts) * 100);
    var pc   = pos === 1 ? 'p1' : pos === 2 ? 'p2' : pos === 3 ? 'p3' : '';
    var did  = d.driverId || (d.Driver && d.Driver.driverId) || '';
    var moveHtml = '';
    if (_prevPositions && did && _prevPositions[did]) {
      var delta = _prevPositions[did] - pos;
      if (delta > 0)      moveHtml = '<span class="f1-move up">\u25B2' + delta + '</span>';
      else if (delta < 0) moveHtml = '<span class="f1-move down">\u25BC' + Math.abs(delta) + '</span>';
      else                moveHtml = '<span class="f1-move same">\u2013</span>';
    }
    html += '<div class="f1-std-row" ' + (did ? 'onclick="openDriverDetail(\'' + did + '\',\'' + name + '\')" style="cursor:pointer"' : '') + '>'
      + '<span class="f1-pos ' + pc + '">' + pos + moveHtml + '</span>'
      + '<span class="f1-num" style="background:' + col + '22;color:' + col + '">' + num + '</span>'
      + '<div class="f1-driver-info">'
      + '<span class="f1-driver-line">' + teamLogo(cid) + '<span class="f1-driver-name">' + name + '</span></span>'
      + '<div class="f1-con-bar"><div class="f1-con-fill" style="width:' + barW + '%;background:' + col + '"></div></div></div>'
      + '<span class="f1-wins">' + wins + '</span>'
      + '<span class="f1-pts">' + pts + '</span></div>';
  });
  body.innerHTML = html;
  renderChampionshipContext(drivers, round);
}

function renderConstructorStandings(teams, round) {
  var body    = document.getElementById('f1-standings-body');
  var roundEl = document.getElementById('f1-standings-round');
  if (!body) return;
  var maxPts = parseFloat(teams[0].pts || teams[0].points) || 1;
  if (roundEl) roundEl.textContent = round || '2026';
  var html = '<div class="f1-std-header"><span>POS</span><span></span><span>TEAM</span><span style="text-align:right">W</span><span style="text-align:right">PTS</span></div>';
  teams.forEach(function(t) {
    var pos  = t.pos || parseInt(t.position);
    var name = t.name || (t.Constructor && t.Constructor.name);
    var cid  = t.cid  || (t.Constructor && t.Constructor.constructorId) || 'default';
    var pts  = parseFloat(t.pts || t.points);
    var wins = t.wins || 0;
    var col  = TEAM_COLORS[cid] || '#8a8fa8';
    var barW = Math.round((pts / maxPts) * 100);
    var pc   = pos === 1 ? 'p1' : pos === 2 ? 'p2' : pos === 3 ? 'p3' : '';
    html += '<div class="f1-std-row">'
      + '<span class="f1-pos ' + pc + '">' + pos + '</span>'
      + '<span class="f1-logo-wrap">' + teamLogo(cid, name) + '</span>'
      + '<div class="f1-driver-info"><span class="f1-driver-name">' + name + '</span>'
      + '<div class="f1-con-bar"><div class="f1-con-fill" style="width:' + barW + '%;background:' + col + '"></div></div></div>'
      + '<span class="f1-wins">' + wins + '</span>'
      + '<span class="f1-pts">' + pts + '</span></div>';
  });
  body.innerHTML = html;
}

var _prevPositions = null; // driverId -> previous round position

async function fetchPrevPositions(round) {
  if (round <= 1) return null;
  try {
    var res = await fetch('https://api.jolpi.ca/ergast/f1/current/' + (round - 1) + '/driverstandings.json?limit=30');
    if (!res.ok) return null;
    var data = await res.json();
    var sl = data.MRData.StandingsTable.StandingsLists[0];
    if (!sl) return null;
    var map = {};
    sl.DriverStandings.forEach(function(d){ map[d.Driver.driverId] = parseInt(d.position); });
    return map;
  } catch(e) { return null; }
}

async function loadLiveDriverStandings() {
  try {
    var controller = new AbortController();
    var timer = setTimeout(function() { controller.abort(); }, 5000);
    var res = await fetch('https://api.jolpi.ca/ergast/f1/current/driverstandings.json?limit=20', { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return;
    var data = await res.json();
    var sl = data && data.MRData && data.MRData.StandingsTable && data.MRData.StandingsTable.StandingsLists[0];
    if (!sl || !sl.DriverStandings || !sl.DriverStandings.length) return;
    if (currentStandingsView !== 'driver') return;
    _prevPositions = await fetchPrevPositions(parseInt(sl.round));
    renderDriverStandings(sl.DriverStandings.slice(0,10), 'Live · R' + sl.round);
    var t = new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
    var el = document.createElement('div');
    el.className = 'f1-last-updated';
    el.textContent = 'Jolpica F1 API · ' + t;
    document.getElementById('f1-standings-body').appendChild(el);
  } catch(e) {}
}

async function loadLiveConstructorStandings() {
  try {
    var controller = new AbortController();
    var timer = setTimeout(function() { controller.abort(); }, 5000);
    var res = await fetch('https://api.jolpi.ca/ergast/f1/current/constructorstandings.json?limit=20', { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return;
    var data = await res.json();
    var sl = data && data.MRData && data.MRData.StandingsTable && data.MRData.StandingsTable.StandingsLists[0];
    if (!sl || !sl.ConstructorStandings || !sl.ConstructorStandings.length) return;
    if (currentStandingsView !== 'constructor') return;
    renderConstructorStandings(sl.ConstructorStandings.slice(0,10), 'Live · R' + sl.round);
    var t = new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
    var el = document.createElement('div');
    el.className = 'f1-last-updated';
    el.textContent = 'Jolpica F1 API · ' + t;
    document.getElementById('f1-standings-body').appendChild(el);
  } catch(e) {}
}

function loadF1Data() { renderStandingsView(); }
