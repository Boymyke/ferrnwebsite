-- Email tracking: one row per email sent (site emails through Resend and LeadsHunter
-- outreach through Gmail), plus an append-only list of opens and clicks.
-- Opens come from a 1x1 image; clicks from /api/e/c/<id>/<n> redirects. Delivery and
-- bounces for site emails come from Resend (polled by the cron).
CREATE TABLE IF NOT EXISTS email_log (
  id               TEXT PRIMARY KEY,                    -- site: random; outreach: lh-<message id>
  source           TEXT NOT NULL DEFAULT 'site',        -- site | outreach
  kind             TEXT NOT NULL DEFAULT 'email',       -- proposal | invoice | access_code | reminder | receipt | signed | first_email | follow_up | reply ...
  from_addr        TEXT,
  to_addr          TEXT NOT NULL,
  subject          TEXT,
  company          TEXT,
  proposal_id      TEXT,
  invoice_id       TEXT,
  lead_id          TEXT,                                -- LeadsHunter lead id for outreach
  provider_id      TEXT,                                -- Resend email id / Gmail message id
  status           TEXT NOT NULL DEFAULT 'sent',        -- sent | failed | delivered | bounced | complained
  error            TEXT,
  links_json       TEXT NOT NULL DEFAULT '[]',          -- original URLs, index = /c/<id>/<n>
  sent_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  delivered_at     TEXT,
  open_count       INTEGER NOT NULL DEFAULT 0,
  first_opened_at  TEXT,
  last_opened_at   TEXT,
  click_count      INTEGER NOT NULL DEFAULT 0,
  first_clicked_at TEXT,
  last_clicked_at  TEXT,
  status_checked_at TEXT,
  updated_at       TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_email_log_sent ON email_log(sent_at);
CREATE INDEX IF NOT EXISTS idx_email_log_proposal ON email_log(proposal_id);
CREATE INDEX IF NOT EXISTS idx_email_log_status ON email_log(status, sent_at);

CREATE TABLE IF NOT EXISTS email_events (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  email_id  TEXT NOT NULL,
  kind      TEXT NOT NULL,                              -- open | click
  url       TEXT,
  ua        TEXT,
  country   TEXT,
  city      TEXT,
  at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_email_events ON email_events(email_id, id);
