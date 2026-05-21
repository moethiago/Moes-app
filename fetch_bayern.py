import urllib.request, xml.etree.ElementTree as ET, re
from datetime import timezone
from email.utils import parsedate_to_datetime

SOURCES = [
  {'url':'https://www.sportsmole.co.uk/football/bayern-munich/rss.xml', 'src':'Sports Mole Bayern'},
  {'url':'https://www.theguardian.com/football/bundesligafootball/rss', 'src':'Guardian Bayern'},
  {'url':'https://feeds.bbci.co.uk/sport/football/rss.xml',             'src':'BBC Bayern'},
  {'url':'https://www.skysports.com/rss/11095',                         'src':'Sky Bayern'},
]

# Dedicated feed like Sports Mole Bayern only has Bayern stories
DEDICATED = ['Sports Mole Bayern']

MUST = re.compile(r'bayern|munich|fcb|kompany|neuer|musiala|kane|kimmich|sane|davies|gnabry|goretzka|muller|mueller|coman|pavlovic|laimer|upamecano|allianz', re.I)
HIGH = re.compile(r'transfer|signed|signing|injur|missing|ban|suspended|sacked|contract|announce|confirm|champion|title|deal|agree|resign', re.I)
MED  = re.compile(r'squad|lineup|return|comeback|target|interest|offer|bid|win|loss|defeat|goal|result|match', re.I)
JUNK = re.compile(r'women|youth|reserve|u17|u19|u21|amateur', re.I)

def score(title, is_dedicated):
    if JUNK.search(title): return 0
    if not is_dedicated and not MUST.search(title): return 0
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
            is_dedicated = src['src'] in DEDICATED
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
                s = score(title, is_dedicated)
                if s < min_score: continue
                # Double check: even dedicated feeds must mention Bayern-related terms
                if not MUST.search(title): continue
                key = re.sub(r'\W+','',title.lower())[:60]
                if key not in items:
                    items[key] = {
                        'title': title.replace("'","-").replace('"','-').replace("&#039;","-").replace("&amp;","and"),
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