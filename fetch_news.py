import urllib.request, xml.etree.ElementTree as ET, re, sys, json, time
from datetime import datetime, timezone, timedelta
from email.utils import parsedate_to_datetime
import urllib.request as urlreq

MAX_AGE = timedelta(days=2)
NOW     = datetime.now(timezone.utc)

# ── RAW SOURCES ─────────────────────────────────────────
SOURCES = [
  # F1
  {'url':'https://feeds.bbci.co.uk/sport/formula1/rss.xml',             'cat':'F1'},
  {'url':'https://www.autosport.com/rss/f1/news/',                       'cat':'F1'},
  {'url':'https://www.gptoday.net/rss/news/rss.xml',                     'cat':'F1'},
  {'url':'https://racer.com/category/formula-1/feed/',                   'cat':'F1'},
  # Football
  {'url':'https://feeds.bbci.co.uk/sport/football/rss.xml',             'cat':'FOOTBALL'},
  {'url':'https://www.theguardian.com/football/premierleague/rss',      'cat':'FOOTBALL'},
  {'url':'https://www.theguardian.com/football/serieafootball/rss',     'cat':'FOOTBALL'},
  {'url':'https://www.theguardian.com/football/bundesligafootball/rss', 'cat':'FOOTBALL'},
  {'url':'https://www.theguardian.com/football/ligue1football/rss',     'cat':'FOOTBALL'},
  {'url':'https://www.skysports.com/rss/11095',                         'cat':'FOOTBALL'},
  {'url':'https://www.caughtoffside.com/feed/',                         'cat':'FOOTBALL'},
  # Bayern
  {'url':'https://www.sportsmole.co.uk/football/bayern-munich/rss.xml', 'cat':'BAYERN'},
  {'url':'https://www.theguardian.com/football/bundesligafootball/rss', 'cat':'BAYERN'},
  {'url':'https://feeds.bbci.co.uk/sport/football/rss.xml',             'cat':'BAYERN'},
  # Saudi Football
  {'url':'https://saudigazette.com.sa/rssFeed/74',                      'cat':'SPL'},
  {'url':'https://www.arabnews.com/cat/5/rss.xml',                      'cat':'SPL'},
  # Saudi News
  {'url':'https://www.arabnews.com/rss.xml',                            'cat':'KSA'},
  {'url':'https://saudigazette.com.sa/rssFeed/74',                      'cat':'KSA'},
  {'url':'https://en.majalla.com/rss.xml',                              'cat':'KSA'},
]

# ── FETCH ALL RAW HEADLINES ──────────────────────────────
def fetch_all():
    all_items = []
    for src in SOURCES:
        try:
            req = urlreq.Request(src['url'], headers={'User-Agent':'Mozilla/5.0'})
            with urlreq.urlopen(req, timeout=10) as r:
                root = ET.fromstring(r.read())
            node = root.find('channel') or root
            count = 0
            for item in node.findall('item'):
                if count >= 15: break
                title = item.findtext('title','').strip()
                link  = item.findtext('link','').strip()
                pub   = item.findtext('pubDate','').strip()
                if not title or not link: continue
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

# ── ASK CLAUDE TO CURATE ─────────────────────────────────
def curate_with_claude(items):
    import os
    api_key = os.environ.get('ANTHROPIC_API_KEY','')
    if not api_key:
        print("No API key found")
        sys.exit(1)

    # Build the headlines list for Claude
    headlines = []
    for i, item in enumerate(items):
        headlines.append(f"{i}|{item['cat']}|{item['title']}")

    prompt = """You are a news editor for a sports and news app. I will give you a list of headlines.

Your job: pick only the GENUINELY BREAKING and HIGH-IMPACT headlines for each category.

Categories and what counts as breaking:
- F1: race results, pole position, crashes, DNF, penalties, driver transfers, FIA rulings, contract news. NOT: previews, opinions, Q&A, historical pieces, practice sessions
- FOOTBALL: manager sackings, confirmed transfers, match results from top 5 leagues (PL/LaLiga/SerieA/Bundesliga/Ligue1), title wins, relegation, red cards, major injuries. NOT: podcasts, rankings, predictions, GCSEs, fantasy football, trivia
- BAYERN: anything specifically about FC Bayern Munich - transfers, injuries, results, manager news. MUST be about Bayern specifically, not just any football story
- SPL: Saudi Pro League specific news - Al Hilal, Al Nassr, Al Ittihad, Al Ahli, transfers, results, managers. NOT general Saudi news
- KSA: Major Saudi economic/policy news - Vision 2030, PIF investments, royal decrees, billion dollar deals, major infrastructure. NOT: Hajj guides, pavilions, local ceremonies, sports

Return ONLY a JSON array. Each item: {"idx": number, "cat": "category"}
Pick maximum 8 per category. Only genuinely newsworthy stories.

Headlines (format: index|category|title):
""" + "\n".join(headlines)

    payload = json.dumps({
        "model": "claude-haiku-4-5-20251001",
        "max_tokens": 1000,
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
    # Extract JSON from response
    json_match = re.search(r'\[.*\]', text, re.DOTALL)
    if not json_match:
        print("Claude returned no valid JSON")
        sys.exit(1)

    selected = json.loads(json_match.group())
    return selected

# ── SANITIZE ─────────────────────────────────────────────
def sanitize(text):
    text = text.replace("&#039;", "-").replace("&amp;", "and")
    text = text.replace("&quot;", "-").replace("&lt;", "-").replace("&gt;", "-")
    result = ""
    for c in text:
        if ord(c) > 127: result += "-"
        elif c in ("'", '"', "\\", "\n", "\r"): result += "-"
        else: result += c
    return result

# ── MAIN ─────────────────────────────────────────────────
print("Fetching headlines...")
all_items = fetch_all()
print(f"Total raw headlines: {len(all_items)}")

print("Asking Claude to curate...")
try:
    selected = curate_with_claude(all_items)
    print(f"Claude selected: {len(selected)} stories")
except Exception as e:
    print("Claude curation failed: " + str(e))
    sys.exit(1)

# Build final list from Claude's selections
final_items = []
for s in selected:
    try:
        idx = int(s['idx'])
        item = all_items[idx]
        final_items.append({
            'title': sanitize(item['title']),
            'src':   sanitize(item['link'].split('/')[2].replace('www.','')),
            'cat':   item['cat'],
            'link':  sanitize(item['link']),
            'date':  item['date'],
        })
    except:
        continue

if not final_items:
    print("No items selected - skipping")
    sys.exit(0)

# Write to feed.js
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

# Cache bust
version = str(int(time.time()))
with open('index.html', 'r') as f:
    html = f.read()
html = re.sub(r'js/feed\.js(\?v=[0-9]+)?', 'js/feed.js?v=' + version, html)
with open('index.html', 'w') as f:
    f.write(html)

print("Done: " + str(len(final_items)) + " stories written to js/feed.js")
