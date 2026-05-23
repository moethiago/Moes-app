var currentFilter = 'ALL';
var parsedStoriesCache = [];
var tickerTitles = [];
var tickerIndex  = 0;
var tickerTimer  = null;

function timeAgo(ts) {
  var diffMs  = Date.now() - (ts * 1000);
  var diffMin = Math.floor(diffMs / 60000);
  var diffHr  = Math.floor(diffMs / 3600000);
  if (diffMin < 1)  return 'just now';
  if (diffMin < 60) return diffMin + 'm ago';
  if (diffHr  < 24) return diffHr  + 'h ago';
  var d = new Date(ts * 1000);
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return months[d.getMonth()] + ' ' + d.getDate();
}

function boldEntities(text) {
  var KEY_ENTITIES = [
    'Hamilton','Verstappen','Norris','Leclerc','Russell','Antonelli','Piastri','Alonso','Sainz','Perez',
    'Red Bull','McLaren','Ferrari','Mercedes','Aston Martin','Alpine','Williams',
    'Arsenal','Man City','Liverpool','Chelsea','Tottenham','Man United','Newcastle',
    'Real Madrid','Barcelona','Atletico','Bayern','Dortmund','PSG','Juventus','Inter','Milan','Napoli',
    'Al Hilal','Al Nassr','Al Ittihad','Al Ahli',
    'Ronaldo','Neymar','Benzema','Mane','Salah','Haaland','Mbappe','Bellingham','Kane',
    'Guardiola','Klopp','Ancelotti','Mourinho','Tuchel','Conte','Arteta','Kompany',
    'Vision 2030','PIF','NEOM','Saudi Aramco','Casemiro','Musiala','Olise',
  ];
  KEY_ENTITIES.forEach(function(ent) {
    text = text.replace(new RegExp('\\b' + ent + '\\b', 'gi'), '<strong>$&</strong>');
  });
  return text;
}

function makeWireItem(title, displayTs, link) {
  return '<div class="wire-item" onclick="window.open(\'' + link + '\',\'_blank\')">'
    + '<span class="wire-bullet">•</span>'
    + '<div class="wire-content">'
    +   '<p class="wire-headline">' + boldEntities(title) + '</p>'
    +   '<div class="wire-meta">'
    +     '<span class="wire-time">' + timeAgo(displayTs) + '</span>'
    +   '</div>'
    + '</div>'
    + '</div>';
}

function setFeedFilter(cat, el) {
  currentFilter = cat;
  document.querySelectorAll('.fpill').forEach(function(p) { p.classList.remove('active'); });
  if (el) el.classList.add('active');
  renderNewsFeed();
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

var FEED_URL    = 'https://moes-app-two.vercel.app/api/feed';
var FEED_CACHE_KEY = 'feedCache_v1';
var FEED_CACHE_TTL = 5 * 60 * 1000; // 5 min

function renderNewsFeed() {
  var container = document.getElementById('critical-posts');
  if (!container) return;

  var source   = parsedStoriesCache.slice();
  var filtered = currentFilter === 'ALL'
    ? source
    : source.filter(function(s) { return s.cat === currentFilter; });

  filtered.sort(function(a, b) { return (b.pubTs || 0) - (a.pubTs || 0); });

  var shown = filtered.slice(0, 30);
  if (!shown.length) {
    container.innerHTML = '<div class="empty-state">No stories in this category yet</div>';
    setTickerContent(source.slice(0,10).map(function(s) { return s.title; }));
    return;
  }

  var html = '';
  shown.forEach(function(s) {
    html += makeWireItem(s.title, s.pubTs, s.url);
  });
  container.innerHTML = html;
  setTickerContent(shown.map(function(s) { return s.title; }));
}

function loadFromCache() {
  try {
    var raw = localStorage.getItem(FEED_CACHE_KEY);
    if (!raw) return false;
    var obj = JSON.parse(raw);
    if (!obj.ts || Date.now() - obj.ts > FEED_CACHE_TTL) return false;
    parsedStoriesCache = obj.stories || [];
    return parsedStoriesCache.length > 0;
  } catch (e) { return false; }
}

function saveToCache(stories) {
  try {
    localStorage.setItem(FEED_CACHE_KEY, JSON.stringify({ ts: Date.now(), stories: stories }));
  } catch (e) {}
}

function loadNewsFeed() {
  // 1. Render from cache instantly if we have one
  if (loadFromCache()) renderNewsFeed();

  // 2. Fetch fresh from API in background
  fetch(FEED_URL).then(function(r) {
    if (!r.ok) throw new Error('feed http ' + r.status);
    return r.json();
  }).then(function(data) {
    if (!data || !data.stories) return;
    parsedStoriesCache = data.stories;
    saveToCache(data.stories);
    renderNewsFeed();
  }).catch(function(e) {
    console.error('Feed fetch failed:', e.message);
    // Keep showing cached/empty state — no fallback to bundled data
    renderNewsFeed();
  });
}

// ── FALLBACK_NEWS - updated automatically by Vercel ──
