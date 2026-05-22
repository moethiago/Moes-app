const REJECT_PHRASES = [
  'discusses','talking about','addresses','opens up','speaks out',
  'hopes to','aims to','targets','dreams of','wants to',
  'predicted lineup','predicted line-up','player ratings','five things',
  'how to watch','watch live','stream live','betting odds','betting tips',
  'fantasy','power ranking','talking points','gallery','quiz',
  'round-up','roundup','in numbers','by numbers',
  'preview','look ahead','what we learned',
];

function preFilter(title) {
  const lower = title.toLowerCase();
  return !REJECT_PHRASES.some(phrase => lower.includes(phrase));
}

const RSS_SOURCES = [
  { url:'https://www.formula1.com/en/latest/all.xml',                               cat:'F1' },
  { url:'https://feeds.bbci.co.uk/sport/formula1/rss.xml',                         cat:'F1' },
  { url:'https://www.autosport.com/rss/f1/news/',                                   cat:'F1' },
  { url:'https://www.gptoday.net/rss/news/rss.xml',                                 cat:'F1' },
  { url:'https://racer.com/category/formula-1/feed/',                               cat:'F1' },
  { url:'https://www.motorsport.com/rss/f1/news/',                                  cat:'F1' },
  { url:'https://www.crash.net/rss/f1',                                             cat:'F1' },
  { url:'https://www.racefans.net/feed/',                                           cat:'F1' },
  { url:'https://www.skysports.com/rss/12433',                                      cat:'F1' },
  { url:'https://www.reddit.com/r/formula1/top/.rss?sort=top&t=day&limit=10',       cat:'F1' },
  { url:'https://feeds.bbci.co.uk/sport/football/rss.xml',                         cat:'FOOTBALL' },
  { url:'https://www.theguardian.com/football/premierleague/rss',                  cat:'FOOTBALL' },
  { url:'https://www.theguardian.com/football/laliga/rss',                         cat:'FOOTBALL' },
  { url:'https://www.theguardian.com/football/serieafootball/rss',                 cat:'FOOTBALL' },
  { url:'https://www.theguardian.com/football/bundesligafootball/rss',             cat:'FOOTBALL' },
  { url:'https://www.theguardian.com/football/ligue1football/rss',                 cat:'FOOTBALL' },
  { url:'https://www.skysports.com/rss/11095',                                     cat:'FOOTBALL' },
  { url:'https://www.mirror.co.uk/sport/football/rss.xml',                         cat:'FOOTBALL' },
  { url:'https://www.independent.co.uk/sport/football/rss',                        cat:'FOOTBALL' },
  { url:'https://www.marca.com/en/rss/football.xml',                               cat:'FOOTBALL' },
  { url:'https://www.reddit.com/r/soccer/top/.rss?sort=top&t=day&limit=10',        cat:'FOOTBALL' },
  { url:'https://www.sportsmole.co.uk/football/bayern-munich/rss.xml',             cat:'BAYERN' },
  { url:'https://www.bundesliga.com/rss/en/rss-news.rss',                          cat:'BAYERN' },
  { url:'https://www.theguardian.com/football/bundesligafootball/rss',             cat:'BAYERN' },
  { url:'https://www.reddit.com/r/bayernmunich/top/.rss?sort=top&t=day&limit=10',  cat:'BAYERN' },
  { url:'https://www.arabnews.com/cat/5/rss.xml',                                  cat:'SPL' },
  { url:'https://saudigazette.com.sa/rssFeed/74',                                  cat:'SPL' },
  { url:'https://www.reddit.com/r/saudifootball/top/.rss?sort=top&t=day&limit=10', cat:'SPL' },
  { url:'https://www.arabnews.com/rss.xml',                                        cat:'KSA' },
  { url:'https://www.arabnews.com/economy/rss.xml',                                cat:'KSA' },
  { url:'https://en.majalla.com/rss.xml',                                          cat:'KSA' },
  { url:'https://feeds.bbci.co.uk/news/world/middle_east/rss.xml',                 cat:'KSA' },
  { url:'https://www.reddit.com/r/saudiarabia/top/.rss?sort=top&t=day&limit=10',   cat:'KSA' },
];

const GOOGLE_NEWS_SOURCES = [
  { url:'https://news.google.com/rss/search?q=formula+1+breaking&hl=en-US&gl=US&ceid=US:en',                                                cat:'F1' },
  { url:'https://news.google.com/rss/search?q=f1+grand+prix+2026&hl=en-US&gl=US&ceid=US:en',                                                cat:'F1' },
  { url:'https://news.google.com/rss/search?q=premier+league+OR+laliga+OR+serie+a+transfer+OR+sacked+OR+injury&hl=en-US&gl=US&ceid=US:en',  cat:'FOOTBALL' },
  { url:'https://news.google.com/rss/search?q=champions+league+2026&hl=en-US&gl=US&ceid=US:en',                                             cat:'FOOTBALL' },
  { url:'https://news.google.com/rss/search?q=bayern+munich+2026&hl=en-US&gl=US&ceid=US:en',                                                cat:'BAYERN' },
  { url:'https://news.google.com/rss/search?q=al+hilal+OR+al+nassr+OR+saudi+pro+league&hl=en-US&gl=US&ceid=US:en',                          cat:'SPL' },
  { url:'https://news.google.com/rss/search?q=saudi+arabia+economy+OR+investment+OR+billion+OR+pif&hl=en-US&gl=US&ceid=US:en',              cat:'KSA' },
];

const WEB_SEARCH_QUERIES = [
  { query:'Formula 1 breaking news confirmed today 2026',                              cat:'F1' },
  { query:'Premier League La Liga Serie A transfer confirmed sacking injury today',    cat:'FOOTBALL' },
  { query:'Bayern Munich confirmed news today',                                        cat:'BAYERN' },
  { query:'Al Hilal Al Nassr Saudi Pro League news today',                             cat:'SPL' },
  { query:'Saudi Arabia economy investment deal billion today',                        cat:'KSA' },
];

const CAT_PROMPTS = {
  F1: `You are the F1 editor for a breaking news app.
INCLUDE only: confirmed driver signing/sacking with specific role, confirmed race penalty with consequence, confirmed injury affecting race, official FIA or team announcement with real impact, race result with championship implication.
REJECT always: any quote or statement from driver/team, denials, rumours with linked/could/might/may, technical/car development updates, vague regulatory news, previews, predictions, human interest.
DUPLICATE RULE: Same event from any source = keep ONLY the single best version.
Select max 6. Return [] if nothing qualifies.`,

  FOOTBALL: `You are the Football editor. Top 5 leagues and Champions League ONLY.
INCLUDE only: confirmed transfer with player name and clubs, title won or confirmed, confirmed sacking or appointment with manager name, club expelled/banned/penalised, major match result deciding something significant.
REJECT always: human interest or feel-good stories, awards, police or security stories, international/World Cup squad stories, player quotes/interviews/opinions, previews or predictions, stories without a named player or manager, vague investigations without outcome.
DUPLICATE RULE: Same player or event from multiple sources = keep ONLY the single clearest version.
Select max 6. Return [] if nothing qualifies.`,

  BAYERN: `You are the Bayern Munich editor. Must be directly about FC Bayern Munich club.
INCLUDE only: confirmed Bayern transfer in or out, confirmed manager sacked or appointed, confirmed player injury with timeline, Bayern match result with major title or cup implication.
REJECT always: player interviews/quotes/hopes/feelings, Bayern Frauen (women's team), youth or reserve team, Germany national team stories, rumours with linked/monitored/interested, previews.
DUPLICATE RULE: Same event = keep only best version.
Select max 6. Return [] if nothing qualifies.`,

  SPL: `You are the Saudi Pro League editor.
INCLUDE only: match result with title race implication naming Al Hilal/Al Nassr/Al Ittihad/Al Ahli, confirmed transfer involving SPL team with player name, title clinched with specific details, confirmed sacking of SPL manager.
REJECT always: manager quotes about targets or ambitions, match previews, stories not naming a specific SPL team.
DUPLICATE RULE: Same event = keep only most informative version.
Select max 6. Return [] if nothing qualifies.`,

  KSA: `You are the Saudi Arabia News editor.
INCLUDE only: specific economic data with confirmed figures, confirmed billion-dollar investment or deal, PIF announcement with specific figures, major Vision 2030 milestone confirmed, Saudi real estate or banking data with specific numbers, royal decree with economic impact.
REJECT always: diplomatic meetings without major confirmed outcome, crowd management or technology showcases, Gaza or foreign aid stories, Hajj or religious ceremony stories, tourism promotion, anything without specific confirmed figures.
DUPLICATE RULE: Same data point twice = keep only one.
Select max 6. Return [] if nothing qualifies.`,
};

const STOP_WORDS = new Set(['the','and','for','with','this','that','from','news','about','has','have','are','was','were','been','being']);

function isSimilar(titleA, titleB) {
  const cleanAndSplit = (text) => new Set(
    text.toLowerCase().replace(/[^a-z0-9 ]/g,'').split(' ')
      .filter(w => w.length > 1 && !STOP_WORDS.has(w))
  );
  const wordsA = cleanAndSplit(titleA);
  const wordsB = cleanAndSplit(titleB);
  if (wordsA.size === 0 || wordsB.size === 0) return false;
  let shared = 0;
  wordsA.forEach(w => { if (wordsB.has(w)) shared++; });
  return (shared / Math.min(wordsA.size, wordsB.size)) > 0.55;
}

function extractTag(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? match[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1').trim() : '';
}

function parseRSS(xml, cat) {
  const now = Date.now();
  const maxAge = 72 * 3600 * 1000;
  const items = xml.match(/<(item|entry)[^>]*>[\s\S]*?<\/\1>/gi) || [];
  const results = [];
  for (const item of items.slice(0, 15)) {
    let title = extractTag(item, 'title')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#039;/g,"'")
      .replace(/\s+-\s+[^-]+$/, '')
      .trim();
    let link = extractTag(item, 'link');
    if (!link) {
      const m = item.match(/<link[^>]*href="([^"]+)"/i);
      if (m) link = m[1];
    }
    let pub = extractTag(item, 'pubDate') || extractTag(item, 'published') || extractTag(item, 'updated');
    if (!title || !link || !preFilter(title)) continue;
    let ts = Math.floor(now / 1000);
    if (pub) {
      const d = new Date(pub);
      if (!isNaN(d.getTime())) {
        if (now - d.getTime() > maxAge) continue;
        ts = Math.floor(d.getTime() / 1000);
      }
    }
    results.push({ title, url: link, cat, ts });
  }
  return results;
}

async function fetchRSS(src, seenTitles) {
  try {
    const res = await fetch(src.url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NewsBot/2.0)' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const raw = await res.text();
    const items = parseRSS(raw, src.cat);
    const results = [];
    for (const item of items) {
      const key = item.title.toLowerCase().replace(/\W+/g,'').slice(0,50);
      if (seenTitles.has(key)) continue;
      seenTitles.add(key);
      try {
        results.push({ ...item, source: new URL(src.url).hostname.replace('www.','') });
      } catch(e) {}
    }
    return results;
  } catch(e) { return []; }
}

async function claudeWebSearch(query, cat, apiKey) {
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'web-search-2025-03-05',
      },
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{
          role: 'user',
          content: `Search for: "${query}"
Return ONLY a JSON array of top breaking news from the last 24 hours:
[{"title":"headline max 12 words","url":"source url"}]
Only confirmed factual breaking news. No opinions, no previews, no quotes.
Return [] if nothing qualifies. No markdown, just JSON.`
        }]
      }),
    });
    const data = await res.json();
    const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    const match = text.match(/\[[\s\S]*?\]/);
    if (!match) return [];
    return JSON.parse(match[0])
      .filter(s => s.title && s.url)
      .map(s => ({
        title:  s.title.trim(),
        url:    s.url,
        source: 'web.search',
        cat,
        ts:     Math.floor(Date.now() / 1000),
      }));
  } catch(e) {
    console.error('Web search failed for ' + cat + ': ' + e.message);
    return [];
  }
}

async function callClaude(items, cat, apiKey) {
  if (!apiKey || !items.length) return [];
  const lines = items.map((item, i) => `${i} | ${item.title}`).join('\n');
  const prompt = CAT_PROMPTS[cat] + `\n\nCandidates:\n${lines}\n\nReturn ONLY valid JSON array: [{"idx": 0, "title": "rewritten headline"}]. No explanations.`;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 800,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const data = await res.json();
    const text = data.content?.[0]?.text || '';
    const match = text.match(/\[[\s\S]*?\]/);
    if (!match) return [];
    return JSON.parse(match[0]).map(s => {
      const idx = parseInt(s.idx);
      if (isNaN(idx) || !items[idx]) return null;
      const item = { ...items[idx] };
      if (s.title?.trim()) item.title = s.title.trim();
      return item;
    }).filter(Boolean);
  } catch(e) { return []; }
}

async function getCurrentFeed() {
  try {
    const token = process.env.GITHUB_TOKEN;
    const res = await fetch('https://api.github.com/repos/moethiago/Moes-app/contents/js/feed.js', {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });
    const data = await res.json();
    const content = Buffer.from(data.content, 'base64').toString('utf8');
    const match = content.match(/\/\/ DO NOT EDIT BELOW THIS LINE\nvar FALLBACK_NEWS = (\[.*?\]);\n\/\/ DO NOT EDIT ABOVE THIS LINE/s);
    const items = [];
    if (match) {
      const pattern = /\{title:'((?:[^'\\]|\\.)*)',src:'((?:[^'\\]|\\.)*)',cat:'([^']*)',link:'((?:[^'\\]|\\.)*)',ts:(\d+)\}/g;
      let m;
      while ((m = pattern.exec(match[1])) !== null) {
        items.push({
          title:  m[1].replace(/\\'/g, "'"),
          source: m[2].replace(/\\'/g, "'"),
          cat:    m[3],
          url:    m[4].replace(/\\'/g, "'"),
          ts:     parseInt(m[5]),
        });
      }
    }
    return { items, sha: data.sha, fullContent: content };
  } catch(e) { return { items: [], sha: null, fullContent: '' }; }
}

function jsStr(text) {
  return (text || '')
    .replace(/&amp;/g,'&').replace(/&quot;/g,'"')
    .replace(/&#039;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>')
    .replace(/[^\x00-\x7F]/g, '')
    .replace(/\\/g,'').replace(/'/g,"\\'")
    .replace(/[\n\r]/g,' ')
    .replace(/\s+/g,' ').trim();
}

async function writeFeed(items, currentContent, sha) {
  const token = process.env.GITHUB_TOKEN;
  const lines = items.map(i =>
    `  {title:'${jsStr(i.title)}',src:'${jsStr(i.source)}',cat:'${i.cat}',link:'${jsStr(i.url)}',ts:${i.ts}}`
  );
  const newBlock = `var FALLBACK_NEWS = [\n${lines.join(',\n')}\n];`;
  const updated = currentContent.replace(
    /\/\/ DO NOT EDIT BELOW THIS LINE\nvar FALLBACK_NEWS = \[.*?\];\n\/\/ DO NOT EDIT ABOVE THIS LINE/s,
    `// DO NOT EDIT BELOW THIS LINE\n${newBlock}\n// DO NOT EDIT ABOVE THIS LINE`
  );

  // write feed.js
  const feedRes = await fetch('https://api.github.com/repos/moethiago/Moes-app/contents/js/feed.js', {
    method: 'PUT',
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: 'news update via Vercel',
      content: Buffer.from(updated).toString('base64'),
      sha,
    }),
  });

  // update index.html version number so browser cache busts
  const version = Math.floor(Date.now() / 1000);
  const indexRes = await fetch('https://api.github.com/repos/moethiago/Moes-app/contents/index.html', {
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
    },
  });
  const indexData = await indexRes.json();
  const indexContent = Buffer.from(indexData.content, 'base64').toString('utf8');
  const indexUpdated = indexContent.replace(
    /js\/feed\.js\?v=\d+/,
    `js/feed.js?v=${version}`
  );
  await fetch('https://api.github.com/repos/moethiago/Moes-app/contents/index.html', {
    method: 'PUT',
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: 'bump feed version',
      content: Buffer.from(indexUpdated).toString('base64'),
      sha: indexData.sha,
    }),
  });
}


export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'No Anthropic API key' });

  const now = Math.floor(Date.now() / 1000);
  const maxAge = 72 * 3600;
  const CATEGORIES = ['F1','FOOTBALL','BAYERN','SPL','KSA'];

  try {
    const { items: existingItems, sha, fullContent } = await getCurrentFeed();
    const existing = existingItems.filter(i => (now - i.ts) < maxAge);
    const seenTitles = new Set(existing.map(i => i.title.toLowerCase().replace(/\W+/g,'').slice(0,50)));

    // Fetch all RSS + Google News in parallel
    const allSources = [...RSS_SOURCES, ...GOOGLE_NEWS_SOURCES];
    const rssResults = await Promise.all(allSources.map(src => fetchRSS(src, seenTitles)));
    const rssItems = rssResults.flat();
    console.log('RSS + Google News: ' + rssItems.length + ' items');

    // Claude web search in parallel for all categories
    const webSearchResults = await Promise.all(
      WEB_SEARCH_QUERIES.map(q => claudeWebSearch(q.query, q.cat, apiKey))
    );
    const webItems = webSearchResults.flat().filter(item => {
      const key = item.title.toLowerCase().replace(/\W+/g,'').slice(0,50);
      if (seenTitles.has(key) || !preFilter(item.title)) return false;
      seenTitles.add(key);
      return true;
    });
    console.log('Web search: ' + webItems.length + ' items');

    // Combine and deduplicate
    const allNew = [...rssItems, ...webItems];
    const trulyNew = allNew.filter(newItem =>
      !existing.some(ex => ex.cat === newItem.cat && isSimilar(newItem.title, ex.title))
    );
    const seenKeys = new Set();
    const uniqueNew = trulyNew.filter(item => {
      const key = item.title.toLowerCase().replace(/\W+/g,'').slice(0,60);
      if (seenKeys.has(key)) return false;
      seenKeys.add(key);
      return true;
    });
    console.log('Unique new: ' + uniqueNew.length + ' items');

    // Claude editorial review — all categories in parallel
    const approvedArrays = await Promise.all(
      CATEGORIES.map(async (cat) => {
        const catItems = uniqueNew.filter(i => i.cat === cat).sort((a,b) => b.ts - a.ts);
        if (!catItems.length) return [];
        const result = await callClaude(catItems, cat, apiKey);
        console.log(cat + ': ' + result.length + ' approved from ' + catItems.length);
        return result;
      })
    );
    const approved = approvedArrays.flat();

    // Merge with existing, final dedup, sort newest first, top 6 per category
    const all = [...existing, ...approved];
    const finalDeduped = [];
    for (const item of all) {
      if (!finalDeduped.some(kept => kept.cat === item.cat && isSimilar(item.title, kept.title))) {
        finalDeduped.push(item);
      }
    }

    const final = CATEGORIES.map(cat =>
      finalDeduped.filter(i => i.cat === cat).sort((a,b) => b.ts - a.ts).slice(0, 6)
    ).flat();

    console.log('Final feed: ' + final.length + ' stories');

    if (sha && fullContent) await writeFeed(final, fullContent, sha);

    return res.status(200).json({ ok: true, stories: final.length });
  } catch(e) {
    console.error('Handler error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}
