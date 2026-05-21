// ── FEED.JS ─────────────────────────────────────────────
// Channels: F1, Football (Top 5), Bayern, Saudi Football, Saudi Major News
// Each category is independent - add/remove without touching others

var currentFilter = 'ALL';
var parsedStoriesCache = [];
var tickerTitles = [];
var tickerIndex  = 0;
var tickerTimer  = null;

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
  {title:'Williams recruit McLaren COO Piers Thynne for leadership role',src:'formula1.com',cat:'F1',link:'https://www.formula1.com/en/latest/article/piers-thynne-joins-williams-from-mclaren-as-chief-optimisation-and-planning-officer-amid-raft-of-senior-recruits.10NtETBHXamqiyhB0FTodE',date:'May 21'},
  {title:'Norris reveals special helmet for Jackie Stewart dementia charity',src:'motorsport.com',cat:'F1',link:'https://www.motorsport.com/f1/news/lando-norris-reveals-special-canadian-gp-helmet-for-sir-jackie-stewarts-dementia-charity/10822695/?utm_source=RSS&utm_medium=referral&utm_campaign=RSS-F1&utm_term=News&utm_content=www',date:'May 21'},
  {title:'Williams signs ex-McLaren COO for senior personnel position',src:'motorsportweek.com',cat:'F1',link:'https://www.motorsportweek.com/2026/05/21/williams-secures-major-ex-mclaren-f1-coup/',date:'May 21'},
  {title:'Ocon denies fabricated Haas exit rumours in furious response',src:'google.news',cat:'F1',link:'https://news.google.com/rss/articles/CBMiuwFBVV95cUxOcmdzaGFVN093NWZDLVBkVVpWZDhNSXRLUzA4S1RmZUliT09scW1HbHhxQzB2TlU2bzFsNG1hVkhXUklmTnRnMl9XQ0lPeHN1NWhXejcwdElxSXU5QVE2LVQweVM4anZyanRLaHhfMkhPT1c5ZnNXU2xRYmVoTkpMNFpUVmZFSl95RGVMTnQzbnl3cWhEeTUzVGN0QkhLSmI0NGpqZnJabFZ1ZnNfcWdfUHZtWXozOGJrd3BZ?oc=5',date:'May 21'},
  {title:'Williams signs McLaren COO Piers Thynne for leadership role',src:'motorsportweek.com',cat:'F1',link:'https://www.motorsportweek.com/2026/05/21/williams-secures-major-ex-mclaren-f1-coup/',date:'May 21'},
  {title:'Williams recruits McLaren COO Piers Thynne for leadership',src:'formula1.com',cat:'F1',link:'https://www.formula1.com/en/latest/article/piers-thynne-joins-williams-from-mclaren-as-chief-optimisation-and-planning-officer-amid-raft-of-senior-recruits.10NtETBHXamqiyhB0FTodE',date:'May 21'},
  {title:'Michael Carrick confirms Casemiro decision ahead of Brighton',src:'sportsmole.co.uk',cat:'FOOTBALL',link:'https://www.sportsmole.co.uk/football/man-utd/news/it-just-felt-the-right-time-carrick-confirms-major-casemiro-decision-ahead-of-brighton-clash_597940.html',date:'May 21'},
  {title:'Cristiano Ronaldo wins Saudi Pro League title with Al-Nassr',src:'transfermarkt.co.uk',cat:'FOOTBALL',link:'https://www.transfermarkt.co.uk/34th-major-honour-cristiano-ronaldo-wins-saudi-pro-league-to-end-al-nassr-trophy-drought/view/news/479330',date:'May 21'},
  {title:'Taylor Harwood-Bellis addresses binoculars gesture as Southampton kicked out',src:'mirror.co.uk',cat:'FOOTBALL',link:'https://www.mirror.co.uk/sport/football/news/southampton-spygate-taylor-harwoodbellis-celebration-37189687',date:'May 21'},
  {title:'Casemiro to leave Manchester United, Carrick confirms departure',src:'standard.co.uk',cat:'FOOTBALL',link:'https://www.standard.co.uk/sport/football/man-utd-carrick-casemiro-brighton-b1283212.html',date:'May 21'},
  {title:'Cristiano Ronaldo wins Saudi Pro League title',src:'transfermarkt.co.uk',cat:'FOOTBALL',link:'https://www.transfermarkt.co.uk/34th-major-honour-cristiano-ronaldo-wins-saudi-pro-league-to-end-al-nassr-trophy-drought/view/news/479330',date:'May 21'},
  {title:'Tonda Eckert condemned for Southampton spying',src:'mirror.co.uk',cat:'FOOTBALL',link:'https://www.mirror.co.uk/sport/football/news/southampton-spygate-playoff-middlesbrough-hull-37189738',date:'May 21'},
  {title:'John Stones linked with Bayern Munich move',src:'google.news',cat:'BAYERN',link:'https://news.google.com/rss/articles/CBMinAJBVV95cUxOTlFoeUNrdm5mN2FIamdqZERzQnhCY0M2ZGZzc1BQUUhaTlkzcmZVSTg1VWRNV0JzcnlWek4tbVdwZW1lMjJQWE1uSl9tWlJ0T2RrbUdXdHBESGJmdmR1VFNVakhXTXB1a3Jra3hhMkFCWFpJZWRZRWRhNjIxMDJCM1ZMTHVicFNkZ1VxWHV5WDRaWTdNSEs2U0VheEd6UDBuQ0R4czAtNGhGSzd0X0l5ak5YMWZQajB6QWlSNks2YU8wN3pxZmVsb1poQzVHRko3UENVc1FpNHpUOGVJMXlMNFA4TFFoRDc3aWhFMmlBeUx1T05PNWtSWjJTdHNOOHVtb1pHcnBOM1lZVXdsaFBtTng2TVEwYXhPRVkzVNIBnAJBVV95cUxQajVmYS1qTVdLNXIwNnR5U2tsWFh1Mng0bWlweXJndlU5M3pQYUdsM2dUWmVtZDVQSnFEcHBRMHlTMVBzeG9vWTdtZ2Fnbzl2M3VTanhsbE9NbS02NTl5amxTNXRMSENoSVloRHY4alpPVUxqbzYybUptNVVUOHZfWUJobTkyZjZyMVY3aEpnT1l1bDZmVy1JcmpabTR3bm9EUnJkSzJ2UUt3VkcyVWZUbkVqX2E4YnZndERuck5VRWJqaG8xOUljbUdhNjJhd3ppbTBBQ1g4czZyVFVXM01uVURGcDB6UlJ2VXZoYXIwc0Y4Y2VVZUh2V0ZvU3VkQkI0VTRKcGZIWWsxR3duOTNvaGRLMkR3dVd6eGxvZg?oc=5',date:'May 21'},
  {title:'Manuel Neuer named Germany\'s No. 1 goalkeeper',src:'google.news',cat:'BAYERN',link:'https://news.google.com/rss/articles/CBMijAFBVV95cUxQb0EyV2Z3cG1nYlU2Vkt1ZXdBdS1wb3dxTndmTE1TbUltOXVYU2ZteXlTczNzbWhBc21rc21admlGYzlPSVhEQVNSVW1QX21jRHU0VjVQdXVGcDVxME5jNng1N19Pa1dyeE9QN1Y5elRWd29TTGNfb0daMEF0ZlUzRzFTWDJUalVYVm9law?oc=5',date:'May 21'},
  {title:'Manuel Neuer returns to Germany World Cup squad',src:'google.news',cat:'BAYERN',link:'https://news.google.com/rss/articles/CBMiiAFBVV95cUxOXzc4Wm5FdHVzQjFBUE5vNTJBVzVyVUkwMDBoUl9BT2Q1dVBMOXNQRFBMaTNfelJ1RXd2V3UxenJHNmpEWjFjYmRTYU14VFlZa3ZHLUc0LTM2UTNVN1MwbTlhQl9TTVdxcktSU1VnQnF0dUNNNlhoZzFlSWJHS2VTWDJrVWE0WjdR?oc=5',date:'May 21'},
  {title:'Bayern Munich Frauen complete most successful season to date',src:'google.news',cat:'BAYERN',link:'https://news.google.com/rss/articles/CBMiiwFBVV95cUxPd2xGMjM1Wkc0V2poVkxOdDh1VUNvUWZUbnRmQTAyalFlLW9Za3ptRk1NY1JKVzlIc0ZEYTJOQUlmbUJKbl9XUnlZLTdublJrYUlWOWJwZ25DYVpMWWRPTnd4M1Fub3lNblpnOUFmV2p1RUw1Yld1dk0zWS1JWHVnNkV5ZWVlUFZzU2tV?oc=5',date:'May 21'},
  {title:'Bayern Munich monitoring PSG youth player',src:'google.news',cat:'BAYERN',link:'https://news.google.com/rss/articles/CBMi1AFBVV95cUxQQUxiX19hNkx5YzdzUzZJRmJPVGRnU1F5RzNyVmN6M01oY1FNS1VaR1RBY25LMkNfY05senVmeVVVQUJfeU01cmNOZmwxTjA0d2tfYTJDYXdacVRjMXF6cnhwUktvb2k4d2gxRzI0Y0w4cGVtM3Q4X0FqQURXTmZQSk93Ykd5WlFRSkVXMTBFQnE4UVQzX1k2aWFpa0pKZFhOYVZWOWJRRV9ubm9xaGdiVG1GZDVSMW1IU011NWZZbDZXZ1FDRUNXdXphWmFlY01DdjhFcg?oc=5',date:'May 21'},
  {title:'Ito Hiroki\'s Bayern position affected by Kim Minjae and injuries',src:'google.news',cat:'BAYERN',link:'https://news.google.com/rss/articles/CBMihgFBVV95cUxNUFlWVDRIVUZIalpsTXpnTF9mbUlUaUhSZ3g0MS1sb0htR0hfR1FuNk1GaDc3MFdkUVBGdnRIbXUyNi1PLXd0RmdremlsOG9LRlpjYXFfZjE1eS04RXJIZ19CYWlOVW5OVHIyOThmSlNtVDUzUEpoVGdjY29VUkp1ckF5LXFaQQ?oc=5',date:'May 21'},
  {title:'Ronaldo scores twice as Al Nassr win Saudi Pro League',src:'google.news',cat:'SPL',link:'https://news.google.com/rss/articles/CBMirwFBVV95cUxOYjM4d2huMU5NempSMHJoRUtLQ3pCMVY5c0VBRUZUZ2tGaUx2Wi0xV2VHMlZWOU1QWHRHOHR2NmhfWXgyTU10aXY3cTFWRDVoX3NzSndXSlp2d28wZlF1ay1BOW95OGV0aFI3aHJ0VnpLNnNhSEZubklpSThjUXU3bFc3Y1ltQndSWi03X3BhdEcxc21CLWhDNXNxS0REcHZWX0lVRkxTOVo2eS1pM3JR0gG0AUFVX3lxTE5aY2NDR0lrMUhhLThIVU9PMDFBNUpoaFZHbGppeGRfazhpbmppamJ6RjVFRTJRYWxsVkJhMlBGcDBWVGlHMWlmVUpBSjkxQ3ZlUDRRR184c09iRE4tOU0yUGVESUlmQnRNSFlyOERYRU5aZU41MEZzSzIwTE9YZzBUOUhZOTZZTTFoMy1IMXlhLTRhV0diaVFRUzZ2U3QyMXNsS0RmQVhBQkFES1JFYjFIbmxnQw?oc=5',date:'May 21'},
  {title:'Al Nassr crowned Saudi Pro League champions, final standings updated',src:'google.news',cat:'SPL',link:'https://news.google.com/rss/articles/CBMi3AFBVV95cUxPMHNIREZ3TWZvTW8tVi1PVlYxRlVoT1RHOWxjNzF2NGloQ0hnM0JhUjlYWmJCVlVmTWxXSlFFUUVwaDd2QWR2enNpNzRkc1o5TmpBeWRiSUd5RmhwdmJ4ZVZtUE5KRGVZdHNRUFpkck1lOFRyVEVpNmd4Q3VwSC1Ed0JlNnlPWWEzNXNqdlNySk1CRlNmWWN1QlFrdDJhaGpZanpKMWVVdnRHLTRXaGtQYndlczU0VFdsUEl5VncwZXBhaFN5cUVUODNzZ1dsSDFCaUZjdGdHN1JFQ2Zn0gHgAUFVX3lxTFB3anNBcDlqUWk3b0JPR3dUdkwzQl9MQ1V4NnZxcXhhc0dXaktPblRuNkpKSF84SzVYcklnN0hSQmZNN2VOR1BBaGRtRTRzZ1cxNmExcVRfcTVXc096c1JiWXBNMlFqQ2FWQVBtYjAwbUFZSE1CMENfd3Bub3l5aF9hRXpQZl9xWGhvdzB4UVVNQkcwVjg2N3RValUxbGVOb0FIZjNsTGFmbW5FT21sNjlWNG50aHNzeW1Lc2JkMk5OTERtazY1RDVHdXVMY2NETzBSV0QwbDRwSXFnSWloRXFr?oc=5',date:'May 21'},
  {title:'Al Nassr clinch Saudi Pro League title with Ronaldo',src:'google.news',cat:'SPL',link:'https://news.google.com/rss/articles/CBMiqgFBVV95cUxQZEJORElzR1JCMGRVS0dxZFNmeUpNUHdGbWJ3OGIwTVFZbnNsaXdMUHpxZFBUNUNCWnU2Z3ZlTm1mdC03WXlJdnh4UVJyTmw2Z0xPZlpoYldGSFhIM2NZZkM2MF9EUUJXVkNzOU00Mkt2eTl6emFnMTZ0eE91T3RhZEg5Q3ltb1k3ZXVNNU1yclhrZ3JIRzEyUnpQdDlzal96OFFiVlRPajBSZw?oc=5',date:'May 21'},
  {title:'Al Nassr clinch Saudi Pro League title, Ronaldo scores brace',src:'google.news',cat:'SPL',link:'https://news.google.com/rss/articles/CBMi9wFBVV95cUxNTE9hMG9MbWktM1p2bGNlOWtZS2NMelhwUUZmM1Zva0U1cG9vRFMzNlBDeE5HY1NWUGlROGtOMEcybXVxYmVWSGZ3Z2pRek5DTXp0LURkZ0ozODdtSUhPM1BaeWN5VUtVdW9PZUd3dUVyWnQwbjdaUEpReDdRMlYxQy13V2Rjdm9IdHg3cDNiMWpDWlFzZFJUOFF6MGIzaEFLWm1SakJuVmFsbS1mVF95d1dEWDZkM0YzTkZoRFdLdWZFYWdzWDBZdTRWOUNzY2NQS1JxM2JheXdGNmNZS1lxRUR2RE1LOURuNWNsSG84MWF1YnpiMjdJ?oc=5',date:'May 21'},
  {title:'Al Hilal beat Al Fayha 1-0 in Saudi Pro League',src:'google.news',cat:'SPL',link:'https://news.google.com/rss/articles/CBMiekFVX3lxTE11QVUyeXpmLWFJcXZ1MzdjMWltZUlYeUUtbllVSXFYQnVwTWtRRGYyTGpxak5yZlBWVEViU0U3QmNPZVc3Q2VNbGVfMEtROTVCUm1sbS1xd3Via21rQkU3TEg0UkQ3ZXRaVGwxTFpPQXczVFZDZWFIWUdB?oc=5',date:'May 21'},
  {title:'Al Nassr clinch Saudi Pro League title with Damac win',src:'google.news',cat:'SPL',link:'https://news.google.com/rss/articles/CBMi9wFBVV95cUxNTE9hMG9MbWktM1p2bGNlOWtZS2NMelhwUUZmM1Zva0U1cG9vRFMzNlBDeE5HY1NWUGlROGtOMEcybXVxYmVWSGZ3Z2pRek5DTXp0LURkZ0ozODdtSUhPM1BaeWN5VUtVdW9PZUd3dUVyWnQwbjdaUEpReDdRMlYxQy13V2Rjdm9IdHg3cDNiMWpDWlFzZFJUOFF6MGIzaEFLWm1SakJuVmFsbS1mVF95d1dEWDZkM0YzTkZoRFdLdWZFYWdzWDBZdTRWOUNzY2NQS1JxM2JheXdGNmNZS1lxRUR2RE1LOURuNWNsSG84MWF1YnpiMjdJ?oc=5',date:'May 21'},
  {title:'UK-GCC free trade deal set to boost Saudi-British trade and investment',src:'saudigazette.com.sa',cat:'KSA',link:'https://saudigazette.com.sa/article/661490/saudi-arabia/uk-gcc-free-trade-deal-set-to-boost-saudi-british-trade-and-investment',date:'May 20'},
  {title:'Minister Al-Rabiah: Saudi Arabia sets global benchmark in crowd management technology',src:'saudigazette.com.sa',cat:'KSA',link:'https://saudigazette.com.sa/article/661489/saudi-arabia/minister-al-rabiah-saudi-arabia-sets-global-benchmark-in-crowd-management-through-advanced-technology',date:'May 20'},
  {title:'Saudi Arabia and Britain sign Gaza children healthcare support agreement',src:'saudigazette.com.sa',cat:'KSA',link:'https://saudigazette.com.sa/article/661487/saudi-arabia/saudi-arabia-britain-sign-deal-to-support-injured-children-in-gaza',date:'May 20'},
  {title:'Saudi Arabia non-oil trade surplus with GCC reaches SR4.47 billion in February',src:'saudigazette.com.sa',cat:'KSA',link:'https://saudigazette.com.sa/article/661486/saudi-arabia/saudi-arabias-non-oil-trade-surplus-with-gcc-countries-reaches-sr447-billion-in-february',date:'May 20'},
  {title:'Saudi operating revenue index rises 10.2 percent in March',src:'saudigazette.com.sa',cat:'KSA',link:'https://saudigazette.com.sa/article/661481/saudi-arabia/gastat-102-rise-in-saudi-operating-revenue-index-in-march',date:'May 20'},
  {title:'Saudi real estate transactions grow 6.8 percent to $29.85 billion in Q1 2026',src:'google.news',cat:'KSA',link:'https://news.google.com/rss/articles/CBMigwJBVV95cUxNWDMxcVZTWVFRZktfNEZuVVFETHEtZ0FiWTBMUzRGOWhRbGtGbmtORWFfekp5aEkyNUVyYWwxOXJUX29RQWVBME9tX2x3amdLVTJ0QTlnR1A2Y0VnLXR3cm1PVXBFRVBDbWlXdmRWcFFQeFpEbm1ybVBNdHpWOWhQWWJGUmlvZVZzQUhyQ2xJanpKM2hDZ0JrM3VuN1lzN3BvZ3Y5Z1cwVTA1TGlsUURWQk45emt2TmhGVW8zQ3NuMHhIdWVrR0dNWExoUWpEVmpWTFhEblFBZm9yNldKZFlPYXRNUlk2bEYwUk1yT1dFc21UVVNTdF9xczdpUGJQZDktcERB?oc=5',date:'May 20'}
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
  // val is either a Unix timestamp (number) or a date string like "May 21"
  var ts;
  if (typeof val === 'number') {
    ts = val;
  } else {
    // parse "May 21" style date string
    try {
      var year = new Date().getFullYear();
      ts = Date.parse(val + ' ' + year);
      if (isNaN(ts)) return val;
    } catch(e) {
      return val;
    }
  }
  var diffMs  = Date.now() - ts;
  var diffMin = Math.floor(diffMs / 60000);
  var diffHr  = Math.floor(diffMs / 3600000);

  if (diffMin < 1)  return 'just now';
  if (diffMin < 60) return diffMin + 'm ago';
  if (diffHr  < 24) return diffHr  + 'h ago';

  // over 24h — show date only, no time
  var d = new Date(ts);
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return months[d.getMonth()] + ' ' + d.getDate();
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
