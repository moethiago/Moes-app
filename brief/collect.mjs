// Runs on a GitHub Actions runner (X blocks Vercel's IPs). Fetches the brief's X accounts via the public
// syndication timelines (keyless, SAR 0), then POSTs the posts to the backend with the one-time nonce it was dispatched with.
// Usage: NONCE=<nonce> node brief/collect.mjs
const API = process.env.BRIEF_API || 'https://moes-app-two.vercel.app/api/feed?brief=1';
const NONCE = process.env.NONCE || '';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const MAX_AGE_H = 26;
if (!NONCE) { console.error('NONCE missing'); process.exit(2); }

const acc = await (await fetch(API + '&accounts=1')).json();
if (!acc.ok) { console.error('accounts failed', acc); process.exit(1); }
const accounts = acc.accounts;
console.log('accounts:', accounts.length);

function parse(html, a) {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/); if (!m) throw new Error('no timeline data');
  const entries = (((JSON.parse(m[1]).props || {}).pageProps || {}).timeline || {}).entries || [];
  const now = Date.now(), out = [];
  for (const e of entries) {
    const t = e && e.content && e.content.tweet; if (!t) continue;
    const src = t.retweeted_status || t;
    let text = String(src.full_text || src.text || '').replace(/https?:\/\/t\.co\/\S+/g, '').replace(/\s+/g, ' ').trim();
    if (src.quoted_status && src.quoted_status.full_text) text += ' ⟶ ' + String(src.quoted_status.full_text).replace(/https?:\/\/t\.co\/\S+/g, '').replace(/\s+/g, ' ').trim().slice(0, 160);
    const ts = new Date(src.created_at || t.created_at).getTime();
    if (!text || text.length < 15 || isNaN(ts) || now - ts > MAX_AGE_H * 3600e3) continue;
    if (/^@\w+/.test(text) && !t.retweeted_status) continue;
    const id = src.id_str || t.id_str; const user = (src.user && src.user.screen_name) || a.handle;
    out.push({ title: text.slice(0, 400), url: 'https://x.com/' + user + '/status/' + id, src: '@' + a.handle, cat: a.cat, weight: a.weight || 7, publishedAt: Math.floor(ts / 1000), likes: Number(src.favorite_count) || 0, rts: Number(src.retweet_count) || 0 });
  }
  return out;
}
const weights = { KSA: 9, VOICE: 8, GULF: 8, WORLD: 8, MARKETS: 7, SPORT: 6, TECH: 6 };
const results = await Promise.allSettled(accounts.map(async a => {
  const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await fetch('https://syndication.twitter.com/srv/timeline-profile/screen-name/' + encodeURIComponent(a.handle), { signal: ctrl.signal, headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return parse(await r.text(), { ...a, weight: weights[a.cat] || 7 });
  } finally { clearTimeout(timer); }
}));
const okSrc = [], failed = []; let tweets = [];
results.forEach((r, i) => { const a = accounts[i]; if (r.status === 'fulfilled' && r.value.length) { okSrc.push('@' + a.handle + ' (' + a.cat + ', ' + r.value.length + ')'); tweets = tweets.concat(r.value); } else failed.push('@' + a.handle + ' (' + a.cat + '): ' + (r.status === 'rejected' ? r.reason.message : 'no recent tweets')); });
console.log('posts:', tweets.length, '| ok:', okSrc.length, '| failed:', failed);
if (tweets.length < 8) {
  console.log('X blocked from this runner — falling back to the news feeds on the backend');
  const fb = await fetch(API + '&build=1&force=1&rss=1'); const fj = await fb.json().catch(() => ({}));
  console.log('fallback:', fb.status, fj.ok ? ('built from feeds · items ' + fj.brief.items.length + ' · also ' + fj.brief.also.length) : JSON.stringify(fj).slice(0, 300));
  process.exit(fj.ok ? 0 : 1);
}
const res = await fetch(API + '&ingest=1', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nonce: NONCE, tweets, okSrc, failed }) });
const j = await res.json().catch(() => ({}));
console.log('backend:', res.status, j.ok ? ('built · items ' + j.brief.items.length + ' · also ' + j.brief.also.length + ' · trending ' + j.brief.trending.length + ' · ' + j.brief.engine + ' · SAR ' + j.brief.costSAR) : JSON.stringify(j).slice(0, 400));
process.exit(j.ok ? 0 : 1);
