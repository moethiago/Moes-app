// ============================================================
// f1-config.js — team colours + session durations
// ============================================================

var TEAM_COLORS = {
  mercedes:'#00d2be', ferrari:'#e8002d', red_bull:'#3671c6',
  mclaren:'#ff8700', aston_martin:'#229971', alpine:'#0093cc',
  williams:'#64c4ff', rb:'#6692ff', kick_sauber:'#52e252', haas:'#b6babd',
  cadillac:'#c8102e'
};

var SESSION_DURATION = {
  'Practice 1':60, 'Practice 2':60, 'Practice 3':60,
  'Sprint Qualifying':60, 'Sprint Race':45,
  'Qualifying':60, 'Race':120,
};

// ============================================================
// Team logos (inline SVG-friendly emoji/text marks + URLs)
// Using F1's team identity colors as logo chips since real logos
// are copyrighted. Returns a colored team badge.
// ============================================================
var TEAM_SHORT = {
  mercedes:'MER', ferrari:'FER', red_bull:'RBR', mclaren:'MCL',
  aston_martin:'AMR', alpine:'ALP', williams:'WIL', rb:'RB',
  kick_sauber:'SAU', haas:'HAA', cadillac:'CAD'
};

// Central driver -> team color map, built once from standings.
// Guarantees the SAME color for a driver everywhere they appear.
var DRIVER_COLOR_MAP = {};   // familyName (lowercase) -> hex
var DRIVER_TEAM_MAP  = {};   // familyName (lowercase) -> constructorId

function registerDriverColor(familyName, constructorId) {
  if (!familyName || !constructorId) return;
  var key = familyName.toLowerCase();
  DRIVER_TEAM_MAP[key]  = constructorId;
  DRIVER_COLOR_MAP[key] = TEAM_COLORS[constructorId] || '#8a8fa8';
}

function driverColor(familyName) {
  if (!familyName) return '#8a8fa8';
  return DRIVER_COLOR_MAP[familyName.toLowerCase()] || '#8a8fa8';
}

function teamBadge(constructorId, label) {
  var col = TEAM_COLORS[constructorId] || '#8a8fa8';
  var short = TEAM_SHORT[constructorId] || (label ? label.slice(0,3).toUpperCase() : '');
  return '<span class="f1-team-badge" style="background:' + col + '22;color:' + col + ';border:1px solid ' + col + '55">' + short + '</span>';
}

// Pre-seed the driver->color map from current standings so all
// sections share identical colors from first paint.
function seedDriverColors() {
  return new Promise(function(resolve) {
    var done = false;
    var t = setTimeout(function(){ if(!done){done=true;resolve();} }, 5000);
    fetch('https://api.jolpi.ca/ergast/f1/current/driverstandings.json?limit=30').then(function(r){
      return r.ok ? r.json() : null;
    }).then(function(data){
      if(done) return; done=true; clearTimeout(t);
      try {
        var sl = data.MRData.StandingsTable.StandingsLists[0];
        sl.DriverStandings.forEach(function(d){
          var c = d.Constructors && d.Constructors[0];
          if (c) registerDriverColor(d.Driver.familyName, c.constructorId);
        });
      } catch(e){}
      resolve();
    }).catch(function(){ if(!done){done=true;clearTimeout(t);resolve();} });
  });
}
