# CBB LAB — Core data and model rules

## Purpose
CBB LAB finds historical games that resemble a selected matchup in **both teams' pregame statistical fingerprints and pace**, then summarizes what happened in those games. Similarity is resemblance, not a prediction probability or a betting edge by itself.

## Data source
- Primary source: CollegeBasketballData (CBBD), using the server-side `CBBD_API_KEY`.
- Season identifiers use the ending year: `2027` means 2026–27.
- The importer currently targets men's Division I regular-season team-game box scores for seasons 2022–2027.
- CBBD documents team box-score coverage from 2003 onward, with much broader populated box-score fields from 2005; individual fields and games can still be missing. Adjusted efficiency ratings have a shorter documented range (2014 onward). Check current CBBD data availability before expanding the import window.
- Keep the API key server-side. The free API quota is shared with the user's College Football Data usage.

## The historical fingerprint
For each team, build a pregame profile from its ten most recent completed team games available before the target game's date. Carry prior-season games into early-season profiles. Never include the target game, another game on the target date, or any future result.

Each matchup fingerprint contains up to 30 values: 15 features for Team A and the same 15 for Team B, preserving team orientation:
1. Opponent-adjusted offensive efficiency
2. Opponent-adjusted defensive efficiency
3. Average pace across the team's recent games
4. Effective field-goal percentage
5. Turnover rate
6. Offensive-rebound rate
7. Free-throw rate
8. Three-point attempt rate
9. Three-point percentage
10. Two-point percentage
11. Opponent effective-field-goal percentage
12. Opponent turnover rate
13. Opponent three-point attempt rate
14. Opponent three-point percentage
15. Opponent two-point percentage

Missing values remain missing; they are never replaced with zero. A comparison requires at least 24 valid features overall and at least 12 for each team. Small-sample offensive and defensive efficiency values are regressed toward the league average; pace is kept as the observed rolling average and is not shrunk toward league pace.

## Historical comparison rules
- Compare Team A with historical Team A and Team B with historical Team B. Consider the reversed historical orientation only when it produces the closer full fingerprint.
- Require each team's historical average pace to be within **2.0 possessions** of its corresponding target team's pace. Do not use spreads, totals, projected scoring, or historical betting lines to select, filter, rank, or score analogs.
- Prefer the same venue type when at least five same-venue candidates are available; otherwise include both venue types.
- Apply the 80% absolute fingerprint-similarity floor after calculating the full fingerprint distance. 80%+ is the minimum strong resemblance; 90%+ is elite; 100% means identical under the defined feature distance.
- Rank qualifying games by fingerprint similarity. Report each team's pace and pace difference alongside the similarity so the user can audit the match.
- User-entered spread/total, when supplied, are applied only after analog selection to describe how historical outcomes would have graded against those lines. They never influence analog selection.

## What the results should show
- Historical sample size and seasons represented.
- Average and highest similarity, plus counts by similarity tier.
- Each analog's actual score, aligned to Team A and Team B, and its two team-pace values/differences.
- Distributions for combined points, Team A points, Team B points, and scoring margin; show mean, median, percentiles, and range.
- Similarity-weighted summaries may supplement raw results, but always show the raw sample too. Show effective sample size when weighting is used.
- Label small samples and limited feature coverage clearly. Historical frequencies are descriptive evidence, not guaranteed outcomes or calibrated forward probabilities.

## Validation
- Live Matchup Lab, Daily Slate Scanner, and walk-forward backtest must use the same 10-game pregame window, fingerprint features, feature scales/weights, 2-possession per-team pace gate, 80% similarity floor, and same-venue preference rule.
- Backtest targets must be evaluated chronologically using only earlier completed games. Do not let same-day or future games leak into the target profile or its analog pool.
- Compare results by similarity tier and report sample sizes and prediction errors. Do not describe a high historical hit rate as a lock without robust, out-of-sample evidence.
- Validate source game IDs, duplicates, score/pace ranges, feature units, and per-season import coverage. Keep missingness visible.

## Explicitly out of scope for the core matcher
- Betting lines, closing-line value, and market movement.
- Projected total or projected score as a similarity filter.
- Team-season aggregates used as substitutes for missing game-level fingerprints.
- Synthetic values for missing features.
