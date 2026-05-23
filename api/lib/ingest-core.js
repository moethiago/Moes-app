// ============================================================
// ingest-core.js — RSS parsing + content hash
// ============================================================

import crypto from 'crypto';

const STOP_WORDS = new Set([
  'the','and','for','with','this','that','from','news','about','has','have','are','was','were',
  'will','would','should','could','their','they','them','says','said','after','before','into','over',
  'as','to','of','in','on','at','by','an','a','is','it','be','or','but','not','our','his','her','its'
]);

// Normalise title and produce stable hash — used as story ID
export function storyId(title) {
  const normalized = title
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g,' ')
    .split(' ')
    .filter(w => w.length > 2 && !STOP_WORDS.has(w))
    .sort()
    .join(' ');
  return crypto.createHash('sha1').update(normalized).digest('hex').slice(0, 12);
}

function extractTag(xml, tag) {
  const match = xml.match(new RegExp('<' + tag + '[^>]*>([\\s\\S]*?)<\\/' + tag + '>', 'i'));
  return match ? match[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1').trim() : '';
}

function decodeEntities(s) {
  return (s || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+-\s+[^-]+$/, '')  // drop trailing " - Source Name"
    .trim();
}

export function parseRSS(xml, sourceCat, sourceUrl, maxAgeHours) {
  const now = Date.now();
  const maxAge = maxAgeHours * 3600 * 1000;
  const items = xml.match(/<(item|entry)[^>]*>[\s\S]*?<\/\1>/gi) || [];
  const results = [];

  for (const item of items.slice(0, 20)) {
    let title = decodeEntities(extractTag(item, 'title'));
    let link  = extractTag(item, 'link');
    if (!link) {
      const m = item.match(/<link[^>]*href="([^"]+)"/i);
      if (m) link = m[1];
    }
    const pub = extractTag(item, 'pubDate') ||
                extractTag(item, 'published') ||
                extractTag(item, 'updated');

    if (!title || title.length < 12 || !link || !pub) continue;
    const d = new Date(pub);
    if (isNaN(d.getTime())) continue;
    const ts = d.getTime();
    if (now - ts > maxAge) continue;
    if (ts > now + 3600 * 1000) continue; // future-dated junk

    results.push({
      title,
      url: link,
      sourceUrl,
      sourceCat,
      publishedAt: Math.floor(ts / 1000),
    });
  }
  return results;
}

export async function fetchSource(src, maxAgeHours) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    const res = await fetch(src.url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MoesApp/3.0)' },
    });
    clearTimeout(timer);
    if (!res.ok) return [];
    const xml = await res.text();
    return parseRSS(xml, src.cat, src.url, maxAgeHours);
  } catch (e) {
    return [];
  }
}
