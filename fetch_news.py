import urllib.request, xml.etree.ElementTree as ET, re, sys
from datetime import datetime, timezone, timedelta
from email.utils import parsedate_to_datetime

MAX_AGE = timedelta(days=7)
NOW = datetime.now(timezone.utc)
MIN_SCORE = 3  # minimum score to be included

# ── SOURCES PER CATEGORY ────────────────────────────────

F1_SOURCES = [
  {'url':'https://feeds.bbci.co.uk/sport/formula1/rss.xml', 'src':'BBC F1'},
  {'url':'https://www.autosport.com/rss/f1/news/',           'src':'Autosport'},
]

FOOTBALL_SOURCES = [
  {'url':'https://feeds.bbci.co.uk/sport/football/rss.xml',             'src':'BBC Sport'},
  {'url':'https://www.theguardian.com/football/premierleague/rss',      'src':'Guardian PL'},
  {'url':'https://www.theguardian.com/football/serieafootball/rss',     'src':'Guardian Serie A'},
  {'url':'https://www.theguardian.com/football/bundesligafootball/rss', 'src':'Guardian Bund'},
  {'url':'https://www.theguardian.com/football/ligue1football/rss',     'src':'Guardian L1'},
  {'url':'https://www.skysports.com/rss/11095',                         'src':'Sky Sports'},
]

BAYERN_SOURCES = [
  {'url':'https://www.theguardian.com/football/bundesligafootball/rss', 'src':'Guardian Bund'},
  {'url':'https://feeds.bbci.co.uk/sport/football/rss.xml',             'src':'BBC Sport'},
  {'url':'https://www.skysports.com/rss/11095',                         'src':'Sky Sports'},
]

SPL_SOURCES = [
  {'url':'https://www.arabnews.com/cat/5/rss.xml',          'src':'Arab News Sport'},
  {'url':'https://saudigazette.com.sa/rssFeed/74',           'src':'Saudi Gazette'},
]

KSA_SOURCES = [
  {'url':'https://www.arabnews.com/rss.xml',                'src':'Arab News'},
  {'url':'https://saudigazette.com.sa/rssFeed/74',           'src':'Saudi Gazette'},
]

# ── SCORING SIGNALS ─────────────────────────────────────

# F1 scoring
F1_HIGH   = re.compile(r'win(s|ner)?|pole position|penalt|crash|dnf|disqualif|retire|fia ruling|champion|ban(ned)?|contract|transfer|sign(ed|ing)?|incident|investigat|collision|grid penalty|power unit failure', re.I)
F1_MED    = re.compile(r'fastest lap|overtake|strategy|upgrade|announce|confirm|title fight|standings', re.I)
F1_JUNK   = re.compile(r'motogp|indycar|nascar|wrc|rally|superbike|isle of man|rugby|cricket|tennis|golf|boxing|football|soccer|petition|q&a|how gm|cadillac|preview.*practice|practice.*preview', re.I)
F1_MUST   = re.compile(r'f1|formula 1|formula one|grand prix|\bgp\b|verstappen|hamilton|norris|leclerc|russell|antonelli|piastri|alonso|sainz|perez|mclaren|ferrari|mercedes|red bull|alpine|williams|aston martin|haas', re.I)

# Football scoring
FB_HIGH   = re.compile(r'sack(ed)?|fired|resign|transfer|sign(ed|ing)?|injur|suspend|ban(ned)?|red card|\btitle\b|champion|relegat|playoff|expel|manag.*leav|leav.*manag', re.I)
FB_MED    = re.compile(r'\bwin(s)?\b|\bloss\b|defeat|derb|final|match report|contract|announce|confirm', re.I)
FB_JUNK   = re.compile(r'fantasy|predicted lineup|five things|player ratings|watch live|how to watch|betting odds|quiz|power ranking|player of the|talking points|gallery|ranked|darts|cricket|rugby|tennis|golf|boxing|petition|key moments|tiktok|boats|fire and', re.I)
FB_MUST   = re.compile(r'arsenal|man city|liverpool|chelsea|tottenham|united|newcastle|real madrid|barcelona|atletico|juventus|inter|milan|napoli|psg|dortmund|leverkusen|bayern|sevilla|villarreal|lyon|marseille|premier league|la liga|serie a|bundesliga|ligue 1|champions league|europa league', re.I)

# Bayern scoring
BAY_HIGH  = re.compile(r'transfer|sign(ed|ing)?|injur|miss(es|ing)?|ban|suspend|sack(ed)?|contract|announce|confirm|champion|title', re.I)
BAY_MED   = re.compile(r'squad|lineup|training|return|comeback|target|interest|negotiat|offer|deal', re.I)
BAY_JUNK  = re.compile(r'women|youth​​​​​​​​​​​​​​​​
