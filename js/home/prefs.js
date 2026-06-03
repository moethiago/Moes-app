// ============================================================
// prefs.js — what Moaath follows (teams, drivers), stored on device.
// Drives the personalized Home, the daily brief, and notifications.
// Uses localStorage (real site, persists across sessions).
// ============================================================

var PREFS_KEY = 'moe_prefs_v1';

// Default follows, seeded from known interests; user can edit in Home.
var DEFAULT_PREFS = {
  f1Drivers:   ['Leclerc', 'Hamilton'],      // Ferrari fan default
  f1Teams:     ['ferrari'],
  footballClubs: ['Bayern', 'Al-Hilal'],
  watchWorldCupTeam: 'Saudi Arabia',
  briefDismissedOn: null,                     // date string of last dismissal
};

function loadPrefs() {
  try {
    var raw = localStorage.getItem(PREFS_KEY);
    if (raw) return Object.assign({}, DEFAULT_PREFS, JSON.parse(raw));
  } catch (e) {}
  return Object.assign({}, DEFAULT_PREFS);
}

function savePrefs(p) {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch (e) {}
}

function toggleFollow(listKey, value) {
  var p = loadPrefs();
  var arr = p[listKey] || [];
  var i = arr.indexOf(value);
  if (i === -1) arr.push(value); else arr.splice(i, 1);
  p[listKey] = arr;
  savePrefs(p);
  return p;
}

function isFollowing(listKey, value) {
  var p = loadPrefs();
  return (p[listKey] || []).indexOf(value) !== -1;
}

// Does a news story match anything the user follows? (name match, case-insensitive)
function storyMatchesFollows(story) {
  var p = loadPrefs();
  var hay = (story.title || '').toLowerCase();
  var names = [].concat(p.f1Drivers || [], p.footballClubs || []);
  return names.some(function(n){ return hay.indexOf(n.toLowerCase()) !== -1; });
}
