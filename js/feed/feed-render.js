// ============================================================
// feed-render.js — news feed with per-category "Clear" button
// Cleared categories stored in localStorage, reset when new
// stories arrive that are newer than the clear timestamp.
// ============================================================

var parsedStoriesCache = [];

// Display order + labels + emoji for each category section.
var FEED_SECTIONS = [
  { cat:'F1',       label:'Formula 1',      icon:'\u{1F3CE}\uFE0F' },
  { cat:'FOOTBALL', label:'Football',       icon:'\u26BD' },
  { cat:'BAYERN',   label:'Bayern Munich',  icon:'\u{1F534}' },
  { cat:'SPL',      label:'Saudi Football', icon:'\u{1F1F8}\u{1F1E6}' },
  { cat:'KSA',      label:'Saudi News',     icon:'\u{1F4F0}' },
];

// ── CLEAR STORAGE ─────────────────────────────────────────────
// Key: 'feedCleared_v1' → { CAT: clearTimestamp (unix seconds) }

function getClearedMap() {
  try { return JSON.parse(localStorage.getItem('feedCleared_v1') || '{}'); }
  catch(e) { return {}; }
}

function saveClearedMap(map) {
  try { localStorage.setItem('feedCleared_v1', JSON.stringify(map)); }
  catch(e) {}
}

// Clear all stories in a category up to now
function clearCategory(cat) {
  var map = getClearedMap();
  map[cat] = Math.floor(Date.now() / 1000); // unix seconds = same unit as pubTs
  saveClearedMap(map);
  renderNewsFeed();
}

// ── RENDER ────────────────────────────────────────────────────

function renderNewsFeed() {
  var container = document.getElementById('critical-posts');
  if (!container) return;

  var source = parsedStoriesCache.slice();
  if (!source.length) {
    container.innerHTML = '<div class="empty-state">Loading news...</div>';
    return;
  }

  var cleared = getClearedMap();
  var html = '';
  var tickerTitles = [];
  var totalVisible = 0;

  FEED_SECTIONS.forEach(function(sec) {
    var clearTs = cleared[sec.cat] || 0;

    // Only show stories newer than the clear timestamp for this category
    var items = source.filter(function(s) {
      return s.cat === sec.cat && (s.pubTs || 0) > clearTs;
    });

    // Count total stories in this cat (including cleared ones) for the "X cleared" badge
    var totalInCat = source.filter(function(s) { return s.cat === sec.cat; }).length;
    var clearedCount = totalInCat - items.length;

    if (!totalInCat) return; // category has no stories at all, skip section

    totalVisible += items.length;
    items.sort(function(a, b) { return (b.pubTs || 0) - (a.pubTs || 0); });

    // Section header with Clear button
    html += '<div class="feed-section" id="feed-section-' + sec.cat + '">';
    html += '<div class="feed-section-head">'
      + '<span class="feed-section-icon">' + sec.icon + '</span>'
      + '<span class="feed-section-title">' + sec.label + '</span>'
      + '<div class="feed-section-actions">';

    if (items.length > 0) {
      html += '<span class="feed-section-count">' + items.length + '</span>'
        + '<button class="feed-clear-btn" onclick="clearCategory(\'' + sec.cat + '\')" title="Clear ' + sec.label + ' news">'
        + 'Clear \u2715</button>';
    } else {
      // All cleared - show "cleared" state with unread count if any came in after clear
      html += '<span class="feed-cleared-badge">cleared</span>';
      if (clearedCount > 0) {
        html += '<button class="feed-restore-btn" onclick="restoreCategory(\'' + sec.cat + '\')">'
          + 'Show ' + clearedCount + '</button>';
      }
    }

    html += '</div></div>'; // close feed-section-actions + feed-section-head

    // Stories
    if (items.length > 0) {
      items.forEach(function(s) {
        html += makeWireItem(s.title, s.pubTs, s.url);
        if (tickerTitles.length < 12) tickerTitles.push(s.title);
      });
    } else {
      html += '<div class="feed-section-empty">'
        + '\u2714 All caught up · New stories will appear automatically'
        + '</div>';
    }

    html += '</div>'; // close feed-section
  });

  if (!html) {
    container.innerHTML = '<div class="empty-state">No news right now.</div>';
    return;
  }

  container.innerHTML = html;
  if (tickerTitles.length) setTickerContent(tickerTitles);
}

// Restore a cleared category (undo clear)
function restoreCategory(cat) {
  var map = getClearedMap();
  delete map[cat];
  saveClearedMap(map);
  renderNewsFeed();
}

// kept for any old callers
function setFeedFilter() { renderNewsFeed(); }
