import urllib.request
import xml.etree.ElementTree as ET
import re
import json
import sys
from datetime import datetime, timezone

# 1. Configuration: Weighted scoring system
# Keywords with positive values increase the chance of showing
# Keywords with negative values decrease the chance (noise reduction)
WEIGHTS = {
    'F1': {'transfer': 2, 'win': 2, 'pole': 2, 'crash': 1, 'official': 3, 'fantasy': -3, 'quiz': -3},
    'FOOTBALL': {'transfer': 2, 'sack': 3, 'official': 3, 'win': 1, 'loss': 1, 'fantasy': -3, 'rating': -2, 'how to watch': -3},
    'BAYERN': {'official': 3, 'transfer': 2, 'injury': 1, 'lineup': 1, 'rumor': -1},
    'SPL': {'ronaldo': 2, 'neymar': 2, 'transfer': 2, 'official': 3, 'result': 1},
    'KSA': {'royal': 3, 'vision 2030': 3, 'launch': 2, 'ipo': 2, 'festival': -2, 'fashion': -2}
}

def get_score(title, cat):
    title_lower = title.lower()
    score = 0
    # Calculate score based on keyword presence
    for keyword, weight in WEIGHTS.get(cat, {}).items():
        if keyword in title_lower:
            score += weight
    return score

def is_high_impact(title, cat, filt=None):
    if filt and filt.lower() not in title.lower(): 
        return False
    
    # "Middle Ground" Logic:
    # 1. If it has a negative score, it's likely junk.
    # 2. If it has a score of 0, it's neutral (we'll ignore it to stay clean).
    # 3. If it has a score > 0, it's relevant enough.
    return get_score(title, cat) > 0

# ... (Keep your CHANNELS list the same as before) ...

def run_update():
    final_data = []
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
                
                # Apply the new scoring filter
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
            print(f"Skipped {ch['src']}: {e}")

    with open('js/feed_data.json', 'w') as f:
        json.dump(final_data, f, indent=2)
    print(f"Update complete. {len(final_data)} items processed.")

if __name__ == "__main__":
    run_update()