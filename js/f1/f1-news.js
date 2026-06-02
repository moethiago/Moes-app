// ============================================================
// f1-news.js — F1 breaking news pulled from the existing feed
// pipeline (features 4, 5). Renders into #f1-news.
// Reuses /api/feed; filters to F1 category.
// ============================================================

var F1_FEED_URL = 'https://moes-app-two.vercel.app/api/feed';

async function loadF1News() {
  var root = document.getElementById('f1-news');
  if (!root) return;
  root.innerHTML = '<div class="f1-api-loading"><div class="f1-spinner"></div><span>Loading F1 news...</span></div>';

  var stories = [];
  // try the in-memory cache first if feed tab already loaded
  if (typeof parsedStoriesCache !== 'undefined' && parsedStoriesCache && parsedStoriesCache.length) {
    stories = parsedStoriesCache.filter(function(s){ return s.cat === 'F1'; });
  }
  if (!stories.length) {
    try {
      var res = await fetch(F1_FEED_URL);
      if (res.ok) {
        var data = await res.json();
        if (data && data.stories) stories = data.stories.filter(function(s){ return s.cat === 'F1'; });
      }
    } catch(e) {}
  }

  if (!stories.length) { root.innerHTML = ''; return; }

  stories.sort(function(a,b){ return (b.pubTs||0) - (a.pubTs||0); });

  // feature 5: biggest story pinned
  var top = stories[0];
  var rest = stories.slice(1, 6);

  function ago(ts) {
    var m = Math.floor((Date.now() - ts*1000)/60000);
    if (m < 1) return 'now'; if (m < 60) return m+'m'; var h=Math.floor(m/60);
    if (h < 24) return h+'h'; return Math.floor(h/24)+'d';
  }

  var html = '<div class="f1a-card f1-news-card"><div class="f1a-h">\u{1F4F0} F1 Breaking</div>';
  html += '<a class="f1-news-top" href="' + top.url + '" target="_blank" rel="noopener">'
    + '<span class="f1-news-top-tag">TOP STORY</span>'
    + '<span class="f1-news-top-title">' + top.title + '</span>'
    + '<span class="f1-news-top-time">' + ago(top.pubTs) + ' ago</span></a>';
  rest.forEach(function(s) {
    html += '<a class="f1-news-row" href="' + s.url + '" target="_blank" rel="noopener">'
      + '<span class="f1-news-dot">\u2022</span>'
      + '<span class="f1-news-title">' + s.title + '</span>'
      + '<span class="f1-news-time">' + ago(s.pubTs) + '</span></a>';
  });
  html += '</div>';
  root.innerHTML = html;
}
