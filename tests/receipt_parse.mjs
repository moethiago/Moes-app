// Unit grid for the receipt-text parser (maqadi/index.html, PARSE-START..PARSE-END).
// Runs the REAL code from the HTML. Fixture = the عذق الجزيرة receipt of 12 Sep 2026,
// as three different OCR engines might emit it. No network, no AI, no cost.
import fs from 'node:fs';
const html = fs.readFileSync(process.argv[2] || 'maqadi/index.html', 'utf8');
const src = html.slice(html.indexOf('/* PARSE-START'), html.indexOf('/* PARSE-END */') + 15);
const fn = new Function(src + '\nreturn {parseReceiptText, classifyLine, guessStore};');
const { parseReceiptText, guessStore } = fn();
let pass = 0, fail = 0; const failures = [];
const check = (n, c, x) => { if (c) pass++; else { fail++; failures.push(n + (x ? " — " + x : "")); } };

const HEAD = `عذق الجزيرة
ETHQ ALJAZIRAH
الرياض-حي الروضة-شارع حفصة بنت عمر
تليفون - 0543777074
فاتورة ضريبية مبسطة
الرقم الضريبي 301023675200003
فاتورة رقم 779079 2026/09/12 16:11:25
المبلغ الكمية رقم الصنف`;
const ITEMS = [["200003","كزبرة","2.00","1.00"],["200002","بقدونس","2.00","1.00"],["200009","خس ربطة","7.00","1.00"],
 ["6281102680305","توست خبز البر هيرفي","6.50","1.00"],["0307","تفاح احمر","17.52","1.46"],["3322126","خبز عربي بر كبير","1.00","1.00"],
 ["6287027470076","خيار","7.00","1.00"],["200017","شبت","2.00","1.00"],["100013","فلفل حار","10.00","1.00"],["100114","ليمون اصفر صحن","8.00","1.00"],
 ["100016","فلفل بارد * 2","10.00","1.00"],["100058","فلفل شقراء احمر","10.00","1.00"],["6287027470045","طماطم","4.00","1.00"],
 ["6281007066792","شرائح جبنه برجر 200 جم المراعي","7.50","1.00"],["100036","بطاطس صغير","11.00","1.00"],["110003","بارد ملون","12.00","1.00"],
 ["6281102721756","صدور دجاج انتاج 450 جرام","66.75","3.00"],["100063","جزر","10.00","1.00"],["100010","باذنجان اسود","5.00","1.00"],
 ["6261007666527","قشطة المراعي لايت 100 جرام","8.00","2.00"],["6281007023488","لبن المراعي كامل الدسم 360 مل","6.00","2.00"],
 ["6281057002858","حليب نادك طازج كامل الدسم 800 مل","6.00","1.00"]];
const TAIL = `عدد القطع 26
الاجمالي 219.27
الكاونتر 1
البائع عبد...
بطاقة ائتمان
صافي الفاتورة 219.27
يشمل ضريبة القيمة المضافة 15% 28.60
مدفوعات الشبكة 219.27
المدفوع نقدا 0.00
يجب احضار الفاتورة عند الاسترجاع`;

// A) row-wise, as printed: code / amount qty / name
const A = HEAD + "\n" + ITEMS.map(([c,n,a,q]) => `${c}\n${a} ${q}\n${n}`).join("\n") + "\n" + TAIL;
// B) code and name glued on one line by OCR, numbers before them
const B = HEAD + "\n" + ITEMS.map(([c,n,a,q]) => `${a} ${q}\n${c} ${n}`).join("\n") + "\n" + TAIL;
// C) column-wise: all codes+names first, then all number pairs
const C = HEAD + "\n" + ITEMS.map(([c,n]) => `${c}\n${n}`).join("\n") + "\n" + ITEMS.map(([,,a,q]) => `${a} ${q}`).join("\n") + "\n" + TAIL;
// D) Arabic-Indic digits, as some engines emit them
const toAr = (s) => s.replace(/[0-9.]/g, (d) => "٠١٢٣٤٥٦٧٨٩٫"["0123456789.".indexOf(d)]);
const D = A.replace(/\d[\d.]*/g, (m) => toAr(m));

function run(label, txt) {
  const r = parseReceiptText(txt);
  check(`${label}: 22 rows`, r.lines.length === 22, "got " + r.lines.length);
  check(`${label}: total 219.27`, r.total === 219.27, "total " + r.total);
  check(`${label}: rows sum to the printed total`, r.sum === 219.27, "sum " + r.sum);
  check(`${label}: no mismatch`, r.mismatch === 0, "mismatch " + r.mismatch);
  check(`${label}: store read from header`, /عذق/.test(r.store_raw), r.store_raw);
  check(`${label}: date read`, r.date === "2026-09-12", r.date);
  check(`${label}: every row has its code`, r.lines.every((l, i) => l.code === ITEMS[i][0]), JSON.stringify(r.lines.map((l) => l.code).slice(0, 6)));
  check(`${label}: every row has its name`, r.lines.every((l, i) => l.name_ar === ITEMS[i][1]), JSON.stringify(r.lines.map((l) => l.name_ar).slice(0, 6)));
  check(`${label}: kg row 1.46 x 12 = 17.52`, r.lines[4].qty === 1.46 && r.lines[4].unit_price === 12 && r.lines[4].line_total === 17.52, JSON.stringify(r.lines[4]));
  check(`${label}: chicken 3 x 22.25 = 66.75`, r.lines[16].qty === 3 && r.lines[16].unit_price === 22.25);
  check(`${label}: cream 2 x 4 = 8`, r.lines[19].qty === 2 && r.lines[19].line_total === 8);
  check(`${label}: layout amount-first`, r.layout === "amount-qty", r.layout);
  check(`${label}: nothing unreadable`, r.unreadable === 0, "unreadable " + r.unreadable);
  check(`${label}: VAT / payment lines not turned into items`, !r.lines.some((l) => /ضريبة|مدفوع|بطاقة/.test(l.name_ar || "")));
  check(`${label}: 26-piece count not an item`, !r.lines.some((l) => l.line_total === 26));
  return r;
}
run("row-wise", A); run("glued code+name", B); run("column-wise", C); run("arabic digits", D);

// E) a store with no item codes at all: "name  qty x price  total"
const E = `بنده\nفاتورة ضريبية مبسطة\nحليب المراعي 2 لتر 1.00 9.50\nخبز بر 2.00 4.00\nتفاح احمر 1.20 9.60\nالاجمالي 23.10`;
let r = parseReceiptText(E);
check("no codes: rows from names", r.lines.length === 3, "got " + r.lines.length);
check("no codes: names kept with size", r.lines[0].name_ar === "حليب المراعي 2 لتر", r.lines[0].name_ar);
check("no codes: store guessed", r.store === "Panda", r.store);
check("no codes: qty-first layout detected from the total", r.layout === "qty-amount" && r.lines[1].qty === 2 && r.lines[1].line_total === 4 && r.lines[0].line_total === 9.5, JSON.stringify([r.layout, r.lines[1]]));
check("no codes: sums to total", r.sum === 23.1, "sum " + r.sum);

// F) a row whose numbers OCR dropped stays as a low-confidence row, not vanished
const F = HEAD + "\n200003\n2.00 1.00\nكزبرة\n200002\nبقدونس\n200009\n7.00 1.00\nخس ربطة\n" + TAIL.replace("219.27", "11.00").replace("219.27", "11.00");
r = parseReceiptText(F);
check("missing numbers: row kept", r.lines.length === 3, "got " + r.lines.length);
check("missing numbers: flagged low", r.lines[1].confidence === "low" && r.lines[1].name_ar === "بقدونس");
check("missing numbers: mismatch flagged", r.mismatch !== 0, "mismatch " + r.mismatch);

// G) garbage in, nothing crashes
check("empty text", parseReceiptText("").lines.length === 0);
check("random text", parseReceiptText("hello world\nمرحبا").lines.length === 0);
check("only numbers", parseReceiptText("1.00 2.00\n3.00").lines.length <= 2);

console.log(`PASS ${pass}  FAIL ${fail}`);
if (fail) { console.log("FAILED:\n - " + failures.join("\n - ")); process.exit(1); }
