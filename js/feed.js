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
var FALLBACK_NEWS = [];
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
