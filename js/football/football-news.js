// ============================================================
// football-news.js — football news pulled from the feed pipeline.
// Combines FOOTBALL + SPL (Saudi football) + BAYERN categories.
// Renders into #football-news-body.
// ============================================================

var FT_FEED_URL = 'https://moes-app-two.vercel.app/api/feed';
var FT_NEWS_CATS = ['FOOTBALL', 'SPL', 'BAYERN'];

async function loadFootballNews() {
  var root = document.getElementById('football-news-body');
  if (!root) return;
  root.innerHTML = '<div class="fxt-loading"><div class="f1-spinner"></div><span>Loading football news...</span></div>';

  var stories = [];
  // Always hit the API directly (don't rely on the Feed tab having been opened)
  try {
    var res = await fetch(FT_FEED_URL);
    if (res.ok) {
      var data = await res.json();
      if (data && data.stories) {
        stories = data.stories.filter(function(s){ return FT_NEWS_CATS.indexOf(s.cat) !== -1; });
      }
    }
  } catch(e) {}

  // Fall back to in-memory cache if the API gave nothing
  if (!stories.length && typeof parsedStoriesCache !== 'undefined' && parsedStoriesCache && parsedStoriesCache.length) {
    stories = parsedStoriesCache.filter(function(s){ return FT_NEWS_CATS.indexOf(s.cat) !== -1; });
  }

  if (!stories.length) {
    root.innerHTML = '<div class="f1a-card"><div class="f1a-h">\u26BD Football News</div>'
      + '<div class="f1a-sub">No football stories scored in the feed right now. News appears here as the pipeline ingests and scores football, Saudi football, and Bayern stories.</div></div>';
    return;
  }

  stories.sort(function(a,b){ return (b.pubTs||0) - (a.pubTs||0); });

  function ago(ts){ var m=Math.floor((Date.now()-ts*1000)/60000); if(m<1)return'now'; if(m<60)return m+'m'; var h=Math.floor(m/60); if(h<24)return h+'h'; return Math.floor(h/24)+'d'; }
  function tag(cat){ return cat==='SPL'?'🇸🇦':(cat==='BAYERN'?'🔴':'⚽'); }

  var top = stories[0];
  var rest = stories.slice(1, 15);

  var html = '<div class="f1a-card f1-news-card"><div class="f1a-h">⚽ Football Breaking</div>';
  html += '<a class="f1-news-top" href="' + top.url + '" target="_blank" rel="noopener">'
    + '<span class="f1-news-top-tag">' + tag(top.cat) + ' TOP STORY</span>'
    + '<span class="f1-news-top-title">' + top.title + '</span>'
    + '<span class="f1-news-top-time">' + ago(top.pubTs) + ' ago</span></a>';
  rest.forEach(function(s){
    html += '<a class="f1-news-row" href="' + s.url + '" target="_blank" rel="noopener">'
      + '<span class="f1-news-dot">' + tag(s.cat) + '</span>'
      + '<span class="f1-news-title">' + s.title + '</span>'
      + '<span class="f1-news-time">' + ago(s.pubTs) + '</span></a>';
  });
  html += '</div>';
  root.innerHTML = html;
}
