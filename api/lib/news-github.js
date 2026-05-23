// ============================================================
// news-github.js — read and write feed.js via GitHub API
// ============================================================

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

