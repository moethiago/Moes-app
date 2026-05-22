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

// ── FOOTBALL CONFIG ──────────────────────────────────────
var BACKEND_URL = 'https://moes-app-two.vercel.app/api/football';

var FOOTBALL_LEAGUES = [
  { key:'epl',        label:'Premier League',  flag:'🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { key:'laliga',     label:'La Liga',          flag:'🇪🇸' },
  { key:'seriea',     label:'Serie A',          flag:'🇮🇹' },
  { key:'bundesliga', label:'Bundesliga',       flag:'🇩🇪' },
  { key:'ligue1',     label:'Ligue 1',          flag:'🇫🇷' },
  { key:'ucl',        label:'Champions League', flag:'🏆' },
  { key:'spl',        label:'Saudi Pro League', flag:'🇸🇦' },
  { key:'nations',    label:'Nations League',   flag:'🌍' },
];

var footballTimer = null;

// ── F1 COUNTDOWN ─────────────────────────────────────────
function getNextSession() {
  var now = Date.now();
  for (var i = 0; i < F1_SESSIONS.length; i++) {
    if (Date.parse(F1_SESSIONS[i].time) > now) return F1_SESSIONS[i];
  }
  return null;
}

function startCountdown() {
  var trackEl = document.getElementById('f1-next-track');
  var sessEl  = document.getElementById('f1-next-session');
  var labelEl = document.getElementById('f1-session-label');
  var subEl   = document.getElementById('f1-cd-sub');

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

// ── FOOTBALL SCORES ──────────────────────────────────────
function statusLabel(status, elapsed) {
  if (['LIVE','1H','2H','ET','P'].indexOf(status) !== -1) {
    return '<span class="fxt-status live">' + (elapsed ? elapsed + "'" : 'LIVE') + '</span>';
  }
  if (status === 'HT')   return '<span class="fxt-status ht">HT</span>';
  if (status === 'FT')   return '<span class="fxt-status ft">FT</span>';
  if (status === 'NS')   return '<span class="fxt-status ns">NS</span>';
  if (status === 'PST')  return '<span class="fxt-status pst">PST</span>';
  if (status === 'CANC') return '<span class="fxt-status ft">CANC</span>';
  return '<span class="fxt-status ns">' + status + '</span>';
}

function formatKickoff(dateStr) {
  var d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit', timeZone:'Asia/Riyadh' });
}

function isLive(status) {
  return ['LIVE','1H','2H','HT','ET','P'].indexOf(status) !== -1;
}

function renderLeagueBlock(league, fixtures) {
  // only render leagues that have matches
  if (!fixtures || !fixtures.length) return '';

  fixtures.sort(function(a, b) {
    var aLive = isLive(a.status) ? 0 : 1;
    var bLive = isLive(b.status) ? 0 : 1;
    if (aLive !== bLive) return aLive - bLive;
    return new Date(a.time) - new Date(b.time);
  });

  var html = '<div class="fxt-league-block">'
    + '<div class="fxt-league-header">'
    + '<span class="fxt-league-flag">' + league.flag + '</span>'
    + '<span class="fxt-league-name">' + league.label + '</span>'
    + '</div>';

  fixtures.forEach(function(f) {
    var live     = isLive(f.status);
    var hasScore = f.homeScore !== null && f.awayScore !== null;
    var kickoff  = formatKickoff(f.time);
    html += '<div class="fxt-row' + (live ? ' fxt-live' : '') + '">'
      + '<div class="fxt-teams">'
      +   '<div class="fxt-team">'
      +     '<img class="fxt-logo" src="' + f.homeLogo + '" onerror="this.style.display=\'none\'">'
      +     '<span class="fxt-name' + (live && f.homeScore > f.awayScore ? ' fxt-winning' : '') + '">' + f.home + '</span>'
      +   '</div>'
      +   '<div class="fxt-team">'
      +     '<img class="fxt-logo" src="' + f.awayLogo + '" onerror="this.style.display=\'none\'">'
      +     '<span class="fxt-name' + (live && f.awayScore > f.homeScore ? ' fxt-winning' : '') + '">' + f.away + '</span>'
      +   '</div>'
      + '</div>'
      + '<div class="fxt-right">'
      +   (hasScore
          ? '<div class="fxt-score' + (live ? ' fxt-score-live' : '') + '">'
            + '<span>' + f.homeScore + '</span>'
            + '<span class="fxt-score-sep">-</span>'
            + '<span>' + f.awayScore + '</span>'
            + '</div>'
          : '<div class="fxt-kickoff">' + kickoff + '</div>')
      +   statusLabel(f.status, f.elapsed)
      + '</div>'
      + '</div>';
  });

  html += '</div>';
  return html;
}

async function fetchLeague(leagueKey) {
  try {
    var controller = new AbortController();
    var timer = setTimeout(function() { controller.abort(); }, 8000);
    var res = await fetch(BACKEND_URL + '?league=' + leagueKey, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return { key: leagueKey, fixtures: [] };
    var data = await res.json();
    return { key: leagueKey, fixtures: data.fixtures || [] };
  } catch(e) {
    return { key: leagueKey, fixtures: [] };
  }
}

async function loadAllFootball() {
  var container = document.getElementById('football-fixtures');
  if (!container) return;

  container.innerHTML = '<div class="fxt-loading"><div class="f1-spinner"></div><span>Loading fixtures...</span></div>';

  // fetch all leagues in parallel
  var results = await Promise.all(
    FOOTBALL_LEAGUES.map(function(l) { return fetchLeague(l.key); })
  );

  var html = '';
  var totalMatches = 0;

  FOOTBALL_LEAGUES.forEach(function(league, i) {
    var fixtures = results[i].fixtures;
    totalMatches += fixtures.length;
    html += renderLeagueBlock(league, fixtures);
  });

  if (totalMatches === 0) {
    container.innerHTML = '<div class="fxt-empty" style="padding:32px 16px;">No matches today across all leagues</div>';
    return;
  }

  container.innerHTML = html;
}

function buildFootballSection() {
  // remove tabs container if it exists
  var tabsEl = document.getElementById('football-tabs');
  if (tabsEl) tabsEl.style.display = 'none';

  loadAllFootball();

  // auto-refresh every 60s
  if (footballTimer) clearInterval(footballTimer);
  footballTimer = setInterval(loadAllFootball, 60000);
}

// ── F1 STANDINGS ─────────────────────────────────────────
var F1_STANDINGS_FALLBACK = [
  { pos:1,  num:12, name:'Antonelli',  cid:'mercedes',     pts:100, wins:3 },
  { pos:2,  num:63, name:'Russell',    cid:'mercedes',     pts:80,  wins:1 },
  { pos:3,  num:16, name:'Leclerc',    cid:'ferrari',      pts:59,  wins:0 },
  { pos:4,  num:4,  name:'Norris',     cid:'mclaren',      pts:51,  wins:0 },
  { pos:5,  num:44, name:'Hamilton',   cid:'ferrari',      pts:51,  wins:0 },
  { pos:6,  num:81, name:'Piastri',    cid:'mclaren',      pts:43,  wins:0 },
  { pos:7,  num:3,  name:'Verstappen', cid:'red_bull',     pts:26,  wins:0 },
  { pos:8,  num:87, name:'Bearman',    cid:'haas',         pts:17,  wins:0 },
  { pos:9,  num:10, name:'Gasly',      cid:'alpine',       pts:16,  wins:0 },
  { pos:10, num:30, name:'Lawson',     cid:'red_bull',     pts:10,  wins:0 },
];

function renderStandings(drivers, round) {
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
  renderStandings(F1_STANDINGS_FALLBACK, '2026 · R4');
  try {
    var controller = new AbortController();
    var timer = setTimeout(function() { controller.abort(); }, 5000);
    var res = await fetch('https://api.jolpi.ca/ergast/f1/current/driverstandings.json?limit=20', { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return;
    var data = await res.json();
    var sl = data && data.MRData && data.MRData.StandingsTable && data.MRData.StandingsTable.StandingsLists[0];
    if (!sl || !sl.DriverStandings || !sl.DriverStandings.length) return;
    renderStandings(sl.DriverStandings.slice(0, 10), '2026 · R' + sl.round);
    var t = new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
    var updated = document.createElement('div');
    updated.className = 'f1-last-updated';
    updated.textContent = 'Live · Jolpica F1 API · ' + t;
    body.appendChild(updated);
  } catch(e) {}
}

function loadFootballScores() {
  buildFootballSection();
}
