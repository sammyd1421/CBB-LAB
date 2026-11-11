# CBB LAB

Mobile-first men's NCAA Division I college basketball analytics workspace. The product roadmap starts with historical team/matchup similarity, then team profiles, game projections, and rigorous betting-market backtesting.

## Product scope
- Five completed seasons: 2021-22 through 2025-26, plus the 2026-27 season as it progresses.
- Team markets first: spreads, game totals, and team totals. Player props are out of scope for the first build.
- Historical Similarity Lab, Team Explorer, Game Model, System Finder/Backtesting, Season Simulator, and later line-movement/Monte Carlo tools.
- Free-first architecture. Do not add paid APIs, databases, or hosting without explicit approval.

## Current site status
The deployed site is a static front-end foundation. It supports CSV import/export and browser-local storage. It is not yet populated with a verified multi-season dataset, and the current score-average projection is only a baseline—not a betting model.

## Primary data source: CollegeBasketballData (CBBD)
CBBD is the preferred first source because its public API covers games, box scores, team season stats, adjusted ratings, and betting lines. Its documentation says the CFBD/CBBD APIs use the same API key. Existing CollegeFootballData credentials can therefore authenticate to the basketball API; no separate basketball key is required.

Important free-tier constraints:
- Free keys include 1,000 API calls per month shared between football and basketball.
- Game lists and team box-score endpoints return at most 3,000 records per request. Use date/team/conference filters and bulk requests rather than one request per team.
- Coverage is not the same as completeness. Empty or missing values must remain NULL, not be converted to zero.
- Games are available well before 2021; team box scores are broadly available from 2005; adjusted efficiency begins in 2014; betting lines begin in 2013. Provider, opening/closing line and market coverage varies by game.

Season IDs use the ending year: 2022 = 2021-22, 2026 = 2025-26, and 2027 = 2026-27.

## Data engineering rules
1. Keep one canonical game row per source game ID.
2. Keep one game-team-stat row per team per game; never store both teams' stats in one ambiguous row.
3. Keep team-season aggregates separate from game box scores.
4. Preserve sportsbook/provider and timestamp for every odds observation. Never blend books or infer a missing closing line.
5. Record source, import time, counts and coverage for each dataset/season.
6. Backtests must use only information available before the game being predicted. Use chronological train/validation/test splits.
7. Keep all API credentials server-side in Vercel environment variables. Never put keys in browser JavaScript, CSV exports, Git commits, or public responses.

## Server-side data access
`api/cbbd.js` is a same-origin Vercel Function proxy for the CBBD `/games` and `/games/teams` endpoints. It allowlists resources and query parameters and reads `CBBD_API_KEY` only from the server environment. The browser never receives the bearer key. The proxy returns a clear setup error until the key is configured in Vercel.

Before using live API data, add the existing CFBD/CBBD bearer key in Vercel Project Settings → Environment Variables as `CBBD_API_KEY` for Production (and Preview if desired), then redeploy. Do not paste the key into chat, GitHub, source files, or the browser.

## Database
`database.sql` defines the normalized SQLite/D1 schema for games, game-team stats, team-season stats, sportsbook lines, import logs and coverage checks. The site currently does not have a live database attached; do not describe the schema as populated or connected.

## Roadmap
1. Verify CBBD endpoint response shapes and quota using the existing API key, without exposing the key.
2. Build a server-side API proxy and batched historical sync with idempotent imports.
3. Load and audit 2021-22 through 2025-26, then begin 2026-27 refreshes.
4. Build team-game matchup features and historical twins, including venue, opponent quality, tempo and Four Factors.
5. Build the Game Model, then chronological system discovery/backtesting with pushes, vig and book-specific odds.
6. Add Season Simulator, Monte Carlo, shot profiles and line-movement tools.

## Free deployment
The static site currently runs on Vercel. The database and server-side sync are not yet configured. Prefer a free-tier service and monitor limits before enabling automated refreshes.
