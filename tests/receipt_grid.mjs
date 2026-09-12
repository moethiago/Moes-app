// Receipt reader scenario grid for api/health-check.js.
// In-memory Upstash + MOCKED Anthropic — no real AI call, no spend. The fixture is the
// real عذق الجزيرة receipt of 12 Sep 2026: 22 lines summing to exactly 219.27 SAR.
// Exists because v2.2 returned 21 confident lines with invented Arabic names
// (تفاح احمر -> "لحم دجاج", قشطة المراعي -> "بسطرمة البراعي") and one item dropped.
import { pathToFileURL } from 'node:url'; import { resolve as _resolvePath } from 'node:path';
const file = pathToFileURL(_resolvePath(process.cwd(), process.argv[2] || './api/health-check.js')).href;
process.env.KV_REST_API_URL = "https://kv.mock"; process.env.KV_REST_API_TOKEN = "t";
process.env.DEPLOY_SECRET = "moes-deploy-2026"; process.env.ANTHROPIC_API_KEY = "test-key-mocked";

const store = new Map();
let NEXT = [];            // queue of canned model replies
let SENT = [];            // what we sent to Anthropic, for asserting on the request
globalThis.fetch = async (url, opts = {}) => {
  const u = String(url);
  if (u.startsWith("https://kv.mock")) {
    const [op, k, v] = JSON.parse(opts.body); let result = null;
    if (op === "GET") result = store.has(k) ? store.get(k) : null;
    else if (op === "SET") { store.set(k, v); result = "OK"; }
    else if (op === "DEL") { store.delete(k); result = 1; }
    return new Response(JSON.stringify({ result }), { status: 200 });
  }
  if (u.includes("api.anthropic.com")) {
    const body = JSON.parse(opts.body); SENT.push(body);
    const reply = NEXT.length ? NEXT.shift() : { lines: [] };
    return new Response(JSON.stringify({
      content: [{ type: "text", text: typeof reply === "string" ? reply : JSON.stringify(reply) }],
      usage: { input_tokens: 1000, output_tokens: 500 },
    }), { status: 200 });
  }
  return new Response("{}", { status: 200 });
};
const mod = await import(file);
function call(body, query = {}) {
  return new Promise((resolve) => {
    const res = { code: 200, h: {}, setHeader(k, v) { this.h[k] = v; }, status(c) { this.code = c; return this; },
      json(j) { resolve({ code: this.code, j }); }, end() { resolve({ code: this.code, j: null }); } };
    mod.default({ method: "POST", query, body, headers: {} }, res);
  });
}
let pass = 0, fail = 0; const failures = [];
function check(name, cond, extra) { if (cond) pass++; else { fail++; failures.push(name + (extra ? " — " + extra : "")); } }
store.set("maqadi:state", JSON.stringify({ v: 1, state: { items: {} } }));

const CATALOG = ["جزر", "كوسة", "بقدونس", "خس", "طماطم", "تمر", "فطر", "نعناع", "بصل", "بطاطس",
  "لحم حاشي", "زيتون أسود", "جبنة شرائح", "حليب (كامل الدسم)", "لبن", "قشطة", "خيار", "تفاح", "دجاج", "خبز عربي"];
const L = (code, name, total, qty = 1, unit = null, conf = "high", match = null) =>
  ({ code, raw: code + " " + name + " " + total, name_ar: name, confidence: conf, qty, unit_price: unit, line_total: total, match, category: "other" });

// The real receipt, verbatim, in printed order.
const REAL = [
  L("200003", "كزبرة", 2.00), L("200002", "بقدونس", 2.00, 1, null, "high", "بقدونس"),
  L("200009", "خس ربطة", 7.00, 1, null, "high", "خس"), L("6281102680305", "توست خبز البر هيرفي", 6.50),
  L("0307", "تفاح احمر", 17.52, 1.46, 12.00, "high", "تفاح"), L("3322126", "خبز عربي بر كبير", 1.00, 1, null, "high", "خبز عربي"),
  L("6287027470076", "خيار", 7.00, 1, null, "high", "خيار"), L("200017", "شبت", 2.00),
  L("100013", "فلفل حار", 10.00), L("100114", "ليمون اصفر صحن", 8.00),
  L("100016", "فلفل بارد * 2", 10.00), L("100058", "فلفل شقراء احمر", 10.00),
  L("6287027470045", "طماطم", 4.00, 1, null, "high", "طماطم"), L("6281007066792", "شرائح جبنة برجر 200 جم المراعي", 7.50, 1, null, "high", "جبنة شرائح"),
  L("100036", "بطاطس صغير", 11.00, 1, null, "high", "بطاطس"), L("110003", "بارد ملون", 12.00),
  L("6281102721756", "صدور دجاج انتاج 450 جرام", 66.75, 3, 22.25, "high", "دجاج"),
  L("100063", "جزر", 10.00, 1, null, "high", "جزر"), L("100010", "باذنجان اسود", 5.00),
  L("6261007666527", "قشطة المراعي لايت 100 جرام", 8.00, 2, 4.00, "high", "قشطة"),
  L("6281007023488", "لبن المراعي كامل الدسم 360 مل", 6.00, 2, 3.00, "high", "لبن"),
  L("6281057002858", "حليب نادك طازج كامل الدسم 800 مل", 6.00, 1, null, "high", "حليب (كامل الدسم)"),
];
const R = (lines, total = 219.27) => ({ store: "Other", store_raw: "عذق الجزيرة", date: "2026-09-12", total, lines });
const fire = async (reply, body = {}) => { NEXT = [reply]; SENT = []; return call({ action: "receipt", pin: "2026", catalog: CATALOG, images: ["aaa", "bbb", "ccc"], mime: "image/jpeg", ...body }); };

/* 1 — the real receipt, whole and correct */
let r = await fire(R(REAL));
check("real receipt: 200", r.code === 200, "code " + r.code);
check("real receipt: all 22 lines kept", r.j.lines.length === 22, "got " + r.j.lines.length);
check("real receipt: sum = printed total 219.27", r.j.sum === 219.27, "sum " + r.j.sum);
check("real receipt: no mismatch flagged", r.j.mismatch === 0, "mismatch " + r.j.mismatch);
check("real receipt: nothing marked unreadable", r.j.unreadable === 0);
check("real receipt: codes preserved", r.j.lines[16].code === "6281102721756");
check("real receipt: kg qty survives (1.46 x 12 = 17.52)", r.j.lines[4].qty === 1.46 && r.j.lines[4].unit_price === 12 && r.j.lines[4].line_total === 17.52);
check("real receipt: multi-qty survives (3 x 22.25 = 66.75)", r.j.lines[16].qty === 3 && r.j.lines[16].line_total === 66.75);
check("real receipt: حليب نادك not dropped", r.j.lines.some((l) => l.name_ar.indexOf("نادك") >= 0));
check("real receipt: good matches kept", r.j.lines[17].match === "جزر" && r.j.lines[21].match === "حليب (كامل الدسم)");

/* 2 — prompt actually carries the anti-guessing contract */
const sys = SENT[0].system;
check("prompt: forbids substituting familiar names", /NEVER replace a printed word/.test(sys));
check("prompt: allows null name", /name_ar.{0,40}null/s.test(sys) && /Null is a CORRECT answer/.test(sys));
check("prompt: asks for item code", /ITEM CODES/.test(sys));
check("prompt: warns about multi-physical-line grouping", /SEPARATE physical lines/.test(sys));
check("prompt: tells model the slices overlap", /OVERLAPPING vertical slices/.test(sys));
check("request: all 3 slices sent as images", SENT[0].messages[0].content.filter((c) => c.type === "image").length === 3);
check("request: slices labelled in order", SENT[0].messages[0].content.some((c) => c.type === "text" && /Slice 1 of 3/.test(c.text)));

/* 3 — the v2.2 failure: a guessed name that fuzzy-matches the catalog */
r = await fire(R([L("0307", "لحم دجاج", 17.52, 1.46, 12.00, "low", "لحم حاشي")], 17.52));
check("guessed name: match refused when confidence low", r.j.lines[0].match === null);
check("guessed name: line + price still kept", r.j.lines[0].line_total === 17.52 && r.j.lines[0].qty === 1.46);
check("guessed name: flagged unreadable for the shopper", r.j.unreadable === 1 && r.j.lines[0].confidence === "low");

/* 4 — unreadable name comes back as null, not invented */
r = await fire(R([{ code: "6261007666527", raw: "6261007666527 2.00 8.00", name_ar: null, confidence: "high", qty: 2, unit_price: 4, line_total: 8.00, match: "قشطة", category: "dairy" }], 8.00));
check("null name: kept as null", r.j.lines[0].name_ar === null);
check("null name: forced to low confidence", r.j.lines[0].confidence === "low");
check("null name: match dropped even though model was 'high'", r.j.lines[0].match === null);
check("null name: code survives to identify it later", r.j.lines[0].code === "6261007666527");

/* 5 — slice overlap duplicates */
r = await fire(R(REAL.concat([REAL[15], REAL[16], REAL[17]])));
check("overlap: repeated lines deduped to 22", r.j.lines.length === 22, "got " + r.j.lines.length);
check("overlap: total still reconciles", r.j.sum === 219.27 && r.j.mismatch === 0);

/* 6 — same price, different item: must NOT be deduped (his receipt has 2x2.00 and 4x10.00) */
r = await fire(R(REAL));
check("distinct items sharing a price survive (2.00 twice)", r.j.lines.filter((l) => l.line_total === 2.00).length === 3, "got " + r.j.lines.filter((l) => l.line_total === 2).length);
check("distinct items sharing a price survive (10.00 four times)", r.j.lines.filter((l) => l.line_total === 10.00).length === 4);

/* 7 — no code printed: dedupe falls back to name+total, and still distinguishes items */
r = await fire(R([L(null, "جزر", 10.00), L(null, "جزر", 10.00), L(null, "فلفل حار", 10.00)], 20.00));
check("no code: identical name+total deduped", r.j.lines.length === 2, "got " + r.j.lines.length);
check("no code: different name same total kept", r.j.lines.some((l) => l.name_ar === "فلفل حار"));

/* 8 — a dropped line is surfaced, not hidden */
r = await fire(R(REAL.slice(0, 21)));
check("dropped line: mismatch reported", r.j.mismatch !== 0, "mismatch " + r.j.mismatch);
check("dropped line: mismatch is the missing amount (-6)", Math.abs(r.j.mismatch + 6) < 0.01, "got " + r.j.mismatch);

/* 9 — rounding noise must not be flagged as a mismatch */
r = await fire(R(REAL, 219.30));
check("rounding: 0.03 drift not flagged", r.j.mismatch === 0);

/* 10 — match not in the household catalog is refused */
r = await fire(R([L("100063", "جزر", 10.00, 1, null, "high", "جزر بلدي عضوي")], 10.00));
check("fake catalog match refused", r.j.lines[0].match === null);

/* 11 — single image, old client (back-compat) */
NEXT = [R(REAL)]; SENT = [];
r = await call({ action: "receipt", pin: "2026", catalog: CATALOG, image: "aaa", mime: "image/jpeg" });
check("single image: still works", r.code === 200 && r.j.lines.length === 22);
check("single image: one image block sent", SENT[0].messages[0].content.filter((c) => c.type === "image").length === 1);
check("single image: no overlap wording in prompt", !/OVERLAPPING vertical slices/.test(SENT[0].system));

/* 12 — first model returns junk, second model is tried */
NEXT = [{ lines: [] }, R(REAL)]; SENT = [];
r = await call({ action: "receipt", pin: "2026", catalog: CATALOG, images: ["a", "b"], mime: "image/jpeg" });
check("empty first reply: falls back to second model", r.code === 200 && r.j.lines.length === 22);
check("fallback used a different model (+1 reconcile call)", SENT.length === 3);

/* 12b — reconcile: reason from price + brand on lines the household has not confirmed */
const fire2 = async (vision, reason, body = {}) => { NEXT = [vision, reason]; SENT = []; return call({ action: "receipt", pin: "2026", catalog: CATALOG, images: ["a", "b"], mime: "image/jpeg", ...body }); };
r = await fire2(R([L("6261007666527", "حلبة المراعي لايت 100 جرام", 8, 2, 4), L("200003", "زيرة", 2)], 10),
               [{ i: 0, name: "قشطة المراعي لايت 100 جرام", match: "قشطة", confidence: "high" }, { i: 1, name: "كزبرة", match: null, confidence: "low" }]);
check("reconcile: a second, text-only call is made", SENT.length === 2 && !SENT[1].messages[0].content.some || typeof SENT[1].messages[0].content === "string");
check("reconcile: prompt teaches letter swaps and price reasoning", /ق↔ح/.test(SENT[1].system) && /unit price/.test(SENT[1].system));
check("reconcile: high fixes the misread name", r.j.lines[0].name_ar === "قشطة المراعي لايت 100 جرام");
check("reconcile: high sets the catalog match", r.j.lines[0].match === "قشطة" && r.j.lines[0].confidence === "high");
check("reconcile: what OCR read is kept for the record", r.j.lines[0].read_as === "حلبة المراعي لايت 100 جرام");
check("reconcile: low stays low with a hint, no match", r.j.lines[1].confidence === "low" && r.j.lines[1].hint === "كزبرة" && r.j.lines[1].match === null);
check("reconcile: low keeps the OCR name for display", r.j.lines[1].name_ar === "زيرة");
check("reconcile: lines flagged as reasoned", r.j.lines.every((l) => l.reasoned === true));
check("reconcile: unreadable count reflects the outcome", r.j.unreadable === 1);

// known codes are skipped entirely - no second call, no changes
r = await fire2(R([L("6261007666527", "حلبة المراعي لايت 100 جرام", 8, 2, 4)], 8),
               [{ i: 0, name: "SHOULD NOT APPLY", match: "قشطة", confidence: "high" }], { known: ["6261007666527"] });
check("known code: no reconcile call at all", SENT.length === 1, "calls " + SENT.length);
check("known code: line untouched", r.j.lines[0].name_ar === "حلبة المراعي لايت 100 جرام" && !r.j.lines[0].reasoned);
check("known flag not leaked to client", !("known" in r.j.lines[0]));

// reconcile never touches a known line even if it answers for it
r = await fire2(R([L("6261007666527", "حلبة", 8), L("200003", "زيرة", 2)], 10),
               [{ i: 0, name: "X", match: "قشطة", confidence: "high" }, { i: 1, name: "كزبرة", match: null, confidence: "high" }], { known: ["6261007666527"] });
check("mixed: known line ignored by reconcile", r.j.lines[0].name_ar === "حلبة" && !r.j.lines[0].reasoned);
check("mixed: unknown line fixed", r.j.lines[1].name_ar === "كزبرة" && r.j.lines[1].confidence === "high");

// garbage from the reasoner must not corrupt anything
r = await fire2(R([L("200003", "زيرة", 2)], 2), "not json at all");
check("reconcile garbage: lines unchanged", r.j.lines[0].name_ar === "زيرة" && r.j.lines.length === 1);
r = await fire2(R([L("200003", "زيرة", 2)], 2), [{ i: 0, name: "كزبرة", match: "not in catalog", confidence: "high" }]);
check("reconcile: fake catalog match refused, name still fixed", r.j.lines[0].match === null && r.j.lines[0].name_ar === "كزبرة");
r = await fire2(R([L("200003", "زيرة", 2)], 2), [{ i: 7, name: "كزبرة", confidence: "high" }]);
check("reconcile: out-of-range index ignored", r.j.lines[0].name_ar === "زيرة");
r = await fire2(R([L("200003", "زيرة", 2)], 2), [{ i: 0, name: "", confidence: "high" }]);
check("reconcile: empty name cannot be 'high'", r.j.lines[0].confidence === "low" && r.j.lines[0].name_ar === "زيرة");

/* 13 — junk in the code field is normalised to digits */
r = await fire(R([L("  62810-07023488 ", "لبن", 6.00)], 6.00));
check("code normalised to digits", r.j.lines[0].code === "6281007023488");
r = await fire(R([L("n/a", "لبن", 6.00)], 6.00));
check("non-numeric code becomes null", r.j.lines[0].code === null);

/* 14 — wife's code must never reach the receipt reader */
r = await call({ action: "receipt", pin: "1234", catalog: CATALOG, images: ["a"] });
check("lite pin blocked from receipts", r.code === 403, "code " + r.code);

/* 15 — grocery state untouched by reading a receipt */
const before = store.get("maqadi:state");
await fire(R(REAL));
check("reading a receipt does not write grocery state", store.get("maqadi:state") === before);

console.log(`PASS ${pass}  FAIL ${fail}`);
if (fail) { console.log("FAILED:\n - " + failures.join("\n - ")); process.exit(1); }
