// ============================================================
// f1-recap.js — "Did I miss anything?" last-race recap
// Podium + fastest lap + key incidents/penalties (race_control).
// Jolpica for results (free), OpenF1 race_control for incidents.
// Renders into #f1-recap.
// ============================================================

var JOL_RECAP = 'https://api.jolpi.ca/ergast/f1';
var OPENF1 = 'https://api.openf1.org/v1';

function recapFetch(url, ms) {
  return new Promise(function(resolve) {
    var done = false;
    var t = setTimeout(function(){ if(!done){done=true;resolve(null);} }, ms || 7000);
    fetch(url).then(function(r){
      if(done) return; done=true; clearTimeout(t);
      if(!r.ok){resolve(null);return;}
      r.json().then(resolve).catch(function(){resolve(null);});
    }).catch(function(){ if(!done){done=true;clearTimeout(t);resolve(null);} });
  });
}

async function loadF1Recap() {
  var root = document.getElementById('f1-recap');
  if (!root) return;
  root.innerHTML = '<div class="f1-api-loading"><div class="f1-spinner"></div><span>Loading race recap...</span></div>';

  var rd = await recapFetch(JOL_RECAP + '/current/last/results.json?limit=30', 7000);
  var race = rd && rd.MRData && rd.MRData.RaceTable && rd.MRData.RaceTable.Races[0];
  if (!race || !race.Results) { root.innerHTML = ''; return; }

  var results = race.Results;
  var podium = results.slice(0, 3);
  var medals = ['\u{1F947}','\u{1F948}','\u{1F949}'];

  // fastest lap
  var fl = null;
  results.forEach(function(r){
    if (r.FastestLap && r.FastestLap.rank === '1') fl = r;
  });

  // DNFs
  var dnfs = results.filter(function(r){
    var s = (r.status || '').toLowerCase();
    return s !== 'finished' && s.indexOf('lap') === -1;
  });

  var html = '<div class="f1a-card f1-recap-card">'
    + '<div class="f1a-h">\u{1F3C1} Race Recap \u00b7 ' + race.raceName.replace(' Grand Prix','') + ' GP</div>'
    + '<div class="f1a-sub">Round ' + race.round + ' \u00b7 ' + new Date(race.date).toLocaleDateString([], {month:'short',day:'numeric'}) + '</div>';

  // podium
  html += '<div class="f1-recap-podium">';
  podium.forEach(function(r, i) {
    var cid = r.Constructor.constructorId;
    var col = (typeof TEAM_COLORS !== 'undefined' && TEAM_COLORS[cid]) || '#8a8fa8';
    html += '<div class="f1-recap-pod-item">'
      + '<span class="f1-recap-medal">' + medals[i] + '</span>'
      + '<div class="f1-recap-pod-info"><span class="f1-recap-pod-name" style="color:' + col + '">' + r.Driver.familyName + '</span>'
      + '<span class="f1-recap-pod-team">' + r.Constructor.name + '</span></div>'
      + '<span class="f1-recap-pod-time">' + (i === 0 ? (r.Time ? r.Time.time : 'WIN') : (r.Time ? '+' + r.Time.time : r.status)) + '</span>'
      + '</div>';
  });
  html += '</div>';

  // fastest lap
  if (fl) {
    html += '<div class="f1-recap-fl">\u26A1 Fastest lap: <strong>' + fl.Driver.familyName + '</strong> '
      + (fl.FastestLap && fl.FastestLap.Time ? fl.FastestLap.Time.time : '') + '</div>';
  }

  // DNFs
  if (dnfs.length) {
    html += '<div class="f1-recap-dnf">\u{1F6A9} DNF: ' + dnfs.map(function(d){ return d.Driver.familyName + ' (' + d.status + ')'; }).join(', ') + '</div>';
  }

  html += '<div id="f1-recap-incidents"></div></div>';
  root.innerHTML = html;

  // incidents/penalties from OpenF1 race_control (best-effort)
  loadRaceIncidents(race.raceName);
}

async function loadRaceIncidents(raceName) {
  var el = document.getElementById('f1-recap-incidents');
  if (!el) return;
  try {
    // find latest race session this year
    var sessions = await recapFetch(OPENF1 + '/sessions?year=2026&session_name=Race', 6000);
    if (!sessions || !sessions.length) return;
    var latest = sessions[sessions.length - 1];
    var rc = await recapFetch(OPENF1 + '/race_control?session_key=' + latest.session_key, 7000);
    if (!rc || !rc.length) return;
    // keep meaningful messages: penalties, safety car, flags with cause
    var key = rc.filter(function(m){
      var s = (m.message || '').toUpperCase();
      return s.indexOf('PENALTY') !== -1 || s.indexOf('SAFETY CAR') !== -1 || s.indexOf('INVESTIGAT') !== -1 || s.indexOf('DELETED') !== -1;
    }).slice(0, 6);
    if (!key.length) return;
    var html = '<div class="f1a-h" style="margin-top:10px">\u26A0\uFE0F Key Incidents</div>';
    key.forEach(function(m){
      html += '<div class="f1-recap-incident">' + (m.message || '') + '</div>';
    });
    el.innerHTML = html;
  } catch(e) {}
}
