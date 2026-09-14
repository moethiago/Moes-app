// Grid for Maham's spoken-intent endpoint. The model is mocked, so this tests the
// contract and the guards: what reaches the app must be safe to apply.
import { pathToFileURL } from 'node:url'; import { resolve as _r } from 'node:path';
process.env.KV_REST_API_URL="https://kv.mock"; process.env.KV_REST_API_TOKEN="t";
process.env.DEPLOY_SECRET="moes-deploy-2026"; process.env.ANTHROPIC_API_KEY="a";
const store=new Map(); let REPLY=null, SYS="", HITS=[];
globalThis.fetch=async(url,opts={})=>{
  const u=String(url);
  if(u.startsWith("https://kv.mock")){const [op,k,v]=JSON.parse(opts.body);let result=null;
    if(op==="GET")result=store.has(k)?store.get(k):null;else if(op==="SET"){store.set(k,v);result="OK";}
    return new Response(JSON.stringify({result}),{status:200});}
  if(u.includes("api.groq.com")){HITS.push("groq");
    if(u.includes("/models"))return new Response(JSON.stringify({data:[{id:"whisper-large-v3"},{id:"llama-3.3-70b-versatile"}]}),{status:200});
    const b=JSON.parse(opts.body||"{}");SYS=String((b.messages||[])[0]&&(b.messages[0].content)||"");
    if(REPLY==="groqdown")return new Response(JSON.stringify({error:{message:"down"}}),{status:500});
    return new Response(JSON.stringify({choices:[{message:{content:typeof REPLY==="string"?REPLY:JSON.stringify({actions:REPLY})}}]}),{status:200});}
  if(u.includes("generativelanguage.googleapis.com")){HITS.push("gemini");
    if(u.includes("/models?"))return new Response(JSON.stringify({models:[{name:"models/gemini-flash-latest"}]}),{status:200});
    const b=JSON.parse(opts.body||"{}");SYS=String(((b.systemInstruction||{}).parts||[])[0]&&b.systemInstruction.parts[0].text||"");
    return new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({actions:REPLY})}]}}]}),{status:200});}
  if(u.includes("api.anthropic.com")){HITS.push("claude");const b=JSON.parse(opts.body||"{}");SYS=String(b.system||"");
    return new Response(JSON.stringify({content:[{type:"text",text:typeof REPLY==="string"?REPLY:JSON.stringify(REPLY)}],usage:{input_tokens:5,output_tokens:5}}),{status:200});}
  return new Response("{}",{status:200});
};
const mod=await import(pathToFileURL(_r(process.cwd(),"./api/health-check.js")).href);
const call=(body)=>new Promise((res)=>{const r={code:200,setHeader(){},status(c){this.code=c;return this;},json(j){res({code:this.code,j});},end(){res({code:this.code,j:null});}};mod.default({method:"POST",query:{},body,headers:{}},r);});
let pass=0,fail=0;const F=[];const check=(n,c,x)=>{if(c)pass++;else{fail++;F.push(n+(x?" — "+x:""));}};
store.set("maqadi:state",JSON.stringify({v:1,state:{items:{}}}));
const TASKS=[{id:"t1",title:"Call the bank",lane:"today",sched:"off"},
             {id:"t2",title:"Water the plants",lane:"week",sched:"off"},
             {id:"t3",title:"Clear the inbox",lane:"today",sched:"daily"}];
const fire=(reply,text="say something")=>{REPLY=reply;return call({action:"taskvoice",pin:"2026",text,tasks:TASKS,today:"Sunday 14 September 2026"});};

/* the prompt carries what it needs to resolve "the bank" to a real task */
let r=await fire([{op:"add",title:"Wash the car",lane:"today"}]);
check("200",r.code===200,"code "+r.code);
check("prompt lists his existing tasks",/t1 \u2014 Call the bank/.test(SYS));
check("prompt states today",/Sunday 14 September 2026/.test(SYS));
check("prompt covers Arabic and prayer times",/\u0627\u0644\u0639\u0635\u0631|asr/.test(SYS));
check("add passes through",r.j.actions.length===1&&r.j.actions[0].op==="add"&&r.j.actions[0].title==="Wash the car");
check("add defaults to today when no lane given",r.j.actions[0].lane==="today");

/* several actions from one sentence */
r=await fire([{op:"done",id:"t1"},{op:"add",title:"\u0627\u063a\u0633\u0644 \u0627\u0644\u0633\u064a\u0627\u0631\u0629",lane:"today",dueDays:1}]);
check("one sentence can finish one task and add another",r.j.actions.length===2&&r.j.actions[0].op==="done"&&r.j.actions[1].op==="add");
check("Arabic titles survive",r.j.actions[1].title==="\u0627\u063a\u0633\u0644 \u0627\u0644\u0633\u064a\u0627\u0631\u0629");
check("dueDays kept",r.j.actions[1].dueDays===1);

/* routines */
r=await fire([{op:"routine",id:"t2",every:"weekly",days:[0],block:"evening"}]);
check("weekly routine accepted",r.j.actions[0].op==="routine"&&r.j.actions[0].every==="weekly"&&r.j.actions[0].days[0]===0&&r.j.actions[0].block==="evening");
r=await fire([{op:"routine",title:"Stretch",every:"daily",block:"early"}]);
check("a routine can be a brand new task",r.j.actions[0].title==="Stretch"&&r.j.actions[0].every==="daily");
r=await fire([{op:"routine",id:"t2",every:"weekly",days:[]}]);
check("weekly with no days is dropped",r.j.actions.length===0);
r=await fire([{op:"routine",id:"t2",every:"sometimes"}]);
check("an invented frequency is dropped",r.j.actions.length===0);
r=await fire([{op:"unroutine",id:"t3"}]);
check("a routine can be switched off",r.j.actions[0].op==="unroutine"&&r.j.actions[0].id==="t3");

/* guards: nothing may act on a task that does not exist */
r=await fire([{op:"done",id:"nope"},{op:"move",id:"nope",lane:"week"},{op:"remove",id:"nope"},{op:"unroutine",id:"nope"}]);
check("actions on unknown ids are all dropped",r.j.actions.length===0,JSON.stringify(r.j.actions));
r=await fire([{op:"add",title:""},{op:"add"}]);
check("an add with no title is dropped",r.j.actions.length===0);
r=await fire([{op:"nuke",id:"t1"},{op:"drop database"}]);
check("unknown operations are dropped",r.j.actions.length===0);
r=await fire([{op:"move",id:"t1",lane:"someday"}]);
check("an invalid lane is not passed through",r.j.actions[0].lane===null);
r=await fire([{op:"add",title:"x",lane:"today",block:"teatime",dur:99999,dueDays:-4}]);
check("out-of-range block, duration and day are cleaned",r.j.actions[0].block===null&&r.j.actions[0].dur===null&&r.j.actions[0].dueDays===null);
r=await fire([{op:"add",title:"y",lane:"today",dur:45,dueDays:0}]);
check("sane duration and today are kept",r.j.actions[0].dur===45&&r.j.actions[0].dueDays===0);
r=await fire("not json at all");
check("a junk model reply yields no actions, not an error",r.code===200&&r.j.actions.length===0);
r=await fire({actions:[{op:"done",id:"t1"}]});
check("an object wrapper is accepted too",r.j.actions.length===1);
r=await fire(new Array(60).fill({op:"add",title:"spam",lane:"today"}));
check("a runaway reply is capped",r.j.actions.length<=30,String(r.j.actions.length));

/* access */
check("no text -> 400",(await call({action:"taskvoice",pin:"2026",tasks:TASKS})).code===400);
check("wife's code blocked",(await call({action:"taskvoice",pin:"1234",text:"hi"})).code===403);
check("bad pin blocked",(await call({action:"taskvoice",pin:"0000",text:"hi"})).code===401);
const before=store.get("maqadi:state");
await fire([{op:"add",title:"z",lane:"today"}]);
check("never writes app state",store.get("maqadi:state")===before);

/* free first: Groq is used and neither paid engine is touched */
process.env.GROQ_API_KEY="g"; process.env.GEMINI_API_KEY="gm";
const mod2=await import(pathToFileURL(_r(process.cwd(),"./api/health-check.js")).href+"?free=1");
const call2=(body)=>new Promise((res)=>{const r={code:200,setHeader(){},status(c){this.code=c;return this;},json(j){res({code:this.code,j});},end(){res({code:this.code,j:null});}};mod2.default({method:"POST",query:{},body,headers:{}},r);});
HITS=[];REPLY=[{op:"add",title:"Free path",lane:"today"}];
r=await call2({action:"taskvoice",pin:"2026",text:"add a thing",tasks:TASKS,today:"Sunday"});
check("free: Groq answered",r.code===200&&r.j.engine==="groq",JSON.stringify({c:r.code,e:r.j&&r.j.engine}));
check("free: the action came through",r.j.actions.length===1&&r.j.actions[0].title==="Free path");
check("free: Claude was never called",HITS.indexOf("claude")<0,HITS.join(","));
check("free: Groq still gets his task list",/t1 \u2014 Call the bank/.test(SYS));
HITS=[];REPLY="groqdown";
r=await call2({action:"taskvoice",pin:"2026",text:"x",tasks:TASKS,today:"Sunday"});
check("free: Groq down falls to Gemini, not to Claude",HITS.indexOf("gemini")>=0&&HITS.indexOf("claude")<0,HITS.join(","));

console.log(`PASS ${pass}  FAIL ${fail}`);
if(fail){console.log("FAILED:\n - "+F.join("\n - "));process.exit(1);}
