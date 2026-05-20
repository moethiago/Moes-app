import urllib.request, xml.etree.ElementTree as ET, re
from datetime import timezone
from email.utils import parsedate_to_datetime

SOURCES = [
  {'url':'https://www.bavarianfootballworks.com/rss/current.xml',       'src':'Bavarian FW'},
  {'url':'https://www.sportsmole.co.uk/football/bayern-munich/rss.xml', 'src':'Sports Mole Bayern'},
  {'url':'https://www.dailymail.co.uk/sport/football/index.rss',        'src':'Daily Mail Bayern'},
  {'url':'https://feeds.bbci.co.uk/sport/football/rss.xml',             'src':'BBC Bayern'},
  {'url':'https://www.skysports.com/rss/11095',                         'src':'Sky Bayern'},
  {'url':'https://www.theguardian.com/football/bundesligafootball/rss', 'src':'Guardian Bayern'},
]

MUST = re.compile('bayern|munich|fcb|kompany|neuer|musiala|kane|kimmich|sane|davies|gnabry|goretzka|muller|mueller|coman|tel|pavlovic|laimer|upamecano', re.I)
HIGH = re.compile('transfer|signed|signing|injur|missing|ban|suspended|sacked|contract|announce|confirm|champion|title|deal|agree|resign', re.I)
MED  = re.compile('squad|lineup|training|return|comeback|target|interest|negotiat|offer|bid|win|loss|defeat|goal|result', re.I)
JUNK = re.compile('women|youth|reserve|u17|u19|u21|amateur', re.I)

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
                        'cat':   'BAYERN',
                        'link':  link.replace("'","%27"),
                        'date':  dt.strftime('%b %-d'),
                        'dt':    dt,
                    }
                    count += 1
            print("OK " + src['src'] + ": " + str(count))
        except Exception as e:
            print("SKIP " + src['src'] + ": " + str(e))
    return list(items.values())
