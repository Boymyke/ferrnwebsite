-- Social auto-posting (X, Instagram, TikTok) and results collection.
-- content_posts.status keeps its CHECK list; the auto-post lifecycle lives in publish_state so
-- "needs media" is visible without rebuilding the table:
--   NULL         not picked up yet
--   publishing   claimed by the scheduler (D1 claim + KV lock)
--   processing   the platform is still processing (IG video container, TikTok download)
--   retrying     failed, retry at next_attempt_at (max 3 attempts, 20 min apart)
--   needs_media  Instagram/TikTok post with no usable image/video: shown in Studio, never silently failed
--   capped       daily cap reached for the platform; retried automatically
--   posted       published by the API
--   manual       platform not connected: Studio shows copy caption + download media
--   failed       gave up (status is also set to 'failed')
ALTER TABLE content_posts ADD COLUMN autopost INTEGER NOT NULL DEFAULT 0;
ALTER TABLE content_posts ADD COLUMN external_id TEXT;
ALTER TABLE content_posts ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE content_posts ADD COLUMN last_error TEXT;
ALTER TABLE content_posts ADD COLUMN publish_state TEXT;
ALTER TABLE content_posts ADD COLUMN next_attempt_at TEXT;
ALTER TABLE content_posts ADD COLUMN publish_ref TEXT;                          -- JSON progress (thread ids, IG containers, TikTok publish_id)
ALTER TABLE content_posts ADD COLUMN publish_opts_json TEXT NOT NULL DEFAULT '{}'; -- {privacy_level, disable_comment, brand_organic, ...}
ALTER TABLE content_posts ADD COLUMN metrics_at TEXT;                           -- last automatic metrics collection
CREATE INDEX IF NOT EXISTS idx_content_autopost ON content_posts(autopost, status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_content_external ON content_posts(platform, external_id);

-- One row per collection (append-only), so Studio can chart every post's numbers over time.
CREATE TABLE IF NOT EXISTS post_metrics (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id     TEXT NOT NULL REFERENCES content_posts(id) ON DELETE CASCADE,
  platform    TEXT NOT NULL,
  captured_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  impressions INTEGER,
  reach       INTEGER,
  views       INTEGER,
  likes       INTEGER,
  comments    INTEGER,
  shares      INTEGER,
  saves       INTEGER,
  clicks      INTEGER,
  source      TEXT NOT NULL DEFAULT 'api' CHECK (source IN ('api', 'manual')),
  raw_json    TEXT
);
CREATE INDEX IF NOT EXISTS idx_post_metrics_post ON post_metrics(post_id, captured_at);
CREATE INDEX IF NOT EXISTS idx_post_metrics_time ON post_metrics(captured_at);

-- Daily account snapshot (followers per platform).
CREATE TABLE IF NOT EXISTS social_accounts_daily (
  platform    TEXT NOT NULL,
  day         TEXT NOT NULL,             -- YYYY-MM-DD (Lagos)
  followers   INTEGER,
  following   INTEGER,
  posts       INTEGER,
  source      TEXT NOT NULL DEFAULT 'api' CHECK (source IN ('api', 'manual')),
  raw_json    TEXT,
  captured_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (platform, day)
);

-- OAuth tokens, AES-GCM encrypted with a key derived (HKDF-SHA-256) from the SOCIAL_ENC_KEY secret.
CREATE TABLE IF NOT EXISTS social_tokens (
  platform           TEXT PRIMARY KEY,
  account_id         TEXT,
  account_name       TEXT,
  scopes             TEXT,
  enc                TEXT NOT NULL,        -- base64(iv | ciphertext)
  expires_at         TEXT,
  refresh_expires_at TEXT,
  connected_by       TEXT,
  updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
);
