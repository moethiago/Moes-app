const CACHE = {};
const CACHE_TTL = 30000;

const LEAGUES = {
  epl:        { id: 39,  season: 2025 },
  laliga:     { id: 140, season: 2025 },
  seriea:     { id: 135, season: 2025 },
  bundesliga: { id: 78,  season: 2025 },
  ligue1:     { id: 61,  season: 2025 },
  ucl:        { id: 2,   season: 2025 },
  spl:        { id: 307, season: 2025 },
  nations:    { id: 5,   season: 2024 },
  worldcup:   { id: 1,   season: 2026 },
};

async function fetchFromAPI(path, apiKey) {
  const res = await fetch(`https://v3.football.api-sports.io${path}`, {
    headers: {
      'x-apisports-key': apiKey,
      'x-rapidapi-host': 'v3.football.api-sports.io',
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error('API error ' + res.status);
  return res.json();
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
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');

  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey) return res.status(500).json({ error: 'No API key' });

  const league = req.query.league || 'epl';
  const today  = new Date().toISOString().split('T')[0];
  const cacheKey = league + '_' + today;
  const now = Date.now();

  if (CACHE[cacheKey] && (now - CACHE[cacheKey].ts) < CACHE_TTL) {
    return res.status(200).json(CACHE[cacheKey].data);
  }

  const leagueConfig = LEAGUES[league];
  if (!leagueConfig) return res.status(400).json({ error: 'Unknown league' });

  try {
    // fetch today's fixtures
    const todayData = await fetchFromAPI(
      `/fixtures?league=${leagueConfig.id}&season=${leagueConfig.season}&date=${today}&timezone=Asia/Riyadh`,
      apiKey
    );

    const fixtures = (todayData.response || []).map(simplifyFixture);

    let upcoming = [];

    // if no games today, fetch next 5 upcoming fixtures
    if (fixtures.length === 0) {
      const upcomingData = await fetchFromAPI(
        `/fixtures?league=${leagueConfig.id}&season=${leagueConfig.season}&next=5&timezone=Asia/Riyadh`,
        apiKey
      );
      upcoming = (upcomingData.response || []).map(simplifyFixture);
    }

    const result = { league, fixtures, upcoming, updated: now };
    CACHE[cacheKey] = { data: result, ts: now };
    return res.status(200).json(result);
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
