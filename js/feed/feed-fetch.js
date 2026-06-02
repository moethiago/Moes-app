// ============================================================
// feed-fetch.js — fetch feed from API + localStorage cache
// ============================================================

var FEED_URL       = 'https://moes-app-two.vercel.app/api/feed';
var FEED_CACHE_KEY = 'feedCache_v1';
var FEED_CACHE_TTL = 5 * 60 * 1000; // 5 min

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
  if (loadFromCache()) renderNewsFeed();

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
    renderNewsFeed();
  });
}
