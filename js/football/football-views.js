// ============================================================
// football-views.js — Today and Upcoming subtab renderers,
// with a "Your Teams" tracker pinned at the top of Today.
// Reuses fetchLeague() + renderLeagueBlock() from existing files.
// ============================================================

// Render the TODAY subtab: your teams first, then live/today by league.
async function loadFootballToday() {
  var root = document.getElementById('football-today-body');
  if (!root) return;
  root.innerHTML = '<div class="fxt-loading"><div class="f1-spinner"></div><span>Loading today...</span></div>';

  var results = await Promise.all(FOOTBALL_LEAGUES.map(function(l){ return fetchLeague(l.key); }));
  var byKey = {};
  FOOTBALL_LEAGUES.forEach(function(l, i){ byKey[l.key] = results[i]; });

  var html = '';

  // Your Teams tracker
  html += renderYourTeams(byKey);

  // Today's fixtures by league (only leagues with fixtures today)
  var any = false;
  FOOTBALL_LEAGUES.forEach(function(league){
    var data = byKey[league.key];
    if (data && data.fixtures && data.fixtures.length) {
      html += renderLeagueBlock(league, { fixtures: data.fixtures, upcoming: [] });
      any = true;
    }
  });

  // If nothing is on today, surface the soonest upcoming matches right here
  if (!any) {
    var shownUpcoming = false;
    FOOTBALL_LEAGUES.forEach(function(league){
      var data = byKey[league.key];
      var up = (data && data.upcoming) || [];
      if (up.length) {
        html += renderLeagueBlock(league, { fixtures: [], upcoming: up.slice(0, 3) });
        shownUpcoming = true;
      }
    });
    if (shownUpcoming) {
      html = '<div class="f1a-card"><div class="f1a-h">No matches today</div><div class="f1a-sub">Showing the next scheduled fixtures \u2014 full list in Upcoming.</div></div>' + html;
    } else {
      html += '<div class="f1a-card"><div class="f1a-h">Today</div><div class="f1a-sub">No matches today and no upcoming fixtures loaded yet.</div></div>';
    }
  }
  root.innerHTML = html;
}

function renderYourTeams(byKey) {
  if (typeof FOOTBALL_MY_TEAMS === 'undefined' || !FOOTBALL_MY_TEAMS.length) return '';
  var found = [];
  FOOTBALL_MY_TEAMS.forEach(function(t){
    var data = byKey[t.league];
    if (!data) return;
    var all = (data.fixtures || []).concat(data.upcoming || []);
    var match = all.find(function(f){
      return (f.home && f.home.indexOf(t.name) !== -1) || (f.away && f.away.indexOf(t.name) !== -1);
    });
    if (match) found.push({ cfg: t, fx: match });
  });
  if (!found.length) return '';

  var html = '<div class="f1a-card wc-myteam-card"><div class="f1a-h">\u2B50 Your Teams</div>';
  found.forEach(function(f){
    var m = f.fx;
    var hasScore = m.homeScore !== null && m.awayScore !== null;
    var live = (typeof isLive === 'function') && isLive(m.status);
    html += '<div class="ft-myteam-row">'
      + '<span class="ft-myteam-match">' + m.home + ' v ' + m.away + '</span>'
      + (hasScore
        ? '<span class="ft-myteam-score' + (live?' live':'') + '">' + m.homeScore + '-' + m.awayScore + '</span>'
        : '<span class="ft-myteam-when">' + (typeof formatKickoff==='function'?formatKickoff(m.time):'') + '</span>')
      + '</div>';
  });
  html += '</div>';
  return html;
}

// Render the UPCOMING subtab: each league's next matches.
async function loadFootballUpcoming() {
  var root = document.getElementById('football-upcoming-body');
  if (!root) return;
  root.innerHTML = '<div class="fxt-loading"><div class="f1-spinner"></div><span>Loading upcoming...</span></div>';

  var results = await Promise.all(FOOTBALL_LEAGUES.map(function(l){ return fetchLeague(l.key); }));
  var html = '';
  var any = false;
  FOOTBALL_LEAGUES.forEach(function(league, i){
    var data = results[i];
    var up = (data && data.upcoming) || [];
    // if a league had live fixtures, it may have empty upcoming; show next from fixtures' future too
    if (up.length) {
      html += renderLeagueBlock(league, { fixtures: [], upcoming: up });
      any = true;
    }
  });
  if (!any) html += '<div class="f1a-card"><div class="f1a-h">Upcoming</div><div class="f1a-sub">No upcoming fixtures loaded. Matches may be live today \u2014 check Today.</div></div>';
  root.innerHTML = html;
}
