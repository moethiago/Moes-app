// ============================================================
// f1-interactive.js — driver comparison tool + predict-the-podium
// Comparison: Jolpica (free). Predictions: localStorage on device.
// Renders into #f1-interactive.
// ============================================================

var JOL_INT = 'https://api.jolpi.ca/ergast/f1';

function intFetch(path, ms) {
  return new Promise(function(resolve) {
    var done = false;
    var t = setTimeout(function(){ if(!done){done=true;resolve(null);} }, ms || 7000);
    fetch(JOL_INT + path).then(function(r){
      if(done) return; done=true; clearTimeout(t);
      if(!r.ok){resolve(null);return;}
      r.json().then(resolve).catch(function(){resolve(null);});
    }).catch(function(){ if(!done){done=true;clearTimeout(t);resolve(null);} });
  });
}

var _compareDrivers = []; // cached current-season drivers

async function loadF1Interactive() {
  var root = document.getElementById('f1-interactive');
  if (!root) return;

  // Build predict-the-podium for next race + comparison shell
  var html = '<div class="f1a-card"><div class="f1a-h">\u{1F3AF} Predict the Podium</div>'
    + '<div id="f1-predict-body"><div class="f1a-sub">Loading next race...</div></div></div>';
  html += '<div class="f1a-card"><div class="f1a-h">\u2696\uFE0F Compare Drivers</div>'
    + '<div class="f1-cmp-pickers">'
    + '<select id="f1-cmp-a" class="f1-cmp-select"><option>Driver A</option></select>'
    + '<span class="f1-cmp-vs">vs</span>'
    + '<select id="f1-cmp-b" class="f1-cmp-select"><option>Driver B</option></select>'
    + '</div><div id="f1-cmp-result"></div></div>';
  root.innerHTML = html;

  // populate driver dropdowns from current standings
  var sd = await intFetch('/current/driverstandings.json?limit=30', 7000);
  var sl = sd && sd.MRData && sd.MRData.StandingsTable && sd.MRData.StandingsTable.StandingsLists[0];
  if (sl && sl.DriverStandings) {
    _compareDrivers = sl.DriverStandings.map(function(d){
      return { id: d.Driver.driverId, name: d.Driver.familyName, pts: d.points, pos: d.position, wins: d.wins };
    });
    var opts = _compareDrivers.map(function(d){ return '<option value="' + d.id + '">' + d.name + '</option>'; }).join('');
    var a = document.getElementById('f1-cmp-a'), b = document.getElementById('f1-cmp-b');
    if (a) { a.innerHTML = '<option value="">Driver A</option>' + opts; a.addEventListener('change', runCompare); }
    if (b) { b.innerHTML = '<option value="">Driver B</option>' + opts; b.addEventListener('change', runCompare); }
  }

  buildPredictPodium();
}

function runCompare() {
  var aId = document.getElementById('f1-cmp-a').value;
  var bId = document.getElementById('f1-cmp-b').value;
  var out = document.getElementById('f1-cmp-result');
  if (!aId || !bId || aId === bId) { out.innerHTML = ''; return; }
  var a = _compareDrivers.find(function(d){return d.id===aId;});
  var b = _compareDrivers.find(function(d){return d.id===bId;});
  if (!a || !b) return;
  function row(label, av, bv) {
    var an = parseFloat(av), bn = parseFloat(bv);
    var aWin = an >= bn;
    return '<div class="f1-cmp-row">'
      + '<span class="f1-cmp-val ' + (aWin?'win':'') + '">' + av + '</span>'
      + '<span class="f1-cmp-lbl">' + label + '</span>'
      + '<span class="f1-cmp-val ' + (!aWin?'win':'') + '">' + bv + '</span></div>';
  }
  out.innerHTML = '<div class="f1-cmp-head"><span>' + a.name + '</span><span></span><span>' + b.name + '</span></div>'
    + row('Position', a.pos, b.pos)  // note: lower is better; handled visually only
    + row('Points', a.pts, b.pts)
    + row('Wins', a.wins, b.wins);
}

async function buildPredictPodium() {
  var body = document.getElementById('f1-predict-body');
  if (!body) return;
  // find next race from calendar
  var next = null;
  if (typeof F1_CALENDAR !== 'undefined') {
    var now = Date.now();
    for (var i=0;i<F1_CALENDAR.length;i++){
      var last = F1_CALENDAR[i].sessions[F1_CALENDAR[i].sessions.length-1];
      if (Date.parse(last.time) > now) { next = F1_CALENDAR[i]; break; }
    }
  }
  if (!next) { body.innerHTML = '<div class="f1a-sub">Season complete.</div>'; return; }

  var key = 'f1predict_' + next.round;
  var saved = null;
  try { saved = JSON.parse(localStorage.getItem(key)); } catch(e) {}

  if (saved && saved.picks) {
    body.innerHTML = '<div class="f1a-sub">Your podium for <strong>' + next.race + '</strong>:</div>'
      + '<div class="f1-predict-saved">'
      + '<div class="f1-predict-slot">\u{1F947} ' + saved.picks[0] + '</div>'
      + '<div class="f1-predict-slot">\u{1F948} ' + saved.picks[1] + '</div>'
      + '<div class="f1-predict-slot">\u{1F949} ' + saved.picks[2] + '</div>'
      + '</div><button class="f1-predict-btn" onclick="resetPredict(\'' + key + '\')">Change picks</button>';
    return;
  }

  var opts = _compareDrivers.length ? _compareDrivers : [];
  if (!opts.length) {
    var sd = await intFetch('/current/driverstandings.json?limit=30', 6000);
    var sl = sd && sd.MRData && sd.MRData.StandingsTable && sd.MRData.StandingsTable.StandingsLists[0];
    if (sl) opts = sl.DriverStandings.map(function(d){ return { id:d.Driver.driverId, name:d.Driver.familyName }; });
  }
  var sel = opts.map(function(d){ return '<option value="' + d.name + '">' + d.name + '</option>'; }).join('');
  body.innerHTML = '<div class="f1a-sub">Pick your top 3 for <strong>' + next.race + '</strong>:</div>'
    + '<select id="pred-1" class="f1-cmp-select"><option value="">\u{1F947} 1st</option>' + sel + '</select>'
    + '<select id="pred-2" class="f1-cmp-select"><option value="">\u{1F948} 2nd</option>' + sel + '</select>'
    + '<select id="pred-3" class="f1-cmp-select"><option value="">\u{1F949} 3rd</option>' + sel + '</select>'
    + '<button class="f1-predict-btn" onclick="savePredict(\'' + key + '\',\'' + next.race + '\')">Lock in picks</button>';
}

function savePredict(key, raceName) {
  var p1 = document.getElementById('pred-1').value;
  var p2 = document.getElementById('pred-2').value;
  var p3 = document.getElementById('pred-3').value;
  if (!p1 || !p2 || !p3) { alert('Pick all three positions'); return; }
  try { localStorage.setItem(key, JSON.stringify({ race: raceName, picks: [p1,p2,p3], ts: Date.now() })); } catch(e) {}
  buildPredictPodium();
}

function resetPredict(key) {
  try { localStorage.removeItem(key); } catch(e) {}
  buildPredictPodium();
}
