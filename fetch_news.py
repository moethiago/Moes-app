import re, sys, time
from datetime import datetime, timezone, timedelta
import fetch_f1, fetch_football, fetch_bayern, fetch_spl, fetch_ksa

MAX_AGE   = timedelta(days=7)
MIN_SCORE = 2
NOW       = datetime.now(timezone.utc)

all_items = []
all_items += fetch_f1.fetch(MAX_AGE, NOW, MIN_SCORE)
all_items += fetch_football.fetch(MAX_AGE, NOW, MIN_SCORE)
all_items += fetch_bayern.fetch(MAX_AGE, NOW, MIN_SCORE)
all_items += fetch_spl.fetch(MAX_AGE, NOW, MIN_SCORE)
all_items += fetch_ksa.fetch(MAX_AGE, NOW, MIN_SCORE)

if not all_items:
    print("No items - skipping")
    sys.exit(0)

all_items.sort(key=lambda x: x['dt'], reverse=True)

lines = []
for i in all_items:
    lines.append("  {title:'%s',src:'%s',cat:'%s',link:'%s',date:'%s'}" % (
        i['title'], i['src'], i['cat'], i['link'], i['date']))

new_block = "var FALLBACK_NEWS = [\n" + ",\n".join(lines) + "\n];"

with open('js/feed.js','r') as f:
    content = f.read()

updated = re.sub(
    r'// DO NOT EDIT BELOW THIS LINE\nvar FALLBACK_NEWS = \[.*?\];\n// DO NOT EDIT ABOVE THIS LINE',
    '// DO NOT EDIT BELOW THIS LINE\n' + new_block + '\n// DO NOT EDIT ABOVE THIS LINE',
    content, flags=re.DOTALL
)

if updated == content:
    print("Marker not found - skipping")
    sys.exit(0)

with open('js/feed.js','w') as f:
    f.write(updated)

# Cache bust — update version in index.html so browser always fetches fresh feed.js
version = str(int(time.time()))
with open('index.html','r') as f:
    html = f.read()

html_updated = re.sub(
    r'<script src="js/feed\.js(\?v=[0-9]+)?">',
    '<script src="js/feed.js?v=' + version + '">',
    html
)

with open('index.html','w') as f:
    f.write(html_updated)

print("Done: " + str(len(all_items)) + " stories written to js/feed.js")
print("Cache bust: feed.js?v=" + version)
