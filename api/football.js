// ============================================================
// api/football.js — football scores, FREE-TIER BUDGET SAFE
//
// Request budget strategy (API-Football free = 100 req/day):
//  - ?league=X          → schedule + upcoming. Cached 6 HOURS.
//                         (schedules don't change; scores come from live)
//  - ?type=live         → ONE upstream call (fixtures?live=all) for ALL
//                         leagues at once. Cached 60s. This is the only
//                         endpoint the frontend polls.
//  - ?type=standings    → cached 6 hours
//  - ?type=topscorers   → cached 12 hours
//
// Worst case daily upstream usage: ~8 schedule + ~8 standings
// + live polling (1/min only while matches are live) ≈ 60-80/day. Fits.
// ============================================================

import { cached } from './lib/cache.js';
import { LEAGUES } from './lib/leagues.js';

const TTL_SCHEDULE  = 6 * 3600;   // 6h  — today's fixture list (times/teams)
const TTL_LIVE      = 60;         // 60s — live scores (shared by all users)
const TTL_STANDINGS = 6 * 3600;   // 6h
const TTL_SCORERS   = 12 * 3600;  // 12h

// league id → our league key (for tagging live matches)
const ID_TO_KEY = {};
Object.keys(LEAGUES).forEach(k => { ID_TO_KEY[LEAGUES[k].id] = k; });

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
    leagueId:  f.league ? f.league.id : null,
    leagueKey: f.league ? (ID_TO_KEY[f.league.id] || null) : null,
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
    rank: s.rank, team: s.team.name, logo: s.team.logo,
    played: s.all.played, win: s.all.win, draw: s.all.draw, lose: s.all.lose,
    gd: s.goalsDiff, points: s.points, form: s.form,
  };
}

function simplifyScorer(p) {
  var stat = (p.statistics && p.statistics[0]) || {};
  return {
    name: p.player.name, photo: p.player.photo,
    team: stat.team ? stat.team.name : '',
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
  const today  = new Date().toISOString().split('T')[0];

  try {
    // ── LIVE: one upstream call for EVERYTHING currently live ──────────
    if (type === 'live') {
      const { data, fromCache, ageSeconds } = await cached(
        'cache:football:live-all',
        TTL_LIVE,
        async () => {
          const ld = await fetchFromAPI('/fixtures?live=all&timezone=Asia/Riyadh', apiKey);
          const all = (ld.response || []).map(simplifyFixture)
            // keep only matches in leagues we actually track
            .filter(m => m.leagueKey);
          return { live: all, fetchedAt: Date.now() };
        }
      );
      res.setHeader('X-Cache', fromCache ? 'HIT-' + ageSeconds + 's' : 'MISS');
      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
      return res.status(200).json(data);
    }

    const cfg = LEAGUES[league];
    if (!cfg) return res.status(400).json({ error: 'Unknown league' });

    // ── STANDINGS ───────────────────────────────────────────────────────
    if (type === 'standings') {
      const { data, fromCache, ageSeconds } = await cached(
        'cache:football:standings:' + league,
        TTL_STANDINGS,
        async () => {
          let sd = await fetchFromAPI(`/standings?league=${cfg.id}&season=${cfg.season}`, apiKey);
          let resp = sd.response && sd.response[0];
          let groups = (resp && resp.league && resp.league.standings) || [];
          if (!groups.length) {
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

    // ── TOP SCORERS ─────────────────────────────────────────────────────
    if (type === 'topscorers') {
      const { data, fromCache, ageSeconds } = await cached(
        'cache:football:scorers:' + league,
        TTL_SCORERS,
        async () => {
          const ps = await fetchFromAPI(`/players/topscorers?league=${cfg.id}&season=${cfg.season}`, apiKey);
          const scorers = (ps.response || []).slice(0, 10).map(simplifyScorer);
          return { league, scorers, fetchedAt: Date.now() };
        }
      );
      res.setHeader('X-Cache', fromCache ? 'HIT-' + ageSeconds + 's' : 'MISS');
      return res.status(200).json(data);
    }

    // ── FIXTURES (schedule) — cached 6h, scores overlaid from live ──────
    const { data, fromCache, ageSeconds } = await cached(
      'cache:football:sched:' + league + ':' + today,
      TTL_SCHEDULE,
      async () => {
        const todayData = await fetchFromAPI(
          `/fixtures?league=${cfg.id}&season=${cfg.season}&date=${today}&timezone=Asia/Riyadh`,
          apiKey
        );
        const fixtures = (todayData.response || []).map(simplifyFixture);

        let upcoming = [];
        try {
          const upcomingData = await fetchFromAPI(
            `/fixtures?league=${cfg.id}&season=${cfg.season}&next=10&timezone=Asia/Riyadh`,
            apiKey
          );
          upcoming = (upcomingData.response || []).map(simplifyFixture);
        } catch (e) { /* upcoming optional */ }

        return { league, fixtures, upcoming, fetchedAt: Date.now() };
      }
    );
    res.setHeader('X-Cache', fromCache ? 'HIT-' + ageSeconds + 's' : 'MISS');
    return res.status(200).json(data);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
