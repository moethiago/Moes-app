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
const LITE_BLOCKED = ["receipt", "reconcile", "scan", "compare", "photoset", "setkey", "keystatus"];
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

/* ---------------- scan: one photo in, line items out ----------------
   Azure's prebuilt-receipt model is purpose-built for this: it does layout, row
   reconstruction and field extraction in one call, supports Arabic, and the F0 tier is
   500 receipts/month free. When AZURE_DI_KEY is absent we fall back to Claude vision on
   slices, run in PARALLEL so the whole thing stays inside the 60 s function limit
   (running them in sequence is what produced "Fetch is aborted"). */
const AZ_KEY = process.env.AZURE_DI_KEY;
const AZ_ENDPOINT = (process.env.AZURE_DI_ENDPOINT || "").replace(/\/+$/, "");
function azNum(f) {
  if (!f) return null;
  const v = f.valueCurrency && f.valueCurrency.amount != null ? f.valueCurrency.amount
    : f.valueNumber != null ? f.valueNumber : f.content != null ? Number(String(f.content).replace(/[^\d.]/g, "")) : null;
  return v != null && !isNaN(v) ? Number(v) : null;
}
async function azureReceipt(image, mime) {
  const url = AZ_ENDPOINT + "/documentintelligence/documentModels/prebuilt-receipt:analyze?api-version=2024-11-30";
  const r = await fetch(url, {
    method: "POST",
    headers: { "Ocp-Apim-Subscription-Key": AZ_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ base64Source: image }),
  });
  if (r.status !== 202) {
    const j = await r.json().catch(() => ({}));
    throw new Error("azure: " + (j.error && j.error.message ? j.error.message : r.status));
  }
  const loc = r.headers.get("operation-location") || r.headers.get("Operation-Location");
  if (!loc) throw new Error("azure: no operation location");
  for (let i = 0; i < 25; i++) {
    await new Promise((s) => setTimeout(s, 1200));
    const p = await fetch(loc, { headers: { "Ocp-Apim-Subscription-Key": AZ_KEY } });
    const j = await p.json().catch(() => ({}));
    if (j.status === "succeeded") return j;
    if (j.status === "failed") throw new Error("azure: analysis failed");
  }
  throw new Error("azure: timed out");
}
function fromAzure(j, names) {
  const doc = ((j.analyzeResult || {}).documents || [])[0] || {};
  const f = doc.fields || {};
  const items = ((f.Items || {}).valueArray || []).map((it) => {
    const o = (it && it.valueObject) || {};
    const qty = azNum(o.Quantity);
    const unit = azNum(o.Price);
    let total = azNum(o.TotalPrice);
    const name = o.Description && o.Description.content ? String(o.Description.content).replace(/\s+/g, " ").trim() : null;
    if (total == null && unit != null && qty != null) total = Math.round(unit * qty * 100) / 100;
    const conf = Math.min(...[it && it.confidence, o.Description && o.Description.confidence].filter((x) => typeof x === "number").concat([1]));
    return { code: null, raw: name || "", name_ar: name, confidence: name && conf >= 0.5 ? "high" : "low",
      qty: qty > 0 ? qty : 1, unit_price: unit, line_total: total || 0, match: null, category: "other" };
  }).filter((l) => l.name_ar || l.line_total);
  const total = azNum(f.Total);
  const sum = items.reduce((a, l) => a + (l.line_total || 0), 0);
  const seller = f.MerchantName && f.MerchantName.content ? String(f.MerchantName.content).trim() : "";
  let date = null;
  if (f.TransactionDate && f.TransactionDate.valueDate) date = String(f.TransactionDate.valueDate).slice(0, 10);
  return { engine: "azure", store: "Other", store_raw: seller, seller, date, total,
    vat: azNum(f.TotalTax), lines: items, sum: Math.round(sum * 100) / 100,
    unreadable: items.filter((l) => l.confidence === "low").length,
    mismatch: total > 0 && Math.abs(sum - total) > Math.max(1, total * 0.02) ? Math.round((sum - total) * 100) / 100 : 0 };
}

const SCAN_PROMPT = `You are extracting grocery purchases from a Saudi Arabic supermarket receipt.

Read the receipt visually. Do NOT use OCR text as the primary method.

For EVERY purchased item, identify:
- product name exactly as printed
- quantity
- weight if applicable
- line total in SAR

The receipt is a table. Each item may have:
- a product/code line
- the product name underneath it
- quantity and price in separate columns

Keep these physically associated.

DO NOT invent or guess a product name.
If the product name is unclear, return "UNCLEAR".

Ignore:
- VAT
- subtotal
- total
- payment information
- invoice number
- barcode
- store information

Return ONLY valid JSON:

{
  "items": [
    {
      "name": "...",
      "quantity": 1,
      "weight_kg": null,
      "price_sar": 0.00,
      "confidence": 0.0
    }
  ],
  "receipt_total_sar": 0.00
}`;
/* Map the schema above onto the shape the app's review screen consumes. "UNCLEAR" and
   any confidence below 0.6 become a low-confidence row: shown with its price, never
   given a product match, and flagged for him to pick. */
function fromScanSchema(out, engine) {
  const seen = new Set(), lines = [];
  // accept either the requested schema or a bare array of {itemName, quantity, price}
  const src = Array.isArray(out) ? out : Array.isArray(out && out.items) ? out.items : [];
  for (const it of src) {
    const total = Number(it && (it.price_sar != null ? it.price_sar : it.price)) || 0;
    const wt = it && it.weight_kg != null ? Number(it.weight_kg) : null;
    let qty = Number(it && it.quantity) > 0 ? Number(it.quantity) : 1;
    if (wt > 0) qty = wt;
    const conf = typeof (it && it.confidence) === "number" ? it.confidence : 1;
    const rawName = it && (it.name != null ? it.name : it.itemName);
    let nm = rawName != null ? String(rawName).trim().slice(0, 80) : "";
    const unclear = !nm || /^unclear$/i.test(nm) || conf < 0.6;
    if (unclear && !total) continue;
    nm = /^unclear$/i.test(nm) ? null : (nm || null);
    const key = normAr(nm || "") + ":" + total.toFixed(2) + ":" + qty;
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push({ code: null, raw: (nm || "UNCLEAR") + " " + total,
      name_ar: unclear ? null : nm, confidence: unclear ? "low" : "high",
      qty, unit_price: qty > 0 && total > 0 ? Math.round(total / qty * 100) / 100 : null,
      line_total: total, match: null, category: "other", weight_kg: wt });
  }
  const sum = lines.reduce((a, l) => a + (l.line_total || 0), 0);
  const tot = Number(out && !Array.isArray(out) ? (out.receipt_total_sar != null ? out.receipt_total_sar : out.total) : 0) || 0;
  return { engine, store: "Other", store_raw: "", seller: "", date: null, total: tot || null, vat: null,
    lines, sum: Math.round(sum * 100) / 100,
    unreadable: lines.filter((l) => l.confidence === "low").length,
    mismatch: tot > 0 && Math.abs(sum - tot) > Math.max(1, tot * 0.02) ? Math.round((sum - tot) * 100) / 100 : 0 };
}

/* ---------------- reader key, stored server-side ----------------
   He pastes an OpenAI key once in the app; it is kept in his own Upstash, never in
   localStorage and never returned to the browser. A key in a GitHub Pages frontend
   would be readable by anyone who opens the page source or the dev tools. */
const KEY_STORE = "maqadi:reader_key";
async function readerKey() {
  if (OA_KEY) return OA_KEY;
  try { const v = await kv(["GET", KEY_STORE]); return v ? String(v) : null; } catch { return null; }
}
function maskKey(k) { return k ? String(k).slice(0, 3) + "…" + String(k).slice(-4) : null; }

/* ---------------- GPT engine ----------------
   Same job as the Azure engine, different vendor: one photo (or slices) in, line items
   out. Kept behind its own env var so the engine is swappable without touching the app.
   Slices are sent in ONE request as several images, so latency stays inside the 60 s
   function limit. */
const OA_KEY = process.env.OPENAI_API_KEY;
const OA_MODEL = process.env.OPENAI_MODEL || "gpt-4.1";
async function gptReceipt(imgs, mime, key) {
  const content = [{ type: "text", text: imgs.length > 1
    ? `These ${imgs.length} images are OVERLAPPING vertical slices of ONE receipt, top to bottom. Output every item ONCE.`
    : "This is one photo of one receipt." }];
  imgs.forEach((b64) => content.push({ type: "image_url", image_url: { url: "data:" + (mime || "image/jpeg") + ";base64," + b64, detail: "high" } }));
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
    body: JSON.stringify({ model: OA_MODEL, max_tokens: 4000, response_format: { type: "json_object" },
      messages: [{ role: "system", content: SCAN_PROMPT }, { role: "user", content }] }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error("openai: " + (j.error && j.error.message ? j.error.message : r.status));
  const txt = j.choices && j.choices[0] && j.choices[0].message ? j.choices[0].message.content : "";
  const out = parseJSON(txt);
  if (!out || (!Array.isArray(out) && !Array.isArray(out.items))) throw new Error("openai: no items");
  return fromScanSchema(out, "gpt");
}
function normalizeScan(out, names, knownSet) {
  const seen = new Set(), lines = [];
  for (const l of (out.lines || [])) {
    const code = digits(l.code).slice(0, 14);
    const total = Number(l.line_total) || 0;
    const nm = l.name_ar == null ? null : String(l.name_ar).trim().slice(0, 80) || null;
    const low = String(l.confidence || "").toLowerCase() === "low" || !nm;
    const key = code ? "c:" + code + ":" + total.toFixed(2) : "n:" + normAr(nm || "") + ":" + total.toFixed(2);
    if (seen.has(key)) continue;
    seen.add(key);
    let qty = Number(l.qty) > 0 ? Number(l.qty) : 1;
    let unit = l.unit_price != null && Number(l.unit_price) > 0 ? Number(l.unit_price) : null;
    if (unit == null && qty > 0 && total > 0) unit = Math.round(total / qty * 100) / 100;
    lines.push({ code: code || null, raw: String(l.raw || nm || "").slice(0, 160), name_ar: nm,
      confidence: low ? "low" : "high", qty, unit_price: unit, line_total: total,
      match: !low && l.match && names.includes(l.match) ? l.match : null, category: l.category || "other",
      known: !!code && knownSet.has(code) });
  }
  const sum = lines.reduce((a, l) => a + (l.line_total || 0), 0);
  const tot = Number(out.total) || 0;
  return { engine: out.engine || "gpt", store: out.store || "Other", store_raw: out.store_raw || "", seller: out.store_raw || "",
    date: out.date || null, total: tot || null, vat: out.vat != null ? Number(out.vat) : null, lines,
    sum: Math.round(sum * 100) / 100, unreadable: lines.filter((l) => l.confidence === "low").length,
    mismatch: tot > 0 && Math.abs(sum - tot) > Math.max(1, tot * 0.02) ? Math.round((sum - tot) * 100) / 100 : 0 };
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

async function claudeScan(imgs, mime) {
  const one = async (b64, i) => {
    const content = [{ type: "image", source: { type: "base64", media_type: mime || "image/jpeg", data: b64 } }];
    content.push({ type: "text", text: imgs.length > 1
      ? `This is slice ${i + 1} of ${imgs.length} of ONE receipt, top to bottom. Return the JSON for the items visible in THIS slice only.`
      : "Return the JSON for this receipt." });
    return parseJSON(textOf(await claude({ model: MODEL_RECEIPT, max_tokens: 4000, system: SCAN_PROMPT, messages: [{ role: "user", content }] })));
  };
  // slices go out together: total latency is the slowest slice, not the sum of them
  const per = (await Promise.all(imgs.map((b, i) => one(b, i).catch(() => null)))).filter(Boolean);
  if (!per.length) throw new Error("claude: no response");
  const merged = { items: [], receipt_total_sar: 0 };
  per.forEach((r) => {
    if (Array.isArray(r.items)) merged.items = merged.items.concat(r.items);
    const t = Number(r.receipt_total_sar) || 0;
    if (t > merged.receipt_total_sar) merged.receipt_total_sar = t;
  });
  const out = fromScanSchema(merged, "claude");
  if (!out.lines.length) throw new Error("claude: no items");
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
    if (action === "keystatus") {
      const k = await readerKey();
      return res.status(200).json({ hasKey: !!k, masked: maskKey(k), fromEnv: !!OA_KEY, engines: [k ? "gpt" : null, AZ_KEY && AZ_ENDPOINT ? "azure" : null, ANTHROPIC_KEY ? "claude" : null].filter(Boolean) });
    }
    if (action === "setkey") {
      const k = String(body.key || "").trim();
      if (!k) { await kv(["DEL", KEY_STORE]); return res.status(200).json({ ok: true, hasKey: !!OA_KEY }); }
      if (!/^sk-[A-Za-z0-9_\-]{20,}$/.test(k)) return res.status(400).json({ error: "المفتاح لازم يبدأ ب sk- ويكون كامل" });
      await kv(["SET", KEY_STORE, k]);
      return res.status(200).json({ ok: true, hasKey: true, masked: maskKey(k) });
    }
    if (action === "scan") {
      const imgs = (Array.isArray(body.images) && body.images.length ? body.images : [body.image]).filter(Boolean);
      if (!imgs.length) return res.status(400).json({ error: "no image" });
      const names = (body.catalog || []).slice(0, 400);
      const knownSet = new Set((Array.isArray(body.known) ? body.known : []).map((c) => digits(c)).filter(Boolean));
      const oaKey = await readerKey();
      const engines = [];
      if (oaKey) engines.push("gpt");
      if (AZ_KEY && AZ_ENDPOINT) engines.push("azure");
      if (ANTHROPIC_KEY) engines.push("claude");
      if (!engines.length) return res.status(500).json({ error: "no reader configured" });
      const want = body.engine && engines.indexOf(body.engine) >= 0 ? body.engine : engines[0];
      const tried = [];
      // try the chosen engine, then the others, so one vendor being down is not an outage
      for (const eng of [want].concat(engines.filter((e) => e !== want))) {
        try {
          let out = null;
          if (eng === "gpt") out = await gptReceipt(imgs, body.mime, oaKey);
          else if (eng === "azure") out = fromAzure(await azureReceipt(imgs[0], body.mime), names);
          else out = await claudeScan(imgs, body.mime);
          if (out && out.lines.length) {
            // codes are not in the requested schema; mark what the household already knows by name
            out.lines.forEach((l) => { l.known = !!(l.code && knownSet.has(l.code)); });
            await bump("receipts", 1); out.tried = tried;
            return res.status(200).json(out);
          }
          tried.push(eng + ": no lines");
        } catch (e) { tried.push(eng + ": " + String(e.message || e).slice(0, 120)); }
      }
      return res.status(502).json({ error: "ما قدرنا نقرأ الفاتورة", tried });
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
