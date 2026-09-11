// Local contract test for api/health-check.js — in-memory Upstash + mocked network. No real calls.
import { pathToFileURL } from 'node:url'; import { resolve as _resolvePath } from 'node:path';
const file = pathToFileURL(_resolvePath(process.cwd(), process.argv[2] || './api/health-check.js')).href; // resolve relative to where the command runs (CI runs from repo root)
process.env.KV_REST_API_URL = "https://kv.mock"; process.env.KV_REST_API_TOKEN = "t";
process.env.DEPLOY_SECRET = "moes-deploy-2026"; process.env.ANTHROPIC_API_KEY = "";
const store = new Map(); const kvLog = [];
globalThis.fetch = async (url, opts = {}) => {
  if (String(url).startsWith("https://kv.mock")) {
    const cmd = JSON.parse(opts.body); kvLog.push(cmd);
    const [op, k, v] = cmd; let result = null;
    if (op === "GET") result = store.has(k) ? store.get(k) : null;
    else if (op === "SET") { store.set(k, v); result = "OK"; }
    else if (op === "DEL") { store.delete(k); result = 1; }
    return new Response(JSON.stringify({ result }), { status: 200 });
  }
  if (String(url).includes("/api/")) return new Response(JSON.stringify({ ok: true, count: 5 }), { status: 200 });
  return new Response("{}", { status: 200 });
};
const mod = await import(file);
function call({ method = "POST", query = {}, body = {}, headers = {} }) {
  return new Promise((resolve) => {
    const res = { code: 200, h: {}, setHeader(k, v) { this.h[k] = v; }, status(c) { this.code = c; return this; },
      json(j) { resolve({ code: this.code, j }); }, end() { resolve({ code: this.code, j: null }); } };
    mod.default({ method, query, body, headers }, res);
  });
}
let pass = 0, fail = 0; const failures = [];
function check(name, cond) { if (cond) pass++; else { fail++; failures.push(name); } }
store.set("maqadi:state", JSON.stringify({ v: 188, state: { items: { a: 1 }, trips: [] } }));
store.set("wain:state", JSON.stringify({ v: 7, state: { wish: [{ id: "w1" }], visits: [], userPlaces: [], prefs: {}, traffic: {} } }));
store.set("maham:state", JSON.stringify({ v: 3, state: { lanes: {} } }));
const snap = () => ({ m: store.get("maqadi:state"), w: store.get("wain:state"), t: store.get("maham:state") });

// GET health
let r = await call({ method: "GET" }); check("GET health returns ok field", r.code === 200 && "ok" in r.j);
// PIN matrix per app
for (const [app, q] of [["maqadi", {}], ["wain", { app: "wain" }]]) {
  for (const pin of ["2026", "1234"]) { r = await call({ query: q, body: { action: "state", pin } }); check(`${app} state pin ${pin} 200`, r.code === 200); }
  r = await call({ query: q, body: { action: "state", pin: "0000" } }); check(`${app} bad pin 401`, r.code === 401);
  r = await call({ query: q, body: { action: "state" } }); check(`${app} no pin 401`, r.code === 401);
}
// Wain reads wain data, not grocery data
r = await call({ query: { app: "wain" }, body: { action: "state", pin: "2026" } });
check("wain state is wain doc (v=7)", r.j.v === 7 && r.j.state && Array.isArray(r.j.state.wish));
check("wain state has no grocery items", !(r.j.state && r.j.state.items));
// Wain save isolation
let before = snap();
r = await call({ query: { app: "wain" }, body: { action: "save", pin: "1234", v: 7, state: { wish: [], visits: [{ id: "x" }], userPlaces: [], prefs: {}, traffic: {} } } });
check("wain save 200 v=8", r.code === 200 && r.j.v === 8);
check("wain save did NOT touch maqadi:state", store.get("maqadi:state") === before.m);
check("wain save did NOT touch maham:state", store.get("maham:state") === before.t);
r = await call({ query: { app: "wain" }, body: { action: "save", pin: "2026", v: 3, state: {} } });
check("wain stale save 409", r.code === 409);
check("wain 409 did not write", JSON.parse(store.get("wain:state")).v === 8);
// Worst case from the bug: wain sends grocery version number
before = snap();
r = await call({ query: { app: "wain" }, body: { action: "save", pin: "2026", v: 188, state: { wish: [] } } });
check("wain save with grocery v=188 rejected 409", r.code === 409);
check("grocery data survives wain v=188 save", store.get("maqadi:state") === before.m);
// Maqadi
r = await call({ body: { action: "state", pin: "2026" } }); check("maqadi state v=188 items", r.j.v === 188 && r.j.state.items && r.j.role === "full");
r = await call({ body: { action: "state", pin: "1234" } }); check("maqadi lite role", r.j.role === "lite" && r.j.usage === undefined);
for (const a of ["receipt", "compare", "photoset"]) { r = await call({ body: { action: a, pin: "1234" } }); check(`maqadi lite blocked ${a} 403`, r.code === 403); }
before = snap();
r = await call({ body: { action: "save", pin: "1234", v: 188, state: { items: { a: 2 }, trips: [] } } });
check("maqadi save 200 v=189", r.code === 200 && r.j.v === 189);
check("maqadi save did NOT touch wain:state", store.get("wain:state") === before.w);
// Maham
r = await call({ body: { action: "taskstate", pin: "1234" } }); check("maham refuses wife code 403", r.code === 403);
r = await call({ body: { action: "taskstate", pin: "2026" } }); check("maham taskstate v=3", r.code === 200 && r.j.v === 3);
before = snap();
r = await call({ body: { action: "tasksave", pin: "2026", v: 3, state: { lanes: { today: [] } } } });
check("maham tasksave v=4", r.j.v === 4);
check("maham save did NOT touch grocery or wain", store.get("maqadi:state") === before.m && store.get("wain:state") === before.w);
// AI actions must not run without key (no spend path in tests)
r = await call({ body: { action: "compare", pin: "2026", items: [] } }); check("compare without key refuses 500 (no AI call)", r.code === 500);
// Unknown action
r = await call({ query: { app: "wain" }, body: { action: "nope", pin: "2026" } }); check("wain unknown action 400", r.code === 400);
r = await call({ method: "OPTIONS", query: { app: "wain" } }); check("wain OPTIONS ok", r.code === 204 || r.code === 200);

console.log(`PASS ${pass}  FAIL ${fail}`); if (fail) { console.log("FAILED:\n - " + failures.join("\n - ")); process.exit(1); }
