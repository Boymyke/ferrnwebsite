-- WhatsApp bot (Cloud API): contacts, message log, automation queue.
CREATE TABLE wa_contacts (
  wa_id           TEXT PRIMARY KEY,           -- digits-only E.164, e.g. 2348031234567
  name            TEXT,
  lead_id         TEXT,
  opted_in        INTEGER NOT NULL DEFAULT 0, -- 1 = consented on a form or messaged us first
  opted_in_at     TEXT,
  opted_out_at    TEXT,                        -- set by STOP; nothing automated is sent after this
  source          TEXT,
  bot_paused      INTEGER NOT NULL DEFAULT 0,  -- 1 = a human has taken over the chat
  needs_human     INTEGER NOT NULL DEFAULT 0,
  last_inbound_at TEXT,
  last_outbound_at TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_wa_contacts_inbound ON wa_contacts(last_inbound_at);

CREATE TABLE wa_messages (
  id         TEXT PRIMARY KEY,
  wa_id      TEXT NOT NULL,
  direction  TEXT NOT NULL CHECK (direction IN ('in','out')),
  kind       TEXT NOT NULL DEFAULT 'text',
  body       TEXT,
  template   TEXT,
  status     TEXT,                              -- received | sent | delivered | read | failed
  wa_msg_id  TEXT,
  error      TEXT,
  sent_by    TEXT,                              -- bot | automation | <user name>
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_wa_messages_contact ON wa_messages(wa_id, created_at);
CREATE INDEX idx_wa_messages_waid ON wa_messages(wa_msg_id);

CREATE TABLE wa_queue (
  id          TEXT PRIMARY KEY,
  wa_id       TEXT NOT NULL,
  template    TEXT NOT NULL,
  params_json TEXT NOT NULL DEFAULT '[]',
  send_after  TEXT NOT NULL,
  sequence    TEXT,                             -- e.g. followup:<lead id>, reminder:<meeting id>
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','cancelled')),
  error       TEXT,
  sent_at     TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_wa_queue_due ON wa_queue(status, send_after);
