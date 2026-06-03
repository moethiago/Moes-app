// ============================================================
// wc-upnext.js — spoiler-free WC subtab: next match countdown,
// your-team tracker, upcoming matches in your local time + calendar.
// Renders into #wc-upnext-body.
// ============================================================

function loadWCUpNext() {
  var root = document.getElementById('wc-upnext-body');
  if (!root) return;
  root.innerHTML = '<div class="fxt-loading"><div class="f1-spinner"></div><span>Loading World Cup...</span></div>';

  wcLoad().then(function(data) {
    if (!data) {
      // fallback to static opening fixtures
      root.innerHTML = renderWCUpcomingCard((typeof WORLDCUP_FALLBACK !== 'undefined' ? WORLDCUP_FALLBACK : []), 'Opening Fixtures');
      return;
    }
    var html = '';
    html += renderWCNextMatch();
    html += renderWCMyTeam();
    html += renderWCUpcoming();
    root.innerHTML = html || '<div class="empty-state">No upcoming matches.</div>';
    // wire calendar buttons handled via onclick inline
  });
}

// Big countdown card for the very next match overall
function renderWCNextMatch() {
  var now = Date.now();
  var upcoming = wcMatches().filter(function(m){
    var d = wcMatchDate(m); return d && d.getTime() > now && !wcHasScore(m);
  }).sort(function(a,b){ return wcMatchDate(a) - wcMatchDate(b); });
  if (!upcoming.length) return '';
  var m = upcoming[0];
  var d = wcMatchDate(m);
  var t1 = m.team1, t2 = m.team2;
  return '<div class="f1a-card wc-next-card"><div class="f1a-h">\u23F1\uFE0F Next Match</div>'
    + '<div class="wc-next-teams">'
    + '<span class="wc-next-team">' + wcFlag(t1) + ' ' + t1 + '</span>'
    + '<span class="wc-next-vs">v</span>'
    + '<span class="wc-next-team">' + t2 + ' ' + wcFlag(t2) + '</span>'
    + '</div>'
    + '<div class="wc-next-meta">' + (m.group || m.round || '') + (m.ground ? ' \u00b7 ' + m.ground : '') + '</div>'
    + '<div class="wc-next-when" id="wc-next-when"></div>'
    + '</div>';
}

// Your team (Saudi Arabia) tracker — next fixture + group position teaser (no scores shown here)
function renderWCMyTeam() {
  var mine = (typeof WC_MY_TEAM !== 'undefined') ? WC_MY_TEAM : null;
  if (!mine) return '';
  var matches = wcMyTeamMatches();
  if (!matches.length) return '';
  var now = Date.now();
  var next = matches.filter(function(m){ var d = wcMatchDate(m); return d && d.getTime() > now; })[0];
  var html = '<div class="f1a-card wc-myteam-card"><div class="f1a-h">' + wcFlag(mine) + ' ' + mine + ' \u00b7 Your Team</div>';
  if (next) {
    var opp = next.team1 === mine ? next.team2 : next.team1;
    var d = wcMatchDate(next);
    var when = d ? d.toLocaleString([], { weekday:'short', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }) : '';
    html += '<div class="wc-myteam-next">Next: <strong>vs ' + opp + ' ' + wcFlag(opp) + '</strong></div>'
      + '<div class="wc-myteam-when">' + when + ' \u00b7 ' + (next.ground || '') + '</div>'
      + '<button class="f1-time-cal" onclick="wcAddToCal(\'' + encodeURIComponent(mine + ' vs ' + opp) + '\',\'' + d.toISOString() + '\')">+ Calendar</button>';
  } else {
    html += '<div class="wc-myteam-next">Group stage complete \u2014 check Results.</div>';
  }
  html += '</div>';
  return html;
}

// Upcoming matches list (next 8) in local time, each with +cal
function renderWCUpcoming() {
  var now = Date.now();
  var up = wcMatches().filter(function(m){
    var d = wcMatchDate(m); return d && d.getTime() > now && !wcHasScore(m);
  }).sort(function(a,b){ return wcMatchDate(a) - wcMatchDate(b); }).slice(0, 8);
  if (!up.length) return '';
  var tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'local';
  var html = '<div class="f1a-card"><div class="f1a-h">\u{1F4C5} Upcoming \u00b7 Your Time</div>'
    + '<div class="f1a-sub">' + tz + '</div>';
  up.forEach(function(m){
    var d = wcMatchDate(m);
    var when = d ? d.toLocaleString([], { weekday:'short', hour:'2-digit', minute:'2-digit' }) : '';
    html += '<div class="wc-up-row">'
      + '<div class="wc-up-teams">' + wcFlag(m.team1) + ' ' + (m.team1||'') + ' <span class="wc-up-v">v</span> ' + (m.team2||'') + ' ' + wcFlag(m.team2) + '</div>'
      + '<div class="wc-up-right"><span class="wc-up-when">' + when + '</span>'
      + '<button class="wc-up-cal" onclick="wcAddToCal(\'' + encodeURIComponent((m.team1||'')+' vs '+(m.team2||'')) + '\',\'' + (d?d.toISOString():'') + '\')">+</button></div>'
      + '</div>';
  });
  html += '</div>';
  return html;
}

function renderWCUpcomingCard(list, label) {
  var html = '<div class="f1a-card"><div class="f1a-h">\u{1F3C6} ' + label + '</div>';
  list.forEach(function(m){
    html += '<div class="wc-up-row"><div class="wc-up-teams">' + wcFlag(m.team1) + ' ' + (m.team1||'') + ' v ' + (m.team2||'') + ' ' + wcFlag(m.team2) + '</div>'
      + '<div class="wc-up-right"><span class="wc-up-when">' + (m.date||'') + '</span></div></div>';
  });
  html += '</div>';
  return html;
}

// .ics download (reuses the F1 approach)
function wcAddToCal(titleEnc, iso) {
  if (!iso) return;
  var title = decodeURIComponent(titleEnc);
  var start = new Date(iso);
  var end = new Date(start.getTime() + 120*60000);
  function fmt(d){return d.getUTCFullYear()+String(d.getUTCMonth()+1).padStart(2,'0')+String(d.getUTCDate()).padStart(2,'0')+'T'+String(d.getUTCHours()).padStart(2,'0')+String(d.getUTCMinutes()).padStart(2,'0')+'00Z';}
  var ics = 'BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//MoesApp//WC//EN\nBEGIN:VEVENT\nUID:'+Date.now()+'@moesapp\nDTSTAMP:'+fmt(new Date())+'\nDTSTART:'+fmt(start)+'\nDTEND:'+fmt(end)+'\nSUMMARY:'+title+'\nBEGIN:VALARM\nTRIGGER:-PT30M\nACTION:DISPLAY\nDESCRIPTION:'+title+'\nEND:VALARM\nEND:VEVENT\nEND:VCALENDAR';
  var blob = new Blob([ics], {type:'text/calendar'});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = title.replace(/[^a-z0-9]/gi,'_')+'.ics';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
}
