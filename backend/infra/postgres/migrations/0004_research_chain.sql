-- Gemini API keys users add to the research pool. The key itself is AES-256-GCM encrypted
-- under a server secret; the fingerprint (an HMAC of the key) only detects the same key twice.
CREATE TABLE IF NOT EXISTS research_pool_keys (
  id UUID PRIMARY KEY,
  contributor_id TEXT NOT NULL,
  label TEXT NOT NULL,
  encrypted_key TEXT NOT NULL,
  key_fingerprint TEXT NOT NULL UNIQUE,
  last_four TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Disabled')),
  disabled_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS research_pool_keys_contributor_idx
  ON research_pool_keys (contributor_id, created_at);

-- Searches counted per key per Pacific day (Google resets free allowances at midnight Pacific).
-- key_id is TEXT so the company's configured billed key can be counted alongside pool keys.
CREATE TABLE IF NOT EXISTS research_key_daily_usage (
  key_id TEXT NOT NULL,
  usage_date DATE NOT NULL,
  searches INTEGER NOT NULL CHECK (searches >= 0),
  PRIMARY KEY (key_id, usage_date)
);

-- One Company Dossier per website domain. The primary key's B-tree answers a whole batch of
-- domains (domain = ANY($1)) in one index scan; material is JSONB that Postgres compresses
-- (TOAST) once a row grows past ~2 KB. Expired dossiers are deleted through the expiry index.
CREATE TABLE IF NOT EXISTS company_dossiers (
  domain TEXT PRIMARY KEY,
  material JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS company_dossiers_expires_at_idx
  ON company_dossiers (expires_at);
