// ============================================================
// worldcup.js — World Cup 2026 fixtures
// Data source: openfootball/worldcup.json (auto-updates)
// ============================================================

async function loadWorldCup() {
  var container = document.getElementById('worldcup-fixtures');
  if (!container) return;
  container.innerHTML = '<div class="fxt-loading"><div class="f1-spinner"></div><span>Loading World Cup...</span></div>';
  try {
    var res = await fetch('https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json');
    if (!res.ok) throw new Error('failed');
    var data    = await res.json();
    var matches = data.matches || [];
    var today   = new Date().toISOString().split('T')[0];
    var todayMatches   = matches.filter(function(m) { return m.date === today; });
    var recentResults  = matches.filter(function(m) { return m.score && m.date < today; }).slice(-3);
    var upcoming       = matches.filter(function(m) { return m.date > today && !m.score; }).slice(0, 6);
    var html = '';
    if (todayMatches.length)                          html += renderWCSection(todayMatches, 'Today');
    if (!todayMatches.length && recentResults.length) html += renderWCSection(recentResults, 'Recent Results');
    if (upcoming.length)                              html += renderWCSection(upcoming, 'Upcoming');
    if (!html) html = renderWCSection(matches.slice(0, 6), 'Opening Fixtures - Jun 11, 2026');
    container.innerHTML = html;
  } catch(e) {
    container.innerHTML = renderWCSection([
      { team1:'Mexico',      team2:'South Africa',   date:'2026-06-11', group:'Group A' },
      { team1:'South Korea', team2:'Czech Republic', date:'2026-06-11', group:'Group A' },
      { team1:'USA',         team2:'TBD',            date:'2026-06-12', group:'Group B' },
      { team1:'Canada',      team2:'TBD',            date:'2026-06-12', group:'Group C' },
      { team1:'Brazil',      team2:'TBD',            date:'2026-06-13', group:'Group D' },
      { team1:'England',     team2:'TBD',            date:'2026-06-13', group:'Group E' },
    ], 'Opening Fixtures - Jun 11, 2026');
  }
}

function renderWCSection(matches, label) {
  var html = '<div class="wc-section-label">' + label + '</div>';
  matches.forEach(function(m) {
    var ftScore  = m.score && m.score.ft;
    var hasScore = ftScore && ftScore.length === 2;
    html += '<div class="fxt-row">'
      + '<div class="fxt-teams">'
      + '<div class="fxt-team"><span class="fxt-name">' + (m.team1 || '') + '</span></div>'
      + '<div class="fxt-team"><span class="fxt-name">' + (m.team2 || '') + '</span></div>'
      + '</div>'
      + '<div class="fxt-right">'
      + (hasScore
        ? '<div class="fxt-score"><span>' + ftScore[0] + '</span><span class="fxt-score-sep">-</span><span>' + ftScore[1] + '</span></div><span class="fxt-status ft">FT</span>'
        : '<div class="fxt-upcoming-date">' + formatWCDate(m.date) + '</div><div class="wc-group-label">' + (m.group || m.round || '') + '</div>')
      + '</div></div>';
  });
  return html;
}

function formatWCDate(dateStr) {
  if (!dateStr) return '';
  var d      = new Date(dateStr + 'T12:00:00Z');
  var days   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return days[d.getDay()] + ' ' + d.getDate() + ' ' + months[d.getMonth()];
}
