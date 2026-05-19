import urllib.request
import xml.etree.ElementTree as ET
import re
import sys
import os
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime

CHANNELS = [
  # F1
  {'url':'https://feeds.bbci.co.uk/sport/formula1/rss.xml',             'src':'BBC F1',          'cat':'F1'},
  {'url':'https://www.skysports.com/rss/12040',                         'src':'Sky F1',           'cat':'F1'},
  {'url':'https://www.autosport.com/rss/f1/news/',                      'src':'Autosport',        'cat':'F1'},
  {'url':'https://www.racefans.net/feed/',                               'src':'RaceFans',         'cat':'F1'},
  {'url':'https://the-race.com/feed/',                                   'src':'The Race',         'cat':'F1'},
  # Football
  {'url':'https://feeds.bbci.co.uk/sport/football/rss.xml',             'src':'BBC Sport',        'cat':'FOOTBALL'},
  {'url':'https://www.skysports.com/rss/11095',                         'src':'Sky Sports',       'cat':'FOOTBALL'},
  {'url':'https://www.theguardian.com/football/premierleague/rss',      'src':'Guardian PL',      'cat':'FOOTBALL'},
  {'url':'https://www.theguardian.com/football/laliga/rss',             'src':'Guardian LaLiga',  'cat':'FOOTBALL'},
  {'url':'https://www.theguardian.com/football/serieafootball/rss',     'src':'Guardian Serie A', 'cat':'FOOTBALL'},
  {'url':'https://www.theguardian.com/football/bundesligafootball/rss', 'src':'Guardian Bund',    'cat':'FOOTBALL'},
  {'url':'https://www.theguardian.com/football/ligue1football/rss',     'src':'Guardian L1',      'cat':'FOOTBALL'},
  {'url':'https://www.espn.com/espn/rss/soccer/news',                   'src':'ESPN FC',          'cat':'FOOTBALL'},
  # Bayern
  {'url':'https://feeds.bbci.co.uk/sport/football/rss.xml',             'src':'Bayern - BBC',     'cat':'BAYERN', 'filter':'Bayern'},
  {'url':'https://www.theguardian.com/football/bundesligafootball/rss', 'src':'Bayern - Guard',   'cat':'BAYERN', 'filter':'Bayern'},
  # Saudi Football
  {'url':'https://www.arabnews.com/cat/5/rss.xml',                      'src':'Arab News Sport',  'cat':'SPL'},
  {'url':'https://saudigazette.com.sa/feed',                            'src':'Saudi Gazette',    'cat':'SPL'},
  # Saudi Major News
  {'url':'https://www.spa.gov.sa/rss/rss.php?l=en',                     'src':'Saudi Press',      'cat':'KSA'},
  {'url':'https://www.arabnews.com/rss.xml',                            'src':'Arab News',        'cat':'KSA'},
  {'url':'https://www.argaam.com/en/rss',                               'src':'Argaam',           'cat':'KSA'},
]

# We use \b to ensure exact word matches. "ban" will no longer match "urban".
F1_KEEP       = re.compile(r'\b(win|winner|pole|penalty|penalties|crash|dnf|retire|disqualified|contract|sign|swap|transfer|ruling|fia|champion|ban|incident|investigation|fastest lap)\b', re.I)
FOOTBALL_KEEP = re.compile(r'\b(sack|sacked|fired|resign|transfer|sign|signing|injury|injured|suspend|suspended|ban|red card|title|champion|relegate|relegation|derby|result|win|loss|defeat|final|semifinal|playoff)\b', re.I)
FOOTBALL_JUNK = re.compile(r'\b(fantasy|predicted|lineup|five things|player ratings|watch live|how to watch|betting|odds|quiz|power ranking|gossip|rumours|stream)\b', re.I)
BAYERN_KEEP   = re.compile(r'\b(transfer|sign|signing|injury|injured|absent|lineup|squad|contract|sack|sacked|manager|coach|champion|ban|suspend|ruling|official|announce)\b', re.I)
SPL_KEEP      = re.compile(r'\b(transfer|sign|signing|sack|sacked|manager|title|champion|relegate|relegation|derby|discipline|ban|suspend|ruling|contract|result|win|ronaldo|neymar|benzema|mane)\b', re.I)
KSA_KEEP      = re.compile(r'\b(decree|royal|minister|giga|neom|vision 2030|pif|invest|investment|regulate|regulation|reform|gdp|economic|economy|infrastructure|launch|announce|billion|sovereign|market|ipo)\b', re.I)
KSA_JUNK      = re.compile(r'\b(ceremony|ribbon|visit|tour|festival|fashion|celebrate|inaugurate|honorary)\b', re.I)

def is_high_impact(title, cat, filt=None):
    if filt and filt.lower() not in title.lower(): return False
    if cat == 'F1':       return bool(F1_KEEP.search(title))
    if cat == 'FOOTBALL': return bool(FOOTBALL_KEEP.search(title)) and not bool(FOOTBALL_JUNK.search(title))
    if cat == 'BAYERN':   return bool(BAYERN_KEEP.search(title))
    if cat == 'SPL':      return bool(SPL_KEEP.search(title))
    if cat == 'KSA':      return bool(KSA_KEEP.search(title)) and not bool(KSA_JUNK.search(title))
    return True

items = []
for ch in CHANNELS:
    try:
        req = urllib.request.Request(ch['url'], headers={'User-Agent':'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=10) as r:
            root = ET.fromstring(r.read())
        channel = root.find('channel') or root
        count = 0
        for item in channel.findall('item'):
            if count >= 6: break
            title = item.findtext('title','').strip()
            link  = item.findtext('link','').strip()
            pub   = item.findtext('pubDate','').strip()
            
            if not title: continue
            if not is_high_impact(title, ch['cat'], ch.get('filter')): continue
            
            try:    date_str = parsedate_to_datetime(pub).strftime('%b %-d')
            except: date_str = datetime.now(timezone.utc).strftime('%b %-d')
            
            # Clean up apostrophes to prevent breaking JavaScript syntax
            title_clean = title.replace("'", "\\'")
            
            items.append({
                'title': title_clean,
                'src':   ch['src'],
                'cat':   ch['cat'],
                'link':  link.replace("'", "%27"),
                'date':  date_str
            })
            count += 1
        print(f"OK {ch['src']}: {count} items")
    except Exception as e:
        print(f"SKIP {ch['src']}: {e}")

if not items:
    print("No valid news items fetched across all channels — skipping update to preserve existing feed.")
    sys.exit(0)

# Format the data exactly as your frontend JS file expects
lines = []
for item in items:
    lines.append(
        "  {{title:'{title}',src:'{src}',cat:'{cat}',link:'{link}',date:'{date}'}}".format(**item)
    )

new_block = "var FALLBACK_NEWS = [\n" + ",\n".join(lines) + "\n];"

file_path = 'js/feed.js'
os.makedirs(os.path.dirname(file_path), exist_ok=True)

# Read existing content if it exists
content = ""
if os.path.exists(file_path):
    with open(file_path, 'r') as f:
        content = f.read()

# Replace the specific block if markers exist
if '// DO NOT EDIT BELOW THIS LINE' in content and '// DO NOT EDIT ABOVE THIS LINE' in content:
    updated = re.sub(
        r'// DO NOT EDIT BELOW THIS LINE\nvar FALLBACK_NEWS = \[.*?\];\n// DO NOT EDIT ABOVE THIS LINE',
        '// DO NOT EDIT BELOW THIS LINE\n' + new_block + '\n// DO NOT EDIT ABOVE THIS LINE',
        content,
        flags=re.DOTALL
    )
    
    # Fallback if the strict regex above failed due to spacing/formatting issues
    if updated == content:
        updated = re.sub(
            r'// DO NOT EDIT BELOW THIS LINE.*?// DO NOT EDIT ABOVE THIS LINE',
            '// DO NOT EDIT BELOW THIS LINE\n' + new_block + '\n// DO NOT EDIT ABOVE THIS LINE',
            content,
            flags=re.DOTALL
        )
else:
    # If file doesn't exist or lost its markers, reconstruct it safely
    updated = f"// DO NOT EDIT BELOW THIS LINE\n{new_block}\n// DO NOT EDIT ABOVE THIS LINE\n"

with open(file_path, 'w') as f:
    f.write(updated)

print(f"Done: {len(items)} high-impact stories successfully written to {file_path}")