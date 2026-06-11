// ============================================================
// f1-recap.js — last-race recap using OpenF1 (real-time)
// Falls back to Jolpica if OpenF1 unavailable.
// Renders into #f1-recap.
// ============================================================

var OPENF1_RECAP = 'https://api.openf1.org/v1';
var JOL_RECAP    = 'https://api.jolpi.ca/ergast/f1';

function recapFetch(url, ms) {
  return new Promise(function(resolve) {
    var done = false;
    var t = setTimeout(function(){ if(!done){done=true;resolve(null);} }, ms || 8000);
    fetch(url).then(function(r){
      if(done) return; done=true; clearTimeout(t);
      if(!r.ok){resolve(null);return;}
      r.json().then(resolve).catch(function(){resolve(null);});
    }).catch(function(){ if(!done){done=true;clearTimeout(t);resolve(null);} });
  });
}

// Find most recent completed Race session from OpenF1
async function getLastRaceSessionKey() {
  var sessions = await recapFetch(OPENF1_RECAP + '/sessions?year=2026&session_name=Race', 8000);
  if (!sessions || !sessions.length) return null;
  var now = Date.now();
  // Find most recent race that has ended (started more than 2h ago)
  var completed = sessions.filter(function(s) {
    return s.date_start && (now - new Date(s.date_start).getTime()) > 2 * 3600 * 1000;
  });
  if (!completed.length) return null;
  completed.sort(function(a, b) { return new Date(b.date_start) - new Date(a.date_start); });
  return completed[0];
}

async function loadF1Recap() {
  var root = document.getElementById('f1-recap');
  if (!root) return;
  root.innerHTML = '<div class="f1-api-loading"><div class="f1-spinner"></div><span>Loading race recap...</span></div>';

  // Try OpenF1 first (real-time, no delay after race)
  var rendered = await tryOpenF1Recap(root);
  if (!rendered) {
    // Fall back to Jolpica
    await tryJolpicaRecap(root);
  }
}

async function tryOpenF1Recap(root) {
  try {
    var lastSess = await getLastRaceSessionKey();
    if (!lastSess) return false;

    var sessKey = lastSess.session_key;
    var raceName = lastSess.meeting_name || 'Last Race';
    var raceDate = lastSess.date_start ? new Date(lastSess.date_start) : null;

    // Fetch final positions, drivers, intervals, laps in parallel
    var [positions, drivers, intervals, laps, raceControl] = await Promise.all([
      recapFetch(OPENF1_RECAP + '/position?session_key=' + sessKey, 12000),
      recapFetch(OPENF1_RECAP + '/drivers?session_key=' + sessKey, 8000),
      recapFetch(OPENF1_RECAP + '/intervals?session_key=' + sessKey, 12000),
      recapFetch(OPENF1_RECAP + '/laps?session_key=' + sessKey, 12000),
      recapFetch(OPENF1_RECAP + '/race_control?session_key=' + sessKey, 8000),
    ]);

    if (!positions || !positions.length || !drivers) return false;

    // Build driver map
    var driverMap = {};
    drivers.forEach(function(d) { driverMap[d.driver_number] = d; });

    // Get final position for each driver
    var finalPos = {};
    positions.forEach(function(p) {
      var k = p.driver_number;
      if (!finalPos[k] || p.date > finalPos[k].date) finalPos[k] = p;
    });

    // Get final intervals
    var finalInt = {};
    if (intervals) intervals.forEach(function(i) {
      var k = i.driver_number;
      if (!finalInt[k] || i.date > finalInt[k].date) finalInt[k] = i;
    });

    // Get fastest lap per driver
    var fastestLap = {};
    if (laps) laps.forEach(function(l) {
      var k = l.driver_number;
      if (!l.lap_duration || l.lap_duration <= 0) return;
      if (!fastestLap[k] || l.lap_duration < fastestLap[k]) fastestLap[k] = l.lap_duration;
    });
    var overallFastest = Object.values(fastestLap).length
      ? Math.min.apply(null, Object.values(fastestLap)) : 0;

    // Sort by final position
    var sorted = Object.values(finalPos).sort(function(a, b) { return a.position - b.position; });
    if (sorted.length < 3) return false;

    var podium = sorted.slice(0, 3);
    var medals = ['\u{1F947}', '\u{1F948}', '\u{1F949}'];

    // Find fastest lap driver
    var flDriver = null;
    if (overallFastest > 0) {
      Object.keys(fastestLap).forEach(function(num) {
        if (fastestLap[num] === overallFastest) flDriver = driverMap[num];
      });
    }

    // Find DNFs from race control
    var dnfList = [];
    if (raceControl) {
      raceControl.forEach(function(msg) {
        var m = (msg.message || '').toUpperCase();
        if (m.indexOf('RETIRED') !== -1 || m.indexOf('MECHANICAL') !== -1) {
          var num = msg.driver_number;
          if (num && driverMap[num] && dnfList.indexOf(driverMap[num].last_name) === -1) {
            dnfList.push(driverMap[num].last_name);
          }
        }
      });
    }

    // Find round number from calendar
    var roundNum = '?';
    var dateStr = '';
    if (typeof F1_CALENDAR !== 'undefined' && raceDate) {
      F1_CALENDAR.forEach(function(r) {
        var raceSess = r.sessions && r.sessions.find(function(s) { return s.name === 'Race'; });
        if (!raceSess) return;
        var diff = Math.abs(new Date(raceSess.time).getTime() - raceDate.getTime());
        if (diff < 24 * 3600 * 1000) {
          roundNum = (r.round || '').replace('R', '');
          raceName = r.race || raceName;
        }
      });
    }
    if (raceDate) {
      dateStr = raceDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }

    var html = '<div class="f1a-card f1-recap-card">'
      + '<div class="f1a-h">\u{1F3C1} Race Recap \u00b7 ' + raceName.replace(' Grand Prix', '') + ' GP</div>'
      + '<div class="f1a-sub">Round ' + roundNum + (dateStr ? ' \u00b7 ' + dateStr : '') + '</div>';

    // Podium
    html += '<div class="f1-recap-podium">';
    podium.forEach(function(p, i) {
      var drv = driverMap[p.driver_number] || {};
      var name = drv.last_name || ('Car ' + p.driver_number);
      var team = (drv.team_name || '').toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
      var col = (typeof TEAM_COLORS !== 'undefined' && TEAM_COLORS[team]) || '#8a8fa8';
      if (typeof registerDriverColor === 'function') registerDriverColor(name, team);
      var gap = finalInt[p.driver_number];
      var timeStr = i === 0 ? 'WIN' : (gap && gap.gap_to_leader ? gap.gap_to_leader : '');
      html += '<div class="f1-recap-pod-item">'
        + '<span class="f1-recap-medal">' + medals[i] + '</span>'
        + '<div class="f1-recap-pod-info">'
        + '<span class="f1-recap-pod-name" style="color:' + col + '">' + name + '</span>'
        + '<span class="f1-recap-pod-team">' + (drv.team_name || '') + '</span>'
        + '</div>'
        + '<span class="f1-recap-pod-time">' + timeStr + '</span>'
        + '</div>';
    });
    html += '</div>';

    // Fastest lap
    if (flDriver) {
      var flTime = overallFastest > 0 ? formatRecapTime(overallFastest) : '';
      html += '<div class="f1-recap-fl">\u26A1 Fastest lap: <strong>' + flDriver.last_name + '</strong> ' + flTime + '</div>';
    }

    // DNFs
    if (dnfList.length) {
      html += '<div class="f1-recap-dnf">\u{1F6A9} DNF: ' + dnfList.join(', ') + '</div>';
    }

    // Full results
    html += '<div id="f1-recap-full" style="margin-top:12px">'
      + '<div class="f1-sess-header" style="cursor:pointer" onclick="toggleFullResults()">'
      + '<span>Full Results (' + sorted.length + ' drivers)</span>'
      + '<span id="f1-recap-toggle" style="color:#ffb627;font-size:12px">SHOW \u25BC</span>'
      + '</div>'
      + '<div id="f1-recap-full-list" style="display:none" class="f1-sess-list">';

    sorted.forEach(function(p) {
      var drv = driverMap[p.driver_number] || {};
      var name = drv.last_name || ('Car ' + p.driver_number);
      var team = (drv.team_name || '').toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
      var col = (typeof TEAM_COLORS !== 'undefined' && TEAM_COLORS[team]) || '#8a8fa8';
      var pos = p.position;
      var pc = pos === 1 ? 'p1' : pos === 2 ? 'p2' : pos === 3 ? 'p3' : '';
      var gap = finalInt[p.driver_number];
      var gapStr = pos === 1 ? 'WIN' : (gap && gap.gap_to_leader ? gap.gap_to_leader : '');
      var fl = fastestLap[p.driver_number] === overallFastest;
      html += '<div class="f1-sess-row">'
        + '<span class="f1-pos ' + pc + '">' + pos + '</span>'
        + '<span class="f1-num" style="background:' + col + '22;color:' + col + '">' + p.driver_number + '</span>'
        + '<span class="f1-sess-name">' + name + (fl ? ' <span class="fl-badge">FL</span>' : '') + '</span>'
        + '<span class="f1-sess-gap">' + gapStr + '</span>'
        + '</div>';
    });

    html += '</div></div>';

    // Key incidents
    if (raceControl) {
      var incidents = raceControl.filter(function(m) {
        var s = (m.message || '').toUpperCase();
        return s.indexOf('PENALTY') !== -1 || s.indexOf('SAFETY CAR') !== -1
          || s.indexOf('INVESTIGAT') !== -1 || s.indexOf('DELETED') !== -1;
      }).slice(0, 5);
      if (incidents.length) {
        html += '<div class="f1a-h" style="margin-top:10px">\u26A0\uFE0F Key Incidents</div>';
        incidents.forEach(function(m) {
          html += '<div class="f1-recap-incident">' + (m.message || '') + '</div>';
        });
      }
    }

    html += '<div class="f1-last-updated" style="margin-top:8px">OpenF1 API \u00b7 Real-time</div>';
    html += '</div>';
    root.innerHTML = html;
    return true;

  } catch(e) {
    return false;
  }
}

async function tryJolpicaRecap(root) {
  try {
    var rd = await recapFetch(JOL_RECAP + '/current/last/results.json?limit=30', 8000);
    var race = rd && rd.MRData && rd.MRData.RaceTable && rd.MRData.RaceTable.Races[0];
    if (!race || !race.Results) { root.innerHTML = ''; return; }

    var results = race.Results;
    var podium = results.slice(0, 3);
    var medals = ['\u{1F947}','\u{1F948}','\u{1F949}'];
    var fl = null;
    results.forEach(function(r){ if(r.FastestLap && r.FastestLap.rank === '1') fl = r; });
    var dnfs = results.filter(function(r){
      var s = (r.status||'').toLowerCase();
      return s !== 'finished' && s.indexOf('lap') === -1;
    });

    var html = '<div class="f1a-card f1-recap-card">'
      + '<div class="f1a-h">\u{1F3C1} Race Recap \u00b7 ' + race.raceName.replace(' Grand Prix','') + ' GP</div>'
      + '<div class="f1a-sub">Round ' + race.round + ' \u00b7 ' + new Date(race.date).toLocaleDateString([],{month:'short',day:'numeric'}) + '</div>';

    html += '<div class="f1-recap-podium">';
    podium.forEach(function(r,i){
      var cid = r.Constructor.constructorId;
      var col = (typeof TEAM_COLORS !== 'undefined' && TEAM_COLORS[cid]) || '#8a8fa8';
      html += '<div class="f1-recap-pod-item">'
        + '<span class="f1-recap-medal">'+medals[i]+'</span>'
        + '<div class="f1-recap-pod-info"><span class="f1-recap-pod-name" style="color:'+col+'">'+r.Driver.familyName+'</span>'
        + '<span class="f1-recap-pod-team">'+r.Constructor.name+'</span></div>'
        + '<span class="f1-recap-pod-time">'+(i===0?(r.Time?r.Time.time:'WIN'):(r.Time?'+'+r.Time.time:r.status))+'</span>'
        + '</div>';
    });
    html += '</div>';
    if(fl) html += '<div class="f1-recap-fl">\u26A1 Fastest lap: <strong>'+fl.Driver.familyName+'</strong> '+(fl.FastestLap&&fl.FastestLap.Time?fl.FastestLap.Time.time:'')+'</div>';
    if(dnfs.length) html += '<div class="f1-recap-dnf">\u{1F6A9} DNF: '+dnfs.map(function(d){return d.Driver.familyName+' ('+d.status+')';}).join(', ')+'</div>';
    html += '<div class="f1-last-updated" style="margin-top:8px">Jolpica API \u00b7 May be delayed after race day</div>';
    html += '</div>';
    root.innerHTML = html;
  } catch(e) {
    root.innerHTML = '';
  }
}

function toggleFullResults() {
  var list = document.getElementById('f1-recap-full-list');
  var toggle = document.getElementById('f1-recap-toggle');
  if (!list) return;
  if (list.style.display === 'none') {
    list.style.display = 'block';
    if (toggle) toggle.textContent = 'HIDE \u25B2';
  } else {
    list.style.display = 'none';
    if (toggle) toggle.textContent = 'SHOW \u25BC';
  }
}

function formatRecapTime(seconds) {
  if (!seconds || seconds <= 0) return '';
  var m  = Math.floor(seconds / 60);
  var s  = Math.floor(seconds % 60);
  var ms = Math.round((seconds % 1) * 1000);
  return m + ':' + String(s).padStart(2,'0') + '.' + String(ms).padStart(3,'0');
}
