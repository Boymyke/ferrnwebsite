-- Proposals → e-signature → invoice → payment.
-- Clients open /p/:token and /i/:token (unguessable tokens) and unlock them with a 6-digit code
-- that is stored only as a sha256 hash. gate_secret signs the per-document access cookie and is
-- rotated when Studio regenerates the code, which also signs out earlier viewers.

CREATE TABLE proposals (
  id               TEXT PRIMARY KEY,
  number           TEXT NOT NULL UNIQUE,                 -- PR-2026-001
  lead_id          TEXT REFERENCES leads(id) ON DELETE SET NULL,
  client_name      TEXT,
  client_company   TEXT,
  client_email     TEXT,
  client_phone     TEXT,
  title            TEXT NOT NULL DEFAULT '',
  summary          TEXT,                                 -- cover summary
  sections_json    TEXT NOT NULL DEFAULT '[]',           -- [{heading, body}] body = simple markdown
  items_json       TEXT NOT NULL DEFAULT '[]',           -- [{description, qty, unit_price, billing: once|monthly|termly|yearly}]
  currency         TEXT NOT NULL DEFAULT 'NGN' CHECK (currency IN ('NGN','USD','GBP')),
  discount_pct     REAL NOT NULL DEFAULT 0,
  vat              INTEGER NOT NULL DEFAULT 1,           -- 1 = add VAT at 7.5%
  deposit_pct      REAL NOT NULL DEFAULT 60,
  invoice_on_sign  TEXT NOT NULL DEFAULT 'deposit' CHECK (invoice_on_sign IN ('deposit','full')),
  valid_until      TEXT,
  total            REAL NOT NULL DEFAULT 0,              -- one-off total incl. VAT, for lists
  status           TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','viewed','signed','declined','expired')),
  token            TEXT NOT NULL UNIQUE,
  code_hash        TEXT,
  gate_secret      TEXT NOT NULL,
  revoked          INTEGER NOT NULL DEFAULT 0,
  sent_at          TEXT,
  first_viewed_at  TEXT,
  last_viewed_at   TEXT,
  view_count       INTEGER NOT NULL DEFAULT 0,
  signed_at        TEXT,
  signer_name      TEXT,
  signer_title     TEXT,
  signature_key    TEXT,                                 -- R2 private/signatures/...
  signature_mode   TEXT,                                 -- draw | type
  signer_ip_hash   TEXT,
  signer_ua        TEXT,
  content_hash     TEXT,                                 -- sha256 of the signed content
  declined_at      TEXT,
  decline_message  TEXT,
  created_by       TEXT,
  updated_by       TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT DEFAULT (datetime('now'))
);
CREATE INDEX idx_proposals_status ON proposals(status);
CREATE INDEX idx_proposals_lead ON proposals(lead_id);

CREATE TABLE proposal_events (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  proposal_id  TEXT NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  invoice_id   TEXT,
  kind         TEXT NOT NULL,       -- created | sent | code | revoked | viewed | signed | changes | declined | expired | invoice | receipt | paid ...
  actor        TEXT,
  detail       TEXT,
  at           TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by   TEXT,
  updated_at   TEXT DEFAULT (datetime('now'))
);
CREATE INDEX idx_proposal_events ON proposal_events(proposal_id, id);

CREATE TABLE invoices (
  id               TEXT PRIMARY KEY,
  number           TEXT NOT NULL UNIQUE,                 -- INV-2026-001
  proposal_id      TEXT REFERENCES proposals(id) ON DELETE SET NULL,
  lead_id          TEXT REFERENCES leads(id) ON DELETE SET NULL,
  kind             TEXT NOT NULL DEFAULT 'full' CHECK (kind IN ('deposit','full','balance')),
  client_name      TEXT,
  client_company   TEXT,
  client_email     TEXT,
  client_phone     TEXT,
  title            TEXT,
  currency         TEXT NOT NULL DEFAULT 'NGN' CHECK (currency IN ('NGN','USD','GBP')),
  items_json       TEXT NOT NULL DEFAULT '[]',
  discount_pct     REAL NOT NULL DEFAULT 0,
  vat              INTEGER NOT NULL DEFAULT 1,
  deposit_pct      REAL,
  subtotal         REAL NOT NULL DEFAULT 0,
  discount         REAL NOT NULL DEFAULT 0,
  tax              REAL NOT NULL DEFAULT 0,
  total            REAL NOT NULL DEFAULT 0,              -- full value of the work
  amount_due       REAL NOT NULL DEFAULT 0,              -- what this invoice asks for
  amount_paid      REAL NOT NULL DEFAULT 0,
  issued_at        TEXT NOT NULL DEFAULT (date('now')),
  due_date         TEXT,
  status           TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid','receipt_submitted','part_paid','paid','void')),
  notes            TEXT,
  token            TEXT NOT NULL UNIQUE,
  code_hash        TEXT,
  gate_secret      TEXT NOT NULL,
  revoked          INTEGER NOT NULL DEFAULT 0,
  first_viewed_at  TEXT,
  last_viewed_at   TEXT,
  view_count       INTEGER NOT NULL DEFAULT 0,
  paid_at          TEXT,
  reminded_at      TEXT,
  created_by       TEXT,
  updated_by       TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT DEFAULT (datetime('now'))
);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_proposal ON invoices(proposal_id);

CREATE TABLE invoice_payments (
  id           TEXT PRIMARY KEY,
  invoice_id   TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount       REAL NOT NULL,
  currency     TEXT NOT NULL,
  method       TEXT NOT NULL DEFAULT 'bank_transfer',    -- paystack | bank_transfer | cash | other
  reference    TEXT UNIQUE,                              -- Paystack reference makes webhook + callback idempotent
  note         TEXT,
  paid_at      TEXT NOT NULL DEFAULT (datetime('now')),
  recorded_by  TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by   TEXT,
  updated_at   TEXT DEFAULT (datetime('now'))
);
CREATE INDEX idx_invoice_payments ON invoice_payments(invoice_id);
CREATE INDEX idx_invoice_payments_at ON invoice_payments(paid_at);

CREATE TABLE payment_receipts (
  id            TEXT PRIMARY KEY,
  invoice_id    TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  r2_key        TEXT NOT NULL,                           -- private/receipts/...
  filename      TEXT,
  content_type  TEXT NOT NULL,
  size          INTEGER NOT NULL DEFAULT 0,
  note          TEXT,
  ip_hash       TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by    TEXT,
  updated_at    TEXT DEFAULT (datetime('now'))
);
CREATE INDEX idx_payment_receipts ON payment_receipts(invoice_id);

-- Where clients can pay. Nothing is seeded: account details are added in Studio by an admin.
CREATE TABLE payment_methods (
  id            TEXT PRIMARY KEY,
  type          TEXT NOT NULL CHECK (type IN ('ng_bank','intl_bank','other','paystack')),
  label         TEXT NOT NULL,
  currencies    TEXT NOT NULL DEFAULT 'NGN',             -- comma-separated: NGN,USD,GBP
  details_json  TEXT NOT NULL DEFAULT '{}',
  enabled       INTEGER NOT NULL DEFAULT 1,
  sort          INTEGER NOT NULL DEFAULT 0,
  created_by    TEXT,
  updated_by    TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT DEFAULT (datetime('now'))
);
