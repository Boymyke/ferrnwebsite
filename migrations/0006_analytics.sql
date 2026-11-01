-- First-party, cookie-free website analytics. No IP addresses are stored.
-- Times are unix epoch seconds. Rows older than 90 days are pruned daily by the cron.

CREATE TABLE IF NOT EXISTS an_sessions (
  id            TEXT PRIMARY KEY,           -- random per-tab id (sessionStorage)
  visitor_id    TEXT NOT NULL,              -- random anonymous id (localStorage)
  first_seen    INTEGER NOT NULL,
  last_seen     INTEGER NOT NULL,
  entry_path    TEXT NOT NULL,
  current_path  TEXT NOT NULL,
  referrer      TEXT,                       -- host only, e.g. google.com
  utm_source    TEXT,
  utm_medium    TEXT,
  utm_campaign  TEXT,
  country       TEXT,                       -- ISO 3166-1 alpha-2
  region        TEXT,
  city          TEXT,
  lat           REAL,                       -- rounded to 0.1°
  lon           REAL,
  timezone      TEXT,
  device        TEXT NOT NULL DEFAULT 'desktop',  -- desktop | tablet | mobile
  browser       TEXT,
  os            TEXT,
  language      TEXT,                       -- browser language, e.g. en-NG
  viewport      TEXT,                       -- e.g. 1440x900
  pageviews     INTEGER NOT NULL DEFAULT 0,
  clicks        INTEGER NOT NULL DEFAULT 0,
  max_scroll    INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS an_sessions_first ON an_sessions (first_seen);
CREATE INDEX IF NOT EXISTS an_sessions_last ON an_sessions (last_seen);
CREATE INDEX IF NOT EXISTS an_sessions_visitor ON an_sessions (visitor_id);

CREATE TABLE IF NOT EXISTS an_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id  TEXT NOT NULL,
  ts          INTEGER NOT NULL,
  type        TEXT NOT NULL,                -- pageview | click | scroll
  path        TEXT NOT NULL,
  device      TEXT NOT NULL DEFAULT 'desktop', -- viewport bucket at the time of the event
  x           REAL,                         -- click: fraction of document width (0–1)
  y           REAL,                         -- click: fraction of document height (0–1)
  target      TEXT,                         -- click: short selector or element text
  depth       INTEGER                       -- scroll: max depth reached, %
);
CREATE INDEX IF NOT EXISTS an_events_ts ON an_events (ts);
CREATE INDEX IF NOT EXISTS an_events_type_ts ON an_events (type, ts);
CREATE INDEX IF NOT EXISTS an_events_path ON an_events (path, type, device, ts);
CREATE INDEX IF NOT EXISTS an_events_session ON an_events (session_id, ts);
