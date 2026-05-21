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
# CLAUDE EDITORIAL REVIEW
# ─────────────────────────────────────────────

CAT_PROMPTS = {

'F1': """You are the F1 editor for a breaking news app. The reader wants only confirmed, impactful Formula 1 news.

EXAMPLES OF WHAT THE READER RATES 5/5 (always include if present):
- "Williams adds McLaren COO to F1 personnel team" — confirmed signing, specific role named
- "Verstappen penalised and starts Canadian GP from the back" — confirmed penalty with consequence
- "Norris confirmed out of next race with hand injury" — confirmed injury with impact
- "McLaren sack team principal after poor start to season" — confirmed sacking

EXAMPLES OF WHAT THE READER RATES 0/5 (always reject):
- "Hamilton says he is very happy at Ferrari" — player quote/sentiment, zero news value
- "Three Ellas advance through McLaren F1 ranks" — irrelevant filler, no news value
- "FIA confirms lowest energy recharge limit for Canada qualifying" — vague technical rule, unclear impact
- "Red Bull outlines timeline for new wind tunnel" — development update, not news
- "Ocon denies fabricated rumours of falling out with Haas boss" — denial of rumour, not news
- Any preview, prediction, opinion, interview, or "could/might/may" story

DUPLICATE RULE: If multiple headlines cover the same event (same team doing same thing), keep only the clearest and most specific one. Reject the rest.

SELECT maximum 6 stories. Only include genuinely confirmed, impactful F1 news.
Reject everything else — it is better to have 2 great stories than 6 mediocre ones.""",

'FOOTBALL': """You are the Football editor for a breaking news app. Top 5 leagues and Champions League only. The reader wants confirmed, impactful club football news.

EXAMPLES OF WHAT THE READER RATES 5/5 (always include if present):
- "Casemiro leaves Manchester United, Carrick confirms exit" — named player, confirmed departure, confirmed by someone
- "Arsenal crowned Premier League champions" — title confirmed
- "Aston Villa win Europa League" — trophy won, confirmed result
- "Southampton expelled from Championship play-offs over Spygate" — major consequence confirmed

EXAMPLES OF WHAT THE READER RATES 0/5 (always reject):
- "Arteta learns of title win from crying son at barbecue" — human interest fluff, zero news value
- "Rogers named Europa League Player of the Season" — award, low impact
- "FA opens Southampton investigation over Spygate" — investigation opened is vague; prefer specific outcome
- "Three police officers assigned to 10,000 England fans at World Cup" — irrelevant filler
- "Manager says he is proud of his players" — quote with no news value
- Any story about World Cup squad announcements (that is international football, not club)
- Any preview, prediction, opinion piece, player ratings, fantasy football

DUPLICATE RULE: If the same player leaving/joining/injured appears multiple times, keep only the single clearest version. "Casemiro leaves Manchester United" appearing 3 times = keep best one, reject others.

SPECIFICITY RULE: If a headline uses "hero", "star", "ace" or any vague word instead of naming the actual player, reject it. Good journalism names the person.

SELECT maximum 6 stories. Only confirmed, impactful club football from top 5 leagues or Champions League.""",

'BAYERN': """You are the Bayern Munich editor for a breaking news app. The reader wants confirmed Bayern Munich news only.

EXAMPLES OF WHAT THE READER RATES 5/5 (always include if present):
- "Bayern Munich sign [player] from [club]" — confirmed transfer
- "Kane scores hat-trick as Bayern win DFB Cup" — confirmed result with named player
- "Kompany sacked as Bayern manager" — confirmed sacking
- "Musiala out for rest of season with knee injury" — confirmed injury with impact

EXAMPLES OF WHAT THE READER RATES 0/5 (always reject):
- "Bayern Munich's Bischof discusses DFB Cup hopes" — interview, player talking about hopes
- "Bayern Munich's Stanišić: Everyone thinking about next title" — player quote, zero news
- "Bayern Munich president says Kompany is unsellable" — opinion/PR statement
- "Bayern Munich vs Stuttgart: DFB-Pokal final preview" — preview
- "Bayern Munich and Stuttgart compared ahead of DFB Cup final" — comparison/preview
- Any story where a Bayern player just talks, gives interview, or expresses opinion
- Germany national team stories (not Bayern club news)

CATEGORY RULE: Must be about FC Bayern Munich the club. Bayern players include: Kane, Musiala, Olise, Neuer, Kompany, Kimmich, Davies, Goretzka, Laimer, Upamecano, Gnabry, Bischof, Stanišić.

SELECT maximum 6 stories. If nothing qualifies, return [].""",

'SPL': """You are the Saudi Pro League editor for a breaking news app. The reader wants confirmed Saudi Pro League news.

EXAMPLES OF WHAT THE READER RATES 4-5/5 (always include if present):
- "Al Hilal win increases pressure on Al Nassr in title race" — match result with title implication, specific teams named
- "Ronaldo scores winner as Al Nassr beat Al Hilal" — confirmed result, named player
- "Al Ittihad sack manager after fifth consecutive defeat" — confirmed sacking

EXAMPLES OF WHAT THE READER RATES 0-1/5 (always reject):
- "Al Nassr manager Jorge Jesus targets Saudi Pro League titles" — manager talking about aims, not news
- "Al Hilal vs Al Fayha: Saudi Pro League title race Matchday 34" — match preview
- "Al Nassr vs Damac: Saudi Pro League title race implications" — match preview

CATEGORY RULE: Must name Al Hilal, Al Nassr, Al Ittihad, Al Ahli, or Saudi Pro League specifically.

SELECT maximum 6 stories. If nothing qualifies, return [].""",

'KSA': """You are the Saudi Arabia News editor for a breaking news app. The reader wants confirmed, impactful Saudi economic and government news.

EXAMPLES OF WHAT THE READER RATES 4-5/5 (always include if present):
- "Saudi Arabia non-oil trade surplus with GCC reaches SR4.47 billion" — specific economic data, confirmed figure
- "Saudi Awwal Bank signs SR6.4 billion financing agreement with AlBawani" — confirmed deal with specific figure
- "Saudi real estate transactions grow 6.8 percent to $29.85 billion in Q1" — specific confirmed data
- "PIF announces $10 billion investment in [sector]" — major investment confirmed

EXAMPLES OF WHAT THE READER RATES 0-1/5 (always reject):
- "Saudi FM discusses improving relations with New Zealand" — low-impact diplomatic meeting
- "Saudi deputy finance minister attends IMF dialogue" — attendance at meeting, not news
- "Expo 2030 Riyadh showcases delivery progress at strategic site" — vague progress update
- Any sport story
- Any Hajj or religious ceremony story
- Any tourism promotion story
- UK trade deals or general Gulf news not specific to Saudi Arabia

DUPLICATE RULE: Same economic data appearing twice — keep only one.

SELECT maximum 6 stories. Only confirmed Saudi economic, government, or major policy news with specific facts and figures.""",
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

Here are today's candidates for the """ + cat + """ section:

""" + '\n'.join(lines) + """

Your tasks:
1. Identify and reject duplicates — same event covered multiple times, keep only the best version
2. Reject anything that fails the rules above
3. Select maximum 6 stories
4. Rewrite selected titles to be direct and factual:
   - Remove clickbait: "hero", "star", "ace", "stunning", "shock", "incredible"
   - Remove trailing labels: "| The Verdict", "- Report", "- BBC Sport", "| Analysis"
   - State WHO did WHAT clearly
   - Maximum 12 words
   - Do not invent facts not in the original

Return ONLY a valid JSON array of kept stories:
[{"idx": 0, "title": "rewritten headline"}, ...]

If nothing qualifies return []. Do not include any explanation."""

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
            idx      = int(s['idx'])
            item     = dict(items[idx])
            old      = item['title']
            new      = s.get('title','').strip()
            if new and new != old:
                print("  REWRITE: " + old[:50] + " → " + new[:50])
            item['title']    = new if new else old
            item['ai_score'] = 70
            results.append(item)
        except Exception as e:
            print("  Error idx " + str(s.get('idx','?')) + ": " + str(e))
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
print("Unique after basic dedup: " + str(len(unique_new)))

print("\n" + "=" * 50)
print("STEP 3 — CLAUDE EDITORIAL REVIEW (per category)")
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
print("STEP 4 — MERGE WITH EXISTING + FINAL SELECTION")
print("=" * 50)

all_items   = basic_dedup(existing_items + approved_new)
final_items = []

for cat in CATEGORIES:
    cat_items = [i for i in all_items if i['cat'] == cat]
    cat_items.sort(key=lambda x: x.get('timestamp',0), reverse=True)
    top = cat_items[:6]
    print(cat + ": " + str(len(top)) + " stories")
    for s in top:
        print("  [" + s['date'] + "] " + s['title'][:72])
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
