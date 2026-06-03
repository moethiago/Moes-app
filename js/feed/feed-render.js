// ============================================================
// feed-render.js — single news home. All approved stories,
// auto-grouped into category sections, newest-first, no cap.
// No filter pills. This is the only place news lives now.
// ============================================================

var parsedStoriesCache = [];

// Display order + labels + emoji for each category section.
var FEED_SECTIONS = [
  { cat:'F1',       label:'Formula 1',       icon:'\u{1F3CE}\uFE0F' },
  { cat:'FOOTBALL', label:'Football',        icon:'\u26BD' },
  { cat:'BAYERN',   label:'Bayern Munich',   icon:'\u{1F534}' },
  { cat:'SPL',      label:'Saudi Football',  icon:'\u{1F1F8}\u{1F1E6}' },
  { cat:'KSA',      label:'Saudi News',      icon:'\u{1F4F0}' },
];

function renderNewsFeed() {
  var container = document.getElementById('critical-posts');
  if (!container) return;

  var source = parsedStoriesCache.slice();
  if (!source.length) {
    container.innerHTML = '<div class="empty-state">Loading news...</div>';
    return;
  }

  var html = '';
  var tickerTitles = [];

  FEED_SECTIONS.forEach(function(sec) {
    var items = source.filter(function(s) { return s.cat === sec.cat; });
    if (!items.length) return;
    items.sort(function(a, b) { return (b.pubTs || 0) - (a.pubTs || 0); });

    html += '<div class="feed-section">'
      + '<div class="feed-section-head"><span class="feed-section-icon">' + sec.icon + '</span>'
      + '<span class="feed-section-title">' + sec.label + '</span>'
      + '<span class="feed-section-count">' + items.length + '</span></div>';
    items.forEach(function(s) {
      html += makeWireItem(s.title, s.pubTs, s.url);
      if (tickerTitles.length < 12) tickerTitles.push(s.title);
    });
    html += '</div>';
  });

  if (!html) {
    container.innerHTML = '<div class="empty-state">No news right now. Pull to refresh.</div>';
    return;
  }
  container.innerHTML = html;
  setTickerContent(tickerTitles);
}

// kept for any old callers; filter pills are gone now.
function setFeedFilter() { renderNewsFeed(); }