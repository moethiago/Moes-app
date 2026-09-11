// Contract test for the Daily Brief route in api/feed.js — in-memory KV, mocked RSS + Groq. No real calls, zero cost.
// Usage: node tests/brief_contract.mjs ./api/feed.js
import { pathToFileURL } from 'node:url'; import { resolve as _resolvePath } from 'node:path';
const file = pathToFileURL(_resolvePath(process.cwd(), process.argv[2] || './api/feed.js')).href; // resolve relative to where the command runs (CI runs from repo root)
process.env.KV_REST_API_URL = "https://kv.mock"; process.env.KV_REST_API_TOKEN = "t";
process.env.GROQ_API_KEY = "test-key";
const store = new Map(); let groqCalls = 0, geminiCalls = 0, rssCalls = 0; let groqReply = null; let failSources = new Set(); let groqStatus = 200;
const now = new Date();
const WORDS = ['ministry','budget','oil','election','parliament','tariff','airline','rainfall','harvest','pipeline','summit','ceasefire','inflation','chip','satellite','port','tunnel','drought','vaccine','currency','census','railway','refinery','festival','tender','merger','strike','fleet','cabinet','reservoir'];
let wi = 0; const distinct = () => { const a = WORDS[wi++ % WORDS.length], b = WORDS[(wi*7) % WORDS.length], c = WORDS[(wi*11+3) % WORDS.length]; return `${a} ${b} ${c} ${wi} announced overnight`; };
const rss = (src, n) => `<rss><channel>${Array.from({length:n},(_,i)=>`<item><title>${distinct()} (${src})</title><link>https://x.test/${src}/${i}</link><pubDate>${new Date(now - (i+1)*3600e3).toUTCString()}</pubDate></item>`).join('')}</channel></rss>`;
globalThis.fetch = async (url, opts = {}) => {
  url = String(url);
  if (url.startsWith("https://kv.mock")) {
    const cmd = JSON.parse(opts.body); const [op, k, v] = cmd; let result = null;
    if (op === "GET") result = store.has(k) ? store.get(k) : null;
    else if (op === "SET") { store.set(k, v); result = "OK"; }
    else if (op === "INCR") { const c = Number(store.get(k) || 0) + 1; store.set(k, String(c)); result = c; }
    else if (op === "EXPIRE") result = 1;
    else if (op === "ZRANGE") result = [];
    return new Response(JSON.stringify({ result }), { status: 200 });
  }
  if (url.includes("generativelanguage.googleapis.com")) { geminiCalls++; if (url.includes("gemini-3.6-flash") && process.env.T_GEMINI25_404) return new Response(JSON.stringify({ error: { message: "model not found" } }), { status: 404 }); return new Response(JSON.stringify(groqStatus === 200 ? { usageMetadata: { totalTokenCount: 2100 }, candidates: [{ content: { parts: [{ text: groqReply }] } }] } : { error: { message: "rate limited" } }), { status: groqStatus }); }
  if (url.includes("api.groq.com")) { groqCalls++; return new Response(JSON.stringify(groqStatus === 200 ? { model: "llama-3.3-70b-versatile", usage: { total_tokens: 3210 }, choices: [{ message: { content: groqReply } }] } : { error: { message: "rate limited" } }), { status: groqStatus }); }
  rssCalls++;
  const name = url.replace(/https?:\/\//,'').split('/')[0].replace(/\W/g,'_');
  if (failSources.has(name)) return new Response("nope", { status: 500 });
  return new Response(rss(name, 6), { status: 200 });
};
const mod = await import(file);
function call(query) { return new Promise((resolve) => { const res = { code: 200, h: {}, setHeader(k, v) { this.h[k] = v; }, status(c) { this.code = c; return this; }, json(j) { resolve({ code: this.code, j, h: this.h }); }, end() { resolve({ code: this.code, j: null }); } }; mod.default({ method: "GET", query, body: {}, headers: {} }, res); }); }
let pass = 0, fail = 0; const failures = [];
const check = (name, cond) => { if (cond) pass++; else { fail++; failures.push(name); } };
const goodReply = () => JSON.stringify({ headline: "Test headline of the day", items: [1,2,3,4,5,6,7,8,9,10,11].map(n => ({ n, tier: n===1?"critical":n<5?"high":"watch", section: n%2?"Saudi Arabia":"World", title:"T"+n, what:"W"+n, why:"Y"+n })), bottomLine: "Watch X." });

// 1. Plain feed still works (regression)
let r = await call({}); check("plain GET /feed still returns ok+stories", r.code === 200 && r.j.ok === true && Array.isArray(r.j.stories));
// 2. brief=1 with no cache never spends
r = await call({ brief: "1" }); check("brief no-cache -> cached:false", r.code === 200 && r.j.cached === false && r.j.cost); check("brief no-cache made no RSS/Groq calls", rssCalls === 0 && groqCalls === 0); check("brief sets no-store", r.h["Cache-Control"] === "no-store");
// 3. build=1 builds, maps urls, caches
groqReply = goodReply(); r = await call({ brief: "1", build: "1" });
check("build -> 200 built", r.code === 200 && r.j.built === true && r.j.brief);
check("build called Groq once", groqCalls === 1); check("build fetched all sources", rssCalls === 13);
check("items capped at 10", r.j.brief.items.length === 10);
check("items carry url+source from headlines", r.j.brief.items.every(i => i.url && i.url.startsWith("https://x.test/") && i.source));
check("critical ranked first", r.j.brief.items[0].tier === "critical" && r.j.brief.items[0].rank === 1);
check("costSAR is 0 and tokens recorded", r.j.brief.costSAR === 0 && r.j.brief.tokens === 3210);
check("cached under brief:<date>", [...store.keys()].some(k => /^brief:\d{4}-\d{2}-\d{2}$/.test(k)));
// 4. second read is cached, no spend
r = await call({ brief: "1" }); check("read after build -> cached:true", r.j.cached === true && r.j.brief.items.length === 10); check("cached read made no Groq call", groqCalls === 1);
// 5. build again same day without force -> cached
r = await call({ brief: "1", build: "1" }); check("re-build without force returns cache", r.j.cached === true && groqCalls === 1);
// 6. force rebuild
r = await call({ brief: "1", build: "1", force: "1" }); check("force rebuild calls Groq again", r.j.built === true && groqCalls === 2);
// 7. one source down still builds
failSources = new Set(["www_arabnews_com"]); r = await call({ brief: "1", build: "1", force: "1" });
check("build survives a failing source and reports it", r.code === 200 && r.j.brief.sources.failed.length === 3 && r.j.brief.sources.ok.length === 10); failSources = new Set();
// 8. garbage from Groq -> 502, cache untouched
const before = store.get([...store.keys()].find(k => /^brief:\d{4}/.test(k)));
groqReply = "not json at all"; r = await call({ brief: "1", build: "1", force: "1" }); check("non-JSON Groq -> 502", r.code === 502 && r.j.ok === false);
groqReply = JSON.stringify({ items: [{ n: 999, tier: "high" }] }); r = await call({ brief: "1", build: "1", force: "1" }); check("unmappable items -> 502", r.code === 502);
check("failed builds did not overwrite cache", store.get([...store.keys()].find(k => /^brief:\d{4}/.test(k))) === before);
// 9. Groq HTTP error -> 502
groqStatus = 429; groqReply = goodReply(); r = await call({ brief: "1", build: "1", force: "1" }); check("Groq 429 -> 502 with message", r.code === 502 && /rate limited/.test(r.j.error)); groqStatus = 200;
// 10. daily cap: builds so far = 7 (INCR each build attempt) -> next must be 429 (cap 6)
r = await call({ brief: "1", build: "1", force: "1" }); check("daily build cap -> 429", r.code === 429);
// 11. engine selection: no Groq key + Gemini key -> Gemini (free), engine label + tokens recorded
store.clear(); delete process.env.GROQ_API_KEY; process.env.GEMINI_API_KEY = "gk"; groqReply = goodReply(); let g = groqCalls;
r = await call({ brief: "1", build: "1" }); check("no Groq key -> Gemini builds", r.code === 200 && r.j.built === true && geminiCalls === 1 && groqCalls === g);
check("gemini engine labelled + tokens", /^gemini\//.test(r.j.brief.engine) && r.j.brief.tokens === 2100 && r.j.brief.costSAR === 0);
store.clear(); process.env.T_GEMINI25_404 = "1"; r = await call({ brief: "1", build: "1" }); check("gemini 3.6 missing -> falls back to next model", r.code === 200 && r.j.brief.engine === "gemini/gemini-3.5-flash"); delete process.env.T_GEMINI25_404;
store.clear(); process.env.GROQ_API_KEY = "test-key"; r = await call({ brief: "1", build: "1" }); check("Groq key present -> Groq preferred", r.j.brief.engine.startsWith("groq/") && groqCalls === g + 1);
store.clear(); delete process.env.GROQ_API_KEY; delete process.env.GEMINI_API_KEY; g = groqCalls; const ge = geminiCalls; r = await call({ brief: "1", build: "1" }); check("no engine key -> 500, no call", r.code === 500 && groqCalls === g && geminiCalls === ge);
// 12. too few headlines -> 503
process.env.GROQ_API_KEY = "test-key"; store.clear(); failSources = new Set(["www_arabnews_com","saudigazette_com_sa","en_majalla_com","feeds_bbci_co_uk","www_aljazeera_com","www_theguardian_com","www_cnbc_com","oilprice_com","techcrunch_com","www_formula1_com"]);
r = await call({ brief: "1", build: "1" }); check("all sources down -> 503, no Groq", r.code === 503 && groqCalls === g);
console.log(`PASS ${pass}  FAIL ${fail}`); if (fail) { console.log("FAILURES:", failures); process.exit(1); }
