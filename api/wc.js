// api/wc.js  — World Cup 2026 live results feed for "Road to 32"
// Deploy this in the repo connected to your moes-app-two Vercel project.
// Reads API_FOOTBALL_KEY from your Vercel env vars (already set).
// Returns only FULL-TIME group-stage results, mapped to the page's 3-letter codes.

// --- map API-Football country names -> our codes (handles spelling variants) ---
const ALIAS = {
  mexico:'MEX', southafrica:'RSA', southkorea:'KOR', korearepublic:'KOR', korea:'KOR',
  czechia:'CZE', czechrepublic:'CZE',
  switzerland:'SUI', qatar:'QAT', canada:'CAN',
  bosniaandherzegovina:'BIH', bosniaherzegovina:'BIH',
  scotland:'SCO', haiti:'HAI', brazil:'BRA', morocco:'MAR',
  usa:'USA', unitedstates:'USA', unitedstatesofamerica:'USA',
  paraguay:'PAR', australia:'AUS', turkey:'TUR', turkiye:'TUR',
  germany:'GER', curacao:'CUW',
  ivorycoast:'CIV', cotedivoire:'CIV', ecuador:'ECU',
  sweden:'SWE', tunisia:'TUN', netherlands:'NED', japan:'JPN',
  belgium:'BEL', egypt:'EGY', iran:'IRN', iriran:'IRN', islamicrepublicofiran:'IRN',
  newzealand:'NZL', spain:'ESP', capeverde:'CPV', caboverde:'CPV', capeverdeislands:'CPV',
  saudiarabia:'KSA', uruguay:'URU', norway:'NOR', iraq:'IRQ', france:'FRA', senegal:'SEN',
  argentina:'ARG', algeria:'ALG', austria:'AUT', jordan:'JOR',
  drcongo:'COD', congodr:'COD', democraticrepublicofthecongo:'COD',
  portugal:'POR', colombia:'COL', uzbekistan:'UZB',
  england:'ENG', croatia:'CRO', ghana:'GHA', panama:'PAN'
};
function norm(s){ return (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z]/g,''); }

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');

  const key = process.env.API_FOOTBALL_KEY;
  if (!key) { res.status(500).json({ error: 'API_FOOTBALL_KEY not set in Vercel' }); return; }

  try {
    // League 1 = FIFA World Cup. Season 2026 = the 2026 tournament.
    const r = await fetch('https://v3.football.api-sports.io/fixtures?league=1&season=2026', {
      headers: { 'x-apisports-key': key }   // RapidAPI users: use x-rapidapi-key + x-rapidapi-host instead
    });
    const data = await r.json();
    const matches = [];

    (data.response || []).forEach(f => {
      const round = (f.league && f.league.round) || '';
      const gm = round.match(/Group\s+([A-L])/i);
      if (!gm) return;                                  // skip knockout rounds
      const home = ALIAS[norm(f.teams.home.name)];
      const away = ALIAS[norm(f.teams.away.name)];
      if (!home || !away) return;                       // unknown name → skip
      const st = f.fixture.status.short;
      if (!['FT', 'AET', 'PEN'].includes(st)) return;   // full-time only
      matches.push({ group: gm[1].toUpperCase(), home, away, gh: f.goals.home, ga: f.goals.away });
    });

    res.status(200).json({ updated: new Date().toISOString(), count: matches.length, matches });
  } catch (e) {
    res.status(502).json({ error: 'fetch failed', detail: String(e) });
  }
}