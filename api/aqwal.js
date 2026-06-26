// api/aqwal.js — Aqwāl search backend (REAL records only, zero AI generation).
// Queries your Upstash Vector DB and returns the matching texts with their
// grading + source. Nothing is written by a model, so nothing can be fabricated.
const ORIGIN = "https://moethiago.github.io";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST { question }" });

  const VURL = process.env.UPSTASH_VECTOR_REST_URL;
  const VTOK = process.env.UPSTASH_VECTOR_REST_READONLY_TOKEN || process.env.UPSTASH_VECTOR_REST_TOKEN;
  if (!VURL || !VTOK)
    return res.status(500).json({ error: "Vector DB not configured — add UPSTASH_VECTOR_REST_URL and UPSTASH_VECTOR_REST_READONLY_TOKEN in Vercel, then redeploy." });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const question = (body.question || "").trim();
    if (!question) return res.status(400).json({ error: "Missing question" });

    const r = await fetch(`${VURL}/query-data`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${VTOK}`, "Content-Type": "application/json" },
      body: JSON.stringify({ data: question, topK: 8, includeMetadata: true }),
    });
    const data = await r.json();
    if (!r.ok) return res.status(502).json({ error: "Vector query failed", detail: data });

    const results = (data.result || []).map(m => ({ score: m.score, ...(m.metadata || {}) }));
    const grades = results.reduce((a, x) => { const k = x.grade_class || "other"; a[k] = (a[k] || 0) + 1; return a; }, {});
    return res.status(200).json({ query: question, count: results.length, grades, results });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
