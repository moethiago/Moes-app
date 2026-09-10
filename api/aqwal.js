// api/aqwal.js — Aqwāl search backend. Queries Upstash Vector and GROUPS the
// chains of the same hadith into one result. Real records only; no AI.
const ORIGIN = "https://moethiago.github.io";
const RANK = { sahih:1, hasan:2, other:3, daif:4, mawdu:5 };

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Pin");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST { question }" });
  {
    // Moe's Thoughts shares this function — routed by body.app === "thoughts"
    let b = {};
    try { b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {}); } catch {}
    if (b.app === "thoughts" || (req.query && req.query.app === "thoughts")) return thoughtsHandler(req, res, b);
  }

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


// ---- Moe's Thoughts backend — routed by body.app === "thoughts", folded in for the 12-function limit ----
// Actions: capture | write | process | list | get | search | update | delete | evolve | book | usage
// Env: KV_REST_API_URL, KV_REST_API_TOKEN, ANTHROPIC_API_KEY, GEMINI_API_KEY, (optional) GROQ_API_KEY,
//      THOUGHTS_PIN (default: last 4 of DEPLOY_SECRET), THOUGHTS_BUDGET_SAR (default 10), THOUGHTS_MODEL, THOUGHTS_BOOK_MODEL
// Storage: thoughts:index (summaries) · thoughts:t:<id> (full) · thoughts:vecs (hash id→int8 embedding)
//          thoughts:audio:<id>:<n> (pending audio, deleted after transcription) · thoughts:queue · thoughts:usage:<month>

const T_KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const T_KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const T_ANTHROPIC = process.env.ANTHROPIC_API_KEY;
const T_GEMINI = process.env.GEMINI_API_KEY;
const T_GROQ = process.env.GROQ_API_KEY;
const T_PIN = (process.env.THOUGHTS_PIN || (process.env.DEPLOY_SECRET || "").slice(-4)).trim();
const T_MODEL = process.env.THOUGHTS_MODEL || "claude-haiku-4-5-20251001";
const T_BOOK_MODEL = process.env.THOUGHTS_BOOK_MODEL || "claude-sonnet-5";
const T_BUDGET_SAR = Number(process.env.THOUGHTS_BUDGET_SAR || 10);
const T_PRICE = { "claude-haiku-4-5-20251001": [1, 5], "claude-sonnet-5": [3, 15], "claude-opus-5": [15, 75] };
const T_SAR = 3.75;
const T_DIMS = 256;
const T_INDEX = "thoughts:index", T_VECS = "thoughts:vecs", T_QUEUE = "thoughts:queue", T_LOCK = "thoughts:lock";
const T_THEMES = ["ambition", "fear", "relationships", "marriage", "family", "life", "purpose", "leadership", "failure", "success", "people", "time", "money", "courage", "learning", "change", "work", "faith", "health", "habits", "decisions", "identity", "patience", "happiness"];

/* ---------------- storage ---------------- */
async function tkv(cmd) {
  const r = await fetch(T_KV_URL, { method: "POST", headers: { Authorization: "Bearer " + T_KV_TOKEN, "Content-Type": "application/json" }, body: JSON.stringify(cmd) });
  const j = await r.json();
  if (j.error) throw new Error("kv: " + j.error);
  return j.result;
}
function tMonth() { return "thoughts:usage:" + new Date().toISOString().slice(0, 7); }
async function tUsage() {
  const raw = await tkv(["HGETALL", tMonth()]);
  const u = { calls: 0, usd: 0, transcribed: 0, analyzed: 0 };
  if (Array.isArray(raw)) for (let i = 0; i < raw.length; i += 2) u[raw[i]] = Number(raw[i + 1]) || 0;
  u.sar = Math.round(u.usd * T_SAR * 100) / 100;
  u.budget = T_BUDGET_SAR;
  u.model = T_MODEL;
  u.transcriber = T_GROQ ? "groq" : (T_GEMINI ? "gemini" : "none");
  return u;
}
async function tBump(field, n) { try { await tkv(["HINCRBY", tMonth(), field, String(n)]); } catch {} }
async function tIndex() { const raw = await tkv(["GET", T_INDEX]); if (!raw) return []; try { return JSON.parse(raw); } catch { return []; } }
async function tSaveIndex(list) { await tkv(["SET", T_INDEX, JSON.stringify(list)]); }
async function tGet(id) { const raw = await tkv(["GET", "thoughts:t:" + id]); if (!raw) return null; try { return JSON.parse(raw); } catch { return null; } }
async function tPut(t) { await tkv(["SET", "thoughts:t:" + t.id, JSON.stringify(t)]); }
function tSummary(t) {
  return { id: t.id, ts: t.ts, status: t.status, mode: t.mode, duration: t.duration || 0, title: t.title || "", key_idea: t.key_idea || "",
    quote: t.quote || null, lesson: t.lesson || null, kinds: t.kinds || [], themes: t.themes || [], source: t.source || null, book: !!t.book, said_before: !!t.said_before,
    preview: (t.transcript || "").slice(0, 140) };
}
async function tUpsertIndex(t) {
  const list = await tIndex();
  const i = list.findIndex((x) => x.id === t.id);
  const s = tSummary(t);
  if (i >= 0) list[i] = s; else list.push(s);
  list.sort((a, b) => a.ts - b.ts);
  await tSaveIndex(list);
  return list;
}
function tId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

/* ---------------- embeddings (Gemini, free) ---------------- */
async function tEmbed(text) {
  if (!T_GEMINI) return null;
  const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent", {
    method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": T_GEMINI },
    body: JSON.stringify({ content: { parts: [{ text: String(text).slice(0, 8000) }] }, taskType: "SEMANTIC_SIMILARITY", outputDimensionality: T_DIMS }),
  });
  const j = await r.json();
  const v = j.embedding && j.embedding.values;
  if (!Array.isArray(v)) throw new Error("embed: " + JSON.stringify(j).slice(0, 200));
  const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / n);
}
function tPack(v) { const b = Buffer.alloc(v.length); for (let i = 0; i < v.length; i++) b[i] = Math.max(-127, Math.min(127, Math.round(v[i] * 127))) + 128; return b.toString("base64"); }
function tUnpack(s) { const b = Buffer.from(s, "base64"); const v = new Array(b.length); for (let i = 0; i < b.length; i++) v[i] = (b[i] - 128) / 127; return v; }
function tDot(a, b) { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; }
async function tAllVecs() {
  const raw = await tkv(["HGETALL", T_VECS]);
  const out = {};
  if (Array.isArray(raw)) for (let i = 0; i < raw.length; i += 2) out[raw[i]] = tUnpack(raw[i + 1]);
  return out;
}
async function tSimilar(vec, excludeId, topK, minScore) {
  const vecs = await tAllVecs();
  const scored = [];
  for (const id in vecs) { if (id === excludeId) continue; const s = tDot(vec, vecs[id]); if (s >= (minScore || 0)) scored.push({ id, score: Math.round(s * 1000) / 1000 }); }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK || 8);
}

/* ---------------- transcription ---------------- */
async function tReadAudio(id) {
  const meta = await tkv(["GET", "thoughts:audio:" + id + ":meta"]);
  if (!meta) return null;
  const m = JSON.parse(meta);
  const parts = [];
  for (let i = 0; i < m.n; i++) { const p = await tkv(["GET", "thoughts:audio:" + id + ":" + i]); if (p == null) throw new Error("audio chunk missing " + i); parts.push(p); }
  return { mime: m.mime, b64: parts.join("") };
}
async function tDeleteAudio(id) {
  const meta = await tkv(["GET", "thoughts:audio:" + id + ":meta"]);
  if (!meta) return;
  const m = JSON.parse(meta);
  const keys = ["thoughts:audio:" + id + ":meta"];
  for (let i = 0; i < m.n; i++) keys.push("thoughts:audio:" + id + ":" + i);
  await tkv(["DEL", ...keys]);
}
async function tTranscribe(mime, b64) {
  const buf = Buffer.from(b64, "base64");
  if (T_GROQ) {
    const ext = /webm/.test(mime) ? "webm" : (/ogg/.test(mime) ? "ogg" : (/wav/.test(mime) ? "wav" : "m4a"));
    const fd = new FormData();
    fd.append("file", new Blob([buf], { type: mime }), "thought." + ext);
    fd.append("model", "whisper-large-v3-turbo");
    fd.append("language", "en");
    fd.append("response_format", "json");
    fd.append("temperature", "0");
    fd.append("prompt", "Personal reflections, ideas and lessons, spoken casually.");
    const r = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", { method: "POST", headers: { Authorization: "Bearer " + T_GROQ }, body: fd });
    const j = await r.json();
    if (!r.ok) throw new Error("groq: " + (j.error && j.error.message ? j.error.message : r.status));
    return { text: String(j.text || "").trim(), engine: "groq" };
  }
  if (T_GEMINI) {
    const mt = /mp4|m4a|aac/.test(mime) ? "video/mp4" : mime;   // Gemini reads the audio track of an mp4 container
    let last = "";
    let models = [process.env.THOUGHTS_GEMINI_MODEL, "gemini-3.6-flash", "gemini-flash-latest"].filter(Boolean);
    try {   // ask Gemini which flash models exist right now, newest first
      const lr = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", { headers: { "x-goog-api-key": T_GEMINI } });
      const lj = await lr.json();
      const names = (lj.models || []).map((m) => String(m.name || "").replace(/^models\//, ""))
        .filter((n) => /flash/.test(n) && !/lite|image|tts|live|audio|embedding|8b|preview|exp/.test(n) && (lj.models.find((m) => m.name === "models/" + n).supportedGenerationMethods || []).includes("generateContent"))
        .sort().reverse();
      models = [...new Set([...models, ...names])];
    } catch {}
    for (const model of models.slice(0, 4)) {
      const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent", {
        method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": T_GEMINI },
        body: JSON.stringify({ contents: [{ parts: [{ inline_data: { mime_type: mt, data: b64 } }, { text: "Transcribe this recording word for word in English. Output only the transcript, nothing else. Keep filler words out but never change meaning." }] }], generationConfig: { temperature: 0 } }),
      });
      const j = await r.json();
      const text = j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts ? j.candidates[0].content.parts.map((p) => p.text || "").join("") : "";
      if (r.ok && text.trim()) return { text: text.trim(), engine: model };
      last = JSON.stringify(j).slice(0, 200);
    }
    throw new Error("gemini transcribe: " + last);
  }
  throw new Error("no transcriber configured (add GROQ_API_KEY)");
}

/* ---------------- analysis (Claude) ---------------- */
async function tClaude(body) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", headers: { "x-api-key": T_ANTHROPIC, "anthropic-version": "2023-06-01", "content-type": "application/json" }, body: JSON.stringify(body),
  });
  const j = await r.json();
  if (!r.ok) throw new Error("anthropic: " + (j.error && j.error.message ? j.error.message : r.status));
  try {
    const u = j.usage || {}, pr = T_PRICE[body.model] || [3, 15];
    const inTok = (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
    const usd = inTok / 1e6 * pr[0] + (u.output_tokens || 0) / 1e6 * pr[1];
    await Promise.all([tkv(["HINCRBYFLOAT", tMonth(), "usd", String(usd)]), tkv(["HINCRBY", tMonth(), "calls", "1"])]);
  } catch {}
  return j;
}
function tText(msg) { return (msg.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n"); }
function tJSON(text) {
  let t = String(text || "").trim().replace(/```json|```/g, "").trim();
  const o = t.indexOf("{"); if (o < 0) throw new Error("no json");
  t = t.slice(o); return JSON.parse(t.slice(0, t.lastIndexOf("}") + 1));
}
const T_SYSTEM = `You organize one person's spoken thoughts for a private archive that will one day become their book. The recording was spoken casually and transcribed automatically.

Rules that never bend:
- Never invent meaning, experiences, opinions or wisdom the speaker did not express.
- Never make something sound more profound than it was. Plain thoughts stay plain.
- A potential quote must be the speaker's own wording, lightly trimmed at most. If nothing quotable was said, quote is null.
- Distinguish the source honestly: my_thought (the speaker's own idea or realization), someone_elses_wisdom (something they heard or learned from another person), quoted_material (a direct quote or known saying), my_interpretation (their own reaction to someone else's idea), mixed, or source_unclear when you cannot tell. Never present another person's wisdom as the speaker's original thought. When unsure, say source_unclear.
- "refined" is the same thought in the speaker's own voice with false starts and filler removed, nothing added, uncertainty preserved. Keep unusual wording when it carries meaning.
- lesson and what_this_means exist only when the thought actually contains a broader lesson. Otherwise null.
- A recording may hold several distinct thoughts; then set multiple to true and let key_idea cover the main one.
Return only JSON.`;

async function tAnalyze(t, related, themesInUse) {
  const relBlock = related.length ? related.map((r) => `[${r.id}] (${new Date(r.ts).toISOString().slice(0, 10)}) ${r.key_idea || r.preview}`).join("\n") : "(none)";
  const user = `Transcript (${t.mode === "written" ? "written" : "spoken"}, ${new Date(t.ts).toISOString().slice(0, 10)}):
"""
${t.transcript}
"""

Earlier thoughts by the same person that may be related:
${relBlock}

Themes already in use (reuse these when they fit, add a new lowercase word only if none fits): ${themesInUse.join(", ")}

Return JSON:
{
 "title": "3 to 7 plain words naming the thought",
 "refined": "cleaned version, same voice, same meaning",
 "key_idea": "one sentence, in the speaker's terms",
 "kinds": ["one or more of: reflection, idea, observation, lesson, advice, question, realization, story, experience, belief, principle, quote, heard_wisdom"],
 "source": "my_thought | someone_elses_wisdom | quoted_material | my_interpretation | mixed | source_unclear",
 "attributed_to": "name of the other person if any, else null",
 "quote": "faithful potential quote or null",
 "lesson": "the broader lesson in one or two sentences, or null",
 "what_this_means": "concise explanation of the underlying lesson, or null",
 "themes": ["1 to 4 lowercase words"],
 "multiple": false,
 "connections": [{"id": "id from the earlier thoughts list", "relation": "repeats | deepens | contradicts | continues | answers"}]
}
Only list a connection when the link is real. Empty array is fine.`;
  const msg = await tClaude({ model: T_MODEL, max_tokens: 1200, system: T_SYSTEM, messages: [{ role: "user", content: user }] });
  const j = tJSON(tText(msg));
  const validIds = new Set(related.map((r) => r.id));
  return {
    title: String(j.title || "").slice(0, 80),
    refined: String(j.refined || ""),
    key_idea: String(j.key_idea || "").slice(0, 400),
    kinds: Array.isArray(j.kinds) ? j.kinds.map(String).slice(0, 5) : [],
    source: ["my_thought", "someone_elses_wisdom", "quoted_material", "my_interpretation", "mixed", "source_unclear"].includes(j.source) ? j.source : "source_unclear",
    attributed_to: j.attributed_to ? String(j.attributed_to).slice(0, 80) : null,
    quote: j.quote ? String(j.quote).slice(0, 400) : null,
    lesson: j.lesson ? String(j.lesson).slice(0, 500) : null,
    what_this_means: j.what_this_means ? String(j.what_this_means).slice(0, 500) : null,
    themes: Array.isArray(j.themes) ? j.themes.map((x) => String(x).toLowerCase().trim()).filter(Boolean).slice(0, 4) : [],
    multiple: !!j.multiple,
    connections: Array.isArray(j.connections) ? j.connections.filter((c) => c && validIds.has(String(c.id))).map((c) => ({ id: String(c.id), relation: String(c.relation || "repeats") })).slice(0, 5) : [],
  };
}

/* ---------------- the pipeline ---------------- */
async function tProcessOne(id, index, ctx) {
  const t = await tGet(id);
  if (!t) return { id, skipped: "missing" };
  // 1. transcribe
  if (!t.transcript) {
    const a = await tReadAudio(id);
    if (!a) throw new Error("no audio stored");
    const tr = await tTranscribe(a.mime, a.b64);
    if (!tr.text) { t.status = "empty"; await tPut(t); await tDeleteAudio(id); await tUpsertIndex(t); return { id, status: "empty" }; }
    t.transcript = tr.text; t.engine = tr.engine; t.status = "transcribed";
    await tPut(t); await tDeleteAudio(id); await tBump("transcribed", 1);
  }
  // 2. embed + related
  let related = [];
  try {
    const vec = await tEmbed(t.transcript);
    if (vec) {
      await tkv(["HSET", T_VECS, id, tPack(vec)]);
      const sims = await tSimilar(vec, id, 6, 0.6);
      related = sims.map((s) => { const r = index.find((x) => x.id === s.id); return r ? { ...r, score: s.score } : null; }).filter(Boolean);
      t.related = sims.slice(0, 6);
      t.said_before = sims.some((s) => s.score >= 0.8 && (index.find((x) => x.id === s.id) || {}).ts < t.ts);
    }
  } catch (e) { t.embed_error = String(e.message || e).slice(0, 200); }
  // 3. analyze (only within budget, and only when Claude is reachable)
  if (ctx && ctx.noClaude) { t.status = "unanalyzed"; t.note = "Anthropic credit needed"; await tPut(t); await tUpsertIndex(t); return { id, parked: "credit" }; }
  const u = await tUsage();
  if (u.sar >= T_BUDGET_SAR) { t.status = "unanalyzed"; t.note = "monthly budget reached"; await tPut(t); await tUpsertIndex(t); return { id, status: t.status }; }
  const themes = [...new Set([...T_THEMES, ...index.flatMap((x) => x.themes || [])])];
  const a = await tAnalyze(t, related, themes);
  Object.assign(t, a);
  t.status = "ready"; delete t.note;
  await tPut(t); await tBump("analyzed", 1);
  await tUpsertIndex(t);
  return { id, status: "ready" };
}
async function tProcess(limitMs) {
  const got = await tkv(["SET", T_LOCK, "1", "NX", "EX", "90"]);
  if (got !== "OK") return { locked: true };
  const started = Date.now(), done = [], seen = new Set(), ctx = { noClaude: false };
  try {
    let index = await tIndex();
    while (Date.now() - started < limitMs) {
      const id = await tkv(["LINDEX", T_QUEUE, "0"]);
      if (!id || seen.has(id)) break;     // empty, or we have cycled through everything once
      seen.add(id);
      try {
        const r = await tProcessOne(id, index, ctx);
        done.push(r);
        index = await tIndex();
        if (r.parked) { await tkv(["LREM", T_QUEUE, "0", id]); await tkv(["RPUSH", T_QUEUE, id]); continue; }   // stays queued for when credit is back
      } catch (e) {
        const t = await tGet(id);
        if (/credit balance|billing|insufficient/i.test(String(e.message || e))) {
          // not a fault of the thought — park it, keep it queued, still transcribe the rest this run
          ctx.noClaude = true;
          if (t) { t.status = "unanalyzed"; t.note = "Anthropic credit needed"; await tPut(t); await tUpsertIndex(t); }
          done.push({ id, parked: "credit" });
          await tkv(["LREM", T_QUEUE, "0", id]); await tkv(["RPUSH", T_QUEUE, id]);
          continue;
        }
        const n = (t && t.attempts || 0) + 1;
        if (t) { t.attempts = n; t.error = String(e.message || e).slice(0, 300); if (n >= 3) t.status = "failed"; await tPut(t); await tUpsertIndex(t); }
        done.push({ id, error: String(e.message || e).slice(0, 200), attempts: n });
        if (n >= 3 || !t) await tkv(["LREM", T_QUEUE, "0", id]);
        else { await tkv(["LREM", T_QUEUE, "0", id]); await tkv(["RPUSH", T_QUEUE, id]); }   // retry after the others
        continue;
      }
      await tkv(["LREM", T_QUEUE, "0", id]);
    }
  } finally { await tkv(["DEL", T_LOCK]); }
  const left = await tkv(["LLEN", T_QUEUE]);
  return { done, left };
}

/* ---------------- handler ---------------- */
async function thoughtsHandler(req, res, body) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  try {
    const action = body.action || "list";
    const pin = String(body.pin || req.headers["x-pin"] || "").trim();
    if (pin !== T_PIN && !(action === "process" && body.secret === process.env.DEPLOY_SECRET)) return res.status(401).json({ error: "pin" });
    if (!T_KV_URL || !T_KV_TOKEN) return res.status(500).json({ error: "kv env missing" });

    if (action === "capture") {
      // body: id?, audio (base64), mime, duration, recordedAt, chunk {i, n}
      const id = String(body.id || tId()).replace(/[^a-z0-9]/gi, "").slice(0, 24);
      const ch = body.chunk || { i: 0, n: 1 };
      if (!body.audio) return res.status(400).json({ error: "no audio" });
      await tkv(["SET", "thoughts:audio:" + id + ":" + ch.i, String(body.audio), "EX", "604800"]);
      if (ch.i === 0) {
        const t = { id, ts: Number(body.recordedAt) || Date.now(), mode: "spoken", duration: Number(body.duration) || 0, status: "pending", transcript: "", mime: String(body.mime || "audio/mp4") };
        await tPut(t); await tUpsertIndex(t);
      }
      if (ch.i === ch.n - 1) {
        await tkv(["SET", "thoughts:audio:" + id + ":meta", JSON.stringify({ n: ch.n, mime: String(body.mime || "audio/mp4") }), "EX", "604800"]);
        await tkv(["RPUSH", T_QUEUE, id]);
      }
      return res.status(200).json({ ok: true, id });
    }
    if (action === "write") {
      const text = String(body.text || "").trim();
      if (!text) return res.status(400).json({ error: "empty" });
      const id = tId();
      const t = { id, ts: Number(body.recordedAt) || Date.now(), mode: "written", status: "transcribed", transcript: text };
      await tPut(t); await tUpsertIndex(t); await tkv(["RPUSH", T_QUEUE, id]);
      return res.status(200).json({ ok: true, id });
    }
    if (action === "process") {
      return res.status(200).json(await tProcess(Number(body.ms) || 48000));
    }
    if (action === "list") {
      const list = await tIndex();
      const themes = {};
      for (const t of list) for (const th of t.themes || []) themes[th] = (themes[th] || 0) + 1;
      const pending = list.filter((t) => t.status === "pending" || t.status === "transcribed").length;
      return res.status(200).json({ thoughts: list, themes, pending, usage: await tUsage() });
    }
    if (action === "get") {
      const t = await tGet(String(body.id || ""));
      if (!t) return res.status(404).json({ error: "not found" });
      const index = await tIndex();
      const related = (t.related || []).map((r) => { const s = index.find((x) => x.id === r.id); return s ? { ...s, score: r.score, relation: ((t.connections || []).find((c) => c.id === r.id) || {}).relation || null } : null; }).filter(Boolean);
      return res.status(200).json({ thought: t, related });
    }
    if (action === "search") {
      const q = String(body.q || "").trim();
      if (!q) return res.status(400).json({ error: "empty" });
      const index = await tIndex();
      let hits = [];
      try { const v = await tEmbed(q); if (v) hits = await tSimilar(v, null, 20, 0.45); } catch {}
      const ql = q.toLowerCase();
      const kw = index.filter((t) => (t.preview + " " + t.key_idea + " " + (t.quote || "") + " " + (t.themes || []).join(" ")).toLowerCase().includes(ql)).map((t) => ({ id: t.id, score: 0.5 }));
      const seen = new Set(), out = [];
      for (const h of [...hits, ...kw]) { if (seen.has(h.id)) continue; seen.add(h.id); const s = index.find((x) => x.id === h.id); if (s) out.push({ ...s, score: h.score }); }
      out.sort((a, b) => b.score - a.score);
      return res.status(200).json({ q, results: out.slice(0, 20) });
    }
    if (action === "update") {
      const t = await tGet(String(body.id || ""));
      if (!t) return res.status(404).json({ error: "not found" });
      const p = body.patch || {};
      for (const k of ["quote", "lesson", "what_this_means", "key_idea", "title", "source", "attributed_to", "refined", "transcript"]) if (k in p) t[k] = p[k] == null ? null : String(p[k]);
      if ("themes" in p && Array.isArray(p.themes)) t.themes = p.themes.map((x) => String(x).toLowerCase().trim()).filter(Boolean).slice(0, 6);
      if ("book" in p) t.book = !!p.book;
      t.edited = Date.now();
      await tPut(t); await tUpsertIndex(t);
      return res.status(200).json({ ok: true, thought: t });
    }
    if (action === "delete") {
      const id = String(body.id || "");
      await tkv(["DEL", "thoughts:t:" + id]); await tkv(["HDEL", T_VECS, id]); await tkv(["LREM", T_QUEUE, "0", id]); await tDeleteAudio(id);
      const list = (await tIndex()).filter((x) => x.id !== id);
      await tSaveIndex(list);
      return res.status(200).json({ ok: true });
    }
    if (action === "retry") {
      const id = String(body.id || "");
      const t = await tGet(id);
      if (!t) return res.status(404).json({ error: "not found" });
      t.attempts = 0; delete t.error; t.status = t.transcript ? "transcribed" : "pending";
      await tPut(t); await tUpsertIndex(t); await tkv(["LREM", T_QUEUE, "0", id]); await tkv(["RPUSH", T_QUEUE, id]);
      return res.status(200).json({ ok: true });
    }
    if (action === "evolve") {
      // how my thinking changed — around one thought (it + its related) or a theme
      const index = await tIndex();
      let ids = [];
      if (body.id) { const t = await tGet(String(body.id)); if (!t) return res.status(404).json({ error: "not found" }); ids = [t.id, ...(t.related || []).map((r) => r.id)]; }
      else if (body.theme) ids = index.filter((x) => (x.themes || []).includes(String(body.theme))).map((x) => x.id);
      const picked = index.filter((x) => ids.includes(x.id) && x.status === "ready").sort((a, b) => a.ts - b.ts).slice(-12);
      if (picked.length < 2) return res.status(200).json({ text: null, count: picked.length });
      const cacheKey = "thoughts:evolve:" + picked.map((x) => x.id).join(",");
      const cached = await tkv(["GET", cacheKey]);
      if (cached && !body.fresh) return res.status(200).json({ text: cached, count: picked.length, cached: true });
      const full = [];
      for (const s of picked) { const t = await tGet(s.id); if (t) full.push(`${new Date(t.ts).toISOString().slice(0, 10)}: ${t.refined || t.transcript}`); }
      const msg = await tClaude({ model: T_MODEL, max_tokens: 700, system: "You help one person see how their own thinking on a subject changed over time. Use only what they said. Do not judge which version was right. Do not add wisdom of your own. Write in second person, plainly, in three short paragraphs at most: what they thought earlier, what shifted, where it stands now. Quote their own phrases where useful.", messages: [{ role: "user", content: full.join("\n\n") }] });
      const text = tText(msg).trim();
      await tkv(["SET", cacheKey, text, "EX", "2592000"]);
      return res.status(200).json({ text, count: picked.length });
    }
    if (action === "book") {
      // propose a book structure from everything captured so far
      const index = await tIndex();
      const ready = index.filter((x) => x.status === "ready");
      if (body.outline_only !== false && ready.length < 10) return res.status(200).json({ error: "need_more", count: ready.length });
      const rows = ready.map((t) => `[${t.id}] ${new Date(t.ts).toISOString().slice(0, 10)} · ${t.source} · themes: ${(t.themes || []).join(", ")}\n  idea: ${t.key_idea}${t.quote ? `\n  quote: "${t.quote}"` : ""}${t.lesson ? `\n  lesson: ${t.lesson}` : ""}`);
      const msg = await tClaude({ model: T_BOOK_MODEL, max_tokens: 3000, system: `You are structuring a personal book from one person's own recorded thoughts. The book must sound like them, not like self-help. Only use what they actually said. Do not invent chapters that the material does not support. Do not treat someone_elses_wisdom or quoted_material as their own ideas; those can appear only as things they learned from others. Return only JSON:
{"titles":["3 title options"],"premise":"two sentences on what this book is, in their terms","chapters":[{"title":"","why":"one sentence","thought_ids":["..."],"opening_quote_id":"id or null"}],"recurring":["ideas that keep coming back"],"gaps":["subjects they circle but have not finished thinking through"]}`, messages: [{ role: "user", content: rows.join("\n") }] });
      const j = tJSON(tText(msg));
      const outline = { ...j, generated: Date.now(), count: ready.length };
      await tkv(["SET", "thoughts:book:outline", JSON.stringify(outline)]);
      return res.status(200).json({ outline });
    }
    if (action === "book_outline") {
      const raw = await tkv(["GET", "thoughts:book:outline"]);
      return res.status(200).json({ outline: raw ? JSON.parse(raw) : null });
    }
    if (action === "usage") return res.status(200).json({ usage: await tUsage(), queue: await tkv(["LLEN", T_QUEUE]) });
    return res.status(400).json({ error: "unknown action" });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
