PRAGMA foreign_keys = ON;

-- Canonical game table. Store only verified source values; NULL means unavailable.
CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL DEFAULT 'CBBD',
  source_game_id TEXT,
  season INTEGER NOT NULL,                 -- ending year: 2022 = 2021-22
  game_date TEXT,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  home_team_id TEXT,
  away_team_id TEXT,
  home_score INTEGER,
  away_score INTEGER,
  neutral_site INTEGER CHECK (neutral_site IN (0,1) OR neutral_site IS NULL),
  status TEXT,
  imported_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(source, source_game_id)
);

CREATE INDEX IF NOT EXISTS idx_games_season_date ON games(season, game_date);
CREATE INDEX IF NOT EXISTS idx_games_home_season ON games(home_team_id, season);
CREATE INDEX IF NOT EXISTS idx_games_away_season ON games(away_team_id, season);

-- One row per team per game. This avoids mixing the home team's stats with the away team's.
CREATE TABLE IF NOT EXISTS game_team_stats (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  team_id TEXT,
  team_name TEXT NOT NULL,
  is_home INTEGER NOT NULL CHECK (is_home IN (0,1)),
  points INTEGER,
  possessions REAL,
  pace REAL,
  offensive_efficiency REAL,
  defensive_efficiency REAL,
  efg_pct REAL,
  fg_pct REAL,
  fg3_pct REAL,
  ft_pct REAL,
  turnover_pct REAL,
  offensive_rebound_pct REAL,
  free_throw_rate REAL,
  three_point_attempt_rate REAL,
  offensive_rebounds INTEGER,
  defensive_rebounds INTEGER,
  turnovers INTEGER,
  steals INTEGER,
  blocks INTEGER,
  fouls INTEGER,
  source TEXT NOT NULL DEFAULT 'CBBD',
  UNIQUE(game_id, team_name)
);

CREATE INDEX IF NOT EXISTS idx_game_team_stats_team ON game_team_stats(team_id, game_id);
CREATE INDEX IF NOT EXISTS idx_game_team_stats_game ON game_team_stats(game_id);

-- Season aggregates are kept separately from single-game box scores.
CREATE TABLE IF NOT EXISTS team_season_stats (
  id TEXT PRIMARY KEY,
  season INTEGER NOT NULL,
  team_id TEXT,
  team_name TEXT NOT NULL,
  games_played INTEGER,
  wins INTEGER,
  losses INTEGER,
  points_per_game REAL,
  points_allowed_per_game REAL,
  possessions_per_game REAL,
  offensive_efficiency REAL,
  defensive_efficiency REAL,
  net_efficiency REAL,
  efg_pct REAL,
  turnover_pct REAL,
  offensive_rebound_pct REAL,
  free_throw_rate REAL,
  three_point_attempt_rate REAL,
  source TEXT NOT NULL DEFAULT 'CBBD',
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(season, team_name, source)
);

CREATE INDEX IF NOT EXISTS idx_team_season_stats_lookup ON team_season_stats(season, team_name);

-- Preserve provider-specific market snapshots; never collapse books into one synthetic line.
CREATE TABLE IF NOT EXISTS betting_lines (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  market TEXT NOT NULL CHECK (market IN ('spread','total','moneyline','team_total')),
  selection TEXT,
  line REAL,
  price REAL,
  snapshot_type TEXT,                      -- opening, closing, live, timestamped
  observed_at TEXT,
  source TEXT NOT NULL DEFAULT 'CBBD',
  UNIQUE(game_id, provider, market, selection, snapshot_type, observed_at)
);

CREATE INDEX IF NOT EXISTS idx_betting_lines_game_market ON betting_lines(game_id, market, provider);
CREATE INDEX IF NOT EXISTS idx_betting_lines_provider_time ON betting_lines(provider, observed_at);

CREATE TABLE IF NOT EXISTS import_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  dataset TEXT NOT NULL,
  season INTEGER,
  rows_received INTEGER NOT NULL DEFAULT 0,
  rows_inserted INTEGER NOT NULL DEFAULT 0,
  rows_updated INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'completed',
  imported_at TEXT DEFAULT CURRENT_TIMESTAMP,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS data_coverage (
  source TEXT NOT NULL,
  dataset TEXT NOT NULL,
  season INTEGER NOT NULL,
  record_count INTEGER NOT NULL DEFAULT 0,
  last_checked_at TEXT DEFAULT CURRENT_TIMESTAMP,
  completeness_note TEXT,
  PRIMARY KEY(source, dataset, season)
);
