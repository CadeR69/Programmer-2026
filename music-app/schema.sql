-- Cadence library schema (Cloudflare D1 / SQLite)

CREATE TABLE IF NOT EXISTS tracks (
  id          TEXT PRIMARY KEY,
  r2_key      TEXT NOT NULL UNIQUE,
  title       TEXT NOT NULL,
  artist      TEXT NOT NULL DEFAULT '',
  album       TEXT NOT NULL DEFAULT '',
  track_no    INTEGER NOT NULL DEFAULT 0,
  year        INTEGER NOT NULL DEFAULT 0,
  duration    REAL NOT NULL DEFAULT 0,
  size        INTEGER NOT NULL DEFAULT 0,
  mime        TEXT NOT NULL DEFAULT 'audio/mpeg',
  has_cover   INTEGER NOT NULL DEFAULT 0,
  added_at    INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tracks_artist_album ON tracks (artist, album, track_no);
CREATE INDEX IF NOT EXISTS idx_tracks_dupe ON tracks (title, artist, album, size);

-- Playlists keep their ordered track ids as JSON. updated_at drives last-write-wins sync.
-- The special id 'liked' holds the favourites list. Deleted playlists stay as tombstones.
CREATE TABLE IF NOT EXISTS playlists (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  track_ids   TEXT NOT NULL DEFAULT '[]',
  updated_at  INTEGER NOT NULL,
  deleted     INTEGER NOT NULL DEFAULT 0
);

-- Failed-login log used for simple brute-force throttling.
CREATE TABLE IF NOT EXISTS login_attempts (
  ip  TEXT NOT NULL,
  ts  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_login_attempts ON login_attempts (ip, ts);
