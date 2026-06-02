// ============================================================
// f1-circuits.js — circuit metadata (not in any free API)
// Keyed by race name substring. Lap records & DRS zones are static.
// ============================================================

var F1_CIRCUITS = {
  'Australian':  { len:5.278, laps:58, corners:14, drs:4, record:"1:19.813", recordBy:"Leclerc '24", country:'Australia' },
  'Chinese':     { len:5.451, laps:56, corners:16, drs:2, record:"1:32.238", recordBy:"Schumacher '04", country:'China' },
  'Japanese':    { len:5.807, laps:53, corners:18, drs:1, record:"1:30.983", recordBy:"Hamilton '19", country:'Japan' },
  'Miami':       { len:5.412, laps:57, corners:19, drs:3, record:"1:29.708", recordBy:"Verstappen '23", country:'USA' },
  'Canadian':    { len:4.361, laps:70, corners:14, drs:3, record:"1:13.078", recordBy:"Bottas '19", country:'Canada' },
  'Monaco':      { len:3.337, laps:78, corners:19, drs:1, record:"1:12.909", recordBy:"Hamilton '21", country:'Monaco' },
  'Spanish':     { len:4.657, laps:66, corners:14, drs:2, record:"1:16.330", recordBy:"Verstappen '23", country:'Spain' },
  'Austrian':    { len:4.318, laps:71, corners:10, drs:3, record:"1:05.619", recordBy:"Sainz '20", country:'Austria' },
  'British':     { len:5.891, laps:52, corners:18, drs:2, record:"1:27.097", recordBy:"Verstappen '20", country:'UK' },
  'Belgian':     { len:7.004, laps:44, corners:19, drs:2, record:"1:46.286", recordBy:"Hamilton '20", country:'Belgium' },
  'Hungarian':   { len:4.381, laps:70, corners:14, drs:1, record:"1:16.627", recordBy:"Hamilton '20", country:'Hungary' },
  'Dutch':       { len:4.259, laps:72, corners:14, drs:2, record:"1:11.097", recordBy:"Hamilton '21", country:'Netherlands' },
  'Italian':     { len:5.793, laps:53, corners:11, drs:2, record:"1:21.046", recordBy:"Barrichello '04", country:'Italy' },
  'Madrid':      { len:5.470, laps:57, corners:22, drs:2, record:"new", recordBy:"\u2014", country:'Spain' },
  'Azerbaijan':  { len:6.003, laps:51, corners:20, drs:2, record:"1:43.009", recordBy:"Leclerc '19", country:'Azerbaijan' },
  'Singapore':   { len:4.940, laps:62, corners:19, drs:3, record:"1:34.486", recordBy:"Hamilton '23", country:'Singapore' },
  'United States':{ len:5.513, laps:56, corners:20, drs:2, record:"1:36.169", recordBy:"Leclerc '19", country:'USA' },
  'Mexico':      { len:4.304, laps:71, corners:17, drs:3, record:"1:17.774", recordBy:"Bottas '21", country:'Mexico' },
  'Sao Paulo':   { len:4.309, laps:71, corners:15, drs:2, record:"1:10.540", recordBy:"Bottas '18", country:'Brazil' },
  'Las Vegas':   { len:6.201, laps:50, corners:17, drs:2, record:"1:35.490", recordBy:"Piastri '24", country:'USA' },
  'Qatar':       { len:5.419, laps:57, corners:16, drs:1, record:"1:24.319", recordBy:"Verstappen '21", country:'Qatar' },
  'Abu Dhabi':   { len:5.281, laps:58, corners:16, drs:2, record:"1:26.103", recordBy:"Verstappen '21", country:'UAE' },
};

function getCircuitInfo(raceName) {
  if (!raceName) return null;
  var keys = Object.keys(F1_CIRCUITS);
  for (var i = 0; i < keys.length; i++) {
    if (raceName.indexOf(keys[i]) !== -1) return F1_CIRCUITS[keys[i]];
  }
  return null;
}

// "On this day" — notable F1 moments keyed by MM-DD
var F1_ON_THIS_DAY = {
  '03-08': "2026: Record-tying 24-race season opens in Melbourne.",
  '05-25': "Monaco GP traditionally crowns the season's most prestigious win.",
  '06-07': "Monaco's twisty streets have decided many championships.",
  '07-05': "Silverstone — home of the very first F1 World Championship race (1950).",
  '09-13': "Madrid joins the calendar as F1's newest European venue.",
  '11-22': "Las Vegas lights up the Strip for night racing.",
};

function getOnThisDay() {
  var d = new Date();
  var key = String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  return F1_ON_THIS_DAY[key] || null;
}

// ============================================================
// Extended circuit intel: typical tyre stops, overtaking difficulty,
// fun facts. Keyed by same race-name substring as F1_CIRCUITS.
// ============================================================
var F1_CIRCUIT_INTEL = {
  'Australian':  { stops:'1-2', overtaking:'Medium', fact:'Albert Park was resurfaced and rejigged in 2022 for higher speeds.' },
  'Chinese':     { stops:'1-2', overtaking:'High',   fact:'The Turn 1-2 complex is one of the longest corners on the calendar.' },
  'Japanese':    { stops:'2',   overtaking:'Low',    fact:'Suzuka is the only figure-8 layout in F1.' },
  'Miami':       { stops:'1',   overtaking:'Medium', fact:'The circuit wraps around the Hard Rock Stadium.' },
  'Canadian':    { stops:'1-2', overtaking:'High',   fact:'The Wall of Champions has caught out many title winners.' },
  'Monaco':      { stops:'1',   overtaking:'Very Low',fact:'Pole position wins here more than anywhere else - track position is everything.' },
  'Spanish':     { stops:'2',   overtaking:'Low',    fact:'A true all-round test - teams that win here usually have the best car.' },
  'Austrian':    { stops:'1-2', overtaking:'High',   fact:'One of the shortest laps; the field is often covered by a few seconds.' },
  'British':     { stops:'1-2', overtaking:'High',   fact:'Silverstone hosted the first ever F1 World Championship race in 1950.' },
  'Belgian':     { stops:'1-2', overtaking:'High',   fact:'Eau Rouge-Raidillon is F1 most famous corner sequence.' },
  'Hungarian':   { stops:'1-2', overtaking:'Very Low',fact:'Often called Monaco without the walls - tight and twisty.' },
  'Dutch':       { stops:'1-2', overtaking:'Low',    fact:'Zandvoort banked corners are inspired by old-school oval racing.' },
  'Italian':     { stops:'1',   overtaking:'High',   fact:'Monza is the fastest track in F1 - top speeds over 350 km/h.' },
  'Madrid':      { stops:'TBD', overtaking:'TBD',    fact:'Madring is brand new for 2026 - a mostly street circuit with a banked turn.' },
  'Azerbaijan':  { stops:'1',   overtaking:'High',   fact:'Baku has the longest flat-out section on the calendar - over 2km.' },
  'Singapore':   { stops:'1-2', overtaking:'Low',    fact:'The most physically demanding race - about 2 hours in extreme humidity.' },
  'United States':{ stops:'1-2',overtaking:'High',   fact:'COTA Turn 1 is a steep uphill braking zone, great for overtakes.' },
  'Mexico':      { stops:'1-2', overtaking:'Medium', fact:'Highest-altitude race - thin air challenges engine cooling.' },
  'Sao Paulo':   { stops:'1-2', overtaking:'High',   fact:'Interlagos runs anti-clockwise and often delivers chaotic, wet races.' },
  'Las Vegas':   { stops:'1',   overtaking:'High',   fact:'A night race down the Las Vegas Strip - F1 glitziest event.' },
  'Qatar':       { stops:'2-3', overtaking:'Medium', fact:'High-speed flowing corners punish tyres harder than almost anywhere.' },
  'Abu Dhabi':   { stops:'1',   overtaking:'Medium', fact:'The season finale, run into a desert sunset under floodlights.' },
};
function getCircuitIntel(raceName) {
  if (!raceName) return null;
  var keys = Object.keys(F1_CIRCUIT_INTEL);
  for (var i = 0; i < keys.length; i++) if (raceName.indexOf(keys[i]) !== -1) return F1_CIRCUIT_INTEL[keys[i]];
  return null;
}

var F1_HISTORY_POOL = [
  'Ayrton Senna took his first F1 win at the 1985 Portuguese GP in torrential rain.',
  'Michael Schumacher won a record 7 World Championships (1994-95, 2000-04).',
  'In 1950, the first F1 World Championship race was held at Silverstone.',
  'Lewis Hamilton broke the all-time wins record at the 2020 Portuguese GP.',
  'The 1976 title fight between Lauda and Hunt inspired the film Rush.',
  'Fernando Alonso ended the Ferrari reign by winning the 2005 title with Renault.',
  'The closest decider ever: Hamilton beat Massa by one point in 2008 final corner.',
  'Max Verstappen won his first title on the last lap of the 2021 Abu Dhabi GP.',
  'Monaco has hosted a Grand Prix almost every year since 1950.',
  'The youngest F1 winner ever is Max Verstappen - 18 years, 228 days (2016 Spain).',
];
function getHistoryNugget() {
  var d = new Date();
  var dayOfYear = Math.floor((d - new Date(d.getFullYear(),0,0)) / 86400000);
  return F1_HISTORY_POOL[dayOfYear % F1_HISTORY_POOL.length];
}

var F1_CONTRACTS_2027 = [
  { driver:'Verstappen',  team:'red_bull',    status:'confirmed' },
  { driver:'Antonelli',   team:'mercedes',    status:'confirmed' },
  { driver:'Russell',     team:'mercedes',    status:'confirmed' },
  { driver:'Leclerc',     team:'ferrari',     status:'confirmed' },
  { driver:'Hamilton',    team:'ferrari',     status:'confirmed' },
  { driver:'Norris',      team:'mclaren',     status:'confirmed' },
  { driver:'Piastri',     team:'mclaren',     status:'confirmed' },
  { driver:'Alonso',      team:'aston_martin',status:'expiring' },
  { driver:'Gasly',       team:'alpine',      status:'confirmed' },
  { driver:'Sainz',       team:'williams',    status:'confirmed' },
  { driver:'Albon',       team:'williams',    status:'expiring' },
  { driver:'Hadjar',      team:'rb',          status:'expiring' },
  { driver:'Lawson',      team:'rb',          status:'expiring' },
  { driver:'Hulkenberg',  team:'audi',        status:'confirmed' },
  { driver:'Bortoleto',   team:'audi',        status:'confirmed' },
  { driver:'Ocon',        team:'haas',        status:'expiring' },
  { driver:'Bearman',     team:'haas',        status:'confirmed' },
  { driver:'Perez',       team:'cadillac',    status:'confirmed' },
  { driver:'Bottas',      team:'cadillac',    status:'confirmed' },
];
