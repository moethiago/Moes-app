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
  {'url':'https://www.motorsportweek.com/feed/',                         'cat':'F1'},
  # Football
  {'url':'https://feeds.bbci.co.uk/sport/football/rss.xml',             'cat':'FOOTBALL'},
  {'url':'https://www.theguardian.com/football/premierleague/rss',      'cat':'FOOTBALL'},
  {'url':'https://www.theguardian.com/football/laliga/rss',             'cat':'FOOTBALL'},
  {'url':'https://www.theguardian.com/football/serieafootball/rss',     'cat':'FOOTBALL'},
  {'url':'https://www.theguardian.com/football/bundesligafootball/rss', 'cat':'FOOTBALL'},
  {'url':'https://www.theguardian.com/football/ligue1football/rss',     'cat':'FOOTBALL'},
  {'url':'https://www.skysports.com/rss/11095',                         'cat':'FOOTBALL'},
  {'url':'https://talksport.com/feed/',                                  'cat':'FOOTBALL'},
  {'url':'https://www.fourfourtwo.com/rss',                             'cat':'FOOTBALL'},
  {'url':'https://www.mirror.co.uk/sport/football/rss.xml',             'cat':'FOOTBALL'},
  {'url':'https://www.independent.co.uk/sport/football/rss',            'cat':'FOOTBALL'},
  {'url':'https://www.standard.co.uk/sport/football/rss',               'cat':'FOOTBALL'},
  {'url':'https://www.cbssports.com/rss/headlines/soccer/',             'cat':'FOOTBALL'},
  {'url':'https://www.transfermarkt.co.uk/rss/news',                    'cat':'FOOTBALL'},
  {'url':'https://www.marca.com/en/rss/football.xml',                   'cat':'FOOTBALL'},
  {'url':'https://www.sportsmole.co.uk/football/rss.xml',               'cat':'FOOTBALL'},
  # Bayern
  {'url':'https://www.sportsmole.co.uk/football/bayern-munich/rss.xml', 'cat':'BAYERN'},
  {'url':'https://www.bundesliga.com/rss/en/rss-news.rss',              'cat':'BAYERN'},
  {'url':'https://www.transfermarkt.co.uk/rss/news',                    'cat':'BAYERN'},
  {'url':'https://www.theguardian.com/football/bundesligafootball/rss', 'cat':'BAYERN'},
  # Saudi Football
  {'url':'https://www.arabnews.com/cat/5/rss.xml',                      'cat':'SPL'},
  {'url':'https://saudigazette.com.sa/rssFeed/74',                      'cat':'SPL'},
  {'url':'https://www.middleeasteye.net/rss',                           'cat':'SPL'},
  # Saudi News
  {'url':'https://www.arabnews.com/rss.xml',                            'cat':'KSA'},
  {'url':'https://www.arabnews.com/economy/rss.xml',                    'cat':'KSA'},
  {'url':'https://saudigazette.com.sa/rssFeed/74',                      'cat':'KSA'},
  {'url':'https://en.majalla.com/rss.xml',                              'cat':'KSA'},
  {'url':'https://feeds.bbci.co.uk/news/world/middle_east/rss.xml',     'cat':'KSA'},
  {'url':'https://www.middleeasteye.net/rss',                           'cat':'KSA'},
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
    t      = title.lower()
    ents   = [e  for e  in KEY_ENTITIES if e  in t]
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
            if item.get('ai_score',0) > existing.get('ai_score',0):
                existing['ai_score'] = item['ai_score']
            continue
        ents, topics = fingerprint(item['title'])
        is_dup = False
        for s in seen_stories:
            if [e for e in ents if e in s['ents']] and [t for t in topics if t in s['topics']]:
                is_dup = True
                if item.get('engagement',0) > s['engagement']:
                    s['engagement'] = item['engagement']
                break
        if not is_dup:
            seen_exact[key] = item
            seen_stories.append({
                'ents':       ents,
                'topics':     topics,
                'engagement': item.get('engagement',0)
            })
            unique.append(item)
    return unique

# ─────────────────────────────────────────────
# AI SCORING — per category, small batches
# ─────────────────────────────────────────────

def score_batch(items, cat):
    import os
    api_key = os.environ.get('ANTHROPIC_API_KEY','')
    if not api_key:
        print("No API key")
        sys.exit(1)

    headlines = []
    for i, item in enumerate(items):
        headlines.append(str(i) + '|' + item['title'])

    cat_rules = {
        'F1':       'Formula 1 ONLY. Score 0 if not about F1.',
        'FOOTBALL': 'Top 5 leagues or Champions League ONLY. Score 0 for any other competition.',
        'BAYERN':   'Must explicitly name FC Bayern Munich or their players (Kane, Musiala, Olise, Kompany, Kimmich, Neuer, Davies). Score 0 otherwise.',
        'SPL':      'Must explicitly name Al Hilal, Al Nassr, Al Ittihad, Al Ahli, or Saudi Pro League. Score 0 for any other football.',
        'KSA':      'Saudi economic/government/policy news ONLY (PIF, Vision 2030, NEOM, Aramco, royal decrees). Score 0 for sport.',
    }

    prompt = """Score these """ + cat + """ headlines from 1-100.

CATEGORY RULE: """ + cat_rules.get(cat, '') + """

HIGH (70-100): confirmed transfer, sacking, injury ruling out player, ban, title decided, billion-dollar deal, royal decree
MEDIUM (45-69): confirmed contract, match result with major implications, regulatory change
LOW (1-44): preview, opinion, ratings, rumour, training update, how-to-watch, generic interview

Return ONLY a JSON array: [{"idx":0,"score":75},{"idx":1,"score":30}...]
Every headline must have a score. If it breaks the category rule, score is 0.

Headlines:
""" + '\n'.join(headlines)

    payload = json.dumps({
        'model':      'claude-haiku-4-5-20251001',
        'max_tokens': 1200,
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

    text = response['content'][0]['text']

    # try to extract full JSON array
    json_match = re.search(r'\[.*?\]', text, re.DOTALL)
    if json_match:
        try:
            scores    = json.loads(json_match.group())
            score_map = {s['idx']: s['score'] for s in scores}
            for i, item in enumerate(items):
                item['ai_score'] = score_map.get(i, 0)
            return items
        except:
            pass

    # partial salvage: extract individual {"idx":N,"score":N} objects
    partial = re.findall(r'\{"idx"\s*:\s*(\d+)\s*,\s*"score"\s*:\s*(\d+)\}', text)
    if partial:
        score_map = {int(idx): int(score) for idx, score in partial}
        for i, item in enumerate(items):
            item['ai_score'] = score_map.get(i, 0)
        print("  (partial salvage: " + str(len(partial)) + "/" + str(len(items)) + " scores recovered)")
        return items

    print("  WARNING: no scores returned, defaulting to 0")
    for item in items:
        item['ai_score'] = 0
    return items

def score_all(items):
    # score per category in batches of 50
    BATCH = 50
    by_cat = {}
    for item in items:
        by_cat.setdefault(item['cat'], []).append(item)

    scored = []
    for cat, cat_items in by_cat.items():
        batches = [cat_items[i:i+BATCH] for i in range(0, len(cat_items), BATCH)]
        print(cat + ": " + str(len(cat_items)) + " items in " + str(len(batches)) + " batch(es)")
        for b, batch in enumerate(batches):
            try:
                scored += score_batch(batch, cat)
            except Exception as e:
                print("  batch " + str(b+1) + " failed: " + str(e) + " — scoring 0")
                for item in batch:
                    item['ai_score'] = 0
                scored += batch
    return scored

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
print("STEP 2 — DEDUPLICATION")
print("=" * 50)

unique_new = deduplicate(new_items)
print("Unique new items: " + str(len(unique_new)))

print("\n" + "=" * 50)
print("STEP 3 — AI SCORING (per category)")
print("=" * 50)

scored_new = score_all(unique_new)
print("Total scored: " + str(len(scored_new)))

print("\n" + "=" * 50)
print("STEP 4 — MERGE WITH EXISTING")
print("=" * 50)

MIN_SCORE        = 45
BEST_EFFORT_MIN  = 20
BEST_EFFORT_CATS = {'BAYERN', 'SPL', 'KSA'}

passed_new      = [i for i in scored_new if i.get('ai_score',0) >= MIN_SCORE]
best_effort_new = [i for i in scored_new if BEST_EFFORT_MIN <= i.get('ai_score',0) < MIN_SCORE]

print("Passing MIN_SCORE (" + str(MIN_SCORE) + "): " + str(len(passed_new)))
print("Best-effort pool (" + str(BEST_EFFORT_MIN) + "-" + str(MIN_SCORE-1) + "): " + str(len(best_effort_new)))

merged          = deduplicate(existing_items + passed_new)
best_effort_all = deduplicate(best_effort_new)
print("Total after merge: " + str(len(merged)))

print("\n" + "=" * 50)
print("STEP 5 — SELECTION (top 6 per category, newest first)")
print("=" * 50)

CATEGORIES  = ['F1','FOOTBALL','BAYERN','SPL','KSA']
final_items = []

for cat in CATEGORIES:
    cat_items = [i for i in merged if i['cat'] == cat and i.get('ai_score',0) >= MIN_SCORE]
    cat_items.sort(key=lambda x: (x.get('timestamp',0), x.get('ai_score',0)), reverse=True)
    top = cat_items[:6]

    # best-effort fallback for low-volume categories
    if len(top) < 3 and cat in BEST_EFFORT_CATS:
        have = set(re.sub(r'\W+','',s['title'].lower())[:50] for s in top)
        fallback = [
            i for i in best_effort_all
            if i['cat'] == cat and re.sub(r'\W+','',i['title'].lower())[:50] not in have
        ]
        fallback.sort(key=lambda x: (x.get('timestamp',0), x.get('ai_score',0)), reverse=True)
        added = fallback[:3 - len(top)]
        top  += added
        if added:
            print(cat + ": added " + str(len(added)) + " best-effort stories")

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
