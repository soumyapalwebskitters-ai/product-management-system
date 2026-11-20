CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL CHECK(length(name) BETWEEN 2 AND 60),
  rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
  quote TEXT NOT NULL CHECK(length(quote) BETWEEN 10 AND 1500),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS reviews_updated_at ON reviews(updated_at DESC);
