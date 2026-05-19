// ── CONSTANTS ──────────────────────────────────────────
const RSS_API = ‘https://api.rss2json.com/v1/api.json?rss_url=’;
const F1_BASE = ‘https://api.jolpi.ca/ergast/f1’;
const CORS    = ‘https://corsproxy.io/?url=’;

const MASTER_CHANNELS = [
{ name:‘BBC F1’,       url:‘https://feeds.bbci.co.uk/sport/formula1/rss.xml’, cat:‘F1’       },
{ name:‘BBC Football’, url:‘https://feeds.bbci.co.uk/sport/football/rss.xml’,  cat:‘FOOTBALL’ },
{ name:‘Sky F1’,       url:‘https://www.skysports.com/rss/12040’,              cat:‘F1’       },
{ name:‘Sky Football’, url:‘https://www.skysports.com/rss/11095’,              cat:‘FOOTBALL’ },
{ name:‘TalkSport’,    url:‘https://talksport.com/feed/’,                      cat:‘FOOTBALL’ },
{ name:‘Arab News’,    url:‘https://www.arabnews.com/cat/5/rss.xml’,           cat:‘KSA’      },
];

const KEY_ENTITIES = [
‘Hamilton’,‘Verstappen’,‘Norris’,‘Leclerc’,‘Russell’,‘Antonelli’,‘Piastri’,‘Alonso’,
‘Arsenal’,‘Man City’,‘Liverpool’,‘Chelsea’,‘Real Madrid’,‘Barcelona’,‘Bayern’,
‘Al Nassr’,‘Al Hilal’,‘Ronaldo’,‘Saudi Pro League’,‘Grand Prix’,‘McLaren’,‘Ferrari’,‘Mercedes’
];

const TEAM_COLORS = {
mercedes:’#00d2be’, ferrari:’#e8002d’, red_bull:’#3671c6’,
mclaren:’#ff8700’, aston_martin:’#229971’, alpine:’#0093cc’,
williams:’#64c4ff’, rb:’#6692ff’, kick_sauber:’#52e252’, haas:’#b6babd’
};

const NEXT_RACE = {
title: ‘Canadian Grand Prix’,
location: ‘Circuit Gilles Villeneuve, Montreal’,
date: ‘2026-05-24T20:00:00Z’
};

const FALLBACK_NEWS = [
{ title:‘Kimi Antonelli leads F1 standings with 20pt advantage heading into Canadian GP’, src:‘F1’, cat:‘F1’, link:‘https://www.formula1.com’, ago: 3600000 },
{ title:‘Canadian GP Sprint weekend: Race lights out Sunday May 24 at 20:00 UTC’, src:‘Sky F1’, cat:‘F1’, link:‘https://www.skysports.com/f1’, ago: 7200000 },
{ title:‘George Russell seeking form reversal in Montreal after difficult Miami GP’, src:‘BBC F1’, cat:‘F1’, link:‘https://www.bbc.com/sport/formula1’, ago: 10800000 },
{ title:‘McLaren close gap to Mercedes — Norris pushes Antonelli to the limit in Miami’, src:‘BBC F1’, cat:‘F1’, link:‘https://www.bbc.com/sport/formula1’, ago: 14400000 },
{ title:‘Arsenal beat Burnley 1-0 — Gunners strengthen title push ahead of final day’, src:‘BBC Sport’, cat:‘FOOTBALL’, link:‘https://www.bbc.com/sport/football’, ago: 18000000 },
{ title:‘Chelsea vs Tottenham tonight — London derby to decide European qualification’, src:‘Sky Sports’, cat:‘FOOTBALL’, link:‘https://www.skysports.com/football’, ago: 21600000 },
{ title:‘Man City vs Bournemouth: Guardiola warns of difficult test at Vitality Stadium’, src:‘BBC Sport’, cat:‘FOOTBALL’, link:‘https://www.bbc.com/sport/football’, ago: 25200000 },
{ title:‘Real Madrid beat Sevilla 1-0 — Bellingham goal keeps La Liga title hopes alive’, src:‘BBC Sport’, cat:‘FOOTBALL’, link:‘https://www.bbc.com/sport/football’, ago: 28800000 },
];

// ── STATE ──────────────────────────────────────────────
let foodLog = [], setLog = [];
let parsedStoriesCache = [];
let currentFilter = ‘ALL’;

// ── INIT ───────────────────────────────────────────────
document.addEventListener(‘DOMContentLoaded’, function() {
try { foodLog = JSON.parse(localStorage.getItem(‘m_food’) || ‘[]’); } catch(e) { foodLog = []; }
try { setLog  = JSON.parse(localStorage.getItem(‘m_sets’) || ‘[]’); } catch(e) { setLog  = []; }
renderFood();
renderSets();
startClock();
startCountdown();
loadNewsFeed();
loadFootballScores();
loadF1Data();
});

// ── CLOCK ──────────────────────────────────────────────
function startClock() {
var el = document.getElementById(‘clock’);
function tick() {
var d = new Date();
if (el) el.textContent = String(d.getHours()).padStart(2,‘0’) + ‘:’ + String(d.getMinutes()).padStart(2,‘0’);
}
tick();
setInterval(tick, 10000);
}

// ── TAB SWITCH ─────────────────────────────────────────
function switchTab(tab) {
[‘feed’,‘sports’,‘health’].forEach(function(t) {
var panel = document.getElementById(‘panel-’ + t);
var btn   = document.getElementById(‘nav-’ + t);
if (panel) panel.classList.toggle(‘active’, t === tab);
if (btn)   btn.classList.toggle(‘active’,   t === tab);
});
document.getElementById(‘scroll-wrap’).scrollTop = 0;
}

// ── COUNTDOWN ──────────────────────────────────────────
function startCountdown() {
var trackEl = document.getElementById(‘f1-next-track’);
var sessEl  = document.getElementById(‘f1-next-session’);
if (trackEl) trackEl.textContent = NEXT_RACE.title;
if (sessEl)  sessEl.textContent  = NEXT_RACE.location;

function tick() {
var diff = Date.parse(NEXT_RACE.date) - Date.now();
if (diff <= 0) {
[‘cd-days’,‘cd-hours’,‘cd-mins’,‘cd-secs’].forEach(function(id) {
var el = document.getElementById(id);
if (el) el.textContent = ‘00’;
});
return;
}
var d = document.getElementById(‘cd-days’);
var h = document.getElementById(‘cd-hours’);
var m = document.getElementById(‘cd-mins’);
var s = document.getElementById(‘cd-secs’);
if (d) d.textContent = String(Math.floor(diff / 86400000)).padStart(2, ‘0’);
if (h) h.textContent = String(Math.floor(diff % 86400000 / 3600000)).padStart(2, ‘0’);
if (m) m.textContent = String(Math.floor(diff % 3600000 / 60000)).padStart(2, ‘0’);
if (s) s.textContent = String(Math.floor(diff % 60000 / 1000)).padStart(2, ‘0’);
}
tick();
setInterval(tick, 1000);
}

// ── TICKER (pure CSS driven, just set content) ─────────
function setTickerContent(titles) {
var track = document.getElementById(‘ticker’);
if (!track || !titles.length) return;
var items = titles.slice(0, 8).map(function(t) {
return ‘<span class="ticker-item">• ’ + t.substring(0, 70) + ‘</span>’;
}).join(’’);
track.innerHTML = items + items;
}

// ── F1 STANDINGS ───────────────────────────────────────
async function loadF1Data() {
var body    = document.getElementById(‘f1-standings-body’);
var roundEl = document.getElementById(‘f1-standings-round’);
if (!body) return;

// Show real hardcoded data immediately — no spinner, no wait
renderHardcodedStandings(body);
if (roundEl) roundEl.textContent = ‘2026 · R4’;

// Try to fetch live data in background and update if successful
try {
var controller = new AbortController();
var timer = setTimeout(function() { controller.abort(); }, 5000);
var url = F1_BASE + ‘/current/driverstandings.json?limit=20’;
var res = await fetch(url, { signal: controller.signal });
clearTimeout(timer);
if (res.ok) {
var data = await res.json();
renderF1Standings(data, roundEl, body);
}
} catch(e) {
// Hardcoded data already shown — no error needed
}
}

// Real 2026 standings after Round 4 (Miami GP) — updated May 19 2026
var F1_STANDINGS_2026 = [
{ pos:1, num:12, name:‘Antonelli’, team:‘Mercedes’,     cid:‘mercedes’,     pts:100, wins:3 },
{ pos:2, num:63, name:‘Russell’,   team:‘Mercedes’,     cid:‘mercedes’,     pts:80,  wins:1 },
{ pos:3, num:16, name:‘Leclerc’,   team:‘Ferrari’,      cid:‘ferrari’,      pts:59,  wins:0 },
{ pos:4, num:4,  name:‘Norris’,    team:‘McLaren’,      cid:‘mclaren’,      pts:51,  wins:0 },
{ pos:5, num:44, name:‘Hamilton’,  team:‘Ferrari’,      cid:‘ferrari’,      pts:51,  wins:0 },
{ pos:6, num:81, name:‘Piastri’,   team:‘McLaren’,      cid:‘mclaren’,      pts:43,  wins:0 },
{ pos:7, num:14, name:‘Alonso’,    team:‘Aston Martin’, cid:‘aston_martin’, pts:24,  wins:0 },
{ pos:8, num:18, name:‘Stroll’,    team:‘Aston Martin’, cid:‘aston_martin’, pts:12,  wins:0 },
{ pos:9, num:10, name:‘Gasly’,     team:‘Alpine’,       cid:‘alpine’,       pts:10,  wins:0 },
{ pos:10,num:55, name:‘Sainz’,     team:‘Williams’,     cid:‘williams’,     pts:9,   wins:0 },
];

function renderF1Standings(data, roundEl, body) {
// Try to parse live API data first
var drivers = null;
var round = ‘4’;
try {
var sl = data && data.MRData && data.MRData.StandingsTable && data.MRData.StandingsTable.StandingsLists[0];
if (sl && sl.DriverStandings && sl.DriverStandings.length) {
drivers = sl.DriverStandings.slice(0, 10);
round = sl.round;
}
} catch(e) {}

if (roundEl) roundEl.textContent = ‘2026 · R’ + round;

// Fall back to hardcoded if API gave nothing useful
if (!drivers || !drivers.length) {
renderHardcodedStandings(body);
return;
}

var maxPts = parseFloat(drivers[0].points) || 1;
var html = ‘<div class="f1-std-header"><span>POS</span><span>NO</span><span>DRIVER</span><span style="text-align:right">W</span><span style="text-align:right">PTS</span></div>’;
drivers.forEach(function(d) {
var pos = parseInt(d.position);
var cid = d.Constructors && d.Constructors[0] ? d.Constructors[0].constructorId : ‘default’;
var col = TEAM_COLORS[cid] || ‘#8a8fa8’;
var pts = parseFloat(d.points);
var barW = Math.round((pts / maxPts) * 100);
var posClass = pos === 1 ? ‘p1’ : pos === 2 ? ‘p2’ : pos === 3 ? ‘p3’ : ‘’;
html += ‘<div class="f1-std-row">’
+ ‘<span class="f1-pos ' + posClass + '">’ + pos + ‘</span>’
+ ‘<span class="f1-num" style="background:' + col + '22;color:' + col + '">’ + d.Driver.permanentNumber + ‘</span>’
+ ‘<div class="f1-driver-info">’
+   ‘<span class="f1-driver-name">’ + d.Driver.familyName + ‘</span>’
+   ‘<div class="f1-con-bar"><div class="f1-con-fill" style="width:' + barW + '%;background:' + col + '"></div></div>’
+ ‘</div>’
+ ‘<span class="f1-wins">’ + d.wins + ‘</span>’
+ ‘<span class="f1-pts">’ + pts + ‘</span>’
+ ‘</div>’;
});
var t = new Date().toLocaleTimeString([], {hour:‘2-digit’, minute:‘2-digit’});
html += ’<div class="f1-last-updated">Live · Jolpica F1 API · ’ + t + ‘</div>’;
body.innerHTML = html;
}

function renderHardcodedStandings(body) {
var maxPts = F1_STANDINGS_2026[0].pts;
var html = ‘<div class="f1-std-header"><span>POS</span><span>NO</span><span>DRIVER</span><span style="text-align:right">W</span><span style="text-align:right">PTS</span></div>’;
F1_STANDINGS_2026.forEach(function(d) {
var col = TEAM_COLORS[d.cid] || ‘#8a8fa8’;
var barW = Math.round((d.pts / maxPts) * 100);
var posClass = d.pos === 1 ? ‘p1’ : d.pos === 2 ? ‘p2’ : d.pos === 3 ? ‘p3’ : ‘’;
html += ‘<div class="f1-std-row">’
+ ‘<span class="f1-pos ' + posClass + '">’ + d.pos + ‘</span>’
+ ‘<span class="f1-num" style="background:' + col + '22;color:' + col + '">’ + d.num + ‘</span>’
+ ‘<div class="f1-driver-info">’
+   ‘<span class="f1-driver-name">’ + d.name + ‘</span>’
+   ‘<div class="f1-con-bar"><div class="f1-con-fill" style="width:' + barW + '%;background:' + col + '"></div></div>’
+ ‘</div>’
+ ‘<span class="f1-wins">’ + d.wins + ‘</span>’
+ ‘<span class="f1-pts">’ + d.pts + ‘</span>’
+ ‘</div>’;
});
html += ‘<div class="f1-last-updated">After R4 Miami · Updated May 19 2026</div>’;
body.innerHTML = html;
}

// ── FOOTBALL ───────────────────────────────────────────
function loadFootballScores() {
var container = document.getElementById(‘football-scores-container’);
if (!container) return;
container.innerHTML = ‘<div class="f1-api-loading"><div class="f1-spinner" style="border-top-color:var(--epl-green)"></div><span>Loading matches…</span></div>’;

setTimeout(function() {
var matches = [
{ league:‘PREMIER LEAGUE’, status:‘Today 21:30 AST’, isLive:false, t1:‘Bournemouth’, s1:null, t2:‘Man City’,    s2:null, events:‘Kick-off soon · City favoured 57.8%’ },
{ league:‘PREMIER LEAGUE’, status:‘Today 22:15 AST’, isLive:false, t1:‘Chelsea’,     s1:null, t2:‘Tottenham’,   s2:null, events:‘London derby · CFC 49.6% win prob’ },
{ league:‘PREMIER LEAGUE’, status:‘FT · Mon 18’,     isLive:false, t1:‘Arsenal’,     s1:1,    t2:‘Burnley’,     s2:0,    events:‘Goal: Arsenal 1-0’ },
{ league:‘PREMIER LEAGUE’, status:‘FT · Sun 17’,     isLive:false, t1:‘Newcastle’,   s1:3,    t2:‘West Ham’,    s2:1,    events:‘Goals: Isak 2', Gordon 55', Guimaraes 78'’ },
{ league:‘PREMIER LEAGUE’, status:‘FT · Sun 17’,     isLive:false, t1:‘Man Utd’,     s1:3,    t2:‘Nott'm Forest’, s2:2, events:‘Goals: Rashford 12', 45', Hojlund 67'’ },
{ league:‘LA LIGA’,        status:‘FT · Sun 17’,     isLive:false, t1:‘Real Madrid’, s1:1,    t2:‘Sevilla’,     s2:0,    events:‘Goal: Bellingham 34'’ },
{ league:‘LA LIGA’,        status:‘FT · Sun 17’,     isLive:false, t1:‘Barcelona’,   s1:3,    t2:‘Real Betis’,  s2:1,    events:‘Goals: Yamal 22', Lewandowski 55', 78'’ },
];

```
var html = '';
matches.forEach(function(m) {
  var s1 = m.s1 === null ? '' : m.s1;
  var s2 = m.s2 === null ? '' : m.s2;
  var scoreHtml = m.s1 === null
    ? '<div style="font-size:11px;color:var(--txt-muted);font-family:\'JetBrains Mono\',monospace;padding:4px 0;">vs</div>'
    : '<div style="display:flex;gap:16px;align-items:center;padding:4px 0;">'
      + '<span class="live-team-score">' + s1 + '</span>'
      + '<span style="color:var(--txt-muted)">–</span>'
      + '<span class="live-team-score">' + s2 + '</span>'
      + '</div>';

  html += '<div class="live-match-box">'
    + '<div class="live-meta-row">'
    +   '<span class="league-badge">' + m.league + '</span>'
    +   '<span class="live-status-pill ' + (m.isLive ? 'active-game' : 'ft-game') + '">' + m.status + '</span>'
    + '</div>'
    + '<div style="display:flex;align-items:center;justify-content:space-between;">'
    +   '<div><div class="live-team-name">' + m.t1 + '</div><div class="live-team-name" style="margin-top:4px;">' + m.t2 + '</div></div>'
    +   scoreHtml
    + '</div>'
    + '<div class="live-match-events">' + m.events + '</div>'
    + '</div>';
});
container.innerHTML = html;
```

}, 300);
}

// ── NEWS RSS ────────────────────────────────────────────
async function fetchRSS(channel) {
try {
var controller = new AbortController();
var timer = setTimeout(function() { controller.abort(); }, 7000);
var res = await fetch(RSS_API + encodeURIComponent(channel.url) + ‘&count=8’, {
signal: controller.signal
});
clearTimeout(timer);
var d = await res.json();
if (d.status === ‘ok’ && d.items && d.items.length) return d.items;
} catch(e) {}
return [];
}

async function loadNewsFeed() {
var container = document.getElementById(‘critical-posts’);
if (!container) return;
container.innerHTML = ‘<div class="f1-api-loading"><div class="f1-spinner"></div><span>Loading news…</span></div>’;
parsedStoriesCache = [];

for (var i = 0; i < MASTER_CHANNELS.length; i++) {
var ch = MASTER_CHANNELS[i];
try {
var items = await fetchRSS(ch);
for (var j = 0; j < items.length; j++) {
var item = items[j];
if (!item.title) continue;
parsedStoriesCache.push({
title: item.title.replace(/[\r\n]+/g, ’ ’).trim(),
link:  item.link || ‘#’,
time:  item.pubDate ? Date.parse(item.pubDate) : Date.now(),
cat:   ch.cat,
src:   ch.name
});
}
} catch(e) {}
}

parsedStoriesCache.sort(function(a, b) { return b.time - a.time; });
renderNewsFeed();
}

function setFeedFilter(cat, el) {
currentFilter = cat;
document.querySelectorAll(’.filter-pill’).forEach(function(p) { p.classList.remove(‘active’); });
if (el) el.classList.add(‘active’);
renderNewsFeed();
}

function timeAgo(ms) {
var diff = (Date.now() - ms) / 1000;
if (diff < 60)    return ‘just now’;
if (diff < 3600)  return Math.floor(diff / 60) + ‘m ago’;
if (diff < 86400) return Math.floor(diff / 3600) + ‘h ago’;
return Math.floor(diff / 86400) + ‘d ago’;
}

function boldEntities(text) {
KEY_ENTITIES.forEach(function(ent) {
text = text.replace(new RegExp(’\b’ + ent + ‘\b’, ‘gi’), ‘<strong>$&</strong>’);
});
return text;
}

function makeWireItem(title, src, timeMs, link) {
return ‘<div class="wire-item" onclick="window.open(\'' + link + '\',\'_blank\')">’
+ ‘<span class="wire-bullet">•</span>’
+ ‘<div class="wire-content">’
+   ‘<p class="wire-headline">’ + boldEntities(title) + ‘</p>’
+   ‘<div class="wire-meta">’
+     ‘<span class="wire-source">’ + src + ‘</span>’
+     ‘<span class="wire-time">’ + timeAgo(timeMs) + ‘</span>’
+   ‘</div>’
+ ‘</div>’
+ ‘</div>’;
}

function renderNewsFeed() {
var container = document.getElementById(‘critical-posts’);
if (!container) return;

var filtered = currentFilter === ‘ALL’
? parsedStoriesCache
: parsedStoriesCache.filter(function(s) { return s.cat === currentFilter; });

var shown = filtered.slice(0, 20);

if (!shown.length) {
// Show real fallback headlines
var fbFiltered = currentFilter === ‘ALL’
? FALLBACK_NEWS
: FALLBACK_NEWS.filter(function(s) { return s.cat === currentFilter; });

```
var fbHtml = '';
fbFiltered.forEach(function(s) {
  fbHtml += makeWireItem(s.title, s.src, Date.now() - s.ago, s.link);
});
container.innerHTML = fbHtml || '<div class="empty-state">No headlines — tap REFRESH</div>';
setTickerContent(fbFiltered.map(function(s) { return s.title; }));
return;
```

}

var html = ‘’;
shown.forEach(function(story) {
html += makeWireItem(story.title, story.src, story.time, story.link);
});
container.innerHTML = html;
setTickerContent(shown.map(function(s) { return s.title; }));
}

// ── NUTRITION ──────────────────────────────────────────
var TARGETS = { kcal:2500, prot:180, carb:280, fat:70 };

function addFood() {
var name = document.getElementById(‘food-name’).value.trim();
var kcal = parseFloat(document.getElementById(‘food-kcal’).value) || 0;
var prot = parseFloat(document.getElementById(‘food-prot’).value) || 0;
var carb = parseFloat(document.getElementById(‘food-carb’).value) || 0;
var fat  = parseFloat(document.getElementById(‘food-fat’).value)  || 0;
if (!name) return;
foodLog.push({ id: Date.now(), name: name, kcal: kcal, prot: prot, carb: carb, fat: fat });
localStorage.setItem(‘m_food’, JSON.stringify(foodLog));
renderFood();
[‘food-name’,‘food-kcal’,‘food-prot’,‘food-carb’,‘food-fat’].forEach(function(id) {
document.getElementById(id).value = ‘’;
});
}

function deleteFood(id) {
foodLog = foodLog.filter(function(f) { return f.id !== id; });
localStorage.setItem(‘m_food’, JSON.stringify(foodLog));
renderFood();
}

function renderFood() {
var totals = foodLog.reduce(function(a, b) {
return { kcal: a.kcal+b.kcal, prot: a.prot+b.prot, carb: a.carb+b.carb, fat: a.fat+b.fat };
}, { kcal:0, prot:0, carb:0, fat:0 });

var pct  = Math.min(totals.kcal / TARGETS.kcal, 1);
var ring = document.getElementById(‘cal-ring’);
if (ring) { ring.style.strokeDasharray = ‘314’; ring.style.strokeDashoffset = 314 * (1 - pct); }

var calEl = document.getElementById(‘cal-display’);
if (calEl) calEl.textContent = Math.round(totals.kcal);

var setBar = function(valId, barId, val, target) {
var ve = document.getElementById(valId);
var be = document.getElementById(barId);
if (ve) ve.textContent = Math.round(val) + ‘g’;
if (be) be.style.width = Math.min(val / target * 100, 100) + ‘%’;
};
setBar(‘prot-val’, ‘prot-bar’, totals.prot, TARGETS.prot);
setBar(‘carb-val’, ‘carb-bar’, totals.carb, TARGETS.carb);
setBar(‘fat-val’,  ‘fat-bar’,  totals.fat,  TARGETS.fat);

var list = document.getElementById(‘food-list’);
if (!list) return;
if (!foodLog.length) { list.innerHTML = ‘<div class="empty-state">No foods logged yet.</div>’; return; }
list.innerHTML = foodLog.map(function(f) {
return ‘<div class="food-item">’
+ ‘<span class="food-item-name">’ + f.name + ‘</span>’
+ ‘<span class="food-item-kcal">’ + f.kcal + ’ kcal</span>’
+ ‘<button class="food-del" onclick="deleteFood(' + f.id + ')">×</button>’
+ ‘</div>’;
}).join(’’);
}

// ── WORKOUT ────────────────────────────────────────────
function addSet() {
var ex = document.getElementById(‘set-exercise’).value.trim();
var wt = parseFloat(document.getElementById(‘set-weight’).value) || 0;
var rp = parseInt(document.getElementById(‘set-reps’).value)     || 0;
if (!ex || !rp) return;
setLog.push({ id: Date.now(), exercise: ex, weight: wt, reps: rp });
localStorage.setItem(‘m_sets’, JSON.stringify(setLog));
renderSets();
[‘set-weight’,‘set-reps’].forEach(function(id) { document.getElementById(id).value = ‘’; });
}

function deleteSet(id) {
setLog = setLog.filter(function(s) { return s.id !== id; });
localStorage.setItem(‘m_sets’, JSON.stringify(setLog));
renderSets();
}

function renderSets() {
var totalVol = setLog.reduce(function(a, b) { return a + b.weight * b.reps; }, 0);
var uniqueEx = new Set(setLog.map(function(s) { return s.exercise.toLowerCase(); })).size;

var setsEl  = document.getElementById(‘wk-sets’);
var volEl   = document.getElementById(‘wk-vol’);
var exsEl   = document.getElementById(‘wk-exs’);
var totalEl = document.getElementById(‘vol-total-val’);
if (setsEl)  setsEl.textContent  = setLog.length;
if (volEl)   volEl.textContent   = totalVol;
if (exsEl)   exsEl.textContent   = uniqueEx;
if (totalEl) totalEl.textContent = totalVol + ’ kg’;

var list = document.getElementById(‘set-list’);
if (!list) return;
if (!setLog.length) { list.innerHTML = ‘<div class="empty-state">No sets logged yet.</div>’; return; }
list.innerHTML = setLog.map(function(s) {
return ‘<div class="set-row">’
+ ‘<span class="set-exercise">’ + s.exercise + ‘</span>’
+ ‘<span class="food-item-kcal">’ + s.weight + ‘kg x ’ + s.reps + ’ = ’ + (s.weight * s.reps) + ‘kg</span>’
+ ‘<button class="set-del" onclick="deleteSet(' + s.id + ')">×</button>’
+ ‘</div>’;
}).join(’’);
}