import urllib.request
import xml.etree.ElementTree as ET
import re
import json
import sys
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime

# Configuration: Your specific channels
CHANNELS = [
    {'url':'https://feeds.bbci.co.uk/sport/formula1/rss.xml', 'src':'BBC F1', 'cat':'F1'},
    {'url':'https://www.skysports.com/rss/12040', 'src':'Sky F1', 'cat':'F1'},
    {'url':'https://www.autosport.com/rss/f1/news/', 'src':'Autosport', 'cat':'F1'},
    {'url':'https://www.racefans.net/feed/', 'src':'RaceFans', 'cat':'F1'},
    {'url':'https://the-race.com/feed/', 'src':'The Race', 'cat':'F1'},
    {'url':'https://feeds.bbci.co.uk/sport/football/rss.xml', 'src':'BBC Sport', 'cat':'FOOTBALL'},
    {'url':'https://www.skysports.com/rss/11095', 'src':'Sky Sports', 'cat':'FOOTBALL'},
    {'url':'https://www.theguardian.com/football/premierleague/rss', 'src':'Guardian PL', 'cat':'FOOTBALL'},
    {'url':'https://www.theguardian.com/football/laliga/rss', 'src':'Guardian LaLiga', 'cat':'FOOTBALL'},
    {'url':'https://www.theguardian.com/football/serieafootball/rss', 'src':'Guardian Serie A', 'cat':'FOOTBALL'},
    {'url':'https://www.theguardian.com/football/bundesligafootball/rss', 'src':'Guardian Bund', 'cat':'FOOTBALL'},
    {'url':'https://www.theguardian.com/football/ligue1football/rss', 'src':'Guardian L1', 'cat':'FOOTBALL'},
    {'url':'https://www.espn.com/espn/rss/soccer/news', 'src':'ESPN FC', 'cat':'FOOTBALL'},
    {'url':'https://feeds.bbci.co.uk/sport/football/rss.xml', 'src':'Bayern - BBC', 'cat':'BAYERN', 'filter':'Bayern'},
    {'url':'https://www.theguardian.com/football/bundesligafootball/rss', 'src':'Bayern - Guard', 'cat':'BAYERN', 'filter':'Bayern'},
    {'url':'https://www.arabnews.com/cat/5/rss.xml', 'src':'Arab News Sport', 'cat':'SPL'},
    {'url':'https://saudigazette.com.sa/feed', 'src':'Saudi Gazette', 'cat':'SPL'},
    {'url':'https://www.spa.gov.sa/rss/rss.php?l=en', 'src':'Saudi Press', 'cat':'KSA'},
    {'url':'https://www.arabnews.com/rss.xml', 'src':'Arab News', 'cat':'KSA'},
    {'url':'https://www.argaam.com/en/rss', 'src':'Argaam', 'cat':'KSA'},
]

# Regex Patterns
F1_KEEP = re.compile(r'win|winner|pole|penalt|crash|dnf|retire|disqualif|contract|sign|swap|transfer|ruling|fia|champion|ban|incident|investigat|fastest lap', re.I)
FOOTBALL_KEEP = re.compile(r'sack|fired|resign|transfer|sign|injur|suspend|ban|red card|title|champion|relegat|derb|result|win|loss|defeat|final|semifinal|playoff', re.I)
FOOTBALL_JUNK = re.compile(r'fantasy|predicted lineup|five things|player ratings|watch live|how to watch|betting odds|quiz|power ranking', re.I)
BAYERN_KEEP = re.compile(r'transfer|sign|injur|absent|lineup|squad|contract|sack|manag|coach|champion|ban|suspend|ruling|official|announce', re.I)
SPL_KEEP = re.compile(r'transfer|sign|sack|manag|title|champion|relegat|derb|disciplin|ban|suspend|ruling|contract|result|win|ronaldo|neymar|benzema|mane', re.I)
KSA_KEEP = re.compile(r'decree|royal|minister|giga|neom|vision 2030|pif|invest|regulat|reform|gdp|economic|infrastructure|launch|announce|billion|sovereign|market|ipo', re.I)
KSA_JUNK = re.compile(r'ceremony|ribbon|visit|tour|festival|fashion|celebrat|inaugurat|honorary', re.I)

def is_high_impact(title, cat, filt=None):
    if filt and filt.lower() not in title.lower(): return False
    if cat == 'F1': return bool(F1_KEEP.search(title))
    if cat == 'FOOTBALL': return bool(FOOTBALL_KEEP.search(title)) and not bool(FOOTBALL_JUNK.search(title))
    if cat == 'BAYERN': return bool(BAYERN_KEEP.search(title))
    if cat == 'SPL': return bool(SPL_KEEP.search(title))
    if cat == 'KSA': return bool(KSA_KEEP.search(title)) and not bool(KSA_JUNK.search(title))
    return True

def run_update():
    final_data = []
    for ch in CHANNELS:
        try:
            req = urllib.request.Request(ch['url'], headers={'User-Agent':'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=10) as r:
                root = ET.fromstring(r.read())
            
            channel = root.find('channel') or root
            items_added = 0
            for item in channel.findall('item'):
                if items_added >= 6: break
                title = item.findtext('title','').strip()
                if not title or not is_high_impact(title, ch['cat'], ch.get('filter')):
                    continue
                
                final_data.append({
                    'title': title.replace("'", "-"),
                    'src': ch['src'],
                    'cat': ch['cat'],
                    'link': item.findtext('link','').strip(),
                    'date': datetime.now(timezone.utc).strftime('%b %-d')
                })
                items_added += 1
        except Exception as e:
            print(f"Skipping {ch['src']}: {e}")

    # Circuit Breaker: Only write if we have data
    if not final_data:
        print("Update failed: No valid items found. Keeping old file.")
        sys.exit(1)

    # Write as clean JSON
    with open('js/feed_data.json', 'w') as f:
        json.dump(final_data, f, indent=2)
    print(f"Success: {len(final_data)} items saved.")

if __name__ == "__main__":
    run_update()