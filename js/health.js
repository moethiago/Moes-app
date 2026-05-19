var TARGETS = { kcal:2500, prot:180, carb:280, fat:70 };

function addFood() {
  var name=document.getElementById('food-name').value.trim();
  var kcal=parseFloat(document.getElementById('food-kcal').value)||0;
  var prot=parseFloat(document.getElementById('food-prot').value)||0;
  var carb=parseFloat(document.getElementById('food-carb').value)||0;
  var fat =parseFloat(document.getElementById('food-fat').value) ||0;
  if (!name) return;
  window.foodLog.push({id:Date.now(),name:name,kcal:kcal,prot:prot,carb:carb,fat:fat});
  localStorage.setItem('m_food',JSON.stringify(window.foodLog));
  renderFood();
  ['food-name','food-kcal','food-prot','food-carb','food-fat'].forEach(function(id){document.getElementById(id).value='';});
}

function deleteFood(id) {
  window.foodLog=window.foodLog.filter(function(f){return f.id!==id;});
  localStorage.setItem('m_food',JSON.stringify(window.foodLog));
  renderFood();
}

function renderFood() {
  var log=window.foodLog||[];
  var totals=log.reduce(function(a,b){return{kcal:a.kcal+b.kcal,prot:a.prot+b.prot,carb:a.carb+b.carb,fat:a.fat+b.fat};},{kcal:0,prot:0,carb:0,fat:0});
  var pct=Math.min(totals.kcal/TARGETS.kcal,1);
  var ring=document.getElementById('cal-ring');
  if(ring){ring.style.strokeDasharray='314';ring.style.strokeDashoffset=314*(1-pct);}
  var calEl=document.getElementById('cal-display'); if(calEl) calEl.textContent=Math.round(totals.kcal);
  var setBar=function(vid,bid,val,tgt){var ve=document.getElementById(vid);if(ve)ve.textContent=Math.round(val)+'g';var be=document.getElementById(bid);if(be)be.style.width=Math.min(val/tgt*100,100)+'%';};
  setBar('prot-val','prot-bar',totals.prot,TARGETS.prot);
  setBar('carb-val','carb-bar',totals.carb,TARGETS.carb);
  setBar('fat-val', 'fat-bar', totals.fat, TARGETS.fat);
  var list=document.getElementById('food-list'); if(!list) return;
  if(!log.length){list.innerHTML='<div class="empty-state">No foods logged yet.</div>';return;}
  list.innerHTML=log.map(function(f){return'<div class="food-item"><span class="food-item-name">'+f.name+'</span><span class="food-item-kcal">'+f.kcal+' kcal</span><button class="food-del" onclick="deleteFood('+f.id+')">x</button></div>';}).join('');
}

function addSet() {
  var ex=document.getElementById('set-exercise').value.trim();
  var wt=parseFloat(document.getElementById('set-weight').value)||0;
  var rp=parseInt(document.getElementById('set-reps').value)||0;
  if(!ex||!rp) return;
  window.setLog.push({id:Date.now(),exercise:ex,weight:wt,reps:rp});
  localStorage.setItem('m_sets',JSON.stringify(window.setLog));
  renderSets();
  ['set-weight','set-reps'].forEach(function(id){document.getElementById(id).value='';});
}

function deleteSet(id) {
  window.setLog=window.setLog.filter(function(s){return s.id!==id;});
  localStorage.setItem('m_sets',JSON.stringify(window.setLog));
  renderSets();
}

function renderSets() {
  var log=window.setLog||[];
  var totalVol=log.reduce(function(a,b){return a+b.weight*b.reps;},0);
  var uniqueEx=new Set(log.map(function(s){return s.exercise.toLowerCase();})).size;
  var se=document.getElementById('wk-sets');    if(se) se.textContent=log.length;
  var ve=document.getElementById('wk-vol');     if(ve) ve.textContent=totalVol;
  var xe=document.getElementById('wk-exs');     if(xe) xe.textContent=uniqueEx;
  var te=document.getElementById('vol-total-val'); if(te) te.textContent=totalVol+' kg';
  var list=document.getElementById('set-list'); if(!list) return;
  if(!log.length){list.innerHTML='<div class="empty-state">No sets logged yet.</div>';return;}
  list.innerHTML=log.map(function(s){return'<div class="set-row"><span class="set-exercise">'+s.exercise+'</span><span class="food-item-kcal">'+s.weight+'kg x '+s.reps+' = '+(s.weight*s.reps)+'kg</span><button class="set-del" onclick="deleteSet('+s.id+')">x</button></div>';}).join('');
}
