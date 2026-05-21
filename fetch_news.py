import urllib.request, xml.etree.ElementTree as ET, re, sys, json, time
from datetime import datetime, timezone, timedelta
from email.utils import parsedate_to_datetime
import urllib.request as urlreq

MAX_AGE = timedelta(days=2)
NOW     = datetime.now(timezone.utc)

SOURCES = [
  # ── F1 ──────────────────────────────────────────────────
  {'url':'https://www.formula1.com/en/latest/all.xml',                   'cat':'F1'},
  {'url':'https://feeds.bbci.co.uk/sport/formula1/rss.xml',             'cat':'F1'},
  {'url':'https://www.autosport.com/rss/f1/news/',                       'cat':'F1'},
  {'url':'https://www.gptoday.net/rss/news/rss.xml',                     'cat':'F1'},
  {'url':'https://racer.com/category/formula-1/feed/',                   'cat':'F1'},
  {'url':'https://www.motorsport.com/rss/f1/news/',                      'cat':'F1'},
  {'url':'https://www.crash.net/rss/f1',                                 'cat':'F1'},
  {'url':'https://www.racefans.net/feed/',                               'cat':'F1'},
  {'url':'https://www.skysports.com/rss/12433',                          'cat':'F1'},
  {'url':'https://www.espn.com/espn/rss/f1/news',                        'cat':'F1'},
  {'url':'https://www.motorsportweek.com/feed/',                         'cat':'F1'},
  {'url':'https://www.motorsportmagazine.com/feed/',                     'cat':'F1'},
  {'url':'https://www.autosport.com/rss/f1/news/',                       'cat':'F1'},

  # ── FOOTBALL ────────────────────────────────────────────
  {'url':'https://feeds.bbci.co.uk/sport/football/rss.xml',             'cat':'FOOTBALL'},
  {'url':'https://www.theguardian.com/football/premierleague/rss',      'cat':'FOOTBALL'},
  {'url':'https://www.theguardian.com/football/laliga/rss',             'cat':'FOOTBALL'},
  {'url':'https://www.theguardian.com/football/serieafootball/rss',     'cat':'FOOTBALL'},
  {'url':'https://www.theguardian.com/football/bundesligafootball/rss', 'cat':'FOOTBALL'},
  {'url':'https://www.theguardian.com/football/ligue1football/rss',     'cat':'FOOTBALL'},
  {'url':'https://www.skysports.com/rss/11095',                         'cat':'FOOTBALL'},
  {'url':'https://www.espn.com/espn/rss/soccer/news',                   'cat':'FOOTBALL'},
  {'url':'https://talksport.com/feed/',                                  'cat':'FOOTBALL'},
  {'url':'https://www.fourfourtwo.com/rss',                             'cat':'FOOTBALL'},
  {'url':'https://www.mirror.co.uk/sport/football/rss.xml',             'cat':'FOOTBALL'},
  {'url':'https://www.independent.co.uk/sport/football/rss',            'cat':'FOOTBALL'},
  {'url':'https://www.standard.co.uk/sport/football/rss',               'cat':'FOOTBALL'},
  {'url':'https://www.cbssports.com/rss/headlines/soccer/',             'cat':'FOOTBALL'},
  {'url':'https://www.transfermarkt.co.uk/rss/news',                    'cat':'FOOTBALL'},
  {'url':'https://www.marca.com/en/rss/football.xml',                   'cat':'FOOTBALL'},
  {'url':'https://www.90min.com/posts.rss',                             'cat':'FOOTBALL'},
  {'url':'https://www.sportsmole.co.uk/football/rss.xml',               'cat':'FOOTBALL'},
  {'url':'https://www.givemesport.com/rss/football',                    'cat':'FOOTBALL'},
  {'url':'https://www.eurosport.com/football/rss.xml',                  'cat':'FOOTBALL'},

  # ── BAYERN ──────────────────────────────────────────────
  {'url':'https://www.sportsmole.co.uk/football/bayern-munich/rss.xml', 'cat':'BAYERN'},
  {'url':'https://www.bundesliga.com/rss/en/rss-news.rss',              'cat':'BAYERN'},
  {'url':'https://www.skysports.com/rss/11095',                         'cat':'BAYERN'},
  {'url':'https://www.espn.com/espn/rss/soccer/news',                   'cat':'BAYERN'},
  {'url':'https://www.transfermarkt.co.uk/rss/news',                    'cat':'BAYERN'},
  {'url':'https://www.theguardian.com/football/bundesligafootball/rss', 'cat':'BAYERN'},
  {'url':'https://www.mirror.co.uk/sport/football/rss.xml',             'cat':'BAYERN'},
  {'url':'https://www.independent.co.uk/sport/football/rss',            'cat':'BAYERN'},
  {'url':'https://www.givemesport.com/rss/football',                    'cat':'BAYERN'},
  {'url':'https://www.eurosport.com/football/rss.xml',                  'cat':'BAYERN'},

  # ── SAUDI FOOTBALL (SPL) ────────────────────────────────
  {'url':'https://www.arabnews.com/cat/5/rss.xml',                      'cat':'SPL'},
  {'url':'https://saudigazette.com.sa/rssFeed/74',                      'cat':'SPL'},
  {'url':'https://www.espn.com/espn/rss/soccer/news',                   'cat':'SPL'},
  {'url':'https://www.skysports.com/rss/11095',                         'cat':'SPL'},
  {'url':'https://www.transfermarkt.co.uk/rss/news',                    'cat':'SPL'},
  {'url':'https://www.mirror.co.uk/sport/football/rss.xml',             'cat':'SPL'},
  {'url':'https://www.independent.co.uk/sport/football/rss',            'cat':'SPL'},
  {'url':'https://www.middleeasteye.net/rss',                           'cat':'SPL'},
  {'url':'https://www.givemesport.com/rss/football',                    'cat':'SPL'},

  # ── SAUDI NEWS (KSA) ────────────────────────────────────
  {'url':'https://www.arabnews.com/rss.xml',                            'cat':'KSA'},
  {'url':'https://www.arabnews.com/economy/rss.xml',                    'cat':'KSA'},
  {'url':'https://saudigazette.com.sa/rssFeed/74',                      'cat':'KSA'},
  {'url':'https://en.majalla.com/rss.xml',                              'cat':'KSA'},
  {'url':'https://feeds.bbci.co.uk/news/world/middle_east/rss.xml',     'cat':'KSA'},
  {'url':'https://www.middleeasteye.net/rss',                           'cat':'KSA'},
  {'url':'https://www.euronews.com/rss?format=mrss&level=theme&name=news','cat':'KSA'},
]

def fetch_all():
    all_items = []
    seen_titles = set()
    for src in SOURCES:
        try:
            req = urlreq.Request(src['url'], headers={'User-Agent':'Mozilla/5.0'})
            with urlreq.urlopen(req, timeout=10) as r:
                root = ET.fromstring(r.read())
            node = root.find('channel')
            if node is None: node = root
            count = 0
            for item in node.findall('item'):
                if count >= 15: break
                title = item.findtext('title','').strip()
                link  = item.findtext('link','').strip()
                pub   = item.findtext('pubDate','').strip()
                if not title or not link: continue
                title_key = re.sub(r'\W+','',title.lower())[:50]
                if title_key in seen_titles: continue
                seen_titles.add(title_key)
                try:
                    dt = parsedate_to_datetime(pub)
                    if dt.tzinfo is None:
                        dt = dt.replace(tzinfo=timezone.utc)
                    if (NOW - dt) > MAX_AGE: continue
                    date_str = dt.strftime('%b %-d')
                except:
                    date_str = NOW.strftime('%b %-d')
                all_items.append({
                    'title': title,
                    'link':  link,
                    'cat':   src['cat'],
                    'date':  date_str,
                })
                count += 1
            print("OK " + src['url'].split('/')[2] + ": " + str(count))
        except Exception as e:
            print("SKIP " + src['url'].split('/')[2] + ": " + str(e))
    return all_items

def curate_with_claude(items):
    import os
    api_key = os.environ.get('ANTHROPIC_API_KEY','')
    if not api_key:
        print("No API key found")
        sys.exit(1)

    headlines = []
    for i, item in enumerate(items):
        headlines.append(str(i) + "|" + item['cat'] + "|" + item['title'])

    prompt = """You are a ruthless breaking news editor for a sports and news app. Your standard is extremely high.

Only pick headlines that are CONFIRMED, IMMEDIATE, and DRAMATIC.

Examples of what you WANT:
- Harry Kane is injured and out for the rest of the season
- Max Verstappen sent to the back of the grid due to penalty
- Lando Norris will not feature in Monaco Grand Prix due to broken hand
- Arsenal one win away from sealing the Premier League title
- McLaren sack their chief of staff after 22 years
- Saudi Grand Prix cancelled for 2026
- Southampton expelled from Championship play-offs over Spygate
- Germany call up retired Neuer aged 40 for World Cup squad
- Al Nassr win Saudi Pro League title
- Bayern Munich sack manager after Champions League exit

Examples of what you REJECT:
- Red Bull outlines timeline for new wind tunnel
- How ICE upgrades could shake up F1 power rankings
- Any headline with: could, might, reportedly, sources say, how, why, ranking, podcast, preview, analysis, opinion, history, timeline, outlines, discusses, five things, rated, ranked, best, worst, watch, transfer rumour, linked

CRITICAL DEDUPLICATION RULE:
If multiple headlines cover the same story or event, pick ONLY ONE — the clearest and most informative version.

Rules:
- Must be a CONFIRMED fact not speculation
- Must have IMMEDIATE impact on something happening now
- Must be DRAMATIC — injury, sacking, ban, cancellation, title won/lost, transfer confirmed, expulsion, crash, penalty, suspension
- FOOTBALL stories must be about top 5 leagues: Premier League, La Liga, Serie A, Bundesliga, Ligue 1, or Champions League
- BAYERN stories must specifically mention FC Bayern Munich, their players (Kane, Musiala, Olise, Neuer, Kimmich, Davies, Kompany, Goretzka, Laimer) or manager by name
- SPL stories must specifically mention Saudi Pro League teams or players: Al Hilal, Al Nassr, Al Ittihad, Al Ahli, Ronaldo, Benzema, Mane, Neymar, or Saudi Pro League
- KSA stories must be major Saudi economic or policy news: Vision 2030, PIF investments, royal decrees, billion dollar deals, NEOM, Aramco. NOT sport, NOT Hajj, NOT ceremonies, NOT tourism

Return ONLY a valid JSON array with no extra text. Each item: {"idx": number, "cat": "category"}
Pick maximum 6 per category. No duplicate topics. If nothing qualifies for a category return nothing for that category.

Headlines (format: index|category|title):
""" + "\n".join(headlines)

    payload = json.dumps({
        "model": "claude-haiku-4-5-20251001",
        "max_tokens": 1500,
        "messages": [{"role": "user", "content": prompt}]
    }).encode()

    req = urlreq.Request(
        'https://api.anthropic.com/v1/messages',
        data=payload,
        headers={
            'Content-Type': 'application/json',
            'x-api-key': api_key,
            'anthropic-version': '2023-06-01'
        }
    )

    with urlreq.urlopen(req, timeout=30) as r:
        response = json.loads(r.read())

    text = response['content'][0]['text']
    json_match = re.search(r'\[.*\]', text, re.DOTALL)
    if not json_match:
        print("Claude returned no valid JSON")
        return []

    return json.loads(json_match.group())

def js_str(text):
    text = text.replace('&amp;', '&')
    text = text.replace('&quot;', '"')
    text = text.replace('&#039;', "'")
    text = text.replace('&lt;', '<')
    text = text.replace('&gt;', '>')
    text = text.encode('ascii', 'ignore').decode('ascii')
    text = text.replace('\\', '')
    text = text.replace("'", "\\'")
    text = text.replace('\n', ' ')
    text = text.replace('\r', ' ')
    text = re.sub(r'  +', ' ', text).strip()
    return text

print("Fetching headlines...")
all_items = fetch_all()
print("Total raw headlines: " + str(len(all_items)))

print("Asking Claude to curate...")
try:
    selected = curate_with_claude(all_items)
    print("Claude selected: " + str(len(selected)) + " stories")
except Exception as e:
    print("Claude curation failed: " + str(e))
    sys.exit(1)

final_items = []
for s in selected:
    try:
        idx = int(s['idx'])
        item = all_items[idx]
        final_items.append({
            'title': js_str(item['title']),
            'src':   js_str(item['link'].split('/')[2].replace('www.','')),
            'cat':   item['cat'],
            'link':  js_str(item['link']),
            'date':  item['date'],
        })
    except:
        continue

if not final_items:
    print("No items selected - skipping")
    sys.exit(0)

lines = []
for i in final_items:
    lines.append("  {title:'%s',src:'%s',cat:'%s',link:'%s',date:'%s'}" % (
        i['title'], i['src'], i['cat'], i['link'], i['date']))

new_block = "var FALLBACK_NEWS = [\n" + ",\n".join(lines) + "\n];"

with open('js/feed.js', 'r') as f:
    content = f.read()

updated = re.sub(
    r'// DO NOT EDIT BELOW THIS LINE\nvar FALLBACK_NEWS = \[.*?\];\n// DO NOT EDIT ABOVE THIS LINE',
    '// DO NOT EDIT BELOW THIS LINE\n' + new_block + '\n// DO NOT EDIT ABOVE THIS LINE',
    content, flags=re.DOTALL
)

if updated == content:
    print("Marker not found - skipping")
    sys.exit(0)

with open('js/feed.js', 'w') as f:
    f.write(updated)

version = str(int(time.time()))
with open('index.html', 'r') as f:
    html = f.read()
html = re.sub(r'js/feed\.js(\?v=[0-9]+)?', 'js/feed.js?v=' + version, html)
with open('index.html', 'w') as f:
    f.write(html)

print("Done: " + str(len(final_items)) + " stories written to js/feed.js")
