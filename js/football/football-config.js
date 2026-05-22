// ============================================================
// football-config.js — leagues list, backend URL
// Edit this file to add/remove leagues
// ============================================================

var BACKEND_URL = 'https://moes-app-two.vercel.app/api/football';

var FOOTBALL_LEAGUES = [
  { key:'epl',        label:'Premier League',  flag:'ENG' },
  { key:'laliga',     label:'La Liga',          flag:'ESP' },
  { key:'seriea',     label:'Serie A',          flag:'ITA' },
  { key:'bundesliga', label:'Bundesliga',       flag:'GER' },
  { key:'ligue1',     label:'Ligue 1',          flag:'FRA' },
  { key:'ucl',        label:'Champions League', flag:'UCL' },
  { key:'spl',        label:'Saudi Pro League', flag:'KSA' },
  { key:'nations',    label:'Nations League',   flag:'UEFA' },
];

var footballTimer = null;
