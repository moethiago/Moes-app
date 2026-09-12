// Grid for the receipt solver. Pure logic, no network, no AI, no cost.
// Fixture = the real عذق الجزيرة receipt of 12 Sep 2026 (22 lines, 219.27 SAR),
// with the exact OCR misreads the app produced on it, to prove they now resolve.
import fs from 'node:fs';
const src = fs.readFileSync('api/health-check.js', 'utf8');
const cut = (a, b) => src.slice(src.indexOf(a), src.indexOf(b));
// pull just the helpers the solver needs, plus the solver itself
// pull normAr plus the solver itself; nothing else is needed
const nStart = src.indexOf('function normAr');
const nEnd = src.indexOf('\n}', nStart) + 2;
const code = src.slice(nStart, nEnd)
  + '\n' + cut('/* ---------------- the solver', '/* ---------------- reader key');
const { solveReceipt, nameScore } = new Function(code + '\nreturn {solveReceipt, nameScore};')();
let pass = 0, fail = 0; const F = [];
const check = (n, c, x) => { if (c) pass++; else { fail++; F.push(n + (x ? " — " + x : "")); } };

const C = (id, name, price, inCart = true, qty = 1) => ({ id, name, price, inCart, qty });
// his cart / catalog, with prices he has paid at this shop
const CANDS = [
  C("c1","كزبرة",2), C("c2","بقدونس",2), C("c3","خس",7), C("c4","توست البر",6.5),
  C("c5","تفاح",12), C("c6","خبز عربي",1), C("c7","خيار",7), C("c8","شبت",2),
  C("c9","فلفل حار",10), C("c10","ليمون",8), C("c11","فلفل بارد ملون",10,true,2),
  C("c12","طماطم",4), C("c13","جبنة شرائح",7.5), C("c14","بطاطس",11),
  C("c15","صدور دجاج",22.25), C("c16","جزر",10), C("c17","باذنجان",5),
  C("c18","قشطة المراعي",4,true,2), C("c19","لبن المراعي",3,true,2), C("c20","حليب نادك",6),
  C("c21","بصل",4,false), C("c22","أرز",25,false), C("c23","فلفل شقراء",10),
];
const L = (name, total, qty = 1, unit = null, candidate = null) => ({ name_ar: name, line_total: total, qty, unit_price: unit, candidate });
// exactly what OCR produced, mistakes included
const READ = [
  L("زيرة",2,1,2),                          // كزبرة misread
  L("بقدونس",2,1,2), L("خس ريشة",7,1,7),
  L("موصت خير أبيض هرمي",6.5,1,6.5),        // توست خبز البر hopeless
  L(null,17.52,1.46,12),                     // UNCLEAR, weighed
  L("خبز عربي بر شعير",1,1,1),               // كبير -> شعير
  L("خيار",7,1,7), L("شبت",2,1,2), L("فلفل حار",10,1,10), L("ليمون أصفر صحين",8,1,8),
  L("فلفل بارد 2",10,1,10), L("فلفل شقراء احمر",10,1,10), L("طماطم",4,1,4),
  L("شرائح جبنة برجر 200 جرام",7.5,1,7.5), L("بطاطس صغير",11,1,11),
  L("بارد مون",12,1,12),                     // بارد ملون misread, not in cart at 12
  L("صدور دجاج انتاج 450 جرام",66.75,3,22.25), L("جزر",10,1,10), L("باذنجان اسود",5,1,5),
  L("حلبة المراعي لايت 100 جرام",8,2,4),     // قشطة -> حلبة
  L("لبن المراعي كامل الدسم 360 مل",6,2,3),
  L("حليب ناشك طارح كامل الدسم 800 مل",6,1,6), // نادك -> ناشك
];
let r = solveReceipt({ lines: READ, candidates: CANDS, total: 219.27, pieces: 26 });
const by = (n) => r.lines[n];
check("arithmetic closes", r.totalOK === true && r.sum === 219.27, "sum " + r.sum + " diff " + r.diff);
check("piece count sane", r.piecesOK === true, "pieces vs qty");
check("misread name resolved by price + cart (زيرة -> كزبرة)", by(0).itemId === "c1", JSON.stringify(by(0)));
check("hopeless name becomes ONE question with the right option offered", !!by(3).doubt && by(3).doubt.options.length === 1 && by(3).doubt.options[0].id === "c4", JSON.stringify(by(3)));
check("hopeless name is never silently renamed", by(3).itemId === null);
check("UNCLEAR weighed line resolved by unit price (12 -> تفاح)", by(4).itemId === "c5", JSON.stringify(by(4)));
check("single-letter misread resolved (شعير -> خبز عربي)", by(5).itemId === "c6", JSON.stringify(by(5)));
check("brand misread resolved (حلبة المراعي -> قشطة)", by(19).itemId === "c18", JSON.stringify(by(19)));
check("brand misread resolved (ناشك -> حليب نادك)", by(21).itemId === "c20", JSON.stringify(by(21)));
check("multi-qty chicken resolved on unit price", by(16).itemId === "c15", JSON.stringify(by(16)));
check("لبن not confused with حليب", by(20).itemId === "c19" && by(21).itemId !== "c19");
check("بارد مون resolves to فلفل بارد ملون", by(15).itemId === "c11", JSON.stringify(by(15)));
const rNew = solveReceipt({ lines: [L("مناديل كلينكس",19,1,19)], candidates: CANDS, total: 19, pieces: 1 });
check("a product he never buys is left as new, not forced onto a price match", rNew.lines[0].itemId === null && rNew.lines[0].how === "new", JSON.stringify(rNew.lines[0]));
check("a new product is not a question", rNew.doubts === 0);
check("questions stay within the cap", r.doubts <= 3, "doubts " + r.doubts);
check("not asked to retake", r.retake === false);
check("every resolved line names a real candidate", r.lines.filter((x) => x.itemId).every((x) => CANDS.some((c) => c.id === x.itemId)));

/* multiplicity: a candidate cannot absorb more lines than he was buying */
r = solveReceipt({ lines: [L("جزر",10,1,10), L("جزر",10,1,10), L("جزر",10,1,10)], candidates: [C("c16","جزر",10,true,1)], total: 30, pieces: 3 });
check("one cart entry claims only one line", r.lines.filter((x) => x.itemId === "c16").length === 1, JSON.stringify(r.lines.map((x) => x.itemId)));
check("the extra identical lines are not silently dropped", r.lines.length === 3);

/* two candidates at the same price, name decides */
r = solveReceipt({ lines: [L("فلفل حار",10,1,10)], candidates: [C("c9","فلفل حار",10), C("c11","فلفل بارد ملون",10)], total: 10, pieces: 1 });
check("same price, name breaks the tie", r.lines[0].itemId === "c9", JSON.stringify(r.lines[0]));

/* genuinely ambiguous: becomes a two-way question, never a guess */
r = solveReceipt({ lines: [L("حليب",6,1,6)], candidates: [C("c20","حليب نادك",6), C("cX","حليب المراعي",6)], total: 6, pieces: 1 });
check("true ambiguity produces a question", !!r.lines[0].doubt && r.lines[0].itemId === null, JSON.stringify(r.lines[0]));
check("the question offers two options, not a blank", r.lines[0].doubt.options.length === 2);
check("one question is not a retake", r.retake === false && r.verified === false);

/* the cap: too many doubts means the reading is thrown away */
const manyC = [C("a","حليب نادك",6), C("b","حليب المراعي",6), C("c","حليب السعودية",6), C("d","حليب الصافي",6)];
r = solveReceipt({ lines: [L("حليب",6,1,6),L("حليب",6,1,6),L("حليب",6,1,6),L("حليب",6,1,6)], candidates: manyC, total: 24, pieces: 4 });
check("more than three doubts -> retake", r.retake === true, "doubts " + r.doubts);
check("retake is never presented as verified", r.verified === false);

/* checksum catches a dropped line even when every name reads perfectly */
r = solveReceipt({ lines: READ.slice(0, 21), candidates: CANDS, total: 219.27, pieces: 26 });
check("a missing line breaks the checksum", r.totalOK === false, "diff " + r.diff);
check("checksum failure is reported, not hidden", r.verified === false);
check("the gap equals the missing amount", Math.abs(r.diff + 6) < 0.01, "diff " + r.diff);

/* a clean receipt with everything known is verified and asks nothing */
const clean = [L("جزر",10,1,10), L("طماطم",4,1,4), L("شبت",2,1,2)];
r = solveReceipt({ lines: clean, candidates: CANDS, total: 16, pieces: 3 });
check("clean receipt: verified", r.verified === true, JSON.stringify({ t: r.totalOK, d: r.doubts }));
check("clean receipt: zero questions", r.doubts === 0);

/* no total printed: cannot claim verified, but still resolves */
r = solveReceipt({ lines: clean, candidates: CANDS, total: 0, pieces: 0 });
check("no printed total: not claimed as verified", r.verified === false && r.totalOK === null);
check("no printed total: items still resolved", r.lines.every((x) => x.itemId));

/* empty and junk input */
check("no lines: no crash", solveReceipt({ lines: [], candidates: CANDS, total: 0, pieces: 0 }).lines.length === 0);
check("no candidates: everything is new, nothing asked", solveReceipt({ lines: clean, candidates: [], total: 16, pieces: 3 }).doubts === 0);
check("name scoring ignores size and brand noise", nameScore("قشطة المراعي لايت 100 جرام", "قشطة المراعي") > 0.5);

console.log(`PASS ${pass}  FAIL ${fail}`);
if (fail) { console.log("FAILED:\n - " + F.join("\n - ")); process.exit(1); }
