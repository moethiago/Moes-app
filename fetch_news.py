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
F1_JUNK       = re.compile(r'i love|reflects on|friday practice|practice debrief|talking points|five things|how to watch|watch live|quiz|ranked|ranking|gallery|photo|relief', re.I)
FOOTBALL_KEEP = re.compile(r'sack(ed)?|fired|resign|transfer|sign(ed|ing)?|injur|suspend|ban(ned)?|red card|\btitle\b|champion|relegat|derb|match report|\bwin(s)?\b|\bloss\b|defeat|final|semifinal|playoff|expel', re.I)
FOOTBALL_JUNK = re.compile(r'fantasy|predicted lineup|five things|player ratings|watch live|how to watch|betting|quiz|power ranking|player of|talking points|gallery|photo|ranked|relief|darts|cricket|rugby|tennis|golf|boxing', re.I)
BAYERN_KEEP   = re.compile(r'transfer|sign(ed|ing)?|injur|absent|miss(es|ing)?|squad|contract|sack(ed)?|manag|coach|champion|ban|suspend|ruling|announce|confirm', re.I)
SPL_KEEP      = re.compile(r'transfer|sign(ed|ing)?|sack(ed)?|manag|title|champion|relegat|derb|disciplin|ban|suspend|ruling|contract|\bwin(s)?\b|ronaldo|neymar|benzema|mane|al hilal|al nassr|al ittihad|al ahli', re.I)
KSA_KEEP      = re.compile(r'decree|royal|minister|giga|neom|vision 2030|pif|\binvest|\bregulat|reform|\bgdp\b|economic|infrastructure|launch|announce|billion|sovereign|market|\bipo\b|fund|policy', re.I)
KSA_JUNK      = re.compile(r'ceremony|ribbon|visit|tour|festival|fashion|celebrat|inaugurat|honorary|attend', re.I)

MAX_AGE = timedelta(days=7)
NOW = datetime.now(timezone.utc)

# ── SEMANTIC FINGERPRINT ────────────────────────────────
# Key entities to extract from titles
ENTITIES = [
  'arsenal','man city','manchester city','liverpool','chelsea','tottenham','spurs',
  'man united','manchester united','newcastle','aston villa','west ham',
  'real madrid','barcelona','atletico','atletico madrid','sevilla','villarreal',
  'psg','paris','lyon','marseille',
  'bayern','dortmund','bayer leverkusen','leverkusen','rb leipzig',
  'juventus','inter','milan','napoli','roma','lazio','fiorentina',
  'al hilal','al nassr','al ittihad','al ahli',
  'antonelli','russell','leclerc','norris','hamilton','verstappen','piastri','alonso','sainz','perez',
  'ronaldo','neymar','benzema','mane','salah','haaland','mbappe','bellingham','kane',
  'guardiola','klopp','ancelotti','mourinho','tuchel','conte','arteta',
]

TOPICS = [
  'title','champion','win','wins','winner','relegated','relegation','sacked','fired',
  'transfer','signed','signs','signing','injured','injury','banned','ban','suspended',
  'penalty','penalised','crash','dnf','pole','contract','announced','confirmed',
  'premier league','la liga','serie a','bundesliga','ligue 1','champions league',
  'saudi pro league','grand prix',
]

def fingerprint(title):
    t = title.lower()
    found_entities = set()
    found_topics   = set()
    for e in ENTITIES:
        if e in t:
            found_entities.add(e)
    for tp in TOPICS:
        if tp in t:
            found_topics.add(tp)
    # Fingerprint = sorted entities + sorted topics
    # Two stories with same entities + same topic = same story
    return frozenset(found_entities) | frozenset(found_topics)

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
    except Exception:
        return None

items = []
seen_exact   = set()  # exact title dedupe
seen_stories = []     # semantic dedupe — list of fingerprints

def is_duplicate(title):
    # 1. Exact dedupe
    key = re.sub(r'\W+','',title.lower())
    if key in seen_exact:
        return True
    # 2. Semantic dedupe
    fp = fingerprint(title)
    # Need at least 2 matches to call it a duplicate
    # (prevents over-blocking on generic topics)
    if len(fp) >= 2:
        for seen_fp in seen_stories:
            overlap = fp & seen_fp
            if len(overlap) >= 2:
                return True
    return False

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
            dt = parse_date(pub)
            if dt and (NOW - dt) > MAX_AGE: continue
            if not is_high_impact(title, ch['cat'], ch.get('filter')): continue
            if is_duplicate(title): continue
            date_str = dt.strftime('%b %-d') if dt else NOW.strftime('%b %-d')
            clean_title = title.replace("'","-").replace('"','-')
            clean_link  = link.replace("'","%27")
            items.append({
                'title': clean_title,
                'src':   ch['src'],
                'cat':   ch['cat'],
                'link':  clean_link,
                'date':  date_str
            })
            seen_exact.add(re.sub(r'\W+','',title.lower()))
            seen_stories.append(fingerprint(title))
            count += 1
        print("OK " + ch['src'] + ": " + str(count))
    except Exception as e:
        print("SKIP " + ch['src'] + ": " + str(e))

if not items:
    print("No items fetched - skipping")
    sys.exit(0)

items.sort(key=lambda x: x.get('date',''), reverse=True)

lines = []
for i in items:
    lines.append("  {title:'%s',src:'%s',cat:'%s',link:'%s',date:'%s'}" % (
        i['title'], i['src'], i['cat'], i['link'], i['date']))

new_block = "var FALLBACK_NEWS = [\n" + ",\n".join(lines) + "\n];"

with open('js/feed.js','r') as f:
    content = f.read()

updated = re.sub(
    r'// DO NOT EDIT BELOW THIS LINE\nvar FALLBACK_NEWS = \[.*?\];\n// DO NOT EDIT ABOVE THIS LINE',
    '// DO NOT EDIT BELOW THIS LINE\n' + new_block + '\n// DO NOT EDIT ABOVE THIS LINE',
    content, flags=re.DOTALL
)

if updated == content:
    print("Marker not found - skipping")
    sys.exit(0)

with open('js/feed.js','w') as f:
    f.write(updated)

print("Done: " + str(len(items)) + " stories written to js/feed.js")
