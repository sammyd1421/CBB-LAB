# CBB LAB

Mobile-first men's NCAA Division I college basketball historical matchup analytics.

## Core purpose
Find past games that resemble a selected matchup in **both teams' pregame statistical fingerprints and pace**, then inspect the actual score, team scoring, margin, and total distributions. Similarity is resemblance, not a win probability or a betting edge by itself.

## Main workflows
- **Matchup Lab:** choose Team A, Team B, venue, and historical window; inspect the closest qualifying historical matchups and their outcome distributions.
- **Daily Slate Scanner:** apply the same historical matchup engine to scheduled games and rank the slate by similarity and historical outcome consistency.
- **Team Explorer:** inspect team-level season profiles and radar-style fingerprints.
- **Backtest Lab:** test whether stronger historical similarity has actually improved out-of-sample score and margin estimates.
- **Data Center:** import, inspect, export, and restore the locally stored historical dataset.

The basic Game Model is a descriptive baseline only. It is not the core value proposition and should not be treated as a betting model.

## Core comparison rules
- Build each team fingerprint from its ten most recent completed games before the target date, carrying prior-season games into early-season profiles.
- Compare up to 15 features per team (30 total): adjusted offense/defense, pace, Four Factors, shooting profile, and opponent-facing defensive profile.
- Preserve Team A/Team B orientation. Consider a reversed historical orientation only if it produces a closer full fingerprint.
- Require at least 24 of 30 features overall and at least 12 for each team. Missing values remain missing; never fill them with zero.
- Require each team's rolling pace to be within 2.0 possessions of its corresponding target team's pace.
- Prefer same-venue historical games when at least five are available; otherwise include both venue types.
- Use a 60% fingerprint-similarity floor. 80%+ is strong, 90%+ elite, and 100% means identical under the defined distance.
- Spreads, totals, projected scores, and historical betting lines never influence which analogs qualify or how they are ranked. User-entered lines can be used after selection to grade outcomes only.

The live Matchup Lab, Daily Slate Scanner, and walk-forward backtest should share these rules. See [DATA_MODEL.md](DATA_MODEL.md) for the complete model contract.

## Data source and limits
- Primary source: CollegeBasketballData (CBBD).
- The browser stores imported games locally in IndexedDB; users should export a JSON backup before changing browsers/devices.
- The importer currently targets men's Division I regular-season games from seasons 2022 through 2027 (2021–22 through 2026–27 to date).
- CBBD's free API allowance is 1,000 calls per month shared with College Football Data. Game/team-box-score endpoints have a 3,000-record response cap, so imports use date windows.
- CBBD documents team box-score coverage from 2003 onward, with much broader populated box-score fields from 2005. Adjusted efficiency coverage starts in 2014. Availability does not guarantee complete fields for every game.
- Keep the CBBD bearer key in the server-side Vercel environment variable `CBBD_API_KEY`. Never expose it in browser code, CSVs, Git commits, or chat.

## Validation and limitations
- Historical snapshots must be strictly pregame: no target-date or future results.
- Report raw sample size, seasons, similarity tiers, distributions, and effective sample size whenever weighted summaries are shown.
- Treat historical frequencies as descriptive diagnostics, not guaranteed outcomes or calibrated forward probabilities.
- Validate imported IDs, duplicates, score/pace ranges, feature units, and missingness before trusting a pattern.
- The site has not been independently end-to-end tested on every iPhone Safari/browser version. A Vercel READY deployment confirms build/deploy status, not every browser workflow.

## Deployment
Static front end and same-origin serverless CBBD proxy are deployed on Vercel. No paid data APIs, paid database, or paid hosting are part of the current design.
