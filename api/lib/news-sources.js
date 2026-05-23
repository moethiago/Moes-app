// ============================================================
// news-sources.js — RSS feeds, query lists, Claude prompts
// EDIT THIS FILE to tune the news pipeline
// ============================================================

// ============================================================
// MOE'S APP - NEWS PIPELINE v2
// Fixes: stale repeats, "6h ago" everywhere, weak filtering
// ============================================================

// ---- Hard-block phrases (case-insensitive substring match) ----
// Strengthened to catch speculation, previews, listicles, and quotes.
const REJECT_PHRASES = [
  // speculation / soft news
  'discusses','talking about','addresses','opens up','speaks out','admits',
  'reveals','insists','hopes to','aims to','targets','dreams of','wants to',
  'could','set to','in talks','linked with','rumour','rumor','speculation',
  'reportedly','allegedly','tipped to','believed to','expected to','poised',
  'eyeing','considering','hint','hints','teases','suggests','denies','dismisses',
  // listicles / opinion / preview format
  'predicted lineup','predicted line-up','player ratings','five things','5 things',
  'three things','3 things','ten things','10 things','what we learned',
  'how to watch','watch live','stream live','live blog','live updates',
  'betting odds','betting tips','best bets','prediction','predictions',
  'fantasy','power ranking','power rankings','talking points','gallery','quiz',
  'round-up','roundup','in numbers','by numbers','preview','look ahead',
  'verdict','column','opinion','analysis:','explained','explainer',
  // human interest
  'tribute','heartfelt','emotional','reacts to','reaction','responds to',
  'family','wife','girlfriend','wedding','holiday',
];

function preFilter(title) {
  if (!title || title.length < 12) return false;
  const lower = title.toLowerCase();
  for (let i = 0; i < REJECT_PHRASES.length; i++) {
    if (lower.includes(REJECT_PHRASES[i])) return false;
  }
  return true;
}

// ---- RSS sources (trimmed - removed the worst speculation farms) ----
const RSS_SOURCES = [
  { url:'https://www.formula1.com/en/latest/all.xml',                               cat:'F1' },
  { url:'https://feeds.bbci.co.uk/sport/formula1/rss.xml',                          cat:'F1' },
  { url:'https://www.autosport.com/rss/f1/news/',                                   cat:'F1' },
  { url:'https://www.motorsport.com/rss/f1/news/',                                  cat:'F1' },
  { url:'https://racefans.net/feed/',                                               cat:'F1' },
  { url:'https://www.skysports.com/rss/12433',                                      cat:'F1' },
  { url:'https://www.reddit.com/r/formula1/top/.rss?sort=top&t=day&limit=10',       cat:'F1' },

  { url:'https://feeds.bbci.co.uk/sport/football/rss.xml',                          cat:'FOOTBALL' },
  { url:'https://www.theguardian.com/football/premierleague/rss',                   cat:'FOOTBALL' },
  { url:'https://www.theguardian.com/football/laliga/rss',                          cat:'FOOTBALL' },
  { url:'https://www.theguardian.com/football/serieafootball/rss',                  cat:'FOOTBALL' },
  { url:'https://www.theguardian.com/football/bundesligafootball/rss',              cat:'FOOTBALL' },
  { url:'https://www.theguardian.com/football/ligue1football/rss',                  cat:'FOOTBALL' },
  { url:'https://www.skysports.com/rss/11095',                                      cat:'FOOTBALL' },
  { url:'https://www.reddit.com/r/soccer/top/.rss?sort=top&t=day&limit=10',         cat:'FOOTBALL' },

  { url:'https://www.bundesliga.com/rss/en/rss-news.rss',                           cat:'BAYERN' },
  { url:'https://www.theguardian.com/football/bundesligafootball/rss',              cat:'BAYERN' },
  { url:'https://www.reddit.com/r/bayernmunich/top/.rss?sort=top&t=day&limit=10',   cat:'BAYERN' },

  { url:'https://www.arabnews.com/cat/5/rss.xml',                                   cat:'SPL' },
  { url:'https://saudigazette.com.sa/rssFeed/74',                                   cat:'SPL' },
  { url:'https://www.reddit.com/r/saudifootball/top/.rss?sort=top&t=day&limit=10',  cat:'SPL' },

  { url:'https://www.arabnews.com/rss.xml',                                         cat:'KSA' },
  { url:'https://www.arabnews.com/economy/rss.xml',                                 cat:'KSA' },
  { url:'https://en.majalla.com/rss.xml',                                           cat:'KSA' },
  { url:'https://feeds.bbci.co.uk/news/world/middle_east/rss.xml',                  cat:'KSA' },
];

const GOOGLE_NEWS_SOURCES = [
  { url:'https://news.google.com/rss/search?q=formula+1+breaking+when:1d&hl=en-US&gl=US&ceid=US:en',                              cat:'F1' },
  { url:'https://news.google.com/rss/search?q=f1+grand+prix+2026+when:1d&hl=en-US&gl=US&ceid=US:en',                              cat:'F1' },
  { url:'https://news.google.com/rss/search?q=premier+league+OR+laliga+transfer+OR+sacked+when:1d&hl=en-US&gl=US&ceid=US:en',     cat:'FOOTBALL' },
  { url:'https://news.google.com/rss/search?q=champions+league+2026+when:1d&hl=en-US&gl=US&ceid=US:en',                           cat:'FOOTBALL' },
  { url:'https://news.google.com/rss/search?q=bayern+munich+when:1d&hl=en-US&gl=US&ceid=US:en',                                   cat:'BAYERN' },
  { url:'https://news.google.com/rss/search?q=al+hilal+OR+al+nassr+OR+saudi+pro+league+when:1d&hl=en-US&gl=US&ceid=US:en',        cat:'SPL' },
  { url:'https://news.google.com/rss/search?q=saudi+arabia+economy+OR+pif+when:1d&hl=en-US&gl=US&ceid=US:en',                     cat:'KSA' },
];

const GDELT_QUERIES = [
  { query:'formula 1 race',                                          cat:'F1' },
  { query:'premier league OR laliga transfer sacked',                cat:'FOOTBALL' },
  { query:'bayern munich',                                           cat:'BAYERN' },
  { query:'al hilal OR al nassr',                                    cat:'SPL' },
  { query:'saudi arabia economy billion',                            cat:'KSA' },
];

const NEWSDATA_QUERIES = [
  { query:'formula 1',             cat:'F1',       language:'en' },
  { query:'football transfer',     cat:'FOOTBALL', language:'en' },
  { query:'bayern munich',         cat:'BAYERN',   language:'en' },
  { query:'saudi pro league',      cat:'SPL',      language:'en' },
  { query:'saudi arabia economy',  cat:'KSA',      language:'en' },
];

const TWITTER_QUERIES = [
  { query:'find tweets from the last 12 hours about F1 confirmed breaking news with high engagement', cat:'F1' },
  { query:'find tweets from the last 12 hours about confirmed football transfers or sackings with high engagement', cat:'FOOTBALL' },
  { query:'find tweets from the last 12 hours about Bayern Munich confirmed news with high engagement', cat:'BAYERN' },
  { query:'find tweets from the last 12 hours about Saudi Pro League confirmed news with high engagement', cat:'SPL' },
  { query:'find tweets from the last 12 hours about Saudi Arabia confirmed economic news with high engagement', cat:'KSA' },
];

const WEB_SEARCH_QUERIES = [
  { query:'F1 2026 latest confirmed news today',                                            cat:'F1' },
  { query:'Premier League OR La Liga OR Serie A confirmed transfer OR manager sacked today', cat:'FOOTBALL' },
  { query:'Bayern Munich latest official news today',                                       cat:'BAYERN' },
  { query:'Al Hilal OR Al Nassr Saudi Pro League official news today',                      cat:'SPL' },
  { query:'Saudi Arabia PIF OR Vision 2030 announcement today billion',                     cat:'KSA' },
];

// ---- Category prompts: stricter recency & verification ----
const CAT_PROMPTS = {
  F1: `You are the F1 editor for a breaking-news app. Today is ${new Date().toUTCString()}.
SCORE each candidate 0-10 based on SPECIFICITY and CONFIRMED FACT:
10 = confirmed driver signing/sacking with team named, race result, FIA penalty issued
8-9 = confirmed contract extension with name, team principal change, factory news with figures
7   = official team announcement with concrete impact
0-6 = REJECT: quotes, opinions, "could", "set to", previews, technical analyses, fan speculation

DUPLICATE RULE: For the same underlying event, KEEP ONLY ONE (clearest, most specific) version.
RECENCY RULE: Only stories about something that HAPPENED in the last 24 hours. Reject anything sounding old.
Return ONLY stories scoring 7 or above.
Return JSON: [{"idx":0,"title":"rewritten headline max 12 words","score":9}]
Return [] if nothing scores 7+.`,

  FOOTBALL: `You are the Football editor for a breaking-news app. Today is ${new Date().toUTCString()}.
Top 5 leagues + Champions League ONLY. SCORE each 0-10:
10 = title won, confirmed sacking of major manager, confirmed transfer WITH fee
8-9 = confirmed transfer with player name AND club, club banned/expelled, decisive cup tie result
7   = confirmed managerial appointment with named club
0-6 = REJECT: quotes, "linked", "could", opinions, player ratings, previews, World Cup squad speculation

DUPLICATE RULE: Same player or event = keep ONE clearest version.
RECENCY RULE: Only news from the last 24 hours. Reject anything that sounds old or recycled.
Return ONLY stories scoring 7+.
Return JSON: [{"idx":0,"title":"rewritten headline max 12 words","score":9}]
Return [] if nothing scores 7+.`,

  BAYERN: `You are the Bayern Munich editor. MUST be specifically about FC Bayern Munich men's first team. Today is ${new Date().toUTCString()}.
SCORE 0-10:
10 = confirmed transfer with fee, manager sacked/appointed
8-9 = confirmed injury with timeline, major match result with title implication
7   = official Bayern statement with concrete content
0-6 = REJECT: quotes, women's team, U19/youth, Germany national team, "linked" rumours, previews

RECENCY: Last 24h only.
DUPLICATE: Same event = ONE version only.
Return JSON: [{"idx":0,"title":"rewritten headline max 12 words","score":9}]
Return [] if nothing qualifies.`,

  SPL: `You are the Saudi Pro League editor. Today is ${new Date().toUTCString()}.
SCORE 0-10:
10 = title clinched, confirmed signing of a major name
8-9 = match result with title-race impact naming Al Hilal/Al Nassr/Al Ittihad/Al Ahli, confirmed sacking
7   = confirmed squad news with specific named player
0-6 = REJECT: manager quotes, previews, stories not naming a specific SPL team

RECENCY: Last 24h only.
DUPLICATE: Same event = ONE version only.
Return JSON: [{"idx":0,"title":"rewritten headline max 12 words","score":9}]
Return [] if nothing qualifies.`,

  KSA: `You are the Saudi Arabia News editor. Focus: economy, PIF, Vision 2030, royal decrees with impact. Today is ${new Date().toUTCString()}.
SCORE 0-10:
10 = confirmed multi-billion-dollar deal with specific figures, major royal decree with economic impact
8-9 = PIF announcement with specific numbers, Vision 2030 milestone with data
7   = confirmed economic statistic or announcement with numbers
0-6 = REJECT: diplomatic visits without outcome, Hajj/religious, tourism without dollar figures, aid stories, anything without specific confirmed numbers

RECENCY: Last 24h only.
DUPLICATE: Same data point = ONE version only.
Return JSON: [{"idx":0,"title":"rewritten headline max 12 words","score":9}]
Return [] if nothing qualifies.`,
};

