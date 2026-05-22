var TEAM_COLORS = {
  mercedes:'#00d2be', ferrari:'#e8002d', red_bull:'#3671c6',
  mclaren:'#ff8700', aston_martin:'#229971', alpine:'#0093cc',
  williams:'#64c4ff', rb:'#6692ff', kick_sauber:'#52e252', haas:'#b6babd'
};

// ── F1 2026 FULL SEASON CALENDAR — all times UTC ─────────
var F1_CALENDAR = [
  {
    race:'Australian Grand Prix', circuit:'Albert Park, Melbourne', round:'Round 1',
    sessions:[
      { name:'Practice 1',        time:'2026-03-13T01:30:00Z' },
      { name:'Practice 2',        time:'2026-03-13T05:00:00Z' },
      { name:'Practice 3',        time:'2026-03-14T01:30:00Z' },
      { name:'Qualifying',        time:'2026-03-14T05:00:00Z' },
      { name:'Race',              time:'2026-03-15T05:00:00Z' },
    ]
  },
  {
    race:'Chinese Grand Prix', circuit:'Shanghai International Circuit', round:'Round 2',
    sessions:[
      { name:'Practice 1',        time:'2026-03-20T03:30:00Z' },
      { name:'Sprint Qualifying', time:'2026-03-20T07:30:00Z' },
      { name:'Sprint Race',       time:'2026-03-21T03:00:00Z' },
      { name:'Qualifying',        time:'2026-03-21T07:00:00Z' },
      { name:'Race',              time:'2026-03-22T07:00:00Z' },
    ]
  },
  {
    race:'Japanese Grand Prix', circuit:'Suzuka Circuit', round:'Round 3',
    sessions:[
      { name:'Practice 1',        time:'2026-04-03T02:30:00Z' },
      { name:'Practice 2',        time:'2026-04-03T06:00:00Z' },
      { name:'Practice 3',        time:'2026-04-04T02:30:00Z' },
      { name:'Qualifying',        time:'2026-04-04T06:00:00Z' },
      { name:'Race',              time:'2026-04-05T05:00:00Z' },
    ]
  },
  {
    race:'Bahrain Grand Prix', circuit:'Bahrain International Circuit', round:'Round 4',
    sessions:[
      { name:'Practice 1',        time:'2026-04-17T11:30:00Z' },
      { name:'Practice 2',        time:'2026-04-17T15:00:00Z' },
      { name:'Practice 3',        time:'2026-04-18T11:30:00Z' },
      { name:'Qualifying',        time:'2026-04-18T15:00:00Z' },
      { name:'Race',              time:'2026-04-19T15:00:00Z' },
    ]
  },
  {
    race:'Miami Grand Prix', circuit:'Miami International Autodrome', round:'Round 5 · Sprint Weekend',
    sessions:[
      { name:'Practice 1',        time:'2026-05-02T16:30:00Z' },
      { name:'Sprint Qualifying', time:'2026-05-02T20:30:00Z' },
      { name:'Sprint Race',       time:'2026-05-03T16:00:00Z' },
      { name:'Qualifying',        time:'2026-05-03T20:00:00Z' },
      { name:'Race',              time:'2026-05-04T20:00:00Z' },
    ]
  },
  {
    race:'Canadian Grand Prix', circuit:'Circuit Gilles Villeneuve, Montreal', round:'Round 6 · Sprint Weekend',
    sessions:[
      { name:'Practice 1',        time:'2026-05-22T16:30:00Z' },
      { name:'Sprint Qualifying', time:'2026-05-22T20:30:00Z' },
      { name:'Sprint Race',       time:'2026-05-23T16:00:00Z' },
      { name:'Qualifying',        time:'2026-05-23T20:00:00Z' },
      { name:'Race',              time:'2026-05-24T20:00:00Z' },
    ]
  },
  {
    race:'Spanish Grand Prix', circuit:'Circuit de Barcelona-Catalunya', round:'Round 7',
    sessions:[
      { name:'Practice 1',        time:'2026-05-29T11:30:00Z' },
      { name:'Practice 2',        time:'2026-05-29T15:00:00Z' },
      { name:'Practice 3',        time:'2026-05-30T10:30:00Z' },
      { name:'Qualifying',        time:'2026-05-30T14:00:00Z' },
      { name:'Race',              time:'2026-05-31T13:00:00Z' },
    ]
  },
  {
    race:'Austrian Grand Prix', circuit:'Red Bull Ring, Spielberg', round:'Round 8 · Sprint Weekend',
    sessions:[
      { name:'Practice 1',        time:'2026-06-26T10:30:00Z' },
      { name:'Sprint Qualifying', time:'2026-06-26T14:30:00Z' },
      { name:'Sprint Race',       time:'2026-06-27T10:00:00Z' },
      { name:'Qualifying',        time:'2026-06-27T14:00:00Z' },
      { name:'Race',              time:'2026-06-28T13:00:00Z' },
    ]
  },
  {
    race:'British Grand Prix', circuit:'Silverstone Circuit', round:'Round 9',
    sessions:[
      { name:'Practice 1',        time:'2026-07-03T11:30:00Z' },
      { name:'Practice 2',        time:'2026-07-03T15:00:00Z' },
      { name:'Practice 3',        time:'2026-07-04T10:30:00Z' },
      { name:'Qualifying',        time:'2026-07-04T14:00:00Z' },
      { name:'Race',              time:'2026-07-05T14:00:00Z' },
    ]
  },
  {
    race:'Belgian Grand Prix', circuit:'Circuit de Spa-Francorchamps', round:'Round 10',
    sessions:[
      { name:'Practice 1',        time:'2026-07-24T11:30:00Z' },
      { name:'Practice 2',        time:'2026-07-24T15:00:00Z' },
      { name:'Practice 3',        time:'2026-07-25T10:30:00Z' },
      { name:'Qualifying',        time:'2026-07-25T14:00:00Z' },
      { name:'Race',              time:'2026-07-26T13:00:00Z' },
    ]
  },
  {
    race:'Hungarian Grand Prix', circuit:'Hungaroring, Budapest', round:'Round 11',
    sessions:[
      { name:'Practice 1',        time:'2026-07-31T11:30:00Z' },
      { name:'Practice 2',        time:'2026-07-31T15:00:00Z' },
      { name:'Practice 3',        time:'2026-08-01T10:30:00Z' },
      { name:'Qualifying',        time:'2026-08-01T14:00:00Z' },
      { name:'Race',              time:'2026-08-02T13:00:00Z' },
    ]
  },
  {
    race:'Dutch Grand Prix', circuit:'Circuit Zandvoort', round:'Round 12',
    sessions:[
      { name:'Practice 1',        time:'2026-08-28T10:30:00Z' },
      { name:'Practice 2',        time:'2026-08-28T14:00:00Z' },
      { name:'Practice 3',        time:'2026-08-29T09:30:00Z' },
      { name:'Qualifying',        time:'2026-08-29T13:00:00Z' },
      { name:'Race',              time:'2026-08-30T13:00:00Z' },
    ]
  },
  {
    race:'Italian Grand Prix', circuit:'Autodromo Nazionale Monza', round:'Round 13',
    sessions:[
      { name:'Practice 1',        time:'2026-09-04T11:30:00Z' },
      { name:'Practice 2',        time:'2026-09-04T15:00:00Z' },
      { name:'Practice 3',        time:'2026-09-05T10:30:00Z' },
      { name:'Qualifying',        time:'2026-09-05T14:00:00Z' },
      { name:'Race',              time:'2026-09-06T13:00:00Z' },
    ]
  },
  {
    race:'Azerbaijan Grand Prix', circuit:'Baku City Circuit', round:'Round 14',
    sessions:[
      { name:'Practice 1',        time:'2026-09-18T09:30:00Z' },
      { name:'Practice 2',        time:'2026-09-18T13:00:00Z' },
      { name:'Practice 3',        time:'2026-09-19T08:30:00Z' },
      { name:'Qualifying',        time:'2026-09-19T12:00:00Z' },
      { name:'Race',              time:'2026-09-20T11:00:00Z' },
    ]
  },
  {
    race:'Singapore Grand Prix', circuit:'Marina Bay Street Circuit', round:'Round 15',
    sessions:[
      { name:'Practice 1',        time:'2026-10-02T09:30:00Z' },
      { name:'Practice 2',        time:'2026-10-02T13:00:00Z' },
      { name:'Practice 3',        time:'2026-10-03T09:30:00Z' },
      { name:'Qualifying',        time:'2026-10-03T13:00:00Z' },
      { name:'Race',              time:'2026-10-04T12:00:00Z' },
    ]
  },
  {
    race:'United States Grand Prix', circuit:'Circuit of the Americas, Austin', round:'Round 16 · Sprint Weekend',
    sessions:[
      { name:'Practice 1',        time:'2026-10-16T17:30:00Z' },
      { name:'Sprint Qualifying', time:'2026-10-16T21:30:00Z' },
      { name:'Sprint Race',       time:'2026-10-17T17:00:00Z' },
      { name:'Qualifying',        time:'2026-10-17T21:00:00Z' },
      { name:'Race',              time:'2026-10-18T19:00:00Z' },
    ]
  },
  {
    race:'Mexico City Grand Prix', circuit:'Autodromo Hermanos Rodriguez', round:'Round 17',
    sessions:[
      { name:'Practice 1',        time:'2026-10-23T18:30:00Z' },
      { name:'Practice 2',        time:'2026-10-23T22:00:00Z' },
      { name:'Practice 3',        time:'2026-10-24T17:30:00Z' },
      { name:'Qualifying',        time:'2026-10-24T21:00:00Z' },
      { name:'Race',              time:'2026-10-25T20:00:00Z' },
    ]
  },
  {
    race:'São Paulo Grand Prix', circuit:'Autodromo Jose Carlos Pace, Interlagos', round:'Round 18 · Sprint Weekend',
    sessions:[
      { name:'Practice 1',        time:'2026-11-06T14:30:00Z' },
      { name:'Sprint Qualifying', time:'2026-11-06T18:30:00Z' },
      { name:'Sprint Race',       time:'2026-11-07T14:00:00Z' },
      { name:'Qualifying',        time:'2026-11-07T18:00:00Z' },
      { name:'Race',              time:'2026-11-08T17:00:00Z' },
    ]
  },
  {
    race:'Las Vegas Grand Prix', circuit:'Las Vegas Street Circuit', round:'Round 19',
    sessions:[
      { name:'Practice 1',        time:'2026-11-19T04:30:00Z' },
      { name:'Practice 2',        time:'2026-11-19T08:00:00Z' },
      { name:'Practice 3',        time:'2026-11-20T04:30:00Z' },
      { name:'Qualifying',        time:'2026-11-20T08:00:00Z' },
      { name:'Race',              time:'2026-11-21T06:00:00Z' },
    ]
  },
  {
    race:'Qatar Grand Prix', circuit:'Lusail International Circuit', round:'Round 20 · Sprint Weekend',
    sessions:[
      { name:'Practice 1',        time:'2026-11-27T13:30:00Z' },
      { name:'Sprint Qualifying', time:'2026-11-27T17:30:00Z' },
      { name:'Sprint Race',       time:'2026-11-28T13:00:00Z' },
      { name:'Qualifying',        time:'2026-11-28T17:00:00Z' },
      { name:'Race',              time:'2026-11-29T17:00:00Z' },
    ]
  },
  {
    race:'Abu Dhabi Grand Prix', circuit:'Yas Marina Circuit', round:'Round 21 · Season Finale',
    sessions:[
      { name:'Practice 1',        time:'2026-12-04T09:30:00Z' },
      { name:'Practice 2',        time:'2026-12-04T13:00:00Z' },
      { name:'Practice 3',        time:'2026-12-05T09:30:00Z' },
      { name:'Qualifying',        time:'2026-12-05T13:00:00Z' },
      { name:'Race',              time:'2026-12-06T13:00:00Z' },
    ]
  },
];

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
function getNextRaceAndSession() {
  var now = Date.now();
  for (var r = 0; r < F1_CALENDAR.length; r++) {
    var raceWeekend = F1_CALENDAR[r];
    for (var s = 0; s < raceWeekend.sessions.length; s++) {
      var session = raceWeekend.sessions[s];
      if (Date.parse(session.time) > now) {
        return { race: raceWeekend, session: session };
      }
    }
  }
  return null;
}

function startCountdown() {
  var trackEl = document.getElementById('f1-next-track');
  var sessEl  = document.getElementById('f1-next-session');
  var labelEl = document.getElementById('f1-session-label');
  var subEl   = document.getElementById('f1-cd-sub');

  function renderPills(raceWeekend) {
    if (!subEl || !raceWeekend) return;
    var now = Date.now();
    subEl.innerHTML = raceWeekend.sessions.map(function(s) {
      var past = Date.parse(s.time) < now;
      return '<span class="session-pill' + (past ? ' past' : '') + '">' + s.name + '</span>';
    }).join('');
  }

  function tick() {
    var next = getNextRaceAndSession();

    if (!next) {
      if (trackEl) trackEl.textContent = '2026 Season Complete';
      if (sessEl)  sessEl.textContent  = 'See you in 2027';
      if (labelEl) labelEl.textContent = '';
      ['cd-days','cd-hours','cd-mins','cd-secs'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.textContent = '00';
      });
      if (subEl) subEl.innerHTML = '';
      return;
    }

    if (trackEl) trackEl.textContent = next.race.race;
    if (sessEl)  sessEl.textContent  = next.race.circuit + ' · ' + next.race.round;
    if (labelEl) labelEl.textContent = 'Next: ' + next.session.name;

    var diff = Date.parse(next.session.time) - Date.now();
    if (diff <= 0) { tick(); return; }

    var d = document.getElementById('cd-days');
    var h = document.getElementById('cd-hours');
    var m = document.getElementById('cd-mins');
    var s = document.getElementById('cd-secs');
    if (d) d.textContent = String(Math.floor(diff / 86400000)).padStart(2,'0');
    if (h) h.textContent = String(Math.floor(diff % 86400000 / 3600000)).padStart(2,'0');
    if (m) m.textContent = String(Math.floor(diff % 3600000 / 60000)).padStart(2,'0');
    if (s) s.textContent = String(Math.floor(diff % 60000 / 1000)).padStart(2,'0');

    renderPills(next.race);
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

function formatDate(dateStr) {
  var d = new Date(dateStr);
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return months[d.getMonth()] + ' ' + d.getDate();
}

function isLive(status) {
  return ['LIVE','1H','2H','HT','ET','P'].indexOf(status) !== -1;
}

function renderLeagueBlock(league, data) {
  var fixtures  = data.fixtures  || [];
  var upcoming  = data.upcoming  || [];
  var hasLive   = fixtures.some(function(f) { return isLive(f.status); });

  // nothing at all — skip this league block entirely
  if (!fixtures.length && !upcoming.length) return '';

  var html = '<div class="fxt-league-block">'
    + '<div class="fxt-league-header">'
    + '<span class="fxt-league-flag">' + league.flag + '</span>'
    + '<span class="fxt-league-name">' + league.label + '</span>'
    + (hasLive ? '<span class="fxt-live-badge">LIVE</span>' : '')
    + '</div>';

  if (fixtures.length) {
    fixtures.sort(function(a, b) {
      var aLive = isLive(a.status) ? 0 : 1;
      var bLive = isLive(b.status) ? 0 : 1;
      if (aLive !== bLive) return aLive - bLive;
      return new Date(a.time) - new Date(b.time);
    });

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
  } else if (upcoming.length) {
    // show upcoming fixtures when no games today
    html += '<div class="fxt-upcoming-label">Upcoming Fixtures</div>';
    upcoming.forEach(function(f) {
      html += '<div class="fxt-row">'
        + '<div class="fxt-teams">'
        +   '<div class="fxt-team">'
        +     '<img class="fxt-logo" src="' + f.homeLogo + '" onerror="this.style.display=\'none\'">'
        +     '<span class="fxt-name">' + f.home + '</span>'
        +   '</div>'
        +   '<div class="fxt-team">'
        +     '<img class="fxt-logo" src="' + f.awayLogo + '" onerror="this.style.display=\'none\'">'
        +     '<span class="fxt-name">' + f.away + '</span>'
        +   '</div>'
        + '</div>'
        + '<div class="fxt-right">'
        +   '<div class="fxt-upcoming-date">' + formatDate(f.time) + '</div>'
        +   '<div class="fxt-kickoff">' + formatKickoff(f.time) + '</div>'
        + '</div>'
        + '</div>';
    });
  }

  html += '</div>';
  return html;
}

async function fetchLeague(leagueKey) {
  try {
    var controller = new AbortController();
    var timer = setTimeout(function() { controller.abort(); }, 8000);
    var res = await fetch(BACKEND_URL + '?league=' + leagueKey, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return { key: leagueKey, fixtures: [], upcoming: [] };
    var data = await res.json();
    return { key: leagueKey, fixtures: data.fixtures || [], upcoming: data.upcoming || [] };
  } catch(e) {
    return { key: leagueKey, fixtures: [], upcoming: [] };
  }
}

async function loadAllFootball() {
  var container = document.getElementById('football-fixtures');
  if (!container) return;

  container.innerHTML = '<div class="fxt-loading"><div class="f1-spinner"></div><span>Loading fixtures...</span></div>';

  var results = await Promise.all(
    FOOTBALL_LEAGUES.map(function(l) { return fetchLeague(l.key); })
  );

  var html = '';
  var totalMatches = 0;

  FOOTBALL_LEAGUES.forEach(function(league, i) {
    var data = results[i];
    totalMatches += data.fixtures.length + data.upcoming.length;
    html += renderLeagueBlock(league, data);
  });

  if (totalMatches === 0) {
    container.innerHTML = '<div class="fxt-empty" style="padding:32px 16px;">No matches or upcoming fixtures found</div>';
    return;
  }

  container.innerHTML = html;
}

function buildFootballSection() {
  var tabsEl = document.getElementById('football-tabs');
  if (tabsEl) tabsEl.style.display = 'none';

  loadAllFootball();

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
  renderStandings(F1_STANDINGS_FALLBACK, 'Fallback · R4 Bahrain');
  try {
    var controller = new AbortController();
    var timer = setTimeout(function() { controller.abort(); }, 5000);
    var res = await fetch('https://api.jolpi.ca/ergast/f1/current/driverstandings.json?limit=20', { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return;
    var data = await res.json();
    var sl = data && data.MRData && data.MRData.StandingsTable && data.MRData.StandingsTable.StandingsLists[0];
    if (!sl || !sl.DriverStandings || !sl.DriverStandings.length) return;
    renderStandings(sl.DriverStandings.slice(0, 10), 'Live · R' + sl.round);
    var t = new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
    var updated = document.createElement('div');
    updated.className = 'f1-last-updated';
    updated.textContent = 'Jolpica F1 API · updated ' + t;
    body.appendChild(updated);
  } catch(e) {}
}

function loadFootballScores() {
  buildFootballSection();
}
