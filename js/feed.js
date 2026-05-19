// ── FEED.JS ─────────────────────────────────────────────
// Channels: F1, Football (Top 5), Bayern, Saudi Football, Saudi Major News
// Each category is independent — add/remove without touching others

var currentFilter = 'ALL';
var parsedStoriesCache = [];

var MASTER_CHANNELS = [
  // F1
  { name:'BBC F1',          url:'https://feeds.bbci.co.uk/sport/formula1/rss.xml',             cat:'F1' },
  { name:'Sky F1',          url:'https://www.skysports.com/rss/12040',                         cat:'F1' },
  { name:'Autosport',       url:'https://www.autosport.com/rss/f1/news/',                       cat:'F1' },
  { name:'RaceFans',        url:'https://www.racefans.net/feed/',                               cat:'F1' },
  { name:'The Race',        url:'https://the-race.com/feed/',                                   cat:'F1' },
  // Football
  { name:'BBC Sport',       url:'https://feeds.bbci.co.uk/sport/football/rss.xml',             cat:'FOOTBALL' },
  { name:'Sky Sports',      url:'https://www.skysports.com/rss/11095',                         cat:'FOOTBALL' },
  { name:'Guardian PL',     url:'https://www.theguardian.com/football/premierleague/rss',      cat:'FOOTBALL' },
  { name:'Guardian LaLiga', url:'https://www.theguardian.com/football/laliga/rss',             cat:'FOOTBALL' },
  { name:'Guardian Serie A',url:'https://www.theguardian.com/football/serieafootball/rss',    cat:'FOOTBALL' },
  { name:'Guardian Bund',   url:'https://www.theguardian.com/football/bundesligafootball/rss', cat:'FOOTBALL' },
  { name:'Guardian L1',     url:'https://www.theguardian.com/football/ligue1football/rss',     cat:'FOOTBALL' },
  { name:'ESPN FC',         url:'https://www.espn.com/espn/rss/soccer/news',                   cat:'FOOTBALL' },
  // Bayern
  { name:'Bayern – BBC',    url:'https://feeds.bbci.co.uk/sport/football/rss.xml',             cat:'BAYERN', filter:'Bayern' },
  { name:'Bayern – Guard',  url:'https://www.theguardian.com/football/bundesligafootball/rss', cat:'BAYERN', filter:'Bayern' },
  // Saudi Football
  { name:'Arab News Sport', url:'https://www.arabnews.com/cat/5/rss.xml',                      cat:'SPL' },
  { name:'Saudi Gazette',   url:'https://saudigazette.com.sa/feed',                            cat:'SPL' },
  // Saudi Major News
  { name:'Saudi Press',     url:'https://www.spa.gov.sa/rss/rss.php?l=en',                    cat:'KSA' },
  { name:'Arab News',       url:'https://www.arabnews.com/rss.xml',                            cat:'KSA' },
  { name:'Argaam',          url:'https://www.argaam.com/en/rss',                               cat:'KSA' },
];

var F1_KEEP       = /win|winner|pole|penalt|crash|dnf|retire|disqualif|contract|sign|swap|transfer|ruling|fia|champion|ban|incident|investigat|fastest lap/i;
var FOOTBALL_KEEP = /sack|fired|resign|transfer|sign|injur|suspend|ban|red card|title|champion|relegat|derb|result|win|loss|defeat|final|semifinal|playoff/i;
var FOOTBALL_JUNK = /fantasy|predicted lineup|five things|player ratings|watch live|how to watch|betting odds|quiz|power ranking/i;
var BAYERN_KEEP   = /transfer|sign|injur|absent|lineup|squad|contract|sack|manag|coach|champion|ban|suspend|ruling|official|announce/i;
var SPL_KEEP      = /transfer|sign|sack|manag|title|champion|relegat|derb|disciplin|ban|suspend|ruling|contract|result|win|ronaldo|neymar|benzema|mane/i;
var KSA_KEEP      = /decree|royal|minister|giga|neom|vision 2030|pif|invest|regulat|reform|gdp|economic|infrastructure|launch|announce|billion|sovereign|market|ipo/i;
var KSA_JUNK      = /ceremony|ribbon|visit|tour|festival|fashion|celebrat|inaugurat|honorary/i;

var KEY_ENTITIES = [
  'Hamilton','Verstappen','Norris','Leclerc','Russell','Antonelli','Piastri','Alonso','Sainz','Perez',
  'Red Bull','McLaren','Ferrari','Mercedes','Aston Martin','Alpine','Williams',
  'Arsenal','Man City','Liverpool','Chelsea','Tottenham','Man United','Newcastle',
  'Real Madrid','Barcelona','Atletico','Bayern','Dortmund','PSG','Juventus','Inter','Milan','Napoli',
  'Al Hilal','Al Nassr','Al Ittihad','Al Ahli',
  'Ronaldo','Neymar','Benzema','Mane',
  'Guardiola','Klopp','Ancelotti','Mourinho','Tuchel','Conte',
  'Vision 2030','PIF','NEOM','Saudi Aramco',
];

// ── FALLBACK_NEWS — updated automatically by GitHub Action every hour ──
// DO NOT EDIT BELOW THIS LINE
var FALLBACK_NEWS = [
  {title:'Montoya demands penalties for drivers disrespecting F1',src:'BBC F1',cat:'F1',link:'https://www.bbc.com/sport/formula1/videos/cg5p2jvlem9o?at_medium=RSS&at_campaign=rss',date:'May 4'},
  {title:'-I love winning when there is massive competition-',src:'BBC F1',cat:'F1',link:'https://www.bbc.com/sport/formula1/videos/c04xwlvq2nwo?at_medium=RSS&at_campaign=rss',date:'Apr 24'},
  {title:'F1 bosses agree to engine design change for 2027',src:'BBC F1',cat:'F1',link:'https://www.bbc.com/sport/formula1/articles/c8jvee3x3wro?at_medium=RSS&at_campaign=rss',date:'May 8'},
  {title:'Antonelli wins in Miami to extend title lead',src:'BBC F1',cat:'F1',link:'https://www.bbc.com/sport/formula1/articles/cx21n879zlxo?at_medium=RSS&at_campaign=rss',date:'May 3'},
  {title:'Antonelli on Miami pole from revived Verstappen',src:'BBC F1',cat:'F1',link:'https://www.bbc.com/sport/formula1/articles/c2k20z83yxxo?at_medium=RSS&at_campaign=rss',date:'May 2'},
  {title:'Norris takes dominant win in Miami sprint race',src:'BBC F1',cat:'F1',link:'https://www.bbc.com/sport/formula1/articles/cx217qz4rpzo?at_medium=RSS&at_campaign=rss',date:'May 2'},
  {title:'Southampton expelled from Championship play-offs',src:'Sky F1',cat:'F1',link:'https://www.skysports.com/football/news/12040/13545415/southampton-expelled-from-championship-play-offs-over-spygate-with-middlesbrough-reinstated',date:'May 19'},
  {title:'-Relief!- - Woodhouse beats Gilding to win first PDC title',src:'Sky F1',cat:'F1',link:'https://www.skysports.com/darts/news/12040/13545986/luke-woodhouse-wins-first-pdc-title-after-beating-andrew-gilding-in-players-championship-18-final-in-leicester',date:'May 19'},
  {title:'Borthwick: Itoje may need to miss Nations Championship to rest',src:'Sky F1',cat:'F1',link:'https://www.skysports.com/rugby-union/news/12040/13545830/maro-itoje-england-head-coach-steve-borthwick-says-captain-may-need-to-miss-inaugural-nations-championship-and-clash-vs-springboks-to-rest',date:'May 19'},
  {title:'Lima receives 24-day ban for whip misuse',src:'Sky F1',cat:'F1',link:'https://www.skysports.com/racing/news/12040/13545971/york-jockey-diego-lima-receives-24-day-ban-for-misuse-of-whip-aboard-ranting-duke',date:'May 19'},
  {title:'Former FIA aero chief officially joins Alpine in senior F1 role',src:'Autosport',cat:'F1',link:'https://www.autosport.com/f1/news/former-fia-aero-chief-officially-joins-alpine-in-senior-f1-role/10820964/?utm_source=RSS&utm_medium=referral&utm_campaign=RSS-F1&utm_term=News&utm_content=uk',date:'May 15'},
  {title:'Brown writes to FIA over Mercedes-Alpine ownership concerns',src:'Autosport',cat:'F1',link:'https://www.autosport.com/f1/news/zak-brown-takes-fia-fight-over-mercedes-alpine-f1-talks-public/10820815/?utm_source=RSS&utm_medium=referral&utm_campaign=RSS-F1&utm_term=News&utm_content=uk',date:'May 14'},
  {title:'FIA announces 2027 F1 rule changes for combustion and electrical output',src:'Autosport',cat:'F1',link:'https://www.autosport.com/f1/news/fia-reveals-latest-tweaks-to-f1-rules-for-2027-season/10819143/?utm_source=RSS&utm_medium=referral&utm_campaign=RSS-F1&utm_term=News&utm_content=uk',date:'May 8'},
  {title:'Honda gets extra F1 power unit help after FIA tweaks rules',src:'Autosport',cat:'F1',link:'https://www.autosport.com/f1/news/honda-gets-extra-f1-power-unit-help-after-fia-tweaks-cost-cap-rules/10819084/?utm_source=RSS&utm_medium=referral&utm_campaign=RSS-F1&utm_term=News&utm_content=uk',date:'May 8'},
  {title:'Sky Sports extends F1 live broadcast contract',src:'Autosport',cat:'F1',link:'https://www.autosport.com/f1/news/sky-sports-extends-f1-live-broadcast-contract/10818609/?utm_source=RSS&utm_medium=referral&utm_campaign=RSS-F1&utm_term=News&utm_content=uk',date:'May 6'},
  {title:'Wolff: Poor starts “not acceptable” if Mercedes wants to win F1 world titles',src:'Autosport',cat:'F1',link:'https://www.autosport.com/f1/news/toto-wolff-mercedes-poor-starts-not-acceptable-if-we-want-to-win-f1-world-titles/10818317/?utm_source=RSS&utm_medium=referral&utm_campaign=RSS-F1&utm_term=News&utm_content=uk',date:'May 5'},
  {title:'Round-up: Verstappen’s Nuerburging 24hr bid ends in retirement, Palou on Indy 500 pole | RaceFans Round-up',src:'RaceFans',cat:'F1',link:'https://www.racefans.net/2026/05/18/round-up-18th-may-2026/',date:'May 17'},
  {title:'There’s one 2026 change Verstappen will approve of: Zero penalty points | Formula 1',src:'RaceFans',cat:'F1',link:'https://www.racefans.net/2026/05/14/theres-one-2026-change-verstappen-will-approve-of-zero-penalty-points/',date:'May 14'},
  {title:'Zarco must wait for ligament surgery after horrific MotoGP crash',src:'The Race',cat:'F1',link:'https://www.the-race.com/motogp/johann-zarco-ligament-surgery-wait-horrific-barcelona-motogp-crash/',date:'May 19'},
  {title:'Isle of Man TT statistics: Win records, lap records and more',src:'The Race',cat:'F1',link:'https://www.the-race.com/tt/isle-of-man-tt-statistics-win-records-lap-records-more/',date:'May 19'},
  {title:'Winners and losers from 2026 Nurburgring 24 Hours',src:'The Race',cat:'F1',link:'https://www.the-race.com/gt/winners-losers-from-2026-nurburgring-24-hours/',date:'May 18'},
  {title:'Martin taken to hospital after Barcelona test crash',src:'The Race',cat:'F1',link:'https://www.the-race.com/motogp/martin-taken-to-hospital-after-barcelona-test-crash/',date:'May 18'},
  {title:'Winners and losers from Formula E-s Monaco races',src:'The Race',cat:'F1',link:'https://www.the-race.com/formula-e/winners-and-losers-from-formula-es-monaco-races/',date:'May 18'},
  {title:'GP winner Di Giannantonio pulls out of test in crash aftermath',src:'The Race',cat:'F1',link:'https://www.the-race.com/motogp/gp-winner-di-giannantonio-pulls-out-of-test-to-recover/',date:'May 18'},
  {title:'Women-s coach given lifetime ban for secret filming',src:'BBC Sport',cat:'FOOTBALL',link:'https://www.bbc.com/sport/football/articles/cm2p1pl13j0o?at_medium=RSS&at_campaign=rss',date:'May 19'},
  {title:'TNT opts not to make European finals free to watch',src:'BBC Sport',cat:'FOOTBALL',link:'https://www.bbc.com/sport/football/articles/c98rnme5ly7o?at_medium=RSS&at_campaign=rss',date:'May 19'},
  {title:'The games that defined Guardiola-s Premier League titles',src:'BBC Sport',cat:'FOOTBALL',link:'https://www.bbc.com/sport/football/videos/cj9pyggdxmjo?at_medium=RSS&at_campaign=rss',date:'May 19'},
  {title:'Arsenal one step closer to title after hard-fought win over Burnley',src:'BBC Sport',cat:'FOOTBALL',link:'https://www.bbc.com/sport/football/videos/cwy2p7xyr2lo?at_medium=RSS&at_campaign=rss',date:'May 18'},
  {title:'Relegations, a final and Battle of Bridge - the Spurs-Chelsea rivalry',src:'BBC Sport',cat:'FOOTBALL',link:'https://www.bbc.com/sport/football/articles/c4g5qrnln9do?at_medium=RSS&at_campaign=rss',date:'May 19'},
  {title:'-Miles away- - Havertz -lucky- to avoid red card',src:'BBC Sport',cat:'FOOTBALL',link:'https://www.bbc.com/sport/football/articles/c8d8yge72qyo?at_medium=RSS&at_campaign=rss',date:'May 18'},
  {title:'Kroupi stunner gives Bournemouth lead vs City as Arsenal close in on title LIVE!',src:'Sky Sports',cat:'FOOTBALL',link:'https://www.skysports.com/football/bournemouth-vs-manchester-city/live/531491',date:'May 19'},
  {title:'Southampton expelled from Championship play-offs',src:'Sky Sports',cat:'FOOTBALL',link:'https://www.skysports.com/football/news/11095/13545415/southampton-expelled-from-championship-play-offs-over-spygate-with-middlesbrough-reinstated',date:'May 19'},
  {title:'How PL title, relegation and Liverpool-s CL place can be decided tonight',src:'Sky Sports',cat:'FOOTBALL',link:'https://www.skysports.com/football/news/11095/13545823/premier-league-permutations-how-arsenal-can-win-title-tottenham-relegate-west-ham-and-liverpool-secure-champions-league-on-tuesday-night',date:'May 19'},
  {title:'Bowen: West Ham relegation worries were -starting to creep in- last season',src:'Sky Sports',cat:'FOOTBALL',link:'https://www.skysports.com/football/news/11095/13545923/jarrod-bowen-west-ham-captain-says-premier-league-relegation-worries-were-starting-to-creep-in-last-season',date:'May 19'},
  {title:'Transfer Centre LIVE! -Maresca to become new Man City boss on three-year deal-',src:'Sky Sports',cat:'FOOTBALL',link:'https://www.skysports.com/football/live-blog/11095/12476234/transfer-centre-live-football-transfer-news-updates-and-rumours',date:'May 19'},
  {title:'Villa latest: Emery confirms Onana is in full training ahead of EL final',src:'Sky Sports',cat:'FOOTBALL',link:'https://www.skysports.com/football/live-blog/11095/13025491/aston-villa-transfer-news-rumours-and-gossip-live-updates-and-latest-on-deals-signings-loans-and-contracts',date:'May 19'},
  {title:'Bournemouth v Manchester City: Arsenal can win Premier League if visitors slip up as Guardiola heads for exit – live',src:'Guardian PL',cat:'FOOTBALL',link:'https://www.theguardian.com/football/live/2026/may/19/bournemouth-v-manchester-city-premier-league-live-pep-guardiola-arsenal',date:'May 19'},
  {title:'Kai Havertz header edges nervy Arsenal past Burnley and one step from title',src:'Guardian PL',cat:'FOOTBALL',link:'https://www.theguardian.com/football/2026/may/18/arsenal-burnley-premier-league-match-report',date:'May 18'},
  {title:'Manchester City win FA Cup and Hearts heartbreak at Celtic | Football Weekly video',src:'Guardian PL',cat:'FOOTBALL',link:'https://www.theguardian.com/football/video/2026/may/18/manchester-city-win-fa-cup-and-hearts-heartbreak-at-celtic-football-weekly-video',date:'May 18'},
  {title:'Premier League and FA Cup final: 10 talking points from the weekend’s action',src:'Guardian PL',cat:'FOOTBALL',link:'https://www.theguardian.com/football/2026/may/18/premier-league-and-fa-cup-final-10-talking-points-from-the-weekends-action',date:'May 18'},
  {title:'Calvert-Lewin pounces late for Leeds to hit Brighton’s European ambitions',src:'Guardian PL',cat:'FOOTBALL',link:'https://www.theguardian.com/football/2026/may/17/leeds-brighton-premier-league-match-report',date:'May 17'},
  {title:'‘It defies belief’: West Ham and Tottenham fans fume amid relegation dread',src:'Guardian PL',cat:'FOOTBALL',link:'https://www.theguardian.com/football/2026/may/16/west-ham-tottenham-fans-fume-amid-relegation-panic-picture-essay',date:'May 16'},
  {title:'Cult hero Mancini delivers derby win for Roma after Serie A scheduling nightmare | Nicky Bandini',src:'Guardian Serie A',cat:'FOOTBALL',link:'https://www.theguardian.com/football/2026/may/18/roma-lazio-rome-derby-serie-a',date:'May 18'},
  {title:'Inter poised as Curtis Jones enters final year of Liverpool contract',src:'Guardian Serie A',cat:'FOOTBALL',link:'https://www.theguardian.com/football/2026/may/17/inter-poised-as-curtis-jones-enters-final-year-of-liverpool-contract',date:'May 17'},
  {title:'European football: Roma close to Champions League return after beating Lazio',src:'Guardian Serie A',cat:'FOOTBALL',link:'https://www.theguardian.com/football/2026/may/17/european-football-roma-lazio-milan-juventus-napoli',date:'May 17'},
  {title:'Maldini’s ghost hangs over uninspiring Milan as top-four place slips from view | Nicky Bandini',src:'Guardian Serie A',cat:'FOOTBALL',link:'https://www.theguardian.com/football/2026/may/11/ac-milan-serie-a-champions-league-paolo-maldini',date:'May 11'},
  {title:'European football: Doué’s late winner takes PSG to verge of Ligue 1 title',src:'Guardian Serie A',cat:'FOOTBALL',link:'https://www.theguardian.com/football/2026/may/10/european-football-como-psg-roma-milan',date:'May 10'},
  {title:'European football: Olise fires Bayern’s winner against Wolfsburg after Kane misses penalty',src:'Guardian Serie A',cat:'FOOTBALL',link:'https://www.theguardian.com/football/2026/may/09/european-football-olise-fires-bayerns-winner-against-wolfsburg-after-kane-misses-penalty',date:'May 9'},
  {title:'St Pauli’s Bundesliga dream dies as Eriksen inspires Wolfsburg in relegation thriller | Andy Brassell',src:'Guardian Bund',cat:'FOOTBALL',link:'https://www.theguardian.com/football/2026/may/18/bundesliga-st-pauli-wolfsburg-relegation-thriller-christian-eriksen',date:'May 18'},
  {title:'European football: Kane uncorks title party with hat-trick; Lewandowski to leave Barça',src:'Guardian Bund',cat:'FOOTBALL',link:'https://www.theguardian.com/football/2026/may/16/robert-lewandowski-barcelona-real-madrid-bundesliga-european-roundup',date:'May 16'},
  {title:'European football: Doué’s late winner takes PSG to verge of Ligue 1 title',src:'Guardian Bund',cat:'FOOTBALL',link:'https://www.theguardian.com/football/2026/may/10/european-football-como-psg-roma-milan',date:'May 10'},
  {title:'European football: Olise fires Bayern’s winner against Wolfsburg after Kane misses penalty',src:'Guardian Bund',cat:'FOOTBALL',link:'https://www.theguardian.com/football/2026/may/09/european-football-olise-fires-bayerns-winner-against-wolfsburg-after-kane-misses-penalty',date:'May 9'},
  {title:'European football: Barcelona close on La Liga title; PSG and Bayern held at home',src:'Guardian Bund',cat:'FOOTBALL',link:'https://www.theguardian.com/football/2026/may/02/european-football-psg-drop-ligue-1-points-to-lorient-with-minds-on-bayern-tie',date:'May 2'},
  {title:'European football: Kane seals epic Bayern comeback as Barcelona surge towards title',src:'Guardian Bund',cat:'FOOTBALL',link:'https://www.theguardian.com/football/2026/apr/25/european-football-bayern-munich-barcelona-psg',date:'Apr 25'},
  {title:'Nice fans direct fury at owners as club falls into Ligue 1 relegation playoff',src:'Guardian L1',cat:'FOOTBALL',link:'https://www.theguardian.com/football/2026/may/18/nice-fans-direct-fury-owners-club-falls-ligue-1-relegation-playoff-champions-league-inoes',date:'May 18'},
  {title:'European football: Roma close to Champions League return after beating Lazio',src:'Guardian L1',cat:'FOOTBALL',link:'https://www.theguardian.com/football/2026/may/17/european-football-roma-lazio-milan-juventus-napoli',date:'May 17'},
  {title:'PSG are deserved Ligue 1 champions but Lens put up an admirable fight | Raphaël Jucobin',src:'Guardian L1',cat:'FOOTBALL',link:'https://www.theguardian.com/football/2026/may/14/psg-ligue-1-champions-lens-pierre-sage-coupe-de-france',date:'May 14'},
  {title:'European football: Kvaratskhelia powers PSG to Ligue 1 title at Lens',src:'Guardian L1',cat:'FOOTBALL',link:'https://www.theguardian.com/football/2026/may/13/european-football-khvicha-kvaratskhelia-powers-psg-to-ligue-1-title-at-lens',date:'May 13'},
  {title:'European football: Doué’s late winner takes PSG to verge of Ligue 1 title',src:'Guardian L1',cat:'FOOTBALL',link:'https://www.theguardian.com/football/2026/may/10/european-football-como-psg-roma-milan',date:'May 10'},
  {title:'European football: Olise fires Bayern’s winner against Wolfsburg after Kane misses penalty',src:'Guardian L1',cat:'FOOTBALL',link:'https://www.theguardian.com/football/2026/may/09/european-football-olise-fires-bayerns-winner-against-wolfsburg-after-kane-misses-penalty',date:'May 9'},
  {title:'Copy of Follow live: Man City trail in must-win game; Spur...',src:'ESPN FC',cat:'FOOTBALL',link:'https://www.espn.com/soccer/scoreboard/_/league/eng.1',date:'May 19'},
  {title:'Southampton expelled from EFL playoffs for spying',src:'ESPN FC',cat:'FOOTBALL',link:'https://www.espn.com/soccer/story/_/id/48818048/southampton-expelled-championship-playoffs-spygate-middlesbrough',date:'May 19'},
  {title:'Neymar named in Brazil final World Cup squad',src:'ESPN FC',cat:'FOOTBALL',link:'https://www.espn.com/soccer/story/_/id/48809277/neymar-makes-cut-brazil-announce-final-26-man-world-cup-squad',date:'May 19'},
  {title:'Transfer rumors, news: Man United linked with Dort...',src:'ESPN FC',cat:'FOOTBALL',link:'https://www.espn.com/soccer/story/_/id/48813438/transfer-rumors-news-man-united-linked-dortmund-duo',date:'May 19'},
  {title:'VAR review: Arsenal should-ve received a red card ...',src:'ESPN FC',cat:'FOOTBALL',link:'https://www.espn.com/soccer/story/_/id/48809592/var-review-arsenal-shouldve-got-red-card-crucial-win-burnley',date:'May 19'}
];
// DO NOT EDIT ABOVE THIS LINE

function isHighImpact(title, cat, channelFilter) {
  if (channelFilter && title.toLowerCase().indexOf(channelFilter.toLowerCase()) === -1) return false;
  if (cat === 'F1')       return F1_KEEP.test(title);
  if (cat === 'FOOTBALL') return FOOTBALL_KEEP.test(title) && !FOOTBALL_JUNK.test(title);
  if (cat === 'BAYERN')   return BAYERN_KEEP.test(title);
  if (cat === 'SPL')      return SPL_KEEP.test(title);
  if (cat === 'KSA')      return KSA_KEEP.test(title) && !KSA_JUNK.test(title);
  return true;
}

function setFeedFilter(cat, el) {
  currentFilter = cat;
  document.querySelectorAll('.fpill').forEach(function(p) { p.classList.remove('active'); });
  if (el) el.classList.add('active');
  renderNewsFeed();
}

function timeAgo(val) {
  if (typeof val === 'string') return val;
  var diff = (Date.now() - val) / 1000;
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  return Math.floor(diff / 86400) + 'd ago';
}

function boldEntities(text) {
  KEY_ENTITIES.forEach(function(ent) {
    text = text.replace(new RegExp('\\b' + ent + '\\b', 'gi'), '<strong>$&</strong>');
  });
  return text;
}

function makeWireItem(title, src, timeVal, link) {
  return '<div class="wire-item" onclick="window.open(\'' + link + '\',\'_blank\')">'
    + '<span class="wire-bullet">•</span>'
    + '<div class="wire-content">'
    +   '<p class="wire-headline">' + boldEntities(title) + '</p>'
    +   '<div class="wire-meta">'
    +     '<span class="wire-source">' + src + '</span>'
    +     '<span class="wire-time">' + timeAgo(timeVal) + '</span>'
    +   '</div>'
    + '</div>'
    + '</div>';
}

function setTickerContent(titles) {
  var track = document.getElementById('ticker');
  if (!track || !titles.length) return;
  var items = titles.slice(0, 10).map(function(t) {
    return '<span class="ticker-item">• ' + t.substring(0, 80) + '</span>';
  }).join('');
  track.innerHTML = items + items;
}

function renderNewsFeed() {
  var container = document.getElementById('critical-posts');
  if (!container) return;

  var source = parsedStoriesCache.length ? parsedStoriesCache : FALLBACK_NEWS;
  var filtered = currentFilter === 'ALL'
    ? source
    : source.filter(function(s) { return s.cat === currentFilter; });

  var shown = filtered.slice(0, 30);
  if (!shown.length) {
    container.innerHTML = '<div class="empty-state">Tap REFRESH to load latest headlines</div>';
    return;
  }

  var html = '';
  shown.forEach(function(s) {
    html += makeWireItem(s.title, s.src, s.time || s.date || 'Today', s.link);
  });
  container.innerHTML = html;
  setTickerContent(shown.map(function(s) { return s.title; }));
}

async function fetchRSS(channel) {
  try {
    var controller = new AbortController();
    var timer = setTimeout(function() { controller.abort(); }, 7000);
    var res = await fetch(
      'https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(channel.url) + '&count=15',
      { signal: controller.signal }
    );
    clearTimeout(timer);
    var d = await res.json();
    if (d.status === 'ok' && d.items && d.items.length) return d.items;
  } catch(e) {}
  return [];
}

async function loadNewsFeed() {
  parsedStoriesCache = [];
  for (var i = 0; i < MASTER_CHANNELS.length; i++) {
    var ch = MASTER_CHANNELS[i];
    try {
      var items = await fetchRSS(ch);
      for (var j = 0; j < items.length; j++) {
        var item = items[j];
        if (!item.title) continue;
        var title = item.title.replace(/[\r\n]+/g, ' ').trim();
        if (!isHighImpact(title, ch.cat, ch.filter)) continue;
        parsedStoriesCache.push({
          title: title,
          link:  item.link || '#',
          time:  item.pubDate ? Date.parse(item.pubDate) : Date.now(),
          cat:   ch.cat,
          src:   ch.name
        });
      }
    } catch(e) {}
  }
  parsedStoriesCache.sort(function(a, b) { return b.time - a.time; });
  if (parsedStoriesCache.length) renderNewsFeed();
}
