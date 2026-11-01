-- Ferrn platform schema v1 (Cloudflare D1 / SQLite)
-- Every editable table carries updated_by / updated_at so the Studio can show
-- "Edited by <name>" and the audit_log keeps the full before/after history.

PRAGMA foreign_keys = ON;

-- ───────────── people & access ─────────────
CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'editor' CHECK (role IN ('owner','admin','editor','sales','viewer')),
  title         TEXT,
  password_hash TEXT,              -- pbkdf2$<iterations>$<salt b64>$<hash b64>
  invite_hash   TEXT,              -- sha256 of a one-time invite token
  invite_expires_at TEXT,
  avatar_key    TEXT,              -- R2 key
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at TEXT
);

CREATE TABLE sessions (
  id          TEXT PRIMARY KEY,    -- sha256 of the cookie token
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at  TEXT NOT NULL,
  ip          TEXT,
  user_agent  TEXT
);
CREATE INDEX idx_sessions_user ON sessions(user_id);

CREATE TABLE audit_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  at          TEXT NOT NULL DEFAULT (datetime('now')),
  user_id     TEXT,
  user_name   TEXT,
  entity      TEXT NOT NULL,
  entity_id   TEXT,
  action      TEXT NOT NULL,       -- create | update | delete | login | send | sync ...
  summary     TEXT,
  before_json TEXT,
  after_json  TEXT
);
CREATE INDEX idx_audit_entity ON audit_log(entity, entity_id);
CREATE INDEX idx_audit_at ON audit_log(at);

CREATE TABLE settings (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  updated_by TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- ───────────── sales: leads, meetings, quotes ─────────────
CREATE TABLE leads (
  id               TEXT PRIMARY KEY,
  created          TEXT,
  niche            TEXT,
  company          TEXT NOT NULL,
  website          TEXT,
  email            TEXT,
  phone            TEXT,
  contact_name     TEXT,
  role             TEXT,
  city             TEXT,
  country          TEXT DEFAULT 'Nigeria',
  tier             TEXT,
  score            INTEGER,
  gaps             TEXT,
  pitch            TEXT,
  est_value        INTEGER,
  status           TEXT DEFAULT 'New',
  preview_url      TEXT,
  last_contact     TEXT,
  last_reply       TEXT,
  next_action      TEXT,
  needs_you        TEXT,
  needs_you_reason TEXT,
  notes            TEXT,
  source           TEXT,
  thread_id        TEXT,
  origin           TEXT NOT NULL DEFAULT 'studio' CHECK (origin IN ('engine','studio','maps','website','referral')),
  maps_place_id    TEXT,
  rating           REAL,
  synced_at        TEXT,
  updated_by       TEXT,
  updated_at       TEXT DEFAULT (datetime('now'))
);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_niche ON leads(niche, city);

CREATE TABLE prospect_searches (
  id          TEXT PRIMARY KEY,
  query       TEXT NOT NULL,
  niche       TEXT,
  city        TEXT,
  provider    TEXT NOT NULL,
  results_json TEXT,
  created_by  TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE meetings (
  id           TEXT PRIMARY KEY,
  lead_id      TEXT REFERENCES leads(id) ON DELETE SET NULL,
  title        TEXT NOT NULL,
  starts_at    TEXT NOT NULL,
  duration_min INTEGER NOT NULL DEFAULT 30,
  channel      TEXT NOT NULL DEFAULT 'google_meet',
  location_url TEXT,
  attendees    TEXT,
  status       TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','done','no_show','cancelled')),
  agenda       TEXT,
  notes        TEXT,
  outcome      TEXT,
  next_step    TEXT,
  created_by   TEXT,
  updated_by   TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT DEFAULT (datetime('now'))
);
CREATE INDEX idx_meetings_start ON meetings(starts_at);

CREATE TABLE quotes (
  id             TEXT PRIMARY KEY,
  number         TEXT NOT NULL UNIQUE,
  lead_id        TEXT REFERENCES leads(id) ON DELETE SET NULL,
  client_name    TEXT,
  client_company TEXT,
  client_email   TEXT,
  title          TEXT,
  currency       TEXT NOT NULL DEFAULT 'NGN',
  items_json     TEXT NOT NULL DEFAULT '[]',   -- [{description, qty, unit_price, recurring:"once|monthly|termly"}]
  discount_pct   REAL NOT NULL DEFAULT 0,
  tax_pct        REAL NOT NULL DEFAULT 7.5,
  notes          TEXT,
  terms          TEXT,
  valid_until    TEXT,
  status         TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','accepted','declined','expired')),
  share_key      TEXT NOT NULL UNIQUE,
  total          REAL NOT NULL DEFAULT 0,
  created_by     TEXT,
  updated_by     TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT DEFAULT (datetime('now'))
);

-- ───────────── marketplace ─────────────
CREATE TABLE products (
  id               TEXT PRIMARY KEY,
  slug             TEXT NOT NULL UNIQUE,
  name             TEXT NOT NULL,
  category         TEXT NOT NULL CHECK (category IN ('website','webapp','chatbot','automation')),
  industry         TEXT,
  tagline          TEXT,
  description      TEXT,
  features_json    TEXT NOT NULL DEFAULT '[]',
  includes_json    TEXT NOT NULL DEFAULT '[]',
  demo_url         TEXT,
  cover            TEXT,
  accent           TEXT,
  price_ngn_setup  INTEGER,
  price_ngn_monthly INTEGER,
  price_usd_setup  INTEGER,
  price_usd_monthly INTEGER,
  buyout_ngn       INTEGER,
  buyout_usd       INTEGER,
  delivery_days    INTEGER DEFAULT 7,
  published        INTEGER NOT NULL DEFAULT 1,
  sort             INTEGER NOT NULL DEFAULT 100,
  updated_by       TEXT,
  updated_at       TEXT DEFAULT (datetime('now'))
);

CREATE TABLE orders (
  id            TEXT PRIMARY KEY,
  product_id    TEXT REFERENCES products(id),
  tier          TEXT NOT NULL,          -- launch | managed | buyout
  customer_name TEXT NOT NULL,
  email         TEXT NOT NULL,
  phone         TEXT,
  company       TEXT,
  currency      TEXT NOT NULL,
  amount        INTEGER NOT NULL,       -- minor units (kobo / cents)
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed','cancelled','refunded')),
  provider      TEXT NOT NULL DEFAULT 'paystack',
  provider_ref  TEXT UNIQUE,
  notes         TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  paid_at       TEXT
);

-- Contact, RFP, demo, customisation, referral and newsletter submissions.
CREATE TABLE requests (
  id         TEXT PRIMARY KEY,
  type       TEXT NOT NULL CHECK (type IN ('contact','rfp','demo','customise','referral','newsletter','chat_lead')),
  name       TEXT,
  email      TEXT,
  phone      TEXT,
  company    TEXT,
  product_id TEXT,
  message    TEXT,
  budget     TEXT,
  meta_json  TEXT,
  status     TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','in_progress','done','spam')),
  lang       TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT,
  updated_at TEXT
);
CREATE INDEX idx_requests_type ON requests(type, status);

-- ───────────── marketing: content, ads ─────────────
CREATE TABLE content_posts (
  id           TEXT PRIMARY KEY,
  platform     TEXT NOT NULL CHECK (platform IN ('x','instagram','tiktok','linkedin','facebook','youtube')),
  format       TEXT,
  theme        TEXT,
  goal         TEXT,
  audience     TEXT,
  title        TEXT,
  body         TEXT,
  hashtags     TEXT,
  media_json   TEXT NOT NULL DEFAULT '[]',
  scheduled_at TEXT,
  status       TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('idea','draft','in_review','approved','scheduled','posted','failed')),
  post_url     TEXT,
  metrics_json TEXT NOT NULL DEFAULT '{}',   -- {impressions, reach, likes, comments, shares, saves, clicks, leads}
  posted_at    TEXT,
  created_by   TEXT,
  updated_by   TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT DEFAULT (datetime('now'))
);
CREATE INDEX idx_content_schedule ON content_posts(scheduled_at);

CREATE TABLE ad_campaigns (
  id            TEXT PRIMARY KEY,
  platform      TEXT NOT NULL CHECK (platform IN ('meta','google','tiktok','linkedin','x')),
  name          TEXT NOT NULL,
  objective     TEXT,
  audience      TEXT,
  product_id    TEXT,
  daily_budget  INTEGER,
  currency      TEXT NOT NULL DEFAULT 'NGN',
  start_date    TEXT,
  end_date      TEXT,
  status        TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','ready','live','paused','ended')),
  creatives_json TEXT NOT NULL DEFAULT '[]',
  metrics_json  TEXT NOT NULL DEFAULT '{}',   -- {spend, impressions, clicks, leads, cpl}
  notes         TEXT,
  updated_by    TEXT,
  updated_at    TEXT DEFAULT (datetime('now'))
);

-- ───────────── website CMS ─────────────
CREATE TABLE posts (
  id           TEXT PRIMARY KEY,
  slug         TEXT NOT NULL UNIQUE,
  title        TEXT NOT NULL,
  category     TEXT,
  excerpt      TEXT,
  content_html TEXT,
  cover        TEXT,
  status       TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  published_at TEXT,
  updated_by   TEXT,
  updated_at   TEXT DEFAULT (datetime('now'))
);

CREATE TABLE testimonials (
  id        TEXT PRIMARY KEY,
  name      TEXT NOT NULL,
  role      TEXT,
  quote     TEXT NOT NULL,
  avatar    TEXT,
  published INTEGER NOT NULL DEFAULT 1,
  sort      INTEGER NOT NULL DEFAULT 100,
  updated_by TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE team_members (
  id        TEXT PRIMARY KEY,
  name      TEXT NOT NULL,
  role      TEXT NOT NULL,
  bio       TEXT,
  photo     TEXT,         -- R2 key or URL; empty = branded monogram avatar
  linkedin  TEXT,
  github    TEXT,
  published INTEGER NOT NULL DEFAULT 1,
  sort      INTEGER NOT NULL DEFAULT 100,
  updated_by TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE knowledge (
  id        TEXT PRIMARY KEY,
  title     TEXT NOT NULL,
  content   TEXT NOT NULL,
  published INTEGER NOT NULL DEFAULT 1,
  updated_by TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE chat_logs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  session    TEXT,
  path       TEXT,
  lang       TEXT,
  question   TEXT,
  answer     TEXT,
  provider   TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
