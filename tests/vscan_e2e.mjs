// Real-browser e2e for the v4.6 video receipt: film -> frames -> on-device Tesseract -> codes -> review.
// Runs the REAL page and the REAL self-hosted reader in maqadi/ocr. No AI, no network beyond localhost.
// Videos: FX=/tmp/fx-vscan, made by tests/fixtures/vscan/make.sh from the real عذق الجزيرة receipt (12 Sep 2026, 22 lines, 219.27).
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';

const ROOT = process.cwd(), FX = process.env.FX || "/tmp/fx-vscan";
const CODES = ["200003","200002","200009","6281102680305","0307","3322126","6287027470076","200017","100013","100114","100016","100058",
  "6287027470045","6281007066792","100036","110003","6281102721756","100063","100010","6261007666527","6281007023488","6281057002858"];
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".json": "application/json", ".gz": "application/gzip", ".webm": "video/webm", ".png": "image/png" };
const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split("?")[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end("no"); return; }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream" });
  res.end(fs.readFileSync(f));
});
await new Promise((r) => server.listen(0, r));
// BASE=https://moethiago.github.io/Moes-app runs the same checks against the live site (API still mocked, service worker blocked)
const BASE = process.env.BASE || "http://127.0.0.1:" + server.address().port;
let pass = 0, fail = 0; const failures = [];
const check = (n, c, x) => { if (c) pass++; else { fail++; failures.push(n + (x ? " — " + x : "")); } console.log((c ? "PASS " : "FAIL ") + n + (c || !x ? "" : " — " + x)); };

const browser = await chromium.launch({ executablePath: process.env.PW_CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
const page = await ctx.newPage();
page.on("pageerror", (e) => { fail++; failures.push("PAGE ERROR: " + e.message.slice(0, 200)); });
let DIALOG_ANSWER = "";
page.on("dialog", async (d) => { await d.accept(DIALOG_ANSWER); });
let SAVED = [], AI_CALLS = 0, OUTSIDE = [];
page.on("request", (r) => { const u = r.url(); if (!u.startsWith(BASE) && !u.startsWith("blob:") && !u.startsWith("data:")) OUTSIDE.push(u); });
await ctx.route("**/api/health-check**", (route) => {
  const b = JSON.parse(route.request().postData() || "{}");
  if (["scan", "receipt", "reconcile", "compare"].includes(b.action)) { AI_CALLS++; return route.fulfill({ status: 500, json: { error: "paid action must never be called" } }); }
  if (b.action === "state") return route.fulfill({ json: { v: SAVED.length, state: SAVED.length ? SAVED[SAVED.length - 1] : null, role: b.pin === "1234" ? "lite" : "full" } });
  if (b.action === "save") { SAVED.push(b.state); return route.fulfill({ json: { v: SAVED.length } }); }
  if (b.action === "photos") return route.fulfill({ json: { photos: {} } });
  return route.fulfill({ json: { ok: true } });
});
await page.addInitScript(() => { localStorage.setItem("maqadi_pin", "2026"); localStorage.setItem("maqadi_role", "full"); });
const boot = async (p = page) => { await p.goto(BASE + "/maqadi/index.html", { waitUntil: "networkidle" }); await p.waitForSelector("#vidIn", { state: "attached", timeout: 15000 }); };
const tab = (name, p = page) => p.evaluate((n) => { const b = [...document.querySelectorAll(".tabs button")].find((b) => b.textContent.indexOf(n) >= 0); if (b) b.click(); return !!b; }, name);
const body = (p = page) => p.evaluate(() => document.body.innerText);
const click = (re) => page.evaluate((s) => { const b = [...document.querySelectorAll("button")].find((x) => new RegExp(s).test(x.textContent)); if (b) b.click(); return !!b; }, re);
const lastState = async (pred) => { for (let i = 0; i < 60; i++) { const c = SAVED.length ? SAVED[SAVED.length - 1] : null; if (c && (!pred || pred(c))) return c; await page.waitForTimeout(200); } return SAVED.length ? SAVED[SAVED.length - 1] : null; };
async function film(file) {
  const t0 = Date.now();
  await page.setInputFiles("#vidIn", file);
  await page.waitForFunction(() => /راجع الفاتورة|ما قدرنا/.test(document.body.innerText), null, { timeout: 240000 });
  return Math.round((Date.now() - t0) / 1000);
}
const doubts = () => page.evaluate(() => { const h = [...document.querySelectorAll("h2")].find((x) => /تأكيد سريع/.test(x.textContent)); return h ? h.parentElement.querySelectorAll(".card").length : 0; });

/* 1 — the receipt screen leads with the video */
await boot(); await tab("الفاتورة");
let t = await body();
check("receipt screen leads with a video", /صوّر الفاتورة فيديو/.test(t) && /صوّر فيديو/.test(t));
check("tells him how: close, from the top, slowly", /قرّب الجوال/.test(t) && /ببطء/.test(t));
check("says it is free and has no AI", /ببلاش/.test(t) && /بدون ذكاء اصطناعي/.test(t));
check("video from the library offered", /فيديو من الاستوديو/.test(t));
check("old photo path kept but demoted", /الطريقة القديمة/.test(t));
check("manual total still there", /اكتب الإجمالي بنفسك/.test(t));
check("camera input opens video", await page.evaluate(() => document.querySelector("#vidIn").accept === "video/*" && document.querySelector("#vidIn").getAttribute("capture") === "environment"));

/* 2 — first receipt from this shop: every line read, adds up, each unknown code asked once */
const secs1 = await film(FX + "/vscan_ok.webm");
t = await body();
check("video read into a review", /راجع الفاتورة/.test(t), t.slice(0, 160));
console.log("  (read in " + secs1 + "s)");
check("22 lines read", /٢٢ صنف/.test(t), (t.match(/[٠-٩]+ صنف/) || [""])[0]);
check("adds up to the printed total", /مطابق ✓/.test(t));
check("total 219.27 shown", /٢١٩[٫.]٢٧|219\.27/.test(t));
let q = await doubts();
check("first time: each unknown code is one question", q === 22, "questions " + q);
check("question shows the printed code and price", /رقم الصنف 6281102721756/.test(t) && /٦٦[٫.]٧٥|66\.75/.test(t));
check("no retake nag on a good video", !/صوّر الفيديو مرة ثانية/.test(t));
// answer every question through the UI: "اختر الصنف" -> pick a catalog item
const names = ["كزبرة", "بقدونس", "خس", "توست", "تفاح", "خبز", "خيار", "شبت", "فلفل", "ليمون", "فلفل", "فلفل", "طماطم", "جبن", "بطاطس", "فلفل", "دجاج", "جزر", "باذنجان", "قشطة", "لبن", "حليب"];
for (let i = 0; i < 22; i++) {
  const ok = await page.evaluate(() => { const h = [...document.querySelectorAll("h2")].find((x) => /تأكيد سريع/.test(x.textContent)); if (!h) return false;
    const c = h.parentElement.querySelector(".card"); const bs = [...c.querySelectorAll("button")]; bs[bs.length - 1].click(); return true; });
  if (!ok) break;
  await page.waitForSelector("#lq", { timeout: 5000 });
  await page.fill("#lq", names[i]); await page.waitForTimeout(80);
  const picked = await page.evaluate(() => { const bs = [...document.querySelectorAll("#lp button")]; if (bs.length > 1) { bs[1].click(); return true; } return false; });
  if (!picked) { await page.fill("#lq", ""); await page.waitForTimeout(60); await page.evaluate(() => { [...document.querySelectorAll("#lp button")][1].click(); }); }
  await page.waitForTimeout(120);
}
check("all questions answered in the UI", (await doubts()) === 0);
DIALOG_ANSWER = "عذق الجزيرة";
await click("متجر جديد"); await page.waitForTimeout(200);
await click("اعتمد الفاتورة");
await page.waitForFunction(() => !/راجع الفاتورة/.test(document.body.innerText), null, { timeout: 15000 });
let st = await lastState((c) => c.receipts && c.receipts.length && c.codes && Object.keys(c.codes).length);
const rc = st && st.receipts[0];
check("receipt saved with 219.27", rc && rc.total === 219.27, rc && rc.total);
check("receipt saved with 22 lines", rc && rc.lines.length === 22, rc && rc.lines.length);
check("receipt keeps the store's VAT number", rc && rc.vatNo === "301023675200003", rc && rc.vatNo);
check("receipt dated from the print (12 Sep 2026)", rc && new Date(rc.ts).toISOString().slice(0, 10) === "2026-09-12");
const learned = st ? Object.keys(st.codes || {}) : [];
check("all 22 codes learned", CODES.every((c) => learned.includes(c)), "missing " + CODES.filter((c) => !learned.includes(c)).join(","));
check("no misread code learned", learned.every((c) => CODES.includes(c)), "extra " + learned.filter((c) => !CODES.includes(c)).join(","));
check("amounts saved as prices per line", rc && rc.lines.find((l) => l.total === 66.75 && l.qty === 3 && l.unit === 22.25));

/* 3 — the same shop again: zero questions, store recognised from the VAT number */
await boot(); await tab("الفاتورة");
const secs2 = await film(FX + "/vscan_ok.webm");
t = await body();
console.log("  (read in " + secs2 + "s)");
q = await doubts();
check("second receipt: zero questions", q === 0, "questions " + q);
check("second receipt: adds up", /مطابق ✓/.test(t));
check("second receipt: store picked from the VAT number", await page.evaluate(() => [...document.querySelectorAll(".stores button.on")].map((b) => b.textContent).join()) === "عذق الجزيرة");
await page.evaluate(() => { [...document.querySelectorAll("button")].find((x) => /شوف الأصناف/.test(x.textContent)).click(); });
await page.waitForTimeout(200);
const tagged = await page.evaluate(() => [...document.querySelectorAll(".line")].filter((d) => /برمز الصنف/.test(d.innerText)).length);
check("second receipt: every line matched by its code", tagged === 22, "tagged " + tagged);
await click("رجوع"); await page.waitForTimeout(200);

/* 4 — a rushed, blurry video: honest, asks for a slower one, saves nothing by itself */
const before = SAVED.length;
await boot(); await tab("الفاتورة");
await film(FX + "/vscan_fast.webm");
t = await body();
check("rushed video: says so or asks for a retake", /صوّر الفيديو مرة ثانية|ما قدرنا/.test(t), t.slice(0, 200));
check("rushed video: nothing saved without approval", SAVED.length === before);

/* 5 — cost and privacy */
check("zero AI calls in the whole run", AI_CALLS === 0, "calls " + AI_CALLS);
const reader = OUTSIDE.filter((u) => !/fonts\.(googleapis|gstatic)\.com|\/api\/health-check/.test(u));
check("reader is self-hosted: no CDN or outside request", reader.length === 0, reader.slice(0, 3).join(" "));
const lite = await ctx.newPage();
await lite.addInitScript(() => { localStorage.setItem("maqadi_pin", "1234"); localStorage.setItem("maqadi_role", "lite"); });
await boot(lite); await lite.waitForTimeout(500);
const lt = await body(lite);
check("wife's code: no receipt tab, no video button", !(await tab("الفاتورة", lite)) && !/صوّر فيديو/.test(lt));

console.log(`\n${pass} passed, ${fail} failed`); if (fail) console.log(failures.join("\n"));
await browser.close(); server.close(); process.exit(fail ? 1 : 0);
