// ============================================================
// wc-results.js — recent results + top scorers (spoiler-locked).
// Renders into #wc-results-body.
// ============================================================

function loadWCResults() {
  var root = document.getElementById('wc-results-body');
  if (!root) return;
  root.innerHTML = '<div class="fxt-loading"><div class="f1-spinner"></div><span>Loading results...</span></div>';
  wcLoad().then(function(data){
    if (!data) { root.innerHTML = '<div class="empty-state">No results yet.</div>'; return; }
    var played = wcMatches().filter(wcHasScore).sort(function(a,b){
      var da = wcMatchDate(a), db = wcMatchDate(b);
      return (db ? db.getTime() : 0) - (da ? da.getTime() : 0);
    });
    if (!played.length) {
      root.innerHTML = '<div class="f1a-card"><div class="f1a-h">\u{1F3C1} Results</div><div class="f1a-sub">No matches played yet \u2014 the tournament starts June 11.</div></div>';
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
    root.innerHTML = html;
  });
}
