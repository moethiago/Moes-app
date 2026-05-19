import urllib.request, xml.etree.ElementTree as ET, re, sys
from datetime import datetime, timezone, timedelta
from email.utils import parsedate_to_datetime

CHANNELS = [
  # F1 — dedicated feeds only
  {'url':'https://feeds.bbci.co.uk/sport/formula1/rss.xml',          'src':'BBC F1',      'cat':'F1'},
  {'url':'https://www.autosport.com/rss/f1/news/',                    'src':'Autosport',   'cat':'F1'},

  # Football — Top 5 leagues
  {'url':'https://feeds.bbci.co.uk/sport/football/rss.xml',          'src':'BBC Sport',        'cat':'FOOTBALL'},
  {'url':'https://www.theguardian.com/football/premierleague/rss',   'src':'Guardian PL',      'cat':'FOOTBALL'},
  {'url':'https://www.theguardian.com/football/laliga/rss',          'src':'Guardian LaLiga',  'cat':'FOOTBALL'},
  {'url':'https://www.theguardian.com/football/serieafootball/rss',  'src':'Guardian Serie A', 'cat':'FOOTBALL'},
  {'url':'https://www.theguardian.com/football/bundesligafootball/rss','src':'Guardian Bund',  'cat':'FOOTBALL'},
  {'url':'https://www.theguardian.com/football/ligue1football/rss',  'src':'Guardian L1',      'cat':'FOOTBALL'},
  {'url':'https://www.espn.com/espn/rss/soccer/news',                'src':'ESPN FC',          'cat':'FOOTBALL'},

  # Bayern — dedicated feeds only
  {'url':'https://fcbayern.com/en/api/rss/content',                  'src':'Bayern Official',       'cat':'BAYERN'},
  {'url':'https://www.bavarianfootballworks.com/rss/current.xml',    'src':'Bavarian Football Works','cat':'BAYERN'},

  # Saudi Football — dedicated feeds only
  {'url':'https://www.arabnews.com/saudi-football/rss.xml',         'src':'Arab News SPL',    'cat':'SPL'},
  {'url':'https://www.goal.com/en-sa/rss/news',                     'src':'Goal Saudi',       'cat':'SPL'},

  # Saudi Major News — dedicated feeds only
  {'url':'https://www.arabnews.com/saudi-arabia/rss.xml',           'src':'Arab News KSA',    'cat':'KSA'},
  {'url':'https://www.arabnews.com/economy/rss.xml',                'src':'Arab News Economy','cat':'KSA'},
]

# Filters — only needed as safety net now that feeds are dedicated
F1_JUNK       = re.compile(r'motogp|moto gp|indycar|isle of man|nascar|wrc|rally|superbike|rugby|cricket|tennis|golf|boxing|football|soccer|premier league', re.I)
FOOTBALL_KEEP = re.compile(r'sack(ed)?|fired|resign|transfer|sign(ed|ing)?|injur|suspend|ban(ned)?|red card|\btitle\b|champion|relegat|derb|match report|\bwin(s)?\b|\bloss\b|defeat|final|semifinal|playoff|expel', re.I)
FOOTBALL_JUNK = re.compile(r'fantasy|predicted lineup|five things|player ratings|watch live|how to watch|betting|quiz|power ranking|player of|talking points|gallery|photo|ranked|darts|cricket|rugby|tennis|golf|boxing', re.I)
BAYERN_JUNK   = re.compile(r'women|youth|reserve|u17|u19|u21|amateure', re.I)
SPL_JUNK      = re.compile(r'cricket|rugby|tennis|golf|boxing|motorsport|formula', re.I)
KSA_JUNK      = re.compile(r'ceremony|ribbon|visit|tour|festival|fashion|celebrat|inaugurat|honorary|attend|sport|football|cricket|tennis', re.I)
KSA_KEEP      = re.compile(r'decree|royal|minister|giga|neom|vision 2030|pif|\binvest|\bregulat|reform|\bgdp\b|economic|infrastructure|launch|announce|billion|sovereign|market|\bipo\b|fund|policy|project', re.I)

MAX_AGE = timedelta(days=7)
NOW = datetime.now(timezone.utc)

ENTITIES = [
  'arsenal','man city','manchester city','liverpool','chelsea','tottenham','spurs',
  'man united','manchester united','newcastle','aston villa','west ham',
  'real madrid','barcelona','atletico','sevilla','villarreal',
  'psg','paris','lyon','marseille',
  'bayern','dortmund','leverkusen','rb leipzig',
  'juventus','inter','milan','napoli','roma','lazio',
  'al hilal','al nassr','al ittihad','al ahli',
  'antonelli','russell','leclerc','norris','hamilton','verstappen','piastri','alonso','sainz','perez',
  'ronaldo','neymar','benzema','mane','salah','haaland','mbappe','bellingham','kane',
  'guardiola','klopp','ancelotti','mourinho','tuchel','conte','arteta',
]

TOPICS = [
  'title','champion','win','wins','winner','relegated','relegation','sacked','fired',
  'transfer','signed','signs','signing','injured','injury','banned','ban','suspended',
  'penalty','crash','dnf','pole','contract','announced','confirmed',
  'premier league','la liga','serie a','bundesliga','ligue 1','champions league',
  'saudi pro league','grand prix',
]

def fingerprint(title):
    t = title.lower()
    found = set()
    for e in ENTITIES:
        if e in t: found.add(e)
    for tp in TOPICS:
        if tp in t: found.add(tp)
    return frozenset(found)

def is_high_impact(title, cat):
    if cat == 'F1':       return not bool(F1_JUNK.search(title))
    if cat == 'FOOTBALL': return bool(FOOTBALL_KEEP.search(title)) and not bool(FOOTBALL_JUNK.search(title))
    if cat == 'BAYERN':   return not bool(BAYERN_JUNK.search(title))
    if cat == 'SPL':      return not bool(SPL_JUNK.search(title))
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
seen_exact = set()
seen_stories = []

def is_duplicate(title):
    key = re.sub(r'\W+', '', title.lower())
    if key in seen_exact: return True
    fp = fingerprint(title)
    fp_entities = fp & set(ENTITIES)
    fp_topics   = fp & set(TOPICS)
    for seen_fp in seen_stories:
        if fp_entities & (seen_fp & set(ENTITIES)) and fp_topics & (seen_fp & set(TOPICS)):
            return True
    return False

for ch in CHANNELS:
    try:
        req = urllib.request.Request(ch['url'], headers={'User-Agent':'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=10) as r:
            root = ET.fromstring(r.read())
        node = root.find('channel')
        if node is None: node = root
        count = 0
        for item in node.findall('item'):
            if count >= 8: break
            title = item.findtext('title','').strip()
            link  = item.findtext('link','').strip()
            pub   = item.findtext('pubDate','').strip()
            if not title or not link: continue
            dt = parse_date(pub)
            if dt and (NOW - dt) > MAX_AGE: continue
            if not is_high_impact(title, ch['cat']): continue
            if is_duplicate(title): continue
            date_str = dt.strftime('%b %-d') if dt else NOW.strftime('%b %-d')
            items.append({
                'title': title.replace("'","-").replace('"','-'),
                'src':   ch['src'],
                'cat':   ch['cat'],
                'link':  link.replace("'","%27"),
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
