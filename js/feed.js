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

function makeWireItem(title, ts, link) {
  return '<div class="wire-item" onclick="window.open(\'' + link + '\',\'_blank\')">'
    + '<span class="wire-bullet">•</span>'
    + '<div class="wire-content">'
    +   '<p class="wire-headline">' + boldEntities(title) + '</p>'
    +   '<div class="wire-meta">'
    +     '<span class="wire-time">' + timeAgo(ts) + '</span>'
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

  // always sort newest first
  filtered.sort(function(a, b) { return b.ts - a.ts; });

  var shown = filtered.slice(0, 30);
  if (!shown.length) {
    container.innerHTML = '<div class="empty-state">No stories in this category yet</div>';
    setTickerContent(source.slice(0,10).map(function(s){ return s.title; }));
    return;
  }

  var html = '';
  shown.forEach(function(s) {
    html += makeWireItem(s.title, s.ts, s.link);
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
  {title:'Haas F1 boss issues strong denial of Esteban Ocon rift reports',src:'crash.net',cat:'F1',link:'https://www.crash.net/f1/news/1095721/1/haas-f1-bosss-extraordinary-x-rated-rant-about-alleged-esteban-ocon-rift',ts:1779436220},
  {title:'Lewis Hamilton confirms he will stay at Ferrari in 2027',src:'motorsport.com',cat:'F1',link:'https://www.motorsport.com/f1/news/hamilton-100-clear-he-will-stay-at-ferrari-next-season/10822676/?utm_source=RSS&utm_medium=referral&utm_campaign=RSS-F1&utm_term=News&utm_content=www',ts:1779436220},
  {title:'Williams poaches four senior figures from multiple F1 rivals',src:'crash.net',cat:'F1',link:'https://www.crash.net/f1/news/1095709/1/williams-poaches-four-senior-figures-multiple-f1-rivals',ts:1779436220},
  {title:'Red Bull outlines timeline for new F1 wind tunnel',src:'autosport.com',cat:'F1',link:'https://www.autosport.com/f1/news/red-bull-provides-update-on-long-awaited-new-f1-wind-tunnel/10822485/?utm_source=RSS&utm_medium=referral&utm_campaign=RSS-F1&utm_term=News&utm_content=uk',ts:1779436220},
  {title:'Williams confirms Victor Martins as reserve for Canadian Grand Prix',src:'web.search',cat:'F1',link:'https://sportstalkflorida.com/featured/f1-canadian-grand-prix-breaking-news/',ts:1779435022},
  {title:'Williams signs key leaders from McLaren, Mercedes, Alpine',src:'autosport.com',cat:'F1',link:'https://www.autosport.com/f1/news/williams-signs-key-leaders-from-mclaren-mercedes-alpine/10822599/?utm_source=RSS&utm_medium=referral&utm_campaign=RSS-F1&utm_term=News&utm_content=uk',ts:1779435022},
  {title:'Arsenal crowned Premier League champions for first time in 22 years',src:'theguardian.com',cat:'FOOTBALL',link:'https://www.theguardian.com/football/live/2026/may/19/arsenal-premier-league-champions-first-time-in-22-years-live-reaction',ts:1779436220},
  {title:'How Villa\'s Europa League triumph affects European qualification',src:'news.google.com',cat:'FOOTBALL',link:'https://news.google.com/rss/articles/CBMisgFBVV95cUxNUHhiY2J4R3RFT25KRWlWV1EzVEVyZG1aOS1TS3U4YXdFbDFUNXJYUlNSVFlDVVhJaGtSRjNYY2l1b096NDNoQnVueEdwR1NaaVNWcjdyalQtdE05NkhwY2w5NEJJbUhySVpCMXZIVUZuV25Ka19iV2FUbmZJbnNTVjFUaDJWd0ZVV3owYWxqdGtVYnFXckczTkx2TVVXNHJ2WEdVU2d1NGkwQkVwUk05SUR3?oc=5',ts:1779436220},
  {title:'Fernndez and Chelsea sink Spurs as survival battle goes to final day',src:'theguardian.com',cat:'FOOTBALL',link:'https://www.theguardian.com/football/2026/may/19/chelsea-tottenham-premier-league-match-report',ts:1779436220},
  {title:'Southampton sack decision looms after FA spygate investigation into Tonda Eckert',src:'mirror.co.uk',cat:'FOOTBALL',link:'https://www.mirror.co.uk/sport/football/news/southampton-spygate-hearing-playoff-live-37178169',ts:1779434422},
  {title:'Chelsea 2-1 Tottenham: Premier League survival fight goes to final day',src:'theguardian.com',cat:'FOOTBALL',link:'https://www.theguardian.com/football/live/2026/may/19/chelsea-v-tottenham-premier-league-live-west-ham',ts:1779434422},
  {title:'Arsenal handed injury boost ahead of Champions League final vs PSG as key player returns to training',src:'news.google.com',cat:'FOOTBALL',link:'https://news.google.com/rss/articles/CBMijwFBVV95cUxPeTJ0Q1IzYXpmQWRIZmd3Z1FXaXpQQnhxbEVtU1lhUDV4ZkhlT1RRUXl2YWhBdnAyQm41bV90LUlnVUlRTHB3ekgwbEppekdBOUIyM0JyQzJwVFl2MTVxaFpDaUdmSmsyUmlpMm9yRFhud3Jpa0JocThYczk1V0FqV0FGcy1OOGhETUJhak9zUQ?oc=5',ts:1779434422},
  {title:'Bayern Munich\'s Harry Kane and VfB Stuttgart\'s Deniz Undav hold key to DFB Cup final',src:'bundesliga.com',cat:'BAYERN',link:'https://www.bundesliga.com/en/bundesliga/news/harry-kane-deniz-undav-dfb-cup-final-bayern-munich-vfb-stuttgart-berlin-37470',ts:1779436220},
  {title:'Jan-Christian Dreesen: \'Young players are the soul of Bayern Munich\'',src:'news.google.com',cat:'BAYERN',link:'https://news.google.com/rss/articles/CBMitAFBVV95cUxNVEdheHJHa25RdWtmZ05vVEVERlM5d2ZuU3RJNnF6M0tzb3dqRzY1dUI4Q1BIZzlPNE9YREhESFNVUzNIMmFFYXRvM1ZSaXhsZ3cxS1ZnQTM4dFNEaHNGVVhrU0dfTjZkYkVpbHRvUGF3SzNDZ0pMcDBsQW5KRl9FOWEtbTZzaTBFc2I0aHlvM3hmYlNZWlpaazhNVnNFcDBQdzdyZWVOUEMxbEIydk9FbVRzeks?oc=5',ts:1779436220},
  {title:'Bayern Munich set asking price for Alexander Nbel',src:'google.news',cat:'BAYERN',link:'https://news.google.com/rss/articles/CBMihgFBVV95cUxPSDRkVGI1OTVuVG1yU2xzc1d4LTA3VFdqNS1xRjQyVFpxV01ydmxwMGItMzlXT1lZT0gwVS1rc1ZlVnhfdzg5OHJQQ1RJbFByQ3R1b0c0SkNtcWVVTXZuN1kzSmc3OURHSXdOQUwzclZpbTFxdzBxYXBMdXpxVjhSdzFZZVhaZw?oc=5',ts:1779411600},
  {title:'Bayern Munich vs Stuttgart: DFB-Pokal Final',src:'sportsmole.co.uk',cat:'BAYERN',link:'https://www.sportsmole.co.uk/football/bayern-munich/dfb-pokal/preview/bayern-vs-stuttgart-prediction-team-news-lineups_597949.html',ts:1779391860},
  {title:'Raphal Guerreiro considering retirement after DFB-Pokal Final',src:'news.google.com',cat:'BAYERN',link:'https://news.google.com/rss/articles/CBMi6AFBVV95cUxPS0laVHppRkhqSlc3MDJZTTdEeWl3VWNCU3Nwb201UkZ2djdReXI2SkFWQklGbUNaWUltSTVkZncyYVJ6cEY4Z245aE55U0tKLUlWZGtKWXdNZWZkb2M4cmVNM2ktQlhER2paZjVwYnNzbE90aFRQRF9EYWtRV3BkcHMxcFk2cVFFVEhCb2d2Z05LNEpwOTJHWGp4WmMzTG1MbXcybjkza2Z2cm1LZERseWhaVDVvU0FPOXZfM0ozZ1N0dTFYWW8xNE1OMFBXRGRRLVpoalpMZURUN0N4N1g5UXlVeThTMjR0?oc=5',ts:1779379200},
  {title:'Al Hilal completes unbeaten season with 1-0 win over Fayha',src:'web.search',cat:'SPL',link:'https://heavy.com/sports/soccer/al-fayha-vs-al-hilal-match-results-today-saudi-pro-league-live-score-updates-stats/',ts:1779436220},
  {title:'Ronaldo scores twice as Al Nassr clinch Saudi Pro League title',src:'google.news',cat:'SPL',link:'https://news.google.com/rss/articles/CBMirwFBVV95cUxOYjM4d2huMU5NempSMHJoRUtLQ3pCMVY5c0VBRUZUZ2tGaUx2Wi0xV2VHMlZWOU1QWHRHOHR2NmhfWXgyTU10aXY3cTFWRDVoX3NzSndXSlp2d28wZlF1ay1BOW95OGV0aFI3aHJ0VnpLNnNhSEZubklpSThjUXU3bFc3Y1ltQndSWi03X3BhdEcxc21CLWhDNXNxS0REcHZWX0lVRkxTOVo2eS1pM3JR0gG0AUFVX3lxTE5aY2NDR0lrMUhhLThIVU9PMDFBNUpoaFZHbGppeGRfazhpbmppamJ6RjVFRTJRYWxsVkJhMlBGcDBWVGlHMWlmVUpBSjkxQ3ZlUDRRR184c09iRE4tOU0yUGVESUlmQnRNSFlyOERYRU5aZU41MEZzSzIwTE9YZzBUOUhZOTZZTTFoMy1IMXlhLTRhV0diaVFRUzZ2U3QyMXNsS0RmQVhBQkFES1JFYjFIbmxnQw?oc=5',ts:1779398137},
  {title:'Al Nassr Crowned 2025-26 Saudi Pro League Champions After Ronaldo\'s Brace Secures 4-1 Victory Over Damac',src:'news.google.com',cat:'SPL',link:'https://news.google.com/rss/articles/CBMivwFBVV95cUxQMXQ5Nlp6a1RTSXVLX1JKelJta01Hd05JdDIwbS1PSlRXTWxnZk9xRDdIcXVrNFZQdEQ3bXhXZjRyZTI5cTI5SllNUkFUbjNFWl9kREJtLWYycmJScVpSWThYQ3NuMDJFOHk5T3VxbzBnM0U1YjVaYkg3cjhQbGZqUWlqQ3ozd0lFekw2U29BMkMwOFpwUDNucjVCZzZkV0hqNjVreHdpaVR4NUdhRXZtcFdsYXp1aW5ESEstMUZQOA?oc=5',ts:1779397903},
  {title:'Al-Hilal vs Al-Fayha shapes Saudi Pro League title race on final day',src:'news.google.com',cat:'SPL',link:'https://news.google.com/rss/articles/CBMi6AFBVV95cUxPcEt2djI2UGJzLVdhcEZFMlZhSFhoV0FEQnRfekxGbEhOSUs4bm9halZ5ck9oaEdRSTB3TS1wS3lDWFpnb0Y2Yk02bXMxMUZMbzZBUkxRT2VRdHBiNWRjUG1QZnEzZVBvdE5MRWRqaDBpRFpfV01nRDIwVHZyWjJsWk5FQTA4Ti15Ui1DWDR2VVhBUjBfMEdCTzI1eFRfckJVQWRSVmhabWtqVXBSc3FobjliYlBidUZhc1lWMDF0ODlzdTBBM3lzbGdEdW9iazg3dE03U1VaY19ueXZxMFg4aUxlUUlmbmtl?oc=5',ts:1779382726},
  {title:'Saudi $1 Trillion Wealth Fund Plans Logistics Giant Creation',src:'news.google.com',cat:'KSA',link:'https://news.google.com/rss/articles/CBMiswFBVV95cUxQem11LTFERkNwT3VtdVU1NGRsZWVicGJGSWMwcHl4Z0Jia2Y5aXJ3U1B2dllNT0JLeDZVWDhwMWxwRjRnLTZMY2F4aWNicENjZHc3OGMyanpzY1BvckVCR1pZOUFnbmJGTVBLcHk5MjBqazY0MVd4NURrRU5ZQk5jNHZWOGtEb29iU2JHd3EzU0F3Q0VNMTU2UEZXNGgxcTU5SXhGd0J2ZzRWenFYVXczRmxmYw?oc=5',ts:1779436220},
  {title:'Webuild Terminates NEOM Connector High-Speed Rail Contract',src:'news.google.com',cat:'KSA',link:'https://news.google.com/rss/articles/CBMirAFBVV95cUxOeGlweHNrdURQaW1sQzF4cTgtYndNQ3V0Qks5NFJNLU5maEowSmo2a3NkU0MtRmdfcnNVTUZtSXNIT055NFNtRm9VZlhjWXJBblE2NmVhQklMRVVUYkVvSER4aVF0N3pMTjltcWNnT1ZOR1p3NWVkQVdpM3l0NVZlYmtUMnZvSXlEYThSOXR4a3dOYWJaY2ZHWXAwU2JlOE8zZHhpVGlOTWNkNHBQ?oc=5',ts:1779435022},
  {title:'Saudi Arabia Freezes Payments to Consultancies Amid Economic Pressures',src:'news.google.com',cat:'KSA',link:'https://news.google.com/rss/articles/CBMiywFBVV95cUxOREdWbkJ4bzBFd082NjB0RTBEb2YtZzJ0NHNuM0VHS3dhOHl0LW1OTnhySVd6aWdySEFSN19lNkpBS1pvY0g5X2FlTHlfcXNLLUF3cHQyNmtHaENaSE5pbmRCNUVrM0xUaktqYUJ5bm45SWZ0WTJjMXdGRDNJTWdUVzB6bDNBdmFZOHJkenBuaURJd2hYNE5GVm4tNTd2QmxZem9sTE8zMWpQOXdiWjZYeFcwMkZVR3FXek5sZlpSUU94N3lWRjhCYUxNWQ?oc=5',ts:1779433227},
  {title:'PIF Completes $7 Billion Bond Sale, Testing Saudi Arabia\'s Financial Backing',src:'news.google.com',cat:'KSA',link:'https://news.google.com/rss/articles/CBMicEFVX3lxTE9PbXlQbl8zMHJIVnRFc0dZUlNZM291YllOTkJNY2xvaUR4ckc2OC00dHU1dU14cEZtOUgzODUwbk1KT0VGSnVQY1UwaTBBVTg2RkZraGFIZ3FqaXZEazlGb0FLRDctQ2tldGFQZG1ZaHE?oc=5',ts:1779410868},
  {title:'Saudi Arabia Freezes Consultancy Payments as Regional Conflict Impacts Budget Allocation',src:'news.google.com',cat:'KSA',link:'https://news.google.com/rss/articles/CBMiywFBVV95cUxOREdWbkJ4bzBFd082NjB0RTBEb2YtZzJ0NHNuM0VHS3dhOHl0LW1OTnhySVd6aWdySEFSN19lNkpBS1pvY0g5X2FlTHlfcXNLLUF3cHQyNmtHaENaSE5pbmRCNUVrM0xUaktqYUJ5bm45SWZ0WTJjMXdGRDNJTWdUVzB6bDNBdmFZOHJkenBuaURJd2hYNE5GVm4tNTd2QmxZem9sTE8zMWpQOXdiWjZYeFcwMkZVR3FXek5sZlpSUU94N3lWRjhCYUxNWQ?oc=5',ts:1779381978},
  {title:'LIV Golf Seeks Up to $350 Million in Funding as Post-PIF Strategy Evolves',src:'news.google.com',cat:'KSA',link:'https://news.google.com/rss/articles/CBMiigFBVV95cUxQMXdaakJ5blItM1IzWU56OWk4bXdlRTdlMFh6bTgzUGx6clFDa09zbWxBeEdZaWd2NlEwcEV2NUFIMHIyS0RYUm5Wd1B6ZklPeXpDMEdnd1RUallKNGFiLUVLWkZ1OWNwMU9YSFlPMGFVbGRmNVdsNG9YT2NMR0MwVGJEMk5GTWpQb0HSAY8BQVVfeXFMT3NvZEV5YktDYkpFQ3VtLWlVVHkzakFhMXhFWTdJdWxKMDItbmE0RXNkOFdvRWVmVHA1eHBwM1FZQnppYnNDU3ZaRFlUeTZiSTkyRkZUV1JOWEQyNy1BeFlHU0FSOU1mOGNJc1RyZHZ2ZDI5NnFWNUpUNmtGd0sybnpwNnNSa0hMWXdhRzVSRDQ?oc=5',ts:1779376009}
];
// DO NOT EDIT ABOVE THIS LINE
