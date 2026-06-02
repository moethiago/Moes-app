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

// ============================================================
// Team logos (real, via public CDN) + driver helmet emblems
// Personal-use app. Logos load from formula1.com media CDN with
// graceful fallback to a colored chip if the image fails.
// ============================================================

// formula1.com uses content-key paths; this CDN mirror keys by team slug.
var TEAM_LOGO_SLUG = {
  mercedes:'mercedes', ferrari:'ferrari', red_bull:'red-bull-racing',
  mclaren:'mclaren', aston_martin:'aston-martin', alpine:'alpine',
  williams:'williams', rb:'racing-bulls', kick_sauber:'kick-sauber',
  haas:'haas', cadillac:'cadillac', audi:'audi'
};

// CDN slugs for real logos
var TEAM_CDN_SLUG = {
  mercedes:'mercedes', ferrari:'ferrari', red_bull:'red-bull-racing',
  mclaren:'mclaren', aston_martin:'aston-martin', alpine:'alpine',
  williams:'williams', rb:'racing-bulls', kick_sauber:'kick-sauber',
  haas:'haas', cadillac:'cadillac', audi:'audi'
};

function teamLogoUrl(constructorId) { return null; } // handled in teamLogo()

// Real team logo: tries multiple public CDN URLs in order; on each 404 it
// advances to the next; final fallback is our self-hosted SVG, then a chip.
function teamLogo(constructorId, label) {
  var col = TEAM_COLORS[constructorId] || '#8a8fa8';
  var short = TEAM_SHORT[constructorId] || (label ? label.slice(0,3).toUpperCase() : '');
  var chip = "<span class='f1-team-badge' style='background:" + col + "22;color:" + col + ";border:1px solid " + col + "55'>" + short + "</span>";
  var slug = TEAM_CDN_SLUG[constructorId];
  if (!slug) return chip;

  // Candidate real-logo sources, tried in order. Self-hosted SVG is last.
  var sources = [
    'https://media.formula1.com/content/dam/fom-website/teams/2026/' + slug + '-logo.png',
    'https://www.formula1.com/content/dam/fom-website/teams/2026/' + slug + '-logo.png',
    'https://media.formula1.com/content/dam/fom-website/teams/2025/' + slug + '-logo.png',
    'assets/teams/' + constructorId + '.svg'
  ];
  var first = sources[0];
  var rest  = sources.slice(1);
  var chainErr = "try{var r=JSON.parse(this.getAttribute('data-rest')||'[]');"
    + "if(r.length){var n=r.shift();this.setAttribute('data-rest',JSON.stringify(r));this.src=n;}"
    + "else{this.onerror=null;this.outerHTML=this.getAttribute('data-chip');}}catch(e){this.onerror=null;}";
  return '<img class="f1-team-logo" src="' + first + '" alt="' + short + '" '
    + "data-rest='" + JSON.stringify(rest) + "' "
    + 'data-chip="' + chip.replace(/"/g,'&quot;') + '" '
    + 'onerror="' + chainErr + '">';
}

// Original driver helmet emblem — stylized SVG, team-colored, with car number.
// No copyright issue (our own shape).
function driverHelmet(number, constructorId, size) {
  var col = TEAM_COLORS[constructorId] || '#8a8fa8';
  var s = size || 30;
  var num = number || '';
  return '<span class="f1-helmet" style="width:' + s + 'px;height:' + s + 'px">'
    + '<svg viewBox="0 0 40 40" width="' + s + '" height="' + s + '">'
    + '<path d="M20 5 C30 5 35 12 35 20 C35 24 33 26 30 27 L30 31 C30 32 29 33 28 33 L13 33 C9 33 5 28 5 21 C5 11 11 5 20 5 Z" fill="' + col + '"/>'
    + '<path d="M13 18 C13 15 16 13 20 13 C26 13 30 15 31 19 L31 22 L13 22 Z" fill="rgba(0,0,0,0.35)"/>'
    + '<rect x="5" y="24" width="25" height="4" rx="2" fill="rgba(255,255,255,0.25)"/>'
    + '</svg>'
    + '<span class="f1-helmet-num">' + num + '</span>'
    + '</span>';
}
