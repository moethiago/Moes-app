// Grid for the one-photo scan action: GPT engine, Azure engine, Claude fallback, cascade.
// Mocked vendors — no real API call, no spend. Fixture = the عذق الجزيرة receipt.
import { pathToFileURL } from 'node:url'; import { resolve as _r } from 'node:path';
process.env.KV_REST_API_URL="https://kv.mock"; process.env.KV_REST_API_TOKEN="t";
process.env.DEPLOY_SECRET="moes-deploy-2026"; process.env.ANTHROPIC_API_KEY="a-key";
process.env.OPENAI_API_KEY="oa-key"; process.env.AZURE_DI_KEY="az-key"; process.env.AZURE_DI_ENDPOINT="https://az.mock";
const store=new Map(); let OA=null, AZ=null, CL=null, SENT=[], SENT_BODIES=[], PROMPT_SEEN="", CLAUDE_PROMPT_SEEN="", JSON_MODE=false, CLAUDE_CALLS=0;
globalThis.fetch = async (url, opts={}) => {
  const u=String(url); SENT.push(u);
  if(u.startsWith("https://kv.mock")){const [op,k,v]=JSON.parse(opts.body);let result=null;
    if(op==="GET")result=store.has(k)?store.get(k):null; else if(op==="SET"){store.set(k,v);result="OK";} else if(op==="DEL"){store.delete(k);result=1;}
    return new Response(JSON.stringify({result}),{status:200});}
  if(u.includes("api.openai.com")){ const b=JSON.parse(opts.body||"{}");SENT_BODIES.push(b);
    const sm=(b.messages||[]).find(m=>m.role==="system");if(sm)PROMPT_SEEN=String(sm.content);
    JSON_MODE=!!(b.response_format&&b.response_format.type==="json_object");
    if(OA==="throw")return new Response(JSON.stringify({error:{message:"bad key"}}),{status:401});
    return new Response(JSON.stringify({choices:[{message:{content:typeof OA==="string"?OA:JSON.stringify(OA)}}]}),{status:200});}
  if(u.includes("az.mock")){ if(AZ==="throw")return new Response(JSON.stringify({error:{message:"az down"}}),{status:500});
    if(opts.method==="POST")return new Response("",{status:202,headers:{"operation-location":"https://az.mock/op/1"}});
    return new Response(JSON.stringify({status:"succeeded",analyzeResult:{documents:[{fields:AZ}]}}),{status:200});}
  if(u.includes("api.anthropic.com")){const b=JSON.parse(opts.body||"{}");CLAUDE_CALLS++;if(b.system)CLAUDE_PROMPT_SEEN=String(b.system);
    return new Response(JSON.stringify({content:[{type:"text",text:typeof CL==="string"?CL:JSON.stringify(CL)}],usage:{input_tokens:10,output_tokens:5}}),{status:200});}
  return new Response("{}",{status:200});
};
const mod=await import(pathToFileURL(_r(process.cwd(),"./api/health-check.js")).href);
function call(body,query={}){return new Promise((res)=>{const r={code:200,h:{},setHeader(){},status(c){this.code=c;return this;},json(j){res({code:this.code,j});},end(){res({code:this.code,j:null});}};mod.default({method:"POST",query,body,headers:{}},r);});}
let pass=0,fail=0;const F=[];const check=(n,c,x)=>{if(c)pass++;else{fail++;F.push(n+(x?" — "+x:""));}};
store.set("maqadi:state",JSON.stringify({v:1,state:{items:{}}}));
const CAT=["جزر","بقدونس","قشطة","لبن","حليب (كامل الدسم)","دجاج","تفاح"];
// the requested schema, verbatim
const S_OK={items:[
 {name:"كزبرة",quantity:1,weight_kg:null,price_sar:2.00,confidence:0.97},
 {name:"جزر",quantity:1,weight_kg:null,price_sar:10.00,confidence:0.95},
 {name:"تفاح احمر",quantity:1,weight_kg:1.46,price_sar:17.52,confidence:0.93},
 {name:"قشطة المراعي لايت 100 جرام",quantity:2,weight_kg:null,price_sar:8.00,confidence:0.91},
 {name:"UNCLEAR",quantity:1,weight_kg:null,price_sar:6.50,confidence:0.30}],
 receipt_total_sar:44.02};
const fire=async(b={})=>{SENT=[];return call({action:"scan",pin:"2026",catalog:CAT,images:["aaa"],mime:"image/jpeg",...b});};

/* 1 — the prompt sent is the one that was specified */
OA=S_OK; let r=await fire();
const sys=(SENT_BODIES.find(b=>b&&b.messages&&b.messages[0]&&b.messages[0].role==="system")||{}).messages;
check("gpt: 200",r.code===200,"code "+r.code);
check("gpt: engine",r.j.engine==="gpt",r.j.engine);
check("prompt: visual-first instruction present",/Do NOT use OCR text as the primary method/.test(PROMPT_SEEN));
check("prompt: keep code/name/columns associated",/Keep these physically associated/.test(PROMPT_SEEN));
check("prompt: no guessing, UNCLEAR allowed",/DO NOT invent or guess a product name/.test(PROMPT_SEEN)&&/UNCLEAR/.test(PROMPT_SEEN));
check("prompt: ignore list present",/Ignore:[\s\S]*VAT[\s\S]*subtotal[\s\S]*payment/.test(PROMPT_SEEN));
check("prompt: exact JSON shape requested",/"price_sar"/.test(PROMPT_SEEN)&&/"receipt_total_sar"/.test(PROMPT_SEEN));
check("gpt: json mode requested",JSON_MODE===true);

/* 2 — schema mapped correctly */
check("4 clear items + 1 unclear kept",r.j.lines.length===5,"got "+r.j.lines.length);
check("names verbatim",r.j.lines[3].name_ar==="قشطة المراعي لايت 100 جرام");
check("price_sar -> line total",r.j.lines[1].line_total===10);
check("quantity carried",r.j.lines[3].qty===2);
check("weight_kg becomes the quantity",r.j.lines[2].qty===1.46,"qty "+r.j.lines[2].qty);
check("unit price derived (17.52/1.46 = 12)",r.j.lines[2].unit_price===12,"unit "+r.j.lines[2].unit_price);
check("per-kg unit price for a weighed item",r.j.lines[3].unit_price===4);
check("UNCLEAR -> null name, low confidence",r.j.lines[4].name_ar===null&&r.j.lines[4].confidence==="low");
check("UNCLEAR keeps its price",r.j.lines[4].line_total===6.5);
check("UNCLEAR never gets a product match",r.j.lines[4].match===null);
check("unreadable counted",r.j.unreadable===1);
check("receipt_total_sar -> total",r.j.total===44.02);
check("sum computed and reconciles",r.j.sum===44.02&&r.j.mismatch===0,"sum "+r.j.sum);

/* 3 — low numeric confidence is treated as unclear even with a name */
OA={items:[{name:"حلبة المراعي",quantity:1,weight_kg:null,price_sar:8,confidence:0.42}],receipt_total_sar:8};
r=await fire();
check("confidence < 0.6 -> low, no match",r.j.lines[0].confidence==="low"&&r.j.lines[0].name_ar===null&&r.j.lines[0].match===null);
/* dedupe repeated slice output */
OA={items:S_OK.items.concat([S_OK.items[1]]),receipt_total_sar:44.02};
check("slice duplicates dropped",(await fire()).j.lines.length===5);
/* two genuinely different items at the same price survive */
OA={items:[{name:"جزر",quantity:1,weight_kg:null,price_sar:10,confidence:.9},{name:"فلفل حار",quantity:1,weight_kg:null,price_sar:10,confidence:.9}],receipt_total_sar:20};
check("same price, different item: both kept",(await fire()).j.lines.length===2);
/* junk */
OA={items:[],receipt_total_sar:0}; AZ="throw"; CL={items:[],receipt_total_sar:0};
check("no items from any engine -> 502",(await fire()).code===502);
OA="not json"; check("unparsable response -> 502",(await fire()).code===502);

/* 4 — cascade still works, and Claude uses the same prompt and schema */
OA="throw"; AZ="throw";
CL={items:[{name:"بصل",quantity:1,weight_kg:null,price_sar:4,confidence:.9}],receipt_total_sar:4};
r=await fire();
check("cascade: falls through to Claude",r.code===200&&r.j.engine==="claude",JSON.stringify(r.j.tried||r.code));
check("claude: same schema mapped",r.j.lines[0].name_ar==="بصل"&&r.j.lines[0].line_total===4);
check("claude: got the same prompt",/Do NOT use OCR text as the primary method/.test(CLAUDE_PROMPT_SEEN));
check("cascade: failures recorded",Array.isArray(r.j.tried)&&r.j.tried.length===2,JSON.stringify(r.j.tried));
/* parallel, not sequential: one request per slice, fired together */
CLAUDE_CALLS=0; r=await call({action:"scan",pin:"2026",catalog:CAT,images:["a","b","c"],mime:"image/jpeg"});
check("claude: one call per slice",CLAUDE_CALLS===3,"calls "+CLAUDE_CALLS);
check("claude: slices merged into one result",r.code===200&&r.j.lines.length===1,"lines "+(r.j.lines||[]).length);

/* 4b — the simpler {itemName, quantity, price} shape is accepted too */
OA=[{itemName:"جزر",quantity:1,price:10},{itemName:"كزبرة",quantity:2,price:4}];
r=await fire();
check("bare array of itemName/quantity/price accepted",r.code===200&&r.j.lines.length===2,JSON.stringify(r.j.lines&&r.j.lines.length));
check("itemName mapped to the product name",r.j.lines[0].name_ar==="جزر");
check("price mapped to the line total",r.j.lines[0].line_total===10);
check("quantity mapped, unit price derived",r.j.lines[1].qty===2&&r.j.lines[1].unit_price===2);
OA={items:[{itemName:"بصل",quantity:1,price:4}],total:4};
r=await fire();
check("object form with itemName/price also accepted",r.j.lines[0].name_ar==="بصل"&&r.j.total===4);

/* 4c — the reader key lives server-side, never echoed back */
r=await call({action:"keystatus",pin:"2026"});
check("keystatus: reports engines",r.code===200&&Array.isArray(r.j.engines));
r=await call({action:"setkey",pin:"2026",key:"not-a-key"});
check("setkey: rejects a malformed key",r.code===400,"code "+r.code);
r=await call({action:"setkey",pin:"2026",key:"sk-abcdefghijklmnopqrstuvwxyz0123"});
check("setkey: accepts a valid key",r.code===200&&r.j.hasKey===true);
check("setkey: key stored server-side",String(store.get("maqadi:reader_key")||"").startsWith("sk-"));
r=await call({action:"keystatus",pin:"2026"});
check("keystatus: never returns the key itself",r.code===200&&!JSON.stringify(r.j).includes("abcdefghijklmnopqrstuvwxyz"),JSON.stringify(r.j));
check("keystatus: only a masked hint",/…/.test(String(r.j.masked||"")),String(r.j.masked));
r=await call({action:"setkey",pin:"2026",key:""});
check("setkey: empty clears it",r.code===200&&!store.has("maqadi:reader_key"));
r=await call({action:"setkey",pin:"1234",key:"sk-abcdefghijklmnopqrstuvwxyz0123"});
check("wife's code cannot set the key",r.code===403,"code "+r.code);
r=await call({action:"keystatus",pin:"1234"});
check("wife's code cannot read key status",r.code===403,"code "+r.code);

/* 5 — guards */
r=await call({action:"scan",pin:"1234",images:["a"]});
check("wife's code blocked",r.code===403,"code "+r.code);
check("no image -> 400",(await call({action:"scan",pin:"2026"})).code===400);
const before=store.get("maqadi:state"); OA=S_OK; AZ=null; await fire();
check("scanning never writes grocery state",store.get("maqadi:state")===before);

console.log(`PASS ${pass}  FAIL ${fail}`);
if(fail){console.log("FAILED:\n - "+F.join("\n - "));process.exit(1);}
