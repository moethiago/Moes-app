// ============================================================
// MOE'S APP - NEWS PIPELINE v2
// Fixes: stale repeats, "6h ago" everywhere, weak filtering
// ============================================================

// ---- Hard-block phrases (case-insensitive substring match) ----
// Strengthened to catch speculation, previews, listicles, and quotes.
const REJECT_PHRASES = [
  // speculation / soft news
  'discusses','talking about','addresses','opens up','speaks out','admits',
  'reveals','insists','hopes to','aims to','targets','dreams of','wants to',
  'could','set to','in talks','linked with','rumour','rumor','speculation',
  'reportedly','allegedly','tipped to','believed to','expected to','poised',
  'eyeing','considering','hint','hints','teases','suggests','denies','dismisses',
  // listicles / opinion / preview format
  'predicted lineup','predicted line-up','player ratings','five things','5 things',
  'three things','3 things','ten things','10 things','what we learned',
  'how to watch','watch live','stream live','live blog','live updates',
  'betting odds','betting tips','best bets','prediction','predictions',
  'fantasy','power ranking','power rankings','talking points','gallery','quiz',
  'round-up','roundup','in numbers','by numbers','preview','look ahead',
  'verdict','column','opinion','analysis:','explained','explainer',
  // human interest
  'tribute','heartfelt','emotional','reacts to','reaction','responds to',
  'family','wife','girlfriend','wedding','holiday',
];

function preFilter(title) {
  if (!title || title.length < 12) return false;
  const lower = title.toLowerCase();
  for (let i = 0; i < REJECT_PHRASES.length; i++) {
    if (lower.includes(REJECT_PHRASES[i])) return false;
  }
  return true;
}

// ---- RSS sources (trimmed - removed the worst speculation farms) ----
const RSS_SOURCES = [
  { url:'https://www.formula1.com/en/latest/all.xml',                               cat:'F1' },
  { url:'https://feeds.bbci.co.uk/sport/formula1/rss.xml',                          cat:'F1' },
  { url:'https://www.autosport.com/rss/f1/news/',                                   cat:'F1' },
  { url:'https://www.motorsport.com/rss/f1/news/',                                  cat:'F1' },
  { url:'https://racefans.net/feed/',                                               cat:'F1' },
  { url:'https://www.skysports.com/rss/12433',                                      cat:'F1' },
  { url:'https://www.reddit.com/r/formula1/top/.rss?sort=top&t=day&limit=10',       cat:'F1' },

  { url:'https://feeds.bbci.co.uk/sport/football/rss.xml',                          cat:'FOOTBALL' },
  { url:'https://www.theguardian.com/football/premierleague/rss',                   cat:'FOOTBALL' },
  { url:'https://www.theguardian.com/football/laliga/rss',                          cat:'FOOTBALL' },
  { url:'https://www.theguardian.com/football/serieafootball/rss',                  cat:'FOOTBALL' },
  { url:'https://www.theguardian.com/football/bundesligafootball/rss',              cat:'FOOTBALL' },
  { url:'https://www.theguardian.com/football/ligue1football/rss',                  cat:'FOOTBALL' },
  { url:'https://www.skysports.com/rss/11095',                                      cat:'FOOTBALL' },
  { url:'https://www.reddit.com/r/soccer/top/.rss?sort=top&t=day&limit=10',         cat:'FOOTBALL' },

  { url:'https://www.bundesliga.com/rss/en/rss-news.rss',                           cat:'BAYERN' },
  { url:'https://www.theguardian.com/football/bundesligafootball/rss',              cat:'BAYERN' },
  { url:'https://www.reddit.com/r/bayernmunich/top/.rss?sort=top&t=day&limit=10',   cat:'BAYERN' },

  { url:'https://www.arabnews.com/cat/5/rss.xml',                                   cat:'SPL' },
  { url:'https://saudigazette.com.sa/rssFeed/74',                                   cat:'SPL' },
  { url:'https://www.reddit.com/r/saudifootball/top/.rss?sort=top&t=day&limit=10',  cat:'SPL' },

  { url:'https://www.arabnews.com/rss.xml',                                         cat:'KSA' },
  { url:'https://www.arabnews.com/economy/rss.xml',                                 cat:'KSA' },
  { url:'https://en.majalla.com/rss.xml',                                           cat:'KSA' },
  { url:'https://feeds.bbci.co.uk/news/world/middle_east/rss.xml',                  cat:'KSA' },
];

const GOOGLE_NEWS_SOURCES = [
  { url:'https://news.google.com/rss/search?q=formula+1+breaking+when:1d&hl=en-US&gl=US&ceid=US:en',                              cat:'F1' },
  { url:'https://news.google.com/rss/search?q=f1+grand+prix+2026+when:1d&hl=en-US&gl=US&ceid=US:en',                              cat:'F1' },
  { url:'https://news.google.com/rss/search?q=premier+league+OR+laliga+transfer+OR+sacked+when:1d&hl=en-US&gl=US&ceid=US:en',     cat:'FOOTBALL' },
  { url:'https://news.google.com/rss/search?q=champions+league+2026+when:1d&hl=en-US&gl=US&ceid=US:en',                           cat:'FOOTBALL' },
  { url:'https://news.google.com/rss/search?q=bayern+munich+when:1d&hl=en-US&gl=US&ceid=US:en',                                   cat:'BAYERN' },
  { url:'https://news.google.com/rss/search?q=al+hilal+OR+al+nassr+OR+saudi+pro+league+when:1d&hl=en-US&gl=US&ceid=US:en',        cat:'SPL' },
  { url:'https://news.google.com/rss/search?q=saudi+arabia+economy+OR+pif+when:1d&hl=en-US&gl=US&ceid=US:en',                     cat:'KSA' },
];

const GDELT_QUERIES = [
  { query:'formula 1 race',                                          cat:'F1' },
  { query:'premier league OR laliga transfer sacked',                cat:'FOOTBALL' },
  { query:'bayern munich',                                           cat:'BAYERN' },
  { query:'al hilal OR al nassr',                                    cat:'SPL' },
  { query:'saudi arabia economy billion',                            cat:'KSA' },
];

const NEWSDATA_QUERIES = [
  { query:'formula 1',             cat:'F1',       language:'en' },
  { query:'football transfer',     cat:'FOOTBALL', language:'en' },
  { query:'bayern munich',         cat:'BAYERN',   language:'en' },
  { query:'saudi pro league',      cat:'SPL',      language:'en' },
  { query:'saudi arabia economy',  cat:'KSA',      language:'en' },
];

const TWITTER_QUERIES = [
  { query:'find tweets from the last 12 hours about F1 confirmed breaking news with high engagement', cat:'F1' },
  { query:'find tweets from the last 12 hours about confirmed football transfers or sackings with high engagement', cat:'FOOTBALL' },
  { query:'find tweets from the last 12 hours about Bayern Munich confirmed news with high engagement', cat:'BAYERN' },
  { query:'find tweets from the last 12 hours about Saudi Pro League confirmed news with high engagement', cat:'SPL' },
  { query:'find tweets from the last 12 hours about Saudi Arabia confirmed economic news with high engagement', cat:'KSA' },
];

const WEB_SEARCH_QUERIES = [
  { query:'F1 2026 latest confirmed news today',                                            cat:'F1' },
  { query:'Premier League OR La Liga OR Serie A confirmed transfer OR manager sacked today', cat:'FOOTBALL' },
  { query:'Bayern Munich latest official news today',                                       cat:'BAYERN' },
  { query:'Al Hilal OR Al Nassr Saudi Pro League official news today',                      cat:'SPL' },
  { query:'Saudi Arabia PIF OR Vision 2030 announcement today billion',                     cat:'KSA' },
];

// ---- Category prompts: stricter recency & verification ----
const CAT_PROMPTS = {
  F1: `You are the F1 editor for a breaking-news app. Today is ${new Date().toUTCString()}.
SCORE each candidate 0-10 based on SPECIFICITY and CONFIRMED FACT:
10 = confirmed driver signing/sacking with team named, race result, FIA penalty issued
8-9 = confirmed contract extension with name, team principal change, factory news with figures
7   = official team announcement with concrete impact
0-6 = REJECT: quotes, opinions, "could", "set to", previews, technical analyses, fan speculation

DUPLICATE RULE: For the same underlying event, KEEP ONLY ONE (clearest, most specific) version.
RECENCY RULE: Only stories about something that HAPPENED in the last 24 hours. Reject anything sounding old.
Return ONLY stories scoring 7 or above.
Return JSON: [{"idx":0,"title":"rewritten headline max 12 words","score":9}]
Return [] if nothing scores 7+.`,

  FOOTBALL: `You are the Football editor for a breaking-news app. Today is ${new Date().toUTCString()}.
Top 5 leagues + Champions League ONLY. SCORE each 0-10:
10 = title won, confirmed sacking of major manager, confirmed transfer WITH fee
8-9 = confirmed transfer with player name AND club, club banned/expelled, decisive cup tie result
7   = confirmed managerial appointment with named club
0-6 = REJECT: quotes, "linked", "could", opinions, player ratings, previews, World Cup squad speculation

DUPLICATE RULE: Same player or event = keep ONE clearest version.
RECENCY RULE: Only news from the last 24 hours. Reject anything that sounds old or recycled.
Return ONLY stories scoring 7+.
Return JSON: [{"idx":0,"title":"rewritten headline max 12 words","score":9}]
Return [] if nothing scores 7+.`,

  BAYERN: `You are the Bayern Munich editor. MUST be specifically about FC Bayern Munich men's first team. Today is ${new Date().toUTCString()}.
SCORE 0-10:
10 = confirmed transfer with fee, manager sacked/appointed
8-9 = confirmed injury with timeline, major match result with title implication
7   = official Bayern statement with concrete content
0-6 = REJECT: quotes, women's team, U19/youth, Germany national team, "linked" rumours, previews

RECENCY: Last 24h only.
DUPLICATE: Same event = ONE version only.
Return JSON: [{"idx":0,"title":"rewritten headline max 12 words","score":9}]
Return [] if nothing qualifies.`,

  SPL: `You are the Saudi Pro League editor. Today is ${new Date().toUTCString()}.
SCORE 0-10:
10 = title clinched, confirmed signing of a major name
8-9 = match result with title-race impact naming Al Hilal/Al Nassr/Al Ittihad/Al Ahli, confirmed sacking
7   = confirmed squad news with specific named player
0-6 = REJECT: manager quotes, previews, stories not naming a specific SPL team

RECENCY: Last 24h only.
DUPLICATE: Same event = ONE version only.
Return JSON: [{"idx":0,"title":"rewritten headline max 12 words","score":9}]
Return [] if nothing qualifies.`,

  KSA: `You are the Saudi Arabia News editor. Focus: economy, PIF, Vision 2030, royal decrees with impact. Today is ${new Date().toUTCString()}.
SCORE 0-10:
10 = confirmed multi-billion-dollar deal with specific figures, major royal decree with economic impact
8-9 = PIF announcement with specific numbers, Vision 2030 milestone with data
7   = confirmed economic statistic or announcement with numbers
0-6 = REJECT: diplomatic visits without outcome, Hajj/religious, tourism without dollar figures, aid stories, anything without specific confirmed numbers

RECENCY: Last 24h only.
DUPLICATE: Same data point = ONE version only.
Return JSON: [{"idx":0,"title":"rewritten headline max 12 words","score":9}]
Return [] if nothing qualifies.`,
};

// ===== HELPERS =================================================
const STOP_WORDS = new Set([
  'the','and','for','with','this','that','from','news','about','has','have','are','was','were','been','being',
  'will','would','should','could','their','they','them','says','said','after','before','into','over','than'
]);

function isSimilar(titleA, titleB) {
  const cleanAndSplit = (text) => new Set(
    text.toLowerCase().replace(/[^a-z0-9 ]/g,'').split(' ')
      .filter(w => w.length > 2 && !STOP_WORDS.has(w))
  );
  const wordsA = cleanAndSplit(titleA);
  const wordsB = cleanAndSplit(titleB);
  if (wordsA.size === 0 || wordsB.size === 0) return false;
  let shared = 0;
  wordsA.forEach(w => { if (wordsB.has(w)) shared++; });
  // STRICTER: 45% overlap of the smaller set triggers dedup (was 55%)
  return (shared / Math.min(wordsA.size, wordsB.size)) >= 0.45;
}

function dedupKey(title) {
  // longer key to reduce false uniques
  return title.toLowerCase().replace(/\W+/g,'').slice(0, 70);
}

function extractTag(xml, tag) {
  const match = xml.match(new RegExp('<' + tag + '[^>]*>([\\s\\S]*?)<\\/' + tag + '>', 'i'));
  return match ? match[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1').trim() : '';
}

function parseRSS(xml, cat, maxAgeHours) {
  const now = Date.now();
  const maxAge = maxAgeHours * 3600 * 1000;
  const items = xml.match(/<(item|entry)[^>]*>[\s\S]*?<\/\1>/gi) || [];
  const results = [];
  for (const item of items.slice(0, 15)) {
    let title = extractTag(item, 'title')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#039;/g,"'")
      .replace(/\s+-\s+[^-]+$/, '').trim();
    let link = extractTag(item, 'link');
    if (!link) {
      const m = item.match(/<link[^>]*href="([^"]+)"/i);
      if (m) link = m[1];
    }
    let pub = extractTag(item, 'pubDate') || extractTag(item, 'published') || extractTag(item, 'updated');
    if (!title || !link || !preFilter(title)) continue;

    // STRICT: must have a real publish date AND must be within window
    if (!pub) continue;
    const d = new Date(pub);
    if (isNaN(d.getTime())) continue;
    if (now - d.getTime() > maxAge) continue;
    if (d.getTime() > now + 3600 * 1000) continue;  // reject future-dated junk

    results.push({
      title, url: link, cat,
      pubTs: Math.floor(d.getTime() / 1000),   // ORIGINAL publish time
    });
  }
  return results;
}

async function fetchRSS(src, seenTitles, maxAgeHours) {
  try {
    const res = await fetch(src.url, {
      signal: AbortSignal.timeout(10000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MoesApp/2.0)' },
    });
    if (!res.ok) return [];
    const xml = await res.text();
    return parseRSS(xml, src.cat, maxAgeHours).filter(item => {
      const k = dedupKey(item.title);
      if (seenTitles.has(k)) return false;
      seenTitles.add(k);
      return true;
    });
  } catch (e) {
    console.error('RSS failed: ' + src.url + ' :: ' + e.message);
    return [];
  }
}

async function fetchGDELT(q, seenTitles) {
  try {
    const url = 'https://api.gdeltproject.org/api/v2/doc/doc?query=' +
      encodeURIComponent(q.query) +
      '&mode=ArtList&maxrecords=15&format=json&sort=DateDesc&timespan=24H';
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return [];
    const data = await res.json();
    const results = [];
    for (const a of (data.articles || [])) {
      const title = (a.title || '').trim();
      if (!title || !preFilter(title)) continue;
      const k = dedupKey(title);
      if (seenTitles.has(k)) continue;
      seenTitles.add(k);
      results.push({
        title, url: a.url, cat: q.cat,
        pubTs: a.seendate ? Math.floor(new Date(a.seendate).getTime() / 1000) : Math.floor(Date.now() / 1000),
      });
    }
    return results;
  } catch (e) { return []; }
}

async function fetchNewsData(q, apiKey, seenTitles) {
  if (!apiKey) return [];
  try {
    const url = 'https://newsdata.io/api/1/news?apikey=' + apiKey +
      '&q=' + encodeURIComponent(q.query) +
      '&language=' + q.language +
      '&category=sports,business,top';
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return [];
    const data = await res.json();
    const results = [];
    for (const a of (data.results || []).slice(0, 15)) {
      const title = (a.title || '').trim();
      const link  = a.link;
      if (!title || !link || !preFilter(title)) continue;
      const k = dedupKey(title);
      if (seenTitles.has(k)) continue;
      seenTitles.add(k);
      const pub = a.pubDate ? new Date(a.pubDate).getTime() : Date.now();
      // STRICT: only last 24h
      if (Date.now() - pub > 24 * 3600 * 1000) continue;
      results.push({ title, url: link, cat: q.cat, pubTs: Math.floor(pub / 1000) });
    }
    return results;
  } catch (e) { return []; }
}

async function claudeWebSearch(query, cat, apiKey, isTwitter) {
  try {
    const prompt = isTwitter
      ? query + '\n\nReturn ONLY a JSON array of confirmed breaking news from tweets in the last 12 hours:\n[{"title":"headline max 12 words","url":"tweet or article url"}]\nOnly tweets with very high engagement containing confirmed facts. No opinions, no reactions, no speculation.\nReturn [] if nothing qualifies. No markdown, just JSON.'
      : 'Search for: "' + query + '"\nReturn ONLY a JSON array of top breaking news from the last 24 hours:\n[{"title":"headline max 12 words","url":"source url"}]\nOnly confirmed factual news. No previews, no opinions, no "could", no "linked", no quotes.\nReturn [] if nothing qualifies. No markdown, just JSON.';

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'web-search-2025-03-05',
      },
      signal: AbortSignal.timeout(25000),
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 800,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const data = await res.json();
    const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    const match = text.match(/\[[\s\S]*?\]/);
    if (!match) return [];
    const now = Math.floor(Date.now() / 1000);
    return JSON.parse(match[0])
      .filter(s => s.title && s.url && preFilter(s.title))
      .map(s => ({
        title:  s.title.trim(),
        url:    s.url,
        cat,
        pubTs:  now,  // assume fresh since we asked for last 24h
      }));
  } catch (e) { return []; }
}

async function callClaudeScorer(items, cat, apiKey) {
  if (!apiKey || !items.length) return [];
  const lines = items.map((item, i) => i + ' | ' + item.title).join('\n');
  const prompt = CAT_PROMPTS[cat] + '\n\nCandidates:\n' + lines + '\n\nReturn ONLY valid JSON. No explanations.';
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const data = await res.json();
    const text = data.content?.[0]?.text || '';
    const match = text.match(/\[[\s\S]*?\]/);
    if (!match) return [];
    return JSON.parse(match[0])
      .filter(s => s.score >= 7)
      .map(s => {
        const idx = parseInt(s.idx);
        if (isNaN(idx) || !items[idx]) return null;
        const item = { ...items[idx], score: s.score };
        if (s.title && s.title.trim()) item.title = s.title.trim();
        return item;
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score);
  } catch (e) { return []; }
}

// ===== GitHub read/write =======================================
async function getCurrentFeed() {
  try {
    const token = process.env.GITHUB_TOKEN;
    const res = await fetch('https://api.github.com/repos/moethiago/Moes-app/contents/js/feed.js', {
      headers: { 'Authorization': 'token ' + token, 'Accept': 'application/vnd.github.v3+json' },
    });
    const data = await res.json();
    const content = Buffer.from(data.content, 'base64').toString('utf8');
    const match = content.match(/\/\/ DO NOT EDIT BELOW THIS LINE\nvar FALLBACK_NEWS = (\[[\s\S]*?\]);\n\/\/ DO NOT EDIT ABOVE THIS LINE/);
    const items = [];
    if (match) {
      // Parse with pubTs OR fallback to ts
      const pattern = /\{title:'((?:[^'\\]|\\.)*)',src:'((?:[^'\\]|\\.)*)',cat:'([^']*)',link:'((?:[^'\\]|\\.)*)',ts:(\d+)(?:,pubTs:(\d+))?\}/g;
      let m;
      while ((m = pattern.exec(match[1])) !== null) {
        items.push({
          title:  m[1].replace(/\\'/g, "'"),
          source: m[2].replace(/\\'/g, "'"),
          cat:    m[3],
          url:    m[4].replace(/\\'/g, "'"),
          ts:     parseInt(m[5]),                              // when first added to feed
          pubTs:  m[6] ? parseInt(m[6]) : parseInt(m[5]),      // original publish time
        });
      }
    }
    return { items, sha: data.sha, fullContent: content };
  } catch (e) { return { items: [], sha: null, fullContent: '' }; }
}

function jsStr(text) {
  return (text || '')
    .replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#039;/g,"'")
    .replace(/&lt;/g,'<').replace(/&gt;/g,'>')
    .replace(/[^\x00-\x7F]/g, '')
    .replace(/\\/g,'').replace(/'/g,"\\'")
    .replace(/[\n\r]/g,' ')
    .replace(/\s+/g,' ').trim();
}

async function writeFeed(items, currentContent, sha) {
  const token = process.env.GITHUB_TOKEN;
  const lines = items.map(i =>
    "  {title:'" + jsStr(i.title) + "',src:'" + jsStr(i.source || 'wire') +
    "',cat:'" + i.cat + "',link:'" + jsStr(i.url) +
    "',ts:" + i.ts + ",pubTs:" + (i.pubTs || i.ts) + "}"
  );
  const newBlock = 'var FALLBACK_NEWS = [\n' + lines.join(',\n') + '\n];';
  const updated = currentContent.replace(
    /\/\/ DO NOT EDIT BELOW THIS LINE\nvar FALLBACK_NEWS = \[[\s\S]*?\];\n\/\/ DO NOT EDIT ABOVE THIS LINE/,
    '// DO NOT EDIT BELOW THIS LINE\n' + newBlock + '\n// DO NOT EDIT ABOVE THIS LINE'
  );
  await fetch('https://api.github.com/repos/moethiago/Moes-app/contents/js/feed.js', {
    method: 'PUT',
    headers: {
      'Authorization': 'token ' + token,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: 'news refresh ' + new Date().toISOString(),
      content: Buffer.from(updated).toString('base64'),
      sha,
    }),
  });

  // bust browser cache via index.html
  const version = Math.floor(Date.now() / 1000);
  const indexRes = await fetch('https://api.github.com/repos/moethiago/Moes-app/contents/index.html', {
    headers: { 'Authorization': 'token ' + token, 'Accept': 'application/vnd.github.v3+json' },
  });
  const indexData = await indexRes.json();
  const indexContent = Buffer.from(indexData.content, 'base64').toString('utf8');
  const indexUpdated = indexContent.replace(/js\/feed\.js\?v=\d+/, 'js/feed.js?v=' + version);
  if (indexUpdated !== indexContent) {
    await fetch('https://api.github.com/repos/moethiago/Moes-app/contents/index.html', {
      method: 'PUT',
      headers: {
        'Authorization': 'token ' + token,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'bump feed cache',
        content: Buffer.from(indexUpdated).toString('base64'),
        sha: indexData.sha,
      }),
    });
  }
}

// ===== MAIN HANDLER ============================================
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const apiKey      = process.env.ANTHROPIC_API_KEY;
  const newsDataKey = process.env.NEWSDATA_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'No Anthropic API key' });

  const now = Math.floor(Date.now() / 1000);

  // ---- KEY CHANGE: separate retention windows ----
  // Retain stories in feed for 24h MAX (was 72h). Old news is bad news.
  const FEED_RETENTION_HOURS = 24;
  // Only INGEST stories published in the last 18h.
  const INGEST_MAX_AGE_HOURS = 18;

  const CATEGORIES = ['F1','FOOTBALL','BAYERN','SPL','KSA'];

  try {
    const { items: existingItems, sha, fullContent } = await getCurrentFeed();

    // 1. Drop existing items older than retention window (by PUBLISH time, not add time)
    const existing = existingItems.filter(i => (now - (i.pubTs || i.ts)) < FEED_RETENTION_HOURS * 3600);

    // 2. Build dedup set from existing
    const seenTitles = new Set(existing.map(i => dedupKey(i.title)));

    // 3. Fetch all streams in parallel
    const [rssResults, gdeltResults, newsdataResults, twitterResults, webResults] = await Promise.all([
      Promise.all([...RSS_SOURCES, ...GOOGLE_NEWS_SOURCES].map(src => fetchRSS(src, seenTitles, INGEST_MAX_AGE_HOURS))),
      Promise.all(GDELT_QUERIES.map(q => fetchGDELT(q, seenTitles))),
      Promise.all(NEWSDATA_QUERIES.map(q => fetchNewsData(q, newsDataKey, seenTitles))),
      Promise.all(TWITTER_QUERIES.map(q => claudeWebSearch(q.query, q.cat, apiKey, true))),
      Promise.all(WEB_SEARCH_QUERIES.map(q => claudeWebSearch(q.query, q.cat, apiKey, false))),
    ]);

    const rssItems      = rssResults.flat();
    const gdeltItems    = gdeltResults.flat();
    const newsdataItems = newsdataResults.flat();
    const twitterItems  = twitterResults.flat().filter(item => {
      if (!preFilter(item.title)) return false;
      const k = dedupKey(item.title);
      if (seenTitles.has(k)) return false;
      seenTitles.add(k);
      return true;
    });
    const webItems = webResults.flat().filter(item => {
      if (!preFilter(item.title)) return false;
      const k = dedupKey(item.title);
      if (seenTitles.has(k)) return false;
      seenTitles.add(k);
      return true;
    });

    console.log('Ingested: RSS=' + rssItems.length + ' GDELT=' + gdeltItems.length +
                ' NewsData=' + newsdataItems.length + ' Twitter=' + twitterItems.length + ' Web=' + webItems.length);

    const allNew = [...rssItems, ...gdeltItems, ...newsdataItems, ...twitterItems, ...webItems];

    // 4. Fuzzy dedup against existing (stricter)
    const trulyNew = allNew.filter(newItem =>
      !existing.some(ex => ex.cat === newItem.cat && isSimilar(newItem.title, ex.title))
    );

    // 5. Fuzzy dedup within the new batch
    const uniqueNew = [];
    for (const item of trulyNew) {
      if (!uniqueNew.some(kept => kept.cat === item.cat && isSimilar(item.title, kept.title))) {
        uniqueNew.push(item);
      }
    }

    console.log('Unique new candidates: ' + uniqueNew.length);

    // 6. Claude editorial scoring per category
    const approvedArrays = await Promise.all(
      CATEGORIES.map(async (cat) => {
        const catItems = uniqueNew.filter(i => i.cat === cat).sort((a,b) => b.pubTs - a.pubTs).slice(0, 30);
        if (!catItems.length) return [];
        const result = await callClaudeScorer(catItems, cat, apiKey);
        console.log(cat + ': ' + result.length + ' approved / ' + catItems.length + ' candidates');
        return result;
      })
    );
    const approved = approvedArrays.flat();

    // 7. Stamp newly approved with current time as "added to feed"
    //    but KEEP their original pubTs for display.
    approved.forEach(item => {
      item.ts = now;
      if (!item.pubTs) item.pubTs = now;
    });

    // 8. Merge existing + new, dedup again, sort by pubTs desc, cap 6 per cat
    const all = [...existing, ...approved];
    const finalDeduped = [];
    for (const item of all) {
      if (!finalDeduped.some(kept => kept.cat === item.cat && isSimilar(item.title, kept.title))) {
        finalDeduped.push(item);
      }
    }

    const final = CATEGORIES.map(cat =>
      finalDeduped
        .filter(i => i.cat === cat)
        .sort((a,b) => (b.pubTs || b.ts) - (a.pubTs || a.ts))   // newest first by PUBLISH time
        .slice(0, 6)
    ).flat();

    console.log('Final feed: ' + final.length + ' stories');

    if (sha && fullContent) {
      await writeFeed(final, fullContent, sha);
    }

    return res.status(200).json({
      ok: true,
      stories: final.length,
      ingested: rssItems.length + gdeltItems.length + newsdataItems.length + twitterItems.length + webItems.length,
      candidates: uniqueNew.length,
      approved: approved.length,
    });
  } catch (e) {
    console.error('Handler error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}