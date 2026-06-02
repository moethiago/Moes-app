// ============================================================
// api/football.js — football scores with KV-backed caching
// Cache TTLs: live scores 30s, upcoming 10min
// ============================================================

import { cached, TTL } from './lib/cache.js';

const LEAGUES = {
  epl:        { id: 39,  season: 2026 },
  laliga:     { id: 140, season: 2026 },
  seriea:     { id: 135, season: 2026 },
  bundesliga: { id: 78,  season: 2026 },
  ligue1:     { id: 61,  season: 2026 },
  ucl:        { id: 2,   season: 2026 },
  spl:        { id: 307, season: 2026 },
  nations:    { id: 5,   season: 2026 },
  worldcup:   { id: 1,   season: 2026 },
};

async function fetchFromAPI(path, apiKey) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`https://v3.football.api-sports.io${path}`, {
      headers: {
        'x-apisports-key': apiKey,
        'x-rapidapi-host': 'v3.football.api-sports.io',
      },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error('API error ' + res.status);
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

function simplifyFixture(f) {
  return {
    id:        f.fixture.id,
    status:    f.fixture.status.short,
    elapsed:   f.fixture.status.elapsed,
    time:      f.fixture.date,
    home:      f.teams.home.name,
    homeLogo:  f.teams.home.logo,
    homeScore: f.goals.home,
    away:      f.teams.away.name,
    awayLogo:  f.teams.away.logo,
    awayScore: f.goals.away,
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey) return res.status(500).json({ error: 'No API key' });

  const league = req.query.league || 'epl';
  const cfg    = LEAGUES[league];
  if (!cfg) return res.status(400).json({ error: 'Unknown league' });

  const today    = new Date().toISOString().split('T')[0];
  const cacheKey = 'cache:football:' + league + ':' + today;

  try {
    const { data, fromCache, ageSeconds } = await cached(
      cacheKey,
      TTL.LIVE_SCORES,
      async () => {
        const todayData = await fetchFromAPI(
          `/fixtures?league=${cfg.id}&season=${cfg.season}&date=${today}&timezone=Asia/Riyadh`,
          apiKey
        );
        const fixtures = (todayData.response || []).map(simplifyFixture);

        let upcoming = [];
        if (fixtures.length === 0) {
          const upcomingData = await fetchFromAPI(
            `/fixtures?league=${cfg.id}&season=${cfg.season}&next=5&timezone=Asia/Riyadh`,
            apiKey
          );
          upcoming = (upcomingData.response || []).map(simplifyFixture);
        }
        return { league, fixtures, upcoming, fetchedAt: Date.now() };
      }
    );

    res.setHeader('X-Cache', fromCache ? 'HIT-' + ageSeconds + 's' : 'MISS');
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
