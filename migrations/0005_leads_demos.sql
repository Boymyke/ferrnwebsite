-- 0005: who found a lead (inbound vs found), hosted demos, full demo links.

-- leads.origin has a CHECK list; rather than rebuild the table (FKs from meetings/quotes),
-- record the finder separately. found_by: 'claude' | 'auto' | NULL (team / website / engine use origin).
ALTER TABLE leads ADD COLUMN found_by TEXT;
CREATE INDEX IF NOT EXISTS idx_leads_origin ON leads(origin, found_by);

-- Demo sites: built-in ones ship with the site under /demos/<slug>/, uploaded ones live in R2 under demos/<slug>/.
CREATE TABLE IF NOT EXISTS demos (
  id           TEXT PRIMARY KEY,
  slug         TEXT NOT NULL UNIQUE,
  title        TEXT NOT NULL,
  kind         TEXT NOT NULL DEFAULT 'upload' CHECK (kind IN ('static','upload')),
  entry        TEXT NOT NULL DEFAULT 'index.html',
  files        INTEGER DEFAULT 0,
  bytes        INTEGER DEFAULT 0,
  product_slug TEXT,
  lead_id      TEXT,
  notes        TEXT,
  created_by   TEXT,
  created_at   TEXT DEFAULT (datetime('now')),
  updated_by   TEXT,
  updated_at   TEXT DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO demos (id, slug, title, kind, created_by) VALUES
  ('dm_admissions', 'admissions', 'School admissions portal', 'static', 'system'),
  ('dm_assistant', 'assistant', 'AI assistant', 'static', 'system'),
  ('dm_automation', 'automation', 'Automation dashboard', 'static', 'system'),
  ('dm_brightpath', 'brightpath-academy', 'Brightpath Academy (school site)', 'static', 'system'),
  ('dm_cedar', 'cedar-clinic', 'Cedar Clinic (clinic site)', 'static', 'system'),
  ('dm_clinicdesk', 'clinic-desk', 'Clinic front desk', 'static', 'system'),
  ('dm_harbourline', 'harbourline-homes', 'Harbourline Homes (real estate)', 'static', 'system'),
  ('dm_northbridge', 'northbridge-freight', 'Northbridge Freight (logistics)', 'static', 'system'),
  ('dm_track', 'track', 'Shipment tracking', 'static', 'system');

-- Show demo links in full everywhere.
UPDATE products SET demo_url = 'https://www.ferrnagency.com' || demo_url WHERE demo_url LIKE '/%';
