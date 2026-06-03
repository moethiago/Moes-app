// ============================================================
// wc-bracket-engine.js — derives the Round of 32 from live group
// standings. Winners + runners-up are deterministic; the 8 best
// third-placed teams are computed by FIFA tiebreakers.
//
// NOTE: FIFA uses 495 predefined scenarios to decide WHICH group's
// third-place team lands in WHICH winner's slot. We don't encode all
// 495 — instead we fill winners/runners-up exactly, list the 8
// qualifying third-place teams, and label third-place slots as a
// pool. This is accurate for 24 of 32 spots and honest about the rest.
// ============================================================

// Is the group stage complete for a given group? (all 6 matches played)
function wcGroupComplete(groupName) {
  var played = 0;
  wcMatches().forEach(function(m){
    if (m.group === groupName && wcHasScore(m)) played++;
  });
  return played >= 6; // 4 teams = 6 matches
}

function wcAllGroupsComplete() {
  if (typeof WC_GROUPS === 'undefined') return false;
  return Object.keys(WC_GROUPS).every(wcGroupComplete);
}

// Returns { winners:{A:team,...}, runnersUp:{...}, thirds:[{group,row}], bestThirds:[...] }
function wcQualifiers() {
  var groups = (typeof WC_GROUPS !== 'undefined') ? Object.keys(WC_GROUPS) : [];
  var winners = {}, runnersUp = {}, thirdsAll = [];
  groups.forEach(function(g){
    var table = wcGroupTable(g);
    if (!table.length) return;
    var letter = g.replace('Group ', '');
    winners[letter]   = { team: table[0] ? table[0].team : null, row: table[0], group: letter };
    runnersUp[letter] = { team: table[1] ? table[1].team : null, row: table[1], group: letter };
    if (table[2]) thirdsAll.push({ group: letter, row: table[2] });
  });

  // Rank all 12 third-place teams: Pts, GD, GF, then name (fair-play not in data)
  thirdsAll.sort(function(a, b){
    var x = a.row, y = b.row;
    if (y.Pts !== x.Pts) return y.Pts - x.Pts;
    if (y.GD  !== x.GD)  return y.GD  - x.GD;
    if (y.GF  !== x.GF)  return y.GF  - x.GF;
    return x.team.localeCompare(y.team);
  });
  var bestThirds = thirdsAll.slice(0, 8);

  return { winners: winners, runnersUp: runnersUp, thirds: thirdsAll, bestThirds: bestThirds };
}

// The deterministic Round of 32 slot map (group winners & runners-up).
// Source: official 2026 R32 schedule. "3rd" = a best third-place team
// from a designated cluster (pool shown, exact team per FIFA scenario).
// Each entry: [home, away] where each side is a descriptor object.
function wcR32Template() {
  function W(g){ return { type:'winner', group:g }; }
  function R(g){ return { type:'runnerup', group:g }; }
  function T(cluster){ return { type:'third', cluster:cluster }; }
  // Based on the published 2026 bracket pathways.
  return [
    { label:'Match 73', home:R('A'), away:R('B') },
    { label:'Match 74', home:W('E'), away:T('ABCDF') },
    { label:'Match 75', home:W('F'), away:R('C') },
    { label:'Match 76', home:W('C'), away:R('F') },
    { label:'Match 77', home:W('I'), away:R('J') },
    { label:'Match 78', home:W('A'), away:T('CDEFG') },
    { label:'Match 79', home:W('L'), away:T('EHIJK') },
    { label:'Match 80', home:W('D'), away:R('G') },
    { label:'Match 81', home:W('G'), away:R('D') },
    { label:'Match 82', home:W('J'), away:R('H') },
    { label:'Match 83', home:W('B'), away:T('EFGIJ') },
    { label:'Match 84', home:W('K'), away:T('DEIJL') },
    { label:'Match 85', home:W('H'), away:R('I') },
    { label:'Match 86', home:R('K'), away:R('L') },
    { label:'Match 87', home:R('E'), away:T('ABCHI') },
    { label:'Match 88', home:W('L'), away:R('K') },
  ];
}

// Resolve a slot descriptor to a display name using live qualifiers.
function wcResolveSlot(desc, qual) {
  if (desc.type === 'winner') {
    var w = qual.winners[desc.group];
    return (w && w.team) ? { name: w.team, decided: true }
                         : { name: 'Winner Group ' + desc.group, decided: false };
  }
  if (desc.type === 'runnerup') {
    var r = qual.runnersUp[desc.group];
    return (r && r.team) ? { name: r.team, decided: true }
                         : { name: 'Runner-up Group ' + desc.group, decided: false };
  }
  // third place: only resolvable once all groups done AND FIFA scenario known
  return { name: '3rd: Group ' + desc.cluster.split('').join('/'), decided: false };
}
