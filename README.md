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
This is a static HTML/CSS/JavaScript app. Host the static app on Vercel's free Hobby plan by importing this GitHub repository. No build command is required; use the repository root as the project directory.

## CSV import
Required fields: home team, away team, home score and away score. Season is strongly recommended. Common aliases are recognized by the importer. Optional: gameDate, neutralSite, spread/closingSpread, overUnder/closingTotal, pace, efg, tov, orb, ftr, threeRate. Review Data Center coverage after import and keep backups with Export CSV.

## Provider and credentials
CollegeBasketballData (CBBD) is a candidate source. Confirm current CSV/API coverage and limits before automating ingestion. A CollegeFootballData key is not automatically a CollegeBasketballData key. Never put API credentials in frontend JavaScript or this public repository. Store any future credentials only as server-side Worker secrets.

## Free deployment plan
1. Connect the Vercel app to this ChatGPT account, then import `sammyd1421/CBB-LAB` into Vercel.
2. Use the repository root, Framework Preset `Other`, no build command, and `.` as the output directory if Vercel asks for one.
3. Deploy the static frontend first. No API key or paid service is required for this stage.
4. The current app stores imported CSV data in the user's browser. Shared cloud data, automated ingestion, and the optional D1/Worker backend are later milestones and must be configured separately.

## Next milestones
1. Match exact CBBD CSV exports and validate the five completed seasons 2021-22 through 2025-26.
2. Add possession-based adjusted offense/defense, Four Factors and tempo.
3. Add matchup historical twins with closing-line spread/total/team-total grading, pushes and missing-line handling.
4. Add season-separated backtesting and leakage controls.
5. Add Monte Carlo simulations, scatterplot explorer, line movement and season simulator.
