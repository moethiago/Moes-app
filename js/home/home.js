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
  html += '<div class="home-section-title">For You</div>';
  html += '<div id="home-news"><div class="f1a-sub" style="padding:0 14px">Loading...</div></div>';

  // Alerts
  html += '<div id="home-alerts" style="padding:18px 14px 28px"></div>';

  root.innerHTML = html;

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
  var clubs = ['Bayern', 'Al-Hilal'];
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

// "For You" — clusters dupes, ranks by the TYPES of news you engage with.
var _homeShownStories = []; // track what's shown so we can detect skips

async function homeLoadNews() {
  var el = document.getElementById('home-news');
  if (!el) return;
  var stories = [];
  try {
    var res = await fetch('https://moes-app-two.vercel.app/api/feed');
    if (res.ok) { var data = await res.json(); stories = data.stories || []; }
  } catch(e) {}
  if (!stories.length && typeof parsedStoriesCache !== 'undefined') stories = parsedStoriesCache || [];

  if (!stories.length) {
    el.innerHTML = '<div class="f1a-sub" style="padding:0 14px">No news right now.</div>';
    return;
  }

  // 1) Cluster near-duplicates so repeats collapse into one card.
  var clusters = homeClusterStories(stories);

  // 2) Representative per cluster + type-affinity score.
  var cards = clusters.map(function(group){
    var rep = group.slice().sort(function(a,b){ return (b.score||0)-(a.score||0) || (b.pubTs||0)-(a.pubTs||0); })[0];
    var ts = (typeof typeScore === 'function') ? typeScore(rep) : 0;
    // base recency component so fresh news still surfaces before learning kicks in
    var recency = rep.pubTs ? Math.max(0, 1 - (Date.now()/1000 - rep.pubTs)/172800) : 0;
    return { rep: rep, sources: group.length, ts: ts, rank: ts + recency };
  });

  // 3) Rank by (type affinity + recency).
  cards.sort(function(a,b){ if (b.rank !== a.rank) return b.rank - a.rank; return (b.rep.pubTs||0)-(a.rep.pubTs||0); });

  // remember shown order for skip-learning
  _homeShownStories = cards.slice(0, 8).map(function(c){ return { title: c.rep.title }; });

  var summaryHtml = homeWhatToKnow(cards);

  function ago(ts){ var m=Math.floor((Date.now()-ts*1000)/60000); if(m<1)return'now'; if(m<60)return m+'m'; var h=Math.floor(m/60); if(h<24)return h+'h'; return Math.floor(h/24)+'d'; }
  function catEmoji(c){ return c==='F1'?'\u{1F3CE}\uFE0F':(c==='BAYERN'?'\u{1F534}':(c==='SPL'?'\u{1F1F8}\u{1F1E6}':(c==='KSA'?'\u{1F4F0}':'\u26BD'))); }
  var typeLabels = { transfer:'Transfer', contract:'Contract', result:'Result', injury:'Injury',
    preview:'Preview', lineup:'Team news', manager:'Manager', opinion:'Analysis', business:'Business', result_f1:'Race weekend' };

  var html = summaryHtml;
  cards.slice(0, 16).forEach(function(c){
    var s = c.rep;
    var types = (typeof classifyStory === 'function') ? classifyStory(s) : [];
    var typeTag = types.length ? (typeLabels[types[0]] || '') : '';
    var payload = encodeURIComponent(JSON.stringify({ title:s.title, emb:s.emb||null, cat:s.cat }));
    html += '<a class="foryou-card" href="' + s.url + '" target="_blank" rel="noopener" onclick="homeOnStoryClick(\'' + payload + '\')">';
    html += '<div class="foryou-top">'
      + '<span class="foryou-cat">' + catEmoji(s.cat) + ' ' + s.cat + '</span>'
      + (typeTag ? '<span class="foryou-type">' + typeTag + '</span>' : '')
      + (c.sources > 1 ? '<span class="foryou-sources">\u{1F4F0} ' + c.sources + ' sources</span>' : '')
      + '<span class="foryou-time">' + ago(s.pubTs) + '</span>'
      + '</div>';
    html += '<div class="foryou-title">' + s.title + '</div>';
    html += '</a>';
  });
  el.innerHTML = html;
}

// Why is this story shown? Returns a short reason or ''.
function homeWhy(story) { return ''; }

// Cluster stories by embedding (if present) else title similarity.
function homeClusterStories(stories) {
  var clusters = [];
  function words(t){ return new Set((t||'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(function(w){return w.length>3;})); }
  function sim(a,b){ if(!a.size||!b.size)return 0; var inter=0; a.forEach(function(x){ if(b.has(x))inter++; }); return inter/Math.min(a.size,b.size); }
  stories.forEach(function(s){
    var placed = false;
    for (var i=0;i<clusters.length;i++){
      var rep = clusters[i][0];
      var same = false;
      if (s.emb && rep.emb && typeof cosineSim === 'function') same = cosineSim(s.emb, rep.emb) >= 0.82;
      else same = sim(words(s.title), words(rep.title)) >= 0.5;
      if (same) { clusters[i].push(s); placed = true; break; }
    }
    if (!placed) clusters.push([s]);
  });
  return clusters;
}

// AI-style "what to know" summary from the top stories.
function homeWhatToKnow(cards) {
  if (!cards.length) return '';
  var learned = (typeof tasteReady === 'function') && tasteReady();
  var lead = '';
  if (learned && typeof tasteSummary === 'function') {
    var likes = tasteSummary();
    if (likes.length) lead = '<div class="brief-learned">Tuned to you: more ' + likes.join(', ') + '</div>';
  }
  var top = cards.slice(0, 3).filter(function(c){ return c.rep && c.rep.title; });
  if (!top.length) return '';
  var items = top.map(function(c){
    return '<li class="brief-li">' + c.rep.title + (c.sources>1?' <span class="brief-src">('+c.sources+' sources)</span>':'') + '</li>';
  }).join('');
  return '<div class="brief-card"><div class="brief-h">\u2728 What to know right now</div><ul class="brief-ul">' + items + '</ul>' + lead + '</div>';
}

// Record an open (positive) + skips for the others shown above it.
function homeOnStoryClick(payload) {
  try {
    var story = JSON.parse(decodeURIComponent(payload));
    if (typeof recordOpen === 'function') recordOpen(story);
    if (typeof recordSkips === 'function') recordSkips(_homeShownStories, story.title);
  } catch(e) {}
  return true; // allow navigation
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
