import re

file_path = "js/feed.js"

new_block = """var FALLBACK_NEWS = [
  {title:'TEST STORY 1',src:'SYSTEM',cat:'TEST',link:'#',date:'NOW'},
  {title:'TEST STORY 2',src:'SYSTEM',cat:'TEST',link:'#',date:'NOW'}
];"""

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

pattern = r'var FALLBACK_NEWS = \[.*?\];'

updated = re.sub(
    pattern,
    new_block,
    content,
    flags=re.DOTALL
)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(updated)

print("feed.js overwritten successfully")