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

// ---- KNOCKOUT BRACKET (auto-filled from live group standings) ----
function loadWCBracket() {
  var root = document.getElementById('wc-bracket-body');
  if (!root) return;
  root.innerHTML = '<div class="fxt-loading"><div class="f1-spinner"></div><span>Building bracket...</span></div>';
  wcLoad().then(function(data){
    if (!data) { root.innerHTML = '<div class="empty-state">Bracket unavailable.</div>'; return; }

    var html = '';

    // 1) If the feed already has actual knockout matches (teams set / played), show them first.
    var ko = wcKnockout();
    var koKeys = Object.keys(ko);
    var hasRealKO = koKeys.some(function(r){
      return ko[r].some(function(m){ return m.team1 && m.team2 || wcHasScore(m); });
    });

    // 2) Auto-filled Round of 32 from live group tables
    var qual = (typeof wcQualifiers === 'function') ? wcQualifiers() : null;
    var anyGroupData = qual && Object.keys(qual.winners).some(function(k){ return qual.winners[k].team; });

    if (qual && anyGroupData && typeof wcR32Template === 'function') {
      var tmpl = wcR32Template();
      var allDone = (typeof wcAllGroupsComplete === 'function') && wcAllGroupsComplete();
      html += '<div class="f1a-card"><div class="f1a-h">\u{1F3C6} Round of 32 '
        + (allDone ? '' : '<span class="wc-live-tag">updating live</span>') + '</div>'
        + '<div class="f1a-sub">Winners &amp; runners-up fill automatically from the group tables. Third-place slots resolve once all groups finish.</div>';
      tmpl.forEach(function(slot){
        var h = wcResolveSlot(slot.home, qual);
        var a = wcResolveSlot(slot.away, qual);
        html += '<div class="wc-ko-row">'
          + '<span class="wc-ko-team' + (h.decided?' wc-ko-set':'') + '">' + (h.decided?wcFlag(h.name)+' ':'') + h.name + '</span>'
          + '<span class="wc-ko-v">v</span>'
          + '<span class="wc-ko-team wc-ko-right' + (a.decided?' wc-ko-set':'') + '">' + a.name + (a.decided?' '+wcFlag(a.name):'') + '</span>'
          + '</div>';
      });
      html += '</div>';

      // best third-place teams board
      if (qual.bestThirds && qual.bestThirds.length) {
        html += '<div class="f1a-card"><div class="f1a-h">\u{1F947} Best Third-Place Teams</div>'
          + '<div class="f1a-sub">Top 8 of 12 third-placed teams advance (Pts, then GD, then GF).</div>';
        qual.thirds.forEach(function(t, i){
          var inOut = i < 8 ? 'wc-third-in' : 'wc-third-out';
          html += '<div class="wc-third-row ' + inOut + '">'
            + '<span class="wc-third-rank">' + (i+1) + '</span>'
            + '<span class="wc-third-team">' + wcFlag(t.row.team) + ' ' + t.row.team + ' <span class="wc-third-grp">(' + t.group + ')</span></span>'
            + '<span class="wc-third-pts">' + t.row.Pts + 'p ' + (t.row.GD>0?'+':'') + t.row.GD + '</span>'
            + (i < 8 ? '<span class="wc-third-badge">IN</span>' : '<span class="wc-third-badge out">OUT</span>')
            + '</div>';
        });
        html += '</div>';
      }
    }

    // 3) Real knockout matches from the feed (once they exist), with scores
    if (hasRealKO) {
      var order = ['Round of 32','Round of 16','Quarter-finals','Quarter-final','Semi-finals','Semi-final','Match for third place','Final'];
      koKeys.sort(function(a,b){
        function idx(x){ for(var i=0;i<order.length;i++){ if(x.indexOf(order[i])!==-1) return i; } return 99; }
        return idx(a) - idx(b);
      });
      koKeys.forEach(function(round){
        html += '<div class="f1a-card"><div class="f1a-h">' + round + '</div>';
        ko[round].forEach(function(m){
          var played = wcHasScore(m);
          var t1 = m.team1 || 'TBD', t2 = m.team2 || 'TBD';
          html += '<div class="wc-ko-row">'
            + '<span class="wc-ko-team">' + wcFlag(t1) + ' ' + t1 + '</span>'
            + (played ? '<span class="wc-ko-score">' + m.score.ft[0] + '-' + m.score.ft[1] + '</span>' : '<span class="wc-ko-v">v</span>')
            + '<span class="wc-ko-team wc-ko-right">' + t2 + ' ' + wcFlag(t2) + '</span>'
            + '</div>';
        });
        html += '</div>';
      });
    }

    if (!html) html = '<div class="f1a-card"><div class="f1a-h">\u{1F3C6} Knockout Bracket</div><div class="f1a-sub">The bracket auto-fills from the group tables as results come in (group stage starts June 11).</div></div>';
    root.innerHTML = html;
  });
}
