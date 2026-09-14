// Deterministic grid for shop-from-receipt and branded-vs-generic matching.
// Pure logic from api/health-check.js — no browser, no network, no AI.
import fs from 'node:fs';
const src = fs.readFileSync('api/health-check.js', 'utf8');
const nStart = src.indexOf('function normAr'), nEnd = src.indexOf('\n}', nStart) + 2;
const cut = (a, b) => src.slice(src.indexOf(a), src.indexOf(b));
const code = src.slice(nStart, nEnd) + '\n' + cut('/* ---------------- the solver', '/* ---------------- reader key');
const { solveReceipt, nameScore } = new Function(code + '\nreturn {solveReceipt, nameScore};')();
let pass = 0, fail = 0; const F = [];
const check = (n, c, x) => { if (c) pass++; else { fail++; F.push(n + (x ? " — " + x : "")); } };
const C = (id, name, price, inCart = true, qty = 1) => ({ id, name, price, inCart, qty });
const L = (name, total, qty = 1, unit = null) => ({ name_ar: name, line_total: total, qty, unit_price: unit, candidate: null });

/* the milk case: a branded item in the cart vs a generic catalogue entry */
let r = solveReceipt({ lines: [L("حليب نادك طازج كامل الدسم 800 مل", 6, 1, 6)],
  candidates: [C("gen", "حليب (كامل الدسم)", 6, false), C("brand", "حليب نادك", 6, true)], total: 6, pieces: 1 });
check("branded cart item wins over the generic entry", r.lines[0].itemId === "brand", JSON.stringify(r.lines[0]));
check("so it leaves the cart instead of sitting there", !r.lines[0].doubt && r.lines[0].itemId !== "gen");
check("verified, no question asked", r.verified === true);

r = solveReceipt({ lines: [L("حليب نادك طازج كامل الدسم 800 مل", 6, 1, 6)],
  candidates: [C("gen", "حليب (كامل الدسم)", 6, true), C("brand", "حليب نادك", 6, false)], total: 6, pieces: 1 });
check("when only the generic is in the cart, the generic is used", r.lines[0].itemId === "gen");

r = solveReceipt({ lines: [L("حليب المراعي كامل الدسم 2 لتر", 9.5, 1, 9.5), L("حليب نادك طازج 800 مل", 6, 1, 6)],
  candidates: [C("m", "حليب المراعي", 9.5), C("n", "حليب نادك", 6)], total: 15.5, pieces: 2 });
check("two different branded milks stay distinct", r.lines[0].itemId === "m" && r.lines[1].itemId === "n", JSON.stringify(r.lines.map((x) => x.itemId)));

r = solveReceipt({ lines: [L("لبن المراعي كامل الدسم 360 مل", 6, 2, 3), L("حليب نادك طازج كامل الدسم 800 مل", 6, 1, 6)],
  candidates: [C("laban", "لبن (كامل الدسم)", 3, true, 2), C("milk", "حليب (كامل الدسم)", 6, true)], total: 12, pieces: 3 });
check("لبن is not swallowed by حليب", r.lines[0].itemId === "laban" && r.lines[1].itemId === "milk", JSON.stringify(r.lines.map((x) => x.itemId)));

/* parentheses and punctuation in catalogue names must not break matching */
check("parentheses do not break the name match", nameScore("حليب نادك طازج كامل الدسم 800 مل", "حليب (كامل الدسم)") >= 0.9,
  String(nameScore("حليب نادك طازج كامل الدسم 800 مل", "حليب (كامل الدسم)")));
check("a comma-separated catalogue name still matches", nameScore("جبنة شرائح برجر 200 جم", "جبنة، شرائح") >= 0.9,
  String(nameScore("جبنة شرائح برجر 200 جم", "جبنة، شرائح")));

/* the shop name must be asked for and carried through the schema */
check("the prompt asks for the shop name", /store_name/.test(src) && /Report the shop's name/.test(src));
check("the shop name is no longer discarded", /seller: shop/.test(src));
check("the ignore list no longer covers the shop name", !/Ignore:[\s\S]{0,120}store name/i.test(src));

console.log(`PASS ${pass}  FAIL ${fail}`);
if (fail) { console.log("FAILED:\n - " + F.join("\n - ")); process.exit(1); }
