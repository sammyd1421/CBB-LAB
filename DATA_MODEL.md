# CBB LAB — Data model and ingestion plan

## Primary source and season mapping
Use CollegeBasketballData (CBBD) as the first provider. Its API uses the same bearer key as CollegeFootballData (CFBD). The free tier currently documents 1,000 combined monthly calls. Use the API key only in a server-side environment variable named `CBBD_API_KEY`.

| CBB LAB season | CBBD season parameter |
|---|---:|
| 2021-22 | 2022 |
| 2022-23 | 2023 |
| 2023-24 | 2024 |
| 2024-25 | 2025 |
| 2025-26 | 2026 |
| 2026-27 | 2027 |

## Dataset layers
- **Games:** canonical schedule, final scores, date, home/away, neutral venue, source ID.
- **Game-team stats:** separate row for each team in each game, including possessions, shooting, turnovers, rebounding and derived efficiency fields when supplied.
- **Team-season stats:** provider season aggregates, stored separately from game-level records.
- **Betting lines:** provider-specific market, selection, line, price, opening/closing/live label and timestamp.
- **Coverage/import logs:** counts and missingness by provider, dataset and season.

## Backfill approach
The API caps game and team-box-score responses at 3,000 rows per request. A full season can exceed that, so split requests into date windows or conference/team batches. Persist each batch before requesting the next one; use source IDs and unique constraints so retries do not duplicate games. Start with games and team-game box scores, then season aggregates and odds. Keep requests comfortably below the free shared monthly quota, especially while the existing CFBD football work may also consume it.

## Validation before enabling analytics
- Compare game counts with source season schedules and record unexplained gaps.
- Check duplicate source game IDs, duplicate team-game rows and impossible scores.
- Confirm exactly two team-stat rows per completed game where box-score coverage exists.
- Check that possession, shooting and efficiency fields have plausible ranges and consistent units.
- Track missing odds separately by provider and market. A missing line is not a push and not a zero.
- Label every metric with source and definition. Avoid mixing percentage values stored as 0–1 with values stored as 0–100.
- For pregame models, calculate rolling/team features only from games completed before the target tipoff.

## Important coverage notes
CBBD documents broad team box-score coverage from 2005 onward, adjusted efficiency from 2014 onward, and betting lines from 2013 onward. Coverage varies by endpoint and individual game; a season being listed does not guarantee every record or field is complete.
