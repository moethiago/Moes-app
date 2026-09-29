// Real-browser e2e (build 4.5): the wife's code (1234, lite) can edit items and add/remove
// photos exactly like the full code, while still seeing no money and only خلص + السلة.
// Backend is mocked; no network, no AI, zero cost.  Run: node tests/wife_edit_e2e.mjs
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';

const ROOT = process.cwd();
const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split("?")[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end("no"); return; }
  const ext = path.extname(f);
  res.writeHead(200, { "Content-Type": ext === ".html" ? "text/html; charset=utf-8" : ext === ".png" ? "image/png" : ext === ".json" ? "application/json" : "text/javascript" });
  res.end(fs.readFileSync(f));
});
await new Promise((r) => server.listen(0, r));
const BASE = "http://127.0.0.1:" + server.address().port;
let pass = 0, fail = 0; const failures = [];
const check = (n, c, x) => { if (c) pass++; else { fail++; failures.push(n + (x ? " — " + x : "")); } };

const browser = await chromium.launch({ executablePath: process.env.PW_CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });

async function session(pin, role) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const errs = []; page.on("pageerror", (e) => errs.push(e.message.slice(0, 200)));
  let DIALOG = ""; page.on("dialog", async (d) => { await d.accept(DIALOG); });
  const S = { saved: [], photoCalls: [], blocked: [] };
  await page.route("**/api/health-check**", (route) => {
    const req = route.request(); const b = JSON.parse(req.postData() || "{}");
    const p = String(req.headers()["x-pin"] || b.pin || "");
    if (["receipt", "reconcile", "compare", "scan"].includes(b.action)) { S.blocked.push(b.action); return route.fulfill({ status: 403, json: { error: "role" } }); }
    if (b.action === "state") return route.fulfill({ json: { v: S.saved.length, state: S.saved.length ? S.saved[S.saved.length - 1] : null, role } });
    if (b.action === "save") { S.saved.push(b.state); return route.fulfill({ json: { v: S.saved.length } }); }
    if (b.action === "photos") return route.fulfill({ json: { photos: {} } });
    if (b.action === "photoset") { S.photoCalls.push({ pin: p, id: b.id, hasData: !!b.data }); return route.fulfill({ json: { ok: true, count: 1 } }); }
    return route.fulfill({ json: { ok: true } });
  });
  await page.addInitScript(([pin, role]) => { if (!sessionStorage.getItem("_b")) { sessionStorage.setItem("_b", "1"); localStorage.clear(); } localStorage.setItem("maqadi_pin", pin); localStorage.setItem("maqadi_role", role); }, [pin, role]);
  await page.goto(BASE + "/maqadi/index.html", { waitUntil: "networkidle" });
  await page.waitForSelector(".tile", { timeout: 15000 });
  const text = () => page.evaluate(() => document.body.innerText);
  const openFirstCategory = () => page.evaluate(() => document.querySelector(".tile").click());
  const itemTile = async (name) => page.evaluateHandle((n) => [...document.querySelectorAll(".tile")].find((t) => !n || t.querySelector(".nm")?.textContent.indexOf(n) === 0) || null, name);
  const longPress = async (h) => {
    await h.evaluate((el) => el.dispatchEvent(new Event("touchstart", { bubbles: true })));
    await page.waitForTimeout(750);
    await h.evaluate((el) => el.dispatchEvent(new Event("touchend", { bubbles: true })));
  };
  return { page, S, errs, text, openFirstCategory, itemTile, longPress, setDialog: (v) => { DIALOG = v; } };
}

/* ================= WIFE (1234 / lite) ================= */
const w = await session("1234", "lite");
await w.page.waitForTimeout(1800);
let t = await w.text();
check("wife sees only خلص + السلة tabs", await w.page.evaluate(() => [...document.querySelectorAll(".tabs button")].map((b) => b.textContent).join("|")).then((s) => /خلص/.test(s) && /السلة/.test(s) && !/الفاتورة|البيت|الطلعة/.test(s)));
check("one-time hint about long-press shows for her", /اضغطي مطوّل على أي صنف/.test(t));

await w.openFirstCategory(); await w.page.waitForTimeout(300);
const firstName = await w.page.evaluate(() => { const t = [...document.querySelectorAll(".tile")].find((x) => !/صنف جديد|أضيفي «/.test(x.textContent)); return t.querySelector(".nm").childNodes[0].textContent.trim(); });
let h = await w.itemTile(firstName);
const savesBefore = w.S.saved.length;
await w.longPress(h); await w.page.waitForTimeout(300);
t = await w.text();
check("long-press opens the edit sheet for her", /تعديل الصنف/.test(t), t.slice(0, 200));
check("long-press did not also add the item to the list", w.S.saved.length === savesBefore || !Object.keys(w.S.saved[w.S.saved.length - 1].list || {}).length);
check("edit sheet shows brands for her", /الماركات/.test(t) && /أضيفي ماركة/.test(t));
check("edit sheet shows photo for her (feminine wording)", /صوّري المنتج/.test(t));
check("no 'shows to your wife' note on her screen", !/تظهر لزوجتك/.test(t));
check("no money/prices in her edit sheet", !/ر\.س|ريال|≈|SAR/.test(t));

// rename + add brand + photo, then save
await w.page.fill("#fName", firstName + " تجربة");
w.setDialog("ماركة تجربة"); await w.page.click("#fBrandAdd"); await w.page.waitForTimeout(150);
const [fc] = await Promise.all([w.page.waitForEvent("filechooser"), w.page.click("#fPhoto")]);
await fc.setFiles(path.join(ROOT, "maqadi/icon-192.png"));
await w.page.waitForFunction(() => document.querySelector("#fPv img"), { timeout: 5000 }).catch(() => {});
check("photo preview appears in the sheet", await w.page.evaluate(() => !!document.querySelector("#fPv img")));
check("button flips to غيّري الصورة", /غيّري الصورة/.test(await w.text()));
await w.page.click("#fSave"); await w.page.waitForTimeout(800);
check("photo saved to server with HER code", w.S.photoCalls.some((c) => c.pin === "1234" && c.hasData), JSON.stringify(w.S.photoCalls));
const last = w.S.saved[w.S.saved.length - 1] || { items: {} };
const edited = Object.values(last.items || {}).find((i) => i.name === firstName + " تجربة");
check("rename saved", !!edited);
check("brand she added saved", !!edited && (edited.brands || []).includes("ماركة تجربة"));
check("tile now shows the photo", await w.page.evaluate((n) => { const t = [...document.querySelectorAll(".tile")].find((x) => x.textContent.indexOf(n) >= 0); return !!(t && t.querySelector(".pic img")); }, firstName + " تجربة"));

// remove the photo again
h = await w.itemTile(firstName + " تجربة"); await w.longPress(h); await w.page.waitForTimeout(300);
check("remove-photo option shown to her", /احذفي الصورة/.test(await w.text()));
await w.page.click("#fPhotoRm"); await w.page.click("#fSave"); await w.page.waitForTimeout(800);
check("photo removal sent with her code", w.S.photoCalls.some((c) => c.pin === "1234" && !c.hasData));

// a normal tap still just adds to the list
h = await w.itemTile(firstName + " تجربة");
await h.evaluate((el) => el.click()); await w.page.waitForTimeout(400);
t = await w.text();
check("normal tap still adds to list (or opens brand chooser)", /أي ماركة؟/.test(t) || Object.keys((w.S.saved[w.S.saved.length - 1] || {}).list || {}).length > 0);
check("no paid/blocked action attempted from her phone", w.S.blocked.length === 0, w.S.blocked.join(","));

// hint shows only once
await w.page.reload({ waitUntil: "networkidle" }); await w.page.waitForTimeout(1800);
check("hint does not repeat after reload", !/اضغطي مطوّل على أي صنف/.test(await w.text()));
check("no page errors (wife)", w.errs.length === 0, w.errs.join(" | "));

/* ================= MOAATH (full) — nothing changed for him ================= */
const m = await session("2026", "full");
await m.page.waitForTimeout(1800);
check("no long-press hint for Moaath", !/اضغطي مطوّل/.test(await m.text()));
await m.openFirstCategory(); await m.page.waitForTimeout(300);
h = await m.itemTile(firstName); await m.longPress(h); await m.page.waitForTimeout(300);
t = await m.text();
check("his edit sheet unchanged: brand note + masculine photo wording", /تظهر لزوجتك/.test(t) && /صوّر المنتج/.test(t) && /أضف ماركة/.test(t));
check("his tabs still include الفاتورة + البيت", /الفاتورة/.test(t) && /البيت/.test(t));
check("no page errors (Moaath)", m.errs.length === 0, m.errs.join(" | "));

await browser.close(); server.close();
console.log(`PASS ${pass}  FAIL ${fail}`); failures.forEach((f) => console.log("FAIL: " + f));
process.exit(fail ? 1 : 0);
