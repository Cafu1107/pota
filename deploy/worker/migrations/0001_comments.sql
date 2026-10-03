-- Game comments. Raw IP addresses are never stored, only a salted hash used for rate limits.
CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game TEXT NOT NULL,
  name TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  ip_hash TEXT NOT NULL,
  hidden INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_comments_game ON comments (game, hidden, id);
CREATE INDEX IF NOT EXISTS idx_comments_ip ON comments (ip_hash, created_at);

CREATE TABLE IF NOT EXISTS reports (
  comment_id INTEGER NOT NULL,
  ip_hash TEXT NOT NULL,
  PRIMARY KEY (comment_id, ip_hash)
);
