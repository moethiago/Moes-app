var currentFilter = 'ALL';
var parsedStoriesCache = [];
var tickerTitles = [];
var tickerIndex  = 0;
var tickerTimer  = null;

function timeAgo(ts) {
  // ts is unix timestamp in seconds
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
    ? source
    : source.filter(function(s) { return s.cat === currentFilter; });

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

// ── FALLBACK_NEWS - updated automatically by GitHub Action ──
// DO NOT EDIT BELOW THIS LINE
var FALLBACK_NEWS = [
  {title:'Williams recruits McLaren COO Piers Thynne for leadership role',src:'formula1.com',cat:'F1',link:'https://www.formula1.com/en/latest/article/piers-thynne-joins-williams-from-mclaren-as-chief-optimisation-and-planning-officer-amid-raft-of-senior-recruits.10NtETBHXamqiyhB0FTodE',ts:1779411136},
  {title:'FIA confirms lowest energy recharge limit for Montreal qualifying',src:'racefans.net',cat:'F1',link:'https://www.racefans.net/2026/05/21/fia-confirms-lowest-energy-recharge-limit-yet-for-qualifying-at-montreal/',ts:1779383833},
  {title:'EFL condemns Southampton spying campaign as deplorable',src:'mirror.co.uk',cat:'FOOTBALL',link:'https://www.mirror.co.uk/sport/football/news/southampton-spygate-playoff-middlesbrough-hull-37189738',ts:1779387117},
  {title:'Arsenal wins Premier League title',src:'sportsmole.co.uk',cat:'FOOTBALL',link:'https://www.sportsmole.co.uk/football/arsenal/title-race/news/arteta-reveals-eccentric-ritual-that-sparked-arsenals-pl-win_597943.html',ts:1779386484},
  {title:'Arsenal clinch Premier League title, Mikel Arteta reveals key meeting',src:'sportsmole.co.uk',cat:'FOOTBALL',link:'https://www.sportsmole.co.uk/football/arsenal/title-race/news/arteta-reveals-eccentric-ritual-that-sparked-arsenals-pl-win_597943.html',ts:1779386484},
  {title:'Casemiro leaves Manchester United for Inter Miami',src:'standard.co.uk',cat:'FOOTBALL',link:'https://www.standard.co.uk/sport/football/man-utd-carrick-casemiro-brighton-b1283212.html',ts:1779383058},
  {title:'Casemiro leaves Manchester United, Michael Carrick confirms exit',src:'standard.co.uk',cat:'FOOTBALL',link:'https://www.standard.co.uk/sport/football/man-utd-carrick-casemiro-brighton-b1283212.html',ts:1779383058},
  {title:'Aston Villa wins Europa League final',src:'transfermarkt.co.uk',cat:'FOOTBALL',link:'https://www.transfermarkt.co.uk/aston-villa-win-europa-league-emery-joins-most-successful-coaches-with-5th-european-trophy/view/news/479762',ts:1779311428},
  {title:'Bayern Munich set asking price for Alexander Nbel',src:'google.news',cat:'BAYERN',link:'https://news.google.com/rss/articles/CBMihgFBVV95cUxPSDRkVGI1OTVuVG1yU2xzc1d4LTA3VFdqNS1xRjQyVFpxV01ydmxwMGItMzlXT1lZT0gwVS1rc1ZlVnhfdzg5OHJQQ1RJbFByQ3R1b0c0SkNtcWVVTXZuN1kzSmc3OURHSXdOQUwzclZpbTFxdzBxYXBMdXpxVjhSdzFZZVhaZw?oc=5',ts:1779411600},
  {title:'Ronaldo scores twice as Al Nassr clinch Saudi Pro League title',src:'google.news',cat:'SPL',link:'https://news.google.com/rss/articles/CBMirwFBVV95cUxOYjM4d2huMU5NempSMHJoRUtLQ3pCMVY5c0VBRUZUZ2tGaUx2Wi0xV2VHMlZWOU1QWHRHOHR2NmhfWXgyTU10aXY3cTFWRDVoX3NzSndXSlp2d28wZlF1ay1BOW95OGV0aFI3aHJ0VnpLNnNhSEZubklpSThjUXU3bFc3Y1ltQndSWi03X3BhdEcxc21CLWhDNXNxS0REcHZWX0lVRkxTOVo2eS1pM3JR0gG0AUFVX3lxTE5aY2NDR0lrMUhhLThIVU9PMDFBNUpoaFZHbGppeGRfazhpbmppamJ6RjVFRTJRYWxsVkJhMlBGcDBWVGlHMWlmVUpBSjkxQ3ZlUDRRR184c09iRE4tOU0yUGVESUlmQnRNSFlyOERYRU5aZU41MEZzSzIwTE9YZzBUOUhZOTZZTTFoMy1IMXlhLTRhV0diaVFRUzZ2U3QyMXNsS0RmQVhBQkFES1JFYjFIbmxnQw?oc=5',ts:1779398137},
  {title:'Cristiano Ronaldo scores twice as Al Nassr clinch Saudi Pro League title',src:'google.news',cat:'SPL',link:'https://news.google.com/rss/articles/CBMirwFBVV95cUxOYjM4d2huMU5NempSMHJoRUtLQ3pCMVY5c0VBRUZUZ2tGaUx2Wi0xV2VHMlZWOU1QWHRHOHR2NmhfWXgyTU10aXY3cTFWRDVoX3NzSndXSlp2d28wZlF1ay1BOW95OGV0aFI3aHJ0VnpLNnNhSEZubklpSThjUXU3bFc3Y1ltQndSWi03X3BhdEcxc21CLWhDNXNxS0REcHZWX0lVRkxTOVo2eS1pM3JR0gG0AUFVX3lxTE5aY2NDR0lrMUhhLThIVU9PMDFBNUpoaFZHbGppeGRfazhpbmppamJ6RjVFRTJRYWxsVkJhMlBGcDBWVGlHMWlmVUpBSjkxQ3ZlUDRRR184c09iRE4tOU0yUGVESUlmQnRNSFlyOERYRU5aZU41MEZzSzIwTE9YZzBUOUhZOTZZTTFoMy1IMXlhLTRhV0diaVFRUzZ2U3QyMXNsS0RmQVhBQkFES1JFYjFIbmxnQw?oc=5',ts:1779398137},
  {title:'Al Nassr crowned Saudi Pro League champions with Ronaldo in squad',src:'google.news',cat:'SPL',link:'https://news.google.com/rss/articles/CBMi3AFBVV95cUxPMHNIREZ3TWZvTW8tVi1PVlYxRlVoT1RHOWxjNzF2NGloQ0hnM0JhUjlYWmJCVlVmTWxXSlFFUUVwaDd2QWR2enNpNzRkc1o5TmpBeWRiSUd5RmhwdmJ4ZVZtUE5KRGVZdHNRUFpkck1lOFRyVEVpNmd4Q3VwSC1Ed0JlNnlPWWEzNXNqdlNySk1CRlNmWWN1QlFrdDJhaGpZanpKMWVVdnRHLTRXaGtQYndlczU0VFdsUEl5VncwZXBhaFN5cUVUODNzZ1dsSDFCaUZjdGdHN1JFQ2Zn0gHgAUFVX3lxTFB3anNBcDlqUWk3b0JPR3dUdkwzQl9MQ1V4NnZxcXhhc0dXaktPblRuNkpKSF84SzVYcklnN0hSQmZNN2VOR1BBaGRtRTRzZ1cxNmExcVRfcTVXc096c1JiWXBNMlFqQ2FWQVBtYjAwbUFZSE1CMENfd3Bub3l5aF9hRXpQZl9xWGhvdzB4UVVNQkcwVjg2N3RValUxbGVOb0FIZjNsTGFmbW5FT21sNjlWNG50aHNzeW1Lc2JkMk5OTERtazY1RDVHdXVMY2NETzBSV0QwbDRwSXFnSWloRXFr?oc=5',ts:1779394397},
  {title:'OVG Middle East to operate Global Sports Tower in Riyadh',src:'saudigazette.com.sa',cat:'KSA',link:'https://saudigazette.com.sa/article/661488/saudi-arabia/sports-boulevard-appoints-ovg-middle-east-to-operate-global-sports-tower-in-riyadh',ts:1779307095},
  {title:'Saudi non-oil trade surplus with GCC reaches SR4.47 billion in February',src:'saudigazette.com.sa',cat:'KSA',link:'https://saudigazette.com.sa/article/661486/saudi-arabia/saudi-arabias-non-oil-trade-surplus-with-gcc-countries-reaches-sr447-billion-in-february',ts:1779297428},
  {title:'Saudi operating revenue index rises 10.2% in March',src:'saudigazette.com.sa',cat:'KSA',link:'https://saudigazette.com.sa/article/661481/saudi-arabia/gastat-102-rise-in-saudi-operating-revenue-index-in-march',ts:1779287918},
  {title:'Saudi operating revenue index rises 10.2 percent in March',src:'saudigazette.com.sa',cat:'KSA',link:'https://saudigazette.com.sa/article/661481/saudi-arabia/gastat-102-rise-in-saudi-operating-revenue-index-in-march',ts:1779287918},
  {title:'Saudi Awwal Bank signs SR6.4 billion AlBawani financing agreement',src:'google.news',cat:'KSA',link:'https://news.google.com/rss/articles/CBMiVEFVX3lxTE5PVEpscWV4bE1kVWw2SXVWeVViUndRR3cwZXNzZWM4Unl6R2tXc3BrVGl5YWptOERwbm05WnM0dDl6M2Q4REpjR0JiLU1PeTJTNGxrQw?oc=5',ts:1779280020},
  {title:'Saudi Awwal Bank signs SR6.4 billion financing agreement with AlBawani',src:'google.news',cat:'KSA',link:'https://news.google.com/rss/articles/CBMiVEFVX3lxTE5PVEpscWV4bE1kVWw2SXVWeVViUndRR3cwZXNzZWM4Unl6R2tXc3BrVGl5YWptOERwbm05WnM0dDl6M2Q4REpjR0JiLU1PeTJTNGxrQw?oc=5',ts:1779280020}
];
// DO NOT EDIT ABOVE THIS LINE
