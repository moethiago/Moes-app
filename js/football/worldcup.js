// ============================================================
// worldcup.js — World Cup 2026 fixtures
// Data source: openfootball/worldcup.json (auto-updates)
// Fallback fixtures live in worldcup-data.js
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
    var upcomingAll    = matches.filter(function(m) { return m.date > today && !m.score; });
    var upcoming       = diversifyByGroup(upcomingAll, 6);
    var html = '';
    if (todayMatches.length)                          html += renderWCSection(todayMatches, 'Today');
    if (!todayMatches.length && recentResults.length) html += renderWCSection(recentResults, 'Recent Results');
    if (upcoming.length)                              html += renderWCSection(upcoming, 'Upcoming');
    if (!html) html = renderWCSection(matches.slice(0, 6), 'Opening Fixtures - Jun 11, 2026');
    container.innerHTML = html;
  } catch(e) {
    container.innerHTML = renderWCSection(WORLDCUP_FALLBACK, 'Opening Fixtures - Jun 11, 2026');
  }
}

function diversifyByGroup(list, limit) {
  // Prefer showing matches from different groups so the list isn't all one group
  var byGroup = {};
  list.forEach(function(m) {
    var g = m.group || m.round || 'x';
    (byGroup[g] = byGroup[g] || []).push(m);
  });
  var groups = Object.keys(byGroup);
  var out = [];
  var i = 0;
  while (out.length < limit && groups.length) {
    var g = groups[i % groups.length];
    if (byGroup[g].length) {
      out.push(byGroup[g].shift());
    } else {
      groups.splice(i % groups.length, 1);
      continue;
    }
    i++;
  }
  // keep chronological order for display
  out.sort(function(a,b){ return (a.date||'').localeCompare(b.date||''); });
  return out;
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
