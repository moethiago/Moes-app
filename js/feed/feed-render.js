// ============================================================
// feed-render.js — filter state + render the news list
// ============================================================

var currentFilter = 'ALL';
var parsedStoriesCache = [];

function setFeedFilter(cat, el) {
  currentFilter = cat;
  document.querySelectorAll('.fpill').forEach(function(p) { p.classList.remove('active'); });
  if (el) el.classList.add('active');
  renderNewsFeed();
}

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
