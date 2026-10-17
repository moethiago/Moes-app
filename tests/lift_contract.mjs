// Contract test for the lift block in api/health-check.js — in-memory Upstash, no network, no cost.
// Run:  node tests/lift_contract.mjs ../api/health-check.js   (path is relative to this file)
const file = process.argv[2] || "../api/health-check.js";
process.env.KV_REST_API_URL = "https://kv.mock"; process.env.KV_REST_API_TOKEN = "t";
process.env.DEPLOY_SECRET = "moes-deploy-2026"; process.env.ANTHROPIC_API_KEY = "";
const store = new Map();
globalThis.fetch = async (url, opts = {}) => {
  if (String(url).startsWith("https://kv.mock")) {
    const [op, k, v] = JSON.parse(opts.body); let result = null;
    if (op === "GET") result = store.has(k) ? store.get(k) : null;
    else if (op === "SET") { store.set(k, v); result = "OK"; }
    else if (op === "DEL") { store.delete(k); result = 1; }
    return new Response(JSON.stringify({ result }), { status: 200 });
  }
  return new Response("{}", { status: 200 });
};
const mod = await import(file);
const Q = { app: "lift" };
function call({ method = "POST", query = Q, body = {}, headers = {} }) {
  return new Promise((resolve) => {
    const res = { code: 200, h: {}, setHeader(k, v) { this.h[k] = v; }, status(c) { this.code = c; return this; },
      json(j) { resolve({ code: this.code, j }); }, end() { resolve({ code: this.code, j: null }); } };
    mod.default({ method, query, body, headers }, res);
  });
}
let pass = 0, fail = 0; const failures = [];
const check = (n, c) => { if (c) pass++; else { fail++; failures.push(n); } };
const FULL = "2026", LITE = "1234", SHARED = false;
const K = "lift:state";
// neighbours that must never move
store.set("maqadi:state", JSON.stringify({ v: 188, state: { items: { a: 1 } } }));
store.set("wain:state", JSON.stringify({ v: 7, state: { wish: [] } }));
store.set("maham:state", JSON.stringify({ v: 3, state: { lanes: {} } }));
const snap = () => ["maqadi:state", "wain:state", "maham:state"].map(k => store.get(k)).join("|");
let r, before;

// PIN matrix
r = await call({ body: { action: "state", pin: FULL } }); check("full pin state 200", r.code === 200 && r.j.role === "full");
r = await call({ body: { action: "state", pin: LITE } }); check(SHARED ? "lite pin state 200" : "lite pin refused 401", SHARED ? (r.code === 200 && r.j.role === "lite") : r.code === 401);
r = await call({ body: { action: "state", pin: "0000" } }); check("bad pin 401", r.code === 401);
r = await call({ body: { action: "state" } }); check("no pin 401", r.code === 401);
// empty state → v0 null
r = await call({ body: { action: "state", pin: FULL } }); check("empty doc v=0 state null", r.j.v === 0 && r.j.state === null);
// first save
before = snap();
r = await call({ body: { action: "save", pin: FULL, v: 0, state: { items: [{ id: "a", name: "x" }], log: [] } } });
check("first save v=1", r.code === 200 && r.j.v === 1);
check("save did NOT touch neighbours", snap() === before);
// stale save
r = await call({ body: { action: "save", pin: FULL, v: 0, state: {} } }); check("stale save 409", r.code === 409 && r.j.conflict === true && r.j.v === 1);
check("409 did not write", JSON.parse(store.get(K)).v === 1);
// worst case: another app's version number
r = await call({ body: { action: "save", pin: FULL, v: 188, state: {} } }); check("foreign v=188 rejected 409", r.code === 409);
check("neighbours intact after foreign v", snap() === before);
// too big
r = await call({ body: { action: "save", pin: FULL, v: 1, state: { pad: "x".repeat(950000) } } }); check("oversize 413", r.code === 413);
// snapshot / restore
r = await call({ body: { action: "snapshot", pin: FULL, name: "t1" } }); check("snapshot ok", r.code === 200 && r.j.ok);
r = await call({ body: { action: "save", pin: FULL, v: 1, state: { items: [], log: [] } } }); check("second save v=2", r.j.v === 2);
r = await call({ body: { action: "restore", pin: FULL, name: "t1" } }); check("restore ok v=3", r.code === 200 && r.j.v === 3);
r = await call({ body: { action: "state", pin: FULL } }); check("restored state has item a", r.j.state.items.length === 1 && r.j.state.items[0].id === "a");
r = await call({ body: { action: "restore", pin: FULL, name: "nope" } }); check("restore missing 404", r.code === 404);
if (SHARED) {
  r = await call({ body: { action: "snapshot", pin: LITE, name: "t2" } }); check("lite cannot snapshot", r.code !== 200);
  r = await call({ body: { action: "restore", pin: LITE, name: "t1" } }); check("lite cannot restore", r.code !== 200);
}
// unknown / OPTIONS / other apps unaffected
r = await call({ body: { action: "nope", pin: FULL } }); check("unknown action 400", r.code === 400);
r = await call({ method: "OPTIONS", body: {} }); check("OPTIONS 204", r.code === 204);
r = await call({ query: { app: "wain" }, body: { action: "state", pin: FULL } }); check("wain still routes to wain (v=7)", r.j.v === 7);
r = await call({ query: {}, body: { action: "state", pin: FULL } }); check("maqadi still routes to maqadi (v=188)", r.j.v === 188);
r = await call({ query: {}, method: "GET", body: {} }); check("GET health still works", r.code === 200 && "ok" in r.j);

// friend's Lift (lift2/, ?u=f): separate data, separate code, can't see or touch Moaath's Lift
const FQ = { app: "lift", u: "f" }, FPIN = "250958", FK = "lift-f:state";
const mine = store.get(K);
r = await call({ query: FQ, body: { action: "state", pin: FPIN } }); check("friend: clean start (v=0, no state)", r.code === 200 && r.j.v === 0 && r.j.state === null && r.j.role === "full");
r = await call({ query: FQ, body: { action: "state", pin: FULL } }); check("friend lift refuses Moaath's code", r.code === 401);
r = await call({ query: FQ, body: { action: "state", pin: LITE } }); check("friend lift refuses wife's code", r.code === 401);
r = await call({ query: Q, body: { action: "state", pin: FPIN } }); check("Moaath's lift refuses friend's code", r.code === 401);
r = await call({ query: { app: "lift", u: "zz" }, body: { action: "state", pin: FPIN } }); check("unknown lift id 404", r.code === 404);
before = snap();
r = await call({ query: FQ, body: { action: "save", pin: FPIN, v: 0, state: { items: [{ id: "f" }] } } }); check("friend save v=1", r.code === 200 && r.j.v === 1);
check("friend save landed in its own key", JSON.parse(store.get(FK)).state.items[0].id === "f");
check("friend save did NOT touch Moaath's lift", store.get(K) === mine);
check("friend save did NOT touch neighbours", snap() === before);
r = await call({ query: FQ, body: { action: "save", pin: FPIN, v: 0, state: {} } }); check("friend stale save 409", r.code === 409 && r.j.v === 1);
r = await call({ query: FQ, body: { action: "snapshot", pin: FPIN, name: "f1" } }); check("friend snapshot in own namespace", r.code === 200 && store.has("lift-f:snapshot:f1") && !store.has("lift:snapshot:f1"));
r = await call({ query: FQ, body: { action: "restore", pin: FPIN, name: "t1" } }); check("friend can't restore Moaath's snapshot", r.code === 404);
r = await call({ query: Q, body: { action: "state", pin: FULL } }); check("Moaath's lift still reads his data", r.code === 200 && JSON.stringify({ v: r.j.v, state: r.j.state }) === JSON.stringify({ v: JSON.parse(mine).v, state: JSON.parse(mine).state }));

// ---- friends added from Moaath's Admin page: same link, own code, own clean data ----
r = await call({ body: { action: "state", pin: FULL } }); check("Moaath is admin", r.code === 200 && r.j.admin === true && !r.j.user);
r = await call({ body: { action: "state", pin: LITE } }); check("wife's grocery code doesn't open Lift", r.code === 401);
r = await call({ query: FQ, body: { action: "state", pin: FPIN } }); check("Lift2 friend is not admin", r.code === 200 && r.j.admin === false);
r = await call({ body: { action: "users", pin: LITE } }); check("wife's code can't list users", r.code === 401);
r = await call({ query: FQ, body: { action: "adduser", pin: FPIN } }); check("Lift2 friend can't add users", r.code === 403);
r = await call({ body: { action: "users", pin: FULL } }); check("no users at first", r.code === 200 && r.j.users.length === 0);
r = await call({ body: { action: "adduser", pin: FULL, name: "  Saad <b>  " } }); const U1 = r.j.user;
check("add user → 6-digit code + name", r.code === 200 && /^\d{6}$/.test(U1.code) && U1.name === "Saad b" && r.j.users.length === 1);
r = await call({ body: { action: "adduser", pin: FULL } }); const U2 = r.j.user;
check("second user: default name, different code", r.code === 200 && U2.name === "Friend 2" && U2.code !== U1.code);
check("codes never clash with Moaath's or Lift2's", ![FULL, LITE, FPIN].includes(U1.code) && ![FULL, LITE, FPIN].includes(U2.code));
r = await call({ body: { action: "state", pin: U1.code } }); check("new user opens a clean, empty Lift", r.code === 200 && r.j.v === 0 && r.j.state === null && r.j.admin === false && r.j.user.name === "Saad b" && r.j.role === "full");
r = await call({ body: { action: "save", pin: U1.code, v: 0, state: { mine: "saad" } } }); check("user saves own data", r.code === 200 && r.j.v === 1);
check("user's data lives in own key", store.has("lift-u-" + U1.id + ":state") && JSON.parse(store.get("lift-u-" + U1.id + ":state")).state.mine === "saad");
r = await call({ body: { action: "state", pin: U2.code } }); check("other user still sees nothing of the first", r.j.state === null);
r = await call({ body: { action: "state", pin: FULL } }); check("Moaath's data untouched by users", JSON.stringify({ v: r.j.v, state: r.j.state }) === JSON.stringify({ v: JSON.parse(store.get(K)).v, state: JSON.parse(store.get(K)).state }) && !(r.j.state && r.j.state.mine));
r = await call({ body: { action: "users", pin: U1.code } }); check("a user can't see the user list", r.code === 403);
r = await call({ body: { action: "adduser", pin: U1.code } }); check("a user can't add users", r.code === 403);
r = await call({ body: { action: "snapshot", pin: U1.code, name: "s1" } }); check("user snapshot stays in own namespace", r.code === 200 && store.has("lift-u-" + U1.id + ":snapshot:s1"));
r = await call({ query: FQ, body: { action: "state", pin: U1.code } }); check("user code doesn't open Lift2", r.code === 401);
r = await call({ body: { action: "state", pin: "000000" } }); check("unknown 6-digit code refused", r.code === 401);
r = await call({ body: { action: "deluser", pin: FULL, id: "nope" } }); check("remove unknown user → 404", r.code === 404);
r = await call({ body: { action: "deluser", pin: FULL, id: U1.id } }); check("Moaath removes a user", r.code === 200 && r.j.users.length === 1 && r.j.users[0].id === U2.id);
r = await call({ body: { action: "state", pin: U1.code } }); check("removed user's code stops working", r.code === 401);
r = await call({ body: { action: "state", pin: U2.code } }); check("the other user still works", r.code === 200);

console.log(`PASS ${pass}  FAIL ${fail}`); if (fail) { console.log("FAILED:\n - " + failures.join("\n - ")); process.exit(1); }
