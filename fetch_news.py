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
  # Football
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
  # Bayern
  {'url':'https://www.sportsmole.co.uk/football/bayern-munich/rss.xml', 'cat':'BAYERN'},
  {'url':'https://www.bundesliga.com/rss/en/rss-news.rss',              'cat':'BAYERN'},
  {'url':'https://www.skysports.com/rss/11095',                         'cat':'BAYERN'},
  {'url':'https://www.espn.com/espn/rss/soccer/news',                   'cat':'BAYERN'},
  {'url':'https://www.transfermarkt.co.uk/rss/news',                    'cat':'BAYERN'},
  {'url':'https://www.theguardian.com/football/bundesligafootball/rss', 'cat':'BAYERN'},
  {'url':'https://www.mirror.co.uk/sport/football/rss.xml',             'cat':'BAYERN'},
  {'url':'https://www.independent.co.uk/sport/football/rss',            'cat':'BAYERN'},
  {'url':'https://www.givemesport.com/rss/football',                    'cat':'BAYERN'},
  # Saudi Football
  {'url':'https://www.arabnews.com/cat/5/rss.xml',                      'cat':'SPL'},
  {'url':'https://saudigazette.com.sa/rssFeed/74',                      'cat':'SPL'},
  {'url':'https://www.espn.com/espn/rss/soccer/news',                   'cat':'SPL'},
  {'url':'https://www.skysports.com/rss/11095',                         'cat':'SPL'},
  {'url':'https://www.transfermarkt.co.uk/rss/news',                    'cat':'SPL'},
  {'url':'https://www.mirror.co.uk/sport/football/rss.xml',             'cat':'SPL'},
  {'url':'https://www.independent.co.uk/sport/football/rss',            'cat':'SPL'},
  {'url':'https://www.middleeasteye.net/rss',                           'cat':'SPL'},
  {'url':'https://www.givemesport.com/rss/football',                    'cat':'SPL'},
  # Saudi News
  {'url':'https://www.arabnews.com/rss.xml',                            'cat':'KSA'},
  {'url':'https://www.arabnews.com/economy/rss.xml',                    'cat':'KSA'},
  {'url':'https://saudigazette.com.sa/rssFeed/74',                      'cat':'KSA'},
  {'url':'https://en.majalla.com/rss.xml',                              'cat':'KSA'},
  {'url':'https://feeds.bbci.co.uk/news/world/middle_east/rss.xml',     'cat':'KSA'},
  {'url':'https://www.middleeasteye.net/rss',                           'cat':'KSA'},
]

GOOGLE_NEWS_SOURCES = [
  {'q':'Formula 1 race penalty crash retirement',                        'cat':'F1'},
  {'q':'Formula 1 driver sacked fired banned suspended',                 'cat':'F1'},
  {'q':'F1 transfer signing confirmed 2025 2026',                        'cat':'F1'},
  {'q':'Premier League transfer confirmed sacked injury banned',         'cat':'FOOTBALL'},
  {'q':'La Liga Serie A Bundesliga Ligue 1 transfer sacked injury',      'cat':'FOOTBALL'},
  {'q':'Champions League final winner sacked penalty',                   'cat':'FOOTBALL'},
  {'q':'Bayern Munich transfer injury sacked Kompany Kane Musiala',      'cat':'BAYERN'},
  {'q':'Al Hilal Al Nassr Al Ittihad Al Ahli transfer injury sacked',    'cat':'SPL'},
  {'q':'Ronaldo Benzema Saudi Pro League goal transfer',                 'cat':'SPL'},
  {'q':'Saudi Arabia PIF investment billion deal Vision 2030',           'cat':'KSA'},
  {'q':'NEOM Saudi Arabia announcement project',                        'cat':'KSA'},
  {'q':'Saudi Aramco PIF royal decree economic reform',                 'cat':'KSA'},
]

REDDIT_SOURCES = [
  {'url':'https://www.reddit.com/r/formula1/hot.json',                   'cat':'F1',       'min_score':500,  'min_comments':100},
  {'url':'https://www.reddit.com/r/soccer/hot.json',                     'cat':'FOOTBALL', 'min_score':1000, 'min_comments':200},
  {'url':'https://www.reddit.com/r/bayernmunich/hot.json',               'cat':'BAYERN',   'min_score':200,  'min_comments':50},
  {'url':'https://www.reddit.com/r/saudifootball/hot.json',              'cat':'SPL',      'min_score':100,  'min_comments':20},
  {'url':'https://www.reddit.com/r/saudiarabia/hot.json',                'cat':'KSA',      'min_score':200,  'min_comments':50},
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
        # parse JS object literals into dicts
        raw = match.group(1)
        items = []
        pattern = re.compile(
            r"\{title:'((?:[^'\\]|\\.)*)',src:'((?:[^'\\]|\\.)*)',cat:'([^']*)',link:'((?:[^'\\]|\\.)*)',date:'([^']*)'\}"
        )
        for m in pattern.finditer(raw):
            title, src, cat, link, date = m.group(1), m.group(2), m.group(3), m.group(4), m.group(5)
            items.append({
                'title':       title.replace("\\'", "'"),
                'url':         link.replace("\\'", "'"),
                'source':      src.replace("\\'", "'"),
                'cat':         cat,
                'date':        date,
                'source_type': 'existing',
                'engagement':  0,
                'ai_score':    50,
                'fetched_at':  None,
            })
        print("Existing feed: " + str(len(items)) + " stories loaded")
        return items
    except Exception as e:
        print("Could not read existing feed: " + str(e))
        return []

def is_within_48h(date_str):
    try:
        # date_str format: "May 21"
        # parse as current year
        year = NOW.year
        dt = datetime.strptime(date_str + ' ' + str(year), '%b %d %Y')
        dt = dt.replace(tzinfo=timezone.utc)
        # handle year boundary
        if (NOW - dt).days < -30:
            dt = dt.replace(year=year - 1)
        return (NOW - dt) <= MAX_AGE
    except:
        return True  # keep if we can't parse

# ─────────────────────────────────────────────
# FETCH — RSS
# ─────────────────────────────────────────────

def fetch_rss(src, seen_titles):
    items = []
    for attempt in range(2):
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
                    if dt.tzinfo is None: dt = dt.replace(tzinfo=timezone.utc)
                    if (NOW - dt) > MAX_AGE: continue
                    date_str = dt.strftime('%b %-d')
                except:
                    date_str = NOW.strftime('%b %-d')
                items.append({
                    'title':       title,
                    'url':         link,
                    'source':      link.split('/')[2].replace('www.',''),
                    'cat':         src['cat'],
                    'date':        date_str,
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
            q   = src['q'].replace(' ', '+')
            url = 'https://news.google.com/rss/search?q=' + q + '&hl=en-US&gl=US&ceid=US:en'
            req = urlreq.Request(url, headers={'User-Agent':'Mozilla/5.0'})
            with urlreq.urlopen(req, timeout=10) as r:
                root = ET.fromstring(r.read())
            node = root.find('channel')
            if node is None: node = root
            count = 0
            for item in node.findall('item'):
                if count >= 10: break
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
                    date_str = dt.strftime('%b %-d')
                except:
                    date_str = NOW.strftime('%b %-d')
                items.append({
                    'title':       title,
                    'url':         link,
                    'source':      'google.news',
                    'cat':         src['cat'],
                    'date':        date_str,
                    'source_type': 'google_news',
                    'engagement':  0,
                    'ai_score':    0,
                })
                count += 1
            print("GNEWS OK [" + src['q'][:30] + "]: " + str(count))
            return items
        except Exception as e:
            if attempt == 0:
                time.sleep(2)
            else:
                print("GNEWS SKIP [" + src['q'][:30] + "]: " + str(e))
    return items

# ─────────────────────────────────────────────
# FETCH — REDDIT
# ─────────────────────────────────────────────

def fetch_reddit(src, seen_titles):
    items = []
    for attempt in range(2):
        try:
            req = urlreq.Request(
                src['url'],
                headers={'User-Agent':'Mozilla/5.0 (compatible; NewsBot/1.0)'}
            )
            with urlreq.urlopen(req, timeout=10) as r:
                data = json.loads(r.read())
            posts = data.get('data',{}).get('children',[])
            count = 0
            for post in posts:
                if count >= 10: break
                p = post.get('data',{})
                if p.get('is_video') or p.get('post_hint','') == 'image': continue
                score    = p.get('score', 0)
                comments = p.get('num_comments', 0)
                if score < src['min_score'] or comments < src['min_comments']: continue
                title = p.get('title','').strip()
                url   = 'https://reddit.com' + p.get('permalink','')
                if not title: continue
                title_key = re.sub(r'\W+','',title.lower())[:50]
                if title_key in seen_titles: continue
                seen_titles.add(title_key)
                engagement = min(100, int(score / 100))
                items.append({
                    'title':       title,
                    'url':         url,
                    'source':      'reddit.com/r/' + p.get('subreddit',''),
                    'cat':         src['cat'],
                    'date':        NOW.strftime('%b %-d'),
                    'source_type': 'reddit',
                    'engagement':  engagement,
                    'ai_score':    0,
                })
                count += 1
            print("REDDIT OK " + src['url'].split('/r/')[1].split('/')[0] + ": " + str(count))
            return items
        except Exception as e:
            if attempt == 0:
                time.sleep(2)
            else:
                print("REDDIT SKIP " + src['url'] + ": " + str(e))
    return items

# ─────────────────────────────────────────────
# DEDUPLICATION
# ─────────────────────────────────────────────

KEY_ENTITIES = [
    'hamilton','verstappen','norris','leclerc','russell','antonelli','piastri',
    'alonso','sainz','perez','red bull','mclaren','ferrari','mercedes',
    'arsenal','man city','liverpool','chelsea','tottenham','man united','newcastle',
    'real madrid','barcelona','atletico','dortmund','psg','juventus','inter','napoli',
    'al hilal','al nassr','al ittihad','al ahli',
    'ronaldo','benzema','mane','salah','haaland','mbappe','bellingham','kane',
    'musiala','olise','kompany','kimmich',
    'vision 2030','pif','neom','aramco',
]

KEY_TOPICS = [
    'sacked','fired','resign','transfer','signed','signing','injured','injury',
    'banned','ban','suspended','suspension','penalty','crash','dnf','pole',
    'contract','confirmed','title','champion','relegated','relegation','final',
    'expelled','cancelled','postponed','announced','deal','billion',
]

def fingerprint(title):
    t = title.lower()
    ents   = [e for e in KEY_ENTITIES if e in t]
    topics = [tp for tp in KEY_TOPICS   if tp in t]
    return ents, topics

def deduplicate(items):
    seen_exact   = {}
    seen_stories = []
    unique       = []
    for item in items:
        key = re.sub(r'\W+','',item['title'].lower())[:60]
        if key in seen_exact:
            existing = seen_exact[key]
            if item.get('engagement',0) > existing.get('engagement',0):
                existing['engagement'] = item['engagement']
            if item['source_type'] in ('rss','google_news'):
                existing['source'] = item['source']
            # keep higher ai_score if existing already scored
            if item.get('ai_score',0) > existing.get('ai_score',0):
                existing['ai_score'] = item['ai_score']
            continue
        ents, topics = fingerprint(item['title'])
        is_dup = False
        for s in seen_stories:
            shared_ent   = [e for e in ents   if e in s['ents']]
            shared_topic = [t for t in topics  if t in s['topics']]
            if shared_ent and shared_topic:
                is_dup = True
                if item.get('engagement',0) > s['engagement']:
                    s['engagement'] = item['engagement']
                break
        if not is_dup:
            seen_exact[key] = item
            seen_stories.append({
                'ents':      ents,
                'topics':    topics,
                'engagement':item.get('engagement',0)
            })
            unique.append(item)
    return unique

# ─────────────────────────────────────────────
# AI SCORING
# ─────────────────────────────────────────────

def score_with_claude(items):
    import os
    api_key = os.environ.get('ANTHROPIC_API_KEY','')
    if not api_key:
        print("No API key")
        sys.exit(1)

    headlines = []
    for i, item in enumerate(items):
        eng = (' [reddit:' + str(item['engagement']) + ']') if item.get('engagement',0) > 0 else ''
        headlines.append(str(i) + '|' + item['cat'] + '|' + item['title'] + eng)

    prompt = """You are a news scoring engine for a high-signal sports and news app.

Score each headline from 1-100 based on IMPACT and INTEREST. Return scores for ALL headlines.

SCORING CRITERIA:
- Breaking/urgency (is this happening NOW?)
- Controversy/conflict
- Famous names involved (Ronaldo, Verstappen, Kane, Mbappe, Haaland etc)
- Transfer confirmed (not rumoured)
- Injury/suspension/ban impact
- Sacking/resignation
- Title won/lost/decided
- Economic scale (billions, major deals)
- Viral/discussion potential
- Championship implications

HIGH SCORE examples (70-100):
- Player confirmed transfer to new club
- Manager sacked after X games
- Driver penalised and starts from back of grid
- Star player out for the season with injury
- Club expelled / banned
- Title won or mathematically decided
- PIF acquires major company
- Royal decree changes economic policy
- Reddit post with 5000+ upvotes about major incident

LOW SCORE examples (1-30):
- Match preview
- How to watch
- Fantasy football tips
- Player ratings
- Training ground update
- Generic interview
- Power rankings
- Opinion piece
- Transfer rumour (not confirmed)
- Generic recap without major incident

CATEGORY RULES - only score if relevant to category:
- F1: must be about Formula 1 specifically
- FOOTBALL: must be top 5 leagues or Champions League
- BAYERN: must mention FC Bayern Munich, their players or manager by name
- SPL: must mention Al Hilal, Al Nassr, Al Ittihad, Al Ahli, or Saudi Pro League
- KSA: must be Saudi economic/policy/government news - NOT sport

If a headline does NOT belong to its category, score it 0.
Reddit engagement score in [brackets] is a signal - higher means more fan discussion.

Return ONLY a valid JSON array. Each item: {"idx": number, "score": number}
Include ALL headlines with a score, even if score is 0.

Headlines (format: index|category|title):
""" + '\n'.join(headlines)

    payload = json.dumps({
        'model':      'claude-haiku-4-5-20251001',
        'max_tokens': 2000,
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

    with urlreq.urlopen(req, timeout=45) as r:
        response = json.loads(r.read())

    text       = response['content'][0]['text']
    json_match = re.search(r'\[.*\]', text, re.DOTALL)
    if not json_match:
        print("Claude returned no valid JSON")
        return items

    scores = json.loads(json_match.group())
    score_map = {s['idx']: s['score'] for s in scores}
    for i, item in enumerate(items):
        item['ai_score'] = score_map.get(i, 0)
    return items

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
# drop existing stories older than 48h
existing_items = [i for i in existing_items if is_within_48h(i['date'])]
print("Existing stories within 48h: " + str(len(existing_items)))

print("\n" + "=" * 50)
print("STEP 1 — INGESTION")
print("=" * 50)

# seed seen_titles from existing so we don't re-fetch duplicates
seen_titles = set()
for item in existing_items:
    key = re.sub(r'\W+','',item['title'].lower())[:50]
    seen_titles.add(key)

new_items = []
for src in RSS_SOURCES:
    new_items += fetch_rss(src, seen_titles)
for src in GOOGLE_NEWS_SOURCES:
    new_items += fetch_google_news(src, seen_titles)
for src in REDDIT_SOURCES:
    new_items += fetch_reddit(src, seen_titles)

print("\nNew items fetched: " + str(len(new_items)))

print("\n" + "=" * 50)
print("STEP 2 — DEDUPLICATION")
print("=" * 50)

unique_new = deduplicate(new_items)
print("Unique new items: " + str(len(unique_new)))

print("\n" + "=" * 50)
print("STEP 3 — AI SCORING (new items only)")
print("=" * 50)

BATCH_SIZE = 150
scored_new = []
batches = [unique_new[i:i+BATCH_SIZE] for i in range(0, len(unique_new), BATCH_SIZE)]
for b, batch in enumerate(batches):
    print("Scoring batch " + str(b+1) + "/" + str(len(batches)) + " (" + str(len(batch)) + " items)...")
    try:
        scored = score_with_claude(batch)
        scored_new += scored
    except Exception as e:
        print("Scoring batch failed: " + str(e))
        for item in batch:
            item['ai_score'] = 50
        scored_new += batch

print("Scored: " + str(len(scored_new)) + " new items")

print("\n" + "=" * 50)
print("STEP 4 — MERGE WITH EXISTING")
print("=" * 50)

# only keep new items that passed minimum score
MIN_SCORE   = 40
passed_new  = [i for i in scored_new if i.get('ai_score',0) >= MIN_SCORE]
print("New items passing score threshold (" + str(MIN_SCORE) + "): " + str(len(passed_new)))

# merge: existing + new, deduplicate again
merged = deduplicate(existing_items + passed_new)
print("Total after merge + dedup: " + str(len(merged)))

print("\n" + "=" * 50)
print("STEP 5 — SELECTION (top 6 per category)")
print("=" * 50)

CATEGORIES  = ['F1','FOOTBALL','BAYERN','SPL','KSA']
final_items = []

for cat in CATEGORIES:
    cat_items = [i for i in merged if i['cat'] == cat]
    cat_items.sort(key=lambda x: x.get('ai_score',0), reverse=True)
    top = cat_items[:6]
    print(cat + ": " + str(len(top)) + " stories")
    for story in top:
        print("  [" + str(story.get('ai_score',0)) + "] " + story['title'][:70])
    final_items += top

print("\nTotal in feed: " + str(len(final_items)))

if not final_items:
    print("Nothing to write - preserving existing feed")
    sys.exit(0)

print("\n" + "=" * 50)
print("STEP 6 — OUTPUT")
print("=" * 50)

write_output(final_items)
print("Done: " + str(len(final_items)) + " stories written to js/feed.js")
