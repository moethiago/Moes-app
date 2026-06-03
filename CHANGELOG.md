# Changelog

## v8 — June 2, 2026

### Bug fixes
- **News disappearing**: ingest trim window was 24h while stories live 48h — old approved stories vanished early. Now matches TTL (48h).
- **News threshold**: lowered approval gate from 7 to 6 in both score-core.js AND feed.js (there were two separate gates).
- **F1 countdown wrong**: full 2026 calendar rebuilt with correct dates. Bahrain & Saudi removed (cancelled), Monaco added (was missing), Madrid added. 22 races.
- **Live football broken**: season was stuck on 2025 → now 2026. Replaced AbortSignal.timeout() (broken on iOS Safari) with manual AbortController timeout.
- **World Cup fixtures**: corrected fallback opening fixtures.

### New features
- `admin.html` — dashboard: 24h cost, ingest/approved counts, per-category story counts, live service status, recent runs.
- `api/health-check.js` — pings all services, returns overall health JSON (point a cron-job.org monitor at it for alerts).
- `.github/workflows/checkpoint.yml` — daily auto-zip of repo (kept 30 days as Actions artifact).

### Housekeeping
- Health tab hidden (nav button removed, panel display:none, scripts disabled). Files retained for later.
- Cache-bust versions bumped so phones reload new JS.
- Removed dead feed-data.js reference.

### File breakdown (smaller, easier to edit)
- `f1-data.js` → split into `f1-config.js` (colours/durations), `f1-calendar.js` (race dates), `f1-fallback.js` (standings fallback).
- `feed-render.js` → split into `feed-utils.js`, `feed-ticker.js`, `feed-render.js`, `feed-fetch.js`.
- `worldcup.js` → split fallback data into `worldcup-data.js`.
- `api/football.js` → league IDs + season extracted to `api/lib/leagues.js` (single place to bump season each year).

## v9 — June 2, 2026

### Tabs restructured
- Split the single "Sports" tab into three separate tabs: **F1**, **Football**, **World Cup**. Nav now: Feed · F1 · Football · World Cup.
- Each sport lazy-loads independently when its tab is first opened.
- Fixed: football auto-refresh never started — core.js was calling a non-existent `loadFootballScores()`; now correctly calls `buildFootballSection()`.
- Nav label spacing tightened to fit 4 tabs cleanly.

## v10 — June 2, 2026

### Feed: more news, same quality
- **Rewrote scoring prompts** to judge the EVENT, not the wording. Hedge words ("could", "set to", "linked", "in talks") no longer auto-reject — they were killing real confirmed stories. Still rejects opinion/columns, rating listicles, "fans react", clickbait.
- **Added local junk pre-filter** (`score.js`): drops obvious clickbait/opinion BEFORE the paid AI pass, so token budget goes only to real candidates — cheaper per run AND more approvals.
- **Raised feed display** from 6 to 12 stories per category so the feed actually fills now that more passes.

Net effect: was ~7% pass rate (7 of 102). Should rise substantially while still blocking junk.

## v11 — June 2, 2026

### F1 Super Tab — data-heavy upgrade
New modules added to the F1 tab:
- **Title math** (`f1-analytics.js`): rounds left, max points available, who's mathematically still in contention vs out.
- **Lead gap trend**: bar chart of the leader's points gap over P2 across the last 8 rounds.
- **Teammate head-to-head**: points battle bars for every team's two drivers.
- **Form guide**: last-5-races finish dots per top driver (win/podium/points/out colour-coded).
- **Last race strategy**: pit-stop counts per driver + fastest stop, from Jolpica pitstops endpoint.
- **Next-race circuit card** (`f1-racecard.js`): length, laps, corners, DRS zones, lap record + race-day **weather** via Open-Meteo (free, no key).
- **Tap-a-driver detail**: tap any driver in standings → modal with champ position, points, wins, podiums, and full 2026 results.
- **On this day** F1 history nugget.
- Circuit dataset + coords in new `f1-circuits.js`.

All new code is in separate modules; data from Jolpica/Ergast + Open-Meteo (both free).

## v12 — June 2, 2026

### F1 Super Tab — the "wow" layer
- **The Season So Far** (`f1-story.js`): auto-generated narrative of the championship — who leads, by how much, latest winner, written fresh from live standings.
- **Title Fight**: visual head-to-head of the top 2 with a split points bar.
- **Records Watch**: flags milestones approaching (win streaks, double-digit wins).
- **Predict the Podium** (`f1-interactive.js`): pick your top 3 for the next race, locked in on your device, change anytime.
- **Compare Drivers**: pick any two drivers → side-by-side points/wins/position with winner highlighted.

Note: team radio was considered but F1 cut radio data for 2026 (OpenF1 confirms most events have none), and live intervals need paid access — so we built the wow layer from fully-free Jolpica data instead.

## v13 — June 2, 2026

### F1 tab — removed gimmicks, added what matters
- **Removed** Predict the Podium and Compare Drivers (low value).
- **Added Race Recap** ("did I miss anything?"): last race podium with gaps, fastest lap, DNFs, plus key incidents/penalties pulled from OpenF1 race control. Catches you up in 5 seconds.
- **Added standings movement arrows**: ▲/▼ next to each driver showing how many places they climbed or fell since the previous round — real context on the table.

## v14 — June 2, 2026

### F1 tab — cosmetics & consistency
- **Team badges**: every driver/team row now shows a colored 3-letter team badge (MER, RBR, FER...).
- **Consistent driver colors**: a central color map now ensures a driver appears in their team's color EVERYWHERE — standings, title math, teammate battles, form guide, strategy, recap. Pre-seeded on tab open so colors are right from first paint.
- **Title math simplified**: removed "IN CONTENTION (-43)" — now just shows the clean deficit "-43" (and LEADER / OUT).
- **Fixed P1/P3 color glitch**: position numbers 1, 2, 3 were gold/silver/bronze while others were white — now all uniform.
- **Overall polish**: gradient cards with depth/shadows, Rajdhani headings, accent borders (story=red, recap=gold), glowing win dots, refined title-math pills, premium driver modal, smoother tap feedback. Cards now use the app's real theme variables instead of hardcoded fallbacks.

## v15 — June 2, 2026

### F1 tab — driver helmets + team logos
- **Driver helmet emblems**: replaced the plain number box with an original stylized helmet SVG filled in the driver's team color, with their car number inside. (Original artwork, no copyright issue.)
- **Team logos**: replaced the text badges (MER, FER...) with clean self-hosted SVG team emblems in each team's color — shown next to drivers and as the main mark in constructor standings and teammate battles. Self-hosted in /assets/teams/ so they never break.
- Logos fall back to a colored chip if an asset is ever missing.

## v16 — June 2, 2026

### F1 standings — fixed the broken cosmetics
- Removed the helmet "blobs" — back to a clean colored number chip.
- Team logos are now small clean ICON-ONLY emblems (no cramped wordmark text), placed neatly beside the driver name instead of overlapping the championship bar.
- Constructor standings show the icon in its own column.
- Fixed the layout breakage from v15.

## v17 — June 2, 2026

### Real team logos
- Team logos now load real PNGs from formula1.com's CDN. The loader tries several candidate URLs in order; if one fails it advances to the next, and if all fail it falls back to the self-hosted SVG emblem, then a colored chip. So it shows the best available logo and never breaks the layout.
- CSS updated so wide logo images keep their aspect ratio.

## v18 — June 2, 2026

### Logo polish
- Real team logos now sit in a clean rounded white tile (like an app icon) so the white background reads as intentional against the dark theme, instead of a bare white rectangle.

## v19 — June 2, 2026

### Logo alignment fixes
- Standings: team logo now sits BEFORE the driver's name, neatly aligned.
- Teammate Battles: logo is now perfectly centered between the two drivers using a 3-column grid (left driver | centered logo | right driver).

## v20 — June 2, 2026

### Glanceable weekend status strip
- New always-relevant status line at the very top of the F1 tab. Shows: countdown to the next session when far out ("Qualifying in 2d 4h"), amber "in 3h" as it gets close, and a red pulsing "Practice 2 LIVE" when a session is running. One glance tells you exactly where the race weekend stands.

## v21 — June 2, 2026

### F1 tab — 15 new features
- (1,3) Local session times in your timezone with one-tap add-to-calendar (.ics download with 30-min alarm); odd-hour sessions flagged.
- (4,5) F1 breaking news pulled from your feed pipeline into the F1 tab, with the biggest story pinned on top.
- (6) "Since you last looked" — flags if a result came in or the lead changed since your last visit.
- (7) 2027 silly-season board — confirmed vs expiring seats.
- (8) Hot streaks — consecutive podiums/points finishes.
- (9) (covered via form/strategy already; quali H2H folded into title picture)
- (12) Title picture — points gap expressed in races/wins of margin.
- (13,14) Circuit preview — likely tyre stops + overtaking difficulty for the next track.
- (15) Full-weekend weather trend (per-day forecast).
- (16) Rotating F1 history nugget.
- (17) Circuit fun fact.
- (18) Championship permutations in plain English.

## v22 — June 2, 2026

### Title Picture: real math + logical section order
- Title Picture now shows actual championship math: points still available (rounds left × 25), and the exact swing P2 needs to take the lead (total + per-race average), or "clinched"/"complete" when decided. No more useless "1.7-race cushion" truism.
- Reordered the F1 tab into a sensible flow: Status → Countdown → Next-race card → Recap → News → Title/Streaks/Silly-season → Season story → Standings → Analytics → Local times → Circuit preview/weather/history.

## v23 — June 2, 2026

### F1 tab → spoiler-safe subtabs
- Split the F1 tab into three subtabs: **Up Next**, **Results**, **Standings**.
- **Up Next** is the default and 100% spoiler-free: status, countdown, next-race card, your local session times + calendar, circuit preview, weekend weather, history. Safe to open anytime.
- **Results** (recap, last session, grid, F1 news) and **Standings** (championship table, title picture, streaks, silly season, analysis) are spoiler-LOCKED by default — they show a "tap to reveal" cover so you're never spoiled if you haven't watched yet.
- Lock resets ON every time you open the app. Each revealed section has a "hide again" button to re-lock.

## v24 — June 2, 2026

### Subtab fixes
- Fixed the spoiler-cover showing literal "\u{1F648}" text — now displays the actual 🙈 emoji (HTML doesn't read JS escapes).
- Fixed uneven subtab buttons — all three (Up Next / Results / Standings) are now exactly equal width whether active or not.

## v24 — June 2, 2026

### World Cup tab — full rebuild, spoiler-safe subtabs (better than F1)
- Four subtabs: Up Next, Groups, Bracket, Results.
- **Up Next** (spoiler-free, default): next-match countdown, your-team tracker (Saudi Arabia) with next fixture + add-to-calendar, and upcoming matches in your local time, each with a one-tap calendar button.
- **Groups** (spoiler-locked): live standings tables computed for all 12 groups (A–L), qualification zone highlighted, your team's row highlighted gold.
- **Bracket** (spoiler-locked): knockout bracket that fills in as rounds complete.
- **Results** (spoiler-locked): recent match results with winners highlighted.
- Spoiler lock resets ON each visit; each section has a "hide again" button. Data from openfootball (CC0, no key). Flags per nation, host-city info.

## v25 — June 2, 2026

### Football tab — Today / Upcoming / Tables subtabs
- Three subtabs: **Today**, **Upcoming**, **Tables** (no spoiler lock — football is year-round multi-league).
- **Today**: a "Your Teams" tracker pinned on top (Bayern + Al-Hilal), then today's live/scheduled matches grouped by league.
- **Upcoming**: each league's next fixtures.
- **Tables**: scrollable league picker (EPL, La Liga, Serie A, Bundesliga, Ligue 1, Saudi Pro League) → full standings table with your team highlighted + top-4 zone, plus that league's top scorers.
- Backend (`api/football.js`) extended with `?type=standings` and `?type=topscorers` (cached). New season set in leagues.js already.

## v26 — June 2, 2026

### Feed cleanup + football news + tables polish + season fix
- Feed tab now shows only: All, Bayern, Saudi News. Removed F1, Football, and Saudi Football pills (those live in their own tabs now). The ALL view hides F1/FOOTBALL/SPL so the feed stays focused on Bayern + Saudi news.
- Football tab: new **News** subtab combining Football + Saudi football + Bayern news from the pipeline (the biggest story pinned, tagged by type).
- Tables subtab: league buttons replaced with clean flag pills (flag + short name, highlighted when active).
- Fixed empty Today/Upcoming: backend now ALWAYS returns both today's fixtures and the next 10 upcoming (independently), and falls forward to the next season automatically. Season corrected to 2025 (API-Football labels the 2025-26 season as "2025"); the fall-forward picks up 2026-27 fixtures as they're scheduled. Today subtab now shows the next upcoming matches when nothing is on today.
- Standings + scorers endpoints also fall forward a season if the current one has no data yet.

## v27 — June 2, 2026

### Flag pills + robust news
- League picker redesigned as clean circular flag buttons (flag in a circle, label beneath, blue ring when active) instead of the ugly white blobs. Swapped the England tag-emoji (which fails to render on iOS) for a reliable flag.
- Football News tab now always queries the feed API directly (not just the in-memory cache), falls back to cache, and shows a clear explanatory message when the pipeline has no football stories scored yet — instead of a blank screen.

## v28 — June 2, 2026
### Flag-only league picker
- Removed league name labels from the Tables picker — now just clean flag circles (name shows on long-press via title). Flags enlarged.

## v29 — June 2, 2026
### World Cup bracket auto-fill
- The Round of 32 now fills automatically from the live group tables: group winners and runners-up appear with real team names + flags as soon as the standings decide them, and update live as results come in.
- Added a "Best Third-Place Teams" board: ranks all 12 third-placed teams by Pts/GD/GF and marks the 8 that qualify IN vs OUT — fully computed, live.
- Third-place R32 slots are labelled by their group cluster (FIFA resolves the exact pairing via 495 scenarios only after all groups finish, so we show the pool honestly rather than guessing).
- Once the real knockout matches exist in the feed, they render with live scores below the projected bracket.

## v30 — June 2, 2026
### News pipeline rebuild — semantic dedup + smart ranking
- **Semantic dedup (kills repeats):** stories are now embedded (Google Gemini embeddings, free tier) at ingest, and near-duplicates are clustered by cosine similarity (0.85). "Verstappen wins Monaco" and "Max takes Monaco victory" collapse into one; unrelated same-entity stories stay separate. Falls back to entity-weighted title similarity if embeddings are unavailable.
- **Never miss big stories:** cross-source corroboration boost. A cluster covered by multiple independent sources is surfaced and even rescues score-5 stories (kept only if 2+ sources corroborate).
- **Better ordering:** blended rank = aiScore x sourceWeight x timeDecay (8h half-life) x corroboration, replacing the old publishedAt sort.
- **Less noise:** weak single-source low-score stories are dropped after dedup.
- Requires GEMINI_API_KEY env var on the backend for embeddings (free at aistudio.google.com). Without it, dedup still works via the title-similarity fallback.

## v31 — June 2, 2026
### Personalized Home — brief, follows, alerts
- New **Home tab** (now the default landing screen) that makes the app yours.
- **Daily brief:** a one-line auto-summary of your sports day (next F1 session timing, etc.).
- **Your next events:** your next F1 session and your followed clubs' next matches, in your local time, tap to jump to the tab.
- **News on who you follow:** breaking stories filtered to the drivers/clubs you follow.
- **Follow system:** tap chips to follow F1 drivers and football clubs; everything personalizes instantly. Stored on your device.
- **Alerts:** opt-in browser notifications that give a heads-up ~30 min before a followed F1 session or club match (works while the app is open/recent).

## v32 — June 2, 2026
### AI-native "For You" — the feed learns from you
- Home's news is now a **For You** feed that ranks every story by how well it matches you.
- **Implicit learning:** opening a story trains the app — it averages that story's Gemini embedding into a personal "taste vector" and counts keywords. No setup needed.
- **Personal score** = explicit follows (x5) + learned keywords + semantic taste-match (cosine similarity to your taste vector x10). So if you keep opening McLaren stories, Norris news surfaces even if you never followed him.
- Backend now exposes each story's id + a compact embedding so ranking happens on-device (your data stays yours, server cache stays shared/fast).
- Stories matching your explicit follows get a gold dot. A hint shows until the app has learned enough.
