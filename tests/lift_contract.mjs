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

console.log(`PASS ${pass}  FAIL ${fail}`); if (fail) { console.log("FAILED:\n - " + failures.join("\n - ")); process.exit(1); }
