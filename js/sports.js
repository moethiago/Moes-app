var TEAM_COLORS = {
  mercedes:'#00d2be', ferrari:'#e8002d', red_bull:'#3671c6',
  mclaren:'#ff8700', aston_martin:'#229971', alpine:'#0093cc',
  williams:'#64c4ff', rb:'#6692ff', kick_sauber:'#52e252', haas:'#b6babd'
};

// ── F1 CANADIAN GP 2026 — all times in UTC ──────────────
var F1_SESSIONS = [
  { name:'Practice 1',        time:'2026-05-22T16:30:00Z' },
  { name:'Sprint Qualifying', time:'2026-05-22T20:30:00Z' },
  { name:'Sprint Race',       time:'2026-05-23T16:00:00Z' },
  { name:'Qualifying',        time:'2026-05-23T20:00:00Z' },
  { name:'Race',              time:'2026-05-24T20:00:00Z' },
];

var F1_RACE = {
  title:    'Canadian Grand Prix',
  location: 'Circuit Gilles Villeneuve, Montreal',
  round:    'Round 5 · Sprint Weekend',
};

function getNextSession() {
  var now = Date.now();
  for (var i = 0; i < F1_SESSIONS.length; i++) {
    if (Date.parse(F1_SESSIONS[i].time) > now) {
      return F1_SESSIONS[i];
    }
  }
  return null;
}

function startCountdown() {
  var trackEl  = document.getElementById('f1-next-track');
  var sessEl   = document.getElementById('f1-next-session');
  var labelEl  = document.getElementById('f1-session-label');
  var subEl    = document.getElementById('f1-cd-sub');

  if (trackEl) trackEl.textContent = F1_RACE.title;
  if (sessEl)  sessEl.textContent  = F1_RACE.location;

  function tick() {
    var session = getNextSession();
    if (!session) {
      if (labelEl) labelEl.textContent = 'Race Weekend Over';
      ['cd-days','cd-hours','cd-mins','cd-secs'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.textContent = '00';
      });
      return;
    }

    if (labelEl) labelEl.textContent = session.name;

    var diff = Date.parse(session.time) - Date.now();
    if (diff <= 0) { tick(); return; }

    var d = document.getElementById('cd-days');
    var h = document.getElementById('cd-hours');
    var m = document.getElementById('cd-mins');
    var s = document.getElementById('cd-secs');
    if (d) d.textContent = String(Math.floor(diff / 86400000)).padStart(2,'0');
    if (h) h.textContent = String(Math.floor(diff % 86400000 / 3600000)).padStart(2,'0');
    if (m) m.textContent = String(Math.floor(diff % 3600000 / 60000)).padStart(2,'0');
    if (s) s.textContent = String(Math.floor(diff % 60000 / 1000)).padStart(2,'0');
  }

  // build session pills
  if (subEl) {
    var pills = F1_SESSIONS.map(function(s) {
      var past = Date.parse(s.time) < Date.now();
      return '<span class="session-pill' + (past ? ' past' : '') + '">' + s.name + '</span>';
    }).join('');
    subEl.innerHTML = pills;
  }

  tick();
  setInterval(function() {
    tick();
    // refresh pills
    if (subEl) {
      var pills = F1_SESSIONS.map(function(s) {
        var past = Date.parse(s.time) < Date.now();
        return '<span class="session-pill' + (past ? ' past' : '') + '">' + s.name + '</span>';
      }).join('');
      subEl.innerHTML = pills;
    }
  }, 1000);
}

// ── F1 STANDINGS ────────────────────────────────────────

var F1_STANDINGS_2026 = [
  { pos:1, num:12, name:'Antonelli', cid:'mercedes',     pts:100, wins:3 },
  { pos:2, num:63, name:'Russell',   cid:'mercedes',     pts:80,  wins:1 },
  { pos:3, num:16, name:'Leclerc',   cid:'ferrari',      pts:59,  wins:0 },
  { pos:4, num:4,  name:'Norris',    cid:'mclaren',      pts:51,  wins:0 },
  { pos:5, num:44, name:'Hamilton',  cid:'ferrari',      pts:51,  wins:0 },
  { pos:6, num:81, name:'Piastri',   cid:'mclaren',      pts:43,  wins:0 },
  { pos:7, num:14, name:'Alonso',    cid:'aston_martin', pts:24,  wins:0 },
  { pos:8, num:18, name:'Stroll',    cid:'aston_martin', pts:12,  wins:0 },
  { pos:9, num:10, name:'Gasly',     cid:'alpine',       pts:10,  wins:0 },
  { pos:10,num:55, name:'Sainz',     cid:'williams',     pts:9,   wins:0 },
];

function renderHardcodedStandings(body) {
  var maxPts = F1_STANDINGS_2026[0].pts;
  var html = '<div class="f1-std-header"><span>POS</span><span>NO</span><span>DRIVER</span><span style="text-align:right">W</span><span style="text-align:right">PTS</span></div>';
  F1_STANDINGS_2026.forEach(function(d) {
    var col  = TEAM_COLORS[d.cid] || '#8a8fa8';
    var barW = Math.round((d.pts / maxPts) * 100);
    var pc   = d.pos === 1 ? 'p1' : d.pos === 2 ? 'p2' : d.pos === 3 ? 'p3' : '';
    html += '<div class="f1-std-row">'
      + '<span class="f1-pos ' + pc + '">' + d.pos + '</span>'
      + '<span class="f1-num" style="background:' + col + '22;color:' + col + '">' + d.num + '</span>'
      + '<div class="f1-driver-info"><span class="f1-driver-name">' + d.name + '</span>'
      + '<div class="f1-con-bar"><div class="f1-con-fill" style="width:' + barW + '%;background:' + col + '"></div></div></div>'
      + '<span class="f1-wins">' + d.wins + '</span>'
      + '<span class="f1-pts">' + d.pts + '</span></div>';
  });
  html += '<div class="f1-last-updated">After R4 Miami · May 19 2026</div>';
  body.innerHTML = html;
}

async function loadF1Data() {
  var body    = document.getElementById('f1-standings-body');
  var roundEl = document.getElementById('f1-standings-round');
  if (!body) return;

  renderHardcodedStandings(body);
  if (roundEl) roundEl.textContent = '2026 · R4';

  try {
    var controller = new AbortController();
    var timer = setTimeout(function() { controller.abort(); }, 5000);
    var res = await fetch('https://api.jolpi.ca/ergast/f1/current/driverstandings.json?limit=20', { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return;
    var data = await res.json();
    var sl   = data && data.MRData && data.MRData.StandingsTable && data.MRData.StandingsTable.StandingsLists[0];
    if (!sl || !sl.DriverStandings || !sl.DriverStandings.length) return;
    if (roundEl) roundEl.textContent = '2026 · R' + sl.round;
    var drivers = sl.DriverStandings.slice(0, 10);
    var maxPts  = parseFloat(drivers[0].points) || 1;
    var html = '<div class="f1-std-header"><span>POS</span><span>NO</span><span>DRIVER</span><span style="text-align:right">W</span><span style="text-align:right">PTS</span></div>';
    drivers.forEach(function(d) {
      var pos  = parseInt(d.position);
      var cid  = d.Constructors && d.Constructors[0] ? d.Constructors[0].constructorId : 'default';
      var col  = TEAM_COLORS[cid] || '#8a8fa8';
      var pts  = parseFloat(d.points);
      var barW = Math.round((pts / maxPts) * 100);
      var pc   = pos === 1 ? 'p1' : pos === 2 ? 'p2' : pos === 3 ? 'p3' : '';
      html += '<div class="f1-std-row">'
        + '<span class="f1-pos ' + pc + '">' + pos + '</span>'
        + '<span class="f1-num" style="background:' + col + '22;color:' + col + '">' + d.Driver.permanentNumber + '</span>'
        + '<div class="f1-driver-info"><span class="f1-driver-name">' + d.Driver.familyName + '</span>'
        + '<div class="f1-con-bar"><div class="f1-con-fill" style="width:' + barW + '%;background:' + col + '"></div></div></div>'
        + '<span class="f1-wins">' + d.wins + '</span>'
        + '<span class="f1-pts">' + pts + '</span></div>';
    });
    var t = new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
    html += '<div class="f1-last-updated">Live · Jolpica F1 API · ' + t + '</div>';
    body.innerHTML = html;
  } catch(e) {}
}

// ── FOOTBALL & SPL SCORES — ScoreAxis widgets ───────────
// Widgets are rendered directly in HTML — no JS needed here
function loadFootballScores() {
  // ScoreAxis widgets self-update in real time — just show them
  var container = document.getElementById('football-scores-container');
  if (container) container.style.display = 'block';
}
