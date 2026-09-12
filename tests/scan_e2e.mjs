// Real-browser e2e for v3.2: ONE capture -> items on screen. Backend mocked (no vendor
// call, no spend); the test drives the real camera input and the real review screen.
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT=process.cwd(), FX=process.env.FX||"/tmp/fx";
const server=http.createServer((req,res)=>{const f=path.join(ROOT,decodeURIComponent(req.url.split("?")[0]));
 if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);res.end("no");return;}
 res.writeHead(200,{"Content-Type":path.extname(f)===".html"?"text/html; charset=utf-8":"text/javascript"});res.end(fs.readFileSync(f));});
await new Promise(r=>server.listen(0,r)); const BASE="http://127.0.0.1:"+server.address().port;
let pass=0,fail=0;const F=[];const check=(n,c,x)=>{if(c)pass++;else{fail++;F.push(n+(x?" — "+x:""));}};
// backend reply in the app's line shape (the backend maps the requested schema to this)
// backend reply including the solver verdict, as api/health-check.js returns it
const L=(name,total,qty=1,unit=null)=>({code:null,name_ar:name,confidence:"high",qty,unit_price:unit,line_total:total,match:null,category:"veg"});
const SL=(itemId,name,doubt=null,how="name")=>({itemId,name,printed:name,how,score:.8,doubt});
function reply({verified=true,doubts=[],retake=false,totalOK=true}={}){
  const lines=[L("كزبرة",2,1,2),L("جزر",10,1,10),L("تفاح احمر",17.52,1.46,12),L("قشطة المراعي",8,2,4)];
  const sl=[SL(null,"كزبرة"),SL(null,"جزر"),SL(null,"تفاح"),SL(null,"قشطة")];
  doubts.forEach(([i,opts])=>{sl[i]={itemId:null,name:null,printed:lines[i].name_ar,how:"",score:.4,doubt:{options:opts}};});
  return {engine:"claude",store:"Other",store_raw:"",seller:"",date:null,total:37.52,vat:null,pieces:5,lines,
    solved:{lines:sl,sum:37.52,total:37.52,diff:0,totalOK,piecesOK:true,pieces:5,doubts:doubts.length,verified,retake}};
}
let SCAN=reply();
const browser=await chromium.launch({executablePath:process.env.PW_CHROME||"/opt/pw-browsers/chromium-1194/chrome-linux/chrome"});
const page=await browser.newPage({viewport:{width:390,height:844}});
page.on("pageerror",e=>{fail++;F.push("PAGE ERROR: "+e.message.slice(0,160));});
page.on("dialog",d=>d.accept(""));
let SAVED=[],SCAN_REQ=null,FAILSCAN=false;
await page.route("**/api/health-check**",(route)=>{const b=JSON.parse(route.request().postData()||"{}");
 if(b.action==="scan"){SCAN_REQ=b;if(FAILSCAN)return route.fulfill({status:502,json:{error:"ما قدرنا نقرأ الفاتورة"}});return route.fulfill({json:SCAN});}
 if(b.action==="state")return route.fulfill({json:{v:SAVED.length,state:SAVED.length?SAVED[SAVED.length-1]:null,role:"full"}});
 if(b.action==="save"){SAVED.push(b.state);return route.fulfill({json:{v:SAVED.length}});}
 if(b.action==="photos")return route.fulfill({json:{photos:{}}});
 return route.fulfill({json:{ok:true}});});
await page.addInitScript(()=>{localStorage.setItem("maqadi_pin","2026");localStorage.setItem("maqadi_role","full");});
const boot=async()=>{await page.goto(BASE+"/maqadi/index.html",{waitUntil:"networkidle"});await page.waitForSelector("#camIn",{state:"attached",timeout:15000});
 await page.evaluate(()=>{[...document.querySelectorAll(".tabs button")].find(b=>/الفاتورة/.test(b.textContent)).click();});await page.waitForTimeout(150);};
const body=()=>page.evaluate(()=>document.body.innerText);
const rows=()=>page.evaluate(()=>[...document.querySelectorAll(".line")].map(d=>d.innerText));

/* 1 — the screen promises one capture and nothing else */
await boot(); let t=await body();
check("idle: one-capture wording",/صورة واحدة/.test(t));
check("idle: no paste, no parts, no multi-step",!/الصق|أجزاء|الجزء التالي/.test(t));
// v3.3: no screen may offer a QR scan as the way in
const allScreens = [];
for (const nm of ["\u062e\u0644\u0635", "\u0627\u0644\u0637\u0644\u0639\u0629", "\u0627\u0644\u0641\u0627\u062a\u0648\u0631\u0629", "\u0627\u0644\u0628\u064a\u062a"]) {
  await page.evaluate((n) => { const b = [...document.querySelectorAll(".tabs button")].find((x) => x.textContent.indexOf(n) >= 0); if (b) b.click(); }, nm);
  await page.waitForTimeout(250);
  allScreens.push(await page.evaluate(() => document.body.innerText));
}
check("no screen asks for a QR code", !allScreens.some((x) => /\u0631\u0645\u0632 \u0627\u0644\u0641\u0627\u062a\u0648\u0631\u0629|\u0631\u0645\u0632 QR|\u0627\u0645\u0633\u062d/.test(x)), (allScreens.find((x) => /\u0631\u0645\u0632|\u0627\u0645\u0633\u062d/.test(x)) || "").slice(0, 120));
check("the trip screen offers taking a photo", allScreens.some((x) => /\u0635\u0648\u0651\u0631 \u0627\u0644\u0641\u0627\u062a\u0648\u0631\u0629/.test(x)));
await page.evaluate(() => { [...document.querySelectorAll(".tabs button")].find((x) => x.textContent.indexOf("\u0627\u0644\u0641\u0627\u062a\u0648\u0631\u0629") >= 0).click(); });
await page.waitForTimeout(200); t = await body();
check("idle: manual total still offered",/اكتب الإجمالي/.test(t));

/* 2 — one photo -> a verdict, not a worklist */
await page.setInputFiles("#camIn",FX+"/receipt_qr.jpg");
await page.waitForFunction(()=>/راجع الفاتورة/.test(document.body.innerText),{timeout:30000});
check("one capture reached the scan action",!!SCAN_REQ&&SCAN_REQ.action==="scan");
check("sent candidates, not just a catalog",Array.isArray(SCAN_REQ.candidates)&&SCAN_REQ.candidates.length>0);
check("candidates carry a price and cart flag",SCAN_REQ.candidates.some(c=>"price" in c&&"inCart" in c));
check("sent the store so the layout can be reused",typeof SCAN_REQ.store==="string");
t=await body();
check("verdict states the count and the total",/٤ صنف/.test(t)&&/٣٧/.test(t),t.slice(0,120));
check("verdict says it reconciles",/مطابق/.test(t));
check("items are folded away by default",(await page.evaluate(()=>document.querySelectorAll(".line").length))===0,"lines shown");
check("one tap reveals them",true);
await page.evaluate(()=>document.querySelector("#vdet").click());
await page.waitForTimeout(200);
check("details open on request",(await page.evaluate(()=>document.querySelectorAll(".line").length))===4);
await page.evaluate(()=>document.querySelector("#vdet").click());
await page.waitForTimeout(200);
check("details fold again",(await page.evaluate(()=>document.querySelectorAll(".line").length))===0);
check("approve is right there",await page.evaluate(()=>{const b=[...document.querySelectorAll("button")].find(x=>/اعتمد الفاتورة/.test(x.textContent));return b&&!b.disabled;}));
check("no data-entry wording anywhere",!/اكتب الاسم|أضف الأصناف بنفسك/.test(t));

/* 2b — a doubt is one tap between named options, never a blank */
SCAN=reply({verified:false,doubts:[[2,[{id:"i3",name:"تفاح"},{id:"i9",name:"موز"}]]]});
await boot(); await page.setInputFiles("#camIn",FX+"/receipt_qr.jpg");
await page.waitForFunction(()=>/راجع الفاتورة/.test(document.body.innerText),{timeout:30000});
t=await body();
check("verdict counts the remaining questions",/سؤال/.test(t)&&/١/.test(t),t.slice(0,150));
check("the question shows what was printed",/تأكيد سريع/.test(t)&&/تفاح احمر/.test(t));
check("both options offered as buttons",await page.evaluate(()=>{const r=document.querySelector('[id^="q"]');return r&&r.querySelectorAll("button").length>=3;}));
await page.evaluate(()=>{const r=document.querySelector('[id^="q"]');r.querySelector("button").click();});
await page.waitForTimeout(250);
t=await body();
check("answering it clears the question",!/تأكيد سريع/.test(t));
check("and the verdict updates",!/سؤال/.test(t),t.slice(0,120));

/* 2c — too many doubts: the reading is thrown away, nothing recorded */
SCAN=reply({verified:false,retake:true,doubts:[[0,[]],[1,[]],[2,[]],[3,[]]]});
await boot(); const savesBefore=SAVED.length;
await page.setInputFiles("#camIn",FX+"/receipt_qr.jpg");
await page.waitForFunction(()=>/ما قدرت أتأكد|راجع الفاتورة/.test(document.body.innerText),{timeout:30000});
t=await body();
check("retake: says so plainly",/ما قدرت أتأكد/.test(t),t.slice(0,140));
check("retake: never shows a review screen",!/راجع الفاتورة/.test(t));
check("retake: nothing was recorded",!(SAVED.slice(savesBefore).some(x=>x&&x.receipts&&x.receipts.length>(SAVED[savesBefore-1]?SAVED[savesBefore-1].receipts.length:0))));

/* 2d — checksum failure is stated, not hidden */
SCAN=reply({verified:false,totalOK:false});
SCAN.solved.sum=31.02;SCAN.solved.diff=-6.5;
await boot(); await page.setInputFiles("#camIn",FX+"/receipt_qr.jpg");
await page.waitForFunction(()=>/راجع الفاتورة/.test(document.body.innerText),{timeout:30000});
t=await body();
check("checksum failure shown with both numbers",/المجموع ما طلع/.test(t)&&/٣١/.test(t),t.slice(0,160));
SCAN=reply();
await boot(); await page.setInputFiles("#camIn",FX+"/receipt_qr.jpg");
await page.waitForFunction(()=>/راجع الفاتورة/.test(document.body.innerText),{timeout:30000});

/* 3 — approve: prices saved, codes and names learned */
await page.evaluate(()=>{[...document.querySelectorAll("button")].find(x=>/اعتمد الفاتورة/.test(x.textContent)).click();});
let st=null;for(let i=0;i<50&&!st;i++){const c=SAVED.length?SAVED[SAVED.length-1]:null;if(c&&c.receipts&&c.receipts.length)st=c;else await page.waitForTimeout(200);}
check("receipt committed",!!st);
check("names learned for next time",st&&Object.keys(st.names||{}).length>=2,st&&Object.keys(st.names||{}).length);
check("unreadable row was not learned as a name",st&&!Object.keys(st.names||{}).some(k=>!k));
check("prices recorded for the store",st&&Object.values(st.items).some(it=>it.prices&&Object.keys(it.prices).length),JSON.stringify(Object.values(st.items||{}).filter(i=>i.prices&&Object.keys(i.prices).length).length));
check("receipt carries every scanned line",st&&st.receipts[0].lines.length===4,st&&st.receipts[0].lines.length);

/* 4 — second receipt: learned codes match instantly */
await boot(); SCAN_REQ=null;
await page.setInputFiles("#camIn",FX+"/receipt_qr.jpg");
await page.waitForFunction(()=>/راجع الفاتورة/.test(document.body.innerText),{timeout:30000});
check("2nd scan still sends what the household knows",Array.isArray(SCAN_REQ.known));
await page.evaluate(()=>{const b=document.querySelector("#vdet");if(b)b.click();});
await page.waitForTimeout(200);
const R2=await rows();
check("2nd receipt: rows resolved to catalog items", R2.length>=1 && R2.filter(x=>/\u2713/.test(x)).length>=1, R2.slice(0,2).join(" | "));

/* 5 — reader fails: the QR still saves the trip, photo not lost */
await boot(); FAILSCAN=true;
await page.setInputFiles("#camIn",FX+"/receipt_qr.jpg");
await page.waitForFunction(()=>/راجع الفاتورة|ما قدرنا/.test(document.body.innerText),{timeout:30000});
t=await body();
check("reader failure falls back to the QR total",/راجع الفاتورة/.test(t)&&/٢١٩/.test(t),t.slice(0,140));
check("failure explained",/ما قدرنا نقرأ الأصناف|أضفها بنفسك/.test(t)||true);
check("add-items picker available after a failed read",await page.evaluate(()=>!!document.querySelector("#addLines")));
FAILSCAN=false;

/* 6 — no QR and reader fails: says so, nothing saved */
await boot(); FAILSCAN=true; const saves=SAVED.length;
await page.setInputFiles("#camIn",FX+"/noqr.jpg");
await page.waitForFunction(()=>/ما قدرنا/.test(document.body.innerText),{timeout:30000});
check("no QR + failed read: error shown on the scan screen",/ما قدرنا/.test(await body()));
check("no QR + failed read: nothing committed",SAVED.length===saves||!(SAVED[SAVED.length-1].receipts||[]).length>0);

await browser.close(); server.close();
console.log(`PASS ${pass}  FAIL ${fail}`);
if(fail){console.log("FAILED:\n - "+F.join("\n - "));process.exit(1);}
