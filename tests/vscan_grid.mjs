// Offline grid for the video receipt reader (maqadi/index.html, VSCAN-START..VSCAN-END). Runs the REAL code.
// Fixtures = what Tesseract actually read, frame by frame, from simulated phone videos of the real
// عذق الجزيرة receipt (12 Sep 2026, 22 lines, 219.27 SAR): ten filming conditions. No network, no AI, no cost.
import fs from 'node:fs';
const html = fs.readFileSync(process.argv[2] || 'maqadi/index.html', 'utf8');
const src = html.slice(html.indexOf('/* VSCAN-START'), html.indexOf('/* VSCAN-END */') + 15);
const { vsReadLines, vsFrame, vsMerge, vsSolve, vsTokens, vsEanOk, vsKnown } =
  new Function(src + '\nreturn {vsReadLines, vsFrame, vsMerge, vsSolve, vsTokens, vsEanOk, vsKnown};')();
const FX = new URL('./fixtures/vscan/', import.meta.url);
const ITEMS = JSON.parse(fs.readFileSync(new URL('items.json', FX)));
let pass = 0, fail = 0; const failures = [];
const check = (n, c, x) => { if (c) pass++; else { fail++; failures.push(n + (x ? " — " + x : "")); } };
const frames = (name) => { const d = JSON.parse(fs.readFileSync(new URL('frames/' + name + '.json', FX))); return Object.keys(d).sort().map((k) => d[k].join("\n")); };

/* 1 — every filming condition: amounts always exact and the receipt always adds up */
const ALL = ["normal", "layoutB", "layoutC", "tilt3", "iphone1080", "blurry", "lowres540", "shaky", "rushed5s", "rushed5s_4fps"];
const CLEAN = ["normal", "layoutB", "layoutC", "tilt3", "iphone1080", "blurry", "lowres540", "shaky"];
for (const n of ALL) {
  const r = vsReadLines(frames(n));
  check(`${n}: 22 lines`, r.lines.length === 22, "got " + r.lines.length);
  check(`${n}: total 219.27`, r.total === 219.27, "total " + r.total);
  check(`${n}: lines add up (verified)`, r.verified === true && r.sum === 219.27, "sum " + r.sum);
  check(`${n}: every amount exact`, r.lines.every((l, i) => l.line_total === Number(ITEMS[i][2])), JSON.stringify(r.lines.map((l) => l.line_total)));
  check(`${n}: every quantity exact`, r.lines.every((l, i) => l.qty === Number(ITEMS[i][3])));
  check(`${n}: amount column found`, r.layout === "amount-qty", r.layout);
  if (CLEAN.includes(n)) {
    check(`${n}: every code exact`, r.lines.every((l, i) => l.code === ITEMS[i][0]), JSON.stringify(r.lines.map((l, i) => l.code === ITEMS[i][0] ? "." : l.code)));
    check(`${n}: no retake nag`, !r.blurry);
    check(`${n}: VAT number read`, r.vat === "301023675200003", r.vat);
    check(`${n}: date read`, r.date === "2026-09-12", r.date);
  } else {
    // a rushed video misreads some codes: it must say so, and never call a misread code "sure" en masse
    check(`${n}: rushed video flagged for a retake`, r.blurry === true);
    const wrongSure = r.lines.filter((l, i) => l.code !== ITEMS[i][0] && l.sure).length;
    check(`${n}: at most one misread code marked sure`, wrongSure <= 1, "wrong+sure " + wrongSure);
  }
}
const n0 = vsReadLines(frames("normal"));
check("chicken 3 x 22.25 = 66.75", n0.lines[16].qty === 3 && n0.lines[16].unit_price === 22.25 && n0.lines[16].line_total === 66.75);
check("apples by weight 1.46 x 12 = 17.52", n0.lines[4].qty === 1.46 && n0.lines[4].unit_price === 12);
check("4-digit store code kept with its leading zero", n0.lines[4].code === "0307");
check("clean video: every code sure", n0.lines.every((l) => l.sure));

/* 2 — tokens: what counts as a code and what as money */
let t = vsTokens("66.75            3,00 6281102721756");
check("comma decimal read as money", t.money.join() === "66.75,3" && t.codes.join() === "6281102721756");
t = vsTokens("٦٦٫٧٥ ٣٫٠٠ ٦٢٨١١٠٢٧٢١٧٥٦");
check("Arabic-Indic digits", t.money.join() === "66.75,3" && t.codes.join() === "6281102721756", JSON.stringify(t));
t = vsTokens("فاتورة رقم 779079 2026/09/12 16:11:25");
check("date and time are not codes or money", t.money.length === 0 && t.codes.join() === "779079", JSON.stringify(t));
t = vsTokens("يشمل ضريبة القيمة المضافة 15% 28.60");
check("15% is not a code", t.codes.length === 0 && t.money.join() === "28.6");
t = vsTokens("عدد القطع 26");
check("piece count is not a code", t.codes.length === 0 && t.money.length === 0);
t = vsTokens("ply 100 wy la bois");
check("3-digit number inside a name is not a code", t.codes.length === 0);

/* 3 — layouts that do not print the amount first, and receipts with no total */
const qtyFirst = ["1.00 9.50 6281234567897", "2.00 4.00 100200", "1.20 9.60 100300", "", "23.10", "23.10"].join("\n");
let r = vsReadLines([qtyFirst]);
check("qty-first layout detected from the total", r.layout === "qty-amount" && r.lines[1].qty === 2 && r.lines[1].line_total === 4 && r.verified, JSON.stringify([r.layout, r.lines[1], r.verified]));
r = vsReadLines(["9.50 1.00 6281234567897\n4.00 2.00 100200"]);
check("no printed total: not claimed as verified", r.verified === false && r.totalOK === null && r.total === 13.5);

/* 4 — merging frames: overlap, a skipped stretch, and a missing line */
const L = ITEMS.map(([c, , a, q]) => `${a} ${q} ${c}`);
const tail = "\n26\n219.27\n1\n219.27\n28.60\n219.27\n0.00";
r = vsReadLines([L.slice(0, 9).join("\n"), L.slice(6, 16).join("\n"), L.slice(13).join("\n") + tail]);
check("three overlapping frames merge to 22 lines", r.lines.length === 22 && r.verified, r.lines.length + " " + r.sum);
r = vsReadLines([L.slice(0, 9).join("\n"), L.slice(10).join("\n") + tail]);
check("a skipped line is reported as missing money, not hidden", !r.verified && r.missing === 8 && r.lines.length === 21, JSON.stringify([r.lines.length, r.missing]));
r = vsReadLines([L.slice(0, 12).join("\n"), L.slice(0, 12).join("\n"), L.slice(8).join("\n") + tail]);
check("hand moved back up: no duplicated lines", r.lines.length === 22 && r.verified, r.lines.length);
r = vsReadLines(["10.00 1.00 100016\n10.00 1.00 100016\n5.00 1.00 100010\n\n25.00\n25.00"]);
check("the same item printed twice stays twice", r.lines.length === 3 && r.verified, r.lines.length);
// one frame misreads a code: the other frames outvote it
const bad = L.slice(0, 12).map((x) => x.replace("6281102680305", "6281102680385")).join("\n");
r = vsReadLines([L.slice(0, 12).join("\n"), bad, L.slice(0, 12).join("\n"), L.slice(6).join("\n") + tail]);
check("a misread in one frame is outvoted", r.lines[3].code === "6281102680305" && r.verified);

/* 5 — learned codes: a long code read one digit off still finds the item; short codes never guess */
const known = { "6281102721756": "chicken", "100013": "chili", "100016": "pepper" };
check("exact known code", vsKnown("6281102721756", known) === "6281102721756");
check("long code one digit off -> the known code", vsKnown("6281102727756", known) === "6281102721756");
check("long code one digit dropped -> the known code", vsKnown("628110272756", known) === "6281102721756");
check("short code one digit off -> no guess (100013 vs 100016 are both real)", vsKnown("100019", known) === null);
check("two known codes equally close -> no guess", vsKnown("6281000000002", { "6281000000001": "a", "6281000000003": "b" }) === null);
check("unknown code -> null", vsKnown("6200000000000", known) === null);
check("EAN check digit", vsEanOk("6281057002858") === false && vsEanOk("4006381333931") === true && vsEanOk("200003") === null);

console.log(`${pass} passed, ${fail} failed`); if (fail) { console.log(failures.join("\n")); process.exit(1); }
