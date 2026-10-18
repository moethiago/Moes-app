// Lift reminders (Web Push) — offline grid: real encryption + signatures checked by a fake push service that decrypts
// exactly like a phone (RFC 8291 / RFC 8292), plus a week of 15-minute schedule ticks for several kinds of user.
// Run: node tests/lift_push.mjs [path/to/api/health-check.js]   — no network, no cost.
import crypto from "node:crypto"; import fs from "node:fs"; import vm from "node:vm"; import path from "node:path";
const file = process.argv[2] || path.join(process.cwd(), "api/health-check.js");
process.env.KV_REST_API_URL = "https://kv.mock"; process.env.KV_REST_API_TOKEN = "t"; process.env.DEPLOY_SECRET = "moes-deploy-2026";
let pass = 0, fail = 0; const fails = [];
const ok = (n, c, x) => { if (c) pass++; else { fail++; fails.push(n + (x !== undefined ? "  — " + JSON.stringify(x).slice(0, 300) : "")); } };
const b64u = (b) => Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s) => Buffer.from(String(s).replace(/-/g, "+").replace(/_/g, "/"), "base64");

// ---------- a fake phone: its own key pair and auth secret, decrypts what the server sends ----------
function phone(endpoint) {
  const ecdh = crypto.createECDH("prime256v1"); ecdh.generateKeys(); const auth = crypto.randomBytes(16);
  return { endpoint, ecdh, auth, sub: { endpoint, keys: { p256dh: b64u(ecdh.getPublicKey()), auth: b64u(auth) } }, got: [] };
}
function decrypt(ph, body) {
  const salt = body.subarray(0, 16), rs = body.readUInt32BE(16), idlen = body[20], asPub = body.subarray(21, 21 + idlen), ct = body.subarray(21 + idlen);
  const hmac = (k, d) => crypto.createHmac("sha256", k).update(d).digest(), uaPub = ph.ecdh.getPublicKey(), secret = ph.ecdh.computeSecret(asPub);
  const ikm = hmac(hmac(ph.auth, secret), Buffer.concat([Buffer.from("WebPush: info\0"), uaPub, asPub, Buffer.from([1])]));
  const prk = hmac(salt, ikm), cek = hmac(prk, Buffer.from("Content-Encoding: aes128gcm\0\x01")).subarray(0, 16), nonce = hmac(prk, Buffer.from("Content-Encoding: nonce\0\x01")).subarray(0, 12);
  const d = crypto.createDecipheriv("aes-128-gcm", cek, nonce); d.setAuthTag(ct.subarray(ct.length - 16));
  const pt = Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()]);
  if (rs !== 4096 || pt[pt.length - 1] !== 2) throw new Error("bad record");
  return JSON.parse(pt.subarray(0, pt.length - 1).toString());
}
function checkVapid(h, endpoint) {
  const m = /^vapid t=([^,]+), k=(.+)$/.exec(h || ""); if (!m) throw new Error("no vapid header");
  const [hd, bd, sg] = m[1].split("."), pub = unb64u(m[2]);
  const key = crypto.createPublicKey({ key: { kty: "EC", crv: "P-256", x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33)) }, format: "jwk" });
  if (!crypto.verify("sha256", Buffer.from(hd + "." + bd), { key, dsaEncoding: "ieee-p1363" }, unb64u(sg))) throw new Error("bad signature");
  const c = JSON.parse(unb64u(bd).toString());
  if (c.aud !== new URL(endpoint).origin || !(c.exp * 1000 > Date.now()) || c.exp * 1000 > Date.now() + 24 * 3600e3 || !/^(https:|mailto:)/.test(c.sub)) throw new Error("bad claims " + JSON.stringify(c));
  return m[2];
}
const PHONES = new Map(); let GONE = new Set(), pushErr = [];
const store = new Map();
globalThis.fetch = async (url, opts = {}) => {
  url = String(url);
  if (url.startsWith("https://kv.mock")) {
    const [op, k, v] = JSON.parse(opts.body); let result = null;
    if (op === "GET") result = store.has(k) ? store.get(k) : null; else if (op === "SET") { store.set(k, v); result = "OK"; } else if (op === "DEL") { store.delete(k); result = 1; }
    return new Response(JSON.stringify({ result }), { status: 200 });
  }
  const ph = PHONES.get(url);
  if (ph) {
    if (GONE.has(url)) return new Response("", { status: 410 });
    try {
      const h = opts.headers || {};
      if (h["Content-Encoding"] !== "aes128gcm" || !h.TTL) throw new Error("headers");
      ph.vapidKey = checkVapid(h.Authorization, url); ph.got.push(decrypt(ph, Buffer.from(opts.body)));
      return new Response("", { status: 201 });
    } catch (e) { pushErr.push(e.message); return new Response("", { status: 400 }); }
  }
  return new Response("{}", { status: 200 });
};
const mod = await import(file);
const call = (q, body) => new Promise((resolve) => {
  const res = { code: 200, setHeader() {}, status(c) { this.code = c; return this; }, json(j) { resolve({ code: this.code, j }); }, end() { resolve({ code: this.code, j: null }); } };
  mod.default({ method: "POST", query: { app: "lift", ...q }, body, headers: {} }, res);
});
const T = { u: "t" }, PIN = "2026";
const neighbours = () => ["maqadi:state", "wain:state", "lift:state", "lift-f:state"].map((k) => store.get(k)).join("|");
store.set("maqadi:state", JSON.stringify({ v: 9, state: { items: {} } })); store.set("lift:state", JSON.stringify({ v: 3, state: { program: [{ n: "Real" }] } }));
const before = neighbours();

// ---------- the flow on Moaath's test camp ----------
let r = await call(T, { action: "pushkey", pin: PIN });
const key = r.j.key; ok("public key is a 65-byte P-256 point", r.code === 200 && unb64u(key).length === 65 && unb64u(key)[0] === 4);
r = await call(T, { action: "pushkey", pin: PIN }); ok("the same key every time (kept, not remade)", r.j.key === key);
r = await call(T, { action: "pushkey", pin: "0000" }); ok("wrong code gets no key", r.code === 401);
const A = phone("https://web.push.apple.com/QOk3-iphoneA"); PHONES.set(A.endpoint, A);
r = await call(T, { action: "pushsub", pin: PIN, sub: { endpoint: "http://evil/x", keys: A.sub.keys } }); ok("non-https subscription refused", r.code === 400);
r = await call(T, { action: "pushsub", pin: PIN, sub: A.sub, lang: "en", ua: "iPhone" }); ok("phone subscribes", r.code === 200 && r.j.phones === 1 && r.j.on);
r = await call(T, { action: "pushsub", pin: PIN, sub: A.sub }); ok("same phone twice is still one phone", r.j.phones === 1);
ok("account listed for the schedule", JSON.parse(store.get("lift:pushidx")).some((x) => x.aid === "t" && x.key === "lift-t:state"));
r = await call(T, { action: "pushtest", pin: PIN });
ok("test message: signed with the published key, decrypted by the phone", r.j.sent === 1 && A.got.length === 1 && A.got[0].title === "Lift reminders are on" && A.vapidKey === key, { pushErr, got: A.got });
ok("…no link in the message", !/https?:|www\./.test(JSON.stringify(A.got)));
const D = 864e5, NOW = Date.now();
store.set("lift-t:state", JSON.stringify({ v: 4, state: { days: [0, 1, 2, 3, 4, 5, 6], next: 0, program: [{ id: "a", n: "Upper A", x: [{ e: "x", kind: "w", s: 3, rest: 90 }] }, { id: "b", n: "Lower A", x: [] }],
  sessions: [{ start: NOW - 3 * D, end: NOW - 3 * D + 50 * 60000, sets: [{ e: "x", k: 40, r: 10 }, { e: "x", k: 20, r: 10, wu: 1 }] }], active: { start: NOW - 6 * 3600e3, sets: [] } } }));
A.got = []; r = await call(T, { action: "pushpreview", pin: PIN });
ok("preview: all four kinds at once", r.j.sent === 4 && A.got.map((m) => m.tag).join() === "lift-day,lift-miss,lift-week,lift-open", A.got.map((m) => m.tag));
ok("…with his real data (next routine, open workout age)", A.got[0].body.startsWith("Upper A") && /6 hours/.test(A.got[3].body), A.got.map((m) => m.body));
r = await call(T, { action: "pushprefs", pin: PIN, prefs: { time: "06:30", week: 0, lang: "ar" } }); ok("prefs: time, switches, language", r.j.prefs.time === "06:30" && r.j.prefs.week === 0 && r.j.prefs.lang === "ar");
r = await call(T, { action: "pushprefs", pin: PIN, prefs: { time: "03:00" } }); ok("time outside 6:00–22:00 ignored", r.j.prefs.time === "06:30");
A.got = []; await call(T, { action: "pushpreview", pin: PIN }); ok("Arabic reminders when the app is in Arabic", /[؀-ۿ]/.test(A.got[0].title + A.got[0].body));
// a phone that was removed (410) is dropped
const B = phone("https://web.push.apple.com/gone-B"); PHONES.set(B.endpoint, B); await call(T, { action: "pushsub", pin: PIN, sub: B.sub }); GONE.add(B.endpoint);
r = await call(T, { action: "pushtest", pin: PIN }); ok("a deleted Home Screen icon (410) is forgotten, the other phone still gets it", r.j.phones === 1 && r.j.sent === 1);
r = await call(T, { action: "pushget", pin: PIN }); ok("log shows what was sent and how it went", r.j.log.length >= 5 && r.j.log.some((x) => x.s === 410) && r.j.log.some((x) => x.s === 201));
// remind: public, safe to call often
r = await call({}, { action: "remind" }); ok("schedule run answers without a code", r.code === 200 && r.j.ok);
r = await call({}, { action: "remind" }); ok("…but twice within a minute does nothing", r.j.skipped === "too soon");
ok("schedule run reveals no names or numbers", !("res" in r.j) && !JSON.stringify(r.j).includes("Upper"));
r = await call(T, { action: "pushunsub", pin: PIN }); ok("turn off: phone forgotten, off the schedule", r.j.phones === 0 && !JSON.parse(store.get("lift:pushidx")).some((x) => x.aid === "t"));
r = await call(T, { action: "pushtest", pin: PIN }); ok("no phone → test refused politely", r.code === 409);
r = await call({ u: "f" }, { action: "pushget", pin: "250958" }); ok("Lift2's reminders are its own (empty)", r.code === 200 && r.j.phones === 0);
ok("reminders never touch any app's data", neighbours() === before);

// ---------- Moaath's own message (any text) ----------
{ const C = phone("https://web.push.apple.com/camp-C"); PHONES.set(C.endpoint, C); await call(T, { action: "pushsub", pin: PIN, sub: C.sub, lang: "en" });
  r = await call(T, { action: "pushpeople", pin: PIN }); ok("test camp: the only person to write to is the test camp itself", r.code === 200 && r.j.people.length === 1 && r.j.people[0].aid === "t" && r.j.people[0].on);
  r = await call(T, { action: "pushsend", pin: PIN, title: "Leg day!", body: "  Squats at 9 — don't be late <b>  ", to: ["all"] });
  ok("his own words arrive on the phone, decrypted, tags stripped", r.j.delivered === 1 && C.got.slice(-1)[0].title === "Leg day!" && C.got.slice(-1)[0].body === "Squats at 9 — don't be late b", C.got.slice(-1));
  r = await call(T, { action: "pushsend", pin: PIN, title: "", body: "Only text", to: ["t"] }); ok("no title → 'Lift'", C.got.slice(-1)[0].title === "Lift");
  r = await call(T, { action: "pushsend", pin: PIN, body: "", to: ["all"] }); ok("empty message refused", r.code === 400);
  r = await call(T, { action: "pushsend", pin: PIN, body: "x".repeat(500), to: ["all"] }); ok("long message cut to 240 characters", C.got.slice(-1)[0].body.length === 240);
  r = await call(T, { action: "pushsend", pin: PIN, body: "hi", to: ["admin"] }); ok("test camp can't reach anyone else (asking for Moaath's real Lift → nobody)", r.code === 409);
  r = await call(T, { action: "pushpeople", pin: PIN }); ok("sent messages are kept as a history, newest first", r.j.history.length === 3 && r.j.history[0].body.startsWith("xxx") && r.j.history[0].delivered === 1);
  r = await call({ u: "f" }, { action: "pushsend", pin: "250958", body: "hack", to: ["all"] }); ok("Lift2 can't send messages", r.code === 403);
  r = await call({}, { action: "pushpeople", pin: PIN }); ok("real Lift (admin) lists everyone with whether reminders are on", r.code === 200 && r.j.people[0].aid === "admin" && r.j.people.some((x) => x.aid === "f"));
  r = await call({}, { action: "userstats", pin: PIN }); ok("Users page numbers include whether each person has reminders on", r.code === 200 && r.j.accounts.every((x) => x.push && typeof x.push.on === "boolean"));
  r = await call(T, { action: "pushget", pin: PIN }); ok("the last automatic run is visible (for checking the schedule)", r.j.sched > 0);
  store.set("lift:remind:last", "0"); C.got = []; store.set("lift-t:state", JSON.stringify({ v: 9, state: { days: [0, 1, 2, 3, 4, 5, 6], next: 0, program: [{ n: "Upper A", x: [] }], sessions: [], active: { start: Date.now() - 9 * 3600e3, sets: [] } } }));
  r = await call({}, { action: "remind" }); ok("the schedule never sends to the test camp (no duplicates of the real Lift's)", r.j.ok && C.got.length === 0);
  await call(T, { action: "pushunsub", pin: PIN }); }
// ---------- the schedule itself: pure function over a grid ----------
const src = fs.readFileSync(file, "utf8"), a = src.indexOf("// ---------- Lift reminders"), b = src.indexOf("async function liftPushDeliver");
const ctx = { crypto, Buffer, URL, kv: async () => null }; vm.createContext(ctx); vm.runInContext(src.slice(a, b) + "\nthis.liftRyd = liftRyd;", ctx);
const { liftDue, liftRyd } = ctx;
const H = 3600e3, ryd = (y, mo, d, h, mi) => Date.UTC(y, mo - 1, d, h - 3, mi || 0);  // Riyadh wall clock → ms
const WEEK0 = ryd(2026, 10, 18, 0, 0); // Sunday 18 Oct 2026, 00:00 Riyadh
const prefs = (o) => ({ on: 1, time: "17:00", day: 1, miss: 1, week: 1, open: 1, lang: "en", ...o });
ok("Riyadh clock: Sunday 18 Oct", liftRyd(WEEK0 + 1).dow === 0 && liftRyd(WEEK0 + 1).day === "2026-10-18");
function simulate(st, pr, days, onTick) { // 15-minute ticks like the GitHub job, sent-memory kept like the server
  const sent = {}, log = [];
  for (let t = WEEK0; t < WEEK0 + days * D; t += 15 * 60000) {
    if (onTick) onTick(t, st);
    const msgs = liftDue(st, pr, sent, t, false);
    msgs.forEach((m) => { sent[m.k] = m.v; if (m.k === "miss") sent.missAt = t; log.push({ k: m.k, t, ...liftRyd(t), title: m.title, body: m.body }); });
  }
  return log;
}
const prog = [{ id: "a", n: "Upper A", x: [{ s: 3, rest: 90 }] }, { id: "b", n: "Lower A", x: [{ s: 3, rest: 90 }] }];
// 1. new friend, gym days Sun/Tue/Thu, never trained → a gym-day reminder at 17:00 on those days only, nothing else
let L = simulate({ days: [0, 2, 4], next: 0, program: prog, sessions: [], active: null }, prefs(), 7);
ok("gym days only: Sun, Tue, Thu at 5 pm", JSON.stringify(L.filter((x) => x.k === "day").map((x) => [x.dow, x.min])) === "[[0,1020],[2,1020],[4,1020]]", L.map((x) => [x.k, x.dow, x.min]));
ok("never trained: no 'days without training', and the Thursday summary says start", L.filter((x) => x.k === "miss").length === 0 && L.some((x) => x.k === "week" && /Start with one today/.test(x.body)));
ok("at most one of each kind per day", Object.values(L.reduce((m, x) => { const k = x.day + x.k; m[k] = (m[k] || 0) + 1; return m; }, {})).every((n) => n === 1));
ok("nothing between 10:30 pm and 8 am", L.every((x) => x.min >= 480 && x.min <= 1350));
// 2. trains on the gym day before 5 pm → no reminder that day
L = simulate({ days: [0, 2, 4], next: 0, program: prog, sessions: [], active: null }, prefs(), 7, (t, st) => { const r = liftRyd(t); if (r.dow === 2 && r.min === 15 * 60) st.sessions.push({ start: t, end: t + H, sets: [{ e: "x", k: 1, r: 1 }] }); });
ok("trained Tuesday at 3 pm → no Tuesday reminder", !L.some((x) => x.k === "day" && x.dow === 2) && L.some((x) => x.k === "day" && x.dow === 4), L.map((x) => [x.k, x.dow]));
// 3. stopped training: last workout Sunday → 'days without training' from Tuesday 5 pm, then not again for 2 days
L = simulate({ days: [], next: 1, program: prog, sessions: [{ start: WEEK0 - 3 * H, end: WEEK0 - 2 * H, sets: [] }], active: null }, prefs({ day: 0, week: 0 }), 7);
const miss = L.filter((x) => x.k === "miss");
ok("missed days: first nudge after 2 full days, then every 2 days at most", miss.length >= 2 && miss[0].dow === 2 && miss[0].min === 1020 && miss.every((x, i) => i === 0 || x.t - miss[i - 1].t >= 2 * D), miss.map((x) => [x.dow, x.min, x.body]));
ok("…names the next routine", /Lower A is up next/.test(miss[0].body), miss[0].body);
// 4. workout left open at 1 am → reminder after 8 am (not at night), once
L = simulate({ days: [], next: 0, program: prog, sessions: [], active: { start: WEEK0 + 1 * H, sets: [] } }, prefs({ day: 0, week: 0, miss: 0 }), 2);
ok("open workout from 1 am: one reminder at 8 am, never again for the same workout", L.length === 1 && L[0].k === "open" && L[0].min === 480 && /7 hours/.test(L[0].body), L.map((x) => [x.k, x.day, x.min, x.body]));
// 5. pinned routine on Thursday wins over rotation
L = simulate({ days: [4], next: 0, program: [prog[0], { id: "p", n: "Leg Day", days: [4], x: [] }], sessions: [], active: null }, prefs({ week: 0 }), 7);
ok("routine pinned to Thursday is the one in Thursday's reminder", L.length === 1 && /^Leg Day/.test(L[0].body), L.map((x) => x.body));
// 6. switches and time
L = simulate({ days: [0, 1, 2, 3, 4, 5, 6], next: 0, program: prog, sessions: [], active: null }, prefs({ time: "06:30" }), 2);
ok("6:30 am chosen → first reminder at 8 am (quiet hours win)", L.filter((x) => x.k === "day").every((x) => x.min === 480));
L = simulate({ days: [0, 1, 2, 3, 4, 5, 6], next: 0, program: prog, sessions: [], active: null }, prefs({ day: 0, miss: 0, week: 0, open: 0 }), 7);
ok("every switch off → nothing at all", L.length === 0);
L = simulate({ days: [0, 1, 2, 3, 4, 5, 6], next: 0, program: prog, sessions: [], active: null }, prefs({ on: 0 }), 7);
ok("reminders off → nothing at all", L.length === 0);
// 7. weekly numbers on Thursday
const wkS = [0, 1, 3].map((d) => ({ start: WEEK0 + d * D + 18 * H, end: WEEK0 + d * D + 19 * H, sets: [{ k: 1 }, { k: 1 }, { k: 1, wu: 1 }] }));
L = simulate({ days: [0, 1, 3, 5], next: 0, program: prog, sessions: wkS.slice(), active: null }, prefs({ day: 0, miss: 0 }), 7);
const wk = L.find((x) => x.k === "week");
ok("Thursday 5 pm: '3 of 4 workouts · 6 sets · 180 min' (warm-ups not counted)", wk && wk.dow === 4 && wk.min === 1020 && /3 of 4 workouts · 6 sets · 180 min/.test(wk.body), wk);
// 8. a grid: every hour of a week × random states never breaks the rules
let bad = 0;
for (let i = 0; i < 4000; i++) {
  const t = WEEK0 + Math.floor(Math.random() * 7 * 96) * 15 * 60000, days = [0, 1, 2, 3, 4, 5, 6].filter(() => Math.random() < 0.5);
  const st = { days, next: i % 3, program: prog, sessions: Math.random() < 0.5 ? [] : [{ start: t - Math.random() * 6 * D, end: t - Math.random() * 6 * D + H, sets: [] }], active: Math.random() < 0.2 ? { start: t - Math.random() * 10 * H, sets: [] } : null };
  const pr = prefs({ time: ["06:00", "12:30", "17:00", "22:00"][i % 4], lang: i % 2 ? "ar" : "en" }), sent = {}, m = liftDue(st, pr, sent, t, false), r1 = liftRyd(t);
  for (const x of m) {
    if (r1.min < 480 || r1.min > 1350) bad++;
    if (x.k === "day" && (days.indexOf(r1.dow) < 0 || st.active)) bad++;
    if (x.k === "week" && r1.dow !== 4) bad++;
    if (x.k === "open" && (!st.active || t - st.active.start <= 4 * H)) bad++;
    if (/https?:/.test(x.body)) bad++;
    if (pr.lang === "ar" && !/[؀-ۿ]/.test(x.title)) bad++;
  }
  const again = liftDue(st, pr, Object.fromEntries(m.map((x) => [x.k, x.v])), t, false);
  if (again.some((x) => x.k !== "miss")) bad++; // what was just sent is never due again at once
}
ok("4,000 random people × times: never at night, never on the wrong day, never twice, Arabic when Arabic, no links", bad === 0, bad);
// ---------- the phone side: the app's worker shows exactly what arrives, and a tap opens Lift ----------
const swFile = path.join(process.cwd(), "lift-test/sw.js");
if (fs.existsSync(swFile)) {
  const L = {}, shown = [], opened = [];
  const self = { registration: { scope: "https://moethiago.github.io/Moes-app/lift-test/", showNotification: (t, o) => { shown.push({ t, ...o }); return Promise.resolve(); } }, addEventListener: (k, f) => { L[k] = f; } };
  const sctx = { self, caches: {}, fetch: () => Promise.reject(new Error("x")), URL, location: { origin: "https://moethiago.github.io" }, clients: { matchAll: () => Promise.resolve([]), openWindow: (u) => { opened.push(u); return Promise.resolve(); } } };
  vm.createContext(sctx); vm.runInContext(fs.readFileSync(swFile, "utf8"), sctx);
  const ev = (data) => { let p; return { data: data == null ? null : { json: () => JSON.parse(data), text: () => data }, waitUntil: (x) => { p = x; }, get done() { return p; } }; };
  let e = ev(JSON.stringify({ title: "Gym day today", body: "Upper A · about 55 min.", tag: "lift-day" })); L.push(e); await e.done;
  ok("worker shows the reminder: title, text, Lift icon, one per kind", shown[0] && shown[0].t === "Gym day today" && shown[0].body === "Upper A · about 55 min." && shown[0].tag === "lift-day" && shown[0].icon === "icon-192.png");
  e = ev(null); L.push(e); await e.done; ok("an empty push still shows something (iPhone requires it)", shown[1] && shown[1].t === "Lift");
  e = ev("not json"); L.push(e); await e.done; ok("a plain-text push shows its text", shown[2] && shown[2].body === "not json");
  let closed = 0; e = { notification: { close: () => closed++ }, waitUntil: (x) => { e.p = x; } }; L.notificationclick(e); await e.p;
  ok("tapping the notification opens Lift", closed === 1 && opened[0] === "./");
}
console.log(`\nPUSH lift: PASS ${pass}  FAIL ${fail}`); if (fail) { console.log(fails.join("\n")); process.exit(1); }
