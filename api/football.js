const CACHE = {};
const CACHE_TTL = 30000; // 30 seconds

const LEAGUES = {
  epl:        { id: 39,  season: 2025 },
  laliga:     { id: 140, season: 2025 },
  seriea:     { id: 135, season: 2025 },
  bundesliga: { id: 78,  season: 2025 },
  ligue1:     { id: 61,  season: 2025 },
  ucl:        { id: 2,   season: 2025 },
  spl:        { id: 307, season: 2025 },
  nations:    { id: 5,   season: 2024 },
};

async function fetchFixtures(leagueId, season, apiKey) {
  const today = new Date().toISOString().split('T')[0];
  const url = `https://v3.football.api-sports.io/fixtures?league=${leagueId}&season=${season}&date=${today}`;
  const res = await fetch(url, {
    headers: {
      'x-apisports-key': apiKey,
      'x-rapidapi-host': 'v3.football.api-sports.io',
    }
  });
  if (!res.ok) throw new Error('API error ' + res.status);
  const data = await res.json();
  return data.response || [];
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');

  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  const league = req.query.league || 'epl';
  const cacheKey = league + '_' + new Date().toISOString().split('T')[0];
  const now = Date.now();

  if (CACHE[cacheKey] && (now - CACHE[cacheKey].ts) < CACHE_TTL) {
    return res.status(200).json(CACHE[cacheKey].data);
  }

  const leagueConfig = LEAGUES[league];
  if (!leagueConfig) {
    return res.status(400).json({ error: 'Unknown league: ' + league });
  }

  try {
    const fixtures = await fetchFixtures(leagueConfig.id, leagueConfig.season, apiKey);

    const simplified = fixtures.map(function(f) {
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
        venue:     f.fixture.venue.name,
      };
    });

    const result = { league: league, fixtures: simplified, updated: now };
    CACHE[cacheKey] = { data: result, ts: now };

    return res.status(200).json(result);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
