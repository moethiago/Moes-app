var currentFilter = 'ALL';
var parsedStoriesCache = [];
var tickerTitles = [];
var tickerIndex  = 0;
var tickerTimer  = null;

function timeAgo(ts) {
  var diffMs  = Date.now() - (ts * 1000);
  var diffMin = Math.floor(diffMs / 60000);
  var diffHr  = Math.floor(diffMs / 3600000);
  if (diffMin < 1)  return 'just now';
  if (diffMin < 60) return diffMin + 'm ago';
  if (diffHr  < 24) return diffHr  + 'h ago';
  var d = new Date(ts * 1000);
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return months[d.getMonth()] + ' ' + d.getDate();
}

function boldEntities(text) {
  var KEY_ENTITIES = [
    'Hamilton','Verstappen','Norris','Leclerc','Russell','Antonelli','Piastri','Alonso','Sainz','Perez',
    'Red Bull','McLaren','Ferrari','Mercedes','Aston Martin','Alpine','Williams',
    'Arsenal','Man City','Liverpool','Chelsea','Tottenham','Man United','Newcastle',
    'Real Madrid','Barcelona','Atletico','Bayern','Dortmund','PSG','Juventus','Inter','Milan','Napoli',
    'Al Hilal','Al Nassr','Al Ittihad','Al Ahli',
    'Ronaldo','Neymar','Benzema','Mane','Salah','Haaland','Mbappe','Bellingham','Kane',
    'Guardiola','Klopp','Ancelotti','Mourinho','Tuchel','Conte','Arteta','Kompany',
    'Vision 2030','PIF','NEOM','Saudi Aramco','Casemiro','Musiala','Olise',
  ];
  KEY_ENTITIES.forEach(function(ent) {
    text = text.replace(new RegExp('\\b' + ent + '\\b', 'gi'), '<strong>$&</strong>');
  });
  return text;
}

function makeWireItem(title, displayTs, link) {
  return '<div class="wire-item" onclick="window.open(\'' + link + '\',\'_blank\')">'
    + '<span class="wire-bullet">•</span>'
    + '<div class="wire-content">'
    +   '<p class="wire-headline">' + boldEntities(title) + '</p>'
    +   '<div class="wire-meta">'
    +     '<span class="wire-time">' + timeAgo(displayTs) + '</span>'
    +   '</div>'
    + '</div>'
    + '</div>';
}

function setFeedFilter(cat, el) {
  currentFilter = cat;
  document.querySelectorAll('.fpill').forEach(function(p) { p.classList.remove('active'); });
  if (el) el.classList.add('active');
  renderNewsFeed();
}

function setTickerContent(titles) {
  if (!titles || !titles.length) return;
  tickerTitles = titles.slice(0, 10);
  tickerIndex  = 0;
  if (tickerTimer) clearInterval(tickerTimer);
  showTickerItem();
  tickerTimer = setInterval(showTickerItem, 4000);
}

function showTickerItem() {
  var el = document.getElementById('ticker');
  if (!el || !tickerTitles.length) return;
  el.classList.remove('fade');
  void el.offsetWidth;
  el.textContent = tickerTitles[tickerIndex];
  el.classList.add('fade');
  tickerIndex = (tickerIndex + 1) % tickerTitles.length;
}

function renderNewsFeed() {
  var container = document.getElementById('critical-posts');
  if (!container) return;

  var source   = parsedStoriesCache.length ? parsedStoriesCache : FALLBACK_NEWS;
  var filtered = currentFilter === 'ALL'
    ? source.slice()
    : source.filter(function(s) { return s.cat === currentFilter; });

  // always sort newest first by ORIGINAL publish time (pubTs), fallback to ts
  filtered.sort(function(a, b) {
    var aT = a.pubTs || a.ts;
    var bT = b.pubTs || b.ts;
    return bT - aT;
  });

  var shown = filtered.slice(0, 30);
  if (!shown.length) {
    container.innerHTML = '<div class="empty-state">No stories in this category yet</div>';
    setTickerContent(source.slice(0,10).map(function(s){ return s.title; }));
    return;
  }

  var html = '';
  shown.forEach(function(s) {
    html += makeWireItem(s.title, s.pubTs || s.ts, s.link);
  });
  container.innerHTML = html;
  setTickerContent(shown.map(function(s) { return s.title; }));
}

function loadNewsFeed() {
  renderNewsFeed();
}

// ── FALLBACK_NEWS - updated automatically by Vercel ──
// DO NOT EDIT BELOW THIS LINE
var FALLBACK_NEWS = [
  {title:'Antonelli fastest in Canadian GP sprint qualifying ahead of Russell',src:'wire',cat:'F1',link:'https://www.autosport.com/f1/news/f1-canadian-gp-kimi-antonelli-dominates-practice-session-amid-three-red-flags/10823021/?utm_source=RSS&utm_medium=referral&utm_campaign=RSS-F1&utm_term=News&utm_content=uk',ts:1779478679,pubTs:1779472989},
  {title:'Mercedes and McLaren upgrades confirmed, Ferrari brings no new parts',src:'wire',cat:'F1',link:'https://www.racefans.net/2026/05/22/mercedes-and-mclaren-upgrades-confirmed-no-new-parts-for-ferrari-in-canada/',ts:1779478679,pubTs:1779460974},
  {title:'Mercedes tackles F1 Achilles Heel with Canadian GP upgrades',src:'crash.net',cat:'F1',link:'https://www.crash.net/f1/news/1095725/1/mercedes-tackles-f1-achilles-heel-canadian-gp-upgrades',ts:1779451228,pubTs:1779451228},
  {title:'Hamilton \'100% clear\' he will stay at Ferrari next season',src:'motorsport.com',cat:'F1',link:'https://www.motorsport.com/f1/news/hamilton-100-clear-he-will-stay-at-ferrari-next-season/10822676/?utm_source=RSS&utm_medium=referral&utm_campaign=RSS-F1&utm_term=News&utm_content=www',ts:1779451228,pubTs:1779451228},
  {title:'Williams signs key leaders from McLaren, Mercedes, Alpine',src:'autosport.com',cat:'F1',link:'https://www.autosport.com/f1/news/williams-signs-key-leaders-from-mclaren-mercedes-alpine/10822599/?utm_source=RSS&utm_medium=referral&utm_campaign=RSS-F1&utm_term=News&utm_content=uk',ts:1779440429,pubTs:1779440429},
  {title:'Red Bull outlines timeline for new F1 wind tunnel',src:'autosport.com',cat:'F1',link:'https://www.autosport.com/f1/news/red-bull-provides-update-on-long-awaited-new-f1-wind-tunnel/10822485/?utm_source=RSS&utm_medium=referral&utm_campaign=RSS-F1&utm_term=News&utm_content=uk',ts:1779440429,pubTs:1779440429},
  {title:'Premier League confirms 2026-27 transfer window dates',src:'wire',cat:'FOOTBALL',link:'https://news.google.com/rss/articles/CBMikAFBVV95cUxOWE9tSDl1YzZpWTJXbElOYVd0YzNHd2RfSG1wdXFRS19SYm9pemQ2bzdTZl9yaGM1X2VDY2JBeEZ2NXdfWTNWOEhWcGFzOTUwaE5TclgzWDlFU1JZVWExa0w0dEY3S2xTUUluSXUzcUFiUmlENC14LURsZFlRa0VGWXhsU2ZmXzZKUkRqZzk0ZWfSAZgBQVVfeXFMTjNSUGJ5S3V3YlpBRjQ4MHUzZzdOS19FZFQ5elZtQkVXLUNuc3FFNS1Rd3VnWG10NHY1ZVhOek5YdC1pMms3aHM5WC1udnRlTklUcldjNkdtdjE3ME9KZ09JRFl3WWFYWWduSUcwYzh5YXFHazdQQUJUVTM1Z2EtNXFVYVViTWprbkp1REtUSk9ScmFQbkhlb0I?oc=5',ts:1779478679,pubTs:1779455089},
  {title:'Pep Guardiola confirms Man City departure',src:'skysports.com',cat:'FOOTBALL',link:'https://www.skysports.com/football/news/11095/13537139/pep-guardiola-to-leave-man-city-spaniard-announces-departure-after-a-decade-of-success-at-premier-league-club',ts:1779451228,pubTs:1779451228},
  {title:'Carrick confirmed as Man Utd permanent manager',src:'skysports.com',cat:'FOOTBALL',link:'https://www.skysports.com/football/news/11095/13544635/michael-carrick-has-got-manchester-united-job-but-does-he-deserve-it-and-how-will-squad-be-shaped-going-forward',ts:1779451228,pubTs:1779451228},
  {title:'Alvaro Arbeloa confirms Real Madrid departure',src:'independent.co.uk',cat:'FOOTBALL',link:'https://www.independent.co.uk/sport/football/alvaro-arbeloa-real-madrid-exit-jose-mourinho-return-b2981890.html',ts:1779451228,pubTs:1779451228},
  {title:'Rasmus Hjlund permanent Napoli switch confirmed',src:'web.search',cat:'FOOTBALL',link:'https://www.espn.com/soccer/transfers/_/league/eng.1/premier-league',ts:1779438019,pubTs:1779438019},
  {title:'FA investigate Southampton spygate as sacking decision looms',src:'mirror.co.uk',cat:'FOOTBALL',link:'https://www.mirror.co.uk/sport/football/news/southampton-spygate-hearing-playoff-live-37178169',ts:1779438019,pubTs:1779438019},
  {title:'Manuel Neuer ruled out DFB-Pokal final; World Cup status safe',src:'wire',cat:'BAYERN',link:'https://news.google.com/rss/articles/CBMiswFBVV95cUxOc2E2Vnc1cGdjOU9OdHpUbjB6Y0l2QmoyckVXXzZKUVZIYkdfa1JZOFI1bGUwN012MnJ4U2M1ZzRoTjNiQlNyLTc5QXdjNDBxdzJvdkpBenZWdWRzdnBOTnEtMmYxaFlFUjdManJ6cEJ4T3JpUXBDb3ZKcVZ5eUVzN0NZQXEwVmpFLV9VZ2t5X3B6S25hWkd5VjJFdkFkMXJzTDBta0hPQmM4dHgtMGswNUI4Yw?oc=5',ts:1779478679,pubTs:1779469440},
  {title:'Bayern Munich friendlies announced for 2026 preseason',src:'web.search',cat:'BAYERN',link:'https://www.thestandard.com.hk/news/article/332445/Bayern-Munich-Aston-Villa-to-face-off-at-Kai-Tak-stadium-on-August-7',ts:1779451228,pubTs:1779451228},
  {title:'VfB Stuttgart target cup glory against Bayern Munich after sealing UEFA Champions League berth',src:'bundesliga.com',cat:'BAYERN',link:'https://www.bundesliga.com/en/bundesliga/news/stuttgart-target-cup-win-bayern-munich-holders-top-four-finish-37463',ts:1779440429,pubTs:1779440429},
  {title:'Bayern Munich\'s Harry Kane and VfB Stuttgart\'s Deniz Undav hold key to DFB Cup final',src:'bundesliga.com',cat:'BAYERN',link:'https://www.bundesliga.com/en/bundesliga/news/harry-kane-deniz-undav-dfb-cup-final-bayern-munich-vfb-stuttgart-berlin-37470',ts:1779436220,pubTs:1779436220},
  {title:'Jan-Christian Dreesen: \'Young players are the soul of Bayern Munich\'',src:'news.google.com',cat:'BAYERN',link:'https://news.google.com/rss/articles/CBMitAFBVV95cUxNVEdheHJHa25RdWtmZ05vVEVERlM5d2ZuU3RJNnF6M0tzb3dqRzY1dUI4Q1BIZzlPNE9YREhESFNVUzNIMmFFYXRvM1ZSaXhsZ3cxS1ZnQTM4dFNEaHNGVVhrU0dfTjZkYkVpbHRvUGF3SzNDZ0pMcDBsQW5KRl9FOWEtbTZzaTBFc2I0aHlvM3hmYlNZWlpaazhNVnNFcDBQdzdyZWVOUEMxbEIydk9FbVRzeks?oc=5',ts:1779436220,pubTs:1779436220},
  {title:'Bayern Munich set asking price for Alexander Nbel',src:'google.news',cat:'BAYERN',link:'https://news.google.com/rss/articles/CBMihgFBVV95cUxPSDRkVGI1OTVuVG1yU2xzc1d4LTA3VFdqNS1xRjQyVFpxV01ydmxwMGItMzlXT1lZT0gwVS1rc1ZlVnhfdzg5OHJQQ1RJbFByQ3R1b0c0SkNtcWVVTXZuN1kzSmc3OURHSXdOQUwzclZpbTFxdzBxYXBMdXpxVjhSdzFZZVhaZw?oc=5',ts:1779411600,pubTs:1779411600},
  {title:'Ronaldo brace clinches Al-Nassr first Saudi title since 2019',src:'wire',cat:'SPL',link:'https://news.google.com/rss/articles/CBMi9gFBVV95cUxOS0lwR0pyU1pNLWNxQjFJMEtnZVFhT203amtJd1dkWkE5MzVoYzljWnBCRFZIWUotVHFpd29qaXd1VGxiSXpqWWZLbHI4cVBWb1VMXzhQTXpOU1JIa21YcEw3bHNuUzZjcm8ySy1wSk5TQ0FabUx1Q0lodk5VTVhrcjFGa3pmRmxKMmUybE9pRlE1Z1VEQlhRUTE4WTZwOWNwOVAtbWlaenp3d2RfVWFnUE5kZ1N4dVJCNHFGN0NlVlNSTUZoSGhUY3drWnQwZjAyX3AwcmhQdmNQV3lBS0NiNlFlNTlQSld6TzFlRjJyWlp0aWJqQlE?oc=5',ts:1779478679,pubTs:1779464064},
  {title:'Al Nassr title scenarios: What happens if they win, lose or draw vs. Damac',src:'news.google.com',cat:'SPL',link:'https://news.google.com/rss/articles/CBMiiwFBVV95cUxQODFHZ3FuRkFUV2x0M0s2UXdFaUc3YjkyMjVzaHotVldLRVVpTmJBYmJyV2tQLWNQVGE0VnROQlJGU0FZeko3Nk5NMUk0YTZjMzZjNW9VRFdNS2FYVGZMQU9HUlBZNFRBWVFULTRkNmhveWxsVTlQb2NVOXNwRjh4eExyX3dNZGdMemRF?oc=5',ts:1779451228,pubTs:1779451228},
  {title:'Cristiano Ronaldo\'s Al-Nassr wins Saudi Pro League title',src:'news.google.com',cat:'SPL',link:'https://news.google.com/rss/articles/CBMiiAFBVV95cUxPam5aYWRyeDg1SnJIOGVlcFBMalVhb2NFR2tPek9iOU5hNVFFUFFLVXk0S19JUWJSMm95VHJnT1dCX0ExWHg3czFBT191aU1lT0VmS1pFMk85WnNOOUdSbW8yQXl1U21EZzltRGpGeF9XV2VlemZKUjRBUGpoNkpkSHByaDluRllM?oc=5',ts:1779437419,pubTs:1779437419},
  {title:'Al Hilal defeats Al Fayha 1-0 in final Saudi Pro League match',src:'web.search',cat:'SPL',link:'https://heavy.com/sports/soccer/al-fayha-vs-al-hilal-match-results-today-saudi-pro-league-live-score-updates-stats/',ts:1779437419,pubTs:1779437419},
  {title:'Al Hilal completes unbeaten season with 1-0 win over Fayha',src:'web.search',cat:'SPL',link:'https://heavy.com/sports/soccer/al-fayha-vs-al-hilal-match-results-today-saudi-pro-league-live-score-updates-stats/',ts:1779436220,pubTs:1779436220},
  {title:'Saudi Arabia\'s sports strategy: World Cup 2034, Qiddiya',src:'wire',cat:'KSA',link:'https://news.google.com/rss/articles/CBMiwwFBVV95cUxNaHFwZExUci1IS1Y5ZG9aSGdhX1BWT1pwY1lLRTJINDgyTW85YWotOHZHTjk3YmdHemxfWHVxVTcwN3lTd2drcF93ZjFHN2JkTnVITnFIMU9mUFFLSzhjaEl1cUxtTW55RG1LOTh3R2pjNkJwbVpZcjBBcFJlcW0yQ2lWVDNEVzRJVW14NGRhUXVvd0VMcXNkYzFhX0QxVXFVWGJXVjZ4WVpVYVZ3R2U2UnJNSkNDdlFlV0Y5dkJMSDM1cHM?oc=5',ts:1779478679,pubTs:1779472977},
  {title:'PIF to sponsor 2026 World Cup with specific investment',src:'wire',cat:'KSA',link:'https://news.google.com/rss/articles/CBMixgJBVV95cUxPN3l1dHNrNlVrVnZUanBoZV8wOWtkclFhb05pVlpaZmVEWkFFc0tBQ2kydC1ocDhDMVQ4eVp4cjRJTWRCU2pWS05nUl81c0xoQzhmMDdrNEY3dTQzckZ0MVBhNV9YRGdDaHh1WGp3UFhIb05hQTNBbWVRYjJReEJKRHBVcERlNVY0U3FwamFmWHV5UmdEUmtrWDdraHhJZWJaVElTVWJuRWJZc1ctQWE5TWJMRTFDZDNUb1NOT1BXUjRoWE9sOEV6dnFwN3EycFpKRlVTeUVUblZMVl9sMHBDTFVjRzlnUncxTHVfS0NCVlNOd1NuUmcyektjSkRUUjJja3p3TFRqbHZaR2NrVUpRUUhjWVJWSHB3ek14ZTVpbjhncm5oQzhEWTc4bWdDanJFcDlEa0VpMDNBbDd0VllXVWszVXJGZw?oc=5',ts:1779478679,pubTs:1779465375},
  {title:'LIV Golf seeking $350 million in funding after losing Saudi PIF backing',src:'news.google.com',cat:'KSA',link:'https://news.google.com/rss/articles/CBMixgFBVV95cUxQenpTZTFSR0RKZXYxTlNlalhHVE1tT3RIMG5LaTk3R2FKaEdOUlJDMl9oTDBhcno4SzVYNDdGdjU3YTYtZkdIX3gwc1pOQ2tpWTROSTZWNk42SlUyNkh5bFpMdjNBNDR2MlFMalpLUG5GYk9zeDFWSVdvTGVzZFNOdE0wXzVFODhwUVBNZ0dhQnNNd1h2d19GM1hRQ1VqR0JXcEcycmpMZzRwbFVkVTJzdGYxXzJJTldnWmc0amh2SW5FYVZ6TlE?oc=5',ts:1779451228,pubTs:1779451228},
  {title:'Saudi Arabia and UAE reduce US Treasury holdings by $17 billion',src:'news.google.com',cat:'KSA',link:'https://news.google.com/rss/articles/CBMipAFBVV95cUxORkJmcDZvdzg4R1N1T2otMVN1RUZZQ3BxNnFrVDNFRW5nLW5teFF1TWcyME1MMUhqaDFtUy1fN0xEcWxJNkpsSnROOV94U0lSTEpwVlpHYU4wclJ0UlV6SzlBc01qQnY3YWVFb0F0eGFVUTQzVDJpOXU0XzItaE5Ldy1Hd3N2NEs3dWxDeWFrS3dEMGtUcW1XSlJSYzRiNl93Um1paQ?oc=5',ts:1779451228,pubTs:1779451228},
  {title:'PIF\'s $7B Bond Sale Tests Saudi Arabia\'s Unwritten Guarantee',src:'news.google.com',cat:'KSA',link:'https://news.google.com/rss/articles/CBMicEFVX3lxTE9PbXlQbl8zMHJIVnRFc0dZUlNZM291YllOTkJNY2xvaUR4ckc2OC00dHU1dU14cEZtOUgzODUwbk1KT0VGSnVQY1UwaTBBVTg2RkZraGFIZ3FqaXZEazlGb0FLRDctQ2tldGFQZG1ZaHE?oc=5',ts:1779438019,pubTs:1779438019},
  {title:'Saudi Arabia Poultry Meat Market Projected at US$5.85 Billion by 2034',src:'news.google.com',cat:'KSA',link:'https://news.google.com/rss/articles/CBMi6AFBVV95cUxNZGc0M1hXcFd4QXRNMWhzNWpYaVFuc0R4Q010RlVOSXY4bllpd1N4Q3ZuY3ZxRTVENDZ3emxFT0JjRHNHNlpFWFR4SEVmcUZqTEhfSlJhTkZGOFFoTzYyaVFuMldVUV9zam5mTjg3X2l5ek9NY3NTWnRFR3E4X3B1WUljUDJ3R0NBMXdYcFJ1TWtxdGF1UGtfdW9mWlBueEJfbmJ0VmlIbHlVMWNRdjUxNXd4ZmtLWXVrNUhxX2NpUU9FeUF3M2FNLVl0WGlmeEEybU5yS2E4MXlxMWRtV2VVTUdQZW9SWEhh?oc=5',ts:1779437419,pubTs:1779437419}
];
// DO NOT EDIT ABOVE THIS LINE
