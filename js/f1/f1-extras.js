// ============================================================
// f1-extras.js — what-changed, streaks, silly-season, quali H2H,
// gap-in-races, championship permutations.
// Features 6, 7, 8, 9, 12, 18. Renders into #f1-extras.
// ============================================================

var JOL_X = 'https://api.jolpi.ca/ergast/f1';

function xFetch(path, ms) {
  return new Promise(function(resolve) {
    var done = false;
    var t = setTimeout(function(){ if(!done){done=true;resolve(null);} }, ms || 7000);
    fetch(JOL_X + path).then(function(r){
      if(done) return; done=true; clearTimeout(t);
      if(!r.ok){resolve(null);return;}
      r.json().then(resolve).catch(function(){resolve(null);});
    }).catch(function(){ if(!done){done=true;clearTimeout(t);resolve(null);} });
  });
}

async function loadF1Extras() {
  var root = document.getElementById('f1-extras');
  if (!root) return;
  root.innerHTML = '<div id="f1x-async"></div>';
  renderWhatChanged();
  renderGapAndPermutations();
  renderStreaks();
  renderSillySeason();
}

function xAppend(html){ var c=document.getElementById('f1x-async'); if(c) c.insertAdjacentHTML('beforeend', html); }

// ---- 6: WHAT CHANGED since last visit ----
async function renderWhatChanged() {
  var data = await xFetch('/current/driverstandings.json?limit=1', 6000);
  var sl = data && data.MRData && data.MRData.StandingsTable && data.MRData.StandingsTable.StandingsLists[0];
  if (!sl) return;
  var round = parseInt(sl.round);
  var leader = sl.DriverStandings[0].Driver.familyName;
  var key = 'f1_lastseen';
  var prev = null;
  try { prev = JSON.parse(localStorage.getItem(key)); } catch(e){}
  try { localStorage.setItem(key, JSON.stringify({ round: round, leader: leader })); } catch(e){}
  if (!prev) return; // first visit, nothing to compare
  var changes = [];
  if (prev.round !== round) changes.push('New result in: now after Round ' + round + '.');
  if (prev.leader !== leader) changes.push('Championship lead changed \u2014 ' + leader + ' now leads.');
  if (!changes.length) return;
  var html = '<div class="f1a-card f1x-changed"><div class="f1a-h">\u{1F195} Since you last looked</div>';
  changes.forEach(function(c){ html += '<div class="f1x-change">\u2022 ' + c + '</div>'; });
  html += '</div>';
  xAppend(html);
}

// ---- 12 + 18: GAP IN RACES + PERMUTATIONS ----
async function renderGapAndPermutations() {
  var data = await xFetch('/current/driverstandings.json?limit=3', 6000);
  var sl = data && data.MRData && data.MRData.StandingsTable && data.MRData.StandingsTable.StandingsLists[0];
  if (!sl || sl.DriverStandings.length < 2) return;
  var round = parseInt(sl.round);
  var TOTAL_ROUNDS = (typeof F1_CALENDAR !== 'undefined') ? F1_CALENDAR.length : 24;
  var roundsLeft = Math.max(0, TOTAL_ROUNDS - round);
  var maxPerRound = 25;            // win = 25 (sprint points extra, ignored for a clean bound)
  var ptsAvailable = roundsLeft * maxPerRound;

  var leader = sl.DriverStandings[0];
  var p2 = sl.DriverStandings[1];
  var lp = parseFloat(leader.points), pp = parseFloat(p2.points);
  var gap = lp - pp;
  var ln = leader.Driver.familyName, p2n = p2.Driver.familyName;

  var html = '<div class="f1a-card"><div class="f1a-h">\u{1F4D0} Title Picture \u00b7 after R' + round + '</div>'
    + '<div class="f1x-line"><strong>' + ln + '</strong> leads by <strong>' + gap + '</strong> pts</div>'
    + '<div class="f1x-line">' + roundsLeft + ' rounds left \u00b7 <strong>' + ptsAvailable + '</strong> pts still available</div>';

  if (roundsLeft === 0) {
    html += '<div class="f1x-perm">Season complete \u2014 ' + ln + ' is champion.</div>';
  } else if (gap > ptsAvailable) {
    html += '<div class="f1x-perm">' + ln + ' has clinched: even a perfect run can\u2019t let ' + p2n + ' catch up.</div>';
  } else {
    // exact swing P2 needs: must outscore leader by (gap+1) across remaining rounds
    var swingNeeded = gap + 1;
    var perRound = (swingNeeded / roundsLeft);
    html += '<div class="f1x-perm">' + p2n + ' must outscore ' + ln + ' by <strong>' + swingNeeded + '</strong> pts over the final ' + roundsLeft + ' rounds (avg +' + perRound.toFixed(1) + '/race) to take the lead.</div>';
  }
  html += '</div>';
  xAppend(html);
}

// ---- 8: STREAKS (podium/points streaks from last races) ----
async function renderStreaks() {
  var sd = await xFetch('/current/driverstandings.json?limit=5', 6000);
  var sl = sd && sd.MRData && sd.MRData.StandingsTable && sd.MRData.StandingsTable.StandingsLists[0];
  if (!sl) return;
  var round = parseInt(sl.round);
  var start = Math.max(1, round - 5);
  var reqs = [];
  for (var r = start; r <= round; r++) reqs.push(xFetch('/current/' + r + '/results.json?limit=30', 6000));
  var races = await Promise.all(reqs);
  var byDriver = {}; // id -> [pos in chrono]
  var nameOf = {};
  races.forEach(function(rd){
    var race = rd && rd.MRData && rd.MRData.RaceTable && rd.MRData.RaceTable.Races[0];
    if (!race || !race.Results) return;
    race.Results.forEach(function(res){
      var id = res.Driver.driverId; nameOf[id] = res.Driver.familyName;
      (byDriver[id] = byDriver[id] || []).push(parseInt(res.position));
    });
  });
  var streaks = [];
  Object.keys(byDriver).forEach(function(id){
    var arr = byDriver[id];
    // count trailing podiums and points from most recent backwards
    var pod = 0, pts = 0, brokePod = false, brokePts = false;
    for (var i = arr.length - 1; i >= 0; i--) {
      if (!brokePod && arr[i] <= 3) pod++; else brokePod = true;
      if (!brokePts && arr[i] <= 10) pts++; else brokePts = true;
    }
    if (pod >= 2) streaks.push({ name: nameOf[id], txt: pod + ' straight podiums', n: pod, kind:'pod' });
    else if (pts >= 3) streaks.push({ name: nameOf[id], txt: pts + ' straight points finishes', n: pts, kind:'pts' });
  });
  if (!streaks.length) return;
  streaks.sort(function(a,b){ return b.n - a.n; });
  var html = '<div class="f1a-card"><div class="f1a-h">\u{1F525} Hot Streaks</div>';
  streaks.slice(0,5).forEach(function(s){
    var col = (typeof driverColor === 'function') ? driverColor(s.name) : '#fff';
    html += '<div class="f1x-streak"><span class="f1a-name" style="color:' + col + '">' + s.name + '</span><span class="f1x-streak-txt">' + s.txt + '</span></div>';
  });
  html += '</div>';
  xAppend(html);
}

// ---- 7: SILLY SEASON / CONTRACT BOARD ----
function renderSillySeason() {
  if (typeof F1_CONTRACTS_2027 === 'undefined') return;
  var confirmed = F1_CONTRACTS_2027.filter(function(c){ return c.status === 'confirmed'; });
  var expiring  = F1_CONTRACTS_2027.filter(function(c){ return c.status === 'expiring'; });
  var html = '<div class="f1a-card"><div class="f1a-h">\u{1F4DD} 2027 Silly Season</div>'
    + '<div class="f1a-sub">' + confirmed.length + ' confirmed \u00b7 ' + expiring.length + ' seats in question</div>';
  if (expiring.length) {
    html += '<div class="f1x-silly-label">Up in the air</div>';
    expiring.forEach(function(c){
      var col = (typeof TEAM_COLORS !== 'undefined' && TEAM_COLORS[c.team]) || '#8a8fa8';
      html += '<div class="f1x-silly-row"><span class="f1a-name" style="color:' + col + '">' + c.driver + '</span>'
        + (typeof teamLogo === 'function' ? teamLogo(c.team) : '')
        + '<span class="f1x-silly-status expiring">EXPIRING</span></div>';
    });
  }
  html += '</div>';
  xAppend(html);
}
