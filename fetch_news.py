import urllib.request
import xml.etree.ElementTree as ET
import re
import sys
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime

CHANNELS = [
    # F1
    {'url':'https://feeds.bbci.co.uk/sport/formula1/rss.xml','src':'BBC F1','cat':'F1'},
    {'url':'https://www.skysports.com/rss/12040','src':'Sky F1','cat':'F1'},
    {'url':'https://www.autosport.com/rss/f1/news/','src':'Autosport','cat':'F1'},
    {'url':'https://www.racefans.net/feed/','src':'RaceFans','cat':'F1'},

    # Football
    {'url':'https://feeds.bbci.co.uk/sport/football/rss.xml','src':'BBC Sport','cat':'FOOTBALL'},
    {'url':'https://www.espn.com/espn/rss/soccer/news','src':'ESPN FC','cat':'FOOTBALL'},

    # Bayern
    {'url':'https://www.bavarianfootballworks.com/rss/current.xml','src':'Bayern','cat':'BAYERN'},

    # Saudi
    {'url':'https://www.spa.gov.sa/rss/rss.php?l=en','src':'SPA','cat':'KSA'},
    {'url':'https://www.argaam.com/en/rss','src':'Argaam','cat':'KSA'}
]

HIGH_VALUE = {
    'F1': [
        (r'penalty|fia|disqualif|crash|dnf|retire', 10),
        (r'contract|sign|replace|seat|driver swap', 8),
        (r'pole|winner|championship|title', 7),
        (r'investigation|stewards|ruling', 9),
    ],

    'FOOTBALL': [
        (r'sacked|manager|appointed', 10),
        (r'transfer|sign|bid|contract', 9),
        (r'injury|out for|ruled out', 8),
        (r'title|champion|relegation', 8),
        (r'final|semi-final', 7),
    ],

    'BAYERN': [
        (r'transfer|sign|contract', 10),
        (r'injury|absence', 8),
        (r'official|announce', 7),
    ],

    'KSA': [
        (r'pif|vision 2030|neom|regulation', 10),
        (r'investment|economic|ipo|billion', 8),
        (r'ministry|royal decree', 9),
    ]
}

TRASH = re.compile(
    r'live blog|how to watch|watch live|predicted lineup|quiz|power ranking|player ratings|opinion|preview|rumours roundup',
    re.I
)

def score_title(title, cat):
    if TRASH.search(title):
        return -100

    score = 0
    for pattern, points in HIGH_VALUE.get(cat, []):
        if re.search(pattern, title, re.I):
            score += points

    if len(title.split()) > 18:
        score -= 2

    return score

items = []

for ch in CHANNELS:
    try:
        req = urllib.request.Request(ch['url'], headers={'User-Agent':'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=10) as r:
            root = ET.fromstring(r.read())

        channel = root.find('channel') or root
        candidates = []

        for item in channel.findall('item'):
            title = item.findtext('title','').strip()
            link = item.findtext('link','').strip()
            pub = item.findtext('pubDate','').strip()

            if not title:
                continue

            score = score_title(title, ch['cat'])
            if score < 6:
                continue

            try:
                dt = parsedate_to_datetime(pub)
                date_str = dt.strftime('%b %-d')
                freshness = (datetime.now(timezone.utc) - dt.astimezone(timezone.utc)).total_seconds()
            except:
                date_str = datetime.now().strftime('%b %-d')
                freshness = 999999

            candidates.append({
                'title': title.replace("'", "-"),
                'src': ch['src'],
                'cat': ch['cat'],
                'link': link.replace("'", "%27"),
                'date': date_str,
                'score': score,
                'freshness': freshness
            })

        candidates.sort(key=lambda x: (-x['score'], x['freshness']))
        items.extend(candidates[:5])

        print(f"OK {ch['src']}")

    except Exception as e:
        print(f"SKIP {ch['src']}: {e}")

if not items:
    print("No quality stories.")
    sys.exit(0)

items.sort(key=lambda x: (-x['score'], x['freshness']))

lines = [
    "  {{title:'{title}',src:'{src}',cat:'{cat}',link:'{link}',date:'{date}'}}".format(**item)
    for item in items[:30]
]

new_block = "var FALLBACK_NEWS = [\n" + ",\n".join(lines) + "\n];"

file_path = 'js/feed.js'

with open(file_path, 'r') as f:
    content = f.read()

start_marker = '// DO NOT EDIT BELOW THIS LINE'
end_marker = '// DO NOT EDIT ABOVE THIS LINE'

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx == -1 or end_idx == -1:
    print("Markers missing")
    sys.exit(1)

updated = (
    content[:start_idx + len(start_marker)]
    + '\n'
    + new_block
    + '\n'
    + content[end_idx:]
)

with open(file_path, 'w') as f:
    f.write(updated)

print(f"Injected {len(items[:30])} high-quality stories.")