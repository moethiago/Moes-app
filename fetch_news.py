import urllib.request
import xml.etree.ElementTree as ET
import json
import sys
from datetime import datetime, timezone

# 1. Configuration: Strict rulesets
# Use 'must_contain' to allow the item, and 'must_not_contain' to kill it instantly.
RULES = {
    'F1': {
        'must_contain': ['win', 'pole', 'penalty', 'crash', 'dnf', 'retire', 'contract', 'sign', 'fia', 'champion', 'ban', 'incident', 'investigation'],
        'must_not_contain': ['fantasy', 'quiz', 'preview', 'betting', 'ranking', 'how to watch']
    },
    'FOOTBALL': {
        'must_contain': ['sack', 'fired', 'resign', 'transfer', 'sign', 'injury', 'red card', 'title', 'champion', 'result', 'defeat'],
        'must_not_contain': ['fantasy', 'lineup', 'ratings', 'watch live', 'betting', 'quiz', 'power ranking', 'preview']
    },
    'BAYERN': {
        'must_contain': ['transfer', 'sign', 'injury', 'absent', 'lineup', 'contract', 'sack', 'manager', 'coach', 'official'],
        'must_not_contain': ['rumor', 'speculation', 'quiz', 'fan']
    },
    'SPL': {
        'must_contain': ['transfer', 'sign', 'sack', 'manager', 'title', 'champion', 'ban', 'result', 'win', 'ronaldo', 'neymar', 'benzema'],
        'must_not_contain': ['fan', 'blog', 'advertorial']
    },
    'KSA': {
        'must_contain': ['decree', 'royal', 'minister', 'giga', 'neom', 'vision 2030', 'pif', 'invest', 'reform', 'gdp', 'economic', 'ipo'],
        'must_not_contain': ['ceremony', 'ribbon', 'festival', 'fashion', 'tour', 'visit']
    }
}

def is_high_impact(title, cat, filt=None):
    if filt and filt.lower() not in title.lower():
        return False
    
    title_lower = title.lower()
    rules = RULES.get(cat, {})
    
    # 1. Kill if it contains any "must_not_contain" word
    for junk in rules.get('must_not_contain', []):
        if junk in title_lower:
            return False
            
    # 2. Keep ONLY if it contains at least one "must_contain" word
    # (If the category is not defined in RULES, default to True)
    if 'must_contain' in rules:
        return any(word in title_lower for word in rules['must_contain'])
        
    return True

def run_update():
    final_data = []
    # ... (Your CHANNELS list remains exactly the same as provided in your original code) ...
    # Ensure all your URLs and categories are mapped in CHANNELS above this function.

    for ch in CHANNELS:
        try:
            req = urllib.request.Request(ch['url'], headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=10) as r:
                root = ET.fromstring(r.read())
            
            channel = root.find('channel') or root
            count = 0
            for item in channel.findall('item'):
                if count >= 6: break
                title = item.findtext('title', '').strip()
                if title and is_high_impact(title, ch['cat'], ch.get('filter')):
                    final_data.append({
                        'title': title,
                        'src': ch['src'],
                        'cat': ch['cat'],
                        'link': item.findtext('link', '').strip(),
                        'date': datetime.now(timezone.utc).strftime('%b %-d')
                    })
                    count += 1
        except Exception as e:
            print(f"Skipping {ch['src']}: {e}")

    # Final Guard: Only overwrite if we found something useful
    if final_data:
        with open('js/feed_data.json', 'w') as f:
            json.dump(final_data, f, indent=2)
        print(f"Success: {len(final_data)} high-quality items written.")
    else:
        print("Filter too strict: No items passed. Skipping update.")

if __name__ == "__main__":
    run_update()