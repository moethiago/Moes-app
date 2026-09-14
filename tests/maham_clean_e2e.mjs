// Maham in clean mode: one screen, tasks only. Check, move, nothing else.
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT=process.cwd();
const server=http.createServer((req,res)=>{const f=path.join(ROOT,decodeURIComponent(req.url.split("?")[0]));
 if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);res.end("no");return;}
 res.writeHead(200,{"Content-Type":path.extname(f)===".html"?"text/html; charset=utf-8":"text/javascript"});res.end(fs.readFileSync(f));});
await new Promise(r=>server.listen(0,r));const BASE="http://127.0.0.1:"+server.address().port;
let pass=0,fail=0;const F=[];const check=(n,c,x)=>{if(c)pass++;else{fail++;F.push(n+(x?" — "+x:""));}};
const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome"});
const p=await b.newPage({viewport:{width:390,height:844}});
p.on("pageerror",e=>{fail++;F.push("PAGE ERROR: "+e.message.slice(0,150));});
const STATE={tasks:{
  "t:a":{id:"t:a",title:"Car wash",em:"🚗",sched:{type:"off"},doneAt:[],moves:0},
  "t:b":{id:"t:b",title:"Phone repair",em:"📱",sched:{type:"off"},doneAt:[],moves:0},
  "t:c":{id:"t:c",title:"Buy slippers",em:"🩴",sched:{type:"off"},doneAt:[],moves:0},
  "t:r":{id:"t:r",title:"Family gathering",em:"👨‍👩‍👧",sched:{type:"weekly",days:[1,5],block:"evening"},doneAt:[],moves:0}},
  lanes:{today:["t:a","t:b"],week:["t:c"],later:[]},
  log:[{lid:"l1",id:"t:z",title:"Old thing",em:"✅",ts:Date.now()-3600000,lane:"today"}]};
let SAVED=[];
await p.route("**/api/health-check**",r=>{const x=JSON.parse(r.request().postData()||"{}");
 if(x.action==="taskstate")return r.fulfill({json:{v:SAVED.length,state:SAVED.length?SAVED[SAVED.length-1]:STATE,role:"full"}});
 if(x.action==="tasksave"){SAVED.push(x.state);return r.fulfill({json:{v:SAVED.length}});}
 return r.fulfill({json:{ok:true}});});
await p.addInitScript(()=>{localStorage.setItem("maham_pin","2026");});
await p.goto(BASE+"/maham/index.html",{waitUntil:"networkidle"});
await p.waitForTimeout(1800);
const t=await p.evaluate(()=>document.body.innerText);

check("the tasks are there",/Car wash/.test(t)&&/Phone repair/.test(t)&&/Buy slippers/.test(t),t.slice(0,150));
check("the lanes are there to move between",/Today/i.test(t)&&/Week/i.test(t));
check("no bottom navigation",await p.evaluate(()=>{const n=document.getElementById("tabs");return !n||n.classList.contains("hidden")||n.offsetParent===null;}));
check("no Capture screen",!/Capture/i.test(t),t.slice(0,200));
check("no Routine tab",!/Routine/i.test(t));
check("no Review tab",!/Review/i.test(t));
check("no today's-routine block",!/Today.s routine/i.test(t));
check("no done-today list",!/Done today/i.test(t));
check("no leftovers or nagging",!/left over from before today/i.test(t)&&!/moved this/i.test(t));
check("no add button in the header",await p.evaluate(()=>![...document.querySelectorAll(".hd button")].some(b=>b.textContent.trim()==="+")));
check("no microphone button",await p.evaluate(()=>!document.getElementById("mic")));
check("header just counts today",/\d+ today/.test(t),t.slice(0,80));

// ticking a task off must still work
const before=SAVED.length;
await p.evaluate(()=>{const r=[...document.querySelectorAll(".body .r, .body .row, .lane .r")].find(x=>/Car wash/.test(x.innerText));
  const cb=r&&(r.querySelector(".cb")||r.querySelector("input"));if(cb)cb.click();});
await p.waitForTimeout(1200);
let st=null;for(let i=0;i<30&&!st;i++){st=[...SAVED].reverse().find(s=>s&&s.lanes&&s.lanes.today.indexOf("t:a")<0);if(!st)await p.waitForTimeout(200);}
check("ticking a task off works",!!st,"saves "+SAVED.length+" (was "+before+")");
check("and it leaves the list",!!st&&st.lanes.today.indexOf("t:a")<0);
check("and it is recorded for later",!!st&&(st.log||[]).some(x=>x.id==="t:a"));

// the routine still fires in the background even though its screen is gone
check("routine tasks are still in the data",!!st&&st.tasks["t:r"].sched.type==="weekly");

await b.close();server.close();
console.log(`PASS ${pass}  FAIL ${fail}`);
if(fail){console.log("FAILED:\n - "+F.join("\n - "));process.exit(1);}
