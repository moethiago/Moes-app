// api/aqwal.js — Aqwāl search backend. Queries Upstash Vector and GROUPS the
// chains of the same hadith into one result. Real records only; no AI.
const ORIGIN = "https://moethiago.github.io";
const RANK = { sahih:1, hasan:2, other:3, daif:4, mawdu:5 };

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST { question }" });

  const VURL = process.env.UPSTASH_VECTOR_REST_URL;
  const VTOK = process.env.UPSTASH_VECTOR_REST_READONLY_TOKEN || process.env.UPSTASH_VECTOR_REST_TOKEN;
  if (!VURL || !VTOK) return res.status(500).json({ error: "Vector DB not configured." });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const question = (body.question || "").trim();
    if (!question) return res.status(400).json({ error: "Missing question" });

    const r = await fetch(`${VURL}/query-data`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${VTOK}`, "Content-Type": "application/json" },
      body: JSON.stringify({ data: question, topK: 30, includeMetadata: true }),
    });
    const data = await r.json();
    if (!r.ok) return res.status(502).json({ error: "Vector query failed", detail: data });

    // group chains of the same matn together
    const groups = new Map();
    for (const m of (data.result || [])) {
      const x = m.metadata || {};
      const key = (x.hadith_norm || x.hadith || "").replace(/[.ـ\s]+$/g, "").slice(0, 80);
      if (!key) continue;
      if (!groups.has(key)) groups.set(key, { matn: x.hadith || "", score: m.score, chains: [] });
      const g = groups.get(key);
      if ((x.hadith || "").length > g.matn.length) g.matn = x.hadith;     // keep fullest wording
      if (m.score > g.score) g.score = m.score;
      g.chains.push({
        muhaddith: x.muhaddith || "", grade: x.grade || "", grade_class: x.grade_class || "other",
        rawi: x.rawi || "", source_book: x.source_book || "", ref: x.ref || "", source_url: x.source_url || "",
      });
    }
    const out = [...groups.values()].map(g => {
      g.chains.sort((a, b) => (RANK[a.grade_class] || 9) - (RANK[b.grade_class] || 9));
      g.grade_class = g.chains[0]?.grade_class || "other";   // strongest authentication present
      g.chain_count = g.chains.length;
      return g;
    }).sort((a, b) => b.score - a.score);

    return res.status(200).json({ query: question, count: out.length, groups: out });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
