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
const LITE_BLOCKED = ["receipt", "reconcile", "compare", "photoset"];
const MODEL = process.env.MAQADI_MODEL || "claude-haiku-4-5-20251001";              // price research: cheap model by default
const MODEL_RECEIPT = process.env.MAQADI_MODEL_RECEIPT || "claude-sonnet-5";           // receipts: Sonnet. Haiku swaps single Arabic letters on thermal print (كزبرة->زيرة, قشطة->حلبة); Sonnet reads them. ~0.15 SAR/receipt. MODEL is the fallback.
const BUDGET_SAR = Number(process.env.MAQADI_BUDGET_SAR || 15);                    // monthly cap on paid lookups
// USD per million tokens [input, output]; web search is $10 per 1,000 searches. Real usage is read off every API response.
const PRICE = { "claude-haiku-4-5-20251001": [1, 5], "claude-sonnet-5": [3, 15], "claude-opus-5": [15, 75] };
const SEARCH_USD = 0.01, SAR = 3.75;

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
  const u = { receipts: 0, items: 0, searches: 0, calls: 0, usd: 0 };
  if (Array.isArray(raw)) for (let i = 0; i < raw.length; i += 2) u[raw[i]] = Number(raw[i + 1]) || 0;
  u.est = Math.round(u.usd * SAR * 100) / 100;   // SAR actually spent this month, from real token counts
  u.budget = BUDGET_SAR;
  u.model = MODEL;
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
  try {
    const u = j.usage || {}, pr = PRICE[body.model] || [3, 15];
    const inTok = (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
    const searches = (u.server_tool_use && u.server_tool_use.web_search_requests) || 0;
    const usd = inTok / 1e6 * pr[0] + (u.output_tokens || 0) / 1e6 * pr[1] + searches * SEARCH_USD;
    await Promise.all([kv(["HINCRBYFLOAT", monthKey(), "usd", String(usd)]), kv(["HINCRBY", monthKey(), "searches", String(searches)]), kv(["HINCRBY", monthKey(), "calls", "1"])]);
  } catch {}
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
// A receipt is a long strip. The vision API caps an image's long edge, so a whole strip
// sent as one image leaves Arabic names a few pixels tall — the digits survive, the
// script does not, and the model fills the gap by guessing a plausible grocery word.
// So: the client sends overlapping vertical SLICES, and the prompt below forbids
// guessing and anchors every line on its printed item code (Latin digits survive bad
// thermal print). Unreadable is an allowed answer; a confident wrong name is not.
function digits(s) { return String(s == null ? "" : s).replace(/\D/g, ""); }
/* ---------------- reconcile: reason, don't read ---------------- */
// Vision OCR of Arabic thermal print swaps single letters (قشطة->حلبة, كزبرة->زيرة).
// A text model with the brand, size, quantity, unit price and the household catalog can
// work out what the line actually is - the way a person would - where a vision model
// only sees pixels. Runs only on lines whose code the household has not confirmed yet.
async function reconcile({ store, lines, names }) {
  const todo = lines.map((l, i) => ({ i, l })).filter((x) => !x.l.known);
  if (!todo.length) return lines;
  const system = `You reconcile noisy OCR of a Saudi supermarket receipt against a household's grocery catalog. Return ONLY a JSON array, no prose, no markdown.

The "read" field is what a vision model transcribed from thermal print. Single letters are often wrong or dropped (ق↔ح, ك dropped, ط↔ظ, ز↔ر, ن↔ب↔ت, د↔ذ, ج↔ح↔خ). Do NOT trust the spelling. Reason from everything else: the brand, the size, the quantity, the unit price, the store, and your knowledge of what Saudi supermarkets sell at those prices. Examples of the reasoning wanted:
- read "حلبة المراعي لايت 100 جرام", 2 × 4.00 → Almarai Light 100g at 4 SAR is cream: "قشطة المراعي لايت 100 جرام".
- read "زيرة", 1 × 2.00, in a herbs section next to بقدونس → "كزبرة".
- read "خبز عربي بر شعير", 1 × 1.00 → the printed word was almost certainly "كبير" (a 1 SAR loaf), not "شعير".
- read "حليب ناشك طارح", 800 مل → "حليب نادك طازج".

For EACH input line return an object:
{ "i": <same index>,
  "name": "<the correct clean Arabic product name>",
  "match": "<exact string from the HOUSEHOLD CATALOG below, or null if no catalog item is that product>",
  "confidence": "high" | "low" }
"high" only when brand/size/price leave little doubt. If two products are plausible, "low". Never invent a product that does not exist in Saudi supermarkets.

HOUSEHOLD CATALOG:
${names.join("\n")}`;
  const user = JSON.stringify({ store: store || "", lines: todo.map((x) => ({ i: x.i, code: x.l.code, read: x.l.name_ar, raw: x.l.raw, qty: x.l.qty, unit_price: x.l.unit_price, line_total: x.l.line_total })) });
  let out = null;
  try { out = parseJSON(textOf(await claude({ model: MODEL_RECEIPT, max_tokens: 4000, system, messages: [{ role: "user", content: user }] }))); } catch (e) { out = null; }
  if (!Array.isArray(out)) return lines;
  for (const r of out) {
    const l = lines[Number(r && r.i)];
    if (!l || l.known) continue;
    const nm = r.name == null ? null : String(r.name).trim().slice(0, 80) || null;
    const high = String(r.confidence || "").toLowerCase() === "high" && !!nm;
    const match = r.match && names.includes(r.match) ? r.match : null;
    l.reasoned = true;
    if (high) { l.read_as = l.name_ar; l.name_ar = nm; l.confidence = "high"; l.match = match; }
    else { l.hint = nm; l.hint_match = match; l.confidence = "low"; l.match = null; }
  }
  return lines;
}

async function readReceipt({ image, images, mime, catalog, known }) {
  const names = (catalog || []).slice(0, 400);
  const knownSet = new Set((Array.isArray(known) ? known : []).map((c) => digits(c)).filter(Boolean));
  const imgs = (Array.isArray(images) && images.length ? images : [image]).filter(Boolean).slice(0, 6);
  if (!imgs.length) throw new Error("no image");
  const multi = imgs.length > 1;

  const system = `You TRANSCRIBE Saudi supermarket receipts (Danube, Panda, Tamimi, Carrefour, LuLu, Othaim, Nana, Al Raya, Manuel, Spar, Etho Al Jazirah / عذق الجزيرة, and others). Receipts may be Arabic, English, or both. Return ONLY JSON, no prose, no markdown.

${multi
  ? `You are given ${imgs.length} images. They are OVERLAPPING vertical slices of ONE single receipt, ordered top to bottom. Items near a slice boundary appear in two slices — output each item ONCE. Use the item code plus the line total to recognise a repeat. Do not merge two different items that happen to share a price.`
  : `You are given one image of one receipt.`}

TRANSCRIBE — DO NOT TIDY, TRANSLATE OR IMPROVE:
- Copy the product name EXACTLY as printed, character for character, including abbreviations, brand spellings and odd spacing.
- NEVER replace a printed word with a more familiar product name. Real failures to avoid: "قشطة المراعي لايت" must not become "بسطرمة البراعي"; "لبن المراعي كامل الدسم" must not become "لحم بقري فاخر"; "تفاح احمر" must not become "لحم دجاج"; "جزر" must not become "هل".
- If a name is blurred, curled, glared, faded, or cut off at a slice edge — or if you are simply not certain — set "name_ar" to null and "confidence" to "low". Null is a CORRECT answer here; the app asks the shopper to pick that one line. A guessed name is a serious error: it files the wrong product and the wrong price and the shopper cannot tell.
- Guessing is never better than null. Do not smooth a partial reading into a whole word.

ITEM CODES — fill this in for every line you can:
Most Saudi receipts print an item code per line (4 to 14 digits — a PLU like 200003 or a barcode like 6281102721756). Copy it into "code" exactly as printed. On a poor photo this is the most trustworthy field on the line, so look for it before anything else. If no code is printed or it is unreadable, code = null.

GROUPING — the failure that ruins whole receipts:
One item's code, its qty/amount figures, and its name are frequently printed on two or three SEPARATE physical lines (code on one line, amount and quantity on the next, name on another). Group all of them into ONE object for that item. Do NOT pair a name with the neighbouring item's numbers — an off-by-one here corrupts every line below it. If you cannot tell which name belongs to a set of numbers, emit the numbers with "name_ar": null and "confidence": "low" rather than pairing by position and hoping.

Schema:
{
 "store": "Danube" | "Panda" | "Tamimi" | "Carrefour" | "LuLu" | "Othaim" | "Nana" | "Al Raya" | "Manuel" | "Spar" | "Other",
 "store_raw": "<store name as printed>",
 "date": "YYYY-MM-DD" | null,
 "total": <number, SAR, grand total paid> | null,
 "lines": [
   { "code": "<item code digits as printed>" | null,
     "name_ar": "<product name exactly as printed>" | null,
     "confidence": "high" | "low",
     "qty": <number, default 1>,
     "unit_price": <number|null>,
     "line_total": <number>,
     "match": "<exact string from the HOUSEHOLD CATALOG below, or null>",
     "category": "veg|bread|dairy|meat|fish|can|oat|spice|coffee|home|other" }
 ]
}

Rules: ignore subtotals, VAT lines, discount summaries, loyalty points, piece counts and payment lines. Keep quantities and totals in SAR. Match to the catalog ONLY when the name you actually read is clearly that same product (receipt 'ALMARAI FRESH MILK FF 2L' matches catalog 'حليب (كامل الدسم)'). If "name_ar" is null, or "confidence" is "low", or you are unsure: "match": null. Never match on the basis of a guessed name.

HOUSEHOLD CATALOG:
${names.join("\n")}`;

  const content = [];
  imgs.forEach((b64, i) => {
    if (multi) content.push({ type: "text", text: `Slice ${i + 1} of ${imgs.length} (top to bottom):` });
    content.push({ type: "image", source: { type: "base64", media_type: mime || "image/jpeg", data: b64 } });
  });
  content.push({ type: "text", text: multi
    ? "Read this receipt across all slices and return the JSON. Each item once. Leave a name null rather than guessing it."
    : "Read this receipt and return the JSON. Leave a name null rather than guessing it." });
  const messages = [{ role: "user", content }];

  let out = null;
  try { out = parseJSON(textOf(await claude({ model: MODEL_RECEIPT, max_tokens: 4000, system, messages }))); } catch (e) { out = null; }
  if (!out || !Array.isArray(out.lines) || !out.lines.length) {
    out = parseJSON(textOf(await claude({ model: MODEL, max_tokens: 4000, system, messages })));
  }
  await bump("receipts", 1);

  // Clean each line, then drop slice-overlap duplicates (same code, or same name+total).
  const seen = new Set();
  const lines = [];
  for (const l of (out.lines || [])) {
    const code = digits(l.code).slice(0, 14);
    const total = Number(l.line_total) || 0;
    const nm = l.name_ar == null ? null : String(l.name_ar).trim().slice(0, 80) || null;
    const low = String(l.confidence || "").toLowerCase() === "low" || !nm;
    const key = code ? "c:" + code + ":" + total.toFixed(2) : "n:" + normAr(nm || l.raw || "") + ":" + total.toFixed(2);
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push({
      code: code || null,
      raw: String(l.raw || "").slice(0, 160),
      name_ar: nm,
      confidence: low ? "low" : "high",
      qty: Number(l.qty) > 0 ? Number(l.qty) : 1,
      unit_price: l.unit_price != null && Number(l.unit_price) > 0 ? Number(l.unit_price) : null,
      line_total: total,
      // A match derived from an unreadable name is worse than no match at all.
      match: !low && l.match && names.includes(l.match) ? l.match : null,
      category: l.category || "other",
      known: !!code && knownSet.has(code),
    });
  }
  out.lines = lines;

  // Reconcile: if the lines don't add up to the printed total, say so instead of
  // presenting a tidy screen that is quietly missing or double-counting an item.
  const sum = lines.reduce((a, l) => a + (l.line_total || 0), 0);
  const tot = Number(out.total) || 0;
  out.sum = Math.round(sum * 100) / 100;
  out.unreadable = lines.filter((l) => l.confidence === "low").length;
  out.mismatch = tot > 0 && Math.abs(sum - tot) > Math.max(1, tot * 0.02) ? Math.round((sum - tot) * 100) / 100 : 0;
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
    if (u.est + todo.length * 0.6 > BUDGET_SAR) { const err = new Error("budget"); err.code = 402; throw err; } // don't start what would cross the cap
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
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: Math.min(6, todo.length * 2) }],
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
    if (action === "snapshot" && role === "full") {
      const name = String(body.name || "").replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 32) || "manual";
      const raw = await kv(["GET", STATE_KEY]);
      const photos = await kv(["GET", "maqadi:photos"]);
      await kv(["SET", "maqadi:snapshot:" + name, JSON.stringify({ ts: Date.now(), state: raw, photos })]);
      return res.status(200).json({ ok: true, name, bytes: (raw || "").length });
    }
    if (action === "restore" && role === "full") {
      const name = String(body.name || "").replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 32);
      const snap = await kv(["GET", "maqadi:snapshot:" + name]);
      if (!snap) return res.status(404).json({ error: "no snapshot" });
      const j = JSON.parse(snap);
      const cur = await readState();
      const parsed = j.state ? JSON.parse(j.state) : { state: null };
      await writeState((cur.v || 0) + 1, parsed.state);
      if (j.photos) await kv(["SET", "maqadi:photos", j.photos]);
      return res.status(200).json({ ok: true, restored: name, from: j.ts });
    }
    if (action === "taskstate") {
      if (role !== "full") return res.status(403).json({ error: "role" });
      const raw = await kv(["GET", "maham:state"]);
      const j = raw ? JSON.parse(raw) : { v: 0, state: null };
      return res.status(200).json(j);
    }
    if (action === "tasksave") {
      if (role !== "full") return res.status(403).json({ error: "role" });
      const raw = await kv(["GET", "maham:state"]);
      const cur = raw ? JSON.parse(raw) : { v: 0, state: null };
      if (Number(body.v) !== Number(cur.v)) return res.status(409).json({ conflict: true, ...cur });
      const nv = cur.v + 1;
      await kv(["SET", "maham:state", JSON.stringify({ v: nv, state: body.state, ts: Date.now() })]);
      return res.status(200).json({ v: nv });
    }
    if (action === "tasksnapshot" && role === "full") {
      const name = String(body.name || "manual").replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 32);
      const raw = await kv(["GET", "maham:state"]);
      await kv(["SET", "maham:snapshot:" + name, JSON.stringify({ ts: Date.now(), state: raw })]);
      return res.status(200).json({ ok: true, name, bytes: (raw || "").length });
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
    if (action === "reconcile") {
      if (!ANTHROPIC_KEY) return res.status(500).json({ error: "anthropic env missing" });
      const names = (body.catalog || []).slice(0, 400);
      const lines = (Array.isArray(body.lines) ? body.lines : []).slice(0, 80).map((l) => ({ ...l, known: !!l.known }));
      const out = await reconcile({ store: body.store, lines, names });
      out.forEach((l) => { delete l.known; });
      return res.status(200).json({ lines: out, unreadable: out.filter((l) => l.confidence === "low").length });
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


// ---- وين نروح؟ (wain) backend — routed by ?app=wain, folded in for the 12-function limit ----
// Actions: state | save | resolve | eta
// Env: KV_REST_API_URL, KV_REST_API_TOKEN, (optional) GOOGLE_MAPS_KEY, WAIN_PIN, WAIN_PIN_2
const WAIN_KEY = "wain:state";
const WAIN_PINS = [process.env.WAIN_PIN || PIN_FULL, process.env.WAIN_PIN_2 || PIN_LITE].filter(Boolean);
const GMAPS_KEY = process.env.GOOGLE_MAPS_KEY || "";

async function wainRead() {
  const raw = await kv(["GET", WAIN_KEY]);
  if (!raw) return { v: 0, state: null };
  try { const j = JSON.parse(raw); return { v: Number(j.v || 0), state: j.state || null }; } catch { return { v: 0, state: null }; }
}
function parseCoords(u) {
  const m = u.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) || u.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) || u.match(/[?&](?:q|ll|query|destination|center)=(-?\d+\.\d+),(-?\d+\.\d+)/);
  return m ? { lat: Number(m[1]), lng: Number(m[2]) } : null;
}
async function wainResolve(url) {
  let final = String(url || "").trim();
  if (!/^https?:\/\//.test(final)) return { lat: null, lng: null };
  let html = "";
  try {
    const r = await fetch(final, { redirect: "follow", headers: { "User-Agent": "Mozilla/5.0" } });
    final = r.url || final;
    html = (await r.text().catch(() => "")).slice(0, 400000);
  } catch {}
  let c = parseCoords(final) || parseCoords(html) || null;
  let name = null;
  const nm = final.match(/\/place\/([^/@?]+)/); if (nm) name = decodeURIComponent(nm[1]).replace(/\+/g, " ");
  return { lat: c ? c.lat : null, lng: c ? c.lng : null, name, url: final };
}
async function wainEta(body) {
  if (!GMAPS_KEY) return { ok: false, reason: "no key" };
  const o = body.from, d = (body.to || []).slice(0, 25);
  if (!o || !d.length) return { ok: false };
  const u = new URL("https://maps.googleapis.com/maps/api/distancematrix/json");
  u.searchParams.set("origins", o.lat + "," + o.lng);
  u.searchParams.set("destinations", d.map(x => x.lat + "," + x.lng).join("|"));
  u.searchParams.set("departure_time", "now"); u.searchParams.set("key", GMAPS_KEY);
  const j = await (await fetch(u)).json();
  const row = j.rows && j.rows[0] && j.rows[0].elements || [];
  return { ok: true, etas: row.map(e => e.status === "OK" ? { min: Math.round((e.duration_in_traffic || e.duration).value / 60), km: Math.round(e.distance.value / 1000) } : null) };
}
async function wainHandler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Pin");
  if (req.method === "OPTIONS") return res.status(204).end();
  try {
    const body = req.method === "POST" ? (typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {})) : {};
    const action = body.action || req.query.action || "state";
    const pin = String(req.headers["x-pin"] || body.pin || req.query.pin || "").trim();
    if (!pin || !WAIN_PINS.includes(pin)) return res.status(401).json({ error: "pin" });
    if (!KV_URL || !KV_TOKEN) return res.status(500).json({ error: "kv env missing" });
    if (action === "state") { const s = await wainRead(); return res.status(200).json(s); }
    if (action === "save") {
      const cur = await wainRead();
      if (Number(body.v) !== Number(cur.v)) return res.status(409).json({ conflict: true, ...cur });
      const st = body.state || {};
      if (JSON.stringify(st).length > 900000) return res.status(413).json({ error: "too big" });
      const nv = cur.v + 1;
      await kv(["SET", WAIN_KEY, JSON.stringify({ v: nv, state: st, ts: Date.now() })]);
      return res.status(200).json({ v: nv });
    }
    if (action === "resolve") return res.status(200).json(await wainResolve(body.url));
    if (action === "eta") return res.status(200).json(await wainEta(body));
    return res.status(400).json({ error: "unknown action" });
  } catch (e) {
    return res.status(500).json({ error: String(e && e.message ? e.message : e) });
  }
}

// ============================================================
// Router: GET = health check (unchanged). POST/OPTIONS = مقاضي app.
// ============================================================
export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.query && req.query.app === 'wain') return wainHandler(req, res);
  if (req.method === 'POST' || req.method === 'OPTIONS' || (req.query && req.query.app === 'maqadi')) {
    return maqadiHandler(req, res);
  }
  return healthHandler(req, res);
}
