// ============================================================
// f1-preview.js — next-race intel (tyres, overtaking, fun fact),
// full-weekend weather trend, and rotating F1 history card.
// Features 13, 14, 15, 16, 17. Renders into #f1-preview.
// ============================================================

function loadF1Preview() {
  var root = document.getElementById('f1-preview');
  if (!root) return;
  if (typeof F1_CALENDAR === 'undefined') { root.innerHTML = ''; return; }

  var now = Date.now();
  var next = null;
  for (var i = 0; i < F1_CALENDAR.length; i++) {
    var last = F1_CALENDAR[i].sessions[F1_CALENDAR[i].sessions.length - 1];
    if (Date.parse(last.time) > now) { next = F1_CALENDAR[i]; break; }
  }

  var html = '';

  // Circuit preview intel
  if (next) {
    var intel = (typeof getCircuitIntel === 'function') ? getCircuitIntel(next.race) : null;
    if (intel) {
      html += '<div class="f1a-card"><div class="f1a-h">\u{1F52C} ' + next.race.replace(' Grand Prix',' GP') + ' \u00b7 Preview</div>'
        + '<div class="f1-prev-grid">'
        + '<div class="f1-prev-stat"><div class="f1-prev-v">' + intel.stops + '</div><div class="f1-prev-l">Likely stops</div></div>'
        + '<div class="f1-prev-stat"><div class="f1-prev-v">' + intel.overtaking + '</div><div class="f1-prev-l">Overtaking</div></div>'
        + '</div>'
        + '<div class="f1-prev-fact">\u{1F4A1} ' + intel.fact + '</div>'
        + '<div id="f1-prev-weather" class="f1-prev-weather">Loading weekend weather...</div>'
        + '</div>';
    }
  }

  // History card
  var nugget = (typeof getHistoryNugget === 'function') ? getHistoryNugget() : null;
  if (nugget) {
    html += '<div class="f1a-card f1-hist-card"><div class="f1a-h">\u{1F4DC} F1 History</div>'
      + '<div class="f1-hist-text">' + nugget + '</div></div>';
  }

  root.innerHTML = html;

  // Full-weekend weather trend (features 15)
  if (next) loadWeekendWeather(next);
}

async function loadWeekendWeather(race) {
  var el = document.getElementById('f1-prev-weather');
  if (!el) return;
  var coords = (typeof coordsFor === 'function') ? coordsFor(race.race) : null;
  if (!coords) { el.textContent = ''; return; }

  var first = race.sessions[0].time.split('T')[0];
  var last  = race.sessions[race.sessions.length - 1].time.split('T')[0];
  try {
    var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + coords[0] + '&longitude=' + coords[1]
      + '&daily=temperature_2m_max,precipitation_probability_max,weathercode&timezone=auto'
      + '&start_date=' + first + '&end_date=' + last;
    var res = await fetch(url);
    if (!res.ok) { el.textContent = ''; return; }
    var data = await res.json();
    var d = data.daily;
    if (!d || !d.time) { el.textContent = ''; return; }
    var days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    var row = '';
    for (var i = 0; i < d.time.length; i++) {
      var dt = new Date(d.time[i] + 'T12:00:00Z');
      var hi = Math.round(d.temperature_2m_max[i]);
      var rain = d.precipitation_probability_max ? d.precipitation_probability_max[i] : 0;
      var icon = rain >= 50 ? '\u{1F327}\uFE0F' : (rain >= 25 ? '\u26C5' : '\u2600\uFE0F');
      row += '<div class="f1-wx-day"><div class="f1-wx-dow">' + days[dt.getUTCDay()] + '</div>'
        + '<div class="f1-wx-icon">' + icon + '</div>'
        + '<div class="f1-wx-temp">' + hi + '\u00b0</div>'
        + '<div class="f1-wx-rain">' + rain + '%</div></div>';
    }
    el.innerHTML = '<div class="f1-wx-label">Weekend forecast</div><div class="f1-wx-row">' + row + '</div>';
  } catch(e) { el.textContent = ''; }
}
