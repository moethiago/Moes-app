// Picks one real, freely-licensed photo per recipe from Wikimedia Commons.
// Runs in GitHub Actions (Wikimedia rate-limits cloud sandboxes). No keys, no cost.
// In:  tabkh/recipes.js, tabkh/photo-overrides.json ({"<recipe name>": {"q": "...", "file": "File:...", "pick": n, "none": true}})
// Out: tabkh/photos.js (window.TABKH_PHOTOS = {name: [thumb, credit, sourcePage]}), tabkh/photo-candidates.json (for review)
import fs from "node:fs";
const DIR = process.argv[2] || "tabkh";
const UA = "MoesRecipes/1.0 (https://moethiago.github.io/Moes-app/tabkh/; m.alhunaishel@gmail.com) household recipe app";
const src = fs.readFileSync(`${DIR}/recipes.js`, "utf8");
const D = JSON.parse(src.slice(src.indexOf("=") + 1, src.lastIndexOf(";")));
let OV = {}; try { OV = JSON.parse(fs.readFileSync(`${DIR}/photo-overrides.json`, "utf8")); } catch {}
let OLD = {}; try { const o = fs.readFileSync(`${DIR}/photos.js`, "utf8"); OLD = JSON.parse(o.slice(o.indexOf("=") + 1, o.lastIndexOf(";"))); } catch {}

// never show pork, alcohol, or things that are not a plate of food
const BAD = /pork|bacon|\bham\b|hams\b|prosciutto|salami|pepperoni|chorizo|\blard\b|sausage|wurst|hot.?dog|pancetta|guanciale|speck|jam[oó]n|jambon|schwein|cerdo|carnitas|pastor|lech[oó]n|chicharr|\bpig|swine|piglet|boar\b|wine|beer|\bale\b|lager|alcohol|cocktail|vodka|\brum\b|whisk|bourbon|liqueur|champagne|sangria|\bsake\b|mirin|brandy|\bgin\b|tequila|margarita|mojito|logo|\bmap\b|flag|diagram|chart|icon|\.svg|drawing|illustration|poster|stamp|\bcoin|menu|label|packag|advert|\bbook|\bcover\b|screenshot|\bseal\b|coat of arms|\bsign\b|signage|statue|church|mosque|street|market stall|portrait|selfie|woman|\bman\b|people|crowd|restaurant exterior|nude|bikini|\bfur\b/i;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const strip = (h) => String(h || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().slice(0, 80);
const cache = {};
async function search(q) {
  if (cache[q]) return cache[q];
  const u = "https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=20" +
    "&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiextmetadatafilter=Artist|LicenseShortName&iiurlwidth=640&gsrsearch=" +
    encodeURIComponent(q + " filetype:bitmap");
  for (let a = 0; a < 5; a++) {
    let r; try { r = await fetch(u, { headers: { "User-Agent": UA } }); } catch (e) { await sleep(3000 * (a + 1)); continue; }
    if (r.status === 429) { await sleep(5000 * (a + 1)); continue; }
    if (!r.ok) { await sleep(1000); continue; }
    let j; try { j = await r.json(); } catch (e) { await sleep(1000); continue; } await sleep(250);
    const pages = Object.values((j.query && j.query.pages) || {}).sort((x, y) => (x.index || 0) - (y.index || 0));
    const out = [];
    for (const p of pages) {
      const ii = (p.imageinfo || [])[0]; if (!ii) continue;
      if (!/jpe?g|png|webp/.test(ii.mime || "")) continue;
      if ((ii.width || 0) < 480 || (ii.height || 0) < 360) continue;
      const ratio = ii.width / ii.height; if (ratio < 0.55 || ratio > 2.2) continue;
      if (BAD.test(p.title)) continue;
      const m = ii.extmetadata || {};
      out.push({ i: out.length, t: p.title, u: ii.thumburl || ii.url, c: [strip(m.Artist && m.Artist.value), m.LicenseShortName && m.LicenseShortName.value].filter(Boolean).join(" · "), s: ii.descriptionurl });
    }
    return (cache[q] = out);
  }
  return (cache[q] = []);
}
async function byFile(title) {
  const u = "https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|extmetadata&iiextmetadatafilter=Artist|LicenseShortName&iiurlwidth=640&titles=" + encodeURIComponent(title);
  let j; try { const r = await fetch(u, { headers: { "User-Agent": UA } }); j = await r.json(); } catch (e) { return null; } await sleep(250);
  const p = Object.values((j.query && j.query.pages) || {})[0]; const ii = p && p.imageinfo && p.imageinfo[0]; if (!ii) return null;
  const m = ii.extmetadata || {};
  return { t: p.title, u: ii.thumburl || ii.url, c: [strip(m.Artist && m.Artist.value), m.LicenseShortName && m.LicenseShortName.value].filter(Boolean).join(" · "), s: ii.descriptionurl };
}

const photos = {}, cands = {}, used = new Set();
function save() {
  // keep picks from the previous file for recipes not reached yet, so a crash never loses work
  const out = Object.assign({}, OLD, photos);
  for (const k of Object.keys(out)) if (!D.r.some((r) => r.n === k)) delete out[k];
  fs.writeFileSync(`${DIR}/photos.js`, "window.TABKH_PHOTOS=" + JSON.stringify(out) + ";\n");
  fs.writeFileSync(`${DIR}/photo-candidates.json`, JSON.stringify(cands));
}
const REJ = new Set(OV._reject || []);
const DISH = /plate|dish|bowl|served|serving|homemade|home.made|breakfast|lunch|dinner|meal|salad|soup|stew|sandwich|wrap|toast|cooked|recipe|platter|skillet|tray|cup|glass/i;
const RAW = /\braw\b|field|plant|tree|flower|seed|market|stall|harvest|garden|leaf|leaves|bush|growing|farm|shop|store|supermarket|vendor|factory|label|bottle|jar|package|tin\b|can\b|carton|botan|cultivar|crop/i;
const words = (q) => q.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 2 && !["with","and","the","food"].includes(w));
function score(x, q) {
  const t = x.t.toLowerCase(), ws = words(q);
  let s = 0; ws.forEach((w) => { if (t.includes(w)) s += 3; });
  if (DISH.test(t)) s += 2;
  if (RAW.test(t) && !RAW.test(q)) s -= 4;
  return s - x.i * 0.15; // search rank still matters a little
}
// keep reviewed picks stable: a recipe whose query/override did not change keeps its photo
const ONLY = process.env.ONLY_NEW === "1";
let n = 0;
for (const r of D.r) {
  const o = (r.n[0] !== "_" && OV[r.n]) || {};
  if (o.none) continue;
  if (ONLY && OLD[r.n] && !o.q && !o.file && o.pick == null && !REJ.has(OLD[r.n][3])) { photos[r.n] = OLD[r.n]; used.add(OLD[r.n][0]); continue; }
  let pick = null, list = [];
  if (o.file) pick = await byFile(o.file);
  if (!pick) {
    const q = o.q || r.w;
    list = (await search(q)).filter((x) => !REJ.has(x.t));
    if (list.length < 3) list = list.concat((await search(q.split(" ").slice(0, 2).join(" ") + " dish")).filter((x) => !REJ.has(x.t) && !list.some((y) => y.u === x.u)));
    list = list.slice().sort((a, b) => score(b, q) - score(a, q));
    const free = list.filter((x) => !used.has(x.u));
    pick = o.pick != null ? list[o.pick] : (free[0] || list[0]);
  }
  cands[r.n] = list.slice(0, 8).map((x) => [x.u, x.t]);
  if (pick) { photos[r.n] = [pick.u, pick.c, pick.s, pick.t]; used.add(pick.u); }
  if (++n % 50 === 0) { console.log(n, "recipes done"); save(); }
}
save();
const miss = D.r.filter((r) => !photos[r.n]).map((r) => r.n);
console.log(`photos: ${Object.keys(photos).length}/${D.r.length} · missing: ${miss.length}`, miss.slice(0, 30).join(" | "));
