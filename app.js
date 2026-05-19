const F1_BASE='https://api.jolpi.ca/ergast/f1';

let foodLog=[];
let setLog=[];
let currentFilter='ALL';

document.addEventListener('DOMContentLoaded',()=>{
loadNewsFeed();
loadFootballScores();
loadF1Data();
startClock();
startCountdown();
});

function switchTab(tab){
document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
document.getElementById('panel-'+tab).classList.add('active');
}

function startClock(){
setInterval(()=>{
document.getElementById('clock').textContent=new Date().toTimeString().slice(0,5);
},1000);
}

function startCountdown(){
const race=new Date(Date.now()+100000000);
setInterval(()=>{
const diff=race-Date.now();
document.getElementById('cd-days').textContent=Math.floor(diff/86400000);
document.getElementById('cd-hours').textContent=Math.floor(diff%86400000/3600000);
document.getElementById('cd-mins').textContent=Math.floor(diff%3600000/60000);
document.getElementById('cd-secs').textContent=Math.floor(diff%60000/1000);
},1000);
}

async function loadF1Data(){
document.getElementById('f1-standings-body').innerHTML='Loading...';
try{
const res=await fetch(F1_BASE+'/current/driverstandings.json');
const data=await res.json();
document.getElementById('f1-standings-body').innerHTML=JSON.stringify(data).slice(0,500);
}catch(e){}
}

function loadFootballScores(){
document.getElementById('football-scores-container').innerHTML='Loading...';
setTimeout(()=>{document.getElementById('football-scores-container').innerHTML='Matches';},500);
}

function loadNewsFeed(){
document.getElementById('critical-posts').innerHTML='Loading...';
setTimeout(()=>{document.getElementById('critical-posts').innerHTML='News loaded';},500);
}

function addFood(){
foodLog.push({id:Date.now(),name:document.getElementById('food-name').value});
renderFood();
}

function renderFood(){
document.getElementById('food-list').innerHTML=foodLog.map(f=>`<div>${f.name}</div>`).join('');
}

function addSet(){
setLog.push({id:Date.now(),ex:document.getElementById('set-exercise').value});
renderSets();
}

function renderSets(){
document.getElementById('set-list').innerHTML=setLog.map(s=>`<div>${s.ex}</div>`).join('');
}