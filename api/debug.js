// ============================================================
// api/debug.js — one-shot live diagnostic. No cache, plain English.
// Visit: /api/debug?secret=YOUR_SECRET
// Tests, in order:
//   1. Env vars present?
//   2. Gemini embedding call — does it return a real vector?
//   3. KV write -> read -> delete round-trip (same method as ingest)
//   4. TwitterAPI.io — does one account return tweets?
//   5. Live story sample — how many in KV actually have embeddings?
// ============================================================

import { embedText } from './_lib/embed-core.js';
import { TWITTER_ACCOUNTS } from './_lib/sources.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  if (req.query.secret !== process.env.DEPLOY_SECRET) {
    return res.status(403).json({ error: 'bad secret' });
  }

  const out = [];
  const log = (step, ok, msg) => out.push({ step, status: ok ? 'PASS' : 'FAIL', msg });

  // 1. ENV VARS
  const envs = {
    GEMINI_API_KEY:     !!process.env.GEMINI_API_KEY,
    TWITTERAPI_IO_KEY:  !!process.env.TWITTERAPI_IO_KEY,
    ANTHROPIC_API_KEY:  !!process.env.ANTHROPIC_API_KEY,
    KV_REST_API_URL:    !!(process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL),
    KV_REST_API_TOKEN:  !!(process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN),
  };
  for (const k in envs) log('env:' + k, envs[k], envs[k] ? 'set' : 'MISSING — set it in Vercel');

  // 2. GEMINI EMBEDDING — the big one
  if (envs.GEMINI_API_KEY) {
    try {
      const vec = await embedText('Leclerc signs new Ferrari contract', process.env.GEMINI_API_KEY);
      if (Array.isArray(vec) && vec.length > 0) {
        log('gemini:embed', true, 'returned a ' + vec.length + '-number vector. EMBEDDINGS WORK.');
      } else {
        // call the API raw to get the actual error text
        let raw = '';
        try {
          const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
            body: JSON.stringify({ content: { parts: [{ text: 'test' }] }, taskType: 'SEMANTIC_SIMILARITY', outputDimensionality: 768 }),
          });
          raw = 'HTTP ' + r.status + ': ' + (await r.text()).slice(0, 300);
        } catch (e) { raw = 'fetch threw: ' + e.message; }
        log('gemini:embed', false, 'NO vector returned. Raw API said: ' + raw);
      }
    } catch (e) {
      log('gemini:embed', false, 'threw: ' + e.message);
    }
  } else {
    log('gemini:embed', false, 'skipped — no GEMINI_API_KEY');
  }

  // 3. KV ROUND-TRIP (same POST pipeline ingest uses)
  const KV_URL   = process.env.KV_REST_API_URL   || process.env.UPSTASH_REDIS_REST_URL;
  const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  async function kvCall(cmd) {
    const r = await fetch(KV_URL, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + KV_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify(cmd),
    });
    return (await r.json()).result;
  }
  if (KV_URL && KV_TOKEN) {
    try {
      const tk = 'debug:test:' + Date.now();
      await kvCall(['SET', tk, 'hello', 'EX', '60']);
      const got = await kvCall(['GET', tk]);
      await kvCall(['DEL', tk]);
      const gone = await kvCall(['GET', tk]);
      const ok = got === 'hello' && (gone === null || gone === undefined);
      log('kv:roundtrip', ok, ok ? 'write/read/delete all work' : 'mismatch: wrote "hello", read "' + got + '", after del "' + gone + '"');
    } catch (e) {
      log('kv:roundtrip', false, 'threw: ' + e.message);
    }
  }

  // 4. TWITTERAPI.IO — does one account return tweets?
  if (envs.TWITTERAPI_IO_KEY && TWITTER_ACCOUNTS && TWITTER_ACCOUNTS.length) {
    const acct = TWITTER_ACCOUNTS[0];
    try {
      const r = await fetch('https://api.twitterapi.io/twitter/user/last_tweets?userName=' + encodeURIComponent(acct.handle), {
        headers: { 'x-api-key': process.env.TWITTERAPI_IO_KEY },
      });
      if (!r.ok) {
        log('twitter:fetch', false, '@' + acct.handle + ' HTTP ' + r.status + ': ' + (await r.text()).slice(0, 200));
      } else {
        const d = await r.json();
        let tweets = [];
        if (Array.isArray(d.tweets)) tweets = d.tweets;
        else if (d.data && Array.isArray(d.data.tweets)) tweets = d.data.tweets;
        else if (Array.isArray(d.data)) tweets = d.data;
        log('twitter:fetch', tweets.length > 0, '@' + acct.handle + ' returned ' + tweets.length + ' tweets'
          + (tweets[0] ? ' (latest: "' + String(tweets[0].text || '').slice(0, 50) + '...")' : ' — raw keys: ' + Object.keys(d).join(',')));
      }
    } catch (e) {
      log('twitter:fetch', false, 'threw: ' + e.message);
    }
  } else {
    log('twitter:fetch', false, 'skipped — no TWITTERAPI_IO_KEY');
  }

  // 5. HOW MANY STORED STORIES HAVE EMBEDDINGS?
  if (KV_URL && KV_TOKEN) {
    try {
      // scan a few story keys and check their embedding field
      const scan = await kvCall(['SCAN', '0', 'MATCH', 'story:*', 'COUNT', '50']);
      const keys = (scan && scan[1]) || [];
      let withEmb = 0, checked = 0;
      for (const k of keys.slice(0, 15)) {
        const raw = await kvCall(['GET', k]);
        checked++;
        try { if (JSON.parse(raw).embedding) withEmb++; } catch (e) {}
      }
      log('kv:embeddings', withEmb > 0,
        withEmb + ' of ' + checked + ' sampled stories have embeddings'
        + (withEmb === 0 ? ' — run a fresh ingest AFTER confirming gemini:embed passes' : ''));
    } catch (e) {
      log('kv:embeddings', false, 'threw: ' + e.message);
    }
  }

  const verdict = out.every(o => o.status === 'PASS') ? 'ALL GOOD' : 'SOME CHECKS FAILED — see msgs above';
  return res.status(200).json({ verdict, tests: out });
}