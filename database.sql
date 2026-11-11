PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS games(id TEXT PRIMARY KEY,season TEXT NOT NULL,game_date TEXT,home_team TEXT NOT NULL,away_team TEXT NOT NULL,home_score INTEGER NOT NULL,away_score INTEGER NOT NULL,neutral_site INTEGER,closing_spread REAL,closing_total REAL,source TEXT,imported_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS idx_games_season ON games(season);
CREATE INDEX IF NOT EXISTS idx_games_teams ON games(home_team,away_team);
CREATE INDEX IF NOT EXISTS idx_games_date ON games(game_date);
CREATE TABLE IF NOT EXISTS import_log(id INTEGER PRIMARY KEY AUTOINCREMENT,source TEXT NOT NULL,rows_imported INTEGER NOT NULL,imported_at TEXT DEFAULT CURRENT_TIMESTAMP,notes TEXT);