// ============================================================
// wc-results.js — recent results + top scorers (spoiler-locked).
// Live/today matches come from the backend (API-Football, real-time).
// Historical results come from openfootball (updates daily).
// Renders into #wc-results-body.
// ============================================================

var wcLiveTimer = null;

function fetchWCToday() {
  return new Promise(function(resolve) {
    var done = false;
    var t = setTimeout(function(){ if(!done){done=true;resolve([]);} }, 8000);
    fetch(BACKEND_URL + '?type=live').then(function(r){ return r.ok ? r.json() : null; }).then(function(data){
      if (done) return; done = true; clearTimeout(t);
      var all = (data && data.today) || [];
      resolve(all.filter(function(m){ return m.leagueKey === 'worldcup'; }));
    }).catch(function(){ if(!done){done=true;clearTimeout(t);resolve([]);} });
  });
}

function renderWCLiveSection(matches) {
  var el = document.getElementById('wc-live-today');
  if (!el) return;
  if (!matches.length) { el.innerHTML = ''; return; }

  var liveStatuses = ['1H','2H','HT','ET','BT','P','LIVE'];
  var html = '<div class="f1a-card wc-results-card"><div class="f1a-h">\u26BD Today \u00b7 Live & Results</div>';
  matches.forEach(function(m) {
    var isLive = liveStatuses.indexOf(m.status) !== -1;
    var isDone = ['FT','AET','PEN'].indexOf(m.status) !== -1;
    var score, status;
    if (isLive) {
      score = m.homeScore + '-' + m.awayScore;
      status = '<span style="color:#ff4545;font-weight:700">' + (m.elapsed ? m.elapsed + "'" : 'LIVE') + '</span>';
    } else if (isDone) {
      score = m.homeScore + '-' + m.awayScore;
      status = 'FT';
    } else {
      score = 'vs';
      var d = new Date(m.time);
      status = d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    }
    html += '<div class="wc-res-row">'
      + '<span class="wc-res-team">' + wcFlag(m.home) + ' ' + m.home + '</span>'
      + '<span class="wc-res-score">' + score + '</span>'
      + '<span class="wc-res-team wc-res-right">' + m.away + ' ' + wcFlag(m.away) + '</span>'
      + '</div>'
      + '<div style="text-align:center;font-size:11px;color:#888;padding-bottom:8px">' + status + '</div>';
  });
  html += '</div>';
  el.innerHTML = html;
}

function startWCLivePolling() {
  if (wcLiveTimer) clearInterval(wcLiveTimer);
  function tick() { fetchWCToday().then(renderWCLiveSection); }
  tick();
  wcLiveTimer = setInterval(tick, 120000); // 2 min — shares server cache with football tab
}

function loadWCResults() {
  var root = document.getElementById('wc-results-body');
  if (!root) return;
  root.innerHTML = '<div id="wc-live-today"></div>'
    + '<div id="wc-history"><div class="fxt-loading"><div class="f1-spinner"></div><span>Loading results...</span></div></div>';

  startWCLivePolling();

  wcLoad().then(function(data){
    var hist = document.getElementById('wc-history');
    if (!hist) return;
    if (!data) { hist.innerHTML = ''; return; }
    var played = wcMatches().filter(wcHasScore).sort(function(a,b){
      var da = wcMatchDate(a), db = wcMatchDate(b);
      return (db ? db.getTime() : 0) - (da ? da.getTime() : 0);
    });
    if (!played.length) {
      hist.innerHTML = '';
      return;
    }
    var html = '<div class="f1a-card wc-results-card"><div class="f1a-h">\u{1F3C1} Recent Results</div>';
    played.slice(0, 12).forEach(function(m){
      var a = m.team1, b = m.team2;
      var ga = parseInt(m.score.ft[0]), gb = parseInt(m.score.ft[1]);
      var aWin = ga > gb, bWin = gb > ga;
      html += '<div class="wc-res-row">'
        + '<span class="wc-res-team ' + (aWin?'win':'') + '">' + wcFlag(a) + ' ' + a + '</span>'
        + '<span class="wc-res-score">' + ga + '-' + gb + '</span>'
        + '<span class="wc-res-team wc-res-right ' + (bWin?'win':'') + '">' + b + ' ' + wcFlag(b) + '</span>'
        + '</div>';
    });
    html += '</div>';
    hist.innerHTML = html;
  });
}
