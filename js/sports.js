var TEAM_COLORS = {
mercedes:’#00d2be’, ferrari:’#e8002d’, red_bull:’#3671c6’,
mclaren:’#ff8700’, aston_martin:’#229971’, alpine:’#0093cc’,
williams:’#64c4ff’, rb:’#6692ff’, kick_sauber:’#52e252’, haas:’#b6babd’,
cadillac:’#c8102e’
};

// ── F1 2026 FULL SEASON CALENDAR ─────────────────────────
var F1_CALENDAR = [
{ race:‘Australian Grand Prix’, circuit:‘Albert Park, Melbourne’, round:‘R1’, flag:‘AUS’,
sessions:[
{ name:‘Practice 1’,        time:‘2026-03-13T01:30:00Z’ },
{ name:‘Practice 2’,        time:‘2026-03-13T05:00:00Z’ },
{ name:‘Practice 3’,        time:‘2026-03-14T01:30:00Z’ },
{ name:‘Qualifying’,        time:‘2026-03-14T05:00:00Z’ },
{ name:‘Race’,              time:‘2026-03-15T05:00:00Z’ },
]
},
{ race:‘Chinese Grand Prix’, circuit:‘Shanghai International Circuit’, round:‘R2’, flag:‘CHN’,
sessions:[
{ name:‘Practice 1’,        time:‘2026-03-20T03:30:00Z’ },
{ name:‘Sprint Qualifying’, time:‘2026-03-20T07:30:00Z’ },
{ name:‘Sprint Race’,       time:‘2026-03-21T03:00:00Z’ },
{ name:‘Qualifying’,        time:‘2026-03-21T07:00:00Z’ },
{ name:‘Race’,              time:‘2026-03-22T07:00:00Z’ },
]
},
{ race:‘Japanese Grand Prix’, circuit:‘Suzuka Circuit’, round:‘R3’, flag:‘JPN’,
sessions:[
{ name:‘Practice 1’,        time:‘2026-04-03T02:30:00Z’ },
{ name:‘Practice 2’,        time:‘2026-04-03T06:00:00Z’ },
{ name:‘Practice 3’,        time:‘2026-04-04T02:30:00Z’ },
{ name:‘Qualifying’,        time:‘2026-04-04T06:00:00Z’ },
{ name:‘Race’,              time:‘2026-04-05T05:00:00Z’ },
]
},
{ race:‘Bahrain Grand Prix’, circuit:‘Bahrain International Circuit’, round:‘R4’, flag:‘BHR’,
sessions:[
{ name:‘Practice 1’,        time:‘2026-04-17T11:30:00Z’ },
{ name:‘Practice 2’,        time:‘2026-04-17T15:00:00Z’ },
{ name:‘Practice 3’,        time:‘2026-04-18T11:30:00Z’ },
{ name:‘Qualifying’,        time:‘2026-04-18T15:00:00Z’ },
{ name:‘Race’,              time:‘2026-04-19T15:00:00Z’ },
]
},
{ race:‘Miami Grand Prix’, circuit:‘Miami International Autodrome’, round:‘R5 · Sprint’, flag:‘USA’,
sessions:[
{ name:‘Practice 1’,        time:‘2026-05-02T16:30:00Z’ },
{ name:‘Sprint Qualifying’, time:‘2026-05-02T20:30:00Z’ },
{ name:‘Sprint Race’,       time:‘2026-05-03T16:00:00Z’ },
{ name:‘Qualifying’,        time:‘2026-05-03T20:00:00Z’ },
{ name:‘Race’,              time:‘2026-05-04T20:00:00Z’ },
]
},
{ race:‘Canadian Grand Prix’, circuit:‘Circuit Gilles Villeneuve, Montreal’, round:‘R6 · Sprint’, flag:‘CAN’,
sessions:[
{ name:‘Practice 1’,        time:‘2026-05-22T16:30:00Z’ },
{ name:‘Sprint Qualifying’, time:‘2026-05-22T20:30:00Z’ },
{ name:‘Sprint Race’,       time:‘2026-05-23T16:00:00Z’ },
{ name:‘Qualifying’,        time:‘2026-05-23T20:00:00Z’ },
{ name:‘Race’,              time:‘2026-05-24T20:00:00Z’ },
]
},
{ race:‘Spanish Grand Prix’, circuit:‘Circuit de Barcelona-Catalunya’, round:‘R7’, flag:‘ESP’,
sessions:[
{ name:‘Practice 1’,        time:‘2026-05-29T11:30:00Z’ },
{ name:‘Practice 2’,        time:‘2026-05-29T15:00:00Z’ },
{ name:‘Practice 3’,        time:‘2026-05-30T10:30:00Z’ },
{ name:‘Qualifying’,        time:‘2026-05-30T14:00:00Z’ },
{ name:‘Race’,              time:‘2026-05-31T13:00:00Z’ },
]
},
{ race:‘Austrian Grand Prix’, circuit:‘Red Bull Ring, Spielberg’, round:‘R8 · Sprint’, flag:‘AUT’,
sessions:[
{ name:‘Practice 1’,        time:‘2026-06-26T10:30:00Z’ },
{ name:‘Sprint Qualifying’, time:‘2026-06-26T14:30:00Z’ },
{ name:‘Sprint Race’,       time:‘2026-06-27T10:00:00Z’ },
{ name:‘Qualifying’,        time:‘2026-06-27T14:00:00Z’ },
{ name:‘Race’,              time:‘2026-06-28T13:00:00Z’ },
]
},
{ race:‘British Grand Prix’, circuit:‘Silverstone Circuit’, round:‘R9’, flag:‘GBR’,
sessions:[
{ name:‘Practice 1’,        time:‘2026-07-03T11:30:00Z’ },
{ name:‘Practice 2’,        time:‘2026-07-03T15:00:00Z’ },
{ name:‘Practice 3’,        time:‘2026-07-04T10:30:00Z’ },
{ name:‘Qualifying’,        time:‘2026-07-04T14:00:00Z’ },
{ name:‘Race’,              time:‘2026-07-05T14:00:00Z’ },
]
},
{ race:‘Belgian Grand Prix’, circuit:‘Circuit de Spa-Francorchamps’, round:‘R10’, flag:‘BEL’,
sessions:[
{ name:‘Practice 1’,        time:‘2026-07-24T11:30:00Z’ },
{ name:‘Practice 2’,        time:‘2026-07-24T15:00:00Z’ },
{ name:‘Practice 3’,        time:‘2026-07-25T10:30:00Z’ },
{ name:‘Qualifying’,        time:‘2026-07-25T14:00:00Z’ },
{ name:‘Race’,              time:‘2026-07-26T13:00:00Z’ },
]
},
{ race:‘Hungarian Grand Prix’, circuit:‘Hungaroring, Budapest’, round:‘R11’, flag:‘HUN’,
sessions:[
{ name:‘Practice 1’,        time:‘2026-07-31T11:30:00Z’ },
{ name:‘Practice 2’,        time:‘2026-07-31T15:00:00Z’ },
{ name:‘Practice 3’,        time:‘2026-08-01T10:30:00Z’ },
{ name:‘Qualifying’,        time:‘2026-08-01T14:00:00Z’ },
{ name:‘Race’,              time:‘2026-08-02T13:00:00Z’ },
]
},
{ race:‘Dutch Grand Prix’, circuit:‘Circuit Zandvoort’, round:‘R12’, flag:‘NED’,
sessions:[
{ name:‘Practice 1’,        time:‘2026-08-28T10:30:00Z’ },
{ name:‘Practice 2’,        time:‘2026-08-28T14:00:00Z’ },
{ name:‘Practice 3’,        time:‘2026-08-29T09:30:00Z’ },
{ name:‘Qualifying’,        time:‘2026-08-29T13:00:00Z’ },
{ name:‘Race’,              time:‘2026-08-30T13:00:00Z’ },
]
},
{ race:‘Italian Grand Prix’, circuit:‘Autodromo Nazionale Monza’, round:‘R13’, flag:‘ITA’,
sessions:[
{ name:‘Practice 1’,        time:‘2026-09-04T11:30:00Z’ },
{ name:‘Practice 2’,        time:‘2026-09-04T15:00:00Z’ },
{ name:‘Practice 3’,        time:‘2026-09-05T10:30:00Z’ },
{ name:‘Qualifying’,        time:‘2026-09-05T14:00:00Z’ },
{ name:‘Race’,              time:‘2026-09-06T13:00:00Z’ },
]
},
{ race:‘Azerbaijan Grand Prix’, circuit:‘Baku City Circuit’, round:‘R14’, flag:‘AZE’,
sessions:[
{ name:‘Practice 1’,        time:‘2026-09-18T09:30:00Z’ },
{ name:‘Practice 2’,        time:‘2026-09-18T13:00:00Z’ },
{ name:‘Practice 3’,        time:‘2026-09-19T08:30:00Z’ },
{ name:‘Qualifying’,        time:‘2026-09-19T12:00:00Z’ },
{ name:‘Race’,              time:‘2026-09-20T11:00:00Z’ },
]
},
{ race:‘Singapore Grand Prix’, circuit:‘Marina Bay Street Circuit’, round:‘R15’, flag:‘SGP’,
sessions:[
{ name:‘Practice 1’,        time:‘2026-10-02T09:30:00Z’ },
{ name:‘Practice 2’,        time:‘2026-10-02T13:00:00Z’ },
{ name:‘Practice 3’,        time:‘2026-10-03T09:30:00Z’ },
{ name:‘Qualifying’,        time:‘2026-10-03T13:00:00Z’ },
{ name:‘Race’,              time:‘2026-10-04T12:00:00Z’ },
]
},
{ race:‘United States Grand Prix’, circuit:‘Circuit of the Americas, Austin’, round:‘R16 · Sprint’, flag:‘USA’,
sessions:[
{ name:‘Practice 1’,        time:‘2026-10-16T17:30:00Z’ },
{ name:‘Sprint Qualifying’, time:‘2026-10-16T21:30:00Z’ },
{ name:‘Sprint Race’,       time:‘2026-10-17T17:00:00Z’ },
{ name:‘Qualifying’,        time:‘2026-10-17T21:00:00Z’ },
{ name:‘Race’,              time:‘2026-10-18T19:00:00Z’ },
]
},
{ race:‘Mexico City Grand Prix’, circuit:‘Autodromo Hermanos Rodriguez’, round:‘R17’, flag:‘MEX’,
sessions:[
{ name:‘Practice 1’,        time:‘2026-10-23T18:30:00Z’ },
{ name:‘Practice 2’,        time:‘2026-10-23T22:00:00Z’ },
{ name:‘Practice 3’,        time:‘2026-10-24T17:30:00Z’ },
{ name:‘Qualifying’,        time:‘2026-10-24T21:00:00Z’ },
{ name:‘Race’,              time:‘2026-10-25T20:00:00Z’ },
]
},
{ race:‘Sao Paulo Grand Prix’, circuit:‘Autodromo Jose Carlos Pace’, round:‘R18 · Sprint’, flag:‘BRA’,
sessions:[
{ name:‘Practice 1’,        time:‘2026-11-06T14:30:00Z’ },
{ name:‘Sprint Qualifying’, time:‘2026-11-06T18:30:00Z’ },
{ name:‘Sprint Race’,       time:‘2026-11-07T14:00:00Z’ },
{ name:‘Qualifying’,        time:‘2026-11-07T18:00:00Z’ },
{ name:‘Race’,              time:‘2026-11-08T17:00:00Z’ },
]
},
{ race:‘Las Vegas Grand Prix’, circuit:‘Las Vegas Street Circuit’, round:‘R19’, flag:‘USA’,
sessions:[
{ name:‘Practice 1’,        time:‘2026-11-19T04:30:00Z’ },
{ name:‘Practice 2’,        time:‘2026-11-19T08:00:00Z’ },
{ name:‘Practice 3’,        time:‘2026-11-20T04:30:00Z’ },
{ name:‘Qualifying’,        time:‘2026-11-20T08:00:00Z’ },
{ name:‘Race’,              time:‘2026-11-21T06:00:00Z’ },
]
},
{ race:‘Qatar Grand Prix’, circuit:‘Lusail International Circuit’, round:‘R20 · Sprint’, flag:‘QAT’,
sessions:[
{ name:‘Practice 1’,        time:‘2026-11-27T13:30:00Z’ },
{ name:‘Sprint Qualifying’, time:‘2026-11-27T17:30:00Z’ },
{ name:‘Sprint Race’,       time:‘2026-11-28T13:00:00Z’ },
{ name:‘Qualifying’,        time:‘2026-11-28T17:00:00Z’ },
{ name:‘Race’,              time:‘2026-11-29T17:00:00Z’ },
]
},
{ race:‘Abu Dhabi Grand Prix’, circuit:‘Yas Marina Circuit’, round:‘R21 · Finale’, flag:‘UAE’,
sessions:[
{ name:‘Practice 1’,        time:‘2026-12-04T09:30:00Z’ },
{ name:‘Practice 2’,        time:‘2026-12-04T13:00:00Z’ },
{ name:‘Practice 3’,        time:‘2026-12-05T09:30:00Z’ },
{ name:‘Qualifying’,        time:‘2026-12-05T13:00:00Z’ },
{ name:‘Race’,              time:‘2026-12-06T13:00:00Z’ },
]
},
];

var SESSION_DURATION = {
‘Practice 1’:60,‘Practice 2’:60,‘Practice 3’:60,
‘Sprint Qualifying’:60,‘Sprint Race’:45,
‘Qualifying’:60,‘Race’:120,
};

// ── FOOTBALL CONFIG ───────────────────────────────────────
var BACKEND_URL = ‘https://moes-app-two.vercel.app/api/football’;

var FOOTBALL_LEAGUES = [
{ key:‘epl’,        label:‘Premier League’,  flag:‘🏴󠁧󠁢󠁥󠁮󠁧󠁿’ },
{ key:‘laliga’,     label:‘La Liga’,          flag:‘ESP’ },
{ key:‘seriea’,     label:‘Serie A’,          flag:‘ITA’ },
{ key:‘bundesliga’, label:‘Bundesliga’,       flag:‘🇩🇪’ },
{ key:‘ligue1’,     label:‘Ligue 1’,          flag:‘🇫🇷’ },
{ key:‘ucl’,        label:‘Champions League’, flag:‘🏆’ },
{ key:‘spl’,        label:‘Saudi Pro League’, flag:‘🇸🇦’ },
{ key:‘nations’,    label:‘Nations League’,   flag:‘🌍’ },
];

var footballTimer        = null;
var currentStandingsView = ‘driver’;
var liveTimingTimer      = null;

// ─────────────────────────────────────────────────────────
// F1 SESSION HELPERS
// ─────────────────────────────────────────────────────────
function getCurrentSession() {
var now = Date.now();
for (var r = 0; r < F1_CALENDAR.length; r++) {
var weekend = F1_CALENDAR[r];
for (var s = 0; s < weekend.sessions.length; s++) {
var sess = weekend.sessions[s];
var start    = Date.parse(sess.time);
var duration = (SESSION_DURATION[sess.name] || 90) * 60 * 1000;
if (now >= start && now <= start + duration) {
return { race: weekend, session: sess };
}
}
}
return null;
}

function getNextRaceAndSession() {
var now = Date.now();
for (var r = 0; r < F1_CALENDAR.length; r++) {
var weekend = F1_CALENDAR[r];
for (var s = 0; s < weekend.sessions.length; s++) {
var sess = weekend.sessions[s];
if (Date.parse(sess.time) > now) {
return { race: weekend, session: sess };
}
}
}
return null;
}

function getCurrentRaceWeekend() {
var now = Date.now();
var twoDays = 2 * 24 * 3600 * 1000;
for (var r = 0; r < F1_CALENDAR.length; r++) {
var weekend = F1_CALENDAR[r];
var first = Date.parse(weekend.sessions[0].time);
var last  = Date.parse(weekend.sessions[weekend.sessions.length - 1].time);
var lastEnd = last + (SESSION_DURATION[weekend.sessions[weekend.sessions.length - 1].name] || 90) * 60 * 1000;
if (now >= first - twoDays && now <= lastEnd) return weekend;
}
return null;
}

// ─────────────────────────────────────────────────────────
// F1 COUNTDOWN
// ─────────────────────────────────────────────────────────
function startCountdown() {
var trackEl   = document.getElementById(‘f1-next-track’);
var sessEl    = document.getElementById(‘f1-next-session’);
var labelEl   = document.getElementById(‘f1-session-label’);
var subEl     = document.getElementById(‘f1-cd-sub’);
var gridEl    = document.getElementById(‘f1-cd-grid’);
var liveEl    = document.getElementById(‘f1-live-banner’);
var weekendEl = document.getElementById(‘f1-weekend-card’);

function renderPills(raceWeekend) {
if (!subEl || !raceWeekend) return;
var now = Date.now();
subEl.innerHTML = raceWeekend.sessions.map(function(s) {
var start    = Date.parse(s.time);
var duration = (SESSION_DURATION[s.name] || 90) * 60 * 1000;
var isLive   = now >= start && now <= start + duration;
var isPast   = now > start + duration;
var cls = isPast ? ’ past’ : (isLive ? ’ live-now’ : ‘’);
var timeStr = new Date(start).toLocaleTimeString([], { hour:‘2-digit’, minute:‘2-digit’, timeZone:‘Asia/Riyadh’ });
return ‘<span class="session-pill' + cls + '" title="' + timeStr + ' AST">’
+ (isLive ? ‘🔴 ’ : ‘’) + s.name + ‘</span>’;
}).join(’’);
}

var lastRenderedWeekend = null;

function tick() {
try {
var live = getCurrentSession();
var next = live || getNextRaceAndSession();
var raceWeekend = getCurrentRaceWeekend();

```
// only re-render weekend card if it changed
if (weekendEl) {
  try {
    if (raceWeekend) {
      if (lastRenderedWeekend !== raceWeekend.race) {
        renderWeekendCard(raceWeekend, weekendEl);
        lastRenderedWeekend = raceWeekend.race;
      }
      weekendEl.style.display = 'block';
    } else {
      weekendEl.style.display = 'none';
    }
  } catch(e) {}
}

if (!next) {
  if (trackEl) trackEl.textContent = '2026 Season Complete';
  if (sessEl)  sessEl.textContent  = 'See you in 2027';
  if (labelEl) labelEl.textContent = '';
  if (liveEl)  liveEl.style.display = 'none';
  if (gridEl)  gridEl.style.display = 'none';
  if (subEl)   subEl.innerHTML = '';
  stopLiveTiming();
  return;
}

if (trackEl) trackEl.textContent = next.race.flag + ' ' + next.race.race;
if (sessEl)  sessEl.textContent  = next.race.circuit + ' · ' + next.race.round;

if (live) {
  if (liveEl) {
    liveEl.style.display = 'flex';
    liveEl.innerHTML = '<span class="pulse"></span><span>🔴 LIVE NOW — ' + live.session.name + '</span>';
  }
  if (gridEl)  gridEl.style.display = 'none';
  if (labelEl) labelEl.style.display = 'none';
  startLiveTiming();
} else {
  if (liveEl)  liveEl.style.display = 'none';
  if (gridEl)  gridEl.style.display = 'grid';
  if (labelEl) {
    labelEl.style.display = 'block';
    labelEl.textContent = 'Next: ' + next.session.name;
  }
  stopLiveTiming();

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
}

renderPills(next.race);
} catch(e) { console.error('tick error:', e); }
```

}

tick();
setInterval(tick, 1000);
}

// ─────────────────────────────────────────────────────────
// RACE WEEKEND SCHEDULE CARD
// ─────────────────────────────────────────────────────────
function renderWeekendCard(weekend, el) {
var now = Date.now();
var html = ‘<div class="f1-weekend-card">’
+ ‘<div class="f1-weekend-title">’ + weekend.flag + ’ ’ + weekend.race + ’ Weekend</div>’
+ ‘<div class="f1-weekend-sessions">’;

weekend.sessions.forEach(function(s) {
var start    = Date.parse(s.time);
var duration = (SESSION_DURATION[s.name] || 90) * 60 * 1000;
var isLive   = now >= start && now <= start + duration;
var isPast   = now > start + duration;
var timeStr  = new Date(start).toLocaleString([], {
weekday:‘short’, month:‘short’, day:‘numeric’,
hour:‘2-digit’, minute:‘2-digit’, timeZone:‘Asia/Riyadh’
}) + ’ AST’;
var cls = isLive ? ‘wk-sess live’ : (isPast ? ‘wk-sess past’ : ‘wk-sess’);
html += ‘<div class="' + cls + '">’
+ ‘<span class="wk-sess-name">’ + (isLive ? ’🔴 ’ : ‘’) + s.name + ‘</span>’
+ ‘<span class="wk-sess-time">’ + timeStr + ‘</span>’
+ ‘</div>’;
});

html += ‘</div></div>’;
el.innerHTML = html;
}

// ─────────────────────────────────────────────────────────
// OPENF1 LIVE TIMING
// ─────────────────────────────────────────────────────────
async function fetchOpenF1Live() {
try {
// get current session key
var sessRes = await fetch(‘https://api.openf1.org/v1/sessions?year=2026’, {
signal: AbortSignal.timeout(6000)
});
if (!sessRes.ok) return null;
var sessions = await sessRes.json();
if (!sessions.length) return null;

```
// find most recent session
var latest = sessions.reduce(function(a, b) {
  return (a.session_key > b.session_key) ? a : b;
});
var sessionKey = latest.session_key;

// fetch positions, intervals, drivers in parallel
var results = await Promise.all([
  fetch('https://api.openf1.org/v1/position?session_key=' + sessionKey, { signal: AbortSignal.timeout(5000) }),
  fetch('https://api.openf1.org/v1/intervals?session_key=' + sessionKey, { signal: AbortSignal.timeout(5000) }),
  fetch('https://api.openf1.org/v1/drivers?session_key=' + sessionKey, { signal: AbortSignal.timeout(5000) }),
  fetch('https://api.openf1.org/v1/laps?session_key=' + sessionKey, { signal: AbortSignal.timeout(5000) }),
]);

var positions = results[0].ok ? await results[0].json() : [];
var intervals = results[1].ok ? await results[1].json() : [];
var drivers   = results[2].ok ? await results[2].json() : [];
var laps      = results[3].ok ? await results[3].json() : [];

return { sessionKey, positions, intervals, drivers, laps, sessionName: latest.session_name };
```

} catch(e) {
return null;
}
}

function renderLiveTiming(data) {
var container = document.getElementById(‘f1-live-timing’);
if (!container || !data) return;

var driverMap = {};
data.drivers.forEach(function(d) { driverMap[d.driver_number] = d; });

var posMap = {};
data.positions.forEach(function(p) {
if (!posMap[p.driver_number] || p.date > posMap[p.driver_number].date) {
posMap[p.driver_number] = p;
}
});

var intMap = {};
data.intervals.forEach(function(i) {
if (!intMap[i.driver_number] || i.date > intMap[i.driver_number].date) {
intMap[i.driver_number] = i;
}
});

var sorted = Object.values(posMap).sort(function(a, b) { return a.position - b.position; });
if (!sorted.length) { container.innerHTML = ‘’; return; }

var maxLap = 0;
data.laps.forEach(function(l) { if (l.lap_number > maxLap) maxLap = l.lap_number; });

var html = ‘<div class="f1-timing-card">’
+ ‘<div class="f1-timing-header">’
+ ’<span class="f1-timing-title">🔴 LIVE — ’ + (data.sessionName || ‘Session’) + ‘</span>’
+ (maxLap ? ’<span class="f1-timing-lap">Lap ’ + maxLap + ‘</span>’ : ‘’)
+ ‘</div>’
+ ‘<div class="f1-timing-list">’;

sorted.slice(0, 10).forEach(function(p) {
var drv  = driverMap[p.driver_number] || {};
var intv = intMap[p.driver_number];
var pos  = p.position;
var name = drv.last_name || (’Car ’ + p.driver_number);
var col  = drv.team_colour ? ‘#’ + drv.team_colour : ‘#8a8fa8’;
var gap  = pos === 1 ? ‘LEADER’ : (intv && intv.gap_to_leader ? ‘+’ + intv.gap_to_leader : ‘—’);
var pc   = pos === 1 ? ‘p1’ : pos === 2 ? ‘p2’ : pos === 3 ? ‘p3’ : ‘’;

```
html += '<div class="f1-timing-row">'
  + '<span class="f1-timing-pos ' + pc + '">' + pos + '</span>'
  + '<span class="f1-timing-team-bar" style="background:' + col + '"></span>'
  + '<span class="f1-timing-name">' + name + '</span>'
  + '<span class="f1-timing-gap">' + gap + '</span>'
  + '</div>';
```

});

html += ‘</div><div class="f1-timing-footer">OpenF1 · updates every 5s</div></div>’;
container.innerHTML = html;
}

function startLiveTiming() {
var container = document.getElementById(‘f1-live-timing’);
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
var container = document.getElementById(‘f1-live-timing’);
if (container) container.innerHTML = ‘’;
}

// ─────────────────────────────────────────────────────────
// CHAMPIONSHIP CONTEXT
// ─────────────────────────────────────────────────────────
function renderChampionshipContext(drivers, round) {
var el = document.getElementById(‘f1-championship-context’);
if (!el || !drivers || drivers.length < 2) return;

var leader = drivers[0];
var second = drivers[1];
var leaderName = leader.name || (leader.Driver && leader.Driver.familyName) || ‘—’;
var secondName = second.name || (second.Driver && second.Driver.familyName) || ‘—’;
var leaderPts  = parseFloat(leader.pts || leader.points) || 0;
var secondPts  = parseFloat(second.pts || second.points) || 0;
var gap        = Math.round(leaderPts - secondPts);

var now = Date.now();
var remaining = F1_CALENDAR.filter(function(w) {
var raceSession = w.sessions.find(function(s) { return s.name === ‘Race’; });
return raceSession && Date.parse(raceSession.time) > now;
}).length;

el.innerHTML = ‘<div class="f1-context">’
+ ‘<span class="f1-context-leader">’ + leaderName + ‘</span>’
+ ’ leads ’
+ ‘<span class="f1-context-second">’ + secondName + ‘</span>’
+ ’ by <strong>’ + gap + ‘pts</strong>’
+ ’ · ’ + remaining + ’ races left’
+ ‘</div>’;
}

// ─────────────────────────────────────────────────────────
// LAST RACE PODIUM
// ─────────────────────────────────────────────────────────
async function loadLastRaceResult() {
var el = document.getElementById(‘f1-last-race’);
if (!el) return;
try {
var res = await fetch(‘https://api.jolpi.ca/ergast/f1/current/last/results.json?limit=3’, {
signal: AbortSignal.timeout(5000)
});
if (!res.ok) return;
var data = await res.json();
var race = data.MRData && data.MRData.RaceTable && data.MRData.RaceTable.Races[0];
if (!race || !race.Results) return;

```
var podium  = race.Results.slice(0, 3);
var medals  = ['🥇','🥈','🥉'];

var html = '<div class="f1-last-race-card">'
  + '<div class="f1-last-race-title">Last Race · ' + race.raceName + '</div>'
  + '<div class="f1-podium">';

podium.forEach(function(r, i) {
  var name = r.Driver.familyName;
  var cid  = r.Constructor.constructorId;
  var col  = TEAM_COLORS[cid] || '#8a8fa8';
  html += '<div class="f1-podium-item">'
    + '<span class="f1-podium-medal">' + medals[i] + '</span>'
    + '<span class="f1-podium-name" style="color:' + col + '">' + name + '</span>'
    + '<span class="f1-podium-team">' + r.Constructor.name + '</span>'
    + '</div>';
});

html += '</div></div>';
el.innerHTML = html;
```

} catch(e) {}
}

// ─────────────────────────────────────────────────────────
// WORLD CUP 2026 — openfootball (free, no key)
// ─────────────────────────────────────────────────────────
async function loadWorldCup() {
var container = document.getElementById(‘worldcup-fixtures’);
if (!container) return;

container.innerHTML = ‘<div class="fxt-loading"><div class="f1-spinner"></div><span>Loading World Cup…</span></div>’;

try {
var res = await fetch(
‘https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json’,
{ signal: AbortSignal.timeout(8000) }
);
if (!res.ok) throw new Error(‘failed’);
var data = await res.json();
var matches = data.matches || [];

```
var today = new Date().toISOString().split('T')[0];
var todayMatches = matches.filter(function(m) { return m.date === today; });
var recentResults = matches.filter(function(m) { return m.score && m.date < today; }).slice(-3);
var upcoming = matches.filter(function(m) { return m.date > today && !m.score; }).slice(0, 6);

var html = '';
if (todayMatches.length)                  html += renderWCSection(todayMatches, 'Today');
if (!todayMatches.length && recentResults.length) html += renderWCSection(recentResults, 'Recent Results');
if (upcoming.length)                      html += renderWCSection(upcoming, 'Upcoming');

if (!html) {
  // tournament not started — show first fixtures
  html = renderWCSection(matches.slice(0, 6), 'Opening Fixtures — Jun 11, 2026');
}

container.innerHTML = html;
```

} catch(e) {
// hardcoded fallback
container.innerHTML = renderWCSection([
{ team1:‘Mexico’,      team2:‘South Africa’,  date:‘2026-06-11’, group:‘Group A’ },
{ team1:‘South Korea’, team2:‘Czech Republic’, date:‘2026-06-11’, group:‘Group A’ },
{ team1:‘USA’,         team2:‘TBD’,            date:‘2026-06-12’, group:‘Group B’ },
{ team1:‘Canada’,      team2:‘TBD’,            date:‘2026-06-12’, group:‘Group C’ },
{ team1:‘Brazil’,      team2:‘TBD’,            date:‘2026-06-13’, group:‘Group D’ },
{ team1:‘England’,     team2:‘TBD’,            date:‘2026-06-13’, group:‘Group E’ },
], ‘Opening Fixtures — Jun 11, 2026’);
}
}

function renderWCSection(matches, label) {
var html = ‘<div class="wc-section-label">’ + label + ‘</div>’;
matches.forEach(function(m) {
var ftScore = m.score && m.score.ft;
var hasScore = ftScore && ftScore.length === 2;
html += ‘<div class="fxt-row">’
+ ‘<div class="fxt-teams">’
+ ‘<div class="fxt-team"><span class="fxt-name">’ + (m.team1 || ‘’) + ‘</span></div>’
+ ‘<div class="fxt-team"><span class="fxt-name">’ + (m.team2 || ‘’) + ‘</span></div>’
+ ‘</div>’
+ ‘<div class="fxt-right">’
+ (hasScore
? ‘<div class="fxt-score"><span>’ + ftScore[0] + ‘</span><span class="fxt-score-sep">-</span><span>’ + ftScore[1] + ‘</span></div><span class="fxt-status ft">FT</span>’
: ‘<div class="fxt-upcoming-date">’ + formatWCDate(m.date) + ‘</div><div class="wc-group-label">’ + (m.group || m.round || ‘’) + ‘</div>’)
+ ‘</div>’
+ ‘</div>’;
});
return html;
}

function formatWCDate(dateStr) {
if (!dateStr) return ‘’;
var d = new Date(dateStr + ‘T12:00:00Z’);
var days = [‘Sun’,‘Mon’,‘Tue’,‘Wed’,‘Thu’,‘Fri’,‘Sat’];
var months = [‘Jan’,‘Feb’,‘Mar’,‘Apr’,‘May’,‘Jun’,‘Jul’,‘Aug’,‘Sep’,‘Oct’,‘Nov’,‘Dec’];
return days[d.getDay()] + ’ ’ + d.getDate() + ’ ’ + months[d.getMonth()];
}

// ─────────────────────────────────────────────────────────
// FOOTBALL FIXTURES
// ─────────────────────────────────────────────────────────
function statusLabel(status, elapsed) {
if ([‘LIVE’,‘1H’,‘2H’,‘ET’,‘P’].indexOf(status) !== -1)
return ‘<span class="fxt-status live">’ + (elapsed ? elapsed + “’” : ‘LIVE’) + ‘</span>’;
if (status === ‘HT’)   return ‘<span class="fxt-status ht">HT</span>’;
if (status === ‘FT’)   return ‘<span class="fxt-status ft">FT</span>’;
if (status === ‘NS’)   return ‘<span class="fxt-status ns">NS</span>’;
if (status === ‘PST’)  return ‘<span class="fxt-status pst">PST</span>’;
if (status === ‘CANC’) return ‘<span class="fxt-status ft">CANC</span>’;
return ‘<span class="fxt-status ns">’ + status + ‘</span>’;
}

function formatKickoff(dateStr) {
return new Date(dateStr).toLocaleTimeString([], { hour:‘2-digit’, minute:‘2-digit’, timeZone:‘Asia/Riyadh’ });
}

function formatDate(dateStr) {
var d = new Date(dateStr);
var days = [‘Sun’,‘Mon’,‘Tue’,‘Wed’,‘Thu’,‘Fri’,‘Sat’];
var months = [‘Jan’,‘Feb’,‘Mar’,‘Apr’,‘May’,‘Jun’,‘Jul’,‘Aug’,‘Sep’,‘Oct’,‘Nov’,‘Dec’];
return days[d.getDay()] + ’ ’ + d.getDate() + ’ ’ + months[d.getMonth()];
}

function isLive(status) {
return [‘LIVE’,‘1H’,‘2H’,‘HT’,‘ET’,‘P’].indexOf(status) !== -1;
}

function renderLeagueBlock(league, data) {
var fixtures = data.fixtures || [];
var upcoming = data.upcoming || [];
var hasLive  = fixtures.some(function(f) { return isLive(f.status); });

if (!fixtures.length && !upcoming.length) return ‘’;

var html = ‘<div class="fxt-league-block">’
+ ‘<div class="fxt-league-header">’
+ ‘<span class="fxt-league-flag">’ + league.flag + ‘</span>’
+ ‘<span class="fxt-league-name">’ + league.label + ‘</span>’
+ (hasLive ? ‘<span class="fxt-live-badge">LIVE</span>’ : ‘’)
+ ‘</div>’;

if (fixtures.length) {
fixtures.sort(function(a, b) {
var aL = isLive(a.status) ? 0 : 1;
var bL = isLive(b.status) ? 0 : 1;
if (aL !== bL) return aL - bL;
return new Date(a.time) - new Date(b.time);
});
fixtures.forEach(function(f) {
var live     = isLive(f.status);
var hasScore = f.homeScore !== null && f.awayScore !== null;
html += ‘<div class="fxt-row' + (live ? ' fxt-live' : '') + '">’
+ ‘<div class="fxt-teams">’
+ ‘<div class="fxt-team"><img class="fxt-logo" src="' + f.homeLogo + '" onerror="this.style.display=\'none\'"><span class="fxt-name' + (live && f.homeScore > f.awayScore ? ' fxt-winning' : '') + '">’ + f.home + ‘</span></div>’
+ ‘<div class="fxt-team"><img class="fxt-logo" src="' + f.awayLogo + '" onerror="this.style.display=\'none\'"><span class="fxt-name' + (live && f.awayScore > f.homeScore ? ' fxt-winning' : '') + '">’ + f.away + ‘</span></div>’
+ ‘</div>’
+ ‘<div class="fxt-right">’
+ (hasScore ? ‘<div class="fxt-score' + (live ? ' fxt-score-live' : '') + '"><span>’ + f.homeScore + ‘</span><span class="fxt-score-sep">-</span><span>’ + f.awayScore + ‘</span></div>’ : ‘<div class="fxt-kickoff">’ + formatKickoff(f.time) + ‘</div>’)
+ statusLabel(f.status, f.elapsed)
+ ‘</div></div>’;
});
} else if (upcoming.length) {
html += ’<div class="fxt-upcoming-label">Next matches: ’ + formatDate(upcoming[0].time) + ‘</div>’;
upcoming.forEach(function(f) {
html += ‘<div class="fxt-row">’
+ ‘<div class="fxt-teams">’
+ ‘<div class="fxt-team"><img class="fxt-logo" src="' + f.homeLogo + '" onerror="this.style.display=\'none\'"><span class="fxt-name">’ + f.home + ‘</span></div>’
+ ‘<div class="fxt-team"><img class="fxt-logo" src="' + f.awayLogo + '" onerror="this.style.display=\'none\'"><span class="fxt-name">’ + f.away + ‘</span></div>’
+ ‘</div>’
+ ‘<div class="fxt-right">’
+ ‘<div class="fxt-upcoming-date">’ + formatDate(f.time) + ‘</div>’
+ ‘<div class="fxt-kickoff">’ + formatKickoff(f.time) + ‘</div>’
+ ‘</div></div>’;
});
}

html += ‘</div>’;
return html;
}

async function fetchLeague(leagueKey) {
try {
var controller = new AbortController();
var timer = setTimeout(function() { controller.abort(); }, 8000);
var res = await fetch(BACKEND_URL + ‘?league=’ + leagueKey, { signal: controller.signal });
clearTimeout(timer);
if (!res.ok) return { key: leagueKey, fixtures: [], upcoming: [] };
var data = await res.json();
return { key: leagueKey, fixtures: data.fixtures || [], upcoming: data.upcoming || [] };
} catch(e) {
return { key: leagueKey, fixtures: [], upcoming: [] };
}
}

async function loadAllFootball() {
var container = document.getElementById(‘football-fixtures’);
if (!container) return;
container.innerHTML = ‘<div class="fxt-loading"><div class="f1-spinner"></div><span>Loading fixtures…</span></div>’;

var results = await Promise.all(FOOTBALL_LEAGUES.map(function(l) { return fetchLeague(l.key); }));

var html = ‘’;
var total = 0;
FOOTBALL_LEAGUES.forEach(function(league, i) {
var data = results[i];
total += data.fixtures.length + data.upcoming.length;
html += renderLeagueBlock(league, data);
});

container.innerHTML = total === 0
? ‘<div class="fxt-empty" style="padding:32px 16px;">No matches or upcoming fixtures found</div>’
: html;
}

function buildFootballSection() {
loadAllFootball();
if (footballTimer) clearInterval(footballTimer);
footballTimer = setInterval(loadAllFootball, 60000);
}

// ─────────────────────────────────────────────────────────
// F1 STANDINGS
// ─────────────────────────────────────────────────────────
var F1_STANDINGS_FALLBACK = [
{ pos:1,  num:12, name:‘Antonelli’,  cid:‘mercedes’,     pts:100, wins:3 },
{ pos:2,  num:63, name:‘Russell’,    cid:‘mercedes’,     pts:80,  wins:1 },
{ pos:3,  num:16, name:‘Leclerc’,    cid:‘ferrari’,      pts:59,  wins:0 },
{ pos:4,  num:4,  name:‘Norris’,     cid:‘mclaren’,      pts:51,  wins:0 },
{ pos:5,  num:44, name:‘Hamilton’,   cid:‘ferrari’,      pts:51,  wins:0 },
{ pos:6,  num:81, name:‘Piastri’,    cid:‘mclaren’,      pts:43,  wins:0 },
{ pos:7,  num:3,  name:‘Verstappen’, cid:‘red_bull’,     pts:26,  wins:0 },
{ pos:8,  num:87, name:‘Bearman’,    cid:‘haas’,         pts:17,  wins:0 },
{ pos:9,  num:10, name:‘Gasly’,      cid:‘alpine’,       pts:16,  wins:0 },
{ pos:10, num:30, name:‘Lawson’,     cid:‘red_bull’,     pts:10,  wins:0 },
];

var F1_CONSTRUCTORS_FALLBACK = [
{ pos:1, name:‘Mercedes’,     cid:‘mercedes’,     pts:180, wins:4 },
{ pos:2, name:‘Ferrari’,      cid:‘ferrari’,      pts:110, wins:0 },
{ pos:3, name:‘McLaren’,      cid:‘mclaren’,      pts:94,  wins:0 },
{ pos:4, name:‘Red Bull’,     cid:‘red_bull’,     pts:36,  wins:0 },
{ pos:5, name:‘Aston Martin’, cid:‘aston_martin’, pts:18,  wins:0 },
{ pos:6, name:‘Haas’,         cid:‘haas’,         pts:17,  wins:0 },
{ pos:7, name:‘Alpine’,       cid:‘alpine’,       pts:16,  wins:0 },
{ pos:8, name:‘Williams’,     cid:‘williams’,     pts:9,   wins:0 },
{ pos:9, name:‘RB’,           cid:‘rb’,           pts:10,  wins:0 },
{ pos:10,name:‘Kick Sauber’,  cid:‘kick_sauber’,  pts:0,   wins:0 },
];

function switchStandingsView(view) {
currentStandingsView = view;
var dBtn = document.getElementById(‘standings-btn-driver’);
var cBtn = document.getElementById(‘standings-btn-constructor’);
if (dBtn) dBtn.classList.toggle(‘active’, view === ‘driver’);
if (cBtn) cBtn.classList.toggle(‘active’, view === ‘constructor’);
renderStandingsView();
}

function renderStandingsView() {
if (currentStandingsView === ‘driver’) {
renderDriverStandings(F1_STANDINGS_FALLBACK, ‘Fallback · R4’);
loadLiveDriverStandings();
} else {
renderConstructorStandings(F1_CONSTRUCTORS_FALLBACK, ‘Fallback · R4’);
loadLiveConstructorStandings();
}
}

function renderDriverStandings(drivers, round) {
var body    = document.getElementById(‘f1-standings-body’);
var roundEl = document.getElementById(‘f1-standings-round’);
if (!body) return;
var maxPts = parseFloat(drivers[0].pts || drivers[0].points) || 1;
if (roundEl) roundEl.textContent = round || ‘2026’;
var html = ‘<div class="f1-std-header"><span>POS</span><span>NO</span><span>DRIVER</span><span style="text-align:right">W</span><span style="text-align:right">PTS</span></div>’;
drivers.forEach(function(d) {
var pos  = d.pos  || parseInt(d.position);
var num  = d.num  || (d.Driver && d.Driver.permanentNumber);
var name = d.name || (d.Driver && d.Driver.familyName);
var cid  = d.cid  || (d.Constructors && d.Constructors[0] && d.Constructors[0].constructorId) || ‘default’;
var pts  = parseFloat(d.pts || d.points);
var wins = d.wins || 0;
var col  = TEAM_COLORS[cid] || ‘#8a8fa8’;
var barW = Math.round((pts / maxPts) * 100);
var pc   = pos === 1 ? ‘p1’ : pos === 2 ? ‘p2’ : pos === 3 ? ‘p3’ : ‘’;
html += ‘<div class="f1-std-row">’
+ ‘<span class="f1-pos ' + pc + '">’ + pos + ‘</span>’
+ ‘<span class="f1-num" style="background:' + col + '22;color:' + col + '">’ + num + ‘</span>’
+ ‘<div class="f1-driver-info"><span class="f1-driver-name">’ + name + ‘</span>’
+ ‘<div class="f1-con-bar"><div class="f1-con-fill" style="width:' + barW + '%;background:' + col + '"></div></div></div>’
+ ‘<span class="f1-wins">’ + wins + ‘</span>’
+ ‘<span class="f1-pts">’ + pts + ‘</span></div>’;
});
body.innerHTML = html;
renderChampionshipContext(drivers, round);
}

function renderConstructorStandings(teams, round) {
var body    = document.getElementById(‘f1-standings-body’);
var roundEl = document.getElementById(‘f1-standings-round’);
if (!body) return;
var maxPts = parseFloat(teams[0].pts || teams[0].points) || 1;
if (roundEl) roundEl.textContent = round || ‘2026’;
var html = ‘<div class="f1-std-header"><span>POS</span><span></span><span>TEAM</span><span style="text-align:right">W</span><span style="text-align:right">PTS</span></div>’;
teams.forEach(function(t) {
var pos  = t.pos || parseInt(t.position);
var name = t.name || (t.Constructor && t.Constructor.name);
var cid  = t.cid  || (t.Constructor && t.Constructor.constructorId) || ‘default’;
var pts  = parseFloat(t.pts || t.points);
var wins = t.wins || 0;
var col  = TEAM_COLORS[cid] || ‘#8a8fa8’;
var barW = Math.round((pts / maxPts) * 100);
var pc   = pos === 1 ? ‘p1’ : pos === 2 ? ‘p2’ : pos === 3 ? ‘p3’ : ‘’;
html += ‘<div class="f1-std-row">’
+ ‘<span class="f1-pos ' + pc + '">’ + pos + ‘</span>’
+ ‘<span class="f1-num" style="background:' + col + '22;">’
+ ‘<div style="width:10px;height:10px;border-radius:2px;background:' + col + '"></div></span>’
+ ‘<div class="f1-driver-info"><span class="f1-driver-name">’ + name + ‘</span>’
+ ‘<div class="f1-con-bar"><div class="f1-con-fill" style="width:' + barW + '%;background:' + col + '"></div></div></div>’
+ ‘<span class="f1-wins">’ + wins + ‘</span>’
+ ‘<span class="f1-pts">’ + pts + ‘</span></div>’;
});
body.innerHTML = html;
}

async function loadLiveDriverStandings() {
try {
var controller = new AbortController();
var timer = setTimeout(function() { controller.abort(); }, 5000);
var res = await fetch(‘https://api.jolpi.ca/ergast/f1/current/driverstandings.json?limit=20’, { signal: controller.signal });
clearTimeout(timer);
if (!res.ok) return;
var data = await res.json();
var sl = data && data.MRData && data.MRData.StandingsTable && data.MRData.StandingsTable.StandingsLists[0];
if (!sl || !sl.DriverStandings || !sl.DriverStandings.length) return;
if (currentStandingsView !== ‘driver’) return;
renderDriverStandings(sl.DriverStandings.slice(0,10), ‘Live · R’ + sl.round);
var t = new Date().toLocaleTimeString([], { hour:‘2-digit’, minute:‘2-digit’ });
var updated = document.createElement(‘div’);
updated.className = ‘f1-last-updated’;
updated.textContent = ’Jolpica F1 API · ’ + t;
document.getElementById(‘f1-standings-body’).appendChild(updated);
} catch(e) {}
}

async function loadLiveConstructorStandings() {
try {
var controller = new AbortController();
var timer = setTimeout(function() { controller.abort(); }, 5000);
var res = await fetch(‘https://api.jolpi.ca/ergast/f1/current/constructorstandings.json?limit=20’, { signal: controller.signal });
clearTimeout(timer);
if (!res.ok) return;
var data = await res.json();
var sl = data && data.MRData && data.MRData.StandingsTable && data.MRData.StandingsTable.StandingsLists[0];
if (!sl || !sl.ConstructorStandings || !sl.ConstructorStandings.length) return;
if (currentStandingsView !== ‘constructor’) return;
renderConstructorStandings(sl.ConstructorStandings.slice(0,10), ‘Live · R’ + sl.round);
var t = new Date().toLocaleTimeString([], { hour:‘2-digit’, minute:‘2-digit’ });
var updated = document.createElement(‘div’);
updated.className = ‘f1-last-updated’;
updated.textContent = ’Jolpica F1 API · ’ + t;
document.getElementById(‘f1-standings-body’).appendChild(updated);
} catch(e) {}
}

function loadF1Data() { renderStandingsView(); }
function loadFootballScores() { buildFootballSection(); }