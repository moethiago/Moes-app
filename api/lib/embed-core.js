// ============================================================
// embed-core.js — semantic embeddings via Google Gemini (free tier:
// ~1500 req/day, no card). Used for real near-duplicate detection.
// Set GEMINI_API_KEY in the backend env. Degrades gracefully to
// title-token similarity (rank-core) if the key/API is unavailable.
// ============================================================

const GEMINI_EMBED_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent';

// Embed a single text. Returns number[] or null on failure.
export async function embedText(text, apiKey) {
  if (!apiKey || !text) return null;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(GEMINI_EMBED_URL + '?key=' + apiKey, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        model: 'models/gemini-embedding-001',
        content: { parts: [{ text }] },
        // smaller dims = cheaper storage, plenty for short-headline dedup
        outputDimensionality: 768,
        taskType: 'SEMANTIC_SIMILARITY',
      }),
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    const vec = data?.embedding?.values;
    return Array.isArray(vec) ? vec : null;
  } catch (e) {
    return null;
  }
}

// Embed several texts. Sequential with a tiny gap to respect rate limits;
// counts are small per ingest cycle. Returns array aligned to input (null on miss).
export async function embedBatch(texts, apiKey) {
  const out = [];
  for (const t of texts) {
    out.push(await embedText(t, apiKey));
  }
  return out;
}

export function cosine(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// Cluster stories by embedding cosine similarity. Stories must carry
// an `embedding` field (number[]). Stories without one fall back to
// being treated as their own cluster (handled by caller's text dedup).
export function clusterByEmbedding(stories, threshold = 0.85) {
  const clusters = [];
  for (const s of stories) {
    if (!s.embedding) { clusters.push([s]); continue; }
    let placed = false;
    for (const c of clusters) {
      const rep = c.find(x => x.embedding);
      if (rep && cosine(s.embedding, rep.embedding) >= threshold) {
        c.push(s); placed = true; break;
      }
    }
    if (!placed) clusters.push([s]);
  }
  return clusters;
}
