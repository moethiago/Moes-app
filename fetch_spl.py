import urllib.request, xml.etree.ElementTree as ET, re
from datetime import timezone
from email.utils import parsedate_to_datetime

SOURCES = [
  {'url':'https://www.arabnews.com/rss.xml',                'src':'Arab News'},
  {'url':'https://saudigazette.com.sa/rssFeed/74',           'src':'Saudi Gazette'},
  {'url':'https://en.majalla.com/rss.xml',                  'src':'Al Majalla'},
  {'url':'https://www.sauditimes.org/feed/',                 'src':'Saudi Times'},
]

HIGH = re.compile('decree|royal order|minister|giga|neom|pif|vision 2030|billion|sovereign fund|ipo|economic reform|gdp|policy|infrastructure|investment|project launch|aramco|megaproject', re.I)
MED  = re.compile('announce|launch|confirm|regulat|fund|market|energy|oil|tourism|initiative|agreement|partnership', re.I)
JUNK = re.compile('ceremony|ribbon|visit|tour|festival|fashion|celebrat|inaugurat|honorary|attend|sport|football|cricket|tennis|golf|weather|traffic|recipe|lifestyle', re.I)

def score(title):
    if JUNK.search(title): return 0
    s = 0
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
                        'cat':   'KSA',
                        'link':  link.replace("'","%27"),
                        'date':  dt.strftime('%b %-d'),
                        'dt':    dt,
                    }
                    count += 1
            print("OK " + src['src'] + ": " + str(count))
        except Exception as e:
            print("SKIP " + src['src'] + ": " + str(e))
    return list(items.values())
