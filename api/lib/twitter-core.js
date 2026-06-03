// ============================================================
// twitter-core.js — pulls recent tweets from a curated list of
// breaking-news accounts via TwitterAPI.io, mapped to the standard
// story shape {title,url,sourceUrl,sourceCat,publishedAt}.
// Needs TWITTERAPI_IO_KEY env var. No-ops cleanly if absent.
// Cost: ~$0.15 / 1000 tweets, monitored every 2h. ~$1-3/month.
// ============================================================

var TWITTERAPI_BASE = 'https://api.twitterapi.io';

// Pull the latest tweets for one account.
async function fetchAccountTweets(account, apiKey, maxAgeHours) {
  try {
    var ctrl = new AbortController();
    var timer = setTimeout(function(){ ctrl.abort(); }, 9000);
    // last_tweets endpoint: recent tweets for a handle
    var url = TWITTERAPI_BASE + '/twitter/user/last_tweets?userName=' + encodeURIComponent(account.handle);
    var res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'X-API-Key': apiKey },
    });
    clearTimeout(timer);
    if (!res.ok) return [];
    var data = await res.json();
    var tweets = (data && (data.tweets || data.data)) || [];
    var now = Date.now();
    var maxAge = (maxAgeHours || 12) * 3600 * 1000;
    var out = [];
    tweets.slice(0, 10).forEach(function(t){
      var text = t.text || t.full_text || '';
      // skip replies and pure retweets (low original-signal)
      if (!text || text.length < 20) return;
      if (text.indexOf('RT @') === 0) return;
      if (t.isReply || t.in_reply_to_status_id) return;
      var created = t.createdAt || t.created_at;
      var ts = created ? Date.parse(created) : now;
      if (isNaN(ts)) ts = now;
      if (now - ts > maxAge) return;
      // first line / trimmed text as the headline
      var title = text.split('\n')[0].replace(/https?:\/\/\S+/g, '').trim();
      if (title.length < 15) return;
      var id = t.id || t.id_str || '';
      out.push({
        title: title,
        url: 'https://x.com/' + account.handle + (id ? '/status/' + id : ''),
        sourceUrl: 'x.com/' + account.handle,
        sourceCat: account.cat,
        publishedAt: Math.floor(ts / 1000),
      });
    });
    return out;
  } catch (e) {
    return [];
  }
}

// Pull all curated accounts. Returns combined story list.
export async function fetchTwitterAccounts(accounts, apiKey, maxAgeHours) {
  if (!apiKey || !accounts || !accounts.length) return [];
  var all = [];
  for (var i = 0; i < accounts.length; i++) {
    var rows = await fetchAccountTweets(accounts[i], apiKey, maxAgeHours);
    all = all.concat(rows);
  }
  return all;
}
