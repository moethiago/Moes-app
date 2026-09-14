// Grid for the Maham MCP endpoint — the surface a Claude chat talks to.
// In-memory KV, no network. Checks the protocol, every tool, and the guards.
import { pathToFileURL } from 'node:url'; import { resolve as _r } from 'node:path';
process.env.KV_REST_API_URL="https://kv.mock"; process.env.KV_REST_API_TOKEN="t";
process.env.DEPLOY_SECRET="moes-deploy-2026"; process.env.MCP_SECRET="mcp-secret-xyz";
process.env.ANTHROPIC_API_KEY="a";
const store=new Map();
globalThis.fetch=async(url,opts={})=>{
  if(String(url).startsWith("https://kv.mock")){const [op,k,v]=JSON.parse(opts.body);let result=null;
    if(op==="GET")result=store.has(k)?store.get(k):null;else if(op==="SET"){store.set(k,v);result="OK";}else if(op==="DEL"){store.delete(k);result=1;}
    return new Response(JSON.stringify({result}),{status:200});}
  return new Response("{}",{status:200});
};
const mod=await import(pathToFileURL(_r(process.cwd(),"./api/health-check.js")).href);
const rpc=(body,key="mcp-secret-xyz",method="POST")=>new Promise((res)=>{
  const r={code:200,h:{},setHeader(k,v){this.h[k]=v;},status(c){this.code=c;return this;},json(j){res({code:this.code,j,h:this.h});},end(){res({code:this.code,j:null,h:this.h});}};
  mod.default({method,query:{mcp:key},body,headers:{}},r);});
const call=(name,args)=>rpc({jsonrpc:"2.0",id:1,method:"tools/call",params:{name,arguments:args}});
const textOf=(r)=>r.j&&r.j.result&&r.j.result.content?r.j.result.content.map(c=>c.text).join(""):JSON.stringify(r.j);
let pass=0,fail=0;const F=[];const check=(n,c,x)=>{if(c)pass++;else{fail++;F.push(n+(x?" — "+x:""));}};
const seed=()=>store.set("maham:state",JSON.stringify({v:3,state:{
  tasks:{"t:a":{id:"t:a",title:"Call the bank",sched:{type:"off"},doneAt:[],moves:0},
         "t:b":{id:"t:b",title:"Water the plants",sched:{type:"off"},doneAt:[],moves:0},
         "t:c":{id:"t:c",title:"Clear the inbox",sched:{type:"daily",block:"early"},doneAt:[],moves:0}},
  lanes:{today:["t:a","t:c"],week:["t:b"],later:[]},log:[]}}));
const state=()=>JSON.parse(store.get("maham:state")).state;
const ver=()=>JSON.parse(store.get("maham:state")).v;
seed();

/* protocol */
let r=await rpc({jsonrpc:"2.0",id:1,method:"initialize",params:{}});
check("initialize answers",r.code===200&&r.j.result&&r.j.result.serverInfo.name==="maham",JSON.stringify(r.j).slice(0,120));
check("advertises a protocol version",!!r.j.result.protocolVersion);
check("declares the tools capability",!!r.j.result.capabilities.tools);
r=await rpc({jsonrpc:"2.0",id:2,method:"tools/list"});
const names=(r.j.result.tools||[]).map(t=>t.name);
check("lists all six tools",names.length===6&&names.indexOf("list_tasks")>=0&&names.indexOf("remove_task")>=0,names.join(","));
check("every tool has a title and a description",(r.j.result.tools||[]).every(t=>t.title&&t.description&&t.inputSchema));
check("the read-only tool says so",r.j.result.tools.find(t=>t.name==="list_tasks").annotations.readOnlyHint===true);
check("the destructive tool says so",r.j.result.tools.find(t=>t.name==="remove_task").annotations.destructiveHint===true);
r=await rpc({jsonrpc:"2.0",id:3,method:"ping"});
check("ping answers",r.code===200&&!!r.j.result);
r=await rpc({jsonrpc:"2.0",method:"notifications/initialized"});
check("a notification gets no body",r.code===202);
r=await rpc({jsonrpc:"2.0",id:4,method:"nope/nope"});
check("an unknown method is a proper JSON-RPC error",r.j.error&&r.j.error.code===-32601);
r=await rpc({jsonrpc:"2.0",id:5,method:"tools/list"},"wrong-key");
check("a wrong key is refused",r.code===401,"code "+r.code);
r=await rpc({},"mcp-secret-xyz","OPTIONS");
check("CORS preflight answered",r.code===204);
check("CORS header set",r.h["Access-Control-Allow-Origin"]==="*");

/* reading */
r=await call("list_tasks",{});
check("list shows every task",/Call the bank/.test(textOf(r))&&/Water the plants/.test(textOf(r)));
check("list shows the id so it can be acted on",/id: t:a/.test(textOf(r)));
check("list shows the lane",/\[today\]/.test(textOf(r)));
r=await call("list_tasks",{lane:"week"});
check("list filters by lane",/Water the plants/.test(textOf(r))&&!/Call the bank/.test(textOf(r)));
r=await call("list_tasks",{routinesOnly:true});
check("list filters to routines",/Clear the inbox/.test(textOf(r))&&!/Call the bank/.test(textOf(r)));
check("a routine reads back in words",/every day/.test(textOf(r)),textOf(r));

/* writing */
const v0=ver();
r=await call("add_task",{title:"Wash the car",lane:"today",dueInDays:1,block:"evening",minutes:30});
check("add reports back",/Added/.test(textOf(r))&&/Wash the car/.test(textOf(r)),textOf(r));
let st=state();
const car=Object.values(st.tasks).find(t=>t.title==="Wash the car");
check("add wrote the task",!!car);
check("add set the due day",!!car.due&&car.due>Date.now());
check("add set the block and duration",car.dueBlock==="evening"&&car.durMin===30);
check("add put it on a lane",st.lanes.today.indexOf(car.id)>=0);
check("add bumped the version",ver()===v0+1);
check("add marks where it came from",car.viaChat===true);

r=await call("complete_task",{task:"the bank"});
check("complete matches by title, not just id",/Done: Call the bank/.test(textOf(r)),textOf(r));
st=state();
check("complete took it off its lane",st.lanes.today.indexOf("t:a")<0);
check("complete recorded it in the log",st.log.length===1&&st.log[0].id==="t:a");
check("complete kept the task itself",!!st.tasks["t:a"]);

r=await call("move_task",{task:"Water the plants",lane:"today"});
check("move reports back",/Moved/.test(textOf(r)));
st=state();
check("move changed the lane",st.lanes.today.indexOf("t:b")>=0&&st.lanes.week.indexOf("t:b")<0);
r=await call("move_task",{task:"Water the plants",lane:"someday"});
check("an invalid lane is refused",/today, week or later/.test(textOf(r)));

r=await call("set_routine",{task:"Water the plants",every:"weekly",days:[0,3],block:"evening"});
check("weekly routine set",state().tasks["t:b"].sched.type==="weekly"&&state().tasks["t:b"].sched.days.join()==="0,3");
check("routine reports back in words",/every Sun\/Wed/.test(textOf(r)),textOf(r));
r=await call("set_routine",{task:"Water the plants",every:"weekly",days:[]});
check("weekly with no days is refused",/needs days/.test(textOf(r)));
r=await call("set_routine",{task:"Clear the inbox",every:"off"});
check("a routine can be switched off",state().tasks["t:c"].sched.type==="off");

r=await call("remove_task",{task:"Wash the car"});
check("remove reports back",/Deleted/.test(textOf(r)));
check("remove deleted it",!Object.values(state().tasks).some(t=>t.title==="Wash the car"));

/* guards */
r=await call("complete_task",{task:"something that is not there"});
check("an unknown task is reported, not guessed",/No task matches/.test(textOf(r)),textOf(r));
check("and nothing was written",ver()===JSON.parse(store.get("maham:state")).v);
r=await call("add_task",{title:"   "});
check("an empty title is refused",/title is needed/.test(textOf(r)));
r=await call("nope",{});
check("an unknown tool is reported",/Unknown tool/.test(textOf(r)));
// a concurrent change from the phone must not be clobbered
const before=JSON.parse(store.get("maham:state"));
const raced=new Promise((res)=>{const rr={code:200,setHeader(){},status(c){this.code=c;return this;},json(j){res({code:this.code,j});},end(){res({code:this.code});}};
  mod.default({method:"POST",query:{mcp:"mcp-secret-xyz"},body:{jsonrpc:"2.0",id:9,method:"tools/call",params:{name:"add_task",arguments:{title:"Racy"}}},headers:{}},rr);});
store.set("maham:state",JSON.stringify({...before,v:before.v+5}));
r=await raced;
check("a change made on the phone meanwhile is not clobbered",/at the same time/.test(textOf(r))||!/Added/.test(textOf(r)),textOf(r));

console.log(`PASS ${pass}  FAIL ${fail}`);
if(fail){console.log("FAILED:\n - "+F.join("\n - "));process.exit(1);}
