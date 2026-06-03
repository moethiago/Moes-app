// ============================================================
// taste.js — the "AI native" personalization layer.
// Learns implicitly from what you open, builds a taste vector from
// Gemini embeddings, and scores every story for "For You" ranking.
//   personalScore = followMatch*5 + interestKeyword + cosine(taste, story)*10
// All on-device. Pairs with prefs.js (explicit follows).
// ============================================================

var TASTE_KEY = 'moe_taste_v1';

// taste = { vec:[768]|null, n:0, kw:{word:count} }
function loadTaste() {
  try {
    var raw = localStorage.getItem(TASTE_KEY);
    if (raw) return JSON.parse(raw);
  } catch(e) {}
  return { vec: null, n: 0, kw: {} };
}
function saveTaste(t) {
  try { localStorage.setItem(TASTE_KEY, JSON.stringify(t)); } catch(e) {}
}

function cosineSim(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  var dot = 0, na = 0, nb = 0;
  for (var i = 0; i < a.length; i++) { dot += a[i]*b[i]; na += a[i]*a[i]; nb += b[i]*b[i]; }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// Meaningful words from a title (for keyword interests).
function tasteWords(title) {
  var stop = {the:1,and:1,for:1,with:1,new:1,his:1,her:1,out:1,off:1,set:1,via:1,how:1,why:1,who:1,are:1,was:1};
  return (title || '').toLowerCase().replace(/[^a-z0-9 ]/g,' ').split(/\s+/)
    .filter(function(w){ return w.length > 3 && !stop[w]; });
}

// Called when the user opens a story. Updates taste vector + keywords.
function recordClick(story) {
  if (!story) return;
  var t = loadTaste();
  // 1) running-average the embedding into the taste vector
  if (story.emb && story.emb.length) {
    if (!t.vec) { t.vec = story.emb.slice(); t.n = 1; }
    else {
      var n = t.n || 1;
      for (var i = 0; i < t.vec.length; i++) t.vec[i] = (t.vec[i]*n + story.emb[i]) / (n+1);
      t.n = n + 1;
    }
  }
  // 2) keyword interest counts
  tasteWords(story.title).forEach(function(w){ t.kw[w] = (t.kw[w]||0) + 1; });
  saveTaste(t);
}

// Personal score for a story given current taste + explicit follows.
function personalScore(story) {
  var t = loadTaste();
  var score = 0;
  var title = (story.title || '').toLowerCase();

  // explicit follows (strongest signal)
  if (typeof loadPrefs === 'function') {
    var p = loadPrefs();
    var names = [].concat(p.f1Drivers||[], p.footballClubs||[], p.f1Teams||[]);
    names.forEach(function(n){ if (title.indexOf(n.toLowerCase()) !== -1) score += 5; });
  }
  // learned keyword interests
  Object.keys(t.kw).forEach(function(w){ if (title.indexOf(w) !== -1) score += Math.min(2, t.kw[w] * 0.5); });
  // semantic taste match (the magic): cosine to taste vector
  if (t.vec && story.emb) score += Math.max(0, cosineSim(t.vec, story.emb)) * 10;

  return score;
}

// Rank a list of stories by personal score (desc), tie-break by recency.
function rankForYou(stories) {
  return stories.map(function(s){ s._p = personalScore(s); return s; })
    .sort(function(a,b){
      if (b._p !== a._p) return b._p - a._p;
      return (b.pubTs||0) - (a.pubTs||0);
    });
}

// Has the user trained the model at all yet?
function tasteReady() {
  var t = loadTaste();
  return (t.n && t.n > 0) || Object.keys(t.kw).length > 0;
}
