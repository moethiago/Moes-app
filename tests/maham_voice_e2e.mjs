// Browser test for Maham's spoken-intent flow: what the sheet shows, what ticking off
// an action does, and that nothing is applied until "Do it". Backend mocked.
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
let SAVED=[],VOICE_REQ=null,ACTIONS=[];
await p.route("**/api/health-check**",r=>{const x=JSON.parse(r.request().postData()||"{}");
 if(x.action==="taskvoice"){VOICE_REQ=x;return r.fulfill({json:{actions:ACTIONS,heard:x.text}});}
 if(x.action==="taskstate")return r.fulfill({json:{v:SAVED.length,state:SAVED.length?SAVED[SAVED.length-1]:null,role:"full"}});
 if(x.action==="tasksave"){SAVED.push(x.state);return r.fulfill({json:{v:SAVED.length}});}
 return r.fulfill({json:{ok:true}});});
await p.addInitScript(()=>{localStorage.setItem("maham_pin","2026");localStorage.setItem("maqadi_pin","2026");});
await p.goto(BASE+"/maham/index.html",{waitUntil:"networkidle"});
await p.waitForTimeout(1500);
// the app is inside an IIFE, so drive the real UI: mic -> (no recorder in headless) ->
// typing sheet -> Sort it out, which feeds the same intent layer speech does
async function say(sentence){
  await p.evaluate(()=>{const m=document.getElementById("mic");if(m)m.click();});
  await p.waitForSelector("#vIn",{timeout:8000});
  await p.fill("#vIn",sentence);
  await p.click("#vGo");
  await p.waitForTimeout(1200);
}

ACTIONS=[{op:"add",title:"Wash the car",lane:"today",dueDays:1,block:"evening",dur:30,days:[]},
         {op:"routine",id:null,title:"Stretch",every:"daily",block:"early",days:[],lane:null,dueDays:null,dur:null}];
await say("wash the car tomorrow evening and stretch every morning");
let t=await p.evaluate(()=>document.body.innerText);
check("shows what it heard",/This is what I heard/.test(t),t.slice(0,120));
check("repeats the sentence back",/wash the car tomorrow/.test(t));
check("describes the add in words",/Wash the car/.test(t)&&/tomorrow/.test(t));
check("describes the routine in words",/Every day/.test(t)&&/Stretch/.test(t));
check("sent his tasks so it can match them",!!VOICE_REQ&&Array.isArray(VOICE_REQ.tasks));
check("sent today's date",!!VOICE_REQ.today);
check("nothing applied yet",!SAVED.some(s=>s&&s.tasks&&Object.values(s.tasks).some(x=>x.title==="Wash the car")),"saves "+SAVED.length);
// untick the routine, apply only the add
await p.evaluate(()=>{document.querySelectorAll(".vact")[1].click();});
await p.waitForTimeout(200);
check("an action can be unticked",await p.evaluate(()=>document.querySelectorAll(".vact")[1].innerText.indexOf("\u2713")<0));
await p.evaluate(()=>{document.getElementById("vDo").click();});
// Maham batches its saves, so wait for the one that carries the change
let st=null;
for(let i=0;i<40&&!st;i++){
  st=[...SAVED].reverse().find(s=>s&&s.tasks&&Object.values(s.tasks).some(x=>x.title==="Wash the car"&&x.due));
  if(!st)await p.waitForTimeout(250);
}
st=st||SAVED[SAVED.length-1];
check("applying saved state",!!st,"saves "+SAVED.length);
const titles=st?Object.values(st.tasks).map(x=>x.title):[];
check("the ticked action was applied",titles.indexOf("Wash the car")>=0,JSON.stringify(titles.slice(-3)));
check("the unticked action was NOT applied",titles.indexOf("Stretch")<0);
const car=st?Object.values(st.tasks).find(x=>x.title==="Wash the car"):null;
check("the due day was set",!!car&&car.due>Date.now(),String(car&&car.due));
check("the block was set",!!car&&car.dueBlock==="evening",String(car&&car.dueBlock));
check("the duration was set",!!car&&car.durMin===30,String(car&&car.durMin));
check("it is marked as a voice task",!!car&&car.voice===true);
// a routine on an existing task, taken from the state the app just saved
const first=st?Object.keys(st.tasks)[0]:null;
check("there is an existing task to schedule",!!first);
SAVED=[];ACTIONS=[{op:"routine",id:first,title:"",every:"weekly",days:[0],block:"evening",lane:null,dueDays:null,dur:null}];
await say("water the plants every sunday evening");
t=await p.evaluate(()=>document.body.innerText);
check("a weekly routine reads back as the day",/Every Sun/.test(t),t.slice(0,160));
await p.evaluate(()=>{document.getElementById("vDo").click();});
// the phone now understands this itself, so the routine lands on whichever task it
// matched — assert the routine exists, not which id it chose
let st2=null;
for(let i=0;i<40&&!st2;i++){
  st2=[...SAVED].reverse().find(s=>s&&s.tasks&&Object.values(s.tasks).some(x=>x.sched&&x.sched.type==="weekly"));
  if(!st2)await p.waitForTimeout(250);
}
st2=st2||SAVED[SAVED.length-1];
const wk=st2?Object.values(st2.tasks).find(x=>x.sched&&x.sched.type==="weekly"):null;
check("the routine was set on a task",!!wk,JSON.stringify(wk&&wk.sched));
check("on the right day",!!wk&&wk.sched.days&&wk.sched.days[0]===0,JSON.stringify(wk&&wk.sched.days));
// no actions understood -> falls back, never a dead end
SAVED=[];ACTIONS=[];
await say("mmmm");
t=await p.evaluate(()=>document.body.innerText);
check("an unusable sentence falls back instead of dying",/Type it|heard|task/i.test(t),t.slice(0,120));
/* ---------- free path: understood on the phone, no network call at all ---------- */
SAVED=[];VOICE_REQ=null;ACTIONS=[];
const anyTitle=st?Object.values(st.tasks)[0].title:"";
await say("done "+anyTitle);
let ft=await p.evaluate(()=>document.body.innerText);
check("free: a finish is understood on the phone",/This is what I heard/.test(ft)&&/Finished/.test(ft),ft.slice(0,140));
check("free: nothing was sent to any service",VOICE_REQ===null,JSON.stringify(VOICE_REQ&&VOICE_REQ.action));
await p.evaluate(()=>{document.getElementById("vDo").click();});
await p.waitForTimeout(900);
check("free: the finish was applied",SAVED.length>0);

VOICE_REQ=null;
await say("water the plants every sunday evening");
ft=await p.evaluate(()=>document.body.innerText);
check("free: a weekly routine is understood on the phone",/Every Sun/.test(ft),ft.slice(0,160));
check("free: still no network call",VOICE_REQ===null);
await p.evaluate(()=>{const b=document.getElementById("vDo");if(b)b.click();});
await p.waitForTimeout(600);

VOICE_REQ=null;
await say("stretch every day in the morning");
ft=await p.evaluate(()=>document.body.innerText);
check("free: a daily routine for a new task is understood",/Every day/.test(ft),ft.slice(0,160));
check("free: no network call for that either",VOICE_REQ===null);

await b.close();server.close();
console.log(`PASS ${pass}  FAIL ${fail}`);
if(fail){console.log("FAILED:\n - "+F.join("\n - "));process.exit(1);}
