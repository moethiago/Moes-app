var parsedStoriesCache = [];
var currentFilter = 'ALL';

var FALLBACK_NEWS = [
  { title:'Kimi Antonelli leads F1 standings with 20pt advantage into Canadian GP', src:'BBC F1', cat:'F1', link:'https://www.bbc.com/sport/formula1', date:'May 19' },
  { title:'Canadian GP Sprint weekend - Race lights out Sunday May 24 at 20:00 UTC', src:'Sky F1', cat:'F1', link:'https://www.skysports.com/f1', date:'May 19' },
  { title:'George Russell seeking form reversal in Montreal after difficult Miami GP', src:'BBC F1', cat:'F1', link:'https://www.bbc.com/sport/formula1', date:'May 19' },
  { title:'McLaren close gap to Mercedes - Norris pushes Antonelli to the limit in Miami', src:'BBC F1', cat:'F1', link:'https://www.bbc.com/sport/formula1', date:'May 18' },
  { title:'Arsenal beat Burnley 1-0 - Gunners strengthen title push ahead of final day', src:'BBC Sport', cat:'FOOTBALL', link:'https://www.bbc.com/sport/football', date:'May 18' },
  { title:'Chelsea vs Tottenham tonight - London derby to decide European qualification', src:'Sky Sports', cat:'FOOTBALL', link:'https://www.skysports.com/football', date:'May 19' },
  { title:'Man City vs Bournemouth - Guardiola warns of difficult test at Vitality Stadium', src:'BBC Sport', cat:'FOOTBALL', link:'https://www.bbc.com/sport/football', date:'May 19' },
  { title:'Real Madrid beat Sevilla 1-0 - Bellingham goal keeps La Liga title hopes alive', src:'BBC Sport', cat:'FOOTBALL', link:'https://www.bbc.com/sport/football', date:'May 17' },
  { title:'Al Hilal crowned Saudi Pro League champions 2026 - Mitrovic wins golden boot', src:'Arab News', cat:'KSA', link:'https://www.arabnews.com/sport', date:'May 18' },
  { title:'Al Nassr miss out on Saudi title - Ronaldo vows to return stronger', src:'Arab News', cat:'KSA', link:'https://www.arabnews.com/sport', date:'May 18' },
  { title:'Saudi Arabia 2034 World Cup infrastructure plans confirmed by FIFA', src:'Arab News', cat:'KSA', link:'https://www.arabnews.com/sport', date:'May 16' },
];

var KEY_ENTITIES = [
  'Hamilton','Verstappen','Norris','Leclerc','Russell','Antonelli','Piastri','Alonso',
  'Arsenal','Man City','Liverpool','Chelsea','Real Madrid','Barcelona','Bayern',
  'Al Nassr','Al Hilal','Ronaldo','Saudi Pro League','Grand Prix','McLaren','Ferrari','Mercedes'
];

var MASTER_CHANNELS = [
  { name:'BBC F1',       url:'https://feeds.bbci.co.uk/sport/formula1/rss.xml', cat:'F1'       },
  { name:'BBC Football', url:'https://feeds.bbci.co.uk/sport/football/rss.xml',  cat:'FOOTBALL' },
  { name:'Sky F1',       url:'https://www.skysports.com/rss/12040',              cat:'F1'       },
  { name:'Sky Football', url:'https://www.skysports.com/rss/11095',              cat:'FOOTBALL' },
  { name:'TalkSport',    url:'https://talksport.com/feed/',                      cat:'FOOTBALL' },
  { name:'Arab News',    url:'https://www.arabnews.com/cat/5/rss.xml',           cat:'KSA'      },
];

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
  var items = titles.slice(0, 8).map(function(t) {
    return '<span class="ticker-item">• ' + t.substring(0, 70) + '</span>';
  }).join('');
  track.innerHTML = items + items;
}

function renderNewsFeed() {
  var container = document.getElementById('critical-posts');
  if (!container) return;
  var source = parsedStoriesCache.length ? parsedStoriesCache : FALLBACK_NEWS;
  var filtered = currentFilter === 'ALL' ? source : source.filter(function(s) { return s.cat === currentFilter; });
  var shown = filtered.slice(0, 20);
  if (!shown.length) {
    container.innerHTML = '<div class="empty-state">No headlines — tap REFRESH</div>';
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
    var res = await fetch('https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(channel.url) + '&count=8', { signal: controller.signal });
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
        parsedStoriesCache.push({
          title: item.title.replace(/[\r\n]+/g, ' ').trim(),
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
