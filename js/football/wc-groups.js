// ============================================================
// wc-groups.js — group standings tables + knockout bracket.
// Spoiler-sensitive: rendered only after reveal.
// Renders into #wc-groups-body and #wc-bracket-body.
// ============================================================

function loadWCGroups() {
  var root = document.getElementById('wc-groups-body');
  if (!root) return;
  root.innerHTML = '<div class="fxt-loading"><div class="f1-spinner"></div><span>Building tables...</span></div>';
  wcLoad().then(function(data){
    if (!data || typeof WC_GROUPS === 'undefined') { root.innerHTML = '<div class="empty-state">Group data unavailable.</div>'; return; }
    var html = '';
    Object.keys(WC_GROUPS).forEach(function(g){
      html += renderGroupTable(g);
    });
    root.innerHTML = html;
  });
}

function renderGroupTable(groupName) {
  var table = wcGroupTable(groupName);
  var mine = (typeof WC_MY_TEAM !== 'undefined') ? WC_MY_TEAM : null;
  var played = table.some(function(r){ return r.P > 0; });
  var html = '<div class="f1a-card wc-grp-card"><div class="f1a-h">' + groupName + '</div>'
    + '<div class="wc-grp-head"><span class="wc-grp-pos">#</span><span class="wc-grp-team">Team</span>'
    + '<span class="wc-grp-n">P</span><span class="wc-grp-n">W</span><span class="wc-grp-n">D</span><span class="wc-grp-n">L</span>'
    + '<span class="wc-grp-n">GD</span><span class="wc-grp-n wc-grp-pts">Pts</span></div>';
  table.forEach(function(r, i){
    var qual = i < 2 ? 'wc-qual' : (i === 2 ? 'wc-maybe' : '');
    var isMine = (r.team === mine) ? ' wc-myrow' : '';
    html += '<div class="wc-grp-row ' + qual + isMine + '">'
      + '<span class="wc-grp-pos">' + (i+1) + '</span>'
      + '<span class="wc-grp-team">' + wcFlag(r.team) + ' ' + r.team + '</span>'
      + '<span class="wc-grp-n">' + r.P + '</span>'
      + '<span class="wc-grp-n">' + r.W + '</span>'
      + '<span class="wc-grp-n">' + r.D + '</span>'
      + '<span class="wc-grp-n">' + r.L + '</span>'
      + '<span class="wc-grp-n">' + (r.GD > 0 ? '+' : '') + r.GD + '</span>'
      + '<span class="wc-grp-n wc-grp-pts">' + r.Pts + '</span>'
      + '</div>';
  });
  if (!played) html += '<div class="f1a-sub" style="text-align:center;padding-top:6px">Not started yet</div>';
  html += '</div>';
  return html;
}

// ---- KNOCKOUT BRACKET ----
function loadWCBracket() {
  var root = document.getElementById('wc-bracket-body');
  if (!root) return;
  root.innerHTML = '<div class="fxt-loading"><div class="f1-spinner"></div><span>Loading bracket...</span></div>';
  wcLoad().then(function(data){
    if (!data) { root.innerHTML = '<div class="empty-state">Bracket unavailable.</div>'; return; }
    var ko = wcKnockout();
    var order = ['Round of 32','Round of 16','Quarter-finals','Quarter-final','Semi-finals','Semi-final','Match for third place','Final'];
    var keys = Object.keys(ko).sort(function(a,b){
      function idx(x){ for(var i=0;i<order.length;i++){ if(x.indexOf(order[i])!==-1) return i; } return 99; }
      return idx(a) - idx(b);
    });
    if (!keys.length) { root.innerHTML = '<div class="f1a-card"><div class="f1a-h">\u{1F3C6} Knockout Bracket</div><div class="f1a-sub">Bracket fills in after the group stage (starts late June).</div></div>'; return; }
    var html = '';
    keys.forEach(function(round){
      html += '<div class="f1a-card"><div class="f1a-h">' + round + '</div>';
      ko[round].forEach(function(m){
        var played = wcHasScore(m);
        var t1 = m.team1 || m.home_team_label || 'TBD';
        var t2 = m.team2 || m.away_team_label || 'TBD';
        html += '<div class="wc-ko-row">'
          + '<span class="wc-ko-team">' + wcFlag(t1) + ' ' + t1 + '</span>'
          + (played
            ? '<span class="wc-ko-score">' + m.score.ft[0] + '-' + m.score.ft[1] + '</span>'
            : '<span class="wc-ko-v">v</span>')
          + '<span class="wc-ko-team wc-ko-right">' + t2 + ' ' + wcFlag(t2) + '</span>'
          + '</div>';
      });
      html += '</div>';
    });
    root.innerHTML = html;
  });
}
