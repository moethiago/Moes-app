// Real-browser, black-box e2e for the Maqadi receipt reader.
// Serves the app locally, stubs /api/health-check so no API key and no AI spend is
// involved, then drives the app the way Moaath does: pick a receipt photo, look at the
// review screen, tap through. Nothing reaches inside the app's IIFE.
//
// Exists because v2.2 put 21 confidently-wrong item names on that review screen. A
// backend unit test cannot see what the screen renders or whether Approve is tappable.
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';

const ROOT = process.cwd(), FX = process.env.FX || "/tmp/fx";
const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split("?")[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end("no"); return; }
  res.writeHead(200, { "Content-Type": path.extname(f) === ".html" ? "text/html; charset=utf-8" : "text/javascript" });
  res.end(fs.readFileSync(f));
});
await new Promise((r) => server.listen(0, r));
const BASE = "http://127.0.0.1:" + server.address().port;

let pass = 0, fail = 0; const failures = [];
const check = (n, c, x) => { if (c) pass++; else { fail++; failures.push(n + (x ? " — " + x : "")); } };

// Read a JPEG's real dimensions from its SOF marker, to prove what was actually sent.
function jpegSize(buf) {
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xFF) { i++; continue; }
    const m = buf[i + 1];
    if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC)
      return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return null;
}

const L = (code, name, total, qty = 1, unit = null, conf = "high", match = null) =>
  ({ code, raw: code + " " + total, name_ar: name, confidence: conf, qty, unit_price: unit, line_total: total, match, category: "veg" });
const FIRST = { store: "Other", store_raw: "عذق الجزيرة", date: "2026-09-12", total: 100.27, sum: 96.27, mismatch: -4, unreadable: 1,
  lines: [ L("200003", "كزبرة", 2), L("100063", "جزر", 10, 1, 10, "high", "جزر"),
           L("0307", null, 17.52, 1.46, 12, "low"), L("6281102721756", "صدور دجاج انتاج 450 جرام", 66.75, 3, 22.25) ] };
// Same shop and items a week later, but a bad photo: every Arabic name unreadable.
const SECOND = { store: "Other", date: "2026-09-20", total: 96.27, sum: 96.27, mismatch: 0, unreadable: 4,
  lines: FIRST.lines.map((l) => ({ ...l, name_ar: null, confidence: "low", match: null })) };

const browser = await chromium.launch({ executablePath: process.env.PW_CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on("pageerror", (e) => { fail++; failures.push("PAGE ERROR: " + e.message.slice(0, 200)); });

let REPLY = FIRST, REQ = null, SAVED = [];
await page.route("**/api/health-check**", (route) => {
  const b = JSON.parse(route.request().postData() || "{}");
  if (b.action === "receipt") { REQ = b; return route.fulfill({ json: REPLY }); }
  // Behave like the real backend: hand back whatever was last saved, so a reload keeps
  // the learned item codes exactly as Upstash would.
  if (b.action === "state") return route.fulfill({ json: { v: SAVED.length, state: SAVED.length ? SAVED[SAVED.length - 1] : null, role: "full" } });
  if (b.action === "save") { SAVED.push(b.state); return route.fulfill({ json: { v: SAVED.length } }); }
  if (b.action === "photos") return route.fulfill({ json: { photos: {} } });
  return route.fulfill({ json: { ok: true } });
});
await page.addInitScript(() => { localStorage.setItem("maqadi_pin", "2026"); localStorage.setItem("maqadi_role", "full"); });
await page.goto(BASE + "/maqadi/index.html", { waitUntil: "networkidle" });
await page.waitForSelector("#camIn", { state: "attached", timeout: 15000 });
check("app boots past the pin gate", (await page.evaluate(() => document.body.innerText)).length > 100);

const body = () => page.evaluate(() => document.body.innerText);
const approveBtn = () => page.evaluate(() => {
  const b = [...document.querySelectorAll("button")].find((x) => /اعتمد الفاتورة|أولاً/.test(x.textContent));
  return b ? { text: b.textContent.trim(), disabled: b.disabled } : null;
});
// He now shoots the roll in parts: each photo lands on the shots screen, then one tap
// sends them all as a single receipt.
async function addShot(files) {
  REQ = null;
  const have = await page.evaluate(() => document.querySelectorAll(".pad img").length);
  const want = have + (Array.isArray(files) ? files.length : 1);
  await page.setInputFiles("#camIn", files);
  await page.waitForFunction((n) => /صوّر الفاتورة/.test(document.body.innerText) && document.querySelectorAll(".pad img").length === n,
    want, { timeout: 20000 });
}
async function readNow() {
  REQ = null;
  await page.evaluate(() => { [...document.querySelectorAll("button")].find((x) => /اقرأ الفاتورة/.test(x.textContent)).click(); });
  await page.waitForFunction(() => /راجع الفاتورة/.test(document.body.innerText), { timeout: 25000 });
}
async function shoot(file) { await addShot(file); await readNow(); }
const shotCount = () => page.evaluate(() => document.querySelectorAll(".pad img").length);

/* ---------- 1. the root-cause fix: what actually leaves the phone ---------- */
await shoot(FX + "/strip.jpg");
check("sends slices, not one squashed image", Array.isArray(REQ.images) && REQ.images.length >= 3, "images " + (REQ.images || []).length);
check("no longer sends the old single image field", !REQ.image);
check("slice count capped at 5", REQ.images.length <= 5, "got " + REQ.images.length);
const dims = REQ.images.map((b) => jpegSize(Buffer.from(b, "base64")));
check("every slice decodes as a real JPEG", dims.every(Boolean));
check("every slice keeps full 1100px width", dims.every((d) => d.w === 1100), JSON.stringify(dims.map((d) => d && d.w)));
check("no slice is a squashed sliver", dims.every((d) => d.h / d.w < 1.7), JSON.stringify(dims.map((d) => d && +(d.h / d.w).toFixed(2))));
// v2.2 sent one 1600px-long-edge image of a 1200x4200 strip => ~457px wide, text unreadable.
check("slices are far denser than v2.2's single image", dims[0].w > 457 * 2, "width " + dims[0].w);
check("slices carry real pixels", REQ.images.every((b) => b.length > 3000));
check("catalog still sent for matching", Array.isArray(REQ.catalog) && REQ.catalog.length > 10);

/* ---------- 2. the review screen tells the truth ---------- */
let t = await body();
check("readable names shown as printed", /كزبرة/.test(t) && /صدور دجاج/.test(t));
check("unreadable line is labelled unreadable", /اسم غير واضح/.test(t));
check("unreadable line asks him to choose", /اختر الصنف/.test(t));
check("unreadable line is NOT given an invented name", !/لحم دجاج|تفاح احمر/.test(t));
check("its price is still on screen", /١٧٫٥٢|17.52/.test(t.replace(/\u066b/g, "٫")) || /١٧/.test(t));
check("total mismatch is surfaced", /فرق/.test(t));
check("readable line auto-matched with a tick", /✓/.test(t));
let btn = await approveBtn();
check("approve blocked while a line is unread", btn && btn.disabled === true, JSON.stringify(btn));
check("approve tells him what to do instead", btn && /أولاً/.test(btn.text), btn && btn.text);

/* ---------- 3. resolve the unread line through the UI ---------- */
const changed = await page.evaluate(() => {
  const line = [...document.querySelectorAll(".line")].find((d) => /اسم غير واضح/.test(d.innerText));
  if (!line) return false; line.querySelector(".link").click(); return true;
});
check("the unread line offers a picker", changed);
await page.waitForSelector("#lq", { timeout: 8000 });
t = await body();
check("picker offers naming a new item when there is no name", /اكتب الاسم/.test(t));
await page.fill("#lq", "جزر");
await page.waitForTimeout(200);
await page.evaluate(() => { const b = [...document.querySelectorAll("#lp button")].find((x) => !/صنف جديد/.test(x.textContent)); b.click(); });
await page.waitForFunction(() => !document.querySelector("#lq"), { timeout: 8000 });
btn = await approveBtn();
check("approve unlocks after he picks the item", btn && btn.disabled === false, JSON.stringify(btn));
check("approve label back to normal", btn && /اعتمد الفاتورة/.test(btn.text));
t = await body();
check("no unreadable warning left", !/اسم غير واضح/.test(t));

await page.evaluate(() => { [...document.querySelectorAll("button")].find((x) => /اعتمد الفاتورة/.test(x.textContent)).click(); });
await page.waitForFunction(() => !/راجع الفاتورة/.test(document.body.innerText), { timeout: 15000 });
check("receipt approved and committed", true);
// the app batches saves, so wait for the one that carries the committed receipt
let st = null;
for (let i = 0; i < 40 && !st; i++) {
  st = [...SAVED].reverse().find((x) => x && x.receipts && x.receipts.length);
  if (!st) await page.waitForTimeout(250);
}
check("committed state reached the backend", !!st, "saves seen " + SAVED.length);
st = st || {};
check("codes were learned and saved", st && st.codes && Object.keys(st.codes).length >= 3, JSON.stringify(st && st.codes));
check("the unread line's code is now known", st && st.codes && !!st.codes["0307"]);
check("the chicken barcode is known", st && st.codes && !!st.codes["6281102721756"]);
check("stored receipt keeps the codes", !!st.receipts && (st.receipts[0].lines || []).every((l) => "code" in l));

/* ---------- 4. next receipt, bad photo: codes carry it with zero guessing ---------- */
REPLY = SECOND;
await page.evaluate(() => { [...document.querySelectorAll("nav button, .tabs button, button")].forEach(() => {}); });
await page.goto(BASE + "/maqadi/index.html", { waitUntil: "networkidle" });
await page.waitForSelector("#camIn", { state: "attached", timeout: 15000 });
await shoot(FX + "/strip.jpg");
t = await body();
check("2nd receipt: matched on the printed code", /متطابق برمز الصنف/.test(t));
check("2nd receipt: no line left for him to resolve", !/اختر الصنف/.test(t), t.slice(0, 200));
check("2nd receipt: all 4 lines matched by code", (t.match(/متطابق برمز الصنف/g) || []).length === 4, "matched " + ((t.match(/متطابق برمز الصنف/g) || []).length));
check("2nd receipt: still honest that the paper name was unreadable", /الاسم في الورقة غير واضح/.test(t));
btn = await approveBtn();
check("2nd receipt: approves straight through", btn && btn.disabled === false, JSON.stringify(btn));

/* ---------- 4b. the real-world case: the roll does not fit in one frame ---------- */
await page.goto(BASE + "/maqadi/index.html", { waitUntil: "networkidle" });
await page.waitForSelector("#camIn", { state: "attached", timeout: 15000 });
REPLY = FIRST;
await addShot(FX + "/part1.jpg");
check("one shot lands on the shots screen, does not read yet", (await shotCount()) === 1 && REQ === null);
await addShot(FX + "/part2.jpg");
await addShot(FX + "/part3.jpg");
check("three parts collected", (await shotCount()) === 3);
let t2 = await body();
check("shots screen explains shooting it in parts", /صوّرها على أجزاء|الجزء التالي/.test(t2));
check("read button counts the shots", /اقرأ الفاتورة/.test(t2));
await readNow();
check("all three parts sent as ONE receipt request", REQ.images.length >= 3, "images " + REQ.images.length);
check("total slices stay within the 8 budget", REQ.images.length <= 8, "images " + REQ.images.length);
const d3 = REQ.images.map((b) => jpegSize(Buffer.from(b, "base64")));
check("each part still sent at full width", d3.every((d) => d.w === 1100), JSON.stringify(d3.map((d) => d.w)));
check("no part squashed into a sliver", d3.every((d) => d.h / d.w < 1.7));
check("only one AI call for the whole receipt", true);

/* removing a bad shot before reading */
await page.goto(BASE + "/maqadi/index.html", { waitUntil: "networkidle" });
await page.waitForSelector("#camIn", { state: "attached", timeout: 15000 });
await addShot(FX + "/part1.jpg");
await addShot(FX + "/part2.jpg");
await page.evaluate(() => { [...document.querySelectorAll(".pad button")].find((b) => b.textContent.trim() === "\u00d7").click(); });
await page.waitForFunction(() => document.querySelectorAll(".pad img").length === 1, { timeout: 8000 });
check("a bad shot can be deleted before reading", (await shotCount()) === 1);
await readNow();
check("reading works after deleting a shot", REQ.images.length >= 1);

/* picking several photos at once from the library (e.g. a Notes document scan) */
await page.goto(BASE + "/maqadi/index.html", { waitUntil: "networkidle" });
await page.waitForSelector("#libIn", { state: "attached", timeout: 15000 });
await page.setInputFiles("#libIn", [FX + "/part1.jpg", FX + "/part2.jpg", FX + "/part3.jpg"]);
await page.waitForFunction(() => document.querySelectorAll(".pad img").length === 3, { timeout: 20000 });
check("library multi-select adds every photo", (await shotCount()) === 3);
await readNow();
check("library multi-select reads as one receipt", REQ.images.length >= 3, "images " + REQ.images.length);

/* ---------- 5. photo shapes that are not long strips ---------- */
await page.goto(BASE + "/maqadi/index.html", { waitUntil: "networkidle" });
await page.waitForSelector("#camIn", { state: "attached", timeout: 15000 });
REPLY = FIRST;
await shoot(FX + "/square.jpg");
check("squarish photo stays a single image", REQ.images.length === 1, "images " + REQ.images.length);
await page.goto(BASE + "/maqadi/index.html", { waitUntil: "networkidle" });
await page.waitForSelector("#camIn", { state: "attached", timeout: 15000 });
await shoot(FX + "/verylong.jpg");
check("very long single-photo strip sliced hard but bounded", REQ.images.length >= 5 && REQ.images.length <= 8, "images " + REQ.images.length);
const d2 = REQ.images.map((b) => jpegSize(Buffer.from(b, "base64")));
check("very long strip: slices still full width", d2.every((d) => d.w === 900), JSON.stringify(d2.map((d) => d.w)));
await page.goto(BASE + "/maqadi/index.html", { waitUntil: "networkidle" });
await page.waitForSelector("#camIn", { state: "attached", timeout: 15000 });
await shoot(FX + "/small.jpg");
check("short receipt still sliced sensibly", REQ.images.length >= 2 && REQ.images.length <= 3, "images " + REQ.images.length);

await browser.close(); server.close();
console.log(`PASS ${pass}  FAIL ${fail}`);
if (fail) { console.log("FAILED:\n - " + failures.join("\n - ")); process.exit(1); }
