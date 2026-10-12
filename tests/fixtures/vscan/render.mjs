// Renders the real عذق الجزيرة receipt (12 Sep 2026, 22 lines, 219.27 SAR) as a thermal-style image.
// usage: node render.mjs <layout A|B|C> <out.png>
import { chromium } from 'playwright';
import fs from 'node:fs';
const [layout = "A", out = "r.png"] = process.argv.slice(2);
const FONT = new URL('./node_modules/@fontsource/noto-naskh-arabic/files/noto-naskh-arabic-arabic-400-normal.woff2', import.meta.url).pathname;
const ITEMS = [["200003","كزبرة","2.00","1.00"],["200002","بقدونس","2.00","1.00"],["200009","خس ربطة","7.00","1.00"],
 ["6281102680305","توست خبز البر هيرفي","6.50","1.00"],["0307","تفاح احمر","17.52","1.46"],["3322126","خبز عربي بر كبير","1.00","1.00"],
 ["6287027470076","خيار","7.00","1.00"],["200017","شبت","2.00","1.00"],["100013","فلفل حار","10.00","1.00"],["100114","ليمون اصفر صحن","8.00","1.00"],
 ["100016","فلفل بارد * 2","10.00","1.00"],["100058","فلفل شقراء احمر","10.00","1.00"],["6287027470045","طماطم","4.00","1.00"],
 ["6281007066792","شرائح جبنه برجر 200 جم المراعي","7.50","1.00"],["100036","بطاطس صغير","11.00","1.00"],["110003","بارد ملون","12.00","1.00"],
 ["6281102721756","صدور دجاج انتاج 450 جرام","66.75","3.00"],["100063","جزر","10.00","1.00"],["100010","باذنجان اسود","5.00","1.00"],
 ["6261007666527","قشطة المراعي لايت 100 جرام","8.00","2.00"],["6281007023488","لبن المراعي كامل الدسم 360 مل","6.00","2.00"],
 ["6281057002858","حليب نادك طازج كامل الدسم 800 مل","6.00","1.00"]];
fs.writeFileSync(new URL('./items.json', import.meta.url), JSON.stringify(ITEMS));
const row3 = (a, b, c) => `<div class="r"><span>${a}</span><span>${b}</span><span>${c}</span></div>`;
const nums = ([c, , a, q]) => row3(c, q, a);           // RTL: code at right, qty, amount at left
const name = ([, n]) => `<div class="n">${n}</div>`;
let body = "";
for (const it of ITEMS) {
  if (layout === "A") body += nums(it) + name(it);                    // numbers row, name under it
  else if (layout === "B") body += name(it) + nums(it);               // name, numbers under it
  else body += `<div class="r"><span>${it[0]}</span><span></span><span></span></div><div class="r"><span></span><span>${it[3]}</span><span>${it[2]}</span></div>` + name(it);
}
const html = `<!doctype html><html dir="rtl"><head><meta charset="utf-8"><style>
@font-face{font-family:N;src:url(file://${FONT})}
body{margin:0;background:#fff}
.p{box-sizing:border-box;width:380px;padding:18px 14px 30px;font-family:"DejaVu Sans Mono",monospace,N;font-size:15px;color:#222;line-height:1.45}
.c{text-align:center}.n{font-family:N,monospace;font-size:15px;margin-bottom:4px}
.r{display:flex;justify-content:space-between;font-weight:600}.r span{min-width:30%}.r span:last-child{text-align:left}
hr{border:0;border-top:1px dashed #555}
</style></head><body><div class="p">
<div class="c" style="font-family:N;font-size:20px;font-weight:700">عذق الجزيرة</div>
<div class="c">ETHQ ALJAZIRAH</div>
<div class="c" style="font-family:N">الرياض-حي الروضة-شارع حفصة بنت عمر</div>
<div class="c"><span style="font-family:N">تليفون</span> - 0543777074</div>
<div class="c" style="font-family:N">فاتورة ضريبية مبسطة</div>
<div class="c"><span style="font-family:N">الرقم الضريبي</span> 301023675200003</div>
<div class="c"><span style="font-family:N">فاتورة رقم</span> 779079 2026/09/12 16:11:25</div><hr>
<div class="r" style="font-family:N"><span>رقم الصنف</span><span>الكمية</span><span>المبلغ</span></div><hr>
${body}<hr>
<div class="r"><span style="font-family:N">عدد القطع</span><span></span><span>26</span></div>
<div class="r"><span style="font-family:N">الاجمالي</span><span></span><span>219.27</span></div>
<div class="r"><span style="font-family:N">الكاونتر</span><span></span><span>1</span></div>
<div class="r"><span style="font-family:N">صافي الفاتورة</span><span></span><span>219.27</span></div>
<div class="r"><span style="font-family:N">يشمل ضريبة القيمة المضافة 15%</span><span>28.60</span></div>
<div class="r"><span style="font-family:N">مدفوعات الشبكة</span><span></span><span>219.27</span></div>
<div class="r"><span style="font-family:N">المدفوع نقدا</span><span></span><span>0.00</span></div>
<div class="c" style="font-family:N;margin-top:8px">يجب احضار الفاتورة عند الاسترجاع</div>
</div></body></html>`;
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const p = await b.newPage({ viewport: { width: 380, height: 800 }, deviceScaleFactor: 2.6 });
await p.setContent(html); await p.waitForTimeout(300);
await p.locator(".p").screenshot({ path: out });
await b.close();
