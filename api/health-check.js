// ============================================================
// api/health-check.js — pings all services, returns status JSON
// Used by admin.html and can be polled by an external monitor
// (e.g. cron-job.org) to detect outages.
// ============================================================

const BASE = 'https://moes-app-two.vercel.app';

function timedFetch(url, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms || 9000);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

async function check(name, url, validate) {
  const started = Date.now();
  try {
    const res = await timedFetch(url, 9000);
    const ms = Date.now() - started;
    if (!res.ok) return { name, ok: false, status: 'down', http: res.status, ms };
    const data = await res.json().catch(() => null);
    if (validate && data) {
      const v = validate(data);
      return { name, ok: v.ok, status: v.ok ? 'up' : 'degraded', detail: v.detail || '', ms };
    }
    return { name, ok: true, status: 'up', ms };
  } catch (e) {
    return { name, ok: false, status: 'down', error: e.name === 'AbortError' ? 'timeout' : e.message, ms: Date.now() - started };
  }
}

async function healthHandler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  const results = await Promise.all([
    check('feed',     BASE + '/api/feed',               d => ({ ok: !!d.ok, detail: (d.count || 0) + ' stories' })),
    check('football', BASE + '/api/football?league=epl', d => ({ ok: !d.error, detail: d.error || 'ok' })),
    check('stats',    BASE + '/api/stats',              d => ({ ok: !!d.ok })),
    check('f1',       'https://api.jolpi.ca/ergast/f1/2026/driverStandings.json', () => ({ ok: true })),
  ]);

  const allOk = results.every(r => r.ok);
  const anyDown = results.some(r => r.status === 'down');

  return res.status(200).json({
    ok: allOk,
    overall: allOk ? 'healthy' : (anyDown ? 'outage' : 'degraded'),
    checkedAt: new Date().toISOString(),
    services: results,
  });
}


// ---- مقاضي (maqadi) backend — folded in here to stay under the 12-function limit ----
// Actions: state | save | receipt | compare
// Env: KV_REST_API_URL, KV_REST_API_TOKEN, ANTHROPIC_API_KEY, MAQADI_PIN, (optional) MAQADI_MODEL



const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const PIN_FULL = (process.env.MAQADI_PIN || (process.env.DEPLOY_SECRET || "").slice(-4)).trim();
const PIN_LITE = (process.env.MAQADI_PIN_HER || "1234").trim();
const LITE_BLOCKED = ["receipt", "compare", "photoset"];
const MODEL = process.env.MAQADI_MODEL || "claude-sonnet-5";                       // price research (needs web search judgement)
const MODEL_RECEIPT = process.env.MAQADI_MODEL_RECEIPT || "claude-haiku-4-5-20251001"; // receipts: cheap model first, MODEL as fallback
const BUDGET_SAR = Number(process.env.MAQADI_BUDGET_SAR || 15);                    // monthly cap on paid lookups
const COST = { receipt: 0.05, item: 0.2 };                                          // rough SAR per action, shown to the user

const STATE_KEY = "maqadi:state";
const PRICE_TTL_DAYS = 21;

/* ---------------- Upstash ---------------- */
async function kv(cmd) {
  const r = await fetch(KV_URL, {
    method: "POST",
    headers: { Authorization: "Bearer " + KV_TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
  });
  const j = await r.json();
  if (j.error) throw new Error("kv: " + j.error);
  return j.result;
}
function monthKey() { return "maqadi:usage:" + new Date().toISOString().slice(0, 7); }
async function usage() {
  const raw = await kv(["HGETALL", monthKey()]);
  const u = { receipts: 0, items: 0 };
  if (Array.isArray(raw)) for (let i = 0; i < raw.length; i += 2) u[raw[i]] = Number(raw[i + 1]) || 0;
  u.est = Math.round((u.receipts * COST.receipt + u.items * COST.item) * 100) / 100;
  u.budget = BUDGET_SAR;
  return u;
}
async function bump(field, n) { try { await kv(["HINCRBY", monthKey(), field, String(n)]); } catch {} }
async function readState() {
  const raw = await kv(["GET", STATE_KEY]);
  if (!raw) return { v: 0, state: null };
  try { return JSON.parse(raw); } catch { return { v: 0, state: null }; }
}
async function writeState(v, state) {
  await kv(["SET", STATE_KEY, JSON.stringify({ v, state, ts: Date.now() })]);
}

/* ---------------- Anthropic ---------------- */
async function claude(body) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  if (!r.ok) throw new Error("anthropic: " + (j.error && j.error.message ? j.error.message : r.status));
  return j;
}
function textOf(msg) {
  return (msg.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
}
function parseJSON(text) {
  let t = String(text || "").trim().replace(/```json|```/g, "").trim();
  const a = t.indexOf("["), o = t.indexOf("{");
  let start = -1;
  if (a >= 0 && (o < 0 || a < o)) start = a; else if (o >= 0) start = o;
  if (start < 0) throw new Error("no json in model output");
  t = t.slice(start);
  const end = t.lastIndexOf(t[0] === "[" ? "]" : "}");
  return JSON.parse(t.slice(0, end + 1));
}
function normAr(s) {
  return String(s || "")
    .replace(/[\u064B-\u0652\u0640]/g, "")
    .replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي")
    .replace(/[()،,.\-_/]/g, " ")
    .replace(/\s+/g, " ").trim().toLowerCase();
}

/* ---------------- receipt ---------------- */
async function readReceipt({ image, mime, catalog }) {
  const names = (catalog || []).slice(0, 400);
  const system = `You read Saudi supermarket receipts (Danube, Panda, Tamimi, Carrefour, LuLu, Othaim, Nana, Al Raya, Manuel, Spar, and others). Receipts may be Arabic, English, or both. Return ONLY JSON, no prose, no markdown.

Schema:
{
 "store": "Danube" | "Panda" | "Tamimi" | "Carrefour" | "LuLu" | "Othaim" | "Nana" | "Al Raya" | "Manuel" | "Spar" | "Other",
 "store_raw": "<store name as printed>",
 "date": "YYYY-MM-DD" | null,
 "total": <number, SAR, grand total paid> | null,
 "lines": [
   { "raw": "<line text as printed>",
     "name_ar": "<clean short Arabic product name, brand kept if printed, e.g. 'حليب المراعي كامل الدسم 2 لتر'>",
     "qty": <number, default 1>,
     "unit_price": <number|null>,
     "line_total": <number>,
     "match": "<exact string from the HOUSEHOLD CATALOG below, or null if nothing fits>",
     "category": "veg|bread|dairy|meat|fish|can|oat|spice|coffee|home|other" }
 ]
}

Rules: ignore subtotals, VAT lines, discounts summary, loyalty points, payment lines. Keep quantities and totals in SAR. Match to the catalog only when the product is clearly the same thing (e.g. receipt 'ALMARAI FRESH MILK FF 2L' matches catalog 'حليب (كامل الدسم)'). If unsure, match=null.

HOUSEHOLD CATALOG:
${names.join("\n")}`;

  const messages = [{
    role: "user",
    content: [
      { type: "image", source: { type: "base64", media_type: mime || "image/jpeg", data: image } },
      { type: "text", text: "Read this receipt and return the JSON." },
    ],
  }];
  let out = null;
  try { out = parseJSON(textOf(await claude({ model: MODEL_RECEIPT, max_tokens: 4000, system, messages }))); } catch (e) { out = null; }
  if (!out || !Array.isArray(out.lines) || !out.lines.length) {
    out = parseJSON(textOf(await claude({ model: MODEL, max_tokens: 4000, system, messages })));
  }
  await bump("receipts", 1);
  out.lines = (out.lines || []).map((l) => ({
    raw: String(l.raw || "").slice(0, 120),
    name_ar: String(l.name_ar || l.raw || "").slice(0, 80),
    qty: Number(l.qty) > 0 ? Number(l.qty) : 1,
    unit_price: l.unit_price != null ? Number(l.unit_price) : null,
    line_total: Number(l.line_total) || 0,
    match: l.match && names.includes(l.match) ? l.match : null,
    category: l.category || "other",
  }));
  return out;
}

/* ---------------- price comparison ---------------- */
// Always derive "lowest" from the price list (never trust a model's pick), and
// count the price actually paid as a real data point for that store.
function finalize(data, it, store) {
  let prices = Array.isArray(data.prices) ? data.prices.filter((p) => p && Number(p.price) > 0).map((p) => ({ store: String(p.store || ""), price: Number(p.price) })) : [];
  if (data.lowest && Number(data.lowest.price) > 0 && !prices.some((p) => p.store === String(data.lowest.store))) prices.push({ store: String(data.lowest.store || ""), price: Number(data.lowest.price) });
  if (store && it.paid != null && Number(it.paid) > 0 && !prices.some((p) => p.store === store)) prices.push({ store, price: Number(it.paid) });
  prices.sort((a, b) => a.price - b.price);
  prices = prices.slice(0, 6);
  const lowest = prices.length ? { store: prices[0].store, price: prices[0].price, note: (data.lowest && String(data.lowest.store) === prices[0].store) ? String(data.lowest.note || "") : "" } : null;
  return { lowest, prices, confidence: data.confidence || "low", checked: data.checked || new Date().toISOString().slice(0, 10) };
}
async function compare({ items, store }) {
  // items: [{name, paid}]  (paid = unit price in SAR)
  const list = (items || []).slice(0, 4);
  const results = [];
  const todo = [];
  for (const it of list) {
    const k = "maqadi:price:" + normAr(it.name);
    const cached = await kv(["GET", k]);
    if (cached) {
      try {
        const c = JSON.parse(cached);
        if (Date.now() - c.ts < PRICE_TTL_DAYS * 86400000) { results.push({ ...finalize(c.data, it, store), name: it.name, paid: it.paid, cached: true }); continue; }
      } catch {}
    }
    todo.push(it);
  }

  if (todo.length) {
    const u = await usage();
    if (u.est >= BUDGET_SAR) { const err = new Error("budget"); err.code = 402; throw err; }
    await bump("items", todo.length);
    const system = `You are a Saudi Arabia grocery price researcher. Today's shopper bought items at "${store || "a supermarket"}" in Riyadh. For EACH item, search the web for the CURRENT shelf/online price in Saudi Arabia (SAR) at the major chains: Danube, Panda, Tamimi, Carrefour, LuLu, Othaim, Nana, Al Raya, Manuel, Spar. Use the stores' own sites or apps' web pages and Saudi price-comparison pages. Prefer the same brand and pack size as the item name.

Return ONLY JSON (no prose, no markdown) as an array in the same order as the items:
[
 { "name": "<item name as given>",
   "lowest": { "store": "<store>", "price": <number SAR>, "note": "<pack size or brand if it differs>" } | null,
   "prices": [ { "store": "<store>", "price": <number SAR> }, ... ],
   "confidence": "high" | "medium" | "low",
   "checked": "<YYYY-MM-DD>" }
]
Never invent a price. If you cannot find a real current price for an item, set lowest=null and prices=[]. Keep at most 6 entries in prices. Be economical: at most two searches per item.`;

    const user = "Items (name — paid unit price SAR):\n" + todo.map((t, i) => `${i + 1}. ${t.name} — ${t.paid != null ? t.paid : "?"}`).join("\n");

    const msg = await claude({
      model: MODEL,
      max_tokens: 3000,
      system,
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: Math.min(8, todo.length * 2) }],
      messages: [{ role: "user", content: user }],
    });
    let arr = [];
    try { arr = parseJSON(textOf(msg)); } catch { arr = []; }
    if (!Array.isArray(arr)) arr = [];
    for (let i = 0; i < todo.length; i++) {
      const it = todo[i];
      const r = arr.find((x) => x && normAr(x.name) === normAr(it.name)) || arr[i] || {};
      const data = finalize(r, it, store);
      if (data.lowest || data.prices.length) {
        await kv(["SET", "maqadi:price:" + normAr(it.name), JSON.stringify({ ts: Date.now(), data })]);
      }
      results.push({ ...data, name: it.name, paid: it.paid, cached: false });
    }
  }
  // restore original order
  const order = list.map((it) => normAr(it.name));
  results.sort((a, b) => order.indexOf(normAr(a.name)) - order.indexOf(normAr(b.name)));
  return results;
}

/* ---------------- handler ---------------- */
async function maqadiHandler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Pin");
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    const body = req.method === "POST" ? (typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {})) : {};
    const action = body.action || req.query.action || "state";
    const pin = String(req.headers["x-pin"] || body.pin || req.query.pin || "").trim();
    const role = pin && pin === PIN_FULL ? "full" : (pin && pin === PIN_LITE ? "lite" : null);
    if (!role) return res.status(401).json({ error: "pin" });
    if (role === "lite" && LITE_BLOCKED.includes(action)) return res.status(403).json({ error: "role" });
    if (!KV_URL || !KV_TOKEN) return res.status(500).json({ error: "kv env missing" });

    if (action === "state") {
      const s = await readState();
      const u = role === "full" ? await usage() : undefined;
      return res.status(200).json({ ...s, role, usage: u });
    }
    if (action === "save") {
      const cur = await readState();
      if (Number(body.v) !== Number(cur.v)) return res.status(409).json({ conflict: true, ...cur });
      const nv = cur.v + 1;
      await writeState(nv, body.state);
      return res.status(200).json({ v: nv });
    }
    if (action === "photos") {
      const raw = await kv(["GET", "maqadi:photos"]);
      return res.status(200).json({ photos: raw ? JSON.parse(raw) : {} });
    }
    if (action === "photoset") {
      const raw = await kv(["GET", "maqadi:photos"]);
      const photos = raw ? JSON.parse(raw) : {};
      if (body.data && String(body.data).length < 60000) photos[body.id] = body.data;
      else delete photos[body.id];
      await kv(["SET", "maqadi:photos", JSON.stringify(photos)]);
      return res.status(200).json({ ok: true, count: Object.keys(photos).length });
    }
    if (action === "receipt") {
      if (!ANTHROPIC_KEY) return res.status(500).json({ error: "anthropic env missing" });
      const out = await readReceipt(body);
      return res.status(200).json(out);
    }
    if (action === "compare") {
      if (!ANTHROPIC_KEY) return res.status(500).json({ error: "anthropic env missing" });
      const out = await compare(body);
      return res.status(200).json({ results: out });
    }
    return res.status(400).json({ error: "unknown action" });
  } catch (e) {
    if (e && e.code === 402) return res.status(402).json({ error: "budget", budget: BUDGET_SAR });
    return res.status(500).json({ error: String(e && e.message ? e.message : e) });
  }
}


// ============================================================
// Router: GET = health check (unchanged). POST/OPTIONS = مقاضي app.
// ============================================================
export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method === 'POST' || req.method === 'OPTIONS' || (req.query && req.query.app === 'maqadi')) {
    return maqadiHandler(req, res);
  }
  return healthHandler(req, res);
}
