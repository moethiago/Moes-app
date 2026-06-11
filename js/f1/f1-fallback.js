// ============================================================
// f1-fallback.js — fallback standings after R6 Monaco GP
// Updated: 2026-06-07
// ============================================================

// After R6 Monaco GP actual results:
// 1. Antonelli (Mercedes) - WIN
// 2. Hamilton (Ferrari)
// 3. Verstappen (Red Bull)
// 4. Leclerc (Ferrari)
// 5. Hadjar (Red Bull)

var F1_STANDINGS_FALLBACK = [
  { pos:1,  num:12, name:'Antonelli',  cid:'mercedes',     pts:156, wins:5, driverId:'antonelli' },
  { pos:2,  num:44, name:'Hamilton',   cid:'ferrari',      pts:90,  wins:0, driverId:'hamilton' },
  { pos:3,  num:63, name:'Russell',    cid:'mercedes',     pts:88,  wins:1, driverId:'russell' },
  { pos:4,  num:16, name:'Leclerc',    cid:'ferrari',      pts:75,  wins:0, driverId:'leclerc' },
  { pos:5,  num:81, name:'Piastri',    cid:'mclaren',      pts:60,  wins:0, driverId:'piastri' },
  { pos:6,  num:4,  name:'Norris',     cid:'mclaren',      pts:58,  wins:0, driverId:'norris' },
  { pos:7,  num:3,  name:'Verstappen', cid:'red_bull',     pts:43,  wins:0, driverId:'max_verstappen' },
  { pos:8,  num:6,  name:'Hadjar',     cid:'red_bull',     pts:29,  wins:0, driverId:'hadjar' },
  { pos:9,  num:30, name:'Lawson',     cid:'rb',           pts:26,  wins:0, driverId:'lawson' },
  { pos:10, num:10, name:'Gasly',      cid:'alpine',       pts:26,  wins:0, driverId:'gasly' },
];

var F1_CONSTRUCTORS_FALLBACK = [
  { pos:1, name:'Mercedes',     cid:'mercedes',     pts:244, wins:6 },
  { pos:2, name:'Ferrari',      cid:'ferrari',      pts:165, wins:0 },
  { pos:3, name:'McLaren',      cid:'mclaren',      pts:118, wins:0 },
  { pos:4, name:'Red Bull',     cid:'red_bull',     pts:72,  wins:0 },
  { pos:5, name:'Alpine',       cid:'alpine',       pts:26,  wins:0 },
  { pos:6, name:'RB',           cid:'rb',           pts:21,  wins:0 },
  { pos:7, name:'Haas',         cid:'haas',         pts:19,  wins:0 },
  { pos:8, name:'Aston Martin', cid:'aston_martin', pts:18,  wins:0 },
  { pos:9, name:'Williams',     cid:'williams',     pts:7,   wins:0 },
  { pos:10,name:'Kick Sauber',  cid:'kick_sauber',  pts:2,   wins:0 },
];
