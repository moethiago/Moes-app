// ── FEED.JS ─────────────────────────────────────────────
// Channels: F1, Football (Top 5), Bayern, Saudi Football, Saudi Major News
// Each category is independent - add/remove without touching others

var currentFilter = 'ALL';
var parsedStoriesCache = [];

var MASTER_CHANNELS = [
  // F1 - dedicated feeds only
  {'url':'https://feeds.bbci.co.uk/sport/formula1/rss.xml',            'name':'BBC F1',                'cat':'F1'},
  {'url':'https://www.autosport.com/rss/f1/news/',                      'name':'Autosport',             'cat':'F1'},
  // Football - Top 5 leagues
  {'url':'https://feeds.bbci.co.uk/sport/football/rss.xml',            'name':'BBC Sport',             'cat':'FOOTBALL'},
  {'url':'https://www.theguardian.com/football/premierleague/rss',     'name':'Guardian PL',           'cat':'FOOTBALL'},
  {'url':'https://www.theguardian.com/football/laliga/rss',            'name':'Guardian LaLiga',       'cat':'FOOTBALL'},
  {'url':'https://www.theguardian.com/football/serieafootball/rss',    'name':'Guardian Serie A',      'cat':'FOOTBALL'},
  {'url':'https://www.theguardian.com/football/bundesligafootball/rss','name':'Guardian Bund',         'cat':'FOOTBALL'},
  {'url':'https://www.theguardian.com/football/ligue1football/rss',    'name':'Guardian L1',           'cat':'FOOTBALL'},
  {'url':'https://www.espn.com/espn/rss/soccer/news',                  'name':'ESPN FC',               'cat':'FOOTBALL'},
  // Bayern - dedicated feeds only
  {'url':'https://fcbayern.com/en/api/rss/content',                    'name':'Bayern Official',       'cat':'BAYERN'},
  {'url':'https://www.bavarianfootballworks.com/rss/current.xml',      'name':'Bavarian Football Works','cat':'BAYERN'},
  // Saudi Football - dedicated feeds only
  {'url':'https://www.arabnews.com/saudi-football/rss.xml',           'name':'Arab News SPL',         'cat':'SPL'},
  {'url':'https://www.goal.com/en-sa/rss/news',                       'name':'Goal Saudi',            'cat':'SPL'},
  // Saudi Major News - dedicated feeds only
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

// ── FALLBACK_NEWS - updated automatically by GitHub Action every hour ──
// DO NOT EDIT BELOW THIS LINE
var FALLBACK_NEWS = [
  {title:'Turkish delight for Villa and the Premier League relegation battle - Football Weekly podcast',src:'Guardian PL',cat:'FOOTBALL',link:'https://www.theguardian.com/football/audio/2026/may/21/turkish-delight-aston-villa-premier-league-relegation-battle-football-weekly-podcast',date:'May 21'},
  {title:'Premier League winner on Tuesday, GCSEs on Thursday',src:'BBC Sport',cat:'FOOTBALL',link:'https://www.bbc.com/sport/football/articles/cj3pv6rl1k0o?at_medium=RSS&at_campaign=rss',date:'May 21'},
  {title:'What is at stake on final day of Premier League season?',src:'BBC Sport',cat:'FOOTBALL',link:'https://www.bbc.com/sport/football/articles/c62ewx2842jo?at_medium=RSS&at_campaign=rss',date:'May 21'},
  {title:'Which clubs have never been relegated from the Premier League?',src:'BBC Sport',cat:'FOOTBALL',link:'https://www.bbc.com/sport/football/articles/ckgpxv2dw9qo?at_medium=RSS&at_campaign=rss',date:'May 21'},
  {title:'Why Bukayo Saka and Max Dowman missed Arsenal training as Mikel Arteta receives boost for Crystal Palace',src:'Sports Mole Bayern',cat:'BAYERN',link:'https://www.sportsmole.co.uk/football/arsenal/injury-news/news/why-dowman-saka-missed-arsenal-training-as-arteta-receives-boost-for-palace_597910.html',date:'May 21'},
  {title:'Newcastle United advised to make -logical- transfer raid on PL rivals',src:'CaughtOffside',cat:'FOOTBALL',link:'https://www.caughtoffside.com/2026/05/21/newcastle-jarrod-bowen-transfer/',date:'May 21'},
  {title:'Chaos opens transfer door for Man United to sign midfielder after scouting report',src:'CaughtOffside',cat:'FOOTBALL',link:'https://www.caughtoffside.com/2026/05/21/chaos-opens-transfer-door-man-united-midfielder/',date:'May 21'},
  {title:'Man United injury, suspension list and return dates vs. Brighton: Benjamin Sesko, Matthijs de Ligt latest',src:'Sports Mole Bayern',cat:'BAYERN',link:'https://www.sportsmole.co.uk/football/man-utd/injury-news/injuries-and-suspensions/sesko-de-ligt-latest-man-united-injury-suspension-list-vs-brighton_597912.html',date:'May 21'},
  {title:'Dembele insists he will be fit for Champions League final',src:'Sky Sports',cat:'FOOTBALL',link:'https://www.skysports.com/football/live-blog/11095/12507208/football-latest-news-gossip',date:'May 21'},
  {title:'Liverpool interest in 14 G/A winger is bad news for Cody Gakpo-s future at the club',src:'CaughtOffside',cat:'FOOTBALL',link:'https://www.caughtoffside.com/2026/05/21/liverpool-interest-in-winger-bad-news-cody-gakpo/',date:'May 21'},
  {title:'Sources: Latest on Arsenal transfer plans, outgoings, and three new contracts',src:'CaughtOffside',cat:'FOOTBALL',link:'https://www.caughtoffside.com/2026/05/21/arsenal-eye-transfers-new-timber-and-rice-contracts/',date:'May 21'},
  {title:'Just In: Relegation struggle at Tottenham creates defensive opportunity for Barcelona',src:'CaughtOffside',cat:'FOOTBALL',link:'https://www.caughtoffside.com/2026/05/21/just-in-relegation-struggle-tottenham-barcelona/',date:'May 21'},
  {title:'Red Bull outlines timeline for new F1 wind tunnel',src:'Autosport',cat:'F1',link:'https://www.autosport.com/f1/news/red-bull-provides-update-on-long-awaited-new-f1-wind-tunnel/10822485/?utm_source=RSS&utm_medium=referral&utm_campaign=RSS-F1&utm_term=News&utm_content=uk',date:'May 21'},
  {title:'Newcastle news: Magpies set for unexpected windfall from Alexander Isak-s World Cup involvement',src:'Sports Mole Bayern',cat:'BAYERN',link:'https://www.sportsmole.co.uk/football/newcastle-united/world-cup/news/magpies-set-for-unexpected-windfall-from-alexander-isaks-world-cup-involvement_597909.html',date:'May 21'},
  {title:'Villa make history to win Europa League | The Verdict',src:'Sky Sports',cat:'FOOTBALL',link:'https://www.skysports.com/watch/video/13546502/the-verdict-aston-villa-make-history-to-win-europa-league',date:'May 21'},
  {title:'Arsenal dominance to come? How next season-s Premier League title race could unfold',src:'Sports Mole Bayern',cat:'BAYERN',link:'https://www.sportsmole.co.uk/football/arsenal/news/arsenal-dominance-how-next-seasons-premier-league-title-race-could-unfold_597908.html',date:'May 21'},
  {title:'Man City injury, suspension news and return dates for final-day Aston Villa clash',src:'Sports Mole Bayern',cat:'BAYERN',link:'https://www.sportsmole.co.uk/football/man-city/injury-news/injuries-and-suspensions/any-concerns-latest-man-city-injury-list-for-final-day-aston-villa-clash_597907.html',date:'May 21'},
  {title:'Arsenal transfer news: Mikel Arteta could -dismantle- title-winning team with eight sales considered',src:'Sports Mole Bayern',cat:'BAYERN',link:'https://www.sportsmole.co.uk/football/arsenal/transfer-talk/news/arsenal-could-dismantle-title-winning-team-with-eight-sales-considered_597905.html',date:'May 21'},
  {title:'Bayern Munich transfer news: Vincent Kompany plotting -stunning swoop- for Man City legend with high-profile reunion considered',src:'Sports Mole Bayern',cat:'BAYERN',link:'https://www.sportsmole.co.uk/football/bayern-munich/transfer-talk/news/stunning-swoop-bayern-boss-kompany-plotting-high-profile-reunion-with-man-city-legend_597903.html',date:'May 21'},
  {title:'Report: Manchester United star-s transfer to Euro giants could fall through for surprise reason',src:'CaughtOffside',cat:'FOOTBALL',link:'https://www.caughtoffside.com/2026/05/21/jadon-sancho-transfer-back-to-dortmund-in-doubt/',date:'May 21'},
  {title:'Spygate scandal: Southampton-s EFL playoff expulsion confirmed as -angry- star player reacts to -chaos-',src:'Sports Mole Bayern',cat:'BAYERN',link:'https://www.sportsmole.co.uk/football/southampton/news/this-pain-cuts-so-deep-southamptons-playoff-expulsion-confirmed-as-angry-star-reacts-to-chaos_597902.html',date:'May 21'},
  {title:'List of England managers: Where does Thomas Tuchel rank for wins, goals, tournament record?',src:'Sports Mole Bayern',cat:'BAYERN',link:'https://www.sportsmole.co.uk/football/england/feature/list-of-england-managers-where-does-tuchel-rank-for-wins-goals-tournament-record_597898.html',date:'May 21'},
  {title:'Arsenal injury, suspension list and return dates for Crystal Palace: David Raya, Jurrien Timber, Ben White latest',src:'Sports Mole Bayern',cat:'BAYERN',link:'https://www.sportsmole.co.uk/football/arsenal/injury-news/injuries-and-suspensions/raya-white-timber-latest-arsenal-injury-suspension-list-vs-palace_597891.html',date:'May 21'},
  {title:'Martinez breaks finger... then helps Villa win Europa League',src:'BBC Sport',cat:'FOOTBALL',link:'https://www.bbc.com/sport/football/articles/c5y0xpzjey8o?at_medium=RSS&at_campaign=rss',date:'May 20'},
  {title:'Papers: Arsenal want Junior Kroupi after Bournemouth star helped seal title win',src:'Sky Sports',cat:'FOOTBALL',link:'https://www.skysports.com/football/news/11095/13546434/arsenal-target-move-for-bournemouths-eli-junior-kroupi-after-cherries-star-helped-seal-premier-league-title-win-paper-talk',date:'May 20'},
  {title:'Germany pick previously retired Neuer, 40, in World Cup squad',src:'Sky Bayern',cat:'BAYERN',link:'https://www.skysports.com/football/live-blog/11095/13509050/world-cup-2026-news-and-live-updates-usa-canada-and-mexico-build-up-plus-latest-on-trump-tickets-and-fans',date:'May 20'},
  {title:'Villa keep alive English hopes of six Champions League spots',src:'BBC Sport',cat:'FOOTBALL',link:'https://www.bbc.com/sport/football/articles/c8r8mvl8rkro?at_medium=RSS&at_campaign=rss',date:'May 20'},
  {title:'UK-GCC free trade deal set to boost Saudi-British trade and investment',src:'Saudi Gazette',cat:'KSA',link:'https://saudigazette.com.sa/article/661490/saudi-arabia/uk-gcc-free-trade-deal-set-to-boost-saudi-british-trade-and-investment',date:'May 20'},
  {title:'Minister Al-Rabiah: Saudi Arabia sets global benchmark in crowd management through advanced technology',src:'Saudi Gazette',cat:'KSA',link:'https://saudigazette.com.sa/article/661489/saudi-arabia/minister-al-rabiah-saudi-arabia-sets-global-benchmark-in-crowd-management-through-advanced-technology',date:'May 20'},
  {title:'Saudi Arabia, Britain sign deal to support injured children in Gaza',src:'Saudi Gazette',cat:'SPL',link:'https://saudigazette.com.sa/article/661487/saudi-arabia/saudi-arabia-britain-sign-deal-to-support-injured-children-in-gaza',date:'May 20'},
  {title:'Saudi Arabia-s non-oil trade surplus with GCC countries reaches SR4.47 billion in February',src:'Saudi Gazette',cat:'KSA',link:'https://saudigazette.com.sa/article/661486/saudi-arabia/saudi-arabias-non-oil-trade-surplus-with-gcc-countries-reaches-sr447-billion-in-february',date:'May 20'},
  {title:'Minister Al-Jalajel inspects readiness of healthcare facilities at holy sites',src:'Saudi Gazette',cat:'KSA',link:'https://saudigazette.com.sa/article/661482/saudi-arabia/minister-al-jalajel-inspects-readiness-of-healthcare-services-at-holy-sites',date:'May 20'},
  {title:'Transfer Centre LIVE! Silva dreaming of Barca move as Atleti enter the race',src:'Sky Sports',cat:'FOOTBALL',link:'https://www.skysports.com/football/live-blog/11095/12476234/transfer-centre-live-football-transfer-news-updates-and-rumours',date:'May 20'},
  {title:'How Villa-s Europa League win opens up CL shot for Bournemouth and Brighton',src:'Sky Sports',cat:'FOOTBALL',link:'https://www.skysports.com/football/news/11095/13546177/why-bournemouth-and-brighton-want-aston-villa-to-win-europa-league-to-have-chance-of-champions-league-qualification',date:'May 20'},
  {title:'Coulthard Says No Other F1 Driver Would Have the Courage to Race at the Nurburgring',src:'GPToday',cat:'F1',link:'https://www.gptoday.net/en/news/f1/295717/coulthard-says-no-other-f1-driver-would-have-the-courage-to-race-at-the-nurburgring?utm_source=other&utm_medium=rss',date:'May 20'},
  {title:'How potential ICE upgrades could soon give F1 power rankings a shake',src:'Racer',cat:'F1',link:'https://racer.com/2026/05/20/how-potential-ice-upgrades-could-soon-give-f1-power-rankings-a-shake',date:'May 20'},
  {title:'Coulthard Says the Transfer Debate Is Over: Verstappen Is Staying at Red Bull for the Rest of His Career',src:'GPToday',cat:'F1',link:'https://www.gptoday.net/en/news/f1/295715/coulthard-says-the-transfer-debate-is-over-verstappen-is-staying-at-red-bull-for-the-rest-of-his-career?utm_source=other&utm_medium=rss',date:'May 20'},
  {title:'Palmer Backs Russell to Win the Title Because Antonelli Will Eventually Make a Costly Mistake',src:'GPToday',cat:'F1',link:'https://www.gptoday.net/en/news/f1/295714/palmer-backs-russell-to-win-the-title-because-antonelli-will-eventually-make-a-costly-mistake?utm_source=other&utm_medium=rss',date:'May 20'},
  {title:'Schumacher Says Leclerc Will Never Win a Title at Ferrari and Verstappen Would Not Fit Either',src:'GPToday',cat:'F1',link:'https://www.gptoday.net/en/news/f1/295713/schumacher-says-leclerc-will-never-win-a-title-at-ferrari-and-verstappen-would-not-fit-either?utm_source=other&utm_medium=rss',date:'May 20'},
  {title:'5am trip to the Emirates - how Arsenal players celebrated PL title win',src:'Sky Sports',cat:'FOOTBALL',link:'https://www.skysports.com/football/news/11095/13546135/arsenal-win-the-premier-league-title-5am-trip-to-the-emirates-and-lots-of-bottles-how-the-players-celebrated-victory',date:'May 20'},
  {title:'The RACER Mailbag, May 20',src:'Racer',cat:'F1',link:'https://racer.com/2026/05/19/the-racer-mailbag-may-20',date:'May 20'},
  {title:'Party on the streets of London: Arsenal fans- title celebrations - in pictures',src:'Guardian PL',cat:'FOOTBALL',link:'https://www.theguardian.com/football/gallery/2026/may/20/london-arsenal-fans-title-celebrations-in-pictures',date:'May 20'},
  {title:'Ranking the best European trophy-winning managers',src:'BBC Sport',cat:'FOOTBALL',link:'https://www.bbc.com/sport/football/articles/cq8pe5p491do?at_medium=RSS&at_campaign=rss',date:'May 20'},
  {title:'Arsenal fans react to first Premier League title in 22 years - video',src:'Guardian PL',cat:'FOOTBALL',link:'https://www.theguardian.com/football/video/2026/may/20/arsenal-fans-react-to-first-premier-league-title-in-22-years-video',date:'May 20'},
  {title:'-So much on the line- - Spurs struggles sets up final day relegation decider',src:'BBC Sport',cat:'FOOTBALL',link:'https://www.bbc.com/sport/football/videos/c2k24l214z8o?at_medium=RSS&at_campaign=rss',date:'May 20'},
  {title:'Arsenal crowned Premier League champions for first time in 22 years - as it happened',src:'Guardian PL',cat:'FOOTBALL',link:'https://www.theguardian.com/football/live/2026/may/19/arsenal-premier-league-champions-first-time-in-22-years-live-reaction',date:'May 19'},
  {title:'-Exceptional- Arsenal celebrate as Premier League title is secured',src:'BBC Sport',cat:'FOOTBALL',link:'https://www.bbc.com/sport/football/videos/cx213wlmldpo?at_medium=RSS&at_campaign=rss',date:'May 19'},
  {title:'-We-ve done it-: euphoria as Arsenal win first Premier League in a generation',src:'Guardian PL',cat:'FOOTBALL',link:'https://www.theguardian.com/football/2026/may/19/weve-done-it-euphoria-as-arsenal-clinch-first-league-title-in-a-generation',date:'May 19'},
  {title:'Chelsea 2-1 Tottenham: Premier League survival fight goes to final day - as it happened',src:'Guardian PL',cat:'FOOTBALL',link:'https://www.theguardian.com/football/live/2026/may/19/chelsea-v-tottenham-premier-league-live-west-ham',date:'May 19'},
  {title:'Tottenham lose at Chelsea to take relegation fight to final day',src:'BBC Sport',cat:'FOOTBALL',link:'https://www.bbc.com/sport/football/videos/cze2r13e0jjo?at_medium=RSS&at_campaign=rss',date:'May 19'},
  {title:'Arsenal win Premier League as Man City held at Bournemouth',src:'BBC Sport',cat:'FOOTBALL',link:'https://www.bbc.com/sport/football/videos/cn8p5vjwzx4o?at_medium=RSS&at_campaign=rss',date:'May 19'},
  {title:'Fern-ndez and Chelsea sink Spurs as survival battle goes to the final day',src:'Guardian PL',cat:'FOOTBALL',link:'https://www.theguardian.com/football/2026/may/19/chelsea-tottenham-premier-league-match-report',date:'May 19'},
  {title:'Bournemouth 1-1 Manchester City: draw hands Premier League title to Arsenal - as it happened',src:'Guardian PL',cat:'FOOTBALL',link:'https://www.theguardian.com/football/live/2026/may/19/bournemouth-v-manchester-city-premier-league-live-pep-guardiola-arsenal',date:'May 19'},
  {title:'Kroupi goal hands title to Arsenal as Bournemouth hold off late City rally',src:'Guardian PL',cat:'FOOTBALL',link:'https://www.theguardian.com/football/2026/may/19/kroupi-goal-hands-title-to-arsenal-as-bournemouth-hold-off-late-city-rally',date:'May 19'},
  {title:'Arsenal crowned Premier League champions after Manchester City draw',src:'Guardian PL',cat:'FOOTBALL',link:'https://www.theguardian.com/football/2026/may/19/arsenal-premier-league-champions-manchester-city-bournemouth',date:'May 19'},
  {title:'Hajj Ministry launches awareness guide for domestic pilgrims',src:'Saudi Gazette',cat:'KSA',link:'https://saudigazette.com.sa/article/661462/saudi-arabia/hajj-ministry-launches-awareness-guide-for-domestic-pilgrims',date:'May 19'},
  {title:'Haas targets top 10 return with Montreal upgrade',src:'Racer',cat:'F1',link:'https://racer.com/2026/05/19/haas-targets-top-10-return-with-montreal-upgrade',date:'May 19'},
  {title:'Ten moments that won Arsenal the title',src:'Sky Sports',cat:'FOOTBALL',link:'https://www.skysports.com/football/news/11095/13545791/arsenal-win-the-premier-league-the-10-moments-that-won-the-gunners-the-title-for-the-first-time-in-22-years',date:'May 19'},
  {title:'Why don-t drivers enter other series like Verstappen? F1 Q&A',src:'BBC F1',cat:'F1',link:'https://www.bbc.com/sport/formula1/articles/c9d367vg7wdo?at_medium=RSS&at_campaign=rss',date:'May 19'},
  {title:'Al-Hogail opens Saudi Pavilion at World Urban Forum in Azerbaijan',src:'Saudi Gazette',cat:'SPL',link:'https://saudigazette.com.sa/article/661442/saudi-arabia/al-hogail-opens-saudi-pavilion-at-world-urban-forum-in-azerbaijan',date:'May 18'},
  {title:'Verstappen Names the 2024 Brazilian Grand Prix as the Best Race of His Career',src:'GPToday',cat:'F1',link:'https://www.gptoday.net/en/news/f1/295681/verstappen-names-the-2024-brazilian-grand-prix-as-the-best-race-of-his-career?utm_source=other&utm_medium=rss',date:'May 18'},
  {title:'Saudi Arabia underscores enhancing international economic cooperation amid evolving global challenges',src:'Saudi Gazette',cat:'SPL',link:'https://saudigazette.com.sa/article/661436/saudi-arabia/saudi-arabia-underscores-enhancing-international-economic-cooperation-amid-evolving-global-challenges',date:'May 18'},
  {title:'Ministry of Municipalities completes major road, infrastructure upgrades for Hajj',src:'Saudi Gazette',cat:'KSA',link:'https://saudigazette.com.sa/article/661429/saudi-arabia/ministry-of-municipalities-completes-major-road-infrastructure-upgrades-for-hajj',date:'May 18'},
  {title:'Cult hero Mancini delivers derby win for Roma after Serie A scheduling nightmare | Nicky Bandini',src:'Guardian Serie A',cat:'FOOTBALL',link:'https://www.theguardian.com/football/2026/may/18/roma-lazio-rome-derby-serie-a',date:'May 18'},
  {title:'Nice fans direct fury at owners as club falls into Ligue 1 relegation playoff',src:'Guardian L1',cat:'FOOTBALL',link:'https://www.theguardian.com/football/2026/may/18/nice-fans-direct-fury-owners-club-falls-ligue-1-relegation-playoff-champions-league-inoes',date:'May 18'},
  {title:'St Pauli-s Bundesliga dream dies as Eriksen inspires Wolfsburg in relegation thriller | Andy Brassell',src:'Guardian Bund',cat:'FOOTBALL',link:'https://www.theguardian.com/football/2026/may/18/bundesliga-st-pauli-wolfsburg-relegation-thriller-christian-eriksen',date:'May 18'},
  {title:'Why Ford -loves the V8 idea- in F1 amid changing road car strategy',src:'Autosport',cat:'F1',link:'https://www.autosport.com/f1/news/why-ford-loves-the-v8-idea-in-f1-amid-changing-road-car-strategy/10821863/?utm_source=RSS&utm_medium=referral&utm_campaign=RSS-F1&utm_term=News&utm_content=uk',date:'May 18'},
  {title:'What is the format for F1 sprint races in 2026?',src:'BBC F1',cat:'F1',link:'https://www.bbc.com/sport/formula1/articles/c4g236r9npyo?at_medium=RSS&at_campaign=rss',date:'May 18'},
  {title:'Saudi Arabia strongly condemns attack on UAE-s Barakah nuclear-plant site',src:'Saudi Gazette',cat:'KSA',link:'https://saudigazette.com.sa/article/661421/saudi-arabia/saudi-arabia-strongly-condemns-attack-on-uaes-barakah-nuclear-plant-site',date:'May 18'},
  {title:'Inter poised as Curtis Jones enters final year of Liverpool contract',src:'Guardian Serie A',cat:'FOOTBALL',link:'https://www.theguardian.com/football/2026/may/17/inter-poised-as-curtis-jones-enters-final-year-of-liverpool-contract',date:'May 17'},
  {title:'European football: Roma close to Champions League return after beating Lazio',src:'Guardian Serie A',cat:'FOOTBALL',link:'https://www.theguardian.com/football/2026/may/17/european-football-roma-lazio-milan-juventus-napoli',date:'May 17'},
  {title:'RAVENOL team brings Mercedes-AMG its first 24h N-rburgring victory in 10 years',src:'Racer',cat:'F1',link:'https://racer.com/2026/05/17/ravenol-team-brings-mercedes-amg-its-first-24h-n-rburgring-victory-in-10-years',date:'May 17'},
  {title:'Mechanical issues knock Verstappen team out of 24h N-rburgring lead',src:'Racer',cat:'F1',link:'https://racer.com/2026/05/17/mechanical-issues-knock-verstappen-team-out-of-24h-n-rburgring-lead',date:'May 17'},
  {title:'Can Russell take inspiration from Norris in bid for F1 title?',src:'Autosport',cat:'F1',link:'https://www.autosport.com/f1/news/can-george-russell-take-inspiration-from-lando-norris-in-quest-for-f1-title/10821504/?utm_source=RSS&utm_medium=referral&utm_campaign=RSS-F1&utm_term=News&utm_content=uk',date:'May 17'},
  {title:'European football: Kane uncorks title party with hat-trick; Lewandowski to leave Bar-a',src:'Guardian Bund',cat:'FOOTBALL',link:'https://www.theguardian.com/football/2026/may/16/robert-lewandowski-barcelona-real-madrid-bundesliga-european-roundup',date:'May 16'},
  {title:'European football: Kane uncorks title party with hat-trick; Lewandowski to leave Bar-a',src:'Guardian Bayern',cat:'BAYERN',link:'https://www.theguardian.com/football/2026/may/16/robert-lewandowski-barcelona-real-madrid-bundesliga-european-roundup',date:'May 16'},
  {title:'Watch Max Verstappen take on the 24 Hours N-rburgring, live and exclusive on RACER',src:'Racer',cat:'F1',link:'https://racer.com/2026/05/14/watch-max-verstappen-take-on-the-24-hours-n-rburgring-live-and-exclusive-on-racer',date:'May 15'},
  {title:'PSG are deserved Ligue 1 champions but Lens put up an admirable fight | Rapha-l Jucobin',src:'Guardian L1',cat:'FOOTBALL',link:'https://www.theguardian.com/football/2026/may/14/psg-ligue-1-champions-lens-pierre-sage-coupe-de-france',date:'May 14'}
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
