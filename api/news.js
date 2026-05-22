const https = require('https');
const xml2js = require('xml2js');

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

INCLUDE: confirmed signing with role, confirmed penalty with consequence, confirmed injury affecting race, confirmed sacking/appointment, race result with championship implication.

REJECT — NO EXCEPTIONS: driver/team quotes, denials of rumours, rumours with "linked/could/might/may", technical development updates, vague regulatory news, previews, predictions, human interest.

DUPLICATE RULE: Same event from multiple sources = keep ONLY the single best version. Zero tolerance for duplicates.

Select max 6. Return [] if nothing qualifies.`,

  FOOTBALL: `You are the Football editor. Top 5 leagues and Champions League ONLY.

INCLUDE: confirmed transfer with player name, title won, confirmed sacking with manager name, club expelled/banned, major match result deciding something significant.

REJECT: human interest/feel-good, awards, police/security stories, World Cup squad announcements, quotes/interviews/opinions, previews, "hero/star/ace" without naming player, vague investigations, players "addressing/responding/discussing".

DUPLICATE RULE: Same player/event multiple times = keep ONLY the single clearest version.

Select max 6. Return [] if nothing qualifies.`,

  BAYERN: `You are the Bayern Munich editor.

INCLUDE: confirmed Bayern player transfer with fee/contract, confirmed manager sacked/appointed, confirmed injury with timeline, match result with major title/cup implication.

REJECT: interviews where player discusses/talks/hopes, player quotes, women's team (Bayern Frauen), youth/reserve team, Germany national team stories, rumours with linked/monitored/interested, previews.

DUPLICATE RULE: Same event = keep only best one.

Select max 6. Return [] if nothing qualifies.`,

  SPL: `You are the Saudi Pro League editor.

INCLUDE: match result with title race implication naming specific teams, confirmed transfer with player name, title clinched with specific details.

REJECT: manager quotes about targets, match previews, stories not naming Al Hilal/Al Nassr/Al Ittihad/Al Ahli.

DUPLICATE RULE: "Al Nassr win title" + "Ronaldo wins Saudi title" = SAME EVENT. Keep only the most informative version.

Select max 6. Return [] if nothing qualifies.`,

  KSA: `You are the Saudi Arabia News editor.

INCLUDE: specific economic data with figures, confirmed billion-dollar deals, PIF announcements with figures, Vision 2030 milestones confirmed, real estate/banking data with specific numbers.

REJECT: diplomatic meetings without major outcome, crowd management showcases, Gaza/foreign aid, UK/GCC trade deals, Hajj/religious ceremonies, tourism promotion, anything without specific confirmed figures.

DUPLICATE RULE: Same data point twice = keep only one.

Select max 6. Return [] if nothing qualifies.`,
};

function fetchUrl(url) {
  return new Promise((resolve) => {
    const req = https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NewsBot/1.0)' },
      timeout: 8000,
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', () => resolve(''));
    req.on('timeout', () => { req.destroy(); resolve(''); });
  });
}

async function fetchRSS(src, seenTitles) {
  try {
    const raw = await fetchUrl(src.url);
    if (!raw) return [];
    const parsed = await xml2js.parseStringPromise(raw, { explicitArray: false });
    const channel = parsed.rss?.channel || parsed.feed;
    if (!channel) return [];
    const items = channel.item || channel.entry || [];
    const arr = Array.isArray(items) ? items : [items];
    const results = [];
    const now = Date.now();
    const maxAge = 48 * 3600 * 1000;
    for (const item of arr.slice(0, 15)) {
      const title = (item.title?._ || item.title || '').trim();
      const link  = (item.link?.$?.href || item.link || item.guid?._ || item.guid || '').trim();
      const pub   = (item.pubDate || item.updated || item.published || '').trim();
      if (!title || !link) continue;
      const key = title.toLowerCase().replace(/\W+/g,'').slice(0,50);
      if (seenTitles.has(key)) continue;
      let ts = Math.floor(now / 1000);
      if (pub) {
        const d = new Date(pub);
        if (!isNaN(d.getTime())) {
          if (now - d.getTime() > maxAge) continue;
          ts = Math.floor(d.getTime() / 1000);
        }
      }
      seenTitles.add(key);
      results.push({ title, url: link, source: new URL(src.url).hostname.replace('www.',''), cat: src.cat, ts });
    }
    return results;
  } catch(e) {
    return [];
  }
}

async function callClaude(items, cat) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return [];
  if (!items.length) return [];

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
  const match = text.match(/\[.*?\]/s);
  if (!match) return [];
  try {
    const selected = JSON.parse(match[0]);
    return selected.map(s => {
      const item = { ...items[parseInt(s.idx)] };
      if (s.title?.trim()) item.title = s.title.trim();
      return item;
    }).filter(Boolean);
  } catch(e) {
    return [];
  }
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
    if (!match) return { items: [], sha: data.sha, fullContent: content };
    const pattern = /\{title:'((?:[^'\\]|\\.)*)',src:'((?:[^'\\]|\\.)*)',cat:'([^']*)',link:'((?:[^'\\]|\\.)*)',ts:(\d+)\}/g;
    const items = [];
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
    return { items, sha: data.sha, fullContent: content };
  } catch(e) {
    return { items: [], sha: null, fullContent: '' };
  }
}

function jsStr(text) {
  return text
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
  const maxAge = 48 * 3600;
  const CATEGORIES = ['F1','FOOTBALL','BAYERN','SPL','KSA'];

  try {
    // Step 1 — get current feed from GitHub
    const { items: existingItems, sha, fullContent } = await getCurrentFeed();
    const existing = existingItems.filter(i => (now - i.ts) < maxAge);

    // Step 2 — fetch all RSS in parallel
    const seenTitles = new Set(existing.map(i => i.title.toLowerCase().replace(/\W+/g,'').slice(0,50)));
    const rssResults = await Promise.all(RSS_SOURCES.map(src => fetchRSS(src, seenTitles)));
    const newItems = rssResults.flat();

    // Step 3 — basic dedup
    const seenKeys = new Set();
    const uniqueNew = newItems.filter(item => {
      const key = item.title.toLowerCase().replace(/\W+/g,'').slice(0,60);
      if (seenKeys.has(key)) return false;
      seenKeys.add(key);
      return true;
    });

    // Step 4 — Claude editorial review per category
    const approved = [];
    for (const cat of CATEGORIES) {
      const catItems = uniqueNew.filter(i => i.cat === cat).sort((a,b) => b.ts - a.ts);
      if (!catItems.length) continue;
      try {
        const result = await callClaude(catItems, cat);
        approved.push(...result);
      } catch(e) {
        console.error('Claude failed for ' + cat, e);
      }
    }

    // Step 5 — merge with existing, top 6 per category
    const all = [...existing, ...approved];
    const deduped = [];
    const seenFinal = new Set();
    for (const item of all) {
      const key = item.title.toLowerCase().replace(/\W+/g,'').slice(0,60);
      if (!seenFinal.has(key)) { seenFinal.add(key); deduped.push(item); }
    }

    const final = [];
    for (const cat of CATEGORIES) {
      const catItems = deduped.filter(i => i.cat === cat).sort((a,b) => b.ts - a.ts).slice(0,6);
      final.push(...catItems);
    }

    // Step 6 — write back to GitHub
    if (sha && fullContent) {
      await writeFeed(final, fullContent, sha);
    }

    return res.status(200).json({ ok: true, stories: final.length });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
