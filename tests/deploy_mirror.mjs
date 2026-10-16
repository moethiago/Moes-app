// Deploy endpoint mirror grid — mocked GitHub, zero cost. lift/* must also land in lift2/*; nothing else mirrors.
// Run: node tests/deploy_mirror.mjs [./api/deploy.js]
import path from "node:path"; import { pathToFileURL } from "node:url";
process.env.DEPLOY_SECRET = "s"; process.env.GITHUB_TOKEN = "t";
const writes = [];
globalThis.fetch = async (url, opts = {}) => {
  const p = String(url).split("/contents/")[1].split("?")[0];
  if (!opts.method) return new Response("{}", { status: p === "lift2/new.txt" ? 404 : 200 }).constructor === Response ? new Response(JSON.stringify({ sha: "old-" + p }), { status: p.endsWith("new.txt") ? 404 : 200 }) : null;
  const b = JSON.parse(opts.body); writes.push({ p, content: b.content, sha: b.sha });
  return new Response(JSON.stringify({ content: { sha: "n" }, commit: { sha: "c" } }), { status: 200 });
};
const mod = await import(pathToFileURL(path.resolve(process.argv[2] || "./api/deploy.js")).href);
const call = (body) => new Promise((ok) => { const res = { c: 200, setHeader() {}, status(c) { this.c = c; return this; }, json(j) { ok({ c: this.c, j }); }, end() { ok({ c: this.c }); } }; mod.default({ method: "POST", body }, res); });
let pass = 0, fail = 0; const chk = (n, c) => { c ? pass++ : (fail++, console.log("FAIL " + n)); };
let r;
writes.length = 0; r = await call({ secret: "s", path: "lift/index.html", content: "hello" });
chk("lift file: 2 writes", writes.length === 2); chk("mirror goes to lift2/index.html", writes[1] && writes[1].p === "lift2/index.html");
chk("mirror has identical bytes", writes[1] && writes[1].content === writes[0].content); chk("mirror updates existing (sha sent)", writes[1] && writes[1].sha === "old-lift2/index.html");
chk("response reports mirror ok", r.c === 200 && r.j.mirror && r.j.mirror.ok);
writes.length = 0; r = await call({ secret: "s", path: "lift/new.txt", content: "x" }); chk("new lift file mirrors (no sha)", writes.length === 2 && !writes[1].sha);
writes.length = 0; r = await call({ secret: "s", path: "lift/icon.png", content: "QUJD", encoding: "base64" }); chk("binary mirrors same base64", writes.length === 2 && writes[1].content === "QUJD");
for (const p of ["maqadi/index.html", "lift2/index.html", "api/health-check.js", "liftx/a.js", "tests/lift_logic.mjs"]) {
  writes.length = 0; r = await call({ secret: "s", path: p, content: "x" }); chk(p + ": no mirror", writes.length === 1 && !r.j.mirror);
}
writes.length = 0; r = await call({ secret: "bad", path: "lift/index.html", content: "x" }); chk("bad secret: nothing written", r.c === 401 && writes.length === 0);
console.log(`MIRROR deploy: PASS ${pass}  FAIL ${fail}`); process.exit(fail ? 1 : 0);
