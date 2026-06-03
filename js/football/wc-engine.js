// ============================================================
// wc-engine.js — fetches the WC data once, computes group
// standings from played matches, exposes helpers for all subtabs.
// Data: openfootball/worldcup.json (CC0, public domain, no key).
// ============================================================

var WC_FEED = 'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json';
var _wcData = null;       // raw {name, matches:[]}
var _wcLoaded = false;
var _wcLoading = null;

function wcLoad() {
  if (_wcLoaded) return Promise.resolve(_wcData);
  if (_wcLoading) return _wcLoading;
  _wcLoading = new Promise(function(resolve) {
    var done = false;
    var t = setTimeout(function(){ if(!done){done=true;resolve(null);} }, 9000);
    fetch(WC_FEED).then(function(r){ return r.ok ? r.json() : null; }).then(function(data){
      if (done) return; done = true; clearTimeout(t);
      _wcData = data; _wcLoaded = !!data;
      resolve(data);
    }).catch(function(){ if(!done){done=true;clearTimeout(t);resolve(null);} });
  });
  return _wcLoading;
}

function wcMatches() { return (_wcData && _wcData.matches) || []; }

function wcHasScore(m) { return m.score && m.score.ft && m.score.ft.length === 2; }

// Compute standings table for one group from played matches.
function wcGroupTable(groupName) {
  var teams = (typeof WC_GROUPS !== 'undefined' && WC_GROUPS[groupName]) || [];
  var row = {};
  teams.forEach(function(t){ row[t] = { team:t, P:0, W:0, D:0, L:0, GF:0, GA:0, GD:0, Pts:0 }; });
  function norm(t){ return t === 'Czech Republic' ? 'Czech Republic' : t; }
  wcMatches().forEach(function(m){
    if (m.group !== groupName || !wcHasScore(m)) return;
    var a = norm(m.team1), b = norm(m.team2);
    if (!row[a] || !row[b]) return;
    var ga = parseInt(m.score.ft[0]), gb = parseInt(m.score.ft[1]);
    row[a].P++; row[b].P++;
    row[a].GF += ga; row[a].GA += gb;
    row[b].GF += gb; row[b].GA += ga;
    if (ga > gb) { row[a].W++; row[a].Pts += 3; row[b].L++; }
    else if (gb > ga) { row[b].W++; row[b].Pts += 3; row[a].L++; }
    else { row[a].D++; row[b].D++; row[a].Pts++; row[b].Pts++; }
  });
  var arr = teams.map(function(t){ var r = row[t]; r.GD = r.GF - r.GA; return r; });
  arr.sort(function(x,y){
    if (y.Pts !== x.Pts) return y.Pts - x.Pts;
    if (y.GD !== x.GD)   return y.GD - x.GD;
    if (y.GF !== x.GF)   return y.GF - x.GF;
    return x.team.localeCompare(y.team);
  });
  return arr;
}

// Knockout matches grouped by round name.
function wcKnockout() {
  var ko = {};
  wcMatches().forEach(function(m){
    var r = m.round || '';
    if (/Round of 32|Round of 16|Quarter|Semi|third place|Final/i.test(r)) {
      (ko[r] = ko[r] || []).push(m);
    }
  });
  return ko;
}

// All matches involving the user's team, chronological.
function wcMyTeamMatches() {
  var mine = (typeof WC_MY_TEAM !== 'undefined') ? WC_MY_TEAM : null;
  if (!mine) return [];
  return wcMatches().filter(function(m){
    return m.team1 === mine || m.team2 === mine;
  }).sort(function(a,b){ return (a.date||'').localeCompare(b.date||''); });
}

// Convert "13:00 UTC-6" + date to a JS Date (UTC).
function wcMatchDate(m) {
  if (!m.date) return null;
  var time = (m.time || '12:00 UTC+0');
  var hm = time.match(/(\d{1,2}):(\d{2})/);
  var off = time.match(/UTC([+-]\d{1,2})/);
  if (!hm) return new Date(m.date + 'T12:00:00Z');
  var h = parseInt(hm[1]), min = parseInt(hm[2]);
  var offH = off ? parseInt(off[1]) : 0;
  // local time at venue minus offset = UTC
  var utcH = h - offH;
  var d = new Date(m.date + 'T00:00:00Z');
  d.setUTCHours(utcH, min, 0, 0);
  return d;
}
