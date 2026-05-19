import urllib.request
import xml.etree.ElementTree as ET
import json
import sys
from datetime import datetime, timezone

# Configuration: Weighted scoring system
# Higher positive = more "important"
# Lower negative = "junk" or "filler"
WEIGHTS = {
    'F1': {'transfer': 3, 'official': 4, 'win': 2, 'pole': 2, 'fantasy': -5, 'quiz': -6, 'rating': -4},
    'FOOTBALL': {'transfer': 3, 'sack': 4, 'official': 4, 'title': 3, 'injury': 2, 'fantasy': -6, 'rating': -5, 'how to watch': -6},
    'BAYERN': {'official': 4, 'transfer': 3, 'squad': 2, 'injury': 2, 'rumor': -2},
    'SPL': {'ronaldo': 3, 'neymar': 3, 'transfer': 3, 'official': 4, 'result': 1, 'rumor': -3},
    'KSA': {'royal': 4, 'vision 2030': 4, 'launch': 3, 'ipo': 3, 'festival': -4, 'fashion': -4}
}

def is_high_impact(title, cat, filt=None):
    if filt and filt.lower() not in title.lower():
        return False
    
    title_lower = title.lower()
    score = 0
    category_weights = WEIGHTS.get(cat, {})
    
    # Calculate score
    for keyword, weight in category_weights.items():
        if keyword in title_lower:
            # If it's a negative keyword, multiply to ensure it kills the score
            if weight < 0:
                score += (weight * 2) 
            else:
                score += weight
    
    # "Middle Ground" Threshold:
    # We require a score of at least 3 to pass, or it's considered "noise"
    return score >= 3

def run_update():
    final_data = []
    # ... (Keep your CHANNELS list here) ...
    
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
            print(f"Skipped {ch['src']}: {e}")

    with open('js/feed_data.json', 'w') as f:
        json.dump(final_data, f, indent=2)
    print(f"Update complete. {len(final_data)} items stored.")

if __name__ == "__main__":
    run_update()