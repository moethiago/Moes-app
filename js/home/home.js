// ============================================================
// home.js — personalized Home tab. Pulls together:
//  - a one-line daily brief (auto-written from your data)
//  - your next F1 session (local time)
//  - your followed clubs' next matches
//  - your World Cup team's next match
//  - breaking news matching teams/drivers you follow
// Reads prefs.js; reuses F1_CALENDAR, football fetch, wc engine.
// ============================================================

function loadHome() {
  var root = document.getElementById('home-body');
  if (!root) return;
  root.innerHTML = '<div class="fxt-loading"><div class="f1-spinner"></div><span>Building your brief...</span></div>';

  var p = (typeof loadPrefs === 'function') ? loadPrefs() : {};
  var blocks = [];

  // 1) Next F1 session (spoiler-free — it's upcoming)
  var f1Next = homeNextF1();

  // 2) Greeting + brief (assembled after async football loads)
  var greeting = homeGreeting();

  // Render the static parts first, then fill news + football async
  var html = '<div class="home-hero"><div class="home-greeting">' + greeting + '</div>'
    + '<div class="home-brief" id="home-brief">Putting your day together...</div></div>';

  // Next events row
  html += '<div class="home-section-title">Your next events</div>';
  html += '<div id="home-events">';
  if (f1Next) html += homeEventCard('\u{1F3CE}\uFE0F', f1Next.label, f1Next.when, 'f1');
  html += '<div id="home-football-events"></div>';
  html += '</div>';

  // Your news
  html += '<div class="home-section-title">News on who you follow</div>';
  html += '<div id="home-news"><div class="f1a-sub" style="padding:0 14px">Loading...</div></div>';

  // Quick links + follow editor
  html += '<div class="home-section-title">Following</div>';
  html += '<div id="home-follows" style="padding:0 14px 8px"></div>';

  // Alerts
  html += '<div id="home-alerts" style="padding:0 14px 28px"></div>';

  root.innerHTML = html;

  homeRenderFollows();
  homeRenderAlerts();
  homeLoadFootballEvents();
  homeLoadNews();
  homeBuildBrief(f1Next);
}

function homeGreeting() {
  var h = new Date().getHours();
  var part = h < 12 ? 'Good morning' : (h < 18 ? 'Good afternoon' : 'Good evening');
  return part + ', Moaath';
}

// Find the user's next F1 session from the calendar.
function homeNextF1() {
  if (typeof F1_CALENDAR === 'undefined') return null;
  var now = Date.now();
  for (var i = 0; i < F1_CALENDAR.length; i++) {
    var race = F1_CALENDAR[i];
    for (var j = 0; j < race.sessions.length; j++) {
      var s = race.sessions[j];
      if (Date.parse(s.time) > now) {
        var d = new Date(s.time);
        return {
          label: race.race.replace(' Grand Prix', ' GP') + ' \u00b7 ' + s.name,
          when: d.toLocaleString([], { weekday:'short', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }),
          ts: d.getTime(),
        };
      }
    }
  }
  return null;
}

function homeEventCard(icon, title, when, tab) {
  return '<div class="home-event" onclick="switchTab(\'' + tab + '\')">'
    + '<span class="home-event-icon">' + icon + '</span>'
    + '<div class="home-event-info"><div class="home-event-title">' + title + '</div>'
    + '<div class="home-event-when">' + when + '</div></div>'
    + '<span class="home-event-arrow">\u203A</span></div>';
}

// Pull followed clubs' next matches from the football backend.
async function homeLoadFootballEvents() {
  var el = document.getElementById('home-football-events');
  if (!el || typeof FOOTBALL_LEAGUES === 'undefined') return;
  var p = (typeof loadPrefs === 'function') ? loadPrefs() : {};
  var clubs = p.footballClubs || [];
  if (!clubs.length) return;
  try {
    var results = await Promise.all(FOOTBALL_LEAGUES.map(function(l){ return fetchLeague(l.key); }));
    var all = [];
    results.forEach(function(r){ all = all.concat(r.fixtures || [], r.upcoming || []); });
    var html = '';
    clubs.forEach(function(club){
      var m = all.find(function(f){
        return (f.home && f.home.indexOf(club) !== -1) || (f.away && f.away.indexOf(club) !== -1);
      });
      if (m) {
        var opp = (m.home.indexOf(club) !== -1) ? m.away : m.home;
        var when = (typeof formatKickoff === 'function') ? formatKickoff(m.time) : '';
        var hasScore = m.homeScore !== null && m.awayScore !== null;
        var sub = hasScore ? (m.home + ' ' + m.homeScore + '-' + m.awayScore + ' ' + m.away) : ('vs ' + opp + ' \u00b7 ' + when);
        html += homeEventCard('\u26BD', club, sub, 'football');
      }
    });
    el.innerHTML = html;
  } catch(e) {}
}

// News matching follows, from the feed pipeline.
async function homeLoadNews() {
  var el = document.getElementById('home-news');
  if (!el) return;
  var stories = [];
  try {
    var res = await fetch('https://moes-app-two.vercel.app/api/feed');
    if (res.ok) { var data = await res.json(); stories = data.stories || []; }
  } catch(e) {}
  if (!stories.length && typeof parsedStoriesCache !== 'undefined') stories = parsedStoriesCache || [];

  var mine = stories.filter(function(s){ return (typeof storyMatchesFollows === 'function') && storyMatchesFollows(s); });
  if (!mine.length) {
    el.innerHTML = '<div class="f1a-sub" style="padding:0 14px">No breaking news on your teams right now.</div>';
    return;
  }
  mine.sort(function(a,b){ return (b.pubTs||0) - (a.pubTs||0); });
  function ago(ts){ var m=Math.floor((Date.now()-ts*1000)/60000); if(m<1)return'now'; if(m<60)return m+'m'; var h=Math.floor(m/60); if(h<24)return h+'h'; return Math.floor(h/24)+'d'; }
  var html = '<div class="home-news-card">';
  mine.slice(0, 6).forEach(function(s){
    html += '<a class="home-news-row" href="' + s.url + '" target="_blank" rel="noopener">'
      + '<span class="home-news-dot"></span>'
      + '<span class="home-news-title">' + s.title + '</span>'
      + '<span class="home-news-time">' + ago(s.pubTs) + '</span></a>';
  });
  html += '</div>';
  el.innerHTML = html;
}

// One-line brief assembled from the pieces.
async function homeBuildBrief(f1Next) {
  var el = document.getElementById('home-brief');
  if (!el) return;
  var bits = [];
  if (f1Next) {
    var hrs = Math.round((f1Next.ts - Date.now()) / 3600000);
    if (hrs <= 48) bits.push(f1Next.label.split(' \u00b7 ')[1] + ' is ' + (hrs <= 1 ? 'about to start' : 'in ' + hrs + 'h'));
    else bits.push('Next F1: ' + f1Next.label.split(' \u00b7 ')[0]);
  }
  // football + news counts fill in shortly after their loaders; keep it simple
  el.textContent = bits.length ? ('Here\u2019s your day: ' + bits.join(' \u00b7 ') + '.') : 'No big events on your radar right now \u2014 enjoy the quiet.';
}

// Follow editor: simple toggle chips.
function homeRenderFollows() {
  var el = document.getElementById('home-follows');
  if (!el) return;
  var p = (typeof loadPrefs === 'function') ? loadPrefs() : {};
  function chips(listKey, options) {
    return options.map(function(o){
      var on = (p[listKey] || []).indexOf(o) !== -1;
      return '<button class="home-chip' + (on?' on':'') + '" onclick="homeToggle(\'' + listKey + '\',\'' + o + '\')">' + (on?'\u2713 ':'') + o + '</button>';
    }).join('');
  }
  el.innerHTML = '<div class="home-follow-group"><div class="home-follow-label">F1 drivers</div><div class="home-chips">'
    + chips('f1Drivers', ['Verstappen','Leclerc','Hamilton','Norris','Piastri','Russell','Antonelli']) + '</div></div>'
    + '<div class="home-follow-group"><div class="home-follow-label">Football clubs</div><div class="home-chips">'
    + chips('footballClubs', ['Bayern','Al-Hilal','Al-Nassr','Real Madrid','Barcelona','Liverpool','Man City']) + '</div></div>';
}

function homeToggle(listKey, value) {
  if (typeof toggleFollow === 'function') toggleFollow(listKey, value);
  homeRenderFollows();
  // refresh the personalized sections
  homeLoadFootballEvents();
  homeLoadNews();
}

// Alerts row: enable button or status.
function homeRenderAlerts() {
  var el = document.getElementById('home-alerts');
  if (!el) return;
  var perm = (typeof notifyPermission === 'function') ? notifyPermission() : 'unsupported';
  if (perm === 'granted') {
    el.innerHTML = '<div class="home-alert-on">\u2713 Alerts on \u2014 you\u2019ll get a heads-up before your teams play.</div>';
  } else if (perm === 'unsupported') {
    el.innerHTML = '';
  } else {
    el.innerHTML = '<button class="home-alert-btn" onclick="notifyEnable && notifyEnable()">\u{1F514} Turn on match &amp; race alerts</button>';
  }
}
