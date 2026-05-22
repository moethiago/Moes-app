// ============================================================
// f1-weekend.js — race weekend schedule card + last race podium
// Depends on: f1-data.js
// ============================================================

function renderWeekendCard(weekend, el) {
  var now  = Date.now();
  var html = '<div class="f1-weekend-card">'
    + '<div class="f1-weekend-title">' + weekend.flag + ' ' + weekend.race + ' Weekend</div>'
    + '<div class="f1-weekend-sessions">';
  weekend.sessions.forEach(function(s) {
    var start    = Date.parse(s.time);
    var duration = (SESSION_DURATION[s.name] || 90) * 60 * 1000;
    var isLive   = now >= start && now <= start + duration;
    var isPast   = now > start + duration;
    var timeStr  = new Date(start).toLocaleString([], {
      weekday:'short', month:'short', day:'numeric',
      hour:'2-digit', minute:'2-digit', timeZone:'Asia/Riyadh'
    }) + ' AST';
    var cls = isLive ? 'wk-sess live' : (isPast ? 'wk-sess past' : 'wk-sess');
    html += '<div class="' + cls + '">'
      + '<span class="wk-sess-name">' + (isLive ? '🔴 ' : '') + s.name + '</span>'
      + '<span class="wk-sess-time">' + timeStr + '</span>'
      + '</div>';
  });
  html += '</div></div>';
  el.innerHTML = html;
}

function renderChampionshipContext(drivers, round) {
  var el = document.getElementById('f1-championship-context');
  if (!el || !drivers || drivers.length < 2) return;
  var p1   = drivers[0];
  var p2   = drivers[1];
  var n1   = p1.name || (p1.Driver && p1.Driver.familyName);
  var n2   = p2.name || (p2.Driver && p2.Driver.familyName);
  var pts1 = parseFloat(p1.pts || p1.points);
  var pts2 = parseFloat(p2.pts || p2.points);
  var gap  = (pts1 - pts2).toFixed(0);
  el.textContent = n1 + ' leads ' + n2 + ' by ' + gap + ' pts';
}

async function loadLastRaceResult() {
  var el = document.getElementById('f1-last-race');
  if (!el) return;
  try {
    var res = await fetch('https://api.jolpi.ca/ergast/f1/current/last/results.json?limit=3');
    if (!res.ok) return;
    var data  = await res.json();
    var race  = data.MRData && data.MRData.RaceTable && data.MRData.RaceTable.Races[0];
    if (!race || !race.Results) return;
    var podium = race.Results.slice(0, 3);
    var medals = ['🥇','🥈','🥉'];
    var html = '<div class="f1-last-race-card">'
      + '<div class="f1-last-race-title">Last Race · ' + race.raceName + '</div>'
      + '<div class="f1-podium">';
    podium.forEach(function(r, i) {
      var name = r.Driver.familyName;
      var cid  = r.Constructor.constructorId;
      var col  = TEAM_COLORS[cid] || '#8a8fa8';
      html += '<div class="f1-podium-item">'
        + '<span class="f1-podium-medal">' + medals[i] + '</span>'
        + '<span class="f1-podium-name" style="color:' + col + '">' + name + '</span>'
        + '<span class="f1-podium-team">' + r.Constructor.name + '</span>'
        + '</div>';
    });
    html += '</div></div>';
    el.innerHTML = html;
  } catch(e) {}
}
