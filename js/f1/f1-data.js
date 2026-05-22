// ============================================================
// f1-data.js — F1 calendar, session durations, team colours
// Edit this file to update the season calendar or standings
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

var F1_CALENDAR = [
  { race:'Australian Grand Prix', circuit:'Albert Park, Melbourne', round:'R1', flag:'AUS', sessions:[
    { name:'Practice 1',  time:'2026-03-13T01:30:00Z' },
    { name:'Practice 2',  time:'2026-03-13T05:00:00Z' },
    { name:'Practice 3',  time:'2026-03-14T01:30:00Z' },
    { name:'Qualifying',  time:'2026-03-14T05:00:00Z' },
    { name:'Race',        time:'2026-03-15T05:00:00Z' },
  ]},
  { race:'Chinese Grand Prix', circuit:'Shanghai International Circuit', round:'R2', flag:'CHN', sessions:[
    { name:'Practice 1',        time:'2026-03-20T03:30:00Z' },
    { name:'Sprint Qualifying', time:'2026-03-20T07:30:00Z' },
    { name:'Sprint Race',       time:'2026-03-21T03:00:00Z' },
    { name:'Qualifying',        time:'2026-03-21T07:00:00Z' },
    { name:'Race',              time:'2026-03-22T07:00:00Z' },
  ]},
  { race:'Japanese Grand Prix', circuit:'Suzuka Circuit', round:'R3', flag:'JPN', sessions:[
    { name:'Practice 1', time:'2026-04-03T02:30:00Z' },
    { name:'Practice 2', time:'2026-04-03T06:00:00Z' },
    { name:'Practice 3', time:'2026-04-04T02:30:00Z' },
    { name:'Qualifying', time:'2026-04-04T06:00:00Z' },
    { name:'Race',       time:'2026-04-05T05:00:00Z' },
  ]},
  { race:'Bahrain Grand Prix', circuit:'Bahrain International Circuit', round:'R4', flag:'BHR', sessions:[
    { name:'Practice 1', time:'2026-04-17T11:30:00Z' },
    { name:'Practice 2', time:'2026-04-17T15:00:00Z' },
    { name:'Practice 3', time:'2026-04-18T11:30:00Z' },
    { name:'Qualifying', time:'2026-04-18T15:00:00Z' },
    { name:'Race',       time:'2026-04-19T15:00:00Z' },
  ]},
  { race:'Miami Grand Prix', circuit:'Miami International Autodrome', round:'R5 · Sprint', flag:'USA', sessions:[
    { name:'Practice 1',        time:'2026-05-02T16:30:00Z' },
    { name:'Sprint Qualifying', time:'2026-05-02T20:30:00Z' },
    { name:'Sprint Race',       time:'2026-05-03T16:00:00Z' },
    { name:'Qualifying',        time:'2026-05-03T20:00:00Z' },
    { name:'Race',              time:'2026-05-04T20:00:00Z' },
  ]},
  { race:'Canadian Grand Prix', circuit:'Circuit Gilles Villeneuve, Montreal', round:'R6 · Sprint', flag:'CAN', sessions:[
    { name:'Practice 1',        time:'2026-05-22T16:30:00Z' },
    { name:'Sprint Qualifying', time:'2026-05-22T20:30:00Z' },
    { name:'Sprint Race',       time:'2026-05-23T16:00:00Z' },
    { name:'Qualifying',        time:'2026-05-23T20:00:00Z' },
    { name:'Race',              time:'2026-05-24T20:00:00Z' },
  ]},
  { race:'Spanish Grand Prix', circuit:'Circuit de Barcelona-Catalunya', round:'R7', flag:'ESP', sessions:[
    { name:'Practice 1', time:'2026-05-29T11:30:00Z' },
    { name:'Practice 2', time:'2026-05-29T15:00:00Z' },
    { name:'Practice 3', time:'2026-05-30T10:30:00Z' },
    { name:'Qualifying', time:'2026-05-30T14:00:00Z' },
    { name:'Race',       time:'2026-05-31T13:00:00Z' },
  ]},
  { race:'Austrian Grand Prix', circuit:'Red Bull Ring, Spielberg', round:'R8 · Sprint', flag:'AUT', sessions:[
    { name:'Practice 1',        time:'2026-06-26T10:30:00Z' },
    { name:'Sprint Qualifying', time:'2026-06-26T14:30:00Z' },
    { name:'Sprint Race',       time:'2026-06-27T10:00:00Z' },
    { name:'Qualifying',        time:'2026-06-27T14:00:00Z' },
    { name:'Race',              time:'2026-06-28T13:00:00Z' },
  ]},
  { race:'British Grand Prix', circuit:'Silverstone Circuit', round:'R9', flag:'GBR', sessions:[
    { name:'Practice 1', time:'2026-07-03T11:30:00Z' },
    { name:'Practice 2', time:'2026-07-03T15:00:00Z' },
    { name:'Practice 3', time:'2026-07-04T10:30:00Z' },
    { name:'Qualifying', time:'2026-07-04T14:00:00Z' },
    { name:'Race',       time:'2026-07-05T14:00:00Z' },
  ]},
  { race:'Belgian Grand Prix', circuit:'Circuit de Spa-Francorchamps', round:'R10', flag:'BEL', sessions:[
    { name:'Practice 1', time:'2026-07-24T11:30:00Z' },
    { name:'Practice 2', time:'2026-07-24T15:00:00Z' },
    { name:'Practice 3', time:'2026-07-25T10:30:00Z' },
    { name:'Qualifying', time:'2026-07-25T14:00:00Z' },
    { name:'Race',       time:'2026-07-26T13:00:00Z' },
  ]},
  { race:'Hungarian Grand Prix', circuit:'Hungaroring, Budapest', round:'R11', flag:'HUN', sessions:[
    { name:'Practice 1', time:'2026-07-31T11:30:00Z' },
    { name:'Practice 2', time:'2026-07-31T15:00:00Z' },
    { name:'Practice 3', time:'2026-08-01T10:30:00Z' },
    { name:'Qualifying', time:'2026-08-01T14:00:00Z' },
    { name:'Race',       time:'2026-08-02T13:00:00Z' },
  ]},
  { race:'Dutch Grand Prix', circuit:'Circuit Zandvoort', round:'R12', flag:'NED', sessions:[
    { name:'Practice 1', time:'2026-08-28T10:30:00Z' },
    { name:'Practice 2', time:'2026-08-28T14:00:00Z' },
    { name:'Practice 3', time:'2026-08-29T09:30:00Z' },
    { name:'Qualifying', time:'2026-08-29T13:00:00Z' },
    { name:'Race',       time:'2026-08-30T13:00:00Z' },
  ]},
  { race:'Italian Grand Prix', circuit:'Autodromo Nazionale Monza', round:'R13', flag:'ITA', sessions:[
    { name:'Practice 1', time:'2026-09-04T11:30:00Z' },
    { name:'Practice 2', time:'2026-09-04T15:00:00Z' },
    { name:'Practice 3', time:'2026-09-05T10:30:00Z' },
    { name:'Qualifying', time:'2026-09-05T14:00:00Z' },
    { name:'Race',       time:'2026-09-06T13:00:00Z' },
  ]},
  { race:'Azerbaijan Grand Prix', circuit:'Baku City Circuit', round:'R14', flag:'AZE', sessions:[
    { name:'Practice 1', time:'2026-09-18T09:30:00Z' },
    { name:'Practice 2', time:'2026-09-18T13:00:00Z' },
    { name:'Practice 3', time:'2026-09-19T08:30:00Z' },
    { name:'Qualifying', time:'2026-09-19T12:00:00Z' },
    { name:'Race',       time:'2026-09-20T11:00:00Z' },
  ]},
  { race:'Singapore Grand Prix', circuit:'Marina Bay Street Circuit', round:'R15', flag:'SGP', sessions:[
    { name:'Practice 1', time:'2026-10-02T09:30:00Z' },
    { name:'Practice 2', time:'2026-10-02T13:00:00Z' },
    { name:'Practice 3', time:'2026-10-03T09:30:00Z' },
    { name:'Qualifying', time:'2026-10-03T13:00:00Z' },
    { name:'Race',       time:'2026-10-04T12:00:00Z' },
  ]},
  { race:'United States Grand Prix', circuit:'Circuit of the Americas, Austin', round:'R16 · Sprint', flag:'USA', sessions:[
    { name:'Practice 1',        time:'2026-10-16T17:30:00Z' },
    { name:'Sprint Qualifying', time:'2026-10-16T21:30:00Z' },
    { name:'Sprint Race',       time:'2026-10-17T17:00:00Z' },
    { name:'Qualifying',        time:'2026-10-17T21:00:00Z' },
    { name:'Race',              time:'2026-10-18T19:00:00Z' },
  ]},
  { race:'Mexico City Grand Prix', circuit:'Autodromo Hermanos Rodriguez', round:'R17', flag:'MEX', sessions:[
    { name:'Practice 1', time:'2026-10-23T18:30:00Z' },
    { name:'Practice 2', time:'2026-10-23T22:00:00Z' },
    { name:'Practice 3', time:'2026-10-24T17:30:00Z' },
    { name:'Qualifying', time:'2026-10-24T21:00:00Z' },
    { name:'Race',       time:'2026-10-25T20:00:00Z' },
  ]},
  { race:'Sao Paulo Grand Prix', circuit:'Autodromo Jose Carlos Pace', round:'R18 · Sprint', flag:'BRA', sessions:[
    { name:'Practice 1',        time:'2026-11-06T14:30:00Z' },
    { name:'Sprint Qualifying', time:'2026-11-06T18:30:00Z' },
    { name:'Sprint Race',       time:'2026-11-07T14:00:00Z' },
    { name:'Qualifying',        time:'2026-11-07T18:00:00Z' },
    { name:'Race',              time:'2026-11-08T17:00:00Z' },
  ]},
  { race:'Las Vegas Grand Prix', circuit:'Las Vegas Street Circuit', round:'R19', flag:'USA', sessions:[
    { name:'Practice 1', time:'2026-11-19T04:30:00Z' },
    { name:'Practice 2', time:'2026-11-19T08:00:00Z' },
    { name:'Practice 3', time:'2026-11-20T04:30:00Z' },
    { name:'Qualifying', time:'2026-11-20T08:00:00Z' },
    { name:'Race',       time:'2026-11-21T06:00:00Z' },
  ]},
  { race:'Qatar Grand Prix', circuit:'Lusail International Circuit', round:'R20 · Sprint', flag:'QAT', sessions:[
    { name:'Practice 1',        time:'2026-11-27T13:30:00Z' },
    { name:'Sprint Qualifying', time:'2026-11-27T17:30:00Z' },
    { name:'Sprint Race',       time:'2026-11-28T13:00:00Z' },
    { name:'Qualifying',        time:'2026-11-28T17:00:00Z' },
    { name:'Race',              time:'2026-11-29T17:00:00Z' },
  ]},
  { race:'Abu Dhabi Grand Prix', circuit:'Yas Marina Circuit', round:'R21 · Finale', flag:'UAE', sessions:[
    { name:'Practice 1', time:'2026-12-04T09:30:00Z' },
    { name:'Practice 2', time:'2026-12-04T13:00:00Z' },
    { name:'Practice 3', time:'2026-12-05T09:30:00Z' },
    { name:'Qualifying', time:'2026-12-05T13:00:00Z' },
    { name:'Race',       time:'2026-12-06T13:00:00Z' },
  ]},
];

var F1_STANDINGS_FALLBACK = [
  { pos:1,  num:12, name:'Antonelli',  cid:'mercedes',     pts:100, wins:3 },
  { pos:2,  num:63, name:'Russell',    cid:'mercedes',     pts:80,  wins:1 },
  { pos:3,  num:16, name:'Leclerc',    cid:'ferrari',      pts:59,  wins:0 },
  { pos:4,  num:4,  name:'Norris',     cid:'mclaren',      pts:51,  wins:0 },
  { pos:5,  num:44, name:'Hamilton',   cid:'ferrari',      pts:51,  wins:0 },
  { pos:6,  num:81, name:'Piastri',    cid:'mclaren',      pts:43,  wins:0 },
  { pos:7,  num:3,  name:'Verstappen', cid:'red_bull',     pts:26,  wins:0 },
  { pos:8,  num:87, name:'Bearman',    cid:'haas',         pts:17,  wins:0 },
  { pos:9,  num:10, name:'Gasly',      cid:'alpine',       pts:16,  wins:0 },
  { pos:10, num:30, name:'Lawson',     cid:'red_bull',     pts:10,  wins:0 },
];

var F1_CONSTRUCTORS_FALLBACK = [
  { pos:1, name:'Mercedes',     cid:'mercedes',     pts:180, wins:4 },
  { pos:2, name:'Ferrari',      cid:'ferrari',      pts:110, wins:0 },
  { pos:3, name:'McLaren',      cid:'mclaren',      pts:94,  wins:0 },
  { pos:4, name:'Red Bull',     cid:'red_bull',     pts:36,  wins:0 },
  { pos:5, name:'Aston Martin', cid:'aston_martin', pts:18,  wins:0 },
  { pos:6, name:'Haas',         cid:'haas',         pts:17,  wins:0 },
  { pos:7, name:'Alpine',       cid:'alpine',       pts:16,  wins:0 },
  { pos:8, name:'Williams',     cid:'williams',     pts:9,   wins:0 },
  { pos:9, name:'RB',           cid:'rb',           pts:10,  wins:0 },
  { pos:10,name:'Kick Sauber',  cid:'kick_sauber',  pts:0,   wins:0 },
];
