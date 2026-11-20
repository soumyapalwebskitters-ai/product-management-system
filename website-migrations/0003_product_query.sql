CREATE TABLE IF NOT EXISTS "product query" (
  id TEXT PRIMARY KEY,
  request_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  items_json TEXT NOT NULL,
  estimated_total_minor INTEGER NOT NULL CHECK (estimated_total_minor >= 0),
  status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','contacted','closed')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS product_query_created_at ON "product query"(created_at DESC);
