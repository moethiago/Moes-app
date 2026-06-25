// api/aqwal.js  —  Aqwāl backend (Vercel serverless function)
// Holds your API key server-side and returns scholarly positions as JSON.
// Frontend calls this with POST { question }.
//
// Requires env var ANTHROPIC_API_KEY in your Vercel project
// (Settings → Environment Variables — the same one Moe's App uses).

const ALLOWED_ORIGIN = "https://moethiago.github.io"; // your GitHub Pages origin

export default async function handler(req, res) {
  // ── CORS (GitHub Pages → Vercel is cross-origin) ──
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Use POST with { question }." });

  try {
    const body =
      typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const question = (body.question || "").trim();
    if (!question) return res.status(400).json({ error: "Missing question." });

    const system =
      `You are a research aid for a tool that compares the RANGE of documented Islamic ` +
      `scholarly opinion on a question. Return ONLY valid JSON — no markdown, no preamble — ` +
      `matching exactly:\n` +
      `{"arabic": string, "overview": string, "positions": [{"name": string, "arabic": string, ` +
      `"era": string, "stance": "impermissible"|"conditional"|"permissible", "summary": string, ` +
      `"confidence": "documented"|"uncertain"}]}\n` +
      `Rules:\n` +
      `- "arabic" (top level) = the user's question translated to Arabic.\n` +
      `- Each position "arabic" = that scholar's name in Arabic script.\n` +
      `- Summarize only well-known, documented positions. NEVER invent verbatim quotes.\n` +
      `- If unsure a named scholar actually held a view, set "confidence":"uncertain".\n` +
      `- Do NOT include source URLs (you cannot verify them; the grounded version adds real ones).\n` +
      `- Cover the spectrum evenhandedly across schools and eras. 3–6 positions.\n` +
      `- Each "summary" is 1–2 neutral sentences. This is a research aid, not a fatwa.`;

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1500,
        system,
        messages: [{ role: "user", content: `Question: ${question}` }],
      }),
    });

    const data = await r.json();
    if (!r.ok) return res.status(502).json({ error: "Model error", detail: data });

    const text = (data.content || []).map((b) => b.text || "").join("");
    const clean = text.replace(/```json|```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch {
      // last-resort: grab the outermost {...} block
      const m = clean.match(/\{[\s\S]*\}/);
      if (!m) return res.status(502).json({ error: "Model did not return JSON", raw: text });
      parsed = JSON.parse(m[0]);
    }

    return res.status(200).json(parsed);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}