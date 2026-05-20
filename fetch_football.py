import urllib.request, xml.etree.ElementTree as ET, re
from datetime import timezone
from email.utils import parsedate_to_datetime

SOURCES = [
  {'url':'https://feeds.bbci.co.uk/sport/football/rss.xml',             'src':'BBC Sport'},
  {'url':'https://www.theguardian.com/football/premierleague/rss',      'src':'Guardian PL'},
  {'url':'https://www.theguardian.com/football/serieafootball/rss',     'src':'Guardian Serie A'},
  {'url':'https://www.theguardian.com/football/bundesligafootball/rss', 'src':'Guardian Bund'},
  {'url':'https://www.theguardian.com/football/ligue1football/rss',     'src':'Guardian L1'},
  {'url':'https://www.skysports.com/rss/11095',                         'src':'Sky Sports'},
]

MUST = re.compile('arsenal|man city|liverpool|chelsea|tottenham|united|newcastle|real madrid|barcelona|atletico|juventus|inter|napoli|psg|dortmund|leverkusen|bayern|premier league|la liga|serie a|bundesliga|ligue 1|champions league|europa league', re.I)
HIGH = re.compile('sacked|fired|resign|transfer|signed|signing|injur|suspended|ban|red card|title|champion|relegat|playoff|expel', re.I)
MED  = re.compile('win|loss|defeat|derby|final|match report|contract|announce|confirm', re.I)
JUNK = re.compile('fantasy|predicted lineup|five things|player ratings|watch live|how to watch|betting|quiz|power ranking|player of the|talking points|gallery|ranked|darts|cricket|rugby|tennis|golf|boxing|petition|key moments|tiktok|boats|24 hours of', re.I)

def score(title):
    if JUNK.search(title): return 0
    if not MUST.search(title): return 0
    s = 2
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
                        'title': title.replace("'","-").replace('"','-'),
                        'src':   src['src'],
                        'cat':   'FOOTBALL',
                        'link':  link.replace("'","%27"),
                        'date':  dt.strftime('%b %-d'),
                        'dt':    dt,
                    }
                    count += 1
            print("OK " + src['src'] + ": " + str(count))
        except Exception as e:
            print("SKIP " + src['src'] + ": " + str(e))
    return list(items.values())
