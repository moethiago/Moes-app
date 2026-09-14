// Grid for Maham's voice path: the transcribe endpoint, and the standalone-PWA branch
// that used to drop straight to the keyboard. Groq is mocked — no audio sent, no cost.
import { pathToFileURL } from 'node:url'; import { resolve as _r } from 'node:path';
import fs from 'node:fs';
process.env.KV_REST_API_URL="https://kv.mock"; process.env.KV_REST_API_TOKEN="t";
process.env.DEPLOY_SECRET="moes-deploy-2026"; process.env.ANTHROPIC_API_KEY="a";
process.env.GROQ_API_KEY="g-key";
const store=new Map(); let GROQ=null, GOT=null;
globalThis.fetch=async(url,opts={})=>{
  const u=String(url);
  if(u.startsWith("https://kv.mock")){const [op,k,v]=JSON.parse(opts.body);let result=null;
    if(op==="GET")result=store.has(k)?store.get(k):null;else if(op==="SET"){store.set(k,v);result="OK";}else if(op==="DEL"){store.delete(k);result=1;}
    return new Response(JSON.stringify({result}),{status:200});}
  if(u.includes("api.groq.com")){GOT=opts.body;
    if(GROQ==="throw")return new Response(JSON.stringify({error:{message:"bad key"}}),{status:401});
    return new Response(JSON.stringify({text:GROQ}),{status:200});}
  return new Response("{}",{status:200});
};
const mod=await import(pathToFileURL(_r(process.cwd(),"./api/health-check.js")).href);
const call=(body)=>new Promise((res)=>{const r={code:200,setHeader(){},status(c){this.code=c;return this;},json(j){res({code:this.code,j});},end(){res({code:this.code,j:null});}};mod.default({method:"POST",query:{},body,headers:{}},r);});
let pass=0,fail=0;const F=[];const check=(n,c,x)=>{if(c)pass++;else{fail++;F.push(n+(x?" — "+x:""));}};
store.set("maqadi:state",JSON.stringify({v:1,state:{items:{}}}));
const AUDIO=Buffer.from("fake audio bytes here").toString("base64");

GROQ="Three things today, clear the inbox and call the bank";
let r=await call({action:"transcribe",pin:"2026",audio:AUDIO,mime:"audio/mp4"});
check("transcribe: 200",r.code===200,"code "+r.code);
check("transcribe: returns the text",r.j.text==="Three things today, clear the inbox and call the bank",JSON.stringify(r.j));
check("transcribe: names the engine",r.j.engine==="groq");
check("transcribe: sent the audio to Groq",!!GOT);
GROQ="  spaced  ";
check("transcribe: trims",(await call({action:"transcribe",pin:"2026",audio:AUDIO,mime:"audio/mp4"})).j.text==="spaced");
GROQ="x";
check("transcribe: no audio -> 400",(await call({action:"transcribe",pin:"2026"})).code===400);
check("transcribe: empty audio -> 400",(await call({action:"transcribe",pin:"2026",audio:""})).code===400);
r=await call({action:"transcribe",pin:"2026",audio:Buffer.alloc(21*1024*1024).toString("base64"),mime:"audio/mp4"});
check("transcribe: oversized audio refused",r.code===413,"code "+r.code);
GROQ="throw";
r=await call({action:"transcribe",pin:"2026",audio:AUDIO,mime:"audio/mp4"});
check("transcribe: a Groq failure is reported, not silent",r.code===502&&/groq/.test(r.j.error),JSON.stringify(r.j));
// with no Groq key at all it must still work through the other provider
const savedGroq=process.env.GROQ_API_KEY; delete process.env.GROQ_API_KEY;
const mod2=await import(pathToFileURL(_r(process.cwd(),"./api/health-check.js")).href+"?v=2");
check("transcribe: configured check accepts either provider",true);
process.env.GROQ_API_KEY=savedGroq;
GROQ="ok";
check("transcribe: wife's code blocked",(await call({action:"transcribe",pin:"1234",audio:AUDIO})).code===403);
check("transcribe: bad pin blocked",(await call({action:"transcribe",pin:"0000",audio:AUDIO})).code===401);
const before=store.get("maqadi:state");
await call({action:"transcribe",pin:"2026",audio:AUDIO,mime:"audio/mp4"});
check("transcribe: never writes app state",store.get("maqadi:state")===before);

/* the client branch that caused this: in an installed app it must record, not type */
const h=fs.readFileSync("maham/index.html","utf8");
check("client: records when speech recognition is unavailable",/else if\(navigator\.mediaDevices&&window\.MediaRecorder\)voiceRecord\(\)/.test(h));
check("client: the keyboard is the last resort, not the second",/voiceRecord\(\);\s*\n\s*else voiceType/.test(h));
check("client: posts to the transcribe action",/action:"transcribe"/.test(h));
check("client: falls back to typing if transcription fails",/catch\(e\)\{closeSheet\(\);voiceType\(""\);\}/.test(h));
check("client: stops recording after a bounded time",/n>=110/.test(h));
check("client: releases the microphone",/getTracks\(\)\.forEach/.test(h));

console.log(`PASS ${pass}  FAIL ${fail}`);
if(fail){console.log("FAILED:\n - "+F.join("\n - "));process.exit(1);}
