// ============================================================
// taste.js — AI-native personalization by STORY TYPE.
// No follows, no buttons. The app classifies each story into a
// type (transfer, result, contract, preview, injury, opinion...)
// and learns silently from what you OPEN vs what you SKIP.
// Types you engage with rise; types you ignore fade.
// ============================================================

var TASTE_KEY = 'moe_taste_v2';

// Story types we recognise, with keyword signatures.
var STORY_TYPES = {
  transfer:  ['transfer','signs','signing','joins','move','deal','agree','agreement','fee','bid','loan','target','linked','swoop','poised to join','set to join'],
  contract:  ['contract','extends','extension','renew','new deal','long-term','multi-year','stays','commits','tie down'],
  result:    ['win','wins','beat','beats','victory','defeat','loss','draw','thrash','held','score','final score','full-time','result','triumph'],
  injury:    ['injury','injured','out for','sidelined','ruled out','fitness','doubt','strain','surgery','recovery','return from'],
  preview:   ['preview','how to watch','tv times','viewing guide','prediction','predicted','line-ups','what time','ahead of','build-up','to watch'],
  lineup:    ['line-up','lineup','starting xi','team news','squad','named','selection','bench','rotation'],
  manager:   ['manager','sack','sacked','appoint','appointed','hire','hired','coach','boss','dismiss','step down','resign'],
  opinion:   ['opinion','analysis','column','verdict','why','how','explained','view','debate','rating','ranked'],
  business:  ['takeover','investment','sponsor','revenue','wages','financial','sold','buy','owner','stake','valuation'],
  result_f1: ['pole','grand prix','qualifying','podium','fastest lap','race win','dnf','grid','practice','sprint'],
};

// taste = { type:{transfer:score,...}, opens:n, skips:n }
function loadTaste() {
  try { var raw = localStorage.getItem(TASTE_KEY); if (raw) return JSON.parse(raw); } catch(e) {}
  return { type: {}, opens: 0, skips: 0 };
}
function saveTaste(t) { try { localStorage.setItem(TASTE_KEY, JSON.stringify(t)); } catch(e) {} }

// Classify a story into one or more types from its title.
function classifyStory(story) {
  var title = (story.title || '').toLowerCase();
  var hits = [];
  Object.keys(STORY_TYPES).forEach(function(type){
    var kws = STORY_TYPES[type];
    for (var i = 0; i < kws.length; i++) {
      if (title.indexOf(kws[i]) !== -1) { hits.push(type); break; }
    }
  });
  return hits; // may be empty (general news)
}

// OPEN = strong positive signal for that story's type(s).
function recordOpen(story) {
  var t = loadTaste();
  classifyStory(story).forEach(function(type){ t.type[type] = (t.type[type] || 0) + 1; });
  t.opens = (t.opens || 0) + 1;
  saveTaste(t);
}

// SKIP = the story was shown near the top but NOT opened (mild negative).
// Called for the visible top stories the user scrolled past without tapping.
function recordSkips(shownStories, openedTitle) {
  var t = loadTaste();
  shownStories.forEach(function(s){
    if (openedTitle && s.title === openedTitle) return;
    classifyStory(s).forEach(function(type){
      t.type[type] = (t.type[type] || 0) - 0.15; // gentle decay
    });
  });
  t.skips = (t.skips || 0) + 1;
  saveTaste(t);
}

// Type-affinity score for a story: sum of learned scores of its types.
function typeScore(story) {
  var t = loadTaste();
  var types = classifyStory(story);
  if (!types.length) return 0;
  var s = 0;
  types.forEach(function(type){ s += (t.type[type] || 0); });
  return s / types.length; // average so multi-type stories aren't over-boosted
}

// Has the app learned anything yet?
function tasteReady() {
  var t = loadTaste();
  return (t.opens || 0) >= 3;
}

// Human-readable summary of what the app has learned (for the UI).
function tasteSummary() {
  var t = loadTaste();
  var entries = Object.keys(t.type).map(function(k){ return { type:k, n:t.type[k] }; })
    .filter(function(e){ return e.n > 0; })
    .sort(function(a,b){ return b.n - a.n; });
  var labels = { transfer:'transfers', contract:'contracts', result:'results', injury:'injury news',
    preview:'previews', lineup:'team news', manager:'manager moves', opinion:'analysis',
    business:'business', result_f1:'race weekends' };
  return entries.slice(0, 3).map(function(e){ return labels[e.type] || e.type; });
}
