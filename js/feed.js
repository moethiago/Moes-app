// ── FEED.JS ─────────────────────────────────────────────
// Channels: F1, Football (Top 5), Bayern, Saudi Football, Saudi Major News
// Each category is independent — add/remove without touching others

var currentFilter = 'ALL';
var parsedStoriesCache = [];

var MASTER_CHANNELS = [
  // F1 — dedicated feeds only
  {'url':'https://feeds.bbci.co.uk/sport/formula1/rss.xml',            'name':'BBC F1',                'cat':'F1'},
  {'url':'https://www.autosport.com/rss/f1/news/',                      'name':'Autosport',             'cat':'F1'},
  // Football — Top 5 leagues
  {'url':'https://feeds.bbci.co.uk/sport/football/rss.xml',            'name':'BBC Sport',             'cat':'FOOTBALL'},
  {'url':'https://www.theguardian.com/football/premierleague/rss',     'name':'Guardian PL',           'cat':'FOOTBALL'},
  {'url':'https://www.theguardian.com/football/laliga/rss',            'name':'Guardian LaLiga',       'cat':'FOOTBALL'},
  {'url':'https://www.theguardian.com/football/serieafootball/rss',    'name':'Guardian Serie A',      'cat':'FOOTBALL'},
  {'url':'https://www.theguardian.com/football/bundesligafootball/rss','name':'Guardian Bund',         'cat':'FOOTBALL'},
  {'url':'https://www.theguardian.com/football/ligue1football/rss',    'name':'Guardian L1',           'cat':'FOOTBALL'},
  {'url':'https://www.espn.com/espn/rss/soccer/news',                  'name':'ESPN FC',               'cat':'FOOTBALL'},
  // Bayern — dedicated feeds only
  {'url':'https://fcbayern.com/en/api/rss/content',                    'name':'Bayern Official',       'cat':'BAYERN'},
  {'url':'https://www.bavarianfootballworks.com/rss/current.xml',      'name':'Bavarian Football Works','cat':'BAYERN'},
  // Saudi Football — dedicated feeds only
  {'url':'https://www.arabnews.com/saudi-football/rss.xml',           'name':'Arab News SPL',         'cat':'SPL'},
  {'url':'https://www.goal.com/en-sa/rss/news',                       'name':'Goal Saudi',            'cat':'SPL'},
  // Saudi Major News — dedicated feeds only
  {'url':'https://www.arabnews.com/saudi-arabia/rss.xml',             'name':'Arab News KSA',         'cat':'KSA'},
  {'url':'https://www.arabnews.com/economy/rss.xml',                  'name':'Arab News Economy',     'cat':'KSA'},
];

var F1_JUNK       = /motogp|moto gp|indycar|isle of man|nascar|wrc|rally|superbike|rugby|cricket|tennis|golf|boxing|football|soccer|premier league/i;
var FOOTBALL_KEEP = /sack(ed)?|fired|resign|transfer|sign(ed|ing)?|injur|suspend|ban(ned)?|red card|\btitle\b|champion|relegat|derb|match report|\bwin(s)?\b|\bloss\b|defeat|final|semifinal|playoff|expel/i;
var FOOTBALL_JUNK = /fantasy|predicted lineup|five things|player ratings|watch live|how to watch|betting|quiz|power ranking|player of|talking points|gallery|photo|ranked|darts|cricket|rugby|tennis|golf|boxing/i;
var BAYERN_JUNK   = /women|youth|reserve|u17|u19|u21|amateure/i;
var SPL_JUNK      = /cricket|rugby|tennis|golf|boxing|motorsport|formula/i;
var KSA_KEEP      = /decree|royal|minister|giga|neom|vision 2030|pif|\binvest|\bregulat|reform|\bgdp\b|economic|infrastructure|launch|announce|billion|sovereign|market|\bipo\b|fund|policy|project/i;
var KSA_JUNK      = /ceremony|ribbon|visit|tour|festival|fashion|celebrat|inaugurat|honorary|attend|sport|football|cricket|tennis/i;

var KEY_ENTITIES = [
  'Hamilton','Verstappen','Norris','Leclerc','Russell','Antonelli','Piastri','Alonso','Sainz','Perez',
  'Red Bull','McLaren','Ferrari','Mercedes','Aston Martin','Alpine','Williams',
  'Arsenal','Man City','Liverpool','Chelsea','Tottenham','Man United','Newcastle',
  'Real Madrid','Barcelona','Atletico','Bayern','Dortmund','PSG','Juventus','Inter','Milan','Napoli',
  'Al Hilal','Al Nassr','Al Ittihad','Al Ahli',
  'Ronaldo','Neymar','Benzema','Mane','Salah','Haaland','Mbappe','Bellingham','Kane',
  'Guardiola','Klopp','Ancelotti','Mourinho','Tuchel','Conte','Arteta',
  'Vision 2030','PIF','NEOM','Saudi Aramco',
];

var ENTITIES_LOWER = KEY_ENTITIES.map(function(e) { return e.toLowerCase(); });

var TOPICS_LOWER = [
  'title','champion','win','wins','winner','relegated','relegation','sacked','fired',
  'transfer','signed','signs','signing','injured','injury','banned','ban','suspended',
  'penalty','crash','dnf','pole','contract','announced','confirmed',
  'premier league','la liga','serie a','bundesliga','ligue 1','champions league',
  'saudi pro league','grand prix',
];

// ── FALLBACK_NEWS — updated automatically by GitHub Action every hour ──
// DO NOT EDIT BELOW THIS LINE
var FALLBACK_NEWS = [
  {title:'Villa latest: Onana faces late fitness test ahead of Europa League final',src:'Sky Sports',cat:'FOOTBALL',link:'https://www.skysports.com/football/live-blog/11095/13025491/aston-villa-transfer-news-rumours-and-gossip-live-updates-and-latest-on-deals-signings-loans-and-contracts',date:'May 20'},
  {title:'What is at stake on final day of Premier League season?',src:'BBC Sport',cat:'FOOTBALL',link:'https://www.bbc.com/sport/football/articles/c62ewx2842jo?at_medium=RSS&at_campaign=rss',date:'May 20'},
  {title:'Transfer Centre LIVE! Silva dreaming of Barca move as Atleti enter the race',src:'Sky Sports',cat:'FOOTBALL',link:'https://www.skysports.com/football/live-blog/11095/12476234/transfer-centre-live-football-transfer-news-updates-and-rumours',date:'May 20'},
  {title:'Why Bournemouth and Brighton want Aston Villa to win Europa League',src:'Sky Sports',cat:'FOOTBALL',link:'https://www.skysports.com/football/news/11095/13546177/why-bournemouth-and-brighton-want-aston-villa-to-win-europa-league-to-have-chance-of-champions-league-qualification',date:'May 20'},
  {title:'How Mikel Arteta celebrated Arsenal’s title victory as he wasn’t seen with players in social media videos',src:'CaughtOffside',cat:'FOOTBALL',link:'https://www.caughtoffside.com/2026/05/20/mikel-arteta-celebrated-with-family-and-arsenal-players/',date:'May 20'},
  {title:'Report: Arsenal could offload as many as *eight* players from title-winning squad',src:'CaughtOffside',cat:'FOOTBALL',link:'https://www.caughtoffside.com/2026/05/20/arsenal-prepare-transfer-clear-out-to-title-winning-squad/',date:'May 20'},
  {title:'Arteta makes Premier League midfielder his top target after winning league title',src:'CaughtOffside',cat:'FOOTBALL',link:'https://www.caughtoffside.com/2026/05/20/arteta-premier-league-midfielder-top-target/',date:'May 20'},
  {title:'How potential ICE upgrades could soon give F1 power rankings a shake',src:'Racer',cat:'F1',link:'https://racer.com/2026/05/20/how-potential-ice-upgrades-could-soon-give-f1-power-rankings-a-shake',date:'May 20'},
  {title:'Wrexham star wants Championship play-offs restart',src:'BBC Sport',cat:'FOOTBALL',link:'https://www.bbc.com/sport/football/articles/c2d27x4pdneo?at_medium=RSS&at_campaign=rss',date:'May 20'},
  {title:'Coulthard Says the Transfer Debate Is Over: Verstappen Is Staying at Red Bull for the Rest of His Career',src:'GPToday',cat:'F1',link:'https://www.gptoday.net/en/news/f1/295715/coulthard-says-the-transfer-debate-is-over-verstappen-is-staying-at-red-bull-for-the-rest-of-his-career?utm_source=other&utm_medium=rss',date:'May 20'},
  {title:'Saka calls out critics as players celebrate title at Emirates at 5am',src:'BBC Sport',cat:'FOOTBALL',link:'https://www.bbc.com/sport/football/articles/ce3pwrrnvd6o?at_medium=RSS&at_campaign=rss',date:'May 20'},
  {title:'Arsenal latest: Premier League title parade details confirmed',src:'Sky Sports',cat:'FOOTBALL',link:'https://www.skysports.com/football/live-blog/11095/13025486/arsenal-transfer-news-rumours-and-gossip-live-updates-and-latest-on-deals-signings-loans-and-contracts',date:'May 20'},
  {title:'Palmer Backs Russell to Win the Title Because Antonelli Will Eventually Make a Costly Mistake',src:'GPToday',cat:'F1',link:'https://www.gptoday.net/en/news/f1/295714/palmer-backs-russell-to-win-the-title-because-antonelli-will-eventually-make-a-costly-mistake?utm_source=other&utm_medium=rss',date:'May 20'},
  {title:'Man United and Liverpool target Brazilian defender who wants Champions League football',src:'CaughtOffside',cat:'FOOTBALL',link:'https://www.caughtoffside.com/2026/05/20/man-united-liverpool-target-brazilian-defender/',date:'May 20'},
  {title:'Barcelona transfer news: £87m Chelsea star tells Blues he wants to grab -once-in-a-lifetime opportunity- to join La Liga champions',src:'Sports Mole Bayern',cat:'BAYERN',link:'https://www.sportsmole.co.uk/football/barcelona/transfer-talk/news/once-in-a-lifetime-opportunity-gbp87m-chelsea-star-tells-blues-he-wants-barcelona-move_597862.html',date:'May 20'},
  {title:'How Eberechi Eze’s special request to Mikel Arteta took Arsenal from brink of crisis to champions',src:'CaughtOffside',cat:'FOOTBALL',link:'https://www.caughtoffside.com/2026/05/20/arsenals-eberechi-eze-had-important-mikel-arteta-talk/',date:'May 20'},
  {title:'Schumacher Says Leclerc Will Never Win a Title at Ferrari and Verstappen Would Not Fit Either',src:'GPToday',cat:'F1',link:'https://www.gptoday.net/en/news/f1/295713/schumacher-says-leclerc-will-never-win-a-title-at-ferrari-and-verstappen-would-not-fit-either?utm_source=other&utm_medium=rss',date:'May 20'},
  {title:'5am trip to the Emirates - how Arsenal players celebrated PL title win',src:'Sky Sports',cat:'FOOTBALL',link:'https://www.skysports.com/football/news/11095/13546135/arsenal-win-the-premier-league-title-5am-trip-to-the-emirates-and-lots-of-bottles-how-the-players-celebrated-victory',date:'May 20'},
  {title:'Wrexham fan given football ban for using homophobic slurs at Chelsea match',src:'BBC Sport',cat:'FOOTBALL',link:'https://www.bbc.com/news/articles/c0r29e5g97xo?at_medium=RSS&at_campaign=rss',date:'May 20'},
  {title:'Party on the streets of London: Arsenal fans’ title celebrations – in pictures',src:'Guardian PL',cat:'FOOTBALL',link:'https://www.theguardian.com/football/gallery/2026/may/20/london-arsenal-fans-title-celebrations-in-pictures',date:'May 20'},
  {title:'Ranking the best European trophy-winning managers',src:'BBC Sport',cat:'FOOTBALL',link:'https://www.bbc.com/sport/football/articles/cq8pe5p491do?at_medium=RSS&at_campaign=rss',date:'May 20'},
  {title:'-They-re not laughing anymore!- | Arsenal players react to title win on social media',src:'Sky Sports',cat:'FOOTBALL',link:'https://www.skysports.com/watch/video/13546126/how-arsenal-players-reacted-to-first-premier-league-title-win-in-22-years-on-social-media',date:'May 20'},
  {title:'After firing Man City to title - is Shaw best striker in WSL history?',src:'BBC Sport',cat:'FOOTBALL',link:'https://www.bbc.com/sport/football/articles/cq8wdz9np4go?at_medium=RSS&at_campaign=rss',date:'May 20'},
  {title:'Arsenal fans react to first Premier League title in 22 years – video',src:'Guardian PL',cat:'FOOTBALL',link:'https://www.theguardian.com/football/video/2026/may/20/arsenal-fans-react-to-first-premier-league-title-in-22-years-video',date:'May 20'},
  {title:'Egypt repays energy firms with an eye on gas sufficiency',src:'Al Majalla',cat:'KSA',link:'https://en.majalla.com/node/331142/business-economy/egypt-repays-energy-firms-eye-gas-sufficiency',date:'May 20'},
  {title:'Arsenal crowned Premier League champions for first time in 22 years – as it happened',src:'Guardian PL',cat:'FOOTBALL',link:'https://www.theguardian.com/football/live/2026/may/19/arsenal-premier-league-champions-first-time-in-22-years-live-reaction',date:'May 19'},
  {title:'-Exceptional- Arsenal celebrate as Premier League title is secured',src:'BBC Sport',cat:'FOOTBALL',link:'https://www.bbc.com/sport/football/videos/cx213wlmldpo?at_medium=RSS&at_campaign=rss',date:'May 19'},
  {title:'‘We’ve done it’: euphoria as Arsenal win first Premier League in a generation',src:'Guardian PL',cat:'FOOTBALL',link:'https://www.theguardian.com/football/2026/may/19/weve-done-it-euphoria-as-arsenal-clinch-first-league-title-in-a-generation',date:'May 19'},
  {title:'Roberto De Zerbi tells his Spurs stars their final day relegation showdown is more important than last year-s Europa League win because -pride and dignity- are on the line',src:'Daily Mail Bayern',cat:'BAYERN',link:'https://www.dailymail.com/sport/football/article-15832467/Roberto-Zerbi-Spurs-relegation.html?ns_mchannel=rss&ns_campaign=1490&ito=1490',date:'May 19'},
  {title:'Chelsea 2-1 Tottenham: Premier League survival fight goes to final day – as it happened',src:'Guardian PL',cat:'FOOTBALL',link:'https://www.theguardian.com/football/live/2026/may/19/chelsea-v-tottenham-premier-league-live-west-ham',date:'May 19'},
  {title:'Tottenham lose at Chelsea to take relegation fight to final day',src:'BBC Sport',cat:'FOOTBALL',link:'https://www.bbc.com/sport/football/videos/cze2r13e0jjo?at_medium=RSS&at_campaign=rss',date:'May 19'},
  {title:'Arsenal win Premier League as Man City held at Bournemouth',src:'BBC Sport',cat:'FOOTBALL',link:'https://www.bbc.com/sport/football/videos/cn8p5vjwzx4o?at_medium=RSS&at_campaign=rss',date:'May 19'},
  {title:'Fernández and Chelsea sink Spurs as survival battle goes to the final day',src:'Guardian PL',cat:'FOOTBALL',link:'https://www.theguardian.com/football/2026/may/19/chelsea-tottenham-premier-league-match-report',date:'May 19'},
  {title:'Bournemouth 1-1 Manchester City: draw hands Premier League title to Arsenal – as it happened',src:'Guardian PL',cat:'FOOTBALL',link:'https://www.theguardian.com/football/live/2026/may/19/bournemouth-v-manchester-city-premier-league-live-pep-guardiola-arsenal',date:'May 19'},
  {title:'The key moments that decided the Premier League title race',src:'BBC Sport',cat:'FOOTBALL',link:'https://www.bbc.com/sport/football/articles/cx21j2nj8z1o?at_medium=RSS&at_campaign=rss',date:'May 19'},
  {title:'Kroupi goal hands title to Arsenal as Bournemouth hold off late City rally',src:'Guardian PL',cat:'FOOTBALL',link:'https://www.theguardian.com/football/2026/may/19/kroupi-goal-hands-title-to-arsenal-as-bournemouth-hold-off-late-city-rally',date:'May 19'},
  {title:'Arsenal crowned Premier League champions after Manchester City draw',src:'Guardian PL',cat:'FOOTBALL',link:'https://www.theguardian.com/football/2026/may/19/arsenal-premier-league-champions-manchester-city-bournemouth',date:'May 19'},
  {title:'Man City transfer news: £65m-rated Pep Guardiola defender is -fan- of Bayern Munich ahead of summer window crisis',src:'Sports Mole Bayern',cat:'BAYERN',link:'https://www.sportsmole.co.uk/football/man-city/transfer-talk/news/city-defender-is-fan-of-bayern-as-gbp65m-rumours-swirl-ahead-of-summer-crisis_597842.html',date:'May 19'},
  {title:'Southampton expelled from Championship play-offs',src:'Sky Sports',cat:'FOOTBALL',link:'https://www.skysports.com/football/news/11095/13545415/southampton-expelled-from-championship-play-offs-over-spygate-with-middlesbrough-reinstated',date:'May 19'},
  {title:'Hajj Ministry launches awareness guide for domestic pilgrims',src:'Saudi Gazette',cat:'KSA',link:'https://saudigazette.com.sa/article/661462/saudi-arabia/hajj-ministry-launches-awareness-guide-for-domestic-pilgrims',date:'May 19'},
  {title:'Villa target -special- win with Europa League master Emery',src:'Sky Sports',cat:'FOOTBALL',link:'https://www.skysports.com/football/news/11095/13545459/europa-league-final-aston-villa-target-special-win-over-freiburg-with-unai-emery',date:'May 19'},
  {title:'Bowen: West Ham relegation worries were -starting to creep in- last season',src:'Sky Sports',cat:'FOOTBALL',link:'https://www.skysports.com/football/news/11095/13545923/jarrod-bowen-west-ham-captain-says-premier-league-relegation-worries-were-starting-to-creep-in-last-season',date:'May 19'},
  {title:'Haas targets top 10 return with Montreal upgrade',src:'Racer',cat:'F1',link:'https://racer.com/2026/05/19/haas-targets-top-10-return-with-montreal-upgrade',date:'May 19'},
  {title:'Ten moments that won Arsenal the title',src:'Sky Sports',cat:'FOOTBALL',link:'https://www.skysports.com/football/news/11095/13545791/arsenal-win-the-premier-league-the-10-moments-that-won-the-gunners-the-title-for-the-first-time-in-22-years',date:'May 19'},
  {title:'Roberto De Zerbi tells his Tottenham players to use Chelsea-s hatred to inspire them as they seek crucial points in relegation battle: -Imagine celebrating the win in their stadium!-',src:'Daily Mail Bayern',cat:'BAYERN',link:'https://www.dailymail.com/sport/football/article-15828921/Roberto-Zerbi-tells-Tottenham-players-use-Chelseas-hatred.html?ns_mchannel=rss&ns_campaign=1490&ito=1490',date:'May 18'},
  {title:'Kai Havertz header edges nervy Arsenal past Burnley and one step from title',src:'Guardian PL',cat:'FOOTBALL',link:'https://www.theguardian.com/football/2026/may/18/arsenal-burnley-premier-league-match-report',date:'May 18'},
  {title:'Al-Hogail opens Saudi Pavilion at World Urban Forum in Azerbaijan',src:'Saudi Gazette',cat:'SPL',link:'https://saudigazette.com.sa/article/661442/saudi-arabia/al-hogail-opens-saudi-pavilion-at-world-urban-forum-in-azerbaijan',date:'May 18'},
  {title:'Saudi Arabia underscores enhancing international economic cooperation amid evolving global challenges',src:'Saudi Gazette',cat:'SPL',link:'https://saudigazette.com.sa/article/661436/saudi-arabia/saudi-arabia-underscores-enhancing-international-economic-cooperation-amid-evolving-global-challenges',date:'May 18'},
  {title:'Ministry of Municipalities completes major road, infrastructure upgrades for Hajj',src:'Saudi Gazette',cat:'KSA',link:'https://saudigazette.com.sa/article/661429/saudi-arabia/ministry-of-municipalities-completes-major-road-infrastructure-upgrades-for-hajj',date:'May 18'},
  {title:'Cult hero Mancini delivers derby win for Roma after Serie A scheduling nightmare | Nicky Bandini',src:'Guardian Serie A',cat:'FOOTBALL',link:'https://www.theguardian.com/football/2026/may/18/roma-lazio-rome-derby-serie-a',date:'May 18'},
  {title:'Nice fans direct fury at owners as club falls into Ligue 1 relegation playoff',src:'Guardian L1',cat:'FOOTBALL',link:'https://www.theguardian.com/football/2026/may/18/nice-fans-direct-fury-owners-club-falls-ligue-1-relegation-playoff-champions-league-inoes',date:'May 18'},
  {title:'St Pauli’s Bundesliga dream dies as Eriksen inspires Wolfsburg in relegation thriller | Andy Brassell',src:'Guardian Bund',cat:'FOOTBALL',link:'https://www.theguardian.com/football/2026/may/18/bundesliga-st-pauli-wolfsburg-relegation-thriller-christian-eriksen',date:'May 18'},
  {title:'Why Ford -loves the V8 idea- in F1 amid changing road car strategy',src:'Autosport',cat:'F1',link:'https://www.autosport.com/f1/news/why-ford-loves-the-v8-idea-in-f1-amid-changing-road-car-strategy/10821863/?utm_source=RSS&utm_medium=referral&utm_campaign=RSS-F1&utm_term=News&utm_content=uk',date:'May 18'},
  {title:'Wayne Rooney tells Arne Slot to BAN -selfish- Mohamed Salah from his own Liverpool farewell and -have him nowhere near the stadium- after his -grenade- social media post',src:'Daily Mail Bayern',cat:'BAYERN',link:'https://www.dailymail.com/sport/football/article-15826749/Wayne-Rooney-tells-Arne-Slot-DROP-selfish-Mohamed-Salah-Anfield-farewell-rips-conduct-Liverpool-legend-aimed-dig-fire-Arne-Slot.html?ns_mchannel=rss&ns_campaign=1490&ito=1490',date:'May 18'},
  {title:'Saudi Arabia strongly condemns attack on UAE&#039;s Barakah nuclear
plant site',src:'Saudi Gazette',cat:'KSA',link:'https://saudigazette.com.sa/article/661421/saudi-arabia/saudi-arabia-strongly-condemns-attack-on-uaes-barakah-nuclear-plant-site',date:'May 18'},
  {title:'Inter poised as Curtis Jones enters final year of Liverpool contract',src:'Guardian Serie A',cat:'FOOTBALL',link:'https://www.theguardian.com/football/2026/may/17/inter-poised-as-curtis-jones-enters-final-year-of-liverpool-contract',date:'May 17'},
  {title:'European football: Roma close to Champions League return after beating Lazio',src:'Guardian Serie A',cat:'FOOTBALL',link:'https://www.theguardian.com/football/2026/may/17/european-football-roma-lazio-milan-juventus-napoli',date:'May 17'},
  {title:'West Ham star Taty Castellanos bags goal of the season contender with wonderstrike at Newcastle - but his effort is in vain to leave Hammers on the brink of relegation',src:'Daily Mail Bayern',cat:'BAYERN',link:'https://www.dailymail.com/sport/football/article-15825735/west-ham-taty-castellanos-goal-season-contender.html?ns_mchannel=rss&ns_campaign=1490&ito=1490',date:'May 17'},
  {title:'Gary Neville tells referee Michael Salisbury he-s had an -absolute SHOCKER- as official refuses to overturn on-field decision after VAR recommended Man United-s goal be disallowed for handball',src:'Daily Mail Bayern',cat:'BAYERN',link:'https://www.dailymail.com/sport/football/article-15825271/Gary-Neville-tells-referee-Michael-Salisbury-Man-United-handball.html?ns_mchannel=rss&ns_campaign=1490&ito=1490',date:'May 17'},
  {title:'KACST launches special awards at ISEF 2026 for first time',src:'Saudi Gazette',cat:'KSA',link:'https://saudigazette.com.sa/article/661407/saudi-arabia/kacst-launches-special-awards-at-isef-2026-for-first-time',date:'May 17'},
  {title:'SAR launches naming rights project for Haramain High Speed Railway stations',src:'Saudi Gazette',cat:'KSA',link:'https://saudigazette.com.sa/article/661405/saudi-arabia/sar-launches-naming-rights-project-for-haramain-high-speed-railway-stations',date:'May 17'},
  {title:'Can Russell take inspiration from Norris in bid for F1 title?',src:'Autosport',cat:'F1',link:'https://www.autosport.com/f1/news/can-george-russell-take-inspiration-from-lando-norris-in-quest-for-f1-title/10821504/?utm_source=RSS&utm_medium=referral&utm_campaign=RSS-F1&utm_term=News&utm_content=uk',date:'May 17'},
  {title:'Saudi Customs report 915 contraband seizures at ports last week',src:'Saudi Gazette',cat:'SPL',link:'https://saudigazette.com.sa/article/661401/saudi-arabia/saudi-customs-report-915-contraband-seizures-at-ports-last-week',date:'May 16'},
  {title:'European football: Kane uncorks title party with hat-trick; Lewandowski to leave Barça',src:'Guardian Bund',cat:'FOOTBALL',link:'https://www.theguardian.com/football/2026/may/16/robert-lewandowski-barcelona-real-madrid-bundesliga-european-roundup',date:'May 16'},
  {title:'European football: Kane uncorks title party with hat-trick; Lewandowski to leave Barça',src:'Guardian Bayern',cat:'BAYERN',link:'https://www.theguardian.com/football/2026/may/16/robert-lewandowski-barcelona-real-madrid-bundesliga-european-roundup',date:'May 16'},
  {title:'Saudi Arabia underscores importance of maritime security, energy flows at UN meeting',src:'Saudi Gazette',cat:'SPL',link:'https://saudigazette.com.sa/article/661398/saudi-arabia/saudi-arabia-underscores-importance-of-maritime-security-energy-flows-at-un-meeting',date:'May 16'},
  {title:'Saudi Arabia underscores importance of maritime security, energy flows at UN meeting',src:'Saudi Gazette',cat:'KSA',link:'https://saudigazette.com.sa/article/661398/saudi-arabia/saudi-arabia-underscores-importance-of-maritime-security-energy-flows-at-un-meeting',date:'May 16'},
  {title:'PSG are deserved Ligue 1 champions but Lens put up an admirable fight | Raphaël Jucobin',src:'Guardian L1',cat:'FOOTBALL',link:'https://www.theguardian.com/football/2026/may/14/psg-ligue-1-champions-lens-pierre-sage-coupe-de-france',date:'May 14'},
  {title:'European football: Kvaratskhelia powers PSG to Ligue 1 title at Lens',src:'Guardian L1',cat:'FOOTBALL',link:'https://www.theguardian.com/football/2026/may/13/european-football-khvicha-kvaratskhelia-powers-psg-to-ligue-1-title-at-lens',date:'May 13'}
];
// DO NOT EDIT ABOVE THIS LINE

function isHighImpact(title, cat, filter) {
  if (filter && title.toLowerCase().indexOf(filter.toLowerCase()) === -1) return false;
  if (cat === 'F1')       return !F1_JUNK.test(title);
  if (cat === 'FOOTBALL') return FOOTBALL_KEEP.test(title) && !FOOTBALL_JUNK.test(title);
  if (cat === 'BAYERN')   return !BAYERN_JUNK.test(title);
  if (cat === 'SPL')      return !SPL_JUNK.test(title);
  if (cat === 'KSA')      return KSA_KEEP.test(title) && !KSA_JUNK.test(title);
  return true;
}

function fingerprint(title) {
  var t = title.toLowerCase();
  var found = [];
  ENTITIES_LOWER.forEach(function(e)  { if (t.indexOf(e)  !== -1) found.push(e);  });
  TOPICS_LOWER.forEach(function(tp)   { if (t.indexOf(tp) !== -1) found.push(tp); });
  return found;
}

function isDuplicate(title, seenExact, seenStories) {
  var key = title.toLowerCase().replace(/\W+/g,'');
  if (seenExact[key]) return true;
  var fp          = fingerprint(title);
  var fpEntities  = fp.filter(function(x) { return ENTITIES_LOWER.indexOf(x) !== -1; });
  var fpTopics    = fp.filter(function(x) { return TOPICS_LOWER.indexOf(x)   !== -1; });
  for (var i = 0; i < seenStories.length; i++) {
    var s = seenStories[i];
    var sharedEnt   = fpEntities.filter(function(x) { return s.entities.indexOf(x) !== -1; });
    var sharedTopic = fpTopics.filter(function(x)   { return s.topics.indexOf(x)   !== -1; });
    if (sharedEnt.length > 0 && sharedTopic.length > 0) return true;
  }
  return false;
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

  var source   = parsedStoriesCache.length ? parsedStoriesCache : FALLBACK_NEWS;
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
  var container = document.getElementById('critical-posts');
  if (container) {
    container.innerHTML = '<div class="empty-state">Loading latest headlines...</div>';
  }

  var seenExact   = {};
  var seenStories = [];
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
        if (isDuplicate(title, seenExact, seenStories)) continue;
        var fp = fingerprint(title);
        seenExact[title.toLowerCase().replace(/\W+/g,'')] = true;
        seenStories.push({
          entities: fp.filter(function(x) { return ENTITIES_LOWER.indexOf(x) !== -1; }),
          topics:   fp.filter(function(x) { return TOPICS_LOWER.indexOf(x)   !== -1; })
        });
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
  renderNewsFeed();
}
