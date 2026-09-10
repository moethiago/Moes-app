const fs=require('fs');const h=fs.readFileSync(require('path').join(__dirname,'..','wain','index.html'),'utf8');let js=h.split('<script>')[1].split('</script>')[0];
js=js.replace(/\(async function boot\(\)[\s\S]*$/,'');
const els={};global.document={getElementById:id=>els[id]||(els[id]={classList:{add(){},remove(){},toggle(){},contains(){return false}},style:{},querySelectorAll:()=>[],innerHTML:'',textContent:''}),querySelectorAll:()=>[]};
global.localStorage={getItem:()=>null,setItem(){},removeItem(){}};global.navigator={};global.window={scrollTo(){}};global.fetch=async()=>{throw new Error("no net")};
const RD=Date;let fixed=new RD(2026,8,10,9,0);
global.Date=class extends RD{constructor(...a){a.length?super(...a):super(fixed.getTime());}static now(){return fixed.getTime();}};
js+=`
const ORIG={"Rawdah/east":{lat:24.735,lng:46.78},"Malqa/north":{lat:24.80,lng:46.61},"Olaya/center":{lat:24.70,lng:46.68},"Irqah/west":{lat:24.69,lng:46.59},"Shifa/south":{lat:24.56,lng:46.69},"Yarmouk/far east":{lat:24.81,lng:46.79}};
const MOODS=[["any"],["coffee"],["food"],["dessert"],["event"],["walk"],["explore"],["coffee","dessert"]];
let fails=[],combos=0,thin=0,broadFail=0,hardViol=0,worst=[];
for(const [oname,o] of Object.entries(ORIG)){ loc=o;
 for(let day=0;day<7;day++) for(let hr=0;hr<24;hr+=2){
  fixed=new RD(2026,8,13+day,hr,15); // Sep 13 2026 is Sunday
  for(const m of MOODS) for(const [,t] of TIMES) for(const [,dist] of DISTS){
    session={shown:new Set(),rejectedCats:new Set(),round:0};
    const opts={time:t,moods:new Set(m),dist};
    const picks=pickWithWidening(opts); combos++;
    // hard constraints on every pick
    for(const c of picks){
      const at=new Date(); const arrive=new Date(at.getTime()+c.d.min*60000); const oi=openInfo(c.p,arrive);
      if(!(oi.open||(oi.opensIn!==null&&oi.opensIn<=25))) {hardViol++; fails.push([oname,day,hr,m.join('+'),t,dist,'CLOSED',c.p.name]);}
      if(c.d.min*2+Math.min(c.p.stay,30)>t) {hardViol++; fails.push([oname,day,hr,m.join('+'),t,dist,'OVERTIME',c.p.name,c.d.min]);}
      if(!c.far && c.d.min>dist) {hardViol++; fails.push([oname,day,hr,m.join('+'),t,dist,'TOOFAR',c.p.name,c.d.min]);}
      if(c.p.tags.includes("outdoor") && hot(at) && c===picks[0] && picks.some(x=>!x.p.tags.includes("outdoor") && x.p.cats.some(k=>m.includes(k)))) worst.push([m.join("+"),c.p.name]);
    }
    const broad = m[0]==="any" && t>=150 && dist>=30;
    if(broad && picks.length<3){ broadFail++; fails.push([oname,day,hr,'any',t,dist,'THIN',picks.length]); }
    if(picks.length<3) thin++;
  }
 }
}
console.log("combos",combos,"hard violations",hardViol,"broad(any,>=2.5h,>=30min) with <3 results",broadFail,"any-combo thin",thin,"hot-outdoor-first",worst.length);
const cnt={};worst.forEach(w=>{cnt[w[0]+" | "+w[1]]=(cnt[w[0]+" | "+w[1]]||0)+1});console.log(cnt);
`;
js+=`
if(hardViol>0||broadFail>0){console.error('FAIL');process.exit(1);}else console.log('PASS');`;
eval(js);
