-- Server-side identities and sessions. Password material is stored only as a
-- PBKDF2 hash with a per-account salt; browser passwords are never persisted.
CREATE TABLE auth_accounts (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('seller', 'buyer')),
  buyer_id TEXT UNIQUE,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE auth_sessions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (account_id) REFERENCES auth_accounts(id) ON DELETE CASCADE
);

CREATE INDEX idx_auth_sessions_token ON auth_sessions(token_hash);
CREATE INDEX idx_auth_accounts_buyer ON auth_accounts(buyer_id);
