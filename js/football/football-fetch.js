// ============================================================
// football-fetch.js — fetch all leagues, refresh loop
// Depends on: football-config.js, football-render.js
// ============================================================

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
  var results = await Promise.all(FOOTBALL_LEAGUES.map(function(l) { return fetchLeague(l.key); }));
  var html = '';
  var total = 0;
  FOOTBALL_LEAGUES.forEach(function(league, i) {
    var data = results[i];
    total += data.fixtures.length + data.upcoming.length;
    html += renderLeagueBlock(league, data);
  });
  container.innerHTML = total === 0
    ? '<div class="fxt-empty" style="padding:32px 16px;">No matches or upcoming fixtures found</div>'
    : html;
}

function buildFootballSection() {
  loadAllFootball();
  if (footballTimer) clearInterval(footballTimer);
  footballTimer = setInterval(loadAllFootball, 60000);
}
