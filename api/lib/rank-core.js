// ============================================================
// rank-core.js — better news filtering for the feed.
// Adds on top of the existing exact-hash dedup:
//   1) semantic near-duplicate clustering (Jaccard on title tokens)
//   2) cross-source corroboration boost (big stories surface)
//   3) blended ranking: aiScore × sourceWeight × timeDecay × corroboration
// Pure JS, no extra API calls, runs in the feed handler.
// ============================================================

const RANK_STOP = new Set([
  'the','and','for','with','this','that','from','news','about','has','have','are','was','were',
  'will','would','should','could','their','they','them','says','said','after','before','into','over',
  'as','to','of','in','on','at','by','an','a','is','it','be','or','but','not','our','his','her','its',
  'new','more','than','out','off','up','down','set','via','amid','how','why','what','who'
]);

// Normalise a title into a Set of meaningful tokens.
export function tokenSet(title) {
  const toks = (title || '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !RANK_STOP.has(w));
  return new Set(toks);
}

// Jaccard similarity between two token sets (0..1).
export function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

// Entity-aware similarity. Headlines covering the same event share the
// key NAMES even when the verbs/phrasing differ ("Verstappen wins Monaco"
// vs "Max takes victory in Monaco"). We give shared longer tokens (likely
// names/places) extra weight, and also accept a high overlap-coefficient
// (shared / smaller set) which catches short rewrites Jaccard misses.
export function titleSimilarity(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0, interWeight = 0, aw = 0, bw = 0;
  const w = t => (t.length >= 6 ? 2 : 1); // long tokens ~ proper nouns
  for (const t of a) { aw += w(t); if (b.has(t)) { inter++; interWeight += w(t); } }
  for (const t of b) bw += w(t);
  const weightedJaccard = interWeight / (aw + bw - interWeight);
  const overlapCoef = inter / Math.min(a.size, b.size); // shared / smaller
  return Math.max(weightedJaccard, overlapCoef * 0.85);
}

// Cluster near-duplicate stories. Stories with Jaccard >= threshold
// on their titles are grouped. Returns array of clusters (each an
// array of the original story objects).
export function clusterStories(stories, threshold = 0.5) {
  const withTokens = stories.map(s => ({ s, tok: tokenSet(s.title) }));
  const clusters = [];
  for (const item of withTokens) {
    let placed = false;
    for (const c of clusters) {
      // compare against the cluster's representative (first item)
      if (titleSimilarity(item.tok, c.repTok) >= threshold) {
        c.items.push(item.s);
        placed = true;
        break;
      }
    }
    if (!placed) clusters.push({ repTok: item.tok, items: [item.s] });
  }
  return clusters.map(c => c.items);
}

// Pick the representative of a cluster: highest source weight, then earliest.
export function pickRepresentative(cluster, sourceWeightOf) {
  return cluster.slice().sort((a, b) => {
    const wa = sourceWeightOf(a), wb = sourceWeightOf(b);
    if (wb !== wa) return wb - wa;             // higher authority first
    return (a.publishedAt || 0) - (b.publishedAt || 0); // earliest first
  })[0];
}

// Time decay: 1.0 now, halves every `halfLifeH` hours.
export function timeDecay(publishedAtSec, halfLifeH = 8) {
  const ageH = (Date.now() / 1000 - (publishedAtSec || 0)) / 3600;
  if (ageH <= 0) return 1;
  return Math.pow(0.5, ageH / halfLifeH);
}

// Blended final rank for a representative story.
//   aiScore       : 0..10 editorial score
//   sourceWeight  : 1..10 from sources.js
//   corroboration : number of distinct sources covering the cluster
export function blendedRank(story, sourceWeight, corroboration) {
  const ai    = (story.score || 0) / 10;                  // 0..1
  const src   = (sourceWeight || 5) / 10;                 // 0..1
  const decay = timeDecay(story.publishedAt);             // 0..1
  // corroboration boost: 1 source = 1.0, 2 = 1.25, 3 = 1.4, capped ~1.6
  const corr  = 1 + Math.min(0.6, Math.log2(Math.max(1, corroboration)) * 0.25);
  return ai * (0.5 + 0.5 * src) * decay * corr;
}

// Full pipeline: take scored stories + a source-weight lookup, return
// deduped + ranked list. Each returned story gets _corroboration and _rank.
// If stories carry an `embedding` field, clustering uses real cosine
// similarity (accurate); otherwise it falls back to title-token similarity.
export function rankFeed(stories, sourceWeightOf, opts = {}) {
  const simThreshold = opts.simThreshold ?? 0.5;
  const cosThreshold = opts.cosThreshold ?? 0.85;
  const haveEmbeddings = stories.some(s => Array.isArray(s.embedding));

  let clusters;
  if (haveEmbeddings && typeof opts.clusterByEmbedding === 'function') {
    clusters = opts.clusterByEmbedding(stories, cosThreshold);
  } else {
    clusters = clusterStories(stories, simThreshold);
  }

  const out = [];
  for (const cluster of clusters) {
    const rep = pickRepresentative(cluster, sourceWeightOf);
    const sources = new Set(cluster.map(s => s.sourceUrl || s.sourceCat));
    rep._corroboration = sources.size;
    rep._clusterSize = cluster.length;
    rep._rank = blendedRank(rep, sourceWeightOf(rep), sources.size);
    out.push(rep);
  }
  out.sort((a, b) => b._rank - a._rank);
  return out;
}
