// ============================================================
// api/health-check.js — pings all services, returns status JSON
// Used by admin.html and can be polled by an external monitor
// (e.g. cron-job.org) to detect outages.
// ============================================================

const BASE = 'https://moes-app-two.vercel.app';

function timedFetch(url, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms || 9000);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

async function check(name, url, validate) {
  const started = Date.now();
  try {
    const res = await timedFetch(url, 9000);
    const ms = Date.now() - started;
    if (!res.ok) return { name, ok: false, status: 'down', http: res.status, ms };
    const data = await res.json().catch(() => null);
    if (validate && data) {
      const v = validate(data);
      return { name, ok: v.ok, status: v.ok ? 'up' : 'degraded', detail: v.detail || '', ms };
    }
    return { name, ok: true, status: 'up', ms };
  } catch (e) {
    return { name, ok: false, status: 'down', error: e.name === 'AbortError' ? 'timeout' : e.message, ms: Date.now() - started };
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  const results = await Promise.all([
    check('feed',     BASE + '/api/feed',               d => ({ ok: !!d.ok, detail: (d.count || 0) + ' stories' })),
    check('football', BASE + '/api/football?league=epl', d => ({ ok: !d.error, detail: d.error || 'ok' })),
    check('stats',    BASE + '/api/stats',              d => ({ ok: !!d.ok })),
    check('f1',       'https://api.jolpi.ca/ergast/f1/2026/driverStandings.json', () => ({ ok: true })),
  ]);

  const allOk = results.every(r => r.ok);
  const anyDown = results.some(r => r.status === 'down');

  return res.status(200).json({
    ok: allOk,
    overall: allOk ? 'healthy' : (anyDown ? 'outage' : 'degraded'),
    checkedAt: new Date().toISOString(),
    services: results,
  });
}
