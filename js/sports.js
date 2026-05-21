var TEAM_COLORS = {
  mercedes:'#00d2be', ferrari:'#e8002d', red_bull:'#3671c6',
  mclaren:'#ff8700', aston_martin:'#229971', alpine:'#0093cc',
  williams:'#64c4ff', rb:'#6692ff', kick_sauber:'#52e252', haas:'#b6babd'
};

// ── F1 CANADIAN GP 2026 — all times UTC ─────────────────
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
};

function getNextSession() {
  var now = Date.now();
  for (var i = 0; i < F1_SESSIONS.length; i++) {
    if (Date.parse(F1_SESSIONS[i].time) > now) return F1_SESSIONS[i];
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

  function renderPills() {
    if (!subEl) return;
    var now = Date.now();
    subEl.innerHTML = F1_SESSIONS.map(function(s) {
      var past = Date.parse(s.time) < now;
      return '<span class="session-pill' + (past ? ' past' : '') + '">' + s.name + '</span>';
    }).join('');
  }

  function tick() {
    var session = getNextSession();
    if (!session) {
      if (labelEl) labelEl.textContent = 'Weekend Complete';
      ['cd-days','cd-hours','cd-mins','cd-secs'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.textContent = '00';
      });
      renderPills();
      return;
    }
    if (labelEl) labelEl.textContent = 'Next: ' + session.name;
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
    renderPills();
  }

  tick();
  setInterval(tick, 1000);
}

// ── LEAGUE TAB SWITCHER ──────────────────────────────────
function switchLeague(league, el) {
  var iframe = document.getElementById('football-iframe');
  if (iframe) {
    iframe.src = 'https://www.sportbusy.com/embed?league=' + league + '&theme=dark';
  }
  document.querySelectorAll('.league-tab').forEach(function(t) {
    t.classList.remove('active');
  });
  if (el) el.classList.add('active');
}

// ── F1 STANDINGS ────────────────────────────────────────
var F1_STANDINGS_FALLBACK = [
  { pos:1, num:12, name:'Antonelli', cid:'mercedes',     pts:100, wins:3 },
  { pos:2, num:63, name:'Russell',   cid:'mercedes',     pts:80,  wins:1 },
  { pos:3, num:16, name:'Leclerc',   cid:'ferrari',      pts:59,  wins:0 },
  { pos:4, num:4,  name:'Norris',    cid:'mclaren',      pts:51,  wins:0 },
  { pos:5, num:44, name:'Hamilton',  cid:'ferrari',      pts:51,  wins:0 },
  { pos:6, num:81, name:'Piastri',   cid:'mclaren',      pts:43,  wins:0 },
  { pos:7, num:3,  name:'Verstappen',cid:'red_bull',     pts:26,  wins:0 },
  { pos:8, num:87, name:'Bearman',   cid:'haas',         pts:17,  wins:0 },
  { pos:9, num:10, name:'Gasly',     cid:'alpine',       pts:16,  wins:0 },
  { pos:10,num:30, name:'Lawson',    cid:'red_bull',     pts:10,  wins:0 },
];

function renderStandings(drivers, round) {
  var body    = document.getElementById('f1-standings-body');
  var roundEl = document.getElementById('f1-standings-round');
  if (!body) return;
  var maxPts = parseFloat(drivers[0].pts || drivers[0].points) || 1;
  if (roundEl) roundEl.textContent = round || '2026';
  var html = '<div class="f1-std-header"><span>POS</span><span>NO</span><span>DRIVER</span><span style="text-align:right">W</span><span style="text-align:right">PTS</span></div>';
  drivers.forEach(function(d) {
    var pos  = d.pos || parseInt(d.position);
    var num  = d.num || d.Driver && d.Driver.permanentNumber;
    var name = d.name || d.Driver && d.Driver.familyName;
    var cid  = d.cid  || d.Constructors && d.Constructors[0] && d.Constructors[0].constructorId || 'default';
    var pts  = parseFloat(d.pts || d.points);
    var wins = d.wins || 0;
    var col  = TEAM_COLORS[cid] || '#8a8fa8';
    var barW = Math.round((pts / maxPts) * 100);
    var pc   = pos === 1 ? 'p1' : pos === 2 ? 'p2' : pos === 3 ? 'p3' : '';
    html += '<div class="f1-std-row">'
      + '<span class="f1-pos ' + pc + '">' + pos + '</span>'
      + '<span class="f1-num" style="background:' + col + '22;color:' + col + '">' + num + '</span>'
      + '<div class="f1-driver-info"><span class="f1-driver-name">' + name + '</span>'
      + '<div class="f1-con-bar"><div class="f1-con-fill" style="width:' + barW + '%;background:' + col + '"></div></div></div>'
      + '<span class="f1-wins">' + wins + '</span>'
      + '<span class="f1-pts">' + pts + '</span></div>';
  });
  body.innerHTML = html;
}

async function loadF1Data() {
  var body = document.getElementById('f1-standings-body');
  if (!body) return;

  // show fallback immediately
  renderStandings(F1_STANDINGS_FALLBACK, '2026 · R4');

  try {
    var controller = new AbortController();
    var timer = setTimeout(function() { controller.abort(); }, 5000);
    var res = await fetch('https://api.jolpi.ca/ergast/f1/current/driverstandings.json?limit=20', { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return;
    var data = await res.json();
    var sl   = data && data.MRData && data.MRData.StandingsTable && data.MRData.StandingsTable.StandingsLists[0];
    if (!sl || !sl.DriverStandings || !sl.DriverStandings.length) return;
    var drivers = sl.DriverStandings.slice(0, 10);
    renderStandings(drivers, '2026 · R' + sl.round);
    var t = new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
    var updated = document.createElement('div');
    updated.className = 'f1-last-updated';
    updated.textContent = 'Live · Jolpica F1 API · ' + t;
    body.appendChild(updated);
  } catch(e) {
    // fallback already shown
  }
}

function loadFootballScores() {}
