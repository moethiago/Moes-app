import urllib.request, xml.etree.ElementTree as ET, re, sys
from datetime import datetime, timezone, timedelta
from email.utils import parsedate_to_datetime

MAX_AGE = timedelta(days=7)
NOW = datetime.now(timezone.utc)
MIN_SCORE = 3

F1_SOURCES = [
  {'url':'https://feeds.bbci.co.uk/sport/formula1/rss.xml', 'src':'BBC F1'},
  {'url':'https://www.autosport.com/rss/f1/news/',           'src':'Autosport'},
]

FOOTBALL_SOURCES = [
  {'url':'https://feeds.bbci.co.uk/sport/football/rss.xml',             'src':'BBC Sport'},
  {'url':'https://www.theguardian.com/football/premierleague/rss',      'src':'Guardian PL'},
  {'url':'https://www.theguardian.com/football/serieafootball/rss',     'src':'Guardian Serie A'},
  {'url':'https://www.theguardian.com/football/bundesligafootball/rss', 'src':'Guardian Bund'},
  {'url':'https://www.theguardian.com/football/ligue1football/rss',     'src':'Guardian L1'},
  {'url':'https://www.skysports.com/rss/11095',                         'src':'Sky Sports'},
]

BAYERN_SOURCES = [
  {'url':'https://www.theguardian.com/football/bundesligafootball/rss', 'src':'Guardian Bund'},
  {'url':'https://feeds.bbci.co.uk/sport/football/rss.xml',             'src':'BBC Sport'},
  {'url':'https://www.skysports.com/rss/11095',                         'src':'Sky Sports'},
]

SPL_SOURCES = [
  {'url':'https://www.arabnews.com/cat/5/rss.xml', 'src':'Arab News Sport'},
  {'url':'https://saudigazette.com.sa/rssFeed/74',  'src':'Saudi Gazette'},
]

KSA_SOURCES = [
  {'url':'https://www.arabnews.com/rss.xml',       'src':'Arab News'},
  {'url':'https://saudigazette.com.sa/rssFeed/74',  'src':'Saudi Gazette'},
]

F1_MUST  = re.compile('f1|formula 1|formula one|grand prix|verstappen|hamilton|norris|leclerc|russell|antonelli|piastri|alonso|sainz|perez|mclaren|ferrari|mercedes|red bull|alpine|williams|aston martin|haas', re.I)
F1_HIGH  = re.compile('win|winner|pole|penalt|crash|dnf|disqualif|retire|fia|champion|ban|contract|transfer|sign|incident|investigat|collision|grid penalty|power unit', re.I)
F1_MED   = re.compile('fastest lap|overtake|strategy|upgrade|announce|confirm|title fight|standings', re.I)
F1_JUNK  = re.compile('motogp|indycar|nascar|wrc|rally|superbike|isle of man|rugby|cricket|tennis|golf|boxing|petition|practice preview|preview.*friday|q&a|cadillac', re.I)

FB_MUST  = re.compile('arsenal|man city|liverpool|chelsea|tottenham|united|newcastle|real madrid|barcelona|atletico|juventus|inter milan|napoli|psg|dortmund|leverkusen|bayern|premier league|la liga|serie a|bundesliga|ligue 1|champions league|europa league', re.I)
FB_HIGH  = re.compile('sacked|fired|resign|transfer|signed|signing|injur|suspended|ban|red card|title|champion|relegat|playoff|expel', re.I)
FB_MED   = re.compile('win|loss|defeat|derby|final|match report|contract|announce|confirm', re.I)
FB_JUNK  = re.compile('fantasy|predicted lineup|five things|player ratings|watch live|how to watch|betting|quiz|power ranking|player of the|talking points|gallery|ranked|darts|cricket|rugby|tennis|golf|boxing|petition|key moments|tiktok|boats|24 hours of', re.I)

BAY_MUST = re.compile('bayern|munich|fcb|kompany|neuer|musiala|kane|kimmich|sane|davies|gnabry|goretzka|muller', re.I)
BAY_HIGH = re.compile('transfer|signed|signing|injur|missing|ban|suspended|sacked|contract|announce|confirm|champion|title', re.I)
BAY_MED  = re.compile('squad|lineup|training|return|comeback|target|interest|negotiat|offer|deal', re.I)
BAY_JUNK = re.compile('women|youth|reserve|u17|u19|u21|amateur', re.I)

SPL_MUST = re.compile('al hilal|al nassr|al ittihad|al ahli|al qadsiah|al shabab|saudi|spl|pro league|ronaldo|neymar|benzema|mane|mitrovic|brozovic|kante|milinkovic', re.I)
SPL_HIGH = re.compile('transfer|signed|signing|sacked|ban|suspended|injur|champion|title|relegat|derby|disciplin|ruling', re.I)
SPL_MED  = re.compile('win|loss|defeat|match|result|contract|announce|manager|coach', re.I)
SPL_JUNK = re.compile('cricket|rugby|tennis|golf|boxing|formula|f1|motogp|hockey', re.I)

KSA_HIGH = re.compile('decree|royal order|minister|giga|neom|pif|vision 2030|billion|sovereign fund|ipo|economic reform|gdp|policy|infrastructure|investment', re.I)
KSA_MED  = re.compile('announce|launch|confirm|regulat|fund|market|energy|oil|aramco|tourism|initiative', re.I)
KSA_JUNK = re.compile('ceremony|ribbon|visit|tour|festival|fashion|celebrat|inaugurat|honorary|attend|sport|football|cricket|tennis|golf|weather|traffic', re.I)

def score_f1(title):
    if F1_JUNK.search(title): return 0
    if not F1_MUST.search(title): return 0
    s = 2
    if F1_HIGH.search(title): s += 5
    if F1_MED.search(title):  s += 2
    return s

def score_football(title):
    if FB_JUNK.search(title): return 0
    if not FB_MUST.search(title): return 0
    s = 2
    if FB_HIGH.search(title): s += 5
    if FB_MED.search(title):  s += 2
    return s

def score_bayern(title):
    if BAY_JUNK.search(title): return 0
    if not BAY_MUST.search(title): return 0
    s = 2
    if BAY_HIGH.search(title): s += 5
    if BAY_MED.search(title):  s += 2
    return s

def score_spl(title):
    if SPL_JUNK.search(title): return 0
    if not SPL_MUST.search(title): return 0
    s = 2
    if SPL_HIGH.search(title): s += 5
    if SPL_MED.search(title):  s += 2
    return s

def score_ksa(title):
    if KSA_JUNK.search(title): return 0
    s = 0
    if KSA_HIGH.search(title): s += 5
    if KSA_MED.search(title):  s += 2
    return s

SCORERS = {
    'F1':       score_f1,
    'FOOTBALL': score_football,
    'BAYERN':   score_bayern,
    'SPL':      score_spl,
    'KSA':      score_ksa,
}

ALL_SOURCES = {
    'F1':       F1_SOURCES,
    'FOOTBALL': FOOTBALL_SOURCES,
    'BAYERN':   BAYERN_SOURCES,
    'SPL':      SPL_SOURCES,
    'KSA':      KSA_SOURCES,
}

def parse_date(pub):
    try:
        dt = parsedate_to_datetime(pub)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return None

def fetch_feed(url):
    req = urllib.request.Request(url, headers={'User-Agent':'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=10) as r:
        root = ET.fromstring(r.read())
    node = root.find('channel')
    return node if node is not None else root

all_items = {}

for cat, sources in ALL_SOURCES.items():
    scorer = SCORERS[cat]
    for src in sources:
        try:
            node = fetch_feed(src['url'])
            count = 0
            for item in node.findall('item'):
                if count >= 10: break
                title = item.findtext('title','').strip()
                link  = item.findtext('link','').strip()
                pub   = item.findtext('pubDate','').strip()
                if not title or not link: continue
                dt = parse_date(pub)
                if dt and (NOW - dt) > MAX_AGE: continue
                s = scorer(title)
                if s < MIN_SCORE: continue
                date_str = dt.strftime('%b %-d') if dt else NOW.strftime('%b %-d')
                clean_key = re.sub(r'\W+','',title.lower())[:60]
                if clean_key not in all_items:
                    all_items[clean_key] = {
                        'title': title.replace("'","-").replace('"','-'),
                        'src':   src['src'],
                        'cat':   cat,
                        'link':  link.replace("'","%27"),
                        'date':  date_str,
                        'score': s,
                        'dt':    dt or NOW,
                    }
                    count += 1
            print("OK " + src['src'] + " [" + cat + "]: " + str(count))
        except Exception as e:
            print("SKIP " + src['src'] + " [" + cat + "]: " + str(e))

items = list(all_items.values())
items.sort(key=lambda x: x['dt'], reverse=True)

if not items:
    print("No items - skipping")
    sys.exit(0)

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
