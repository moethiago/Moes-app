// ============================================================
// f1-story.js — auto-generated season narrative, rivalry tracker,
// records watch. All from Jolpica (free), works any time.
// Renders into #f1-story (placed near top of F1 tab).
// ============================================================

var JOL_STORY = 'https://api.jolpi.ca/ergast/f1';

function storyFetch(path, ms) {
  return new Promise(function(resolve) {
    var done = false;
    var t = setTimeout(function(){ if(!done){done=true;resolve(null);} }, ms || 7000);
    fetch(JOL_STORY + path).then(function(r){
      if(done) return; done=true; clearTimeout(t);
      if(!r.ok){resolve(null);return;}
      r.json().then(resolve).catch(function(){resolve(null);});
    }).catch(function(){ if(!done){done=true;clearTimeout(t);resolve(null);} });
  });
}

async function loadF1Story() {
  var root = document.getElementById('f1-story');
  if (!root) return;
  root.innerHTML = '<div class="f1-api-loading"><div class="f1-spinner"></div><span>Reading the season...</span></div>';

  var sd = await storyFetch('/current/driverstandings.json?limit=30', 7000);
  var sl = sd && sd.MRData && sd.MRData.StandingsTable && sd.MRData.StandingsTable.StandingsLists[0];
  if (!sl) { root.innerHTML = ''; return; }

  var round = parseInt(sl.round);
  var ds = sl.DriverStandings;
  var leader = ds[0];
  var lname = leader.Driver.givenName + ' ' + leader.Driver.familyName;
  var lwins = parseInt(leader.wins);
  var lpts = parseFloat(leader.points);
  var p2 = ds[1];
  var gap = p2 ? (lpts - parseFloat(p2.points)).toFixed(0) : 0;

  // last race winner
  var lr = await storyFetch('/current/last/results.json?limit=1', 6000);
  var lastRace = lr && lr.MRData && lr.MRData.RaceTable && lr.MRData.RaceTable.Races[0];
  var lastWinner = lastRace && lastRace.Results && lastRace.Results[0];

  // Build narrative
  var story = '';
  story += '<strong>' + lname + '</strong> leads the 2026 championship after ' + round + ' round' + (round>1?'s':'');
  story += ' with <strong>' + lpts + ' points</strong>';
  if (lwins > 0) story += ' and ' + lwins + ' win' + (lwins>1?'s':'');
  story += '. ';
  if (p2) {
    var p2name = p2.Driver.familyName;
    if (gap <= 10) story += 'But ' + p2name + ' is right behind — just ' + gap + ' points back. The title fight is alive.';
    else if (gap <= 40) story += p2name + ' trails by ' + gap + ', keeping the pressure on.';
    else story += 'A commanding ' + gap + '-point lead over ' + p2name + ' — this is turning into a statement season.';
  }
  if (lastWinner) {
    story += ' Most recently, <strong>' + lastWinner.Driver.familyName + '</strong> took victory at the ' + lastRace.raceName.replace(' Grand Prix','') + ' GP.';
  }

  var html = '<div class="f1a-card f1-story-card"><div class="f1a-h">\u{1F4D6} The Season So Far</div>'
    + '<div class="f1-story-text">' + story + '</div></div>';

  // Rivalry tracker — top 2 visual
  if (p2) {
    var n1 = leader.Driver.familyName, n2 = p2.Driver.familyName;
    var p1c = (leader.Constructors && leader.Constructors[0] && leader.Constructors[0].constructorId) || 'default';
    var p2c = (p2.Constructors && p2.Constructors[0] && p2.Constructors[0].constructorId) || 'default';
    var c1 = (typeof TEAM_COLORS !== 'undefined' && TEAM_COLORS[p1c]) || '#4f9cf9';
    var c2 = (typeof TEAM_COLORS !== 'undefined' && TEAM_COLORS[p2c]) || '#f87171';
    var tot = lpts + parseFloat(p2.points) || 1;
    var w1 = Math.round((lpts/tot)*100);
    html += '<div class="f1a-card"><div class="f1a-h">\u{1F525} Title Fight</div>'
      + '<div class="f1-rivalry">'
      + '<div class="f1-riv-side"><div class="f1-riv-name" style="color:' + c1 + '">' + n1 + '</div><div class="f1-riv-pts">' + lpts + '</div></div>'
      + '<div class="f1-riv-vs">vs</div>'
      + '<div class="f1-riv-side" style="text-align:right"><div class="f1-riv-name" style="color:' + c2 + '">' + n2 + '</div><div class="f1-riv-pts">' + p2.points + '</div></div>'
      + '</div>'
      + '<div class="f1-riv-bar"><div class="f1-riv-fill-l" style="width:' + w1 + '%;background:' + c1 + '"></div><div class="f1-riv-fill-r" style="width:' + (100-w1) + '%;background:' + c2 + '"></div></div>'
      + '<div class="f1a-sub" style="text-align:center">' + n1 + ' leads by ' + gap + ' points</div>'
      + '</div>';
  }

  // Records watch — milestones approaching
  var milestones = [];
  ds.slice(0,5).forEach(function(d) {
    var wins = parseInt(d.wins);
    var name = d.Driver.familyName;
    if (wins === 9)  milestones.push(name + ' is 1 win from double digits this season');
    if (wins >= 5 && wins <= 8) milestones.push(name + ' has ' + wins + ' wins — on a championship-calibre run');
  });
  if (milestones.length) {
    html += '<div class="f1a-card"><div class="f1a-h">\u{1F4CC} Records Watch</div>';
    milestones.forEach(function(m){ html += '<div class="f1-milestone">\u2022 ' + m + '</div>'; });
    html += '</div>';
  }

  root.innerHTML = html;
}
