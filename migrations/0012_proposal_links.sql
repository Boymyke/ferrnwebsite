-- Proposals come two ways: built in Studio (the /p/<token> signing page) or a link to a page made elsewhere.
-- A link proposal either points at any working URL or at a page uploaded to Ferrn and served at /proposal/<slug>/.
ALTER TABLE proposals ADD COLUMN kind TEXT NOT NULL DEFAULT 'built';  -- built | link
ALTER TABLE proposals ADD COLUMN link_url TEXT;                       -- where the client goes (link proposals)
ALTER TABLE proposals ADD COLUMN page_slug TEXT;                      -- hosted page: R2 proposal-pages/<slug>/ → /proposal/<slug>/
CREATE INDEX IF NOT EXISTS idx_proposals_page_slug ON proposals(page_slug);
