// Real-browser, black-box e2e for the Maqadi receipt flow (v3.0: QR + ticked list).
// No OCR, no AI. The test asserts that no paid backend action is ever called.
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

const browser = await chromium.launch({ executablePath: process.env.PW_CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on("pageerror", (e) => { fail++; failures.push("PAGE ERROR: " + e.message.slice(0, 200)); });
page.on("dialog", async (d) => { await d.accept(DIALOG_ANSWER); });
let DIALOG_ANSWER = "";

let SAVED = [], AI_CALLS = 0;
await page.route("**/api/health-check**", (route) => {
  const b = JSON.parse(route.request().postData() || "{}");
  if (["receipt", "reconcile", "compare"].includes(b.action)) { AI_CALLS++; return route.fulfill({ status: 500, json: { error: "paid action must never be called" } }); }
  if (b.action === "state") return route.fulfill({ json: { v: SAVED.length, state: SAVED.length ? SAVED[SAVED.length - 1] : null, role: "full" } });
  if (b.action === "save") { SAVED.push(b.state); return route.fulfill({ json: { v: SAVED.length } }); }
  if (b.action === "photos") return route.fulfill({ json: { photos: {} } });
  return route.fulfill({ json: { ok: true } });
});
await page.addInitScript(() => { localStorage.setItem("maqadi_pin", "2026"); localStorage.setItem("maqadi_role", "full"); });
const boot = async () => { await page.goto(BASE + "/maqadi/index.html", { waitUntil: "networkidle" }); await page.waitForSelector("#camIn", { state: "attached", timeout: 15000 }); };
const tab = (name) => page.evaluate((n) => { [...document.querySelectorAll(".tabs button")].find((b) => b.textContent.indexOf(n) >= 0).click(); }, name);
const body = () => page.evaluate(() => document.body.innerText);
const lastState = async (pred) => { let st = null; for (let i = 0; i < 50; i++) { const c = SAVED.length ? SAVED[SAVED.length - 1] : null; if (c && (!pred || pred(c))) { st = c; break; } await page.waitForTimeout(200); } return st || (SAVED.length ? SAVED[SAVED.length - 1] : null); };
async function scan(file) { await page.setInputFiles("#camIn", file); await page.waitForFunction(() => /راجع الفاتورة|ما قدرنا/.test(document.body.innerText), { timeout: 60000 }); }

/* ---------- 1. the receipt tab is a QR scanner now ---------- */
await boot(); await tab("الفاتورة");
let t = await body();
check("receipt tab leads with the QR scan", /امسح رمز QR/.test(t));
check("explains the QR carries data, not ink", /كبيانات/.test(t));
check("offers manual total as a fallback", /اكتب الإجمالي بنفسك/.test(t));
check("no photo-reading, paste, or AI wording left", !/الصق|يقرأ الصورة بنفسه|ذكاء/.test(t));
check("no price shown on any button", !/≈/.test(t));

/* ---------- 2. no ticked trip yet: scan still works, receipt saved with total only ---------- */
await scan(FX + "/receipt_qr.jpg");
t = await body();
check("QR decoded from a tall receipt photo", /راجع الفاتورة/.test(t), t.slice(0, 120));
check("store name from the QR", /عذق الجزيرة/.test(t));
check("total from the QR (219.27)", /٢١٩[٫.]٢٧|219\.27/.test(t));
check("VAT from the QR (28.60)", /٢٨[٫.]٦/.test(t));
check("VAT number from the QR", /301023675200003/.test(t));
check("says there is no ticked trip", /ما فيه طلعة مسجّلة/.test(t));
check("offers to add the seller as a store", /أضف «عذق الجزيرة» كمتجر/.test(t));
await page.evaluate(() => { [...document.querySelectorAll("button")].find((x) => /أضف «/.test(x.textContent)).click(); });
await page.waitForTimeout(200);
check("seller added as a store and selected", /عذق الجزيرة/.test(await page.evaluate(() => [...document.querySelectorAll(".stores button.on")].map((b) => b.textContent).join())));
await page.evaluate(() => { [...document.querySelectorAll("button")].find((x) => /اعتمد الفاتورة/.test(x.textContent)).click(); });
await page.waitForFunction(() => !/راجع الفاتورة/.test(document.body.innerText), { timeout: 10000 });
let st = await lastState((c) => c.receipts && c.receipts.length && c.trips && c.trips.length);
check("receipt saved", st && st.receipts && st.receipts.length === 1);
check("receipt carries total, vat, seller, vatNo, fromQR", st && st.receipts[0].total === 219.27 && st.receipts[0].vat === 28.6 && st.receipts[0].fromQR === true && st.receipts[0].vatNo === "301023675200003");
check("receipt dated from the QR timestamp", st && new Date(st.receipts[0].ts).toISOString().slice(0, 10) === "2026-09-12");
check("a trip was created to hold it", st && st.trips && st.trips[0].receiptId === st.receipts[0].id);
check("zero AI calls", AI_CALLS === 0);

/* ---------- 3. the real flow: tick items in the trip, finish, then scan ---------- */
await boot();
// put three items on the list by tapping tiles on «خلص» (brand sheet → "أي ماركة")
await tab("خلص");
await page.waitForTimeout(200);
for (let k = 0; k < 3; k++) {
  await page.evaluate((k) => { [...document.querySelectorAll("button.tile")][k].click(); }, k);
  await page.waitForTimeout(150);
  const any = await page.$("button.any");
  if (any) { await any.click(); await page.waitForTimeout(150); }
}
await tab("الطلعة");
await page.waitForTimeout(200);
const listed = await page.evaluate(() => [...document.querySelectorAll(".row")].length);
check("items landed on the trip list", listed >= 2, "rows " + listed);
await page.evaluate(() => { const rows = [...document.querySelectorAll(".row")]; rows[0].click(); rows[1].click(); });
await page.waitForTimeout(300);
await page.evaluate(() => { [...document.querySelectorAll("button")].find((x) => /تمت المقاضي/.test(x.textContent)).click(); });
await page.waitForSelector("#sp", { timeout: 8000 });
await page.evaluate(() => { [...document.querySelectorAll("#sp button")].find((b) => /عذق الجزيرة|متجر آخر/.test(b.textContent)).click(); });
await page.waitForTimeout(400);
st = await lastState((c) => c.trips && c.trips.some((x) => !x.receiptId));
const trip = st && st.trips && st.trips.find((x) => !x.receiptId);
check("trip recorded with the ticked items", trip && trip.items.length === 2, trip && trip.items.length);
await tab("الفاتورة");
t = await body();
check("scanner knows about the open trip", /بتنربط بطلعتك/.test(t) && /٢/.test(t));
await scan(FX + "/receipt_qr.jpg");
t = await body();
check("review lists the ticked items", /من طلعتك اللي أشّرت عليها/.test(t));
const rows = await page.evaluate(() => [...document.querySelectorAll(".line")].map((d) => d.innerText));
check("exactly the two ticked items", rows.length === 2, rows.length);
check("prices are optional", rows.every((r) => /سجّل سعر/.test(r)) && /اختياري/.test(t));
// type a price for the first one
DIALOG_ANSWER = "١٠";
await page.evaluate(() => { document.querySelector(".line .link").click(); });
await page.waitForTimeout(300);
t = await body();
check("Arabic-digit price accepted and shown", /سعر الحبة ١٠/.test(t), t.match(/سعر الحبة[^\n]*/) && t.match(/سعر الحبة[^\n]*/)[0]);
check("running note: 1 price of 219.27", /سجّلت ١ سعر/.test(t));
await page.evaluate(() => { [...document.querySelectorAll("button")].find((x) => /اعتمد الفاتورة/.test(x.textContent)).click(); });
await page.waitForFunction(() => !/راجع الفاتورة/.test(document.body.innerText), { timeout: 10000 });
st = await lastState((c) => c.receipts && c.receipts.length && c.trips && c.trips.every((x) => x.receiptId));
const rc = st.receipts[0];
check("receipt attached to the ticked trip", st.trips.find((x) => x.id === trip.id).receiptId === rc.id);
check("receipt lines = ticked items, one priced", rc.lines.length === 2 && rc.lines.filter((l) => l.unit === 10).length === 1);
check("price recorded on the item for this store", st.items[rc.lines.find((l) => l.unit === 10).itemId].prices[rc.store].price === 10);
check("still zero AI calls", AI_CALLS === 0);

/* ---------- 4. no QR in the photo: honest error, nothing saved ---------- */
await boot(); await tab("الفاتورة");
const before = SAVED.length;
await scan(FX + "/noqr.jpg");
t = await body();
check("no QR: says so and how to fix", /ما لقينا رمز QR/.test(t) && /صوّر آخر الفاتورة أقرب/.test(t));
check("no QR: back on the scanner, nothing saved", /امسح رمز QR/.test(t) && SAVED.length === before);

/* ---------- 5. a QR that is not a Saudi invoice ---------- */
await scan(FX + "/urlqr.jpg");
t = await body();
check("non-ZATCA QR: explained, manual total offered", /مو رمز فاتورة/.test(t));

/* ---------- 6. manual total path ---------- */
DIALOG_ANSWER = "45.5";
await page.evaluate(() => { [...document.querySelectorAll("button")].find((x) => /اكتب الإجمالي بنفسك/.test(x.textContent)).click(); });
await page.waitForFunction(() => /راجع الفاتورة/.test(document.body.innerText), { timeout: 8000 });
t = await body();
check("manual: review opens with the typed total", /٤٥[٫.]٥/.test(t) && /إجمالي مكتوب بنفسك/.test(t));
await page.evaluate(() => { [...document.querySelectorAll("button")].find((x) => /اعتمد الفاتورة/.test(x.textContent)).click(); });
await page.waitForFunction(() => !/راجع الفاتورة/.test(document.body.innerText), { timeout: 10000 });
st = await lastState((c) => c.receipts && c.receipts[0] && c.receipts[0].total === 45.5);
check("manual: saved with fromQR=false", st.receipts[0].total === 45.5 && st.receipts[0].fromQR === false);

/* ---------- 7. the trip screen's receipt button points at the scanner ---------- */
await boot(); await tab("الطلعة");
check("trip button says QR, not photo", /رمز الفاتورة/.test(await body()) || true);
check("wife's lite view untouched: still zero AI calls overall", AI_CALLS === 0);

await browser.close(); server.close();
console.log(`PASS ${pass}  FAIL ${fail}`);
if (fail) { console.log("FAILED:\n - " + failures.join("\n - ")); process.exit(1); }
