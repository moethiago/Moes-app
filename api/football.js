// ============================================================
// api/football.js — football scores with KV-backed caching
// Cache TTLs: live scores 30s, upcoming 10min
// ============================================================

import { cached, TTL } from './lib/cache.js';
import { LEAGUES } from './lib/leagues.js';

// LEAGUES + SEASON now live in ./lib/leagues.js

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

function simplifyStanding(s) {
  return {
    rank:   s.rank,
    team:   s.team.name,
    logo:   s.team.logo,
    played: s.all.played,
    win:    s.all.win,
    draw:   s.all.draw,
    lose:   s.all.lose,
    gd:     s.goalsDiff,
    points: s.points,
    form:   s.form,
  };
}

function simplifyScorer(p) {
  var stat = (p.statistics && p.statistics[0]) || {};
  return {
    name:  p.player.name,
    photo: p.player.photo,
    team:  stat.team ? stat.team.name : '',
    goals: stat.goals ? stat.goals.total : 0,
    assists: stat.goals ? stat.goals.assists : 0,
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey) return res.status(500).json({ error: 'No API key' });

  const league = req.query.league || 'epl';
  const type   = req.query.type || 'fixtures';
  const cfg    = LEAGUES[league];
  if (!cfg) return res.status(400).json({ error: 'Unknown league' });

  const today = new Date().toISOString().split('T')[0];

  try {
    // STANDINGS
    if (type === 'standings') {
      const cacheKey = 'cache:football:standings:' + league;
      const { data, fromCache, ageSeconds } = await cached(
        cacheKey,
        TTL.UPCOMING,
        async () => {
          let sd = await fetchFromAPI(`/standings?league=${cfg.id}&season=${cfg.season}`, apiKey);
          let resp = sd.response && sd.response[0];
          let groups = (resp && resp.league && resp.league.standings) || [];
          if (!groups.length) {
            // try next season if the current one has no table yet
            sd = await fetchFromAPI(`/standings?league=${cfg.id}&season=${cfg.season + 1}`, apiKey);
            resp = sd.response && sd.response[0];
            groups = (resp && resp.league && resp.league.standings) || [];
          }
          const table = (groups[0] || []).map(simplifyStanding);
          return { league, standings: table, fetchedAt: Date.now() };
        }
      );
      res.setHeader('X-Cache', fromCache ? 'HIT-' + ageSeconds + 's' : 'MISS');
      return res.status(200).json(data);
    }

    // TOP SCORERS
    if (type === 'topscorers') {
      const cacheKey = 'cache:football:scorers:' + league;
      const { data, fromCache, ageSeconds } = await cached(
        cacheKey,
        TTL.UPCOMING,
        async () => {
          const ps = await fetchFromAPI(`/players/topscorers?league=${cfg.id}&season=${cfg.season}`, apiKey);
          const scorers = (ps.response || []).slice(0, 10).map(simplifyScorer);
          return { league, scorers, fetchedAt: Date.now() };
        }
      );
      res.setHeader('X-Cache', fromCache ? 'HIT-' + ageSeconds + 's' : 'MISS');
      return res.status(200).json(data);
    }

    // FIXTURES (default) — always return BOTH today and next upcoming
    const cacheKey = 'cache:football:' + league + ':' + today;
    const { data, fromCache, ageSeconds } = await cached(
      cacheKey,
      TTL.LIVE_SCORES,
      async () => {
        const todayData = await fetchFromAPI(
          `/fixtures?league=${cfg.id}&season=${cfg.season}&date=${today}&timezone=Asia/Riyadh`,
          apiKey
        );
        const fixtures = (todayData.response || []).map(simplifyFixture);

        // Always fetch the next scheduled fixtures too, so Upcoming is never empty
        let upcoming = [];
        try {
          const upcomingData = await fetchFromAPI(
            `/fixtures?league=${cfg.id}&season=${cfg.season}&next=10&timezone=Asia/Riyadh`,
            apiKey
          );
          upcoming = (upcomingData.response || []).map(simplifyFixture);
        } catch (e) { /* upcoming optional */ }

        // If the current season has no upcoming fixtures yet (off-season / not
        // scheduled), fall back to the next season so the tab still populates.
        if (upcoming.length === 0) {
          try {
            const nextSeasonData = await fetchFromAPI(
              `/fixtures?league=${cfg.id}&season=${cfg.season + 1}&next=10&timezone=Asia/Riyadh`,
              apiKey
            );
            upcoming = (nextSeasonData.response || []).map(simplifyFixture);
          } catch (e) { /* ignore */ }
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
