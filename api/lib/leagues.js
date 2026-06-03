// ============================================================
// leagues.js — API-Football league IDs + current season
// Edit season here once per year (single source of truth)
// ============================================================

// API-Football labels a season by the YEAR IT STARTS. The 2025-26
// European season is "2025". The backend automatically falls forward to
// SEASON+1 for upcoming fixtures once the new season is scheduled, so this
// only needs bumping when a whole new cycle is fully under way.
export const SEASON = 2025;

export const LEAGUES = {
  epl:        { id: 39,  season: SEASON },
  laliga:     { id: 140, season: SEASON },
  seriea:     { id: 135, season: SEASON },
  bundesliga: { id: 78,  season: SEASON },
  ligue1:     { id: 61,  season: SEASON },
  ucl:        { id: 2,   season: SEASON },
  spl:        { id: 307, season: SEASON },
  nations:    { id: 5,   season: SEASON },
  worldcup:   { id: 1,   season: SEASON },
};
