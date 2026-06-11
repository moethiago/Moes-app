// ============================================================
// football-fetch.js — schedule loads once (6h server cache),
// ONLY the live endpoint polls. Live scores overlay onto the
// rendered schedule. Free-tier budget safe.
// ============================================================

var footballScheduleCache = null;   // [{key, fixtures, upcoming}] in league order
var footballLivePollTimer = null;

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

async function fetchLiveScores() {
  try {
    var controller = new AbortController();
    var timer = setTimeout(function() { controller.abort(); }, 8000);
    var res = await fetch(BACKEND_URL + '?type=live', { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return [];
    var data = await res.json();
    return data.live || [];
  } catch(e) { return []; }
}

// Merge live match data into the cached schedule by fixture id,
// then re-render. If a live match isn't in today's schedule (edge case),
// it's appended to its league's fixtures.
function overlayLiveScores(liveMatches) {
  if (!footballScheduleCache) return;

  var liveById = {};
  liveMatches.forEach(function(m) { liveById[m.id] = m; });

  footballScheduleCache.forEach(function(leagueData) {
    // update existing fixtures in place
    leagueData.fixtures = leagueData.fixtures.map(function(f) {
      return liveById[f.id] ? liveById[f.id] : f;
    });
    // append any live match for this league missing from schedule
    liveMatches.forEach(function(m) {
      if (m.leagueKey !== leagueData.key) return;
      var exists = leagueData.fixtures.some(function(f) { return f.id === m.id; });
      if (!exists) leagueData.fixtures.push(m);
    });
  });

  renderFootballFromCache();
}

function renderFootballFromCache() {
  var container = document.getElementById('football-fixtures');
  if (!container || !footballScheduleCache) return;
  var html = '';
  var total = 0;
  FOOTBALL_LEAGUES.forEach(function(league, i) {
    var data = footballScheduleCache[i];
    total += data.fixtures.length + data.upcoming.length;
    html += renderLeagueBlock(league, data);
  });
  container.innerHTML = total === 0
    ? '<div class="fxt-empty" style="padding:32px 16px;">No matches or upcoming fixtures found</div>'
    : html;
}

async function loadAllFootball() {
  var container = document.getElementById('football-fixtures');
  if (!container) return;

  // 1) Load schedule ONCE (server caches 6h, so these are cheap KV hits)
  if (!footballScheduleCache) {
    container.innerHTML = '<div class="fxt-loading"><div class="f1-spinner"></div><span>Loading fixtures...</span></div>';
    footballScheduleCache = await Promise.all(
      FOOTBALL_LEAGUES.map(function(l) { return fetchLeague(l.key); })
    );
  }
  renderFootballFromCache();

  // 2) Overlay live scores immediately
  var live = await fetchLiveScores();
  if (live.length) overlayLiveScores(live);
}

// Poll ONLY the live endpoint. 90s keeps usage tiny; server cache
// means many opens share one upstream request.
function buildFootballSection() {
  loadAllFootball();
  if (footballTimer) clearInterval(footballTimer);
  footballTimer = setInterval(async function() {
    var live = await fetchLiveScores();
    if (live.length) {
      overlayLiveScores(live);
    }
  }, 90000);
}
