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
