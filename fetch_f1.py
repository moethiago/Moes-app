import urllib.request, xml.etree.ElementTree as ET, re
from datetime import timezone
from email.utils import parsedate_to_datetime

SOURCES = [
  {'url':'https://feeds.bbci.co.uk/sport/formula1/rss.xml', 'src':'BBC F1'},
  {'url':'https://www.autosport.com/rss/f1/news/',           'src':'Autosport'},
  {'url':'https://www.theguardian.com/sport/formulaone/rss', 'src':'Guardian F1'},
  {'url':'https://www.gptoday.net/rss/news/rss.xml',         'src':'GPToday'},
  {'url':'https://racer.com/category/formula-1/feed/',       'src':'Racer'},
]

MUST = re.compile('f1|formula|grand prix|gp|race|driver|grid|lap|qualifying|verstappen|hamilton|norris|leclerc|russell|antonelli|piastri|alonso|sainz|perez|mclaren|ferrari|mercedes|red bull|alpine|williams|aston martin|haas|fia|circuit|championship|constructor|season|podium|sprint', re.I)
HIGH = re.compile('win|winner|pole|penalt|crash|dnf|disqualif|retire|champion|ban|contract|transfer|sign|incident|investigat|collision|grid penalty|power unit', re.I)
MED  = re.compile('fastest lap|overtake|strategy|upgrade|announce|confirm|title|standings|preview|reaction|analysis', re.I)
JUNK = re.compile('motogp|indycar|nascar|wrc|superbike|isle of man|rugby|cricket|tennis|golf|boxing|petition|cadillac entry|how gm', re.I)

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
                        'title': title.replace("'","-").replace('"','-'),
                        'src':   src['src'],
                        'cat':   'F1',
                        'link':  link.replace("'","%27"),
                        'date':  dt.strftime('%b %-d'),
                        'dt':    dt,
                    }
                    count += 1
            print("OK " + src['src'] + ": " + str(count))
        except Exception as e:
            print("SKIP " + src['src'] + ": " + str(e))
    return list(items.values())
