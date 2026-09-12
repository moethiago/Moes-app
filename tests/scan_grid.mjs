// Grid for the one-photo scan action: GPT engine, Azure engine, Claude fallback, cascade.
// Mocked vendors — no real API call, no spend. Fixture = the عذق الجزيرة receipt.
import { pathToFileURL } from 'node:url'; import { resolve as _r } from 'node:path';
process.env.KV_REST_API_URL="https://kv.mock"; process.env.KV_REST_API_TOKEN="t";
process.env.DEPLOY_SECRET="moes-deploy-2026"; process.env.ANTHROPIC_API_KEY="a-key";
process.env.OPENAI_API_KEY="oa-key"; process.env.AZURE_DI_KEY="az-key"; process.env.AZURE_DI_ENDPOINT="https://az.mock";
const store=new Map(); let OA=null, AZ=null, CL=null, SENT=[];
globalThis.fetch = async (url, opts={}) => {
  const u=String(url); SENT.push(u);
  if(u.startsWith("https://kv.mock")){const [op,k,v]=JSON.parse(opts.body);let result=null;
    if(op==="GET")result=store.has(k)?store.get(k):null; else if(op==="SET"){store.set(k,v);result="OK";}
    return new Response(JSON.stringify({result}),{status:200});}
  if(u.includes("api.openai.com")){ if(OA==="throw")return new Response(JSON.stringify({error:{message:"bad key"}}),{status:401});
    return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(OA)}}]}),{status:200});}
  if(u.includes("az.mock")){ if(AZ==="throw")return new Response(JSON.stringify({error:{message:"az down"}}),{status:500});
    if(opts.method==="POST")return new Response("",{status:202,headers:{"operation-location":"https://az.mock/op/1"}});
    return new Response(JSON.stringify({status:"succeeded",analyzeResult:{documents:[{fields:AZ}]}}),{status:200});}
  if(u.includes("api.anthropic.com")) return new Response(JSON.stringify({content:[{type:"text",text:JSON.stringify(CL)}],usage:{input_tokens:10,output_tokens:5}}),{status:200});
  return new Response("{}",{status:200});
};
const mod=await import(pathToFileURL(_r(process.cwd(),"./api/health-check.js")).href);
function call(body,query={}){return new Promise((res)=>{const r={code:200,h:{},setHeader(){},status(c){this.code=c;return this;},json(j){res({code:this.code,j});},end(){res({code:this.code,j:null});}};mod.default({method:"POST",query,body,headers:{}},r);});}
let pass=0,fail=0;const F=[];const check=(n,c,x)=>{if(c)pass++;else{fail++;F.push(n+(x?" — "+x:""));}};
store.set("maqadi:state",JSON.stringify({v:1,state:{items:{}}}));
const CAT=["جزر","بقدونس","قشطة","لبن","حليب (كامل الدسم)","دجاج","تفاح"];
const GPT_OK={store_raw:"عذق الجزيرة",date:"2026-09-12",total:219.27,vat:28.60,lines:[
 {code:"200003",name_ar:"كزبرة",confidence:"high",qty:1,unit_price:2,line_total:2},
 {code:"100063",name_ar:"جزر",confidence:"high",qty:1,unit_price:10,line_total:10,match:"جزر"},
 {code:"0307",name_ar:"تفاح احمر",confidence:"high",qty:1.46,unit_price:12,line_total:17.52,match:"تفاح"},
 {code:"6261007666527",name_ar:"قشطة المراعي لايت 100 جرام",confidence:"high",qty:2,unit_price:4,line_total:8,match:"قشطة"},
 {code:"0000",name_ar:null,confidence:"low",qty:1,unit_price:null,line_total:6.5}]};
const fire=async(b={})=>{SENT=[];return call({action:"scan",pin:"2026",catalog:CAT,images:["aaa"],mime:"image/jpeg",...b});};

/* 1 GPT is preferred when its key exists */
OA=GPT_OK; let r=await fire();
check("gpt: 200",r.code===200,"code "+r.code);
check("gpt: engine reported",r.j.engine==="gpt",r.j.engine);
check("gpt: used the OpenAI endpoint",SENT.some((u)=>u.includes("api.openai.com")));
check("gpt: no Azure or Anthropic call",!SENT.some((u)=>u.includes("az.mock")||u.includes("anthropic")));
check("gpt: 5 lines",r.j.lines.length===5,"got "+r.j.lines.length);
check("gpt: names kept verbatim",r.j.lines[3].name_ar==="قشطة المراعي لايت 100 جرام");
check("gpt: codes kept",r.j.lines[3].code==="6261007666527");
check("gpt: kg qty and unit price",r.j.lines[2].qty===1.46&&r.j.lines[2].unit_price===12);
check("gpt: catalog match kept",r.j.lines[1].match==="جزر");
check("gpt: null name forced low, no match",r.j.lines[4].confidence==="low"&&r.j.lines[4].name_ar===null&&r.j.lines[4].match===null);
check("gpt: unreadable counted",r.j.unreadable===1);
check("gpt: total and vat",r.j.total===219.27&&r.j.vat===28.6);
check("gpt: seller",/عذق/.test(r.j.seller));
check("gpt: sum computed",r.j.sum===44.02,"sum "+r.j.sum);
check("gpt: mismatch flagged vs printed total",r.j.mismatch!==0);
check("gpt: unit price derived when missing",(await fire()).j.lines[0].unit_price===2);
/* dedupe across slices */
OA={...GPT_OK,lines:GPT_OK.lines.concat([GPT_OK.lines[1]])};
check("gpt: slice duplicates dropped",(await fire()).j.lines.length===5);
/* fake catalog match refused */
OA={...GPT_OK,lines:[{code:"1",name_ar:"جزر",confidence:"high",qty:1,line_total:5,match:"ليس في القائمة"}]};
check("gpt: fake match refused",(await fire()).j.lines[0].match===null);
/* known codes flagged for the client */
OA=GPT_OK; r=await fire({known:["100063"]});
check("known code flagged",r.j.lines[1].known===true&&r.j.lines[0].known===false);

/* 2 cascade: GPT fails -> Azure -> Claude */
AZ={MerchantName:{content:"عذق الجزيرة"},TransactionDate:{valueDate:"2026-09-12"},Total:{valueCurrency:{amount:219.27}},TotalTax:{valueCurrency:{amount:28.6}},
    Items:{valueArray:[{confidence:.9,valueObject:{Description:{content:"جزر",confidence:.9},Quantity:{valueNumber:1},Price:{valueCurrency:{amount:10}},TotalPrice:{valueCurrency:{amount:10}}}}]}};
OA="throw"; r=await fire();
check("cascade: falls back to Azure",r.code===200&&r.j.engine==="azure",JSON.stringify(r.j.tried||r.code));
check("cascade: records why gpt failed",Array.isArray(r.j.tried)&&/gpt/.test(r.j.tried.join()));
check("azure: line mapped",r.j.lines[0].name_ar==="جزر"&&r.j.lines[0].line_total===10);
check("azure: total, vat, seller, date",r.j.total===219.27&&r.j.vat===28.6&&/عذق/.test(r.j.seller)&&r.j.date==="2026-09-12");
CL={store:"Other",total:12,lines:[{code:"9",name_ar:"بصل",confidence:"high",qty:1,line_total:12}]};
AZ="throw"; r=await fire();
check("cascade: falls back to Claude",r.code===200&&r.j.engine==="claude",JSON.stringify(r.j.tried||r.code));
check("cascade: both failures recorded",r.j.tried.length===2&&/azure/.test(r.j.tried.join()));
CL={lines:[]}; r=await fire();
check("all engines fail: 502 with reasons",r.code===502&&r.j.tried.length>=2,JSON.stringify(r.j));

/* 3 explicit engine choice is honoured */
OA=GPT_OK; AZ="throw"; r=await fire({engine:"gpt"});
check("engine:gpt honoured",r.j.engine==="gpt");
CL={store:"Other",total:12,lines:[{code:"9",name_ar:"بصل",confidence:"high",qty:1,line_total:12}]};
r=await fire({engine:"claude"});
check("engine:claude honoured",r.j.engine==="claude");
check("engine:claude did not call OpenAI",!SENT.some((u)=>u.includes("openai")));

/* 4 guards */
r=await call({action:"scan",pin:"1234",images:["a"]});
check("wife's code blocked from scan",r.code===403,"code "+r.code);
r=await call({action:"scan",pin:"2026"});
check("no image -> 400",r.code===400);
const before=store.get("maqadi:state"); OA=GPT_OK; AZ=null; await fire();
check("scanning never writes grocery state",store.get("maqadi:state")===before);
OA="not json"; AZ="throw"; CL={lines:[]}; r=await fire();
check("garbage from every vendor -> 502, no crash",r.code===502);

console.log(`PASS ${pass}  FAIL ${fail}`);
if(fail){console.log("FAILED:\n - "+F.join("\n - "));process.exit(1);}
