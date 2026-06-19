// api/wc.js  — World Cup 2026 live results feed for "Road to 32"
// Source: football-data.org (free tier includes the World Cup, competition code WC).
// Setup: get a free token at football-data.org/client/register, then add it to your
//        Vercel project's env vars as FOOTBALL_DATA_KEY and redeploy.
// Returns only FULL-TIME group-stage results, mapped to the page's 3-letter codes.

// country name (or 3-letter code) -> our codes
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
  drcongo:'COD', congodr:'COD', democraticrepublicofcongo:'COD', democraticrepublicofthecongo:'COD',
  portugal:'POR', colombia:'COL', uzbekistan:'UZB',
  england:'ENG', croatia:'CRO', ghana:'GHA', panama:'PAN'
};
const CODES = new Set(Object.values(ALIAS));
function norm(s){ return (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z]/g,''); }
// resolve a football-data team object to our code: try full name, then short name, then TLA
function toCode(team){
  if(!team) return null;
  return ALIAS[norm(team.name)] || ALIAS[norm(team.shortName)] ||
         (team.tla && CODES.has(team.tla.toUpperCase()) ? team.tla.toUpperCase() : null);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');

  const key = process.env.FOOTBALL_DATA_KEY;
  if (!key) { res.status(500).json({ error: 'FOOTBALL_DATA_KEY not set in Vercel' }); return; }

  try {
    const r = await fetch('https://api.football-data.org/v4/competitions/WC/matches?status=FINISHED', {
      headers: { 'X-Auth-Token': key }
    });
    const data = await r.json();
    if (!r.ok) { res.status(502).json({ error: 'football-data error', detail: data }); return; }

    const matches = [];
    (data.matches || []).forEach(f => {
      const stage = f.stage || '';
      if (stage !== 'GROUP_STAGE') return;                 // group games only
      const gm = (f.group || '').match(/([A-L])\s*$/i);     // "GROUP_A" / "Group A" -> A
      if (!gm) return;
      const home = toCode(f.homeTeam), away = toCode(f.awayTeam);
      if (!home || !away) return;                           // unknown name -> skip
      const ft = f.score && f.score.fullTime;
      if (!ft || ft.home == null || ft.away == null) return;
      matches.push({ group: gm[1].toUpperCase(), home, away, gh: ft.home, ga: ft.away });
    });

    res.status(200).json({ updated: new Date().toISOString(), count: matches.length, matches });
  } catch (e) {
    res.status(502).json({ error: 'fetch failed', detail: String(e) });
  }
}