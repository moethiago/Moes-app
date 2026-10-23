// Builds a pool of real photos per dish from curated Wikimedia Commons categories.
// In:  tabkh/photo-dishes.json  {dish: ["Category:...", ...]}
// Out: tabkh/dish-candidates.json {dish: {cats: {cat: files_found}, c: [[thumb500, title, credit, page]]}}
// Runs in GitHub Actions (Wikimedia rate-limits cloud sandboxes). No keys, no cost.
import fs from "node:fs";
const DIR = process.argv[2] || "tabkh";
const UA = "MoesRecipes/1.0 (https://moethiago.github.io/Moes-app/tabkh/; m.alhunaishel@gmail.com) household recipe app";
const DISHES = JSON.parse(fs.readFileSync(`${DIR}/photo-dishes.json`, "utf8"));
const ONLY = (process.env.ONLY || "").split(",").filter(Boolean);
let OUT = {}; try { OUT = JSON.parse(fs.readFileSync(`${DIR}/dish-candidates.json`, "utf8")); } catch {}
const BAD = /pork|bacon|\bham\b|hams\b|prosciutto|salami|pepperoni|chorizo|\blard\b|sausage|wurst|hot.?dog|pancetta|guanciale|speck|jam[oó]n|jambon|schwein|cerdo|carnitas|pastor|lech[oó]n|chicharr|\bpig|swine|boar\b|wine|beer|\bale\b|lager|alcohol|cocktail|vodka|\brum\b|whisk|bourbon|liqueur|champagne|sangria|\bsake\b|mirin|brandy|\bgin\b|tequila|margarita|mojito|logo|\bmap\b|flag|diagram|chart|icon|\.svg|drawing|illustration|poster|stamp|\bcoin|menu|label|packag|advert|\bbook|\bcover\b|screenshot|\bseal\b|\bsign\b|statue|church|mosque|street|portrait|selfie|woman|\bman\b|people|crowd|nude|bikini|painting|museum|engraving|lithograph|postcard|recipe card/i;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const strip = (h) => String(h || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().slice(0, 80);
async function api(params) {
  const u = "https://commons.wikimedia.org/w/api.php?format=json&" + new URLSearchParams(params).toString();
  for (let a = 0; a < 5; a++) {
    try {
      const r = await fetch(u, { headers: { "User-Agent": UA } });
      if (r.status === 429) { await sleep(5000 * (a + 1)); continue; }
      if (!r.ok) { await sleep(1500); continue; }
      const j = await r.json(); await sleep(250); return j;
    } catch (e) { await sleep(3000 * (a + 1)); }
  }
  return {};
}
async function files(cat, limit) {
  const j = await api({ action: "query", generator: "categorymembers", gcmtitle: cat, gcmtype: "file", gcmlimit: String(limit),
    prop: "imageinfo", iiprop: "url|size|mime|extmetadata", iiextmetadatafilter: "Artist|LicenseShortName", iiurlwidth: "500" });
  const out = [];
  for (const p of Object.values((j.query && j.query.pages) || {})) {
    const ii = (p.imageinfo || [])[0]; if (!ii) continue;
    if (!/jpe?g|png|webp/.test(ii.mime || "")) continue;
    if ((ii.width || 0) < 600 || (ii.height || 0) < 400) continue;
    const ratio = ii.width / ii.height; if (ratio < 0.6 || ratio > 2.0) continue;
    if (BAD.test(p.title)) continue;
    const m = ii.extmetadata || {};
    out.push([ii.thumburl || ii.url, p.title, [strip(m.Artist && m.Artist.value), m.LicenseShortName && m.LicenseShortName.value].filter(Boolean).join(" · "), ii.descriptionurl]);
  }
  return out;
}
async function subcats(cat) {
  const j = await api({ action: "query", list: "categorymembers", cmtitle: cat, cmtype: "subcat", cmlimit: "20" });
  return ((j.query && j.query.categorymembers) || []).map((x) => x.title).filter((t) => !BAD.test(t));
}
for (const [dish, cats] of Object.entries(DISHES)) {
  if (ONLY.length && !ONLY.includes(dish)) continue;
  const res = { cats: {}, c: [] }, seen = new Set();
  const add = (list) => { for (const x of list) if (!seen.has(x[1]) && res.c.length < 36) { seen.add(x[1]); res.c.push(x); } };
  for (const cat of cats) {
    const f = await files(cat, 60); res.cats[cat] = f.length; add(f);
    if (res.c.length < 24) for (const sc of (await subcats(cat)).slice(0, 6)) { const g = await files(sc, 30); res.cats[sc] = g.length; add(g); if (res.c.length >= 36) break; }
  }
  OUT[dish] = res;
  console.log(dish, res.c.length, JSON.stringify(res.cats));
  fs.writeFileSync(`${DIR}/dish-candidates.json`, JSON.stringify(OUT));
}
