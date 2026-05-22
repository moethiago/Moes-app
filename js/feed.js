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
  {title:'Williams confirms Victor Martins as reserve for Canadian Grand Prix',src:'web.search',cat:'F1',link:'https://sportstalkflorida.com/featured/f1-canadian-grand-prix-breaking-news/',ts:1779435022},
  {title:'Williams signs key leaders from McLaren, Mercedes, Alpine',src:'autosport.com',cat:'F1',link:'https://www.autosport.com/f1/news/williams-signs-key-leaders-from-mclaren-mercedes-alpine/10822599/?utm_source=RSS&utm_medium=referral&utm_campaign=RSS-F1&utm_term=News&utm_content=uk',ts:1779435022},
  {title:'Every driver\'s penalty points ahead of the 2026 Canadian Grand Prix',src:'news.google.com',cat:'F1',link:'https://news.google.com/rss/articles/CBMizAFBVV95cUxNTG5hamVqMHNJWHpkdVA5ZEYtdWNIMmp4NEFhd1hYZ1I3OFBFRG9XQXBQUHRSdGlKR05jcXp3VWVLNVIyUHdpVFZyRDU4RmZTM29rbWtWS3dROHNYNUI3OHRVdV9PNVAyOFZrczlUVFJKVFJmc250NlpKM3RyUEFUSTB1Mk9RNk1BOF9WQ3NuZ045Mm13SXY1SFhtd0NVQU03NV93Y3JfMnpDVFlub2kxel91X2hyVU5ZZnhmLUgxbm85bVliS3B6YUpSamE?oc=5',ts:1779435022},
  {title:'Williams recruits McLaren COO Piers Thynne for leadership role',src:'formula1.com',cat:'F1',link:'https://www.formula1.com/en/latest/article/piers-thynne-joins-williams-from-mclaren-as-chief-optimisation-and-planning-officer-amid-raft-of-senior-recruits.10NtETBHXamqiyhB0FTodE',ts:1779411136},
  {title:'FIA confirms lowest energy recharge limit for Montreal qualifying',src:'racefans.net',cat:'F1',link:'https://www.racefans.net/2026/05/21/fia-confirms-lowest-energy-recharge-limit-yet-for-qualifying-at-montreal/',ts:1779383833},
  {title:'Southampton sack decision looms after FA spygate investigation into Tonda Eckert',src:'mirror.co.uk',cat:'FOOTBALL',link:'https://www.mirror.co.uk/sport/football/news/southampton-spygate-hearing-playoff-live-37178169',ts:1779434422},
  {title:'Chelsea 2-1 Tottenham: Premier League survival fight goes to final day',src:'theguardian.com',cat:'FOOTBALL',link:'https://www.theguardian.com/football/live/2026/may/19/chelsea-v-tottenham-premier-league-live-west-ham',ts:1779434422},
  {title:'Arsenal handed injury boost ahead of Champions League final vs PSG as key player returns to training',src:'news.google.com',cat:'FOOTBALL',link:'https://news.google.com/rss/articles/CBMijwFBVV95cUxPeTJ0Q1IzYXpmQWRIZmd3Z1FXaXpQQnhxbEVtU1lhUDV4ZkhlT1RRUXl2YWhBdnAyQm41bV90LUlnVUlRTHB3ekgwbEppekdBOUIyM0JyQzJwVFl2MTVxaFpDaUdmSmsyUmlpMm9yRFhud3Jpa0JocThYczk1V0FqV0FGcy1OOGhETUJhak9zUQ?oc=5',ts:1779434422},
  {title:'Harry Maguire left out of England World Cup squad; Ivan Toney recalled',src:'skysports.com',cat:'FOOTBALL',link:'https://www.skysports.com/football/news/11095/13546713/england-world-cup-squad-man-utd-centre-back-harry-maguire-left-out-by-thomas-tuchel',ts:1779432010},
  {title:'Southampton manager Tonda Eckert accepts responsibility for spying scandal',src:'skysports.com',cat:'FOOTBALL',link:'https://www.skysports.com/football/news/11095/13546757/spygate-southampton-boss-tonda-eckert-accepts-responsibility-for-championship-play-off-spying-scandal',ts:1779432010},
  {title:'EFL condemns Southampton spying campaign as deplorable',src:'mirror.co.uk',cat:'FOOTBALL',link:'https://www.mirror.co.uk/sport/football/news/southampton-spygate-playoff-middlesbrough-hull-37189738',ts:1779387117},
  {title:'Bayern Munich set asking price for Alexander Nbel',src:'google.news',cat:'BAYERN',link:'https://news.google.com/rss/articles/CBMihgFBVV95cUxPSDRkVGI1OTVuVG1yU2xzc1d4LTA3VFdqNS1xRjQyVFpxV01ydmxwMGItMzlXT1lZT0gwVS1rc1ZlVnhfdzg5OHJQQ1RJbFByQ3R1b0c0SkNtcWVVTXZuN1kzSmc3OURHSXdOQUwzclZpbTFxdzBxYXBMdXpxVjhSdzFZZVhaZw?oc=5',ts:1779411600},
  {title:'Bayern Munich vs Stuttgart: DFB-Pokal Final',src:'sportsmole.co.uk',cat:'BAYERN',link:'https://www.sportsmole.co.uk/football/bayern-munich/dfb-pokal/preview/bayern-vs-stuttgart-prediction-team-news-lineups_597949.html',ts:1779391860},
  {title:'Raphal Guerreiro considering retirement after DFB-Pokal Final',src:'news.google.com',cat:'BAYERN',link:'https://news.google.com/rss/articles/CBMi6AFBVV95cUxPS0laVHppRkhqSlc3MDJZTTdEeWl3VWNCU3Nwb201UkZ2djdReXI2SkFWQklGbUNaWUltSTVkZncyYVJ6cEY4Z245aE55U0tKLUlWZGtKWXdNZWZkb2M4cmVNM2ktQlhER2paZjVwYnNzbE90aFRQRF9EYWtRV3BkcHMxcFk2cVFFVEhCb2d2Z05LNEpwOTJHWGp4WmMzTG1MbXcybjkza2Z2cm1LZERseWhaVDVvU0FPOXZfM0ozZ1N0dTFYWW8xNE1OMFBXRGRRLVpoalpMZURUN0N4N1g5UXlVeThTMjR0?oc=5',ts:1779379200},
  {title:'Ronaldo scores twice as Al Nassr clinch Saudi Pro League title',src:'google.news',cat:'SPL',link:'https://news.google.com/rss/articles/CBMirwFBVV95cUxOYjM4d2huMU5NempSMHJoRUtLQ3pCMVY5c0VBRUZUZ2tGaUx2Wi0xV2VHMlZWOU1QWHRHOHR2NmhfWXgyTU10aXY3cTFWRDVoX3NzSndXSlp2d28wZlF1ay1BOW95OGV0aFI3aHJ0VnpLNnNhSEZubklpSThjUXU3bFc3Y1ltQndSWi03X3BhdEcxc21CLWhDNXNxS0REcHZWX0lVRkxTOVo2eS1pM3JR0gG0AUFVX3lxTE5aY2NDR0lrMUhhLThIVU9PMDFBNUpoaFZHbGppeGRfazhpbmppamJ6RjVFRTJRYWxsVkJhMlBGcDBWVGlHMWlmVUpBSjkxQ3ZlUDRRR184c09iRE4tOU0yUGVESUlmQnRNSFlyOERYRU5aZU41MEZzSzIwTE9YZzBUOUhZOTZZTTFoMy1IMXlhLTRhV0diaVFRUzZ2U3QyMXNsS0RmQVhBQkFES1JFYjFIbmxnQw?oc=5',ts:1779398137},
  {title:'Al Nassr Crowned 2025-26 Saudi Pro League Champions After Ronaldo\'s Brace Secures 4-1 Victory Over Damac',src:'news.google.com',cat:'SPL',link:'https://news.google.com/rss/articles/CBMivwFBVV95cUxQMXQ5Nlp6a1RTSXVLX1JKelJta01Hd05JdDIwbS1PSlRXTWxnZk9xRDdIcXVrNFZQdEQ3bXhXZjRyZTI5cTI5SllNUkFUbjNFWl9kREJtLWYycmJScVpSWThYQ3NuMDJFOHk5T3VxbzBnM0U1YjVaYkg3cjhQbGZqUWlqQ3ozd0lFekw2U29BMkMwOFpwUDNucjVCZzZkV0hqNjVreHdpaVR4NUdhRXZtcFdsYXp1aW5ESEstMUZQOA?oc=5',ts:1779397903},
  {title:'Al-Hilal vs Al-Fayha shapes Saudi Pro League title race on final day',src:'news.google.com',cat:'SPL',link:'https://news.google.com/rss/articles/CBMi6AFBVV95cUxPcEt2djI2UGJzLVdhcEZFMlZhSFhoV0FEQnRfekxGbEhOSUs4bm9halZ5ck9oaEdRSTB3TS1wS3lDWFpnb0Y2Yk02bXMxMUZMbzZBUkxRT2VRdHBiNWRjUG1QZnEzZVBvdE5MRWRqaDBpRFpfV01nRDIwVHZyWjJsWk5FQTA4Ti15Ui1DWDR2VVhBUjBfMEdCTzI1eFRfckJVQWRSVmhabWtqVXBSc3FobjliYlBidUZhc1lWMDF0ODlzdTBBM3lzbGdEdW9iazg3dE03U1VaY19ueXZxMFg4aUxlUUlmbmtl?oc=5',ts:1779382726},
  {title:'Webuild Terminates NEOM Connector High-Speed Rail Contract',src:'news.google.com',cat:'KSA',link:'https://news.google.com/rss/articles/CBMirAFBVV95cUxOeGlweHNrdURQaW1sQzF4cTgtYndNQ3V0Qks5NFJNLU5maEowSmo2a3NkU0MtRmdfcnNVTUZtSXNIT055NFNtRm9VZlhjWXJBblE2NmVhQklMRVVUYkVvSER4aVF0N3pMTjltcWNnT1ZOR1p3NWVkQVdpM3l0NVZlYmtUMnZvSXlEYThSOXR4a3dOYWJaY2ZHWXAwU2JlOE8zZHhpVGlOTWNkNHBQ?oc=5',ts:1779435022},
  {title:'Saudi Arabia Freezes Payments to Consultancies Amid Economic Pressures',src:'news.google.com',cat:'KSA',link:'https://news.google.com/rss/articles/CBMiywFBVV95cUxOREdWbkJ4bzBFd082NjB0RTBEb2YtZzJ0NHNuM0VHS3dhOHl0LW1OTnhySVd6aWdySEFSN19lNkpBS1pvY0g5X2FlTHlfcXNLLUF3cHQyNmtHaENaSE5pbmRCNUVrM0xUaktqYUJ5bm45SWZ0WTJjMXdGRDNJTWdUVzB6bDNBdmFZOHJkenBuaURJd2hYNE5GVm4tNTd2QmxZem9sTE8zMWpQOXdiWjZYeFcwMkZVR3FXek5sZlpSUU94N3lWRjhCYUxNWQ?oc=5',ts:1779433227},
  {title:'PIF Completes $7 Billion Bond Sale, Testing Saudi Arabia\'s Financial Backing',src:'news.google.com',cat:'KSA',link:'https://news.google.com/rss/articles/CBMicEFVX3lxTE9PbXlQbl8zMHJIVnRFc0dZUlNZM291YllOTkJNY2xvaUR4ckc2OC00dHU1dU14cEZtOUgzODUwbk1KT0VGSnVQY1UwaTBBVTg2RkZraGFIZ3FqaXZEazlGb0FLRDctQ2tldGFQZG1ZaHE?oc=5',ts:1779410868},
  {title:'Saudi Arabia Freezes Consultancy Payments as Regional Conflict Impacts Budget Allocation',src:'news.google.com',cat:'KSA',link:'https://news.google.com/rss/articles/CBMiywFBVV95cUxOREdWbkJ4bzBFd082NjB0RTBEb2YtZzJ0NHNuM0VHS3dhOHl0LW1OTnhySVd6aWdySEFSN19lNkpBS1pvY0g5X2FlTHlfcXNLLUF3cHQyNmtHaENaSE5pbmRCNUVrM0xUaktqYUJ5bm45SWZ0WTJjMXdGRDNJTWdUVzB6bDNBdmFZOHJkenBuaURJd2hYNE5GVm4tNTd2QmxZem9sTE8zMWpQOXdiWjZYeFcwMkZVR3FXek5sZlpSUU94N3lWRjhCYUxNWQ?oc=5',ts:1779381978},
  {title:'LIV Golf Seeks Up to $350 Million in Funding as Post-PIF Strategy Evolves',src:'news.google.com',cat:'KSA',link:'https://news.google.com/rss/articles/CBMiigFBVV95cUxQMXdaakJ5blItM1IzWU56OWk4bXdlRTdlMFh6bTgzUGx6clFDa09zbWxBeEdZaWd2NlEwcEV2NUFIMHIyS0RYUm5Wd1B6ZklPeXpDMEdnd1RUallKNGFiLUVLWkZ1OWNwMU9YSFlPMGFVbGRmNVdsNG9YT2NMR0MwVGJEMk5GTWpQb0HSAY8BQVVfeXFMT3NvZEV5YktDYkpFQ3VtLWlVVHkzakFhMXhFWTdJdWxKMDItbmE0RXNkOFdvRWVmVHA1eHBwM1FZQnppYnNDU3ZaRFlUeTZiSTkyRkZUV1JOWEQyNy1BeFlHU0FSOU1mOGNJc1RyZHZ2ZDI5NnFWNUpUNmtGd0sybnpwNnNSa0hMWXdhRzVSRDQ?oc=5',ts:1779376009},
  {title:'Saudi Arabia\'s Seafood Market Projected to Reach $1.35 Billion by 2034 Driven by Aquaculture Investments',src:'news.google.com',cat:'KSA',link:'https://news.google.com/rss/articles/CBMi9AFBVV95cUxPSklGcnpHdFV6ZlVNdnRuc3ptMTRqYUlQTmdGdzg3RlZCdWNCMlJ4UHluZl9TMl84bnp4QzV2MkZpVjFncG5LYkd3TE1Ua3NWcC1LOWtoQzhEZ1ZRenU4OGUxTTBkMU9tX2F1TTVtWVRva1hWQjVmU3JLNnlxWHM0a24taGFwSTlOTjczNFAyamFlUDZYeFFHenF4T3ZtZVNpanJxWkNXVlN3VWVYZThDbWVGOXE0ZkFLbmdla2U1V1VPdWpkS1hEUEpBcmxocXZ0OXFjZkFHeE9aTWlySjAzSG85aGtLcFhBeW13akVPNm9ZTC1p?oc=5',ts:1779373785}
];
// DO NOT EDIT ABOVE THIS LINE
