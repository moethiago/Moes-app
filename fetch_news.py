import urllib.request, xml.etree.ElementTree as ET, re, sys
from datetime import datetime, timezone, timedelta
from email.utils import parsedate_to_datetime

CHANNELS = [
  {'url':'https://feeds.bbci.co.uk/sport/formula1/rss.xml',             'src':'BBC F1',          'cat':'F1'},
  {'url':'https://www.skysports.com/rss/12040',                         'src':'Sky F1',           'cat':'F1'},
  {'url':'https://www.autosport.com/rss/f1/news/',                      'src':'Autosport',        'cat':'F1'},
  {'url':'https://www.racefans.net/feed/',                               'src':'RaceFans',         'cat':'F1'},
  {'url':'https://the-race.com/feed/',                                   'src':'The Race',         'cat':'F1'},
  {'url':'https://feeds.bbci.co.uk/sport/football/rss.xml',             'src':'BBC Sport',        'cat':'FOOTBALL'},
  {'url':'https://www.skysports.com/rss/11095',                         'src':'Sky Sports',       'cat':'FOOTBALL'},
  {'url':'https://www.theguardian.com/football/premierleague/rss',      'src':'Guardian PL',      'cat':'FOOTBALL'},
  {'url':'https://www.theguardian.com/football/laliga/rss',             'src':'Guardian LaLiga',  'cat':'FOOTBALL'},
  {'url':'https://www.theguardian.com/football/serieafootball/rss',     'src':'Guardian Serie A', 'cat':'FOOTBALL'},
  {'url':'https://www.theguardian.com/football/bundesligafootball/rss', 'src':'Guardian Bund',    'cat':'FOOTBALL'},
  {'url':'https://www.theguardian.com/football/ligue1football/rss',     'src':'Guardian L1',      'cat':'FOOTBALL'},
  {'url':'https://www.espn.com/espn/rss/soccer/news',                   'src':'ESPN FC',          'cat':'FOOTBALL'},
  {'url':'https://feeds.bbci.co.uk/sport/football/rss.xml',             'src':'Bayern - BBC',     'cat':'BAYERN', 'filter':'Bayern'},
  {'url':'https://www.theguardian.com/football/bundesligafootball/rss', 'src':'Bayern - Guard',   'cat':'BAYERN', 'filter':'Bayern'},
  {'url':'https://www.arabnews.com/cat/5/rss.xml',                      'src':'Arab News Sport',  'cat':'SPL'},
  {'url':'https://saudigazette.com.sa/feed',                            'src':'Saudi Gazette',    'cat':'SPL'},
  {'url':'https://www.spa.gov.sa/rss/rss.php?l=en',                    'src':'Saudi Press',      'cat':'KSA'},
  {'url':'https://www.arabnews.com/rss.xml',                            'src':'Arab News',        'cat':'KSA'},
  {'url':'https://www.argaam.com/en/rss',                               'src':'Argaam',           'cat':'KSA'},
]

F1_KEEP       = re.compile(r'\bwin(s|ner)?\b|pole|penalt|crash|dnf|retir|disqualif|contract|sign(ed|ing)?|swap|transfer|fia|champion|ban(ned)?|incident|investigat|fastest lap|grid penalty|power unit|collision|demand', re.I)
F1_JUNK       = re.compile(r'i love|reflects on|preview.*friday|practice debrief|talking points|five things|how to watch|watch.*live|quiz|ranked|ranking|gallery|photo|relief', re.I)
FOOTBALL_KEEP = re.compile(r'sack(ed)?|fired|resign|transfer|sign(ed|ing)?|injur|suspend|ban(ned)?|red card|\btitle\b|champion|relegat|derb|match report|\bwin(s)?\b|\bloss\b|defeat|final|semifinal|playoff|expel', re.I)
FOOTBALL_JUNK = re.compile(r'fantasy|predicted lineup|five things|player ratings|watch live|how to watch|betting|quiz|power ranking|player of|talking points|gallery|photo|ranked|relief|beats.*pdc|darts|cricket|rugby|tennis|golf|boxing', re.I)
BAYERN_KEEP   = re.compile(r'transfer|sign(ed|ing)?|injur|absent|miss(es|ing)?|squad|contract|sack(ed)?|manag|coach|champion|ban|suspend|ruling|announce|confirm', re.I)
SPL_KEEP      = re.compile(r'transfer|sign(ed|ing)?|sack(ed)?|manag|title|champion|relegat|derb|disciplin|ban|suspend|ruling|contract|\bwin(s)?\b|ronaldo|neymar|benzema|mane|al hilal|al nassr|al ittihad|al ahli', re.I)
KSA_KEEP      = re.compile(r'decree|royal|minister|giga|neom|vision 2030|pif|\binvest|\bregulat|reform|\bgdp\b|economic|infrastructure|launch|announce|billion|sovereign|market|\bipo\b|fund|policy', re.I)
KSA_JUNK      = re.compile(r'ceremony|ribbon|visit|tour|festival|fashion|celebrat|inaugurat|honorary|attend', re.I)

MAX_AGE = timedelta(days=7)
NOW = datetime.now(timezone.utc)

def is_high_impact(title, cat, filt=None):
    if filt and filt.lower() not in title.lower(): return False
    if cat == 'F1':       return bool(F1_KEEP.search(title)) and not bool(F1_JUNK.search(title))
    if cat == 'FOOTBALL': return bool(FOOTBALL_KEEP.search(title)) and not bool(FOOTBALL_JUNK.search(title))
    if cat == 'BAYERN':   return bool(BAYERN_KEEP.search(title))
    if cat == 'SPL':      return bool(SPL_KEEP.search(title))
    if cat == 'KSA':      return bool(KSA_KEEP.search(title)) and not bool(KSA_JUNK.search(title))
    return True

def parse_date(pub):
    try:
        dt = parsedate_to_datetime(pub)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except:
        return None

items = []
seen_titles = set()

for ch in CHANNELS:
    try:
        req = urllib.request.Request(ch['url'], headers={'User-Agent':'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=10) as r:
            root = ET.fromstring(r.read())
        node = root.find('channel')
        if node is None:
            node = root
        count = 0
        for item in node.findall('item'):
            if count >= 8: break
            title = item.findtext('title','').strip()
            link  = item.findtext('link','').strip()
            pub   = item.findtext('pubDate','').strip()
            if not title or not link: continue
            title_key = re.sub(r'\W+','',title.lower())
            if title_key in seen_titles: continue
            dt = parse_date(pub)
            if dt and (NOW - dt) > MAX_AGE: continue
            if not is_high_impact(title, ch['cat'], ch.get('filter')): continue
            date_str = dt.strftime('%b %-d') if dt else NOW.strftime('%b %-d')
            items.append({
                'title': title.replace("'","-").replace('"','-'),
                'src':   ch['src'],
                'cat':   ch['cat'],
                'link':  link.replace("'","%27"),
                'date':  date_str
            })
            seen_titles.add(title_key)
            count += 1
        print(f"OK {ch['src']}: {count}")
    except Exception as e:
        print(f"SKIP​​​​​​​​​​​​​​​​
