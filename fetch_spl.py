import urllib.request, xml.etree.ElementTree as ET, re
from datetime import timezone
from email.utils import parsedate_to_datetime

SOURCES = [
  {'url':'https://saudigazette.com.sa/rssFeed/74',  'src':'Saudi Gazette'},
  {'url':'https://www.arabnews.com/cat/5/rss.xml',  'src':'Arab News Sport'},
  {'url':'https://www.caughtoffside.com/feed/',     'src':'CaughtOffside'},
  {'url':'https://www.90min.com/feed',              'src':'90min'},
]

# Must mention Saudi football specifically
MUST = re.compile(r'al hilal|al nassr|al ittihad|al ahli|al qadsiah|al shabab|al ettifaq|saudi pro league|roshn league|spl|ronaldo|neymar|benzema|mane|mitrovic|brozovic|firmino|malcom|saudi football', re.I)
HIGH = re.compile(r'transfer|signed|signing|sacked|ban|suspended|injur|champion|title|relegat|derby|disciplin|ruling|contract|announce|resign', re.I)
MED  = re.compile(r'win|loss|defeat|match|result|manager|coach|goal|score', re.I)
JUNK = re.compile(r'cricket|rugby|tennis|golf|boxing|formula|f1|motogp|hockey|basketball|nba|nfl|gaza|pavilion|forum|urban|economic cooperation|global challenges', re.I)

def score(title):
    if JUNK.search(title): return 0
    if not MUST.search(title): return 0
    s = 1
    if HIGH.search(title): s += 5
    if MED.search(title):  s += 2
    return s

def fetch(max_age, now, min_score):
    items = {}
    for src in SOURCES:
        try:
            req = urllib.request.Request(src['url'], headers={'User-Agent':'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=10) as r:
                root = ET.fromstring(r.read())
            node = root.find('channel') or root
            count = 0
            for item in node.findall('item'):
                if count >= 10: break
                title = item.findtext('title','').strip()
                link  = item.findtext('link','').strip()
                pub   = item.findtext('pubDate','').strip()
                if not title or not link: continue
                try:
                    dt = parsedate_to_datetime(pub)
                    if dt.tzinfo is None:
                        dt = dt.replace(tzinfo=timezone.utc)
                except:
                    dt = now
                if (now - dt) > max_age: continue
                s = score(title)
                if s < min_score: continue
                key = re.sub(r'\W+','',title.lower())[:60]
                if key not in items:
                    items[key] = {
                        'title': title.replace("'","-").replace('"','-').replace("&#039;","-").replace("&amp;","and"),
                        'src':   src['src'],
                        'cat':   'SPL',
                        'link':  link.replace("'","%27"),
                        'date':  dt.strftime('%b %-d'),
                        'dt':    dt,
                    }
                    count += 1
            print("OK " + src['src'] + ": " + str(count))
        except Exception as e:
            print("SKIP " + src['src'] + ": " + str(e))
    return list(items.values())