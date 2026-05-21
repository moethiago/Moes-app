// ── FEED.JS ─────────────────────────────────────────────
// Channels: F1, Football (Top 5), Bayern, Saudi Football, Saudi Major News
// Each category is independent - add/remove without touching others

var currentFilter = 'ALL';
var parsedStoriesCache = [];
var tickerTitles = [];
var tickerIndex  = 0;
var tickerTimer  = null;

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
  {title:'Williams recruit McLaren COO Piers Thynne for leadership role',src:'formula1.com',cat:'F1',link:'https://www.formula1.com/en/latest/article/piers-thynne-joins-williams-from-mclaren-as-chief-optimisation-and-planning-officer-amid-raft-of-senior-recruits.10NtETBHXamqiyhB0FTodE',date:'May 21'},
  {title:'Christian Horner targets F1 return with BYD after Red Bull exit',src:'google.news',cat:'F1',link:'https://news.google.com/rss/articles/CBMiwgFBVV95cUxQd0xNcUV3RkRDSW8yeUVXeUx5M0daY3JvWUlMdEJUTGZYdnMzc0ZOak9WR3dwNk5lNG0yVWI5RG1QQUt2ZDZXaFM5NXJ0QVUyQnF0aERVTjEtRGZjMTVKelJUQ25qa1p5akQtUG9mSlRiRDkwb2xJdGpMajIyVFZCVFpsQ0Iyd2tCZk9EWXdvOXpEZUV0MjBXeFp3aDhsTTMtX01SazFLeG1nbHNfQ0swcERhdWJleVIyTjg2U1ZNcUVNZw?oc=5',date:'May 21'},
  {title:'Casemiro leaves Manchester United, Carrick confirms exit',src:'mirror.co.uk',cat:'FOOTBALL',link:'https://www.mirror.co.uk/sport/football/news/casemiro-man-utd-brighton-exit-37189232',date:'May 21'},
  {title:'Jurrien Timber hopes for Arsenal injury recovery before Champions League final',src:'standard.co.uk',cat:'FOOTBALL',link:'https://www.standard.co.uk/sport/football/timber-injury-latest-champions-league-b1283193.html',date:'May 21'},
  {title:'FA opens Southampton investigation over Spygate',src:'bbc.com',cat:'FOOTBALL',link:'https://www.bbc.com/sport/football/articles/crmplprldl8o?at_medium=RSS&at_campaign=rss',date:'May 21'},
  {title:'Neuer, 40, reverses retirement to be Germany\'s first-choice World Cup keeper',src:'bbc.com',cat:'FOOTBALL',link:'https://www.bbc.com/sport/football/articles/c775kgzdmzgo?at_medium=RSS&at_campaign=rss',date:'May 21'},
  {title:'Beers with Prince William, a broken finger and CL next? Villa\'s Europa triumph!',src:'skysports.com',cat:'FOOTBALL',link:'https://www.skysports.com/football/news/11095/13546486/aston-villa-win-europa-league',date:'May 21'},
  {title:'Aston Villa win Europa League, Emery claims fifth title',src:'transfermarkt.co.uk',cat:'FOOTBALL',link:'https://www.transfermarkt.co.uk/aston-villa-win-europa-league-emery-joins-most-successful-coaches-with-5th-european-trophy/view/news/479762',date:'May 20'},
  {title:'Manuel Neuer likely absent for Bayern DFB Cup final',src:'google.news',cat:'BAYERN',link:'https://news.google.com/rss/articles/CBMi6AFBVV95cUxNbU90OG9GWGJUcFhpTmsyQzJPdEpPZ0dNQ1EtU3d0TS0yeUFaLWZ3cTV1eEREeXNCbkN1VHFpbFYteVoyb2RjbDVWYUhHM2RPbG0xbW16M0RmeURLVmFfZXF4b0lPRTJ3YU0tRnVxbzFqZ0p1YVhoUjZxNk1pTmRUbXlOcE1aWmM4bkJWV2R0a256SlpfNlRrSkF5eU9ia1hORGEyWnY1Y29sd1VyaW5pc1RCcGtPNHFLcU9ITzZISE1hYmNtLV9CcG1ldFZ4V3RidDFnQXNZMjRZQVR6QTA2b1B3Z1ZmN2N5?oc=5',date:'May 21'},
  {title:'Bayern considering move for Bisseck from Inter Milan',src:'google.news',cat:'BAYERN',link:'https://news.google.com/rss/articles/CBMidEFVX3lxTE1QMGJXQTZMYXpHXzFLNFlYcXFIRmYtVVdTU0tzTTVyWVdPUFRmV0ltQ21TdDFtUGo1TE83ZlQ2d1loeEg5VF80WDYwMjBSOGxObHViSUpTS3BPYlVxUlVaYnpMMGtnbGFoX19WOEpoWXYtRFlT0gF6QVVfeXFMTWVVc1lMb09jb25QOXIyNkdKMFBSVlo2cnh0aGx5R1BHTktwSzRha1AxZ050cmZJZ1VIRWNZNEQ1ek9tNjZUOEhvM2pTLUlZdjdwcVJka2ZLWVVGckREVGo2Qm9CNW9XMU0wU0ZKOHh1RGJDRzhsZ2p2YlE?oc=5',date:'May 21'},
  {title:'Saudi Arabia and Britain sign Gaza child support agreement',src:'saudigazette.com.sa',cat:'KSA',link:'https://saudigazette.com.sa/article/661487/saudi-arabia/saudi-arabia-britain-sign-deal-to-support-injured-children-in-gaza',date:'May 20'},
  {title:'Saudi Arabia non-oil trade surplus with GCC reaches SR4.47 billion',src:'saudigazette.com.sa',cat:'KSA',link:'https://saudigazette.com.sa/article/661486/saudi-arabia/saudi-arabias-non-oil-trade-surplus-with-gcc-countries-reaches-sr447-billion-in-february',date:'May 20'},
  {title:'Saudi operating revenue index rises 10.2 percent in March',src:'saudigazette.com.sa',cat:'KSA',link:'https://saudigazette.com.sa/article/661481/saudi-arabia/gastat-102-rise-in-saudi-operating-revenue-index-in-march',date:'May 20'},
  {title:'Saudi Awwal Bank signs SR6.4 billion financing agreement with AlBawani',src:'google.news',cat:'KSA',link:'https://news.google.com/rss/articles/CBMiVEFVX3lxTE5PVEpscWV4bE1kVWw2SXVWeVViUndRR3cwZXNzZWM4Unl6R2tXc3BrVGl5YWptOERwbm05WnM0dDl6M2Q4REpjR0JiLU1PeTJTNGxrQw?oc=5',date:'May 20'},
  {title:'Saudi real estate transactions grow 6.8 percent to $29.85 billion in Q1',src:'google.news',cat:'KSA',link:'https://news.google.com/rss/articles/CBMigwJBVV95cUxNWDMxcVZTWVFRZktfNEZuVVFETHEtZ0FiWTBMUzRGOWhRbGtGbmtORWFfekp5aEkyNUVyYWwxOXJUX29RQWVBME9tX2x3amdLVTJ0QTlnR1A2Y0VnLXR3cm1PVXBFRVBDbWlXdmRWcFFQeFpEbm1ybVBNdHpWOWhQWWJGUmlvZVZzQUhyQ2xJanpKM2hDZ0JrM3VuN1lzN3BvZ3Y5Z1cwVTA1TGlsUURWQk45emt2TmhGVW8zQ3NuMHhIdWVrR0dNWExoUWpEVmpWTFhEblFBZm9yNldKZFlPYXRNUlk2bEYwUk1yT1dFc21UVVNTdF9xczdpUGJQZDktcERB?oc=5',date:'May 20'}
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
  // val is either a Unix timestamp (number) or a date string like "May 21"
  var ts;
  if (typeof val === 'number') {
    ts = val;
  } else {
    // parse "May 21" style date string
    try {
      var year = new Date().getFullYear();
      ts = Date.parse(val + ' ' + year);
      if (isNaN(ts)) return val;
    } catch(e) {
      return val;
    }
  }
  var diffMs  = Date.now() - ts;
  var diffMin = Math.floor(diffMs / 60000);
  var diffHr  = Math.floor(diffMs / 3600000);

  if (diffMin < 1)  return 'just now';
  if (diffMin < 60) return diffMin + 'm ago';
  if (diffHr  < 24) return diffHr  + 'h ago';

  // over 24h — show date only, no time
  var d = new Date(ts);
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return months[d.getMonth()] + ' ' + d.getDate();
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
