// ── FEED.JS ─────────────────────────────────────────────
// Channels: F1, Football (Top 5), Bayern, Saudi Football, Saudi Major News
// Each category is independent - add/remove without touching others

var currentFilter = 'ALL';
var parsedStoriesCache = [];
var tickerTitles = [];
var tickerIndex = 0;
var tickerTimer = null;

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
  {title:'Williams sign four senior staff from McLaren, Mercedes and Alpine',src:'motorsport.com',cat:'F1',link:'https://www.motorsport.com/f1/news/williams-poaches-key-leaders-from-mclaren-mercedes-alpine/10822589/?utm_source=RSS&utm_medium=referral&utm_campaign=RSS-F1&utm_term=News&utm_content=www',date:'May 21'},
  {title:'Three Ellas advance through McLaren F1 ranks',src:'bbc.com',cat:'F1',link:'https://www.bbc.com/news/articles/c172x8xg8k5o?at_medium=RSS&at_campaign=rss',date:'May 21'},
  {title:'Las Vegas Grand Prix clears hurdle for F1 contract extension',src:'google.news',cat:'F1',link:'https://news.google.com/rss/articles/CBMioAFBVV95cUxNZVAtUC1Sc0JnRDUyMEF3MERya0ttaUFTXzZ0Q0dCU2hFaFdxeTE1a1Q4Tk41QzhCTVNZclJWSkYzcmtRRHJKbHlJY1J2MVhSMTNZZ3l2RHowUnlISm9WUjNEVEFkOVFuNlRMZVEwVWUzbVB0dGdjdkFUMlFiUWZxNFN6QTlsMHdBNzA4V1ZCVzgtc2J2bWY1Z3NHcnpNb1JO?oc=5',date:'May 21'},
  {title:'ADUO F1 engine rule explained ahead of upgrade review',src:'skysports.com',cat:'F1',link:'https://www.skysports.com/f1/news/12433/13534807/aduo-in-f1-what-is-the-engine-regulation-that-could-define-course-of-2026-formula-1-season',date:'May 20'},
  {title:'Danica Patrick to return to television this weekend',src:'crash.net',cat:'F1',link:'https://www.crash.net/f1/news/1095686/1/danica-patrick-make-tv-return-weekend-after-sky-f1-departure',date:'May 20'},
  {title:'GM technology accelerated Cadillac\'s F1 entry',src:'autosport.com',cat:'F1',link:'https://www.autosport.com/f1/news/how-gm-tech-accelerated-cadillacs-f1-entry/10822240/?utm_source=RSS&utm_medium=referral&utm_campaign=RSS-F1&utm_term=News&utm_content=uk',date:'May 19'},
  {title:'Casemiro leaves Manchester United, Carrick confirms exit',src:'independent.co.uk',cat:'FOOTBALL',link:'https://www.independent.co.uk/sport/football/michael-carrick-brazil-manchester-real-madrid-nottingham-forest-b2981343.html',date:'May 21'},
  {title:'Casemiro leaves Manchester United as Carrick confirms early exit',src:'mirror.co.uk',cat:'FOOTBALL',link:'https://www.mirror.co.uk/sport/football/news/casemiro-man-utd-brighton-exit-37189232',date:'May 21'},
  {title:'Rogers named Europa League Player of the Season',src:'bbc.com',cat:'FOOTBALL',link:'https://www.bbc.com/sport/football/articles/ce3pexj81vdo?at_medium=RSS&at_campaign=rss',date:'May 21'},
  {title:'Arteta learns of title win from crying son at barbecue',src:'bbc.com',cat:'FOOTBALL',link:'https://www.bbc.com/sport/football/articles/cn4p255l5xeo?at_medium=RSS&at_campaign=rss',date:'May 21'},
  {title:'Three police officers assigned to 10,000 England fans at World Cup',src:'bbc.com',cat:'FOOTBALL',link:'https://www.bbc.com/sport/football/articles/c70v1lvz9qko?at_medium=RSS&at_campaign=rss',date:'May 21'},
  {title:'Mane named in Senegal\'s World Cup squad',src:'bbc.com',cat:'FOOTBALL',link:'https://www.bbc.com/sport/football/articles/c3e2dq38evzo?at_medium=RSS&at_campaign=rss',date:'May 21'},
  {title:'Bayern Munich president says Kompany is unsellable and upgrade for club',src:'google.news',cat:'BAYERN',link:'https://news.google.com/rss/articles/CBMirAFBVV95cUxNRUFwQy1LLS16bmdLWnFfSU1HSy03QXRMTHhCTWF0cEtHaEdheGVsek91ZnNmVi1VT0pqdEwyV2g0ZW5RcTNUY1FLVG5NYjB6dVVodTc4b19nNUFiOGVJeE5xRldnRXdrcmZfOGloMkxJUHR3aklPbkRkREE5cVJkSXdueExvVk1tWEZac3ByeG5ZczR1LVRSV1FGU1IxZUpaa1I2NU1aUmpXOEZ6?oc=5',date:'May 21'},
  {title:'Bayern Munich\'s Bischof discusses DFB Cup hopes and Bundesliga title',src:'bundesliga.com',cat:'BAYERN',link:'https://www.bundesliga.com/en/bundesliga/news/tom-bischof-interview-bayern-munich-dfb-cup-final-title-transfer-37491',date:'May 21'},
  {title:'Bayern Munich\'s Stanii: Everyone thinking about next title',src:'bundesliga.com',cat:'BAYERN',link:'https://www.bundesliga.com/en/bundesliga/news/josip-stanisic-interview-bayern-munich-kompany-neuer-world-cup-croatia-37495',date:'May 21'},
  {title:'Saudi Arabia\'s non-oil trade surplus with GCC reaches SR4.47 billion',src:'saudigazette.com.sa',cat:'KSA',link:'https://saudigazette.com.sa/article/661486/saudi-arabia/saudi-arabias-non-oil-trade-surplus-with-gcc-countries-reaches-sr447-billion-in-february',date:'May 20'},
  {title:'Saudi Arabia\'s operating revenue index rises 10.2% in March',src:'saudigazette.com.sa',cat:'KSA',link:'https://saudigazette.com.sa/article/661481/saudi-arabia/gastat-102-rise-in-saudi-operating-revenue-index-in-march',date:'May 20'},
  {title:'Interior Ministry penalizes seven persons for illegal pilgrim transport',src:'saudigazette.com.sa',cat:'KSA',link:'https://saudigazette.com.sa/article/661465/saudi-arabia/interior-ministry-penalizes-7-persons-for-transporting-13-pilgrims-to-makkah-illegally',date:'May 20'},
  {title:'Deputy finance minister attends Saudi Arabia-IMF strategic dialogue',src:'saudigazette.com.sa',cat:'KSA',link:'https://saudigazette.com.sa/article/661460/saudi-arabia/deputy-finance-minister-attends-2nd-saudi-arabia-imf-high-level-strategic-dialogue',date:'May 19'}
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
  if (!titles || !titles.length) return;
  tickerTitles = titles.slice(0, 10);
  tickerIndex  = 0;
  if (tickerTimer) clearInterval(tickerTimer);
  showTickerItem();
  tickerTimer = setInterval(showTickerItem, 4000);
}

function showTickerItem() {
  var el = document.getElementById('ticker');
  if (!el || !tickerTitles.length) return;
  el.classList.remove('fade');
  void el.offsetWidth;
  el.textContent = tickerTitles[tickerIndex];
  el.classList.add('fade');
  tickerIndex = (tickerIndex + 1) % tickerTitles.length;
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
    container.innerHTML = '<div class="empty-state">No stories in this category yet — check back soon</div>';
    setTickerContent(source.slice(0,10).map(function(s){ return s.title; }));
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
