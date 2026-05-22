import urllib.request, xml.etree.ElementTree as ET, re, sys, json, time
from datetime import datetime, timezone, timedelta
from email.utils import parsedate_to_datetime
import urllib.request as urlreq

MAX_AGE = timedelta(hours=48)
NOW     = datetime.now(timezone.utc)

RSS_SOURCES = [
  {'url':'https://www.formula1.com/en/latest/all.xml',                                'cat':'F1'},
  {'url':'https://feeds.bbci.co.uk/sport/formula1/rss.xml',                          'cat':'F1'},
  {'url':'https://www.autosport.com/rss/f1/news/',                                    'cat':'F1'},
  {'url':'https://www.gptoday.net/rss/news/rss.xml',                                  'cat':'F1'},
  {'url':'https://racer.com/category/formula-1/feed/',                                'cat':'F1'},
  {'url':'https://www.motorsport.com/rss/f1/news/',                                   'cat':'F1'},
  {'url':'https://www.crash.net/rss/f1',                                              'cat':'F1'},
  {'url':'https://www.racefans.net/feed/',                                            'cat':'F1'},
  {'url':'https://www.skysports.com/rss/12433',                                       'cat':'F1'},
  {'url':'https://www.motorsportweek.com/feed/',                                      'cat':'F1'},
  {'url':'https://www.reddit.com/r/formula1/top/.rss?sort=top&t=day&limit=10',        'cat':'F1'},
  {'url':'https://feeds.bbci.co.uk/sport/football/rss.xml',                          'cat':'FOOTBALL'},
  {'url':'https://www.theguardian.com/football/premierleague/rss',                   'cat':'FOOTBALL'},
  {'url':'https://www.theguardian.com/football/laliga/rss',                          'cat':'FOOTBALL'},
  {'url':'https://www.theguardian.com/football/serieafootball/rss',                  'cat':'FOOTBALL'},
  {'url':'https://www.theguardian.com/football/bundesligafootball/rss',              'cat':'FOOTBALL'},
  {'url':'https://www.theguardian.com/football/ligue1football/rss',                  'cat':'FOOTBALL'},
  {'url':'https://www.skysports.com/rss/11095',                                      'cat':'FOOTBALL'},
  {'url':'https://talksport.com/feed/',                                               'cat':'FOOTBALL'},
  {'url':'https://www.fourfourtwo.com/rss',                                          'cat':'FOOTBALL'},
  {'url':'https://www.mirror.co.uk/sport/football/rss.xml',                          'cat':'FOOTBALL'},
  {'url':'https://www.independent.co.uk/sport/football/rss',                         'cat':'FOOTBALL'},
  {'url':'https://www.standard.co.uk/sport/football/rss',                            'cat':'FOOTBALL'},
  {'url':'https://www.cbssports.com/rss/headlines/soccer/',                          'cat':'FOOTBALL'},
  {'url':'https://www.transfermarkt.co.uk/rss/news',                                 'cat':'FOOTBALL'},
  {'url':'https://www.marca.com/en/rss/football.xml',                                'cat':'FOOTBALL'},
  {'url':'https://www.sportsmole.co.uk/football/rss.xml',                            'cat':'FOOTBALL'},
  {'url':'https://www.reddit.com/r/soccer/top/.rss?sort=top&t=day&limit=10',         'cat':'FOOTBALL'},
  {'url':'https://www.sportsmole.co.uk/football/bayern-munich/rss.xml',              'cat':'BAYERN'},
  {'url':'https://www.bundesliga.com/rss/en/rss-news.rss',                           'cat':'BAYERN'},
  {'url':'https://www.transfermarkt.co.uk/rss/news',                                 'cat':'BAYERN'},
  {'url':'https://www.theguardian.com/football/bundesligafootball/rss',              'cat':'BAYERN'},
  {'url':'https://www.reddit.com/r/bayernmunich/top/.rss?sort=top&t=day&limit=10',   'cat':'BAYERN'},
  {'url':'https://www.arabnews.com/cat/5/rss.xml',                                   'cat':'SPL'},
  {'url':'https://saudigazette.com.sa/rssFeed/74',                                   'cat':'SPL'},
  {'url':'https://www.middleeasteye.net/rss',                                        'cat':'SPL'},
  {'url':'https://www.reddit.com/r/saudifootball/top/.rss?sort=top&t=day&limit=10',  'cat':'SPL'},
  {'url':'https://www.arabnews.com/rss.xml',                                         'cat':'KSA'},
  {'url':'https://www.arabnews.com/economy/rss.xml',                                 'cat':'KSA'},
  {'url':'https://saudigazette.com.sa/rssFeed/74',                                   'cat':'KSA'},
  {'url':'https://en.majalla.com/rss.xml',                                           'cat':'KSA'},
  {'url':'https://feeds.bbci.co.uk/news/world/middle_east/rss.xml',                  'cat':'KSA'},
  {'url':'https://www.middleeasteye.net/rss',                                        'cat':'KSA'},
  {'url':'https://www.reddit.com/r/saudiarabia/top/.rss?sort=top&t=day&limit=10',    'cat':'KSA'},
]

GOOGLE_NEWS_SOURCES = [
  {'q':'Formula+1',                    'cat':'F1'},
  {'q':'Bayern+Munich',                'cat':'BAYERN'},
  {'q':'Al+Hilal+OR+Al+Nassr',         'cat':'SPL'},
  {'q':'Saudi+Arabia+economy+billion', 'cat':'KSA'},
  {'q':'Premier+League+transfer',      'cat':'FOOTBALL'},
]

# ─────────────────────────────────────────────
# READ EXISTING FEED — now reads ts (unix timestamp)
# ─────────────────────────────────────────────

def read_existing_feed():
    try:
        with open('js/feed.js', 'r') as f:
            content = f.read()
        match = re.search(
            r'// DO NOT EDIT BELOW THIS LINE\s*\nvar FALLBACK_NEWS = (\[.*?\]);\s*\n// DO NOT EDIT ABOVE THIS LINE',
            content, re.DOTALL
        )
        if not match:
            print("No existing feed found")
            return []
        raw   = match.group(1)
        items = []
        pattern = re.compile(
            r"\{title:'((?:[^'\\]|\\.)*)',src:'((?:[^'\\]|\\.)*)',cat:'([^']*)',link:'((?:[^'\\]|\\.)*)',ts:(\d+)\}"
        )
        for m in pattern.finditer(raw):
            ts = int(m.group(5))
            items.append({
                'title':       m.group(1).replace("\\'","'"),
                'source':      m.group(2).replace("\\'","'"),
                'cat':         m.group(3),
                'url':         m.group(4).replace("\\'","'"),
                'timestamp':   ts,
                'source_type': 'existing',
                'ai_score':    0,
            })
        print("Existing feed: " + str(len(items)) + " stories loaded")
        return items
    except Exception as e:
        print("Could not read existing feed: " + str(e))
        return []

def is_within_48h(ts):
    return (NOW - datetime.fromtimestamp(ts, tz=timezone.utc)) <= MAX_AGE

# ─────────────────────────────────────────────
# FETCH RSS
# ─────────────────────────────────────────────

def fetch_rss(src, seen_titles):
    items = []
    for attempt in range(2):
        try:
            req = urlreq.Request(
                src['url'],
                headers={'User-Agent':'Mozilla/5.0 (compatible; NewsBot/1.0)'}
            )
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
                    if dt.tzinfo is None: dt = dt.replace(tzinfo=timezone.utc)
                    if (NOW - dt) > MAX_AGE: continue
                    ts = int(dt.timestamp())
                except:
                    ts = int(NOW.timestamp())
                items.append({
                    'title':       title,
                    'url':         link,
                    'source':      link.split('/')[2].replace('www.',''),
                    'cat':         src['cat'],
                    'timestamp':   ts,
                    'source_type': 'rss',
                    'ai_score':    0,
                })
                count += 1
            print("RSS OK " + src['url'].split('/')[2] + ": " + str(count))
            return items
        except Exception as e:
            if attempt == 0:
                time.sleep(2)
            else:
                print("RSS SKIP " + src['url'].split('/')[2] + ": " + str(e))
    return items

# ─────────────────────────────────────────────
# FETCH GOOGLE NEWS
# ─────────────────────────────────────────────

def fetch_google_news(src, seen_titles):
    items = []
    for attempt in range(2):
        try:
            url = 'https://news.google.com/rss/search?q=' + src['q'] + '&hl=en-US&gl=US&ceid=US:en'
            req = urlreq.Request(url, headers={'User-Agent':'Mozilla/5.0'})
            with urlreq.urlopen(req, timeout=10) as r:
                root = ET.fromstring(r.read())
            node = root.find('channel')
            if node is None: node = root
            count = 0
            for item in node.findall('item'):
                if count >= 8: break
                title = item.findtext('title','').strip()
                link  = item.findtext('link','').strip()
                pub   = item.findtext('pubDate','').strip()
                if not title or not link: continue
                title = re.sub(r'\s+-\s+[^-]+$', '', title).strip()
                title_key = re.sub(r'\W+','',title.lower())[:50]
                if title_key in seen_titles: continue
                seen_titles.add(title_key)
                try:
                    dt = parsedate_to_datetime(pub)
                    if dt.tzinfo is None: dt = dt.replace(tzinfo=timezone.utc)
                    if (NOW - dt) > MAX_AGE: continue
                    ts = int(dt.timestamp())
                except:
                    ts = int(NOW.timestamp())
                items.append({
                    'title':       title,
                    'url':         link,
                    'source':      'google.news',
                    'cat':         src['cat'],
                    'timestamp':   ts,
                    'source_type': 'google_news',
                    'ai_score':    0,
                })
                count += 1
            print("GNEWS OK [" + src['q'][:25] + "]: " + str(count))
            return items
        except Exception as e:
            if attempt == 0:
                time.sleep(2)
            else:
                print("GNEWS SKIP [" + src['q'][:25] + "]: " + str(e))
    return items

# ─────────────────────────────────────────────
# BASIC DEDUP
# ─────────────────────────────────────────────

def basic_dedup(items):
    seen = {}
    unique = []
    for item in items:
        key = re.sub(r'\W+','',item['title'].lower())[:60]
        if key not in seen:
            seen[key] = True
            unique.append(item)
    return unique

# ─────────────────────────────────────────────
# CLAUDE EDITORIAL REVIEW — with your exact ratings
# ─────────────────────────────────────────────

CAT_PROMPTS = {

'F1': """You are the F1 editor for a breaking news app. STRICT rules based on reader ratings:

RATE 5 — ALWAYS INCLUDE if present:
- Confirmed signing with specific role (e.g. "Williams recruit McLaren COO Piers Thynne")
- Confirmed penalty with consequence
- Confirmed injury affecting race
- Confirmed sacking or appointment
- Race result with championship implication

RATE 0 — ALWAYS REJECT, no exceptions:
- Any quote or statement from a driver/team (e.g. "Hamilton says he is happy")
- Any denial of rumour (e.g. "Ocon denies exit rumours")
- Any rumour or speculation with "linked", "could", "might", "may", "interested in"
- Technical development updates (wind tunnel, car parts, engine specs)
- Vague regulatory news without clear impact
- Preview or prediction articles
- Human interest stories
- Any story not 100% confirmed

DUPLICATE RULE — CRITICAL:
If the same event appears multiple times (same team, same action), you MUST keep only 1.
"Williams signs McLaren COO" and "Williams recruit McLaren COO Piers Thynne" = SAME STORY, keep best one only.

Select maximum 6. Better to return 2 great stories than 6 mediocre ones. Return [] if nothing qualifies.""",

'FOOTBALL': """You are the Football editor. Top 5 leagues and Champions League ONLY. STRICT rules:

RATE 5 — ALWAYS INCLUDE:
- Confirmed transfer with player name (e.g. "Casemiro leaves Manchester United, Carrick confirms exit")
- Title won or confirmed
- Confirmed sacking with manager name
- Club expelled or banned with specific reason
- Major match result deciding something significant

RATE 0 — ALWAYS REJECT:
- Human interest / feel-good (e.g. "Arteta learns of title win from crying son")
- Awards (Player of Season, Manager of Month)
- Police/security/logistics stories
- World Cup squad announcements (international not club)
- Any quote, interview, opinion piece
- Previews or predictions
- Stories using "hero", "star", "ace" without naming player
- Vague investigations without outcome (e.g. "FA opens investigation")
- Stories about players "addressing", "responds to", "discusses"

DUPLICATE RULE — CRITICAL:
Same player/event appearing multiple times = keep ONLY the single clearest version.
"Casemiro leaves Man United" appearing 3 times = pick the best one, reject all others.

CATEGORY RULE: Top 5 leagues only. No Championship, no MLS, no international football.
Select maximum 6. Return [] if nothing qualifies.""",

'BAYERN': """You are the Bayern Munich editor. STRICT rules:

RATE 5 — ALWAYS INCLUDE:
- Confirmed Bayern player transfer in or out with fee or contract
- Confirmed Bayern manager sacked or appointed
- Confirmed Bayern player injury with timeline
- Bayern match result with major title/cup implication

RATE 0 — ALWAYS REJECT:
- Any interview where a player "discusses", "talks about", "addresses", "hopes"
- Any player quote about aims, dreams, feelings
- Women's team (Bayern Frauen) — not relevant
- Youth/reserve team
- Germany national team stories — Neuer/Musiala playing for Germany is NOT Bayern news
- Rumours with "linked", "monitored", "interested", "could"
- Previews

DUPLICATE RULE: Same event appearing multiple times = keep only best one.
Select maximum 6. Return [] if nothing qualifies.""",

'SPL': """You are the Saudi Pro League editor. STRICT rules:

RATE 5 — ALWAYS INCLUDE:
- Match result with title race implication naming specific teams
- Confirmed transfer involving SPL team with player name
- Title clinched with specific team and player details

RATE 0 — ALWAYS REJECT:
- Manager quotes about targets or ambitions
- Match previews
- Stories not naming Al Hilal, Al Nassr, Al Ittihad, or Al Ahli specifically

DUPLICATE RULE — CRITICAL:
"Al Nassr win title", "Ronaldo wins Saudi title", "Al Nassr crowned champions" = SAME EVENT.
Keep only the single most informative version. Reject all others.

Select maximum 6. Return [] if nothing qualifies.""",

'KSA': """You are the Saudi Arabia News editor. STRICT rules:

RATE 5 — ALWAYS INCLUDE:
- Specific economic data with figures (e.g. "Saudi non-oil trade surplus reaches SR4.47 billion")
- Confirmed billion-dollar deals or investments
- PIF announcements with specific figures
- Major Vision 2030 milestone confirmed
- Saudi real estate or banking data with specific numbers

RATE 1 — ALWAYS REJECT:
- Diplomatic meetings without major outcome (e.g. "FM discusses relations with New Zealand")
- Crowd management or technology showcases
- Gaza or foreign aid stories
- UK/GCC trade deals (low impact)
- Hajj or religious ceremony stories
- Tourism promotion
- Any story without specific confirmed figures or policy changes

DUPLICATE RULE: Same data point appearing twice = keep only one.
Select maximum 6. Return [] if nothing qualifies.""",
}

def editorial_review(items, cat):
    import os
    api_key = os.environ.get('ANTHROPIC_API_KEY','')
    if not api_key:
        print("No API key")
        sys.exit(1)
    if not items:
        return []

    lines = []
    for i, item in enumerate(items):
        lines.append(str(i) + ' | ' + item['title'])

    prompt = CAT_PROMPTS[cat] + """

Candidates for """ + cat + """ section:

""" + '\n'.join(lines) + """

Tasks:
1. Reject duplicates — same event = keep only best version
2. Reject anything failing rules above
3. Select maximum 6
4. Rewrite titles: direct, factual, max 12 words, no clickbait, no source labels

Return ONLY valid JSON array:
[{"idx": 0, "title": "rewritten headline"}, ...]

Return [] if nothing qualifies. No explanation."""

    payload = json.dumps({
        'model':      'claude-haiku-4-5-20251001',
        'max_tokens': 800,
        'messages':   [{'role':'user','content':prompt}]
    }).encode()

    req = urlreq.Request(
        'https://api.anthropic.com/v1/messages',
        data=payload,
        headers={
            'Content-Type':      'application/json',
            'x-api-key':         api_key,
            'anthropic-version': '2023-06-01'
        }
    )

    with urlreq.urlopen(req, timeout=30) as r:
        response = json.loads(r.read())

    text       = response['content'][0]['text']
    json_match = re.search(r'\[.*?\]', text, re.DOTALL)
    if not json_match:
        print("  " + cat + ": no valid JSON from Claude")
        return []

    try:
        selected = json.loads(json_match.group())
    except:
        print("  " + cat + ": JSON parse failed")
        return []

    results = []
    for s in selected:
        try:
            idx  = int(s['idx'])
            item = dict(items[idx])
            old  = item['title']
            new  = s.get('title','').strip()
            if new and new != old:
                print("  REWRITE: " + old[:50] + " → " + new[:50])
            item['title']    = new if new else old
            item['ai_score'] = 70
            results.append(item)
        except Exception as e:
            print("  Error idx " + str(s.get('idx','?')) + ": " + str(e))
    return results

# ─────────────────────────────────────────────
# OUTPUT — now writes ts instead of date
# ─────────────────────────────────────────────

def js_str(text):
    text = text.replace('&amp;','&').replace('&quot;','"')
    text = text.replace('&#039;',"'").replace('&lt;','<').replace('&gt;','>')
    text = text.encode('ascii','ignore').decode('ascii')
    text = text.replace('\\','').replace("'","\\'")
    text = text.replace('\n',' ').replace('\r',' ')
    return re.sub(r'  +',' ',text).strip()

def write_output(final_items):
    lines = []
    for i in final_items:
        lines.append("  {title:'%s',src:'%s',cat:'%s',link:'%s',ts:%d}" % (
            js_str(i['title']),
            js_str(i['source']),
            i['cat'],
            js_str(i['url']),
            i['timestamp'],
        ))

    new_block = 'var FALLBACK_NEWS = [\n' + ',\n'.join(lines) + '\n];'

    with open('js/feed.js','r') as f:
        content = f.read()

    updated = re.sub(
        r'// DO NOT EDIT BELOW THIS LINE\nvar FALLBACK_NEWS = \[.*?\];\n// DO NOT EDIT ABOVE THIS LINE',
        '// DO NOT EDIT BELOW THIS LINE\n' + new_block + '\n// DO NOT EDIT ABOVE THIS LINE',
        content, flags=re.DOTALL
    )

    if updated == content:
        print("Marker not found - skipping write")
        sys.exit(0)

    with open('js/feed.js','w') as f:
        f.write(updated)

    version = str(int(time.time()))
    with open('index.html','r') as f:
        html = f.read()
    html = re.sub(r'js/feed\.js(\?v=[0-9]+)?','js/feed.js?v=' + version, html)
    with open('index.html','w') as f:
        f.write(html)

# ─────────────────────────────────────────────
# MAIN PIPELINE
# ─────────────────────────────────────────────

print("=" * 50)
print("STEP 0 — LOAD EXISTING FEED")
print("=" * 50)

existing_items = read_existing_feed()
existing_items = [i for i in existing_items if is_within_48h(i['timestamp'])]
print("Existing stories within 48h: " + str(len(existing_items)))

print("\n" + "=" * 50)
print("STEP 1 — INGESTION")
print("=" * 50)

seen_titles = set()
for item in existing_items:
    seen_titles.add(re.sub(r'\W+','',item['title'].lower())[:50])

new_items = []
for src in RSS_SOURCES:
    new_items += fetch_rss(src, seen_titles)
for src in GOOGLE_NEWS_SOURCES:
    new_items += fetch_google_news(src, seen_titles)

print("\nNew items fetched: " + str(len(new_items)))

print("\n" + "=" * 50)
print("STEP 2 — BASIC DEDUP")
print("=" * 50)

unique_new = basic_dedup(new_items)
print("Unique after basic dedup: " + str(len(unique_new)))

print("\n" + "=" * 50)
print("STEP 3 — CLAUDE EDITORIAL REVIEW")
print("=" * 50)

CATEGORIES   = ['F1','FOOTBALL','BAYERN','SPL','KSA']
approved_new = []

for cat in CATEGORIES:
    cat_items = [i for i in unique_new if i['cat'] == cat]
    cat_items.sort(key=lambda x: x.get('timestamp',0), reverse=True)
    print(cat + ": " + str(len(cat_items)) + " candidates →")
    try:
        approved = editorial_review(cat_items, cat)
        print(cat + ": " + str(len(approved)) + " approved")
        approved_new += approved
    except Exception as e:
        print(cat + ": failed — " + str(e))

print("\nTotal approved new: " + str(len(approved_new)))

print("\n" + "=" * 50)
print("STEP 4 — MERGE + FINAL SELECTION")
print("=" * 50)

all_items   = basic_dedup(existing_items + approved_new)
final_items = []

for cat in CATEGORIES:
    cat_items = [i for i in all_items if i['cat'] == cat]
    cat_items.sort(key=lambda x: x.get('timestamp',0), reverse=True)
    top = cat_items[:6]
    print(cat + ": " + str(len(top)) + " stories")
    for s in top:
        print("  [" + str(s['timestamp']) + "] " + s['title'][:72])
    final_items += top

print("\nTotal in feed: " + str(len(final_items)))

if not final_items:
    print("Nothing to write - preserving existing feed")
    sys.exit(0)

print("\n" + "=" * 50)
print("STEP 5 — OUTPUT")
print("=" * 50)

write_output(final_items)
print("Done: " + str(len(final_items)) + " stories written to js/feed.js")
