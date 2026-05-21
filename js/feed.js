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
  {title:'Eder Militao reportedly blames sacked Real Madrid manager Xabi Alonso for his injuries',src:'google.news',cat:'FOOTBALL',link:'https://news.google.com/rss/articles/CBMixAFBVV95cUxQdjZFQ1huRm1obG45bzNVc3V0dzQ5VVh5VDdwLVNPcENWQlZTUHR4S1FyaWRxQWd5UkZodUxNQzJCVkxoWHZnX3ZQTGJYRXRqdWNjcnE4V2VHYnlKdDV1Rld6SkY5RzZGVGdNcTk3b1pfN3FQdXpNYU5IYTR4QTktVnhKdE10X28tZEp2Sm9JUk9mQzFGZk5rQlVHQXZveGhFN3F0ZGJtaVlaREpSNlZHNmNITklhMmxaWmVBR2VTU0FGZjBa0gHKAUFVX3lxTE1xUkxKRXBVXzdtV3FUZ21RaU9HSjQ4WDRsREhzdlpJTzFmLTBsamF5clZlR1JPcjJERDdtbnYzQi1TengzVHNJdzRKQk5kRTJEdlg1el81aWh0NkF0cWxNcUgzbWlTM0M2WWt3SGlQbWhvVHZyazlWejcwcGZleC1veXE4ZXF1d09sNHZ6SUZUekRGcmp2SlhTeF84R21FNERvT1JqZHVEZ0hCd3ROTGc3RHRsTVF6dl85TGZQTDRsclhGak1yWVcwY2c?oc=5',date:'May 20'},
  {title:'Southampton appeal against expulsion from playoffs for spying is dismissed',src:'google.news',cat:'FOOTBALL',link:'https://news.google.com/rss/articles/CBMipwFBVV95cUxQbk1samJfaEs5SVp6QWtDeW5ZSDJzblVBUnFvYnY4bU1kbmlkMjlWRnVRaHE0TDBlVDhITXZ3ck9lZUJLeW9rOHZaSHVwMVVpVTJqanpqNkNzTnJEWE1HSVR4Wk1lRnlUVWMwZTJWa2tGYk1fLVhla203YkxuTDF1ZDJCX2VIVGlreFJzMHNpZ0RTMWxhV3h3dXVNWFpoSU9fRkw2Xy1KSQ?oc=5',date:'May 20'},
  {title:'Tonda Eckert\'s future in tatters as Southampton boss faces FA ban after expulsion from Championship play-off final',src:'google.news',cat:'FOOTBALL',link:'https://news.google.com/rss/articles/CBMilgFBVV95cUxPb3FkeFlOQkRlNmt2YTQydFVtTzBJNVdDMWtZNjVHbW9hUUZSeE4wejVONkdqQWdHVUx2X2t2a2x3Y0MwTHBmcmJydGtCRktlVERmTWJZUkFybHhmVWFNaEVLNFdNOHlDbHZxTlhIQzJVVDJpalpfOTl5R3ExbE5YWGRBUXpxU09IcEp6MlVPbHBQM0p3V2c?oc=5',date:'May 20'},
  {title:'Southampton: Eckert \'faces sack and ban\' after \'expel\' verdict as \'furious\' players could sue own club',src:'google.news',cat:'FOOTBALL',link:'https://news.google.com/rss/articles/CBMirgFBVV95cUxNa2V5eEtMV2ZhQ1A5VjBfOUp5ZnllWXlyR1lXbVpSSnJuZDBtU2dNU2RRNjE3dmlmR05wN25Ra0lVQ0l1eXVndUV0TjR3THpWNWpTOTJNS0cyVVBLMmxWZXFtYURGRVViZm1ZNVlHeWVxYXZWZ0dnZW14RlluWjFsb0JVeE1xcVh5bFEycWZXUHUyLU80WVZ4REZWR3hXM1gyaFJQTHRoMklKSk0wOHc?oc=5',date:'May 20'},
  {title:'Bruno Fernandes backs Michael Carrick to turn Man United into title contenders',src:'independent.co.uk',cat:'SPL',link:'https://www.independent.co.uk/sport/football/man-united-bruno-fernandes-michael-carrick-b2980588.html',date:'May 20'},
  {title:'Bernardo Silva: Its time for next generation to take centre stage at Man City',src:'independent.co.uk',cat:'SPL',link:'https://www.independent.co.uk/sport/football/bernardo-silva-etihad-stadium-champions-league-pep-guardiola-kevin-de-bruyne-b2980597.html',date:'May 20'},
  {title:'Uefa confirms major changes to European qualifiers and Nations League',src:'independent.co.uk',cat:'SPL',link:'https://www.independent.co.uk/sport/football/uefa-nations-league-european-qualifiers-changes-b2980583.html',date:'May 20'}
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
