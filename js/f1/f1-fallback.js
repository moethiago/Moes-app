// ============================================================
// f1-fallback.js — fallback standings if API is unavailable
// ============================================================

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
