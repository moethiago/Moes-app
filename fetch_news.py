import urllib.request
import xml.etree.ElementTree as ET
import re
from email.utils import parsedate_to_datetime
from datetime import datetime, timezone

CHANNELS = [
    {'url':'https://feeds.bbci.co.uk/sport/formula1/rss.xml','src':'BBC F1','cat':'F1'},
    {'url':'https://www.autosport.com/rss/f1/news/','src':'Autosport','cat':'F1'},
    {'url':'https://feeds.bbci.co.uk/sport/football/rss.xml','src':'BBC Football','cat':'FOOTBALL'},
    {'url':'https://www.espn.com/espn/rss/soccer/news','src':'ESPN FC','cat':'FOOTBALL'},
    {'url':'https://www.argaam.com/en/rss','src':'Argaam','cat':'KSA'}
]

GOOD = re.compile(
    r'penalty|fia|disqualified|crash|transfer|signed|sacked|injury|contract|title|champion|royal decree|pif|vision 2030|investment',
    re.I
)

BAD = re.compile(
    r'how to watch|preview|live blog|predicted lineup|quiz|opinion|ratings|rumours',
    re.I
)

items = []

for ch in CHANNELS:
    try:
        req = urllib.request.Request(ch['url'], headers={'User-Agent':'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=10) as r:
            root = ET.fromstring(r.read())

        channel = root.find('channel') or root

        for item in channel.findall('item'):
            title = item.findtext('title','').strip()

            if not title:
                continue

            if BAD.search(title):
                continue

            if not GOOD.search(title):
                continue

            print("PASS:", title)

            items.append(title)

    except Exception as e:
        print("FAIL:", ch['src'], e)

print(f"\nTOTAL GOOD STORIES: {len(items)}")