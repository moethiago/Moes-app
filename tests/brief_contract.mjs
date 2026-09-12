// Contract test for the Daily Brief route in api/feed.js — in-memory KV, mocked RSS + Groq. No real calls, zero cost.
// Usage: node tests/brief_contract.mjs ./api/feed.js
import { pathToFileURL } from 'node:url'; import { resolve as _resolvePath } from 'node:path';
const file = pathToFileURL(_resolvePath(process.cwd(), process.argv[2] || './api/feed.js')).href; // resolve relative to where the command runs (CI runs from repo root)
process.env.KV_REST_API_URL = "https://kv.mock"; process.env.KV_REST_API_TOKEN = "t";
process.env.GROQ_API_KEY = "test-key";
const store = new Map(); let ghDispatch = 0, ghStatus = 204; let groqCalls = 0, geminiCalls = 0, rssCalls = 0; let groqReply = null; let failSources = new Set(); let groqStatus = 200;
const now = new Date();
const WORDS = ['ministry','budget','oil','election','parliament','tariff','airline','rainfall','harvest','pipeline','summit','ceasefire','inflation','chip','satellite','port','tunnel','drought','vaccine','currency','census','railway','refinery','festival','tender','merger','strike','fleet','cabinet','reservoir'];
let wi = 0; const distinct = () => { const a = WORDS[wi++ % WORDS.length], b = WORDS[(wi*7) % WORDS.length], c = WORDS[(wi*11+3) % WORDS.length]; return `${a}${wi} ${b}${wi}x ${c}${wi}y kq${wi}z`; };
const rss = (src, n, suffix='') => `<rss><channel>${Array.from({length:n},(_,i)=>`<item><title>${distinct()} (${src})${suffix}</title><link>https://x.test/${src}/${i}</link><pubDate>${new Date(now - (i+1)*3600e3).toUTCString()}</pubDate></item>`).join('')}</channel></rss>`;
globalThis.fetch = async (url, opts = {}) => {
  url = String(url);
  if (url.startsWith("https://kv.mock")) {
    const cmd = JSON.parse(opts.body); const [op, k, v] = cmd; let result = null;
    if (op === "GET") result = store.has(k) ? store.get(k) : null;
    else if (op === "SET") { store.set(k, v); result = "OK"; }
    else if (op === "INCR") { const c = Number(store.get(k) || 0) + 1; store.set(k, String(c)); result = c; }
    else if (op === "EXPIRE") result = 1;
    else if (op === "DEL") { result = store.delete(k) ? 1 : 0; }
    else if (op === "ZRANGE") result = [];
    return new Response(JSON.stringify({ result }), { status: 200 });
  }
  if (url.includes("api.github.com") && url.includes("/dispatches")) { ghDispatch++; return ghStatus === 204 ? { status: 204, text: async () => "" } : new Response("{\"message\":\"nope\"}", { status: ghStatus }); }
  if (url.includes("generativelanguage.googleapis.com")) { geminiCalls++; if (url.includes("gemini-3.6-flash") && process.env.T_GEMINI25_404) return new Response(JSON.stringify({ error: { message: "model not found" } }), { status: 404 }); return new Response(JSON.stringify(groqStatus === 200 ? { usageMetadata: { totalTokenCount: 2100 }, candidates: [{ content: { parts: [{ text: groqReply }] } }] } : { error: { message: "rate limited" } }), { status: groqStatus }); }
  if (url.includes("api.groq.com")) { groqCalls++; return new Response(JSON.stringify(groqStatus === 200 ? { model: "llama-3.3-70b-versatile", usage: { total_tokens: 3210 }, choices: [{ message: { content: groqReply } }] } : { error: { message: "rate limited" } }), { status: groqStatus }); }
  if (url.includes("trends24.in")) { if (failSources.has("trends24_in")) return new Response("x", { status: 500 }); return new Response('<a class="trend-link" href="#">#الهلال_النصر</a><a class="trend-link">العراق</a><a class="trend-link">#اعلن_ترند_0570273243</a><a class="trend-link">#الهلال_النصر</a>', { status: 200 }); }
  if (url.startsWith("https://syndication.twitter.com/")) {
    rssCalls++; const handle = decodeURIComponent(url.split('/screen-name/')[1]);
    if (failSources.has(handle)) return new Response("nope", { status: 500 });
    const tweets = Array.from({ length: 12 }, (_, i) => ({ type: "tweet", content: { tweet: { id_str: handle + "0" + i, full_text: (i === 11 ? "@someone reply text that should be skipped entirely" : distinct() + " " + (i % 4 === 0 ? "https://t.co/abc" : "")), created_at: new Date(now - (i + 1) * 3600e3 * (i === 10 ? 40 : 1)).toUTCString(), favorite_count: i * 10, retweet_count: i, user: { screen_name: handle }, ...(i === 2 ? { retweeted_status: { id_str: "rt" + i, full_text: distinct() + " retweeted original", created_at: new Date(now - 2 * 3600e3).toUTCString(), favorite_count: 500, retweet_count: 90, user: { screen_name: "orig_" + handle } } } : {}) } } }));
    return new Response('<html><script id="__NEXT_DATA__" type="application/json">' + JSON.stringify({ props: { pageProps: { timeline: { entries: tweets } } } }) + '</script></html>', { status: 200 });
  }
  rssCalls++;
  const name = url.replace(/https?:\/\//,'').split('/')[0].replace(/\W/g,'_');
  if (failSources.has(name)) return new Response("nope", { status: 500 });
  return new Response(rss(name, 6), { status: 200 });
};
const mod = await import(file);
function call(query) { return new Promise((resolve) => { const res = { code: 200, h: {}, setHeader(k, v) { this.h[k] = v; }, status(c) { this.code = c; return this; }, json(j) { resolve({ code: this.code, j, h: this.h }); }, end() { resolve({ code: this.code, j: null }); } }; mod.default({ method: query.__method || "GET", query, body: query.__body || {}, headers: {} }, res); }); }
let pass = 0, fail = 0; const failures = [];
const check = (name, cond) => { if (cond) pass++; else { fail++; failures.push(name); } };
const goodReply = () => JSON.stringify({ headline: "Test headline of the day", items: [1,2,3,4,5,6,7,8,9,10,11].map(n => ({ n, tier: n===1?"critical":n<5?"high":"watch", section: n%2?"Saudi Arabia":"World", title:"T"+n, what:"W"+n, why:"Y"+n })), also: [12,13,14,15,16,17,18,19,20,3,999].map(n => ({ n, section: n%3?"Sport":"Society", line: "L"+n })), trending: [{ topic: "#الهلال_النصر", what: "derby tonight" }, { topic: "العراق", what: "drone attack" }], bottomLine: "Watch X." });

// 1. Plain feed still works (regression)
let r = await call({}); check("plain GET /feed still returns ok+stories", r.code === 200 && r.j.ok === true && Array.isArray(r.j.stories));
// 2. brief=1 with no cache never spends
r = await call({ brief: "1" }); check("brief no-cache -> cached:false", r.code === 200 && r.j.cached === false && r.j.cost); check("brief no-cache made no RSS/Groq calls", rssCalls === 0 && groqCalls === 0); check("brief sets no-store", r.h["Cache-Control"] === "no-store");
// 3. build=1 builds, maps urls, caches
groqReply = goodReply(); r = await call({ brief: "1", build: "1" });
check("build -> 200 built", r.code === 200 && r.j.built === true && r.j.brief);
check("build called Groq once", groqCalls === 1); check("build fetched all 18 default X accounts", rssCalls === 18);
check("items capped at 10", r.j.brief.items.length === 10);
check("items carry x.com permalink + @handle", r.j.brief.items.every(i => i.url && i.url.startsWith("https://x.com/") && /\/status\//.test(i.url) && i.source.startsWith("@")));
check("retweets credit original author in permalink", r.j.brief.items.concat(r.j.brief.also).some(i => /x\.com\/orig_/.test(i.url)));
check("t.co links stripped, replies and >26h tweets dropped", r.j.brief.items.concat(r.j.brief.also).every(i => !/t\.co/.test(i.title || i.line)) && r.j.brief.headlinesSeen === 18 * 10);
check("critical ranked first", r.j.brief.items[0].tier === "critical" && r.j.brief.items[0].rank === 1);
check("costSAR is 0 and tokens recorded", r.j.brief.costSAR === 0 && r.j.brief.tokens === 3210);
check("cached under brief:<date>", [...store.keys()].some(k => /^brief:\d{4}-\d{2}-\d{2}$/.test(k)));
check("also layer mapped, dedupes vs items (n=3) and drops bad n (999)", r.j.brief.also.length === 9 && r.j.brief.also.every(a => a.url && a.source && a.line));
check("also sections validated", r.j.brief.also.every(a => ["Sport","Society"].includes(a.section)));

check("trending passed through, spam trend filtered before the model", r.j.brief.trending.length === 2 && r.j.brief.trendsSeen === 2);
// 4. second read is cached, no spend
r = await call({ brief: "1" }); check("read after build -> cached:true", r.j.cached === true && r.j.brief.items.length === 10); check("cached read made no Groq call", groqCalls === 1);
// 5. build again same day without force -> cached
r = await call({ brief: "1", build: "1" }); check("re-build without force returns cache", r.j.cached === true && groqCalls === 1);
// 6. force rebuild
r = await call({ brief: "1", build: "1", force: "1" }); check("force rebuild calls Groq again", r.j.built === true && groqCalls === 2);
// 7. one source down still builds
failSources = new Set(["Reuters"]); r = await call({ brief: "1", build: "1", force: "1" });
check("build survives a failing account and reports it", r.code === 200 && r.j.brief.sources.failed.length === 1 && /@Reuters/.test(r.j.brief.sources.failed[0]) && r.j.brief.sources.ok.length === 17); failSources = new Set();
failSources = new Set(["trends24_in"]); r = await call({ brief: "1", build: "1", force: "1" }); check("trends page down -> brief still builds, trendsSeen 0", r.code === 200 && r.j.brief.trendsSeen === 0); failSources = new Set();
const resetCap = () => { for (const k of [...store.keys()]) if (k.startsWith("brief:builds:")) store.delete(k); };
resetCap();
// 8. garbage from Groq -> 502, cache untouched
const before = store.get([...store.keys()].find(k => /^brief:\d{4}/.test(k)));
groqReply = "not json at all"; r = await call({ brief: "1", build: "1", force: "1" }); check("non-JSON Groq -> 502", r.code === 502 && r.j.ok === false);
groqReply = JSON.stringify({ items: [{ n: 999, tier: "high" }] }); r = await call({ brief: "1", build: "1", force: "1" }); check("unmappable items -> 502", r.code === 502);
check("failed builds did not overwrite cache", store.get([...store.keys()].find(k => /^brief:\d{4}/.test(k))) === before);
// 9. Groq HTTP error -> 502
groqStatus = 429; groqReply = goodReply(); r = await call({ brief: "1", build: "1", force: "1" }); check("Groq 429 -> 502 with message", r.code === 502 && /rate limited/.test(r.j.error)); groqStatus = 200;
// 10. daily cap: 6 builds allowed per day, the 7th must be 429
resetCap(); for (let i = 0; i < 6; i++) await call({ brief: "1", build: "1", force: "1" });
r = await call({ brief: "1", build: "1", force: "1" }); check("daily build cap -> 429", r.code === 429);
// 11. engine selection: no Groq key + Gemini key -> Gemini (free), engine label + tokens recorded
store.clear(); delete process.env.GROQ_API_KEY; process.env.GEMINI_API_KEY = "gk"; groqReply = goodReply(); let g = groqCalls;
r = await call({ brief: "1", build: "1" }); check("no Groq key -> Gemini builds", r.code === 200 && r.j.built === true && geminiCalls === 1 && groqCalls === g);
check("gemini engine labelled + tokens", /^gemini\//.test(r.j.brief.engine) && r.j.brief.tokens === 2100 && r.j.brief.costSAR === 0);
store.clear(); process.env.T_GEMINI25_404 = "1"; r = await call({ brief: "1", build: "1" }); check("gemini 3.6 missing -> falls back to next model", r.code === 200 && r.j.brief.engine === "gemini/gemini-3.5-flash"); delete process.env.T_GEMINI25_404;
store.clear(); process.env.GROQ_API_KEY = "test-key"; r = await call({ brief: "1", build: "1" }); check("Groq key present -> Groq preferred", r.j.brief.engine.startsWith("groq/") && groqCalls === g + 1);
store.clear(); delete process.env.GROQ_API_KEY; delete process.env.GEMINI_API_KEY; g = groqCalls; const ge = geminiCalls; r = await call({ brief: "1", build: "1" }); check("no engine key -> 500, no call", r.code === 500 && groqCalls === g && geminiCalls === ge);
// 12. too few headlines -> 503
process.env.GROQ_API_KEY = "test-key"; store.clear(); failSources = new Set(["spagov","Sabqorg","AjelNews24","OKAZ_online","alekhbariyatv","SaudiNews50","AlArabiya","AlHadath","argaam","aleqtisadiah","Reuters","BBCBreaking","AJABreaking","Spectatorindex","arabnews","Saudi_Gazette","SPL","SaudiNT"]);
r = await call({ brief: "1", build: "1" }); check("all sources down -> 503, no Groq", r.code === 503 && groqCalls === g);
// 13. accounts: read is free; edit needs code; additions and removals affect the build
failSources = new Set(); store.clear(); process.env.GROQ_API_KEY = "test-key"; process.env.DEPLOY_SECRET = "sekret"; groqReply = goodReply(); resetCap();
r = await call({ brief: "1", accounts: "1" }); check("accounts read -> 18 defaults, editable", r.code === 200 && r.j.accounts.length === 18 && r.j.editable === true && r.j.accounts.every(a => a.isDefault));
r = await call({ brief: "1", accounts: "1", add: "@Some_Voice", code: "wrong" }); check("add with wrong code -> 401", r.code === 401);
r = await call({ brief: "1", accounts: "1", add: "@Some_Voice", code: "sekret" }); check("add voice -> 19 accounts, VOICE cat, not default", r.code === 200 && r.j.accounts.length === 19 && r.j.accounts.some(a => a.handle === "some_voice" && a.cat === "VOICE" && !a.isDefault));
r = await call({ brief: "1", accounts: "1", remove: "SPL", code: "sekret" }); check("remove a default -> 18, SPL gone", r.j.accounts.length === 18 && !r.j.accounts.some(a => a.handle === "SPL"));
r = await call({ brief: "1", accounts: "1", add: "bad handle!!", code: "sekret" }); check("invalid handle ignored", r.j.accounts.length === 18);
const before13 = rssCalls; r = await call({ brief: "1", build: "1" }); check("build uses edited list (18 fetches incl. voice, no SPL)", r.code === 200 && rssCalls - before13 === 18 && r.j.brief.sources.ok.some(x => /@some_voice/.test(x)) && !r.j.brief.sources.ok.some(x => /@SPL /.test(x)));
delete process.env.DEPLOY_SECRET; r = await call({ brief: "1", accounts: "1" }); check("no code configured -> read-only", r.j.editable === false);
// 14. cap reset needs code and clears the counter
process.env.DEPLOY_SECRET = "sekret"; resetCap(); for (let i = 0; i < 6; i++) await call({ brief: "1", build: "1", force: "1" });
r = await call({ brief: "1", build: "1", force: "1" }); check("cap reached -> 429", r.code === 429);
r = await call({ brief: "1", resetcap: "1", code: "nope" }); check("resetcap wrong code -> 401", r.code === 401);
r = await call({ brief: "1", resetcap: "1", code: "sekret" }); check("resetcap ok", r.code === 200 && r.j.reset === true);
r = await call({ brief: "1", build: "1", force: "1" }); check("build works again after reset", r.code === 200 && r.j.built === true);
// 15. runner path: with GITHUB_TOKEN, build dispatches the workflow and returns 202; ingest completes it
store.clear(); resetCap(); process.env.GITHUB_TOKEN = "ghp_test"; process.env.GROQ_API_KEY = "test-key"; groqReply = goodReply(); const rss15 = rssCalls, g15 = groqCalls;
r = await call({ brief: "1", build: "1" }); check("build with token -> 202 queued, workflow dispatched, no direct X fetch, no model call", r.code === 202 && r.j.queued === true && ghDispatch === 1 && rssCalls === rss15 && groqCalls === g15);
const nonceKey = [...store.keys()].find(k => k.startsWith("brief:nonce:")); check("nonce stored", !!nonceKey);
r = await call({ brief: "1" }); check("read shows queued status", r.j.cached === false && r.j.status && r.j.status.state === "queued");
r = await call({ brief: "1", ingest: "1", __method: "GET" }); check("ingest via GET -> 405", r.code === 405);
r = await call({ brief: "1", ingest: "1", __method: "POST", __body: { nonce: "wrong", tweets: [] } }); check("ingest wrong nonce -> 401", r.code === 401);
const mk = (n, cat) => ({ title: `kq${n}a kq${n}b kq${n}c unique post ${n}`, url: "https://x.com/u/status/" + n, src: "@acc" + (n % 5), cat, weight: 8, publishedAt: Math.floor(Date.now() / 1000) - 3600, likes: n, rts: 1 });
const tweets = [...Array(40)].map((_, i) => mk(i, i % 2 ? "KSA" : "WORLD")).concat([{ ...mk(99, "KSA"), publishedAt: Math.floor(Date.now() / 1000) - 40 * 3600 }]);
r = await call({ brief: "1", ingest: "1", __method: "POST", __body: { nonce: store.get(nonceKey), tweets, okSrc: ["@a (KSA, 20)"], failed: ["@b (KSA): HTTP 429"] } });
check("ingest with nonce -> built, old post dropped, sources passed through", r.code === 200 && r.j.built === true && r.j.brief.headlinesSeen === 40 && r.j.brief.sources.failed[0] === "@b (KSA): HTTP 429" && groqCalls === g15 + 1);
check("nonce consumed (single use)", !store.has(nonceKey));
r = await call({ brief: "1", build: "1", force: "1" }); const gd = ghDispatch; r = await call({ brief: "1", build: "1", force: "1" }); check("second build while queued -> 202 dedup, no second dispatch", r.code === 202 && r.j.dedup === true && ghDispatch === gd);
{ const nk = [...store.keys()].find(k => k.startsWith("brief:nonce:")); r = await call({ brief: "1", ingest: "1", __method: "POST", __body: { nonce: store.get(nk), tweets } }); }
r = await call({ brief: "1" }); check("read after ingest -> cached brief", r.j.cached === true && r.j.brief.items.length === 10);
r = await call({ brief: "1", ingest: "1", __method: "POST", __body: { nonce: "x", tweets } }); check("replay -> 401", r.code === 401);
ghStatus = 500; r = await call({ brief: "1", build: "1", force: "1" }); check("dispatch failure -> 502 with status error", r.code === 502 && (await (async()=>{const st=JSON.parse(store.get([...store.keys()].find(k=>k.startsWith("brief:status:"))));return st.state==="error";})())); ghStatus = 204;
r = await call({ brief: "1", build: "1", force: "1" }); const nk2 = [...store.keys()].find(k => k.startsWith("brief:nonce:"));
r = await call({ brief: "1", ingest: "1", __method: "POST", __body: { nonce: store.get(nk2), tweets: tweets.slice(0, 3) } }); check("too few posts -> 503 and status error", r.code === 503);
delete process.env.GITHUB_TOKEN;
console.log(`PASS ${pass}  FAIL ${fail}`); if (fail) { console.log("FAILURES:", failures); process.exit(1); }
