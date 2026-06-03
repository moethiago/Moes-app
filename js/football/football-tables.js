// ============================================================
// football-tables.js — league standings tables + top scorers.
// Adds a league picker; fetches from backend ?type=standings
// and ?type=topscorers. Renders into #football-tables-body.
// ============================================================

var _ftActiveLeague = 'epl';
var _ftCache = {}; // league -> {standings, scorers}

function loadFootballTables() {
  var root = document.getElementById('football-tables-body');
  if (!root) return;
  // build league picker once
  var picker = document.getElementById('ft-league-picker');
  if (picker && !picker.dataset.built) {
    picker.innerHTML = FOOTBALL_LEAGUES.filter(function(l){
      return ['epl','laliga','seriea','bundesliga','ligue1','spl'].indexOf(l.key) !== -1;
    }).map(function(l){
      return '<button class="ft-league-btn' + (l.key===_ftActiveLeague?' active':'') + '" data-key="' + l.key + '" onclick="switchFootballLeague(\'' + l.key + '\')">' + l.label + '</button>';
    }).join('');
    picker.dataset.built = '1';
  }
  renderFootballTable(_ftActiveLeague);
}

function switchFootballLeague(key) {
  _ftActiveLeague = key;
  var picker = document.getElementById('ft-league-picker');
  if (picker) Array.prototype.forEach.call(picker.children, function(b){
    b.classList.toggle('active', b.dataset.key === key);
  });
  renderFootballTable(key);
}

async function renderFootballTable(key) {
  var root = document.getElementById('football-tables-body');
  if (!root) return;
  root.innerHTML = '<div class="fxt-loading"><div class="f1-spinner"></div><span>Loading table...</span></div>';

  var cache = _ftCache[key];
  if (!cache) {
    cache = {};
    try {
      var sres = await fetch(BACKEND_URL + '?league=' + key + '&type=standings');
      if (sres.ok) { var sd = await sres.json(); cache.standings = sd.standings || []; }
    } catch(e) { cache.standings = []; }
    try {
      var pres = await fetch(BACKEND_URL + '?league=' + key + '&type=topscorers');
      if (pres.ok) { var pd = await pres.json(); cache.scorers = pd.scorers || []; }
    } catch(e) { cache.scorers = []; }
    _ftCache[key] = cache;
  }

  var html = '';
  // Standings table
  if (cache.standings && cache.standings.length) {
    var myNames = (typeof FOOTBALL_MY_TEAMS !== 'undefined') ? FOOTBALL_MY_TEAMS.map(function(t){return t.name;}) : [];
    html += '<div class="f1a-card wc-grp-card"><div class="f1a-h">Table</div>'
      + '<div class="ft-tbl-head"><span class="wc-grp-pos">#</span><span class="wc-grp-team">Team</span>'
      + '<span class="wc-grp-n">P</span><span class="wc-grp-n">W</span><span class="wc-grp-n">D</span><span class="wc-grp-n">L</span>'
      + '<span class="wc-grp-n">GD</span><span class="wc-grp-n wc-grp-pts">Pts</span></div>';
    cache.standings.forEach(function(r){
      var mine = myNames.some(function(n){ return r.team.indexOf(n) !== -1; });
      var zone = r.rank <= 4 ? 'wc-qual' : '';
      html += '<div class="wc-grp-row ' + zone + (mine?' wc-myrow':'') + '">'
        + '<span class="wc-grp-pos">' + r.rank + '</span>'
        + '<span class="wc-grp-team"><img class="ft-tbl-logo" src="' + r.logo + '" onerror="this.style.display=\'none\'"> ' + r.team + '</span>'
        + '<span class="wc-grp-n">' + r.played + '</span>'
        + '<span class="wc-grp-n">' + r.win + '</span>'
        + '<span class="wc-grp-n">' + r.draw + '</span>'
        + '<span class="wc-grp-n">' + r.lose + '</span>'
        + '<span class="wc-grp-n">' + (r.gd>0?'+':'') + r.gd + '</span>'
        + '<span class="wc-grp-n wc-grp-pts">' + r.points + '</span>'
        + '</div>';
    });
    html += '</div>';
  } else {
    html += '<div class="f1a-card"><div class="f1a-h">Table</div><div class="f1a-sub">No standings available for this league yet.</div></div>';
  }

  // Top scorers
  if (cache.scorers && cache.scorers.length) {
    html += '<div class="f1a-card"><div class="f1a-h">\u26BD Top Scorers</div>';
    cache.scorers.forEach(function(p, i){
      html += '<div class="ft-scorer-row">'
        + '<span class="ft-scorer-rank">' + (i+1) + '</span>'
        + '<span class="ft-scorer-name">' + p.name + '<span class="ft-scorer-team"> \u00b7 ' + p.team + '</span></span>'
        + '<span class="ft-scorer-goals">' + p.goals + '</span>'
        + '</div>';
    });
    html += '</div>';
  }

  root.innerHTML = html;
}
