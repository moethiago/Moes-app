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
  {title:'How will Verstappen re-adapt to F1 after Nurburgring adventure?',src:'Autosport',cat:'F1',link:'https://www.autosport.com/f1/news/how-will-max-verstappen-re-adapt-to-f1-after-nurburgring-24h-adventure/10822303/?utm_source=RSS&utm_medium=referral&utm_campaign=RSS-F1&utm_term=News&utm_content=uk',date:'May 20'},
  {title:'Dowman becomes youngest Premier League title winner',src:'BBC Sport',cat:'FOOTBALL',link:'https://www.bbc.com/sport/football/articles/cvgz1xwy39ko?at_medium=RSS&at_campaign=rss',date:'May 20'},
  {title:'World Cup player signs petition calling for protection from extreme heat',src:'BBC Sport',cat:'FOOTBALL',link:'https://www.bbc.com/sport/articles/cjepzgvegk3o?at_medium=RSS&at_campaign=rss',date:'May 20'},
  {title:'Why don-t drivers enter other series like Verstappen? F1 Q&A',src:'BBC F1',cat:'F1',link:'https://www.bbc.com/sport/formula1/articles/c9d367vg7wdo?at_medium=RSS&at_campaign=rss',date:'May 19'},
  {title:'How GM tech accelerated Cadillac-s F1 entry',src:'Autosport',cat:'F1',link:'https://www.autosport.com/f1/news/how-gm-tech-accelerated-cadillacs-f1-entry/10822240/?utm_source=RSS&utm_medium=referral&utm_campaign=RSS-F1&utm_term=News&utm_content=uk',date:'May 19'},
  {title:'Boats, fire and a TikTok song - inside Arsenal-s title win',src:'BBC Sport',cat:'FOOTBALL',link:'https://www.bbc.com/sport/football/articles/c9v3jx1jmrwo?at_medium=RSS&at_campaign=rss',date:'May 19'},
  {title:'Title despair & Guardiola going - 24 hours of pain for Man City',src:'BBC Sport',cat:'FOOTBALL',link:'https://www.bbc.com/sport/football/articles/c78q300ejz4o?at_medium=RSS&at_campaign=rss',date:'May 19'},
  {title:'The key moments that decided the Premier League title race',src:'BBC Sport',cat:'FOOTBALL',link:'https://www.bbc.com/sport/football/articles/cx21j2nj8z1o?at_medium=RSS&at_campaign=rss',date:'May 19'},
  {title:'Bournemouth in Europe for first time -  but Champions League still on',src:'BBC Sport',cat:'FOOTBALL',link:'https://www.bbc.com/sport/football/articles/cn0p96pxy34o?at_medium=RSS&at_campaign=rss',date:'May 19'},
  {title:'Tottenham lose at Chelsea to take relegation fight to final day',src:'BBC Sport',cat:'FOOTBALL',link:'https://www.bbc.com/sport/football/videos/cze2r13e0jjo?at_medium=RSS&at_campaign=rss',date:'May 19'},
  {title:'Southend sack Maher two days after Wembley win',src:'BBC Sport',cat:'FOOTBALL',link:'https://www.bbc.com/sport/football/articles/cvgz8vglrm2o?at_medium=RSS&at_campaign=rss',date:'May 19'},
  {title:'Chelsea 2-1 Tottenham: Premier League survival fight goes to final day – as it happened',src:'Guardian PL',cat:'FOOTBALL',link:'https://www.theguardian.com/football/live/2026/may/19/chelsea-v-tottenham-premier-league-live-west-ham',date:'May 19'},
  {title:'Arsenal crowned Premier League champions for first time in 22 years – as it happened',src:'Guardian PL',cat:'FOOTBALL',link:'https://www.theguardian.com/football/live/2026/may/19/arsenal-premier-league-champions-first-time-in-22-years-live-reaction',date:'May 19'},
  {title:'Fernández and Chelsea sink Spurs as survival battle goes to the final day',src:'Guardian PL',cat:'FOOTBALL',link:'https://www.theguardian.com/football/2026/may/19/chelsea-tottenham-premier-league-match-report',date:'May 19'},
  {title:'How to follow Canadian Grand Prix on the BBC',src:'BBC F1',cat:'F1',link:'https://www.bbc.com/sport/formula1/articles/cgmpwzp8pmno?at_medium=RSS&at_campaign=rss',date:'May 18'},
  {title:'What is the format for F1 sprint races in 2026?',src:'BBC F1',cat:'F1',link:'https://www.bbc.com/sport/formula1/articles/c4g236r9npyo?at_medium=RSS&at_campaign=rss',date:'May 18'},
  {title:'Will Mercedes or McLaren land the next punch at F1-s Canadian GP?',src:'Autosport',cat:'F1',link:'https://www.autosport.com/f1/news/will-mercedes-or-mclaren-land-the-next-blow-at-f1s-canadian-gp/10821907/?utm_source=RSS&utm_medium=referral&utm_campaign=RSS-F1&utm_term=News&utm_content=uk',date:'May 18'},
  {title:'Why Ford -loves the V8 idea- in F1 amid changing road car strategy',src:'Autosport',cat:'F1',link:'https://www.autosport.com/f1/news/why-ford-loves-the-v8-idea-in-f1-amid-changing-road-car-strategy/10821863/?utm_source=RSS&utm_medium=referral&utm_campaign=RSS-F1&utm_term=News&utm_content=uk',date:'May 18'},
  {title:'Manchester City win FA Cup and Hearts heartbreak at Celtic | Football Weekly video',src:'Guardian PL',cat:'FOOTBALL',link:'https://www.theguardian.com/football/video/2026/may/18/manchester-city-win-fa-cup-and-hearts-heartbreak-at-celtic-football-weekly-video',date:'May 18'},
  {title:'Cult hero Mancini delivers derby win for Roma after Serie A scheduling nightmare | Nicky Bandini',src:'Guardian Serie A',cat:'FOOTBALL',link:'https://www.theguardian.com/football/2026/may/18/roma-lazio-rome-derby-serie-a',date:'May 18'},
  {title:'St Pauli’s Bundesliga dream dies as Eriksen inspires Wolfsburg in relegation thriller | Andy Brassell',src:'Guardian Bund',cat:'FOOTBALL',link:'https://www.theguardian.com/football/2026/may/18/bundesliga-st-pauli-wolfsburg-relegation-thriller-christian-eriksen',date:'May 18'},
  {title:'Nice fans direct fury at owners as club falls into Ligue 1 relegation playoff',src:'Guardian L1',cat:'FOOTBALL',link:'https://www.theguardian.com/football/2026/may/18/nice-fans-direct-fury-owners-club-falls-ligue-1-relegation-playoff-champions-league-inoes',date:'May 18'},
  {title:'Verstappen 24hr hopes ended by driveshaft after leading',src:'BBC F1',cat:'F1',link:'https://www.bbc.com/sport/motorsport/articles/czx2kpy5kw8o?at_medium=RSS&at_campaign=rss',date:'May 17'},
  {title:'Can Russell take inspiration from Norris in bid for F1 title?',src:'Autosport',cat:'F1',link:'https://www.autosport.com/f1/news/can-george-russell-take-inspiration-from-lando-norris-in-quest-for-f1-title/10821504/?utm_source=RSS&utm_medium=referral&utm_campaign=RSS-F1&utm_term=News&utm_content=uk',date:'May 17'},
  {title:'Inter poised as Curtis Jones enters final year of Liverpool contract',src:'Guardian Serie A',cat:'FOOTBALL',link:'https://www.theguardian.com/football/2026/may/17/inter-poised-as-curtis-jones-enters-final-year-of-liverpool-contract',date:'May 17'},
  {title:'European football: Roma close to Champions League return after beating Lazio',src:'Guardian Serie A',cat:'FOOTBALL',link:'https://www.theguardian.com/football/2026/may/17/european-football-roma-lazio-milan-juventus-napoli',date:'May 17'},
  {title:'After Honda-s first annual loss in 70 years, what does it mean for its F1 project?',src:'Autosport',cat:'F1',link:'https://www.autosport.com/f1/news/honda-reports-first-annual-loss-in-70-years-what-does-it-mean-for-its-f1-project/10821214/?utm_source=RSS&utm_medium=referral&utm_campaign=RSS-F1&utm_term=News&utm_content=uk',date:'May 16'},
  {title:'European football: Kane uncorks title party with hat-trick; Lewandowski to leave Barça',src:'Guardian Bund',cat:'FOOTBALL',link:'https://www.theguardian.com/football/2026/may/16/robert-lewandowski-barcelona-real-madrid-bundesliga-european-roundup',date:'May 16'},
  {title:'Andrew Benson Q&A: Send us your questions',src:'BBC F1',cat:'F1',link:'https://www.bbc.com/sport/formula1/articles/ckg3y15zje8o?at_medium=RSS&at_campaign=rss',date:'May 15'},
  {title:'Former FIA aero chief officially joins Alpine in senior F1 role',src:'Autosport',cat:'F1',link:'https://www.autosport.com/f1/news/former-fia-aero-chief-officially-joins-alpine-in-senior-f1-role/10820964/?utm_source=RSS&utm_medium=referral&utm_campaign=RSS-F1&utm_term=News&utm_content=uk',date:'May 15'},
  {title:'Will F1 go back to the future with its engines?',src:'BBC F1',cat:'F1',link:'https://www.bbc.com/sport/formula1/articles/c2e2zmglvp9o?at_medium=RSS&at_campaign=rss',date:'May 14'},
  {title:'F1: Chequered Flag',src:'BBC F1',cat:'F1',link:'https://www.bbc.co.uk/sounds/play/p0nl0lfk?at_medium=RSS&at_campaign=rss',date:'May 14'},
  {title:'Brown writes to FIA over Mercedes-Alpine ownership concerns',src:'Autosport',cat:'F1',link:'https://www.autosport.com/f1/news/zak-brown-takes-fia-fight-over-mercedes-alpine-f1-talks-public/10820815/?utm_source=RSS&utm_medium=referral&utm_campaign=RSS-F1&utm_term=News&utm_content=uk',date:'May 14'},
  {title:'PSG are deserved Ligue 1 champions but Lens put up an admirable fight | Raphaël Jucobin',src:'Guardian L1',cat:'FOOTBALL',link:'https://www.theguardian.com/football/2026/may/14/psg-ligue-1-champions-lens-pierre-sage-coupe-de-france',date:'May 14'}
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
