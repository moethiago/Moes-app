var TEAM_COLORS = {
  mercedes:'#00d2be', ferrari:'#e8002d', red_bull:'#3671c6',
  mclaren:'#ff8700', aston_martin:'#229971', alpine:'#0093cc',
  williams:'#64c4ff', rb:'#6692ff', kick_sauber:'#52e252', haas:'#b6babd'
};

var NEXT_RACE = {
  title:    'Canadian Grand Prix',
  location: 'Circuit Gilles Villeneuve, Montreal',
  date:     '2026-05-24T20:00:00Z'
};

var F1_STANDINGS_2026 = [
  { pos:1, num:12, name:'Antonelli', cid:'mercedes',     pts:100, wins:3 },
  { pos:2, num:63, name:'Russell',   cid:'mercedes',     pts:80,  wins:1 },
  { pos:3, num:16, name:'Leclerc',   cid:'ferrari',      pts:59,  wins:0 },
  { pos:4, num:4,  name:'Norris',    cid:'mclaren',      pts:51,  wins:0 },
  { pos:5, num:44, name:'Hamilton',  cid:'ferrari',      pts:51,  wins:0 },
  { pos:6, num:81, name:'Piastri',   cid:'mclaren',      pts:43,  wins:0 },
  { pos:7, num:14, name:'Alonso',    cid:'aston_martin', pts:24,  wins:0 },
  { pos:8, num:18, name:'Stroll',    cid:'aston_martin', pts:12,  wins:0 },
  { pos:9, num:10, name:'Gasly',     cid:'alpine',       pts:10,  wins:0 },
  { pos:10,num:55, name:'Sainz',     cid:'williams',     pts:9,   wins:0 },
];

function startCountdown() {
  var trackEl = document.getElementById('f1-next-track');
  var sessEl  = document.getElementById('f1-next-session');
  if (trackEl) trackEl.textContent = NEXT_RACE.title;
  if (sessEl)  sessEl.textContent  = NEXT_RACE.location;
  function tick() {
    var diff = Date.parse(NEXT_RACE.date) - Date.now();
    if (diff <= 0) { ['cd-days','cd-hours','cd-mins','cd-secs'].forEach(function(id) { var el=document.getElementById(id); if(el) el.textContent='00'; }); return; }
    var d=document.getElementById('cd-days'), h=document.getElementById('cd-hours'), m=document.getElementById('cd-mins'), s=document.getElementById('cd-secs');
    if(d) d.textContent=String(Math.floor(diff/86400000)).padStart(2,'0');
    if(h) h.textContent=String(Math.floor(diff%86400000/3600000)).padStart(2,'0');
    if(m) m.textContent=String(Math.floor(diff%3600000/60000)).padStart(2,'0');
    if(s) s.textContent=String(Math.floor(diff%60000/1000)).padStart(2,'0');
  }
  tick(); setInterval(tick, 1000);
}

function renderHardcodedStandings(body) {
  var maxPts = F1_STANDINGS_2026[0].pts;
  var html = '<div class="f1-std-header"><span>POS</span><span>NO</span><span>DRIVER</span><span style="text-align:right">W</span><span style="text-align:right">PTS</span></div>';
  F1_STANDINGS_2026.forEach(function(d) {
    var col=TEAM_COLORS[d.cid]||'#8a8fa8', barW=Math.round((d.pts/maxPts)*100), pc=d.pos===1?'p1':d.pos===2?'p2':d.pos===3?'p3':'';
    html += '<div class="f1-std-row">'
      + '<span class="f1-pos ' + pc + '">' + d.pos + '</span>'
      + '<span class="f1-num" style="background:' + col + '22;color:' + col + '">' + d.num + '</span>'
      + '<div class="f1-driver-info"><span class="f1-driver-name">' + d.name + '</span>'
      +   '<div class="f1-con-bar"><div class="f1-con-fill" style="width:' + barW + '%;background:' + col + '"></div></div></div>'
      + '<span class="f1-wins">' + d.wins + '</span>'
      + '<span class="f1-pts">' + d.pts + '</span></div>';
  });
  html += '<div class="f1-last-updated">After R4 Miami · May 19 2026</div>';
  body.innerHTML = html;
}

async function loadF1Data() {
  var body=document.getElementById('f1-standings-body'), roundEl=document.getElementById('f1-standings-round');
  if (!body) return;
  renderHardcodedStandings(body);
  if (roundEl) roundEl.textContent = '2026 · R4';
  try {
    var controller=new AbortController(), timer=setTimeout(function(){controller.abort();},5000);
    var res=await fetch('https://api.jolpi.ca/ergast/f1/current/driverstandings.json?limit=20',{signal:controller.signal});
    clearTimeout(timer);
    if (!res.ok) return;
    var data=await res.json();
    var sl=data&&data.MRData&&data.MRData.StandingsTable&&data.MRData.StandingsTable.StandingsLists[0];
    if (!sl||!sl.DriverStandings||!sl.DriverStandings.length) return;
    if (roundEl) roundEl.textContent='2026 · R'+sl.round;
    var drivers=sl.DriverStandings.slice(0,10), maxPts=parseFloat(drivers[0].points)||1;
    var html='<div class="f1-std-header"><span>POS</span><span>NO</span><span>DRIVER</span><span style="text-align:right">W</span><span style="text-align:right">PTS</span></div>';
    drivers.forEach(function(d) {
      var pos=parseInt(d.position), cid=d.Constructors&&d.Constructors[0]?d.Constructors[0].constructorId:'default';
      var col=TEAM_COLORS[cid]||'#8a8fa8', pts=parseFloat(d.points), barW=Math.round((pts/maxPts)*100), pc=pos===1?'p1':pos===2?'p2':pos===3?'p3':'';
      html+='<div class="f1-std-row"><span class="f1-pos '+pc+'">'+pos+'</span><span class="f1-num" style="background:'+col+'22;color:'+col+'">'+d.Driver.permanentNumber+'</span><div class="f1-driver-info"><span class="f1-driver-name">'+d.Driver.familyName+'</span><div class="f1-con-bar"><div class="f1-con-fill" style="width:'+barW+'%;background:'+col+'"></div></div></div><span class="f1-wins">'+d.wins+'</span><span class="f1-pts">'+pts+'</span></div>';
    });
    var t=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
    html+='<div class="f1-last-updated">Live · Jolpica F1 API · '+t+'</div>';
    body.innerHTML=html;
  } catch(e) {}
}

function loadFootballScores() {
  var container=document.getElementById('football-scores-container');
  if (!container) return;
  container.innerHTML='<div class="f1-api-loading"><div class="f1-spinner" style="border-top-color:var(--epl-green)"></div><span>Loading matches...</span></div>';
  setTimeout(function() {
    var matches=[
      {league:'PREMIER LEAGUE',status:'Today 21:30',type:'soon',t1:'Bournemouth',s1:null,t2:'Man City',s2:null,events:'Kick-off soon · City favoured'},
      {league:'PREMIER LEAGUE',status:'Today 22:15',type:'soon',t1:'Chelsea',s1:null,t2:'Tottenham',s2:null,events:'London derby · Euro spots at stake'},
      {league:'PREMIER LEAGUE',status:'FT · Mon 18',type:'ft',t1:'Arsenal',s1:1,t2:'Burnley',s2:0,events:'Arsenal strengthen title push'},
      {league:'PREMIER LEAGUE',status:'FT · Sun 17',type:'ft',t1:'Newcastle',s1:3,t2:'West Ham',s2:1,events:"Isak 2', Gordon 55', Guimaraes 78'"},
      {league:'LA LIGA',status:'FT · Sun 17',type:'ft',t1:'Real Madrid',s1:1,t2:'Sevilla',s2:0,events:"Bellingham 34'"},
      {league:'LA LIGA',status:'FT · Sun 17',type:'ft',t1:'Barcelona',s1:3,t2:'Real Betis',s2:1,events:"Yamal 22', Lewandowski 55', 78'"},
    ];
    var html='';
    matches.forEach(function(m) {
      var scoreHtml=m.s1===null
        ?'<span style="font-family:\'JetBrains Mono\',monospace;font-size:11px;color:var(--txt-muted);">vs</span>'
        :'<span style="font-family:\'JetBrains Mono\',monospace;font-size:20px;font-weight:700;color:#fff;">'+m.s1+' - '+m.s2+'</span>';
      html+='<div class="live-match-box"><div class="live-meta-row"><span class="league-badge">'+m.league+'</span><span class="live-status-pill '+m.type+'-game">'+m.status+'</span></div><div style="display:flex;align-items:center;justify-content:space-between;margin:4px 0;"><div><div class="live-team-name">'+m.t1+'</div><div class="live-team-name" style="margin-top:4px;">'+m.t2+'</div></div>'+scoreHtml+'</div><div class="live-match-events">'+m.events+'</div></div>';
    });
    container.innerHTML=html;
  },300);
}
