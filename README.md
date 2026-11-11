# CBB LAB

Mobile-first men's NCAA Division I college basketball analytics workspace. Initial priority: historical team and matchup similarity, followed by spread, game-total and team-total analysis.

## v0.1 foundation
- Responsive dashboard and navigation
- CSV import, local browser persistence and CSV export
- Team-season profiles from available game results
- Standardized nearest-neighbor similarity across available features
- Two-team profile comparison
- Transparent scoring-average baseline projection
- Optional Cloudflare D1 schema and read-only Worker API starter

## Important limitations
This is a foundation, not a finished predictive betting model. Current projections use scoring averages, opponent scoring averages and a user-set home-court adjustment. It does not yet calculate possession-adjusted efficiency or fully validated ATS/over-under results. Do not treat projections as betting recommendations. Missing stats and lines are not imputed as zero.

## Run on iPhone
This is a static HTML/CSS/JavaScript app. Host it free on Cloudflare Pages connected to this repository. Build command: none. Build output directory: /.

## CSV import
Required fields: home team, away team, home score and away score. Season is strongly recommended. Common aliases are recognized by the importer. Optional: gameDate, neutralSite, spread/closingSpread, overUnder/closingTotal, pace, efg, tov, orb, ftr, threeRate. Review Data Center coverage after import and keep backups with Export CSV.

## Provider and credentials
CollegeBasketballData (CBBD) is a candidate source. Confirm current CSV/API coverage and limits before automating ingestion. A CollegeFootballData key is not automatically a CollegeBasketballData key. Never put API credentials in frontend JavaScript or this public repository. Store any future credentials only as server-side Worker secrets.

## Free deployment plan
1. Connect this repository to Cloudflare Pages; root directory, no build command, output directory /.
2. Optional persistence: create a free-tier D1 database, apply database.sql, bind it to a Worker as DB, and deploy worker.js separately.
3. Verify current provider and Cloudflare free-tier limits before scheduled imports. No paid upgrade is needed for this static foundation.

## Next milestones
1. Match exact CBBD CSV exports and validate the five completed seasons 2021-22 through 2025-26.
2. Add possession-based adjusted offense/defense, Four Factors and tempo.
3. Add matchup historical twins with closing-line spread/total/team-total grading, pushes and missing-line handling.
4. Add season-separated backtesting and leakage controls.
5. Add Monte Carlo simulations, scatterplot explorer, line movement and season simulator.
