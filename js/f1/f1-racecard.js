// ============================================================
// f1-racecard.js — next-race circuit card + weather + driver detail
// Weather: Open-Meteo (free, no key). Circuit data: f1-circuits.js.
// ============================================================

// Approx lat/long per circuit for weather (next-race only)
var CIRCUIT_COORDS = {
  'Monaco':       [43.7347, 7.4206],
  'Spanish':      [41.5700, 2.2611],
  'Austrian':     [47.2197, 14.7647],
  'British':      [52.0786, -1.0169],
  'Belgian':      [50.4372, 5.9714],
  'Hungarian':    [47.5789, 19.2486],
  'Dutch':        [52.3888, 4.5409],
  'Italian':      [45.6156, 9.2811],
  'Madrid':       [40.4637, -3.6166],
  'Azerbaijan':   [40.3725, 49.8533],
  'Singapore':    [1.2914, 103.8640],
  'United States':[30.1328, -97.6411],
  'Mexico':       [19.4042, -99.0907],
  'Sao Paulo':    [-23.7036, -46.6997],
  'Las Vegas':    [36.1147, -115.1728],
  'Qatar':        [25.4900, 51.4542],
  'Abu Dhabi':    [24.4672, 54.6031],
  'Japanese':     [34.8431, 136.5410],
  'Miami':        [25.9580, -80.2389],
  'Canadian':     [45.5000, -73.5228],
};

function coordsFor(raceName) {
  if (!raceName) return null;
  var keys = Object.keys(CIRCUIT_COORDS);
  for (var i = 0; i < keys.length; i++) if (raceName.indexOf(keys[i]) !== -1) return CIRCUIT_COORDS[keys[i]];
  return null;
}

// Render the next-race circuit card into #f1-racecard
async function loadNextRaceCard() {
  var root = document.getElementById('f1-racecard');
  if (!root) return;
  // find next race from calendar
  var next = null;
  if (typeof F1_CALENDAR !== 'undefined') {
    var now = Date.now();
    for (var i = 0; i < F1_CALENDAR.length; i++) {
      var race = F1_CALENDAR[i];
      var raceSession = race.sessions[race.sessions.length - 1];
      if (Date.parse(raceSession.time) > now) { next = race; break; }
    }
  }
  if (!next) { root.innerHTML = ''; return; }

  var info = (typeof getCircuitInfo === 'function') ? getCircuitInfo(next.race) : null;
  var html = '<div class="f1a-card f1-rc">'
    + '<div class="f1a-h">' + (next.flag || '') + ' ' + next.race + ' \u00b7 Circuit</div>';
  if (info) {
    html += '<div class="f1-rc-grid">'
      + '<div class="f1-rc-stat"><div class="f1-rc-v">' + info.len + '</div><div class="f1-rc-l">km</div></div>'
      + '<div class="f1-rc-stat"><div class="f1-rc-v">' + info.laps + '</div><div class="f1-rc-l">laps</div></div>'
      + '<div class="f1-rc-stat"><div class="f1-rc-v">' + info.corners + '</div><div class="f1-rc-l">corners</div></div>'
      + '<div class="f1-rc-stat"><div class="f1-rc-v">' + info.drs + '</div><div class="f1-rc-l">DRS zones</div></div>'
      + '</div>'
      + '<div class="f1-rc-record">Lap record: <strong>' + info.record + '</strong> \u00b7 ' + info.recordBy + '</div>';
  }
  html += '<div id="f1-rc-weather" class="f1-rc-weather">Loading race-day weather...</div>';
  html += '</div>';
  root.innerHTML = html;

  // weather for race day
  var coords = coordsFor(next.race);
  var raceSession = next.sessions[next.sessions.length - 1];
  var raceDate = raceSession.time.split('T')[0];
  if (coords) loadRaceWeather(coords, raceDate);
  else { var w = document.getElementById('f1-rc-weather'); if (w) w.textContent = ''; }
}

async function loadRaceWeather(coords, dateStr) {
  var el = document.getElementById('f1-rc-weather');
  if (!el) return;
  try {
    var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + coords[0] + '&longitude=' + coords[1]
      + '&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode'
      + '&timezone=auto&start_date=' + dateStr + '&end_date=' + dateStr;
    var res = await fetch(url);
    if (!res.ok) { el.textContent = ''; return; }
    var data = await res.json();
    var d = data.daily;
    if (!d || !d.temperature_2m_max) { el.textContent = ''; return; }
    var hi = Math.round(d.temperature_2m_max[0]);
    var lo = Math.round(d.temperature_2m_min[0]);
    var rain = d.precipitation_probability_max ? d.precipitation_probability_max[0] : null;
    var code = d.weathercode ? d.weathercode[0] : 0;
    el.innerHTML = '\u{1F321}\uFE0F Race day: <strong>' + hi + '\u00b0/' + lo + '\u00b0C</strong>'
      + (rain != null ? ' \u00b7 \u{1F327}\uFE0F ' + rain + '% rain' : '')
      + ' \u00b7 ' + weatherDesc(code);
  } catch(e) { el.textContent = ''; }
}

function weatherDesc(code) {
  if (code === 0) return 'Clear';
  if (code <= 3) return 'Partly cloudy';
  if (code <= 48) return 'Foggy';
  if (code <= 67) return 'Rain';
  if (code <= 77) return 'Snow';
  if (code <= 82) return 'Showers';
  return 'Storms';
}

// ---- TAP-A-DRIVER DETAIL (modal) ----
async function openDriverDetail(driverId, name) {
  var modal = document.getElementById('f1-driver-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'f1-driver-modal';
    modal.className = 'f1-modal';
    modal.addEventListener('click', function(e){ if (e.target === modal) closeDriverDetail(); });
    document.body.appendChild(modal);
  }
  modal.style.display = 'flex';
  modal.innerHTML = '<div class="f1-modal-inner"><div class="f1-api-loading"><div class="f1-spinner"></div><span>Loading ' + name + '...</span></div></div>';

  var JOL = 'https://api.jolpi.ca/ergast/f1';
  try {
    var sres = await fetch(JOL + '/current/drivers/' + driverId + '/driverstandings.json');
    var sdata = await sres.json();
    var sl = sdata.MRData.StandingsTable.StandingsLists[0];
    var standing = sl && sl.DriverStandings && sl.DriverStandings[0];

    var rres = await fetch(JOL + '/current/drivers/' + driverId + '/results.json?limit=30');
    var rdata = await rres.json();
    var races = (rdata.MRData.RaceTable && rdata.MRData.RaceTable.Races) || [];

    var wins = 0, podiums = 0, points = standing ? standing.points : '0';
    races.forEach(function(r){
      var p = parseInt(r.Results[0].position);
      if (p === 1) wins++;
      if (p <= 3) podiums++;
    });

    var html = '<div class="f1-modal-inner">'
      + '<button class="f1-modal-close" onclick="closeDriverDetail()">\u2715</button>'
      + '<div class="f1-modal-title">' + name + '</div>'
      + '<div class="f1-modal-stats">'
      + '<div class="f1-ms"><div class="f1-ms-v">' + (standing ? standing.position : '\u2014') + '</div><div class="f1-ms-l">Champ Pos</div></div>'
      + '<div class="f1-ms"><div class="f1-ms-v">' + points + '</div><div class="f1-ms-l">Points</div></div>'
      + '<div class="f1-ms"><div class="f1-ms-v">' + wins + '</div><div class="f1-ms-l">Wins</div></div>'
      + '<div class="f1-ms"><div class="f1-ms-v">' + podiums + '</div><div class="f1-ms-l">Podiums</div></div>'
      + '</div>';
    html += '<div class="f1a-h" style="margin-top:12px">2026 Results</div><div class="f1-modal-results">';
    races.forEach(function(r){
      var p = r.Results[0].position;
      var pc = p === '1' ? 'win' : (parseInt(p) <= 3 ? 'pod' : '');
      html += '<div class="f1-mr-row"><span class="f1-mr-race">' + r.raceName.replace(' Grand Prix','') + '</span><span class="f1-mr-pos ' + pc + '">P' + p + '</span></div>';
    });
    html += '</div></div>';
    modal.innerHTML = html;
  } catch(e) {
    modal.innerHTML = '<div class="f1-modal-inner"><button class="f1-modal-close" onclick="closeDriverDetail()">\u2715</button><div style="padding:24px;text-align:center;color:var(--txt-muted)">Could not load driver data.</div></div>';
  }
}

function closeDriverDetail() {
  var modal = document.getElementById('f1-driver-modal');
  if (modal) modal.style.display = 'none';
}
