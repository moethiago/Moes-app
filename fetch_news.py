import urllib.request, xml.etree.ElementTree as ET, re, sys, json, time
from datetime import datetime, timezone, timedelta
from email.utils import parsedate_to_datetime
import urllib.request as urlreq

MAX_AGE = timedelta(hours=48)
NOW     = datetime.now(timezone.utc)

# ─────────────────────────────────────────────
# SOURCES
# ─────────────────────────────────────────────

RSS_SOURCES = [
  # F1
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
  # Football
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
  # Bayern
  {'url':'https://www.sportsmole.co.uk/football/bayern-munich/rss.xml',              'cat':'BAYERN'},
  {'url':'https://www.bundesliga.com/rss/en/rss-news.rss',                           'cat':'BAYERN'},
  {'url':'https://www.transfermarkt.co.uk/rss/news',                                 'cat':'BAYERN'},
  {'url':'https://www.theguardian.com/football/bundesligafootball/rss',              'cat':'BAYERN'},
  {'url':'https://www.reddit.com/r/bayernmunich/top/.rss?sort=top&t=day&limit=10',   'cat':'BAYERN'},
  # Saudi Football
  {'url':'https://www.arabnews.com/cat/5/rss.xml',                                   'cat':'SPL'},
  {'url':'https://saudigazette.com.sa/rssFeed/74',                                   'cat':'SPL'},
  {'url':'https://www.middleeasteye.net/rss',                                        'cat':'SPL'},
  {'url':'https://www.reddit.com/r/saudifootball/top/.rss?sort=top&t=day&limit=10',  'cat':'SPL'},
  # Saudi News
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
# READ EXISTING FEED
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
        raw     = match.group(1)
        items   = []
        pattern = re.compile(
            r"\{title:'((?:[^'\\]|\\.)*)',src:'((?:[^'\\]|\\.)*)',cat:'([^']*)',link:'((?:[^'\\]|\\.)*)',date:'([^']*)'\}"
        )
        for m in pattern.finditer(raw):
            items.append({
                'title':       m.group(1).replace("\\'","'"),
                'url':         m.group(4).replace("\\'","'"),
                'source':      m.group(2).replace("\\'","'"),
                'cat':         m.group(3),
                'date':        m.group(5),
                'source_type': 'existing',
                'engagement':  0,
                'ai_score':    0,
            })
        print("Existing feed: " + str(len(items)) + " stories loaded")
        return items
    except Exception as e:
        print("Could not read existing feed: " + str(e))
        return []

def date_to_dt(date_str):
    try:
        year = NOW.year
        dt   = datetime.strptime(date_str + ' ' + str(year), '%b %d %Y')
        dt   = dt.replace(tzinfo=timezone.utc)
        if (NOW - dt).days < -30:
            dt = dt.replace(year=year - 1)
        return dt
    except:
        return NOW

def is_within_48h(date_str):
    return (NOW - date_to_dt(date_str)) <= MAX_AGE

# ─────────────────────────────────────────────
# FETCH — RSS
# ─────────────────────────────────────────────

def fetch_rss(src, seen_titles):
    items = []
    for attempt in range(2):
        try:
            req = urlreq.Request(
                src['url'],
                headers={'User-Agent':'Mozilla/5.0 (compatible; NewsBot/1.0; +https://github.com)'}
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
                    date_str  = dt.strftime('%b %-d')
                    timestamp = int(dt.timestamp())
                except:
                    date_str  = NOW.strftime('%b %-d')
                    timestamp = int(NOW.timestamp())
                items.append({
                    'title':       title,
                    'url':         link,
                    'source':      link.split('/')[2].replace('www.',''),
                    'cat':         src['cat'],
                    'date':        date_str,
                    'timestamp':   timestamp,
                    'source_type': 'rss',
                    'engagement':  0,
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
# FETCH — GOOGLE NEWS
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
                    date_str  = dt.strftime('%b %-d')
                    timestamp = int(dt.timestamp())
                except:
                    date_str  = NOW.strftime('%b %-d')
                    timestamp = int(NOW.timestamp())
                items.append({
                    'title':       title,
                    'url':         link,
                    'source':      'google.news',
                    'cat':         src['cat'],
                    'date':        date_str,
                    'timestamp':   timestamp,
                    'source_type': 'google_news',
                    'engagement':  0,
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
# BASIC DEDUPLICATION (pre-Claude, exact/near matches)
# ─────────────────────────────────────────────

def basic_dedup(items):
    seen_exact = {}
    unique     = []
    for item in items:
        key = re.sub(r'\W+','',item['title'].lower())[:60]
        if key not in seen_exact:
            seen_exact[key] = True
            unique.append(item)
    return unique

# ─────────────────────────────────────────────
# CLAUDE EDITORIAL REVIEW
# One call per category — sees all candidates together
# Scores, deduplicates, picks best, rewrites titles
# ─────────────────────────────────────────────

def editorial_review(items, cat):
    import os
    api_key = os.environ.get('ANTHROPIC_API_KEY','')
    if not api_key:
        print("No API key")
        sys.exit(1)

    if not items:
        return []

    cat_rules = {
        'F1': """You are editing the F1 section. Only Formula 1 news.
KEEP: driver penalty, crash, retirement, disqualification, sacking, confirmed signing, injury confirmed, race result, championship decided, team announcement.
REJECT: wind tunnel, car development, technical updates, previews, predictions, opinions, interviews, "could"/"might"/"may", round-ups.""",

        'FOOTBALL': """You are editing the Football section. Only top 5 leagues (Premier League, La Liga, Serie A, Bundesliga, Ligue 1) and Champions League.
KEEP: confirmed transfer with player name, confirmed sacking with manager name, confirmed injury with player name, title won, club banned/expelled, match result that decides something major, official club/federation announcement.
REJECT: feel-good human interest stories (manager crying, family moments), award ceremonies, World Cup squad announcements (that's international not club football), police/security stories, opinion pieces, previews, "hero"/"star"/"ace" without a real name, anything with "long-awaited"/"weeks away"/"could"/"might".""",

        'BAYERN': """You are editing the Bayern Munich section. Must be directly about FC Bayern Munich.
KEEP: Bayern player confirmed injured/transferred/sold/signed, Bayern manager sacked/appointed, Bayern match result with major implication, official Bayern announcement. Neuer, Kane, Musiala, Olise, Kompany, Kimmich, Davies are Bayern players.
REJECT: Germany national team stories, interviews, player quotes about hopes/aims/dreams, Bundesliga general news not about Bayern.""",

        'SPL': """You are editing the Saudi Pro League section. Must explicitly name Al Hilal, Al Nassr, Al Ittihad, Al Ahli, or Saudi Pro League.
KEEP: confirmed transfer involving SPL team, confirmed injury of named SPL player, title race result, sacking of SPL manager.
REJECT: any story not naming a specific SPL team.""",

        'KSA': """You are editing the Saudi Arabia News section. Major Saudi economic, government, and policy news only.
KEEP: PIF investments, Vision 2030 milestones, royal decrees, billion-dollar deals, major Saudi economic data, NEOM announcements, Aramco news.
REJECT: sport, ceremonies, Hajj, tourism, attendance events, UK trade deals, general Middle East news not specific to Saudi Arabia.""",
    }

    lines = []
    for i, item in enumerate(items):
        lines.append(str(i) + ' | ' + item['title'])

    prompt = cat_rules.get(cat, '') + """

Here are the candidate headlines for today's """ + cat + """ section.
Your job as editor:

1. IDENTIFY DUPLICATES — if multiple headlines cover the same story, mark all but the best one as duplicate.
2. REJECT bad stories — anything that fails the rules above.
3. SELECT maximum 6 stories — the most impactful, confirmed, breaking ones.
4. REWRITE selected titles to be direct and factual:
   - State WHO did WHAT
   - Remove clickbait words: "hero", "star", "ace", "long-awaited", "stunning", "shock"
   - Remove trailing labels: "| The Verdict", "- Report", "- BBC Sport"
   - Maximum 12 words
   - Do not invent facts not in the original headline

Return ONLY a valid JSON array of selected stories. Each object:
{"idx": number, "title": "rewritten headline"}

Only include stories you are keeping. If you reject a story, do not include it.
If nothing qualifies, return an empty array [].

Candidates:
""" + '\n'.join(lines)

    payload = json.dumps({
        'model':      'claude-haiku-4-5-20251001',
        'max_tokens': 1000,
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
            item = items[idx]
            old_title = item['title']
            new_title = s.get('title', old_title).strip()
            if new_title and new_title != old_title:
                print("  REWRITE: " + old_title[:50] + " → " + new_title[:50])
            item = dict(item)
            item['title']    = new_title if new_title else old_title
            item['ai_score'] = 70
            results.append(item)
        except Exception as e:
            print("  Error processing idx " + str(s.get('idx','?')) + ": " + str(e))
    return results

# ─────────────────────────────────────────────
# OUTPUT
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
        lines.append("  {title:'%s',src:'%s',cat:'%s',link:'%s',date:'%s'}" % (
            js_str(i['title']),
            js_str(i['source']),
            i['cat'],
            js_str(i['url']),
            i['date'],
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
existing_items = [i for i in existing_items if is_within_48h(i['date'])]
for item in existing_items:
    if 'timestamp' not in item:
        item['timestamp'] = int(date_to_dt(item['date']).timestamp())
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
print("Unique new items after basic dedup: " + str(len(unique_new)))

print("\n" + "=" * 50)
print("STEP 3 — CLAUDE EDITORIAL REVIEW (per category)")
print("=" * 50)

CATEGORIES = ['F1', 'FOOTBALL', 'BAYERN', 'SPL', 'KSA']
approved_new = []

for cat in CATEGORIES:
    cat_items = [i for i in unique_new if i['cat'] == cat]
    # sort newest first before sending to Claude
    cat_items.sort(key=lambda x: x.get('timestamp', 0), reverse=True)
    print(cat + ": sending " + str(len(cat_items)) + " candidates to Claude...")
    try:
        approved = editorial_review(cat_items, cat)
        print(cat + ": Claude approved " + str(len(approved)) + " stories")
        approved_new += approved
    except Exception as e:
        print(cat + ": editorial review failed — " + str(e))

print("\nTotal approved new: " + str(len(approved_new)))

print("\n" + "=" * 50)
print("STEP 4 — MERGE WITH EXISTING")
print("=" * 50)

# combine existing + newly approved, basic dedup on title
all_items = existing_items + approved_new
all_items = basic_dedup(all_items)

# pick top 6 per category, newest first
final_items = []
for cat in CATEGORIES:
    cat_items = [i for i in all_items if i['cat'] == cat]
    cat_items.sort(key=lambda x: x.get('timestamp', 0), reverse=True)
    top = cat_items[:6]
    print(cat + ": " + str(len(top)) + " stories in final feed")
    for s in top:
        print("  [" + s['date'] + "] " + s['title'][:70])
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
