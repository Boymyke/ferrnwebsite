-- A person can take a lead over from the automation (AI replies, follow-ups, WhatsApp bot).
ALTER TABLE leads ADD COLUMN handled_by TEXT;   -- name of the team member handling it; NULL = automation
ALTER TABLE leads ADD COLUMN handled_at TEXT;
