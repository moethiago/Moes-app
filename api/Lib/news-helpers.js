// ============================================================
// news-helpers.js — dedup, RSS parsing, fetching functions
// ============================================================

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

