// ── FEED.JS ─────────────────────────────────────────────
// Channels: F1, Football (Top 5), Bayern, Saudi Football, Saudi Major News
// Each category is independent - add/remove without touching others

var currentFilter = 'ALL';
var parsedStoriesCache = [];
var tickerTitles = [];
var tickerIndex = 0;
var tickerTimer = null;

var MASTER_CHANNELS = [
  // F1 - dedicated feeds only
  {'url':'https://feeds.bbci.co.uk/sport/formula1/rss.xml',            'name':'BBC F1',                'cat':'F1'},
  {'url':'https://www.autosport.com/rss/f1/news/',                      'name':'Autosport',             'cat':'F1'},
  // Football - Top 5 leagues
  {'url':'https://feeds.bbci.co.uk/sport/football/rss.xml',            'name':'BBC Sport',             'cat':'FOOTBALL'},
  {'url':'https://www.theguardian.com/football/premierleague/rss',     'name':'Guardian PL',           'cat':'FOOTBALL'},
  {'url':'https://www.theguardian.com/football/laliga/rss',            'name':'Guardian LaLiga',       'cat':'FOOTBALL'},
  {'url':'https://www.theguardian.com/football/serieafootball/rss',    'name':'Guardian Serie A',      'cat':'FOOTBALL'},
  {'url':'https://www.theguardian.com/football/bundesligafootball/rss','name':'Guardian Bund',         'cat':'FOOTBALL'},
  {'url':'https://www.theguardian.com/football/ligue1football/rss',    'name':'Guardian L1',           'cat':'FOOTBALL'},
  {'url':'https://www.espn.com/espn/rss/soccer/news',                  'name':'ESPN FC',               'cat':'FOOTBALL'},
  // Bayern - dedicated feeds only
  {'url':'https://fcbayern.com/en/api/rss/content',                    'name':'Bayern Official',       'cat':'BAYERN'},
  {'url':'https://www.bavarianfootballworks.com/rss/current.xml',      'name':'Bavarian Football Works','cat':'BAYERN'},
  // Saudi Football - dedicated feeds only
  {'url':'https://www.arabnews.com/saudi-football/rss.xml',           'name':'Arab News SPL',         'cat':'SPL'},
  {'url':'https://www.goal.com/en-sa/rss/news',                       'name':'Goal Saudi',            'cat':'SPL'},
  // Saudi Major News - dedicated feeds only
  {'url':'https://www.arabnews.com/saudi-arabia/rss.xml',             'name':'Arab News KSA',         'cat':'KSA'},
  {'url':'https://www.arabnews.com/economy/rss.xml',                  'name':'Arab News Economy',     'cat':'KSA'},
];

var F1_JUNK       = /motogp|moto gp|indycar|isle of man|nascar|wrc|rally|superbike|rugby|cricket|tennis|golf|boxing|football|soccer|premier league/i;
var FOOTBALL_KEEP = /sack(ed)?|fired|resign|transfer|sign(ed|ing)?|injur|suspend|ban(ned)?|red card|\btitle\b|champion|relegat|derb|match report|\bwin(s)?\b|\bloss\b|defeat|final|semifinal|playoff|expel/i;
var FOOTBALL_JUNK = /fantasy|predicted lineup|five things|player ratings|watch live|how to watch|betting|quiz|power ranking|player of|talking points|gallery|photo|ranked|darts|cricket|rugby|tennis|golf|boxing/i;
var BAYERN_JUNK   = /women|youth|reserve|u17|u19|u21|amateure/i;
var SPL_JUNK      = /cricket|rugby|tennis|golf|boxing|motorsport|formula/i;
var KSA_KEEP      = /decree|royal|minister|giga|neom|vision 2030|pif|\binvest|\bregulat|reform|\bgdp\b|economic|infrastructure|launch|announce|billion|sovereign|market|\bipo\b|fund|policy|project/i;
var KSA_JUNK      = /ceremony|ribbon|visit|tour|festival|fashion|celebrat|inaugurat|honorary|attend|sport|football|cricket|tennis/i;

var KEY_ENTITIES = [
  'Hamilton','Verstappen','Norris','Leclerc','Russell','Antonelli','Piastri','Alonso','Sainz','Perez',
  'Red Bull','McLaren','Ferrari','Mercedes','Aston Martin','Alpine','Williams',
  'Arsenal','Man City','Liverpool','Chelsea','Tottenham','Man United','Newcastle',
  'Real Madrid','Barcelona','Atletico','Bayern','Dortmund','PSG','Juventus','Inter','Milan','Napoli',
  'Al Hilal','Al Nassr','Al Ittihad','Al Ahli',
  'Ronaldo','Neymar','Benzema','Mane','Salah','Haaland','Mbappe','Bellingham','Kane',
  'Guardiola','Klopp','Ancelotti','Mourinho','Tuchel','Conte','Arteta',
  'Vision 2030','PIF','NEOM','Saudi Aramco',
];

var ENTITIES_LOWER = KEY_ENTITIES.map(function(e) { return e.toLowerCase(); });

var TOPICS_LOWER = [
  'title','champion','win','wins','winner','relegated','relegation','sacked','fired',
  'transfer','signed','signs','signing','injured','injury','banned','ban','suspended',
  'penalty','crash','dnf','pole','contract','announced','confirmed',
  'premier league','la liga','serie a','bundesliga','ligue 1','champions league',
  'saudi pro league','grand prix',
];

// ── FALLBACK_NEWS - updated automatically by GitHub Action every hour ──
// DO NOT EDIT BELOW THIS LINE
var FALLBACK_NEWS = [
  {title:'Williams poaches key leaders from McLaren, Mercedes, Alpine',src:'motorsport.com',cat:'F1',link:'https://www.motorsport.com/f1/news/williams-poaches-key-leaders-from-mclaren-mercedes-alpine/10822589/?utm_source=RSS&utm_medium=referral&utm_campaign=RSS-F1&utm_term=News&utm_content=www',date:'May 21'},
  {title:'Williams poaches four senior figures from multiple F1 rivals',src:'crash.net',cat:'F1',link:'https://www.crash.net/f1/news/1095709/1/williams-poaches-four-senior-figures-multiple-f1-rivals',date:'May 21'},
  {title:'Red Bull outlines timeline for new F1 wind tunnel',src:'autosport.com',cat:'F1',link:'https://www.autosport.com/f1/news/red-bull-provides-update-on-long-awaited-new-f1-wind-tunnel/10822485/?utm_source=RSS&utm_medium=referral&utm_campaign=RSS-F1&utm_term=News&utm_content=uk',date:'May 21'},
  {title:'Red Bull provides update on long-awaited new F1 wind tunnel',src:'motorsport.com',cat:'F1',link:'https://www.motorsport.com/f1/news/red-bull-provides-update-on-long-awaited-new-f1-wind-tunnel/10822482/?utm_source=RSS&utm_medium=referral&utm_campaign=RSS-F1&utm_term=News&utm_content=www',date:'May 21'},
  {title:'Round-up: Las Vegas GP approved until 2037 by county commission, and more | RaceFans Round-up',src:'racefans.net',cat:'F1',link:'https://www.racefans.net/2026/05/21/round-up-21st-may-2026/',date:'May 20'},
  {title:'Horner in talks over new BYD F1 team entry',src:'google.news',cat:'F1',link:'https://news.google.com/rss/articles/CBMihAFBVV95cUxQZ3F2UldBRmhyN2ZwQ1ZjUWxRaEZyWnhfcUR2WUJGTHY5UDlYa1NBbXFJWGJRNTc4T1BnRFRLLURxSzlQNEFFNVZ4ZGotUHU4MWFvR1Q1V0lwam4tR3BYaHlneDh4ZWRDa1NnM1E3S25BWjRFNkROUWQ3LU9yRGxWcjlGZ3U?oc=5',date:'May 20'},
  {title:'Manchester City weeks away from long-awaited verdict on 115 charges',src:'talksport.com',cat:'FOOTBALL',link:'https://talksport.com/football/4275591/man-city-premier-league-charges-verdict-date-stefan-borson/',date:'May 21'},
  {title:'Hellberg: It has been a \'weird\' and \'crazy\' fortnight since start of \'Spygate\' scandal',src:'skysports.com',cat:'FOOTBALL',link:'https://www.skysports.com/football/news/11095/13546630/championship-play-off-final-middlesbroughs-kim-hellberg-and-hulls-sergej-jakirovic-discuss-spygate-scandal',date:'May 21'},
  {title:'FA opens Southampton investigation over Spygate',src:'bbc.com',cat:'FOOTBALL',link:'https://www.bbc.com/sport/football/articles/crmplprldl8o?at_medium=RSS&at_campaign=rss',date:'May 21'},
  {title:'Liverpool agree deal with Slovenia defender Agrez',src:'bbc.com',cat:'FOOTBALL',link:'https://www.bbc.com/sport/football/articles/cm2pyq5vl92o?at_medium=RSS&at_campaign=rss',date:'May 21'},
  {title:'Mohamed Salah given lifeline in bid to avoid Saudi Pro League: report',src:'fourfourtwo.com',cat:'FOOTBALL',link:'https://www.fourfourtwo.com/transfer/mohamed-salah-given-lifeline-in-bid-to-avoid-saudi-pro-league-report',date:'May 21'},
  {title:'Ousmane Dembele issues new injury update ahead of Champions League final vs PSG',src:'mirror.co.uk',cat:'FOOTBALL',link:'https://www.mirror.co.uk/sport/football/news/arsenal-psg-ousmane-dembele-injury-37187238',date:'May 21'},
  {title:'\'A very good coach and a wonderful person\' - Vincent Kompany deemed \'unsellable\' by Bayern Munich as president explains why coach is \'a real upgrade\' for entire club',src:'google.news',cat:'BAYERN',link:'https://news.google.com/rss/articles/CBMirAFBVV95cUxNRUFwQy1LLS16bmdLWnFfSU1HSy03QXRMTHhCTWF0cEtHaEdheGVsek91ZnNmVi1VT0pqdEwyV2g0ZW5RcTNUY1FLVG5NYjB6dVVodTc4b19nNUFiOGVJeE5xRldnRXdrcmZfOGloMkxJUHR3aklPbkRkREE5cVJkSXdueExvVk1tWEZac3ByeG5ZczR1LVRSV1FGU1IxZUpaa1I2NU1aUmpXOEZ6?oc=5',date:'May 21'},
  {title:'2026 World Cup: Germany recall Manuel Neuer, 40, as first-choice goalkeeper',src:'google.news',cat:'BAYERN',link:'https://news.google.com/rss/articles/CBMiZ0FVX3lxTE0tbTVQSEtVSEZYR3VVc3ZFbFNjQXlwUXFGeVg1YlRWUUxnVHA4Zy1wbHQwUUduYndmeUxnUjduRXU0eTBaRDBMOEFxM0pqYmVqeWFIX0ZFZ0JpLXFvUXlaM1BfRE9EX3c?oc=5',date:'May 21'},
  {title:'Why Manuel Neuers return for Germany at the FIFA World Cup 2026 is so important',src:'bundesliga.com',cat:'BAYERN',link:'https://www.bundesliga.com/en/bundesliga/news/manuel-neuer-germany-recall-world-cup-2026-importance-nagelsmann-37384',date:'May 21'},
  {title:'Bayern Munich News: John Stones offered to FC Bayern; Tom Bischof gets excited by winning; and MORE!',src:'google.news',cat:'BAYERN',link:'https://news.google.com/rss/articles/CBMi9wFBVV95cUxQOVQ2d0pXTW1JbFlJR0F5eU1aUzFrOElNbUdORmhpdHVSSlJFbDU2eHJJbXhYbndteXZZb2F6VW93ckl5dUhGMzR6VzktQXdxTHVYU2xHVmlzU0ZrT2xPY0dQR2ZGUGQ1UUpkMUpFdG5nNWFhZmdaLS14Ym5HT0djcm1VYnNLemI2NFhrQUJfUTh2aGtFcHhYbzdJYnhwVHV3ZzRzZGdvTGpyemRNYlZtQUdIUUpPQlZNRDNNd2ljN1RIX3BLM2UzU0VncnkweFkwaHdFNm5OdjlHY1RwR05pUFZ0M2dYa2M4ampLR2lwV3dYWVhFRTJR?oc=5',date:'May 21'},
  {title:'Bayern considering move for Bisseck and Inter eyeing two Serie A replacements',src:'google.news',cat:'BAYERN',link:'https://news.google.com/rss/articles/CBMidEFVX3lxTE1QMGJXQTZMYXpHXzFLNFlYcXFIRmYtVVdTU0tzTTVyWVdPUFRmV0ltQ21TdDFtUGo1TE83ZlQ2d1loeEg5VF80WDYwMjBSOGxObHViSUpTS3BPYlVxUlVaYnpMMGtnbGFoX19WOEpoWXYtRFlT0gF6QVVfeXFMTWVVc1lMb09jb25QOXIyNkdKMFBSVlo2cnh0aGx5R1BHTktwSzRha1AxZ050cmZJZ1VIRWNZNEQ1ek9tNjZUOEhvM2pTLUlZdjdwcVJka2ZLWVVGckREVGo2Qm9CNW9XMU0wU0ZKOHh1RGJDRzhsZ2p2YlE?oc=5',date:'May 21'},
  {title:'Bayern Munich transfer news: Vincent Kompany plotting stunning swoop for Man City legend with high-profile reunion considered',src:'sportsmole.co.uk',cat:'BAYERN',link:'https://www.sportsmole.co.uk/football/bayern-munich/transfer-talk/news/stunning-swoop-bayern-boss-kompany-plotting-high-profile-reunion-with-man-city-legend_597903.html',date:'May 21'},
  {title:'How Cristiano Ronaldos Al-Nassr win, draw, or loss vs Damac could affect the 202526 Saudi Pro League titl...',src:'google.news',cat:'SPL',link:'https://news.google.com/rss/articles/CBMi3AFBVV95cUxPT1U4SzlKemZIVXlSSkFfbHBuYjNnZFV1SzA4MnZwRG5jX2dmNWZYQzJFc0kwOVZoci1MSG15dXB6TGF6TTVkNlBENGJxVlduT0tsTWRoQ1IxNjhfU19aN0lsTkJiTGJ6V3RCOGUtS3JXYVJURUJnMDRROUtURWg5YkxrTjY4WkNnS0JfMWIwcDBRcS1CYk5CZmFKWHNGRG9qYXZmVEh0dlNhQ0ltTmttdnFacF90dXllRjAyR280MTRRT0F6bGVyOVFXQV81eUhSeHl0NDU5d002WlNo0gHgAUFVX3lxTE02UHhOYXM4UVpSdExlMjM1Mmx3Q3BRUVJZWGdadW5acTdpNnRvTUhiRVpQeGhUNndBQVgxX2ZkN1NSZ19TeFNVUkVOdkIyVGtfSVN1LXpKYkJJbnEtd1NyTDZmWWRNSS1oeEV5anc5SHhhYzAwVzk4SmFITVdlVW96STJScWZfS3laRFV5bHVEU2JtZkpMcC1ScS1xZTJndmdtVDcwWFpaZzNYY0I1dEFldW96S3hZQXpGUzlLcmJoYXBhdkJKd2NuNU9qUTVFY3pYODhvcDExNWh6RzdIU1hQ?oc=5',date:'May 21'},
  {title:'Cristiano Ronaldo titles my sole aim in Saudi Arabia - Al Nassr\'s Jorge Jesus',src:'google.news',cat:'SPL',link:'https://news.google.com/rss/articles/CBMiugFBVV95cUxNbXpqTWxjS2JHX3JoLWFzejhpY0tPMGlNc1pJazBFM3MtWnlWelh1S3pwdXJ6cFhlUWYySGw4VU9QeU5raVdPV1dQUzJuQUhOWHBkQ2htMFoxMDV2aDFWRXQ1MTdVbDRKVktTdmtZVHBsdTFubE5DRjR1UXlpY0ZhcnNhcTBoV2xwaEtxMlR3cVloVmx5UzFFTmhsTXEtUkw0UkhlMVhYQmRIakI2MHlZcXRydkIwU0k3ZVE?oc=5',date:'May 21'},
  {title:'Cristiano Ronaldos Al Nassr made to wait: How do the 2025-26 SPL standings look after Al Hilals win over ...',src:'google.news',cat:'SPL',link:'https://news.google.com/rss/articles/CBMi2gFBVV95cUxNeDBLZndYeGFiNnRnZWhENzdfTXVaLVdYeGNPR1dfcDNlS21BODd2VGFuTnVUcnl6clZ5RjR5QVBqVWVDQ1VTTDNpNE9DZlNxMGMySUwxMjdfR3VSMjFNcDFvN0trZEhHcWhhRnhaQnRXSERadVJJSGZJMFN2cHQ5QnRfaldTXzRiM1Rnb1lMamk0VkxjclEzQlltYmE4aHBadWNkXzM2algzZEN3THYyYjZVZEhZTmItcy1vWUpWQnFlb2RTUDN5SDhYcERaS1J6NUJHOGNiRTBRQdIB3gFBVV95cUxNN0RuTEp0QXBBWW5wUGxwbENRenl5RU5oVS1SUUhnWnFoMm5uSGdXMEN4dDRBVE96eFo1SlFydDhmcWZIQmZwampaWGo3cUpCVTFtZllfdEZEYkduV2k1czhOb3d5cDBxYTVsTWxsSlZSa2xLZnZ2T2NKT3RndlVoN0d5dEQzN3p0M0R5NElvMzRLcVQ1UTdXOGN3ODhLZzhpTHExMkhxYjdmUGV3R1NNeVRvdjBNQnpZODgtVGxfRXQzdWgwUTFnMERURHJqcVhaSkd2MHFTUDZLUWpjT1E?oc=5',date:'May 19'},
  {title:'UK-GCC Trade Agreement, UK Economy Could Add 5 Billion US Dollars',src:'google.news',cat:'KSA',link:'https://news.google.com/rss/articles/CBMiR0FVX3lxTE5ET2ZGejFacEtjdDhIeFYtUkVKWFFKZ0xISERVUzZ2RlhnR3ZRRDhGeUQ4bzdwQk9zYXFjWGVrTll1eUo5ZnM00gFCQVVfeXFMTVk2UGI2c3B5TEZsRHJoUTRxYjhKWUdwSXBuQmlnSzNKSnY1Y29NcnotNy16QVpZVWs5LWwxUE4zXzZR?oc=5',date:'May 21'},
  {title:'UK and Gulf strike historic multi-billion-pound trade deal',src:'google.news',cat:'KSA',link:'https://news.google.com/rss/articles/CBMimAFBVV95cUxPWEdJVmFFTGdPeVIxTGk0V2tYazAxRzFQb2wyRF92SWZEaDBhcUZZaGlyVW9wZEFzbEozMFNDNlo1OWtKUXppQnk4T3ZhLVdoQ0dReXY0cERoTFlkSlA3WHM3Rnh2dURaODZCckwteGVyU1pFZkVZZDJHMllEajVPMDJnNkNtcGMtYXZ2aF9ZTHJxT1VaUERlTQ?oc=5',date:'May 20'},
  {title:'10.2% rise in Saudi operating revenue index in March',src:'saudigazette.com.sa',cat:'KSA',link:'https://saudigazette.com.sa/article/661481/saudi-arabia/gastat-102-rise-in-saudi-operating-revenue-index-in-march',date:'May 20'},
  {title:'Saudi Awwal Bank signs SR6.4 billion financing agreement with AlBawani',src:'google.news',cat:'KSA',link:'https://news.google.com/rss/articles/CBMiVEFVX3lxTE5PVEpscWV4bE1kVWw2SXVWeVViUndRR3cwZXNzZWM4Unl6R2tXc3BrVGl5YWptOERwbm05WnM0dDl6M2Q4REpjR0JiLU1PeTJTNGxrQw?oc=5',date:'May 20'},
  {title:'Saudi real estate transactions grow 6.8 percent to $29.85 billion in Q1 2026 amid improved financing conditions, stronger access to capital',src:'google.news',cat:'KSA',link:'https://news.google.com/rss/articles/CBMigwJBVV95cUxNWDMxcVZTWVFRZktfNEZuVVFETHEtZ0FiWTBMUzRGOWhRbGtGbmtORWFfekp5aEkyNUVyYWwxOXJUX29RQWVBME9tX2x3amdLVTJ0QTlnR1A2Y0VnLXR3cm1PVXBFRVBDbWlXdmRWcFFQeFpEbm1ybVBNdHpWOWhQWWJGUmlvZVZzQUhyQ2xJanpKM2hDZ0JrM3VuN1lzN3BvZ3Y5Z1cwVTA1TGlsUURWQk45emt2TmhGVW8zQ3NuMHhIdWVrR0dNWExoUWpEVmpWTFhEblFBZm9yNldKZFlPYXRNUlk2bEYwUk1yT1dFc21UVVNTdF9xczdpUGJQZDktcERB?oc=5',date:'May 20'},
  {title:'Expo 2030 Riyadh showcases delivery progress at strategic site walkthrough',src:'saudigazette.com.sa',cat:'KSA',link:'https://saudigazette.com.sa/article/661461/saudi-arabia/expo-2030-riyadh-showcases-delivery-progress-at-strategic-site-walkthrough',date:'May 19'}
];
// DO NOT EDIT ABOVE THIS LINE

function isHighImpact(title, cat, filter) {
  if (filter && title.toLowerCase().indexOf(filter.toLowerCase()) === -1) return false;
  if (cat === 'F1')       return !F1_JUNK.test(title);
  if (cat === 'FOOTBALL') return FOOTBALL_KEEP.test(title) && !FOOTBALL_JUNK.test(title);
  if (cat === 'BAYERN')   return !BAYERN_JUNK.test(title);
  if (cat === 'SPL')      return !SPL_JUNK.test(title);
  if (cat === 'KSA')      return KSA_KEEP.test(title) && !KSA_JUNK.test(title);
  return true;
}

function fingerprint(title) {
  var t = title.toLowerCase();
  var found = [];
  ENTITIES_LOWER.forEach(function(e)  { if (t.indexOf(e)  !== -1) found.push(e);  });
  TOPICS_LOWER.forEach(function(tp)   { if (t.indexOf(tp) !== -1) found.push(tp); });
  return found;
}

function isDuplicate(title, seenExact, seenStories) {
  var key = title.toLowerCase().replace(/\W+/g,'');
  if (seenExact[key]) return true;
  var fp          = fingerprint(title);
  var fpEntities  = fp.filter(function(x) { return ENTITIES_LOWER.indexOf(x) !== -1; });
  var fpTopics    = fp.filter(function(x) { return TOPICS_LOWER.indexOf(x)   !== -1; });
  for (var i = 0; i < seenStories.length; i++) {
    var s = seenStories[i];
    var sharedEnt   = fpEntities.filter(function(x) { return s.entities.indexOf(x) !== -1; });
    var sharedTopic = fpTopics.filter(function(x)   { return s.topics.indexOf(x)   !== -1; });
    if (sharedEnt.length > 0 && sharedTopic.length > 0) return true;
  }
  return false;
}

function setFeedFilter(cat, el) {
  currentFilter = cat;
  document.querySelectorAll('.fpill').forEach(function(p) { p.classList.remove('active'); });
  if (el) el.classList.add('active');
  renderNewsFeed();
}

function timeAgo(val) {
  if (typeof val === 'string') return val;
  var diff = (Date.now() - val) / 1000;
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  return Math.floor(diff / 86400) + 'd ago';
}

function boldEntities(text) {
  KEY_ENTITIES.forEach(function(ent) {
    text = text.replace(new RegExp('\\b' + ent + '\\b', 'gi'), '<strong>$&</strong>');
  });
  return text;
}

function makeWireItem(title, src, timeVal, link) {
  return '<div class="wire-item" onclick="window.open(\'' + link + '\',\'_blank\')">'
    + '<span class="wire-bullet">•</span>'
    + '<div class="wire-content">'
    +   '<p class="wire-headline">' + boldEntities(title) + '</p>'
    +   '<div class="wire-meta">'
    +     '<span class="wire-source">' + src + '</span>'
    +     '<span class="wire-time">' + timeAgo(timeVal) + '</span>'
    +   '</div>'
    + '</div>'
    + '</div>';
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
    container.innerHTML = '<div class="empty-state">No stories in this category yet — check back soon</div>';
    setTickerContent(source.slice(0,10).map(function(s){ return s.title; }));
    return;
  }

  var html = '';
  shown.forEach(function(s) {
    html += makeWireItem(s.title, s.src, s.time || s.date || 'Today', s.link);
  });
  container.innerHTML = html;
  setTickerContent(shown.map(function(s) { return s.title; }));
}

async function fetchRSS(channel) {
  try {
    var controller = new AbortController();
    var timer = setTimeout(function() { controller.abort(); }, 7000);
    var res = await fetch(
      'https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(channel.url) + '&count=15',
      { signal: controller.signal }
    );
    clearTimeout(timer);
    var d = await res.json();
    if (d.status === 'ok' && d.items && d.items.length) return d.items;
  } catch(e) {}
  return [];
}

async function loadNewsFeed() {
  var seenExact   = {};
  var seenStories = [];
  parsedStoriesCache = [];

  for (var i = 0; i < MASTER_CHANNELS.length; i++) {
    var ch = MASTER_CHANNELS[i];
    try {
      var items = await fetchRSS(ch);
      for (var j = 0; j < items.length; j++) {
        var item = items[j];
        if (!item.title) continue;
        var title = item.title.replace(/[\r\n]+/g, ' ').trim();
        if (!isHighImpact(title, ch.cat, ch.filter)) continue;
        if (isDuplicate(title, seenExact, seenStories)) continue;
        var fp = fingerprint(title);
        seenExact[title.toLowerCase().replace(/\W+/g,'')] = true;
        seenStories.push({
          entities: fp.filter(function(x) { return ENTITIES_LOWER.indexOf(x) !== -1; }),
          topics:   fp.filter(function(x) { return TOPICS_LOWER.indexOf(x)   !== -1; })
        });
        parsedStoriesCache.push({
          title: title,
          link:  item.link || '#',
          time:  item.pubDate ? Date.parse(item.pubDate) : Date.now(),
          cat:   ch.cat,
          src:   ch.name
        });
      }
    } catch(e) {}
  }

  parsedStoriesCache.sort(function(a, b) { return b.time - a.time; });
  renderNewsFeed();
}
