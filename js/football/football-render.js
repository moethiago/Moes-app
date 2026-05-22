// ============================================================
// football-render.js — fixture rendering helpers
// Depends on: football-config.js
// ============================================================

function statusLabel(status, elapsed) {
  if (['LIVE','1H','2H','ET','P'].indexOf(status) !== -1)
    return '<span class="fxt-status live">' + (elapsed ? elapsed + "'" : 'LIVE') + '</span>';
  if (status === 'HT')   return '<span class="fxt-status ht">HT</span>';
  if (status === 'FT')   return '<span class="fxt-status ft">FT</span>';
  if (status === 'NS')   return '<span class="fxt-status ns">NS</span>';
  if (status === 'PST')  return '<span class="fxt-status pst">PST</span>';
  if (status === 'CANC') return '<span class="fxt-status ft">CANC</span>';
  return '<span class="fxt-status ns">' + status + '</span>';
}

function formatKickoff(dateStr) {
  return new Date(dateStr).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit', timeZone:'Asia/Riyadh' });
}

function formatDate(dateStr) {
  var d = new Date(dateStr);
  var days   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return days[d.getDay()] + ' ' + d.getDate() + ' ' + months[d.getMonth()];
}

function isLive(status) {
  return ['LIVE','1H','2H','HT','ET','P'].indexOf(status) !== -1;
}

function renderLeagueBlock(league, data) {
  var fixtures = data.fixtures || [];
  var upcoming = data.upcoming || [];
  var hasLive  = fixtures.some(function(f) { return isLive(f.status); });
  if (!fixtures.length && !upcoming.length) return '';

  var html = '<div class="fxt-league-block">'
    + '<div class="fxt-league-header">'
    + '<span class="fxt-league-flag">' + league.flag + '</span>'
    + '<span class="fxt-league-name">' + league.label + '</span>'
    + (hasLive ? '<span class="fxt-live-badge">LIVE</span>' : '')
    + '</div>';

  if (fixtures.length) {
    fixtures.sort(function(a, b) {
      var aL = isLive(a.status) ? 0 : 1;
      var bL = isLive(b.status) ? 0 : 1;
      if (aL !== bL) return aL - bL;
      return new Date(a.time) - new Date(b.time);
    });
    fixtures.forEach(function(f) {
      var live     = isLive(f.status);
      var hasScore = f.homeScore !== null && f.awayScore !== null;
      html += '<div class="fxt-row' + (live ? ' fxt-live' : '') + '">'
        + '<div class="fxt-teams">'
        + '<div class="fxt-team"><img class="fxt-logo" src="' + f.homeLogo + '" onerror="this.style.display=\'none\'"><span class="fxt-name' + (live && f.homeScore > f.awayScore ? ' fxt-winning' : '') + '">' + f.home + '</span></div>'
        + '<div class="fxt-team"><img class="fxt-logo" src="' + f.awayLogo + '" onerror="this.style.display=\'none\'"><span class="fxt-name' + (live && f.awayScore > f.homeScore ? ' fxt-winning' : '') + '">' + f.away + '</span></div>'
        + '</div>'
        + '<div class="fxt-right">'
        + (hasScore ? '<div class="fxt-score' + (live ? ' fxt-score-live' : '') + '"><span>' + f.homeScore + '</span><span class="fxt-score-sep">-</span><span>' + f.awayScore + '</span></div>' : '<div class="fxt-kickoff">' + formatKickoff(f.time) + '</div>')
        + statusLabel(f.status, f.elapsed)
        + '</div></div>';
    });
  } else if (upcoming.length) {
    html += '<div class="fxt-upcoming-label">Next matches: ' + formatDate(upcoming[0].time) + '</div>';
    upcoming.forEach(function(f) {
      html += '<div class="fxt-row">'
        + '<div class="fxt-teams">'
        + '<div class="fxt-team"><img class="fxt-logo" src="' + f.homeLogo + '" onerror="this.style.display=\'none\'"><span class="fxt-name">' + f.home + '</span></div>'
        + '<div class="fxt-team"><img class="fxt-logo" src="' + f.awayLogo + '" onerror="this.style.display=\'none\'"><span class="fxt-name">' + f.away + '</span></div>'
        + '</div>'
        + '<div class="fxt-right">'
        + '<div class="fxt-upcoming-date">' + formatDate(f.time) + '</div>'
        + '<div class="fxt-kickoff">' + formatKickoff(f.time) + '</div>'
        + '</div></div>';
    });
  }

  html += '</div>';
  return html;
}
