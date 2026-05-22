const https = require('https');

// ── PRE-FILTER — blocks obvious bad stories before Claude ──
const REJECT_PHRASES = [
  'discusses','talking about','addresses','opens up','speaks out',
  'hopes to','aims to','targets','dreams of','wants to',
  'predicted lineup','predicted line-up','player ratings','five things',
  'how to watch','watch live','stream live','betting odds','betting tips',
  'fantasy','power ranking','talking points','gallery','quiz',
  'round-up','roundup','in numbers','by numbers',
  'preview','prediction','look ahead',
];

function preFilter(title) {
  var lower = title.toLowerCase();
  return !REJECT_PHRASES.some(function(phrase) { return lower.indexOf(phrase) !== -1; });
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

const CAT_PROMPTS = {
  F1: `You are the F1 editor. STRICT rules:
INCLUDE: confirmed signing with role, confirmed penalty, confirmed injury affecting race, confirmed sacking/appointment, race result with championship implication.
REJECT: driver quotes, denials, rumours with linked/could/might/may, technical updates, vague regulatory news, previews, human interest.
DUPLICATE RULE: Same event from multiple sources = keep ONLY the single best version. Zero tolerance for duplicates.
Select max 6. Return [] if nothing qualifies.`,

  FOOTBALL: `You are the Football editor. Top 5 leagues and Champions League ONLY.
INCLUDE: confirmed transfer with player name, title won, confirmed sacking with manager name, club expelled/banned, major decisive match result.
REJECT: human interest, awards, police stories, World Cup squad announcements, quotes/interviews/opinions, previews, vague investigations.
DUPLICATE RULE: Same player/event multiple times = keep ONLY the single clearest version.
Select max 6. Return [] if nothing qualifies.`,

  BAYERN: `You are the Bayern Munich editor.
INCLUDE: confirmed Bayern transfer with fee/contract, confirmed manager sacked/appointed, confirmed injury with timeline, match result with major implication.
REJECT: player interviews/quotes/hopes, women's team, youth/reserve team, Germany national team stories, rumours, previews.
DUPLICATE RULE: Same event = keep only best one.
Select max 6. Return [] if nothing qualifies.`,

  SPL: `You are the Saudi Pro League editor.
INCLUDE: match result with title implication naming specific teams, confirmed transfer with player name, title clinched with specific details.
REJECT: manager quotes, match previews, stories not naming Al Hilal/Al Nassr/Al Ittihad/Al Ahli.
DUPLICATE RULE: Same event multiple times = keep only the most informative version.
Select max 6. Return [] if nothing qualifies.`,

  KSA: `You are the Saudi Arabia News editor.
INCLUDE: specific economic data with figures, confirmed billion-dollar deals, PIF announcements with figures, Vision 2030 milestones, real estate/banking data with specific numbers.
REJECT: diplomatic meetings without major outcome, crowd management, Gaza/foreign aid, Hajj/religious ceremonies, tourism, anything without specific confirmed figures.
DUPLICATE RULE: Same data point twice = keep only one.
Select max 6. Return [] if nothing qualifies.`,
};

function isSimilar(titleA, titleB) {
  const wordsA = new Set(titleA.toLowerCase().replace(/[^a-z0-9 ]/g,'').split(' ').filter(w => w.length > 3));
  const wordsB = new Set(titleB.toLowerCase().replace(/[^a-z0-9 ]/g,'').split(' ').filter(w => w.length > 3));
  if (wordsA.size === 0 || wordsB.size === 0) return false;
  let shared = 0;
  wordsA.forEach(w => { if (wordsB.has(w)) shared++; });
  return (shared / Math.min(wordsA.size, wordsB.size)) > 0.5;
}

function extractTags(xml, tag) {
  const results = [];
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  let match;
  while ((match = regex.exec(xml)) !== null) results.push(match[1].trim());
  return results;
}

function extractTag(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? match[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim() : '';
}

function extractAttr(xml, tag, attr) {
  const match = xml.match(new RegExp(`<${tag}[^>]*${attr}="([^"]*)"`, 'i'));
  return match ? match[1].trim() : '';
}

function parseRSS(xml, cat) {
  const now = Date.now();
  const maxAge = 72 * 3600 * 1000;
  const items = extractTags(xml, 'item');
  const entries = items.length ? items : extractTags(xml, 'entry');
  const results = [];
  for (const item of entries.slice(0, 15)) {
    let title = extractTag(item, 'title').replace(/<[^>]+>/g, '').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#039;/g,"'").trim();
    let link  = extractTag(item, 'link') || extractAttr(item, 'link', 'href');
    let pub   = extractTag(item, 'pubDate') || extractTag(item, 'published') || extractTag(item, 'updated');
    if (!title || !link) continue;
    title = title.replace(/\s+-\s+[^-]+$/, '').trim();

    // pre-filter before Claude
    if (!preFilter(title)) continue;

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

function fetchUrl(url) {
  return new Promise((resolve) => {
    try {
      const urlObj = new URL(url);
      const options = {
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NewsBot/1.0)' },
        timeout: 8000,
      };
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
      });
      req.on('error', () => resolve(''));
      req.on('timeout', () => { req.destroy(); resolve(''); });
      req.end();
    } catch(e) { resolve(''); }
  });
}

async function fetchRSS(src, seenTitles) {
  try {
    const raw = await fetchUrl(src.url);
    if (!raw) return [];
    const items = parseRSS(raw, src.cat);
    const results = [];
    for (const item of items) {
      const key = item.title.toLowerCase().replace(/\W+/g,'').slice(0,50);
      if (seenTitles.has(key)) continue;
      seenTitles.add(key);
      const hostname = new URL(src.url).hostname.replace('www.','');
      results.push({ ...item, source: hostname });
    }
    return results;
  } catch(e) { return []; }
}

async function callClaude(items, cat) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || !items.length) return [];
  const lines = items.map((item, i) => `${i} | ${item.title}`).join('\n');
  const prompt = CAT_PROMPTS[cat] + `\n\nCandidates:\n${lines}\n\nReturn ONLY valid JSON array: [{"idx": 0, "title": "rewritten headline"}]\nReturn [] if nothing qualifies. No explanation.`;
  const body = JSON.stringify({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 800,
    messages: [{ role: 'user', content: prompt }],
  });
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body,
  });
  const data = await res.json();
  const text = data.content?.[0]?.text || '';
  const match = text.match(/\[[\s\S]*?\]/);
  if (!match) return [];
  try {
    const selected = JSON.parse(match[0]);
    return selected.map(s => {
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
  const encoded = Buffer.from(updated).toString('base64');
  await fetch('https://api.github.com/repos/moethiago/Moes-app/contents/js/feed.js', {
    method: 'PUT',
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: 'news update via Vercel',
      content: encoded,
      sha,
    }),
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const now = Math.floor(Date.now() / 1000);
  const maxAge = 72 * 3600;
  const CATEGORIES = ['F1','FOOTBALL','BAYERN','SPL','KSA'];

  try {
    const { items: existingItems, sha, fullContent } = await getCurrentFeed();
    const existing = existingItems.filter(i => (now - i.ts) < maxAge);

    const seenTitles = new Set(
      existing.map(i => i.title.toLowerCase().replace(/\W+/g,'').slice(0,50))
    );
    const rssResults = await Promise.all(RSS_SOURCES.map(src => fetchRSS(src, seenTitles)));
    const newItems = rssResults.flat();

    const trulyNew = newItems.filter(newItem => {
      return !existing.some(ex => ex.cat === newItem.cat && isSimilar(newItem.title, ex.title));
    });

    const seenKeys = new Set();
    const uniqueNew = trulyNew.filter(item => {
      const key = item.title.toLowerCase().replace(/\W+/g,'').slice(0,60);
      if (seenKeys.has(key)) return false;
      seenKeys.add(key);
      return true;
    });

    const approved = [];
    for (const cat of CATEGORIES) {
      const catItems = uniqueNew.filter(i => i.cat === cat).sort((a,b) => b.ts - a.ts);
      if (!catItems.length) continue;
      try {
        const result = await callClaude(catItems, cat);
        approved.push(...result);
      } catch(e) {
        console.error('Claude failed for ' + cat + ': ' + e.message);
      }
    }

    const all = [...existing, ...approved];
    const finalDeduped = [];
    for (const item of all) {
      const isDup = finalDeduped.some(kept =>
        kept.cat === item.cat && isSimilar(item.title, kept.title)
      );
      if (!isDup) finalDeduped.push(item);
    }

    const final = [];
    for (const cat of CATEGORIES) {
      const catItems = finalDeduped
        .filter(i => i.cat === cat)
        .sort((a,b) => b.ts - a.ts)
        .slice(0, 6);
      final.push(...catItems);
    }

    if (sha && fullContent) await writeFeed(final, fullContent, sha);

    return res.status(200).json({ ok: true, stories: final.length });
  } catch(e) {
    console.error('Handler error: ' + e.message);
    return res.status(500).json({ error: e.message });
  }
}
