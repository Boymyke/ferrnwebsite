-- v4: projects (internal tracking + public portfolio), site content, important links,
-- company profile, seasonal themes, FAQs, Bob (assistant) settings, testimonial audio,
-- and a page index for Bob's retrieval. Additive only: nothing existing is dropped or renamed.

-- Projects: one record per engagement. Internal fields (budget, costs, team, status) never
-- reach the public site; the portfolio shows a project only when public = 1.
CREATE TABLE IF NOT EXISTS projects (
  id              TEXT PRIMARY KEY,
  slug            TEXT UNIQUE,
  name            TEXT NOT NULL,
  client          TEXT,
  category        TEXT NOT NULL DEFAULT 'website',      -- website | webapp | ai | branding | other
  type            TEXT,                                  -- "Corporate website", "Patient portal"…
  industry        TEXT,
  description     TEXT,
  status          TEXT NOT NULL DEFAULT 'discovery',     -- discovery | design | build | review | launched | support | paused | cancelled
  priority        TEXT NOT NULL DEFAULT 'normal',        -- low | normal | high
  lead            TEXT,
  team_json       TEXT NOT NULL DEFAULT '[]',            -- ["Name", ...]
  start_date      TEXT,
  due_date        TEXT,
  completed_date  TEXT,
  currency        TEXT NOT NULL DEFAULT 'NGN',
  budget          REAL,                                  -- agreed price
  expenses        REAL,                                  -- costs so far
  revenue         REAL,                                  -- received so far
  calc_json       TEXT NOT NULL DEFAULT '{}',            -- project calculator inputs
  links_json      TEXT NOT NULL DEFAULT '{}',            -- {live, figma, repo, brief, assets, video}
  -- public portfolio
  public          INTEGER NOT NULL DEFAULT 0,
  featured        INTEGER NOT NULL DEFAULT 0,
  sort            INTEGER NOT NULL DEFAULT 100,
  year            TEXT,
  cover           TEXT,                                  -- R2 key or URL
  gallery_json    TEXT NOT NULL DEFAULT '[]',            -- [{src, alt, caption, kind: image|video}]
  services_json   TEXT NOT NULL DEFAULT '[]',            -- ["UI/UX design", "Web development"]
  tech_json       TEXT NOT NULL DEFAULT '[]',
  summary         TEXT,
  context         TEXT,
  challenge       TEXT,
  approach        TEXT,
  solution        TEXT,
  results_json    TEXT NOT NULL DEFAULT '[]',            -- [{label, value, note}] verified only
  testimonial_id  TEXT,
  meta_title      TEXT,
  meta_description TEXT,
  accent          TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by      TEXT,
  updated_at      TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_projects_public ON projects(public, featured, sort);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

-- Structured website copy the Studio can edit. key = "home.hero.title"; code keeps a default
-- for every key, so an empty table renders the site exactly as before.
CREATE TABLE IF NOT EXISTS site_content (
  key         TEXT PRIMARY KEY,
  value       TEXT,
  updated_by  TEXT,
  updated_at  TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS content_revisions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  key         TEXT NOT NULL,
  value       TEXT,
  by          TEXT,
  at          TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_content_revisions ON content_revisions(key, id);

-- Important links (company profile, brochure, demos…): shown at /links and in the footer.
CREATE TABLE IF NOT EXISTS links (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT,
  url         TEXT NOT NULL,
  category    TEXT,
  icon        TEXT,                                      -- lucide icon name
  visible     INTEGER NOT NULL DEFAULT 1,
  sort        INTEGER NOT NULL DEFAULT 100,
  updated_by  TEXT,
  updated_at  TEXT DEFAULT (datetime('now'))
);

-- Company profile sections (the public /profile page and the PDF).
CREATE TABLE IF NOT EXISTS profile_sections (
  id          TEXT PRIMARY KEY,
  key         TEXT,                                      -- who | what | services | industries | team | tech | projects | achievements | contact
  title       TEXT NOT NULL,
  body        TEXT,                                      -- plain text / light HTML
  items_json  TEXT NOT NULL DEFAULT '[]',
  image       TEXT,
  published   INTEGER NOT NULL DEFAULT 1,
  sort        INTEGER NOT NULL DEFAULT 100,
  updated_by  TEXT,
  updated_at  TEXT DEFAULT (datetime('now'))
);

-- Seasonal themes: tasteful accents applied by date, highest priority wins.
CREATE TABLE IF NOT EXISTS seasons (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  preset      TEXT NOT NULL DEFAULT 'custom',            -- christmas | new-year | valentine | independence | halloween | milestone | campaign | custom
  enabled     INTEGER NOT NULL DEFAULT 0,
  starts_at   TEXT,
  ends_at     TEXT,
  priority    INTEGER NOT NULL DEFAULT 10,
  greeting    TEXT,                                      -- short line shown in the hero
  banner_text TEXT,
  banner_url  TEXT,
  accent      TEXT,                                      -- optional accent override
  effect      TEXT,                                      -- none | snow | confetti | sparkle | hearts | glow
  settings_json TEXT NOT NULL DEFAULT '{}',
  updated_by  TEXT,
  updated_at  TEXT DEFAULT (datetime('now'))
);

-- FAQs: used on the site and by Bob.
CREATE TABLE IF NOT EXISTS faqs (
  id          TEXT PRIMARY KEY,
  question    TEXT NOT NULL,
  answer      TEXT NOT NULL,
  category    TEXT,
  on_site     INTEGER NOT NULL DEFAULT 1,
  published   INTEGER NOT NULL DEFAULT 1,
  sort        INTEGER NOT NULL DEFAULT 100,
  updated_by  TEXT,
  updated_at  TEXT DEFAULT (datetime('now'))
);

-- Bob's retrieval index: one row per public page or item, rebuilt from published data.
CREATE TABLE IF NOT EXISTS page_index (
  path        TEXT PRIMARY KEY,
  kind        TEXT NOT NULL,                             -- page | project | product | post | faq | policy | knowledge
  title       TEXT NOT NULL,
  summary     TEXT,
  body        TEXT,                                      -- plain text used for retrieval
  anchors_json TEXT NOT NULL DEFAULT '[]',               -- [{id, title}]
  excluded    INTEGER NOT NULL DEFAULT 0,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Testimonials: audio and transcript (optional), company, featured.
ALTER TABLE testimonials ADD COLUMN company TEXT;
ALTER TABLE testimonials ADD COLUMN logo TEXT;
ALTER TABLE testimonials ADD COLUMN audio TEXT;
ALTER TABLE testimonials ADD COLUMN transcript TEXT;
ALTER TABLE testimonials ADD COLUMN featured INTEGER NOT NULL DEFAULT 0;

-- Chat logs: what Bob did (answer | navigate | read) and whether the user rated it.
ALTER TABLE chat_logs ADD COLUMN action TEXT;
ALTER TABLE chat_logs ADD COLUMN sources TEXT;
ALTER TABLE chat_logs ADD COLUMN rating INTEGER;
