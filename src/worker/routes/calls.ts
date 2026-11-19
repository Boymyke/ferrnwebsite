/* Cold calls: companies Michael phones instead of (or as well as) emailing.
 * The call list lives in R2 (private/studio/calls.json), so no database change is needed. Each entry points at a
 * lead; the lead row stays the source of truth for the company's details. Call outcomes are also written back to
 * the lead (status, next action, a dated note), so the rest of Studio sees what happened on the phone. */
import { Hono } from 'hono';
import type { AppEnv, Bindings } from '../lib/env';
import { all, clamp, first, run } from '../lib/db';
import { requireUser } from '../lib/auth';
import { audit } from '../lib/audit';
import { complete, extractJson } from '../lib/ai';
import { engineCall, engineConfigured } from '../lib/engine';

export type CallOutcome = 'to_call' | 'no_answer' | 'callback' | 'interested' | 'mockup' | 'meeting' | 'not_interested' | 'wrong_number' | 'do_not_call';
export type CallLog = { at: string; by: string; outcome: CallOutcome; note?: string };
export type CallItem = {
  id: string; lead_id: string; status: CallOutcome; attempts: number;
  added_at: string; added_by: string; last_called_at?: string | null; callback_at?: string | null;
  notes?: string | null; log: CallLog[]; prep?: Record<string, unknown> | null; prep_at?: string | null;
};

const KEY = 'private/studio/calls.json';
const iso = () => new Date().toISOString();
const newId = () => 'c' + crypto.randomUUID().replace(/-/g, '').slice(0, 14);
export const OUTCOMES: CallOutcome[] = ['to_call', 'no_answer', 'callback', 'interested', 'mockup', 'meeting', 'not_interested', 'wrong_number', 'do_not_call'];
const LABEL: Record<CallOutcome, string> = {
  to_call: 'To call', no_answer: 'No answer', callback: 'Call back', interested: 'Interested', mockup: 'Wants the free mock-up',
  meeting: 'Meeting booked', not_interested: 'Not interested', wrong_number: 'Wrong number', do_not_call: 'Do not call',
};

export async function loadCalls(env: Bindings): Promise<CallItem[]> {
  const o = await env.MEDIA.get(KEY);
  if (!o) return [];
  try { return (await o.json()) as CallItem[]; } catch { return []; }
}
async function saveCalls(env: Bindings, items: CallItem[]) {
  await env.MEDIA.put(KEY, JSON.stringify(items.slice(0, 2000)), { httpMetadata: { contentType: 'application/json' } });
}
/** In the email section already: the engine or the autopilot has it, or it has an email thread. Those stay email-only. */
const IN_EMAIL = "(origin IN ('engine','maps') OR found_by IN ('auto','claude') OR thread_id IS NOT NULL OR (last_contact IS NOT NULL AND COALESCE(next_action, '') NOT LIKE 'Cold call%'))";
const digitsOf = (p?: string | null) => String(p ?? '').replace(/\D/g, '').replace(/^(234|44|1)/, '').replace(/^0/, '');
const domainOfUrl = (u?: string | null) => String(u ?? '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split(/[/?#]/)[0];

/** Tells the engine these companies are phoned, not emailed: it suppresses their addresses and lists them in the brief. */
async function markNoEmail(env: Bindings, leadIds: string[]) {
  if (!leadIds.length || !engineConfigured(env)) return;
  const rows = await all<any>(env.DB, `SELECT company, email, phone, website FROM leads WHERE id IN (${leadIds.map(() => '?').join(',')})`, ...leadIds);
  await engineCall(env, 'dashAction', ['doNotEmail', { items: rows.map((r) => ({ company: r.company, email: r.email, phone: r.phone, domain: domainOfUrl(r.website) })) }]);
}

/** Adds leads to the call list. Skips ones already on it and ones already in email outreach. */
export async function addToCalls(env: Bindings, leadIds: string[], by: string, ctx?: { waitUntil(p: Promise<unknown>): void }): Promise<{ added: number; in_email: string[] }> {
  const items = await loadCalls(env);
  const have = new Set(items.map((i) => i.lead_id));
  const ids = [...new Set(leadIds.filter((id) => id && !have.has(id)))];
  const emailSide = new Set<string>();
  for (let i = 0; i < ids.length; i += 80) {
    const chunk = ids.slice(i, i + 80);
    for (const r of await all<any>(env.DB, `SELECT id, company FROM leads WHERE id IN (${chunk.map(() => '?').join(',')}) AND ${IN_EMAIL}`, ...chunk)) emailSide.add(r.id);
  }
  const added: string[] = [];
  for (const id of ids) {
    if (emailSide.has(id)) continue;
    items.unshift({ id: newId(), lead_id: id, status: 'to_call', attempts: 0, added_at: iso(), added_by: by, log: [] });
    added.push(id);
  }
  if (added.length) {
    await saveCalls(env, items);
    const p = markNoEmail(env, added).catch((e) => console.warn('doNotEmail', e));
    if (ctx) ctx.waitUntil(p); else await p;
  }
  return { added: added.length, in_email: [...emailSide] };
}

const LEAD_COLS = 'id, company, niche, city, country, website, email, phone, contact_name, role, tier, score, gaps, pitch, status, notes, source, next_action';

export const callsApi = new Hono<AppEnv>();
callsApi.use('*', requireUser('sales'));

callsApi.get('/', async (c) => {
  const items = await loadCalls(c.env);
  const ids = items.map((i) => i.lead_id);
  const leads: Record<string, any> = {};
  for (let i = 0; i < ids.length; i += 80) {
    const chunk = ids.slice(i, i + 80);
    for (const l of await all<any>(c.env.DB, `SELECT ${LEAD_COLS} FROM leads WHERE id IN (${chunk.map(() => '?').join(',')})`, ...chunk)) leads[l.id] = l;
  }
  const rows = items.filter((i) => leads[i.lead_id]).map((i) => ({ ...i, lead: leads[i.lead_id] }));
  return c.json({ ok: true, rows, outcomes: OUTCOMES.map((o) => [o, LABEL[o]]) });
});

callsApi.post('/', async (c) => {
  const u = c.get('user')!;
  const b = (await c.req.json().catch(() => ({}))) as { lead_ids?: string[] };
  const ids = (b.lead_ids ?? []).map((x) => clamp(x, 40)).filter(Boolean).slice(0, 200);
  const r = await addToCalls(c.env, ids, u.name, c.executionCtx);
  if (r.added) await audit(c, 'calls', null, 'add', `${u.name} added ${r.added} compan${r.added === 1 ? 'y' : 'ies'} to Cold calls`);
  return c.json({ ok: true, added: r.added, in_email: r.in_email.length });
});

/** Logs a call (or just updates notes / the callback time). Outcomes are written back to the lead. */
callsApi.patch('/:id', async (c) => {
  const u = c.get('user')!;
  const b = (await c.req.json().catch(() => ({}))) as { outcome?: CallOutcome; note?: string; notes?: string; callback_at?: string | null };
  const items = await loadCalls(c.env);
  const it = items.find((x) => x.id === c.req.param('id'));
  if (!it) return c.json({ ok: false, error: 'Not on the call list' }, 404);
  if (typeof b.notes === 'string') it.notes = clamp(b.notes, 4000);
  if (b.callback_at === null || typeof b.callback_at === 'string') it.callback_at = b.callback_at ? clamp(b.callback_at, 40) : null;
  if (b.outcome && OUTCOMES.includes(b.outcome)) {
    const note = clamp(b.note ?? '', 1000);
    it.status = b.outcome;
    if (b.outcome !== 'to_call') { it.attempts += 1; it.last_called_at = iso(); }
    it.log.unshift({ at: iso(), by: u.name, outcome: b.outcome, ...(note ? { note } : {}) });
    it.log = it.log.slice(0, 50);
    const lead = await first<any>(c.env.DB, 'SELECT id, company, status, notes FROM leads WHERE id = ?', it.lead_id);
    if (lead && b.outcome !== 'to_call') {
      const day = new Date().toISOString().slice(0, 10);
      const line = `${day} call (${u.name}): ${LABEL[b.outcome]}${note ? ` · ${note}` : ''}`;
      const set: Record<string, unknown> = { notes: [line, lead.notes].filter(Boolean).join('\n').slice(0, 8000), last_contact: day };
      if (b.outcome === 'interested') { set.status = 'Interested'; set.next_action = 'Cold call: follow up what they asked for'; }
      if (b.outcome === 'mockup') {
        set.status = 'Interested'; set.next_action = 'Cold call: make the free homepage mock-up';
        set.needs_you = 'Y'; set.needs_you_reason = `Preview requested: said yes to a free homepage mock-up on a call${note ? `. ${note}` : ''}`.slice(0, 500);
      }
      if (b.outcome === 'meeting') { set.status = 'Call booked'; set.next_action = `Cold call: meeting booked${note ? ` (${note})` : ''}`.slice(0, 300); }
      if (b.outcome === 'callback') set.next_action = `Cold call: call back${it.callback_at ? ` ${it.callback_at.replace('T', ' ').slice(0, 16)}` : ''}`;
      if (b.outcome === 'not_interested' || b.outcome === 'do_not_call') { set.status = 'Lost'; set.next_action = b.outcome === 'do_not_call' ? 'Do not call again (asked on a call)' : 'Said no on a call'; }
      if (b.outcome === 'wrong_number') set.next_action = 'Cold call: wrong number, find the right one';
      const keys = Object.keys(set);
      await run(c.env.DB, `UPDATE leads SET ${keys.map((k) => `${k} = ?`).join(', ')}, updated_by = ?, updated_at = datetime('now') WHERE id = ?`, ...keys.map((k) => set[k]), u.name, lead.id);
      await audit(c, 'leads', lead.id, 'call', `${u.name} called ${lead.company}: ${LABEL[b.outcome]}`);
    }
  }
  await saveCalls(c.env, items);
  return c.json({ ok: true, item: it });
});

callsApi.delete('/:id', async (c) => {
  const items = await loadCalls(c.env);
  const i = items.findIndex((x) => x.id === c.req.param('id'));
  if (i < 0) return c.json({ ok: false }, 404);
  items.splice(i, 1);
  await saveCalls(c.env, items);
  return c.json({ ok: true });
});

/** Tailors the call guide to this company: opener, the finding said out loud, questions, likely objections. */
callsApi.post('/:id/prep', async (c) => {
  const items = await loadCalls(c.env);
  const it = items.find((x) => x.id === c.req.param('id'));
  if (!it) return c.json({ ok: false, error: 'Not on the call list' }, 404);
  const lead = await first<any>(c.env.DB, `SELECT ${LEAD_COLS} FROM leads WHERE id = ?`, it.lead_id);
  if (!lead) return c.json({ ok: false, error: 'Lead not found' }, 404);
  const abroad = lead.country && !/nigeria/i.test(lead.country);
  let r: { text: string };
  try { r = await complete(c.env, [
    { role: 'system', content: `You prepare a short cold-call guide for Michael, who runs Ferrn Digital Agency in Lagos (websites first, then web apps such as portals and booking or tracking systems).
He is phoning a business he has never spoken to. The call must feel easy and respectful, give the owner something useful in the first 30 seconds, and end with a small yes: a free homepage mock-up sent by email or WhatsApp, or a 15-minute look at it together.
Use ONLY the facts given about the company. Never invent numbers, clients, awards or problems. If a fact is marked unconfirmed, say "check first".
Voice: ${abroad ? 'plain, polite UK/US business English' : 'warm, respectful Nigerian business English (sir/ma is fine, first names once invited)'}. Short spoken sentences, the way people actually talk on the phone. No jargon, no hype. Never talk about enquiries or leads.
Real past work he may mention, only if it is the same kind of business: Gromzia Ventures (logistics website), Relay (freight operations web app), M-P Infrastructure (engineering and construction site), Synergix Africa (entrepreneurship platform), PWAN EHA (AI legal guidance chatbot), Insightblitz, Aroda.
Prices if asked: websites ${abroad ? 'from $3,000' : '₦1.5M to ₦5M'}; web apps ${abroad ? 'from $8,000' : '₦5M to ₦20M+'}; always say the mock-up comes first and is free.
Return JSON: {"gatekeeper": string, "opener": string, "finding": string, "why_it_matters": string, "questions": [string, string, string, string], "tell_them": [string, string, string], "objections": [{"they_say": string, "you_say": string}, {"they_say": string, "you_say": string}, {"they_say": string, "you_say": string}], "close": string, "whatsapp_after": string, "watch_out": string}
- gatekeeper: what to say to a receptionist to reach the decision maker (one or two sentences).
- opener: greeting, who he is, why he is calling, and asking if it is a good moment (under 40 words).
- finding: the specific website problem said out loud, in one or two sentences.
- why_it_matters: what that problem does to this business, in their world (one or two sentences).
- questions: four open questions to get them talking about how they win work and what they want the site to do.
- tell_them: three short things to say about the fix and about Ferrn (proof only if same sector).
- objections: the three objections this business is most likely to raise, each with a calm answer that agrees first, then offers the free mock-up.
- close: the exact words for the free mock-up ask and next step.
- whatsapp_after: the WhatsApp message to send straight after the call (or after no answer), under 50 words.
- watch_out: one line on anything to check before dialling (from the notes), or "".
Hard rules: never use the words "enquiry", "enquiries", "inquiry", "inquiries", "leads", "functional website", "online presence", "customer experience", "I noticed" or "I came across". Questions are open (how, what, who, when), about how they win work, what clients do before they call, who looks after the site, and what is coming up for the business; never leading questions like "How could a website benefit you?". Each objection answer is specific to this company: agree first, ask or add one thing, then offer the free mock-up. The opener names the specific thing found, briefly, before asking for permission.
Example of the standard (different company; never copy it): opener "Good morning, is this Mrs Adeyemi? My name is Michael, I run Ferrn, a web design company here in Lagos. I looked at your school online and found that the admission form is a Word file parents have to print. Have I caught you at a bad time?"; question "When a parent hears about Greenfield and looks you up, what do they usually do next?"; objection {"they_say": "Parents just call the office.", "you_say": "That makes sense, and the office knows them well. Many parents now look a school up at night, before they call. Can I send you a free mock-up of an admissions page so you can see what they would see?"}.` },
    { role: 'user', content: JSON.stringify({ company: lead.company, contact: lead.contact_name, role: lead.role, sector: lead.niche, city: lead.city, country: lead.country, website: lead.website,
      what_we_found: lead.gaps, pitch: lead.pitch, notes: lead.notes, phone_known: !!lead.phone }) },
  ], { maxTokens: 1400, json: true, bucket: 'studio', temperature: 0.5 }); }
  catch (e) { console.warn('call prep', e); return c.json({ ok: false, error: 'Could not prepare the call right now. The guide below still works.' }, 502); }
  const prep = extractJson<Record<string, unknown>>(r.text, {});
  if (!prep || !prep.opener) return c.json({ ok: false, error: 'Could not prepare the call. Try again.' }, 502);
  it.prep = prep; it.prep_at = iso();
  await saveCalls(c.env, items);
  return c.json({ ok: true, prep });
});

/* ── upload: a spreadsheet of companies (CSV or Excel, read in the browser) → leads + the call list ──
 * Columns are matched by name, so the directory sheet Michael keeps works as it is, and so does a simpler one
 * (Company, Phone, Email, Contact, Sector, City, Notes). Re-uploading the same sheet updates those companies
 * (matched by email, then by company name) and never touches their status, call notes or history. */
const FREE_MAIL = /@(gmail|yahoo|ymail|hotmail|outlook|live|icloud|aol|proton(mail)?)\./i;
const DIRECTORY_HOST = /businesslist|finelib|yell\.|yelp\.|bbb\.org|vconnect|connectnigeria|google\.|facebook|instagram|linkedin/i;
const pick = (row: Record<string, string>, ...names: RegExp[]) => {
  for (const re of names) for (const [k, v] of Object.entries(row)) if (re.test(k.trim()) && String(v ?? '').trim()) return String(v).trim();
  return '';
};
function nicheOf(sector: string): string {
  const s = sector.toLowerCase();
  if (/freight|logistic|haulage|shipping|clearing|moving|courier|cargo/.test(s)) return 'logistics';
  if (/facility/.test(s)) return 'facility';
  if (/security|guard/.test(s)) return 'security';
  if (/estate|property|real estate|surveyor|valuation|housing|homes/.test(s)) return 'realestate';
  if (/engineer|structural|civil/.test(s)) return 'engineering';
  if (/construct|build/.test(s)) return 'construction';
  if (/diagnostic|laborator|\blab\b/.test(s)) return 'lab';
  if (/hospital|clinic|medical centre|health/.test(s)) return 'clinic';
  if (/pharma|drug|medical|equipment supply/.test(s)) return 'pharma';
  if (/school|college|academy|education/.test(s)) return 'school';
  if (/manufactur|factory|distribut|wholesale|trading/.test(s)) return 'manufacturing';
  if (/insurance|broker/.test(s)) return 'insurance';
  if (/microfinance|finance|loan|lender/.test(s)) return 'microfinance';
  if (/law|legal|solicitor|audit|account/.test(s)) return 'professional';
  if (/staffing|recruit|outsourc/.test(s)) return 'staffing';
  if (/care\b|home care/.test(s)) return 'homecare';
  return 'other';
}
function countryOfPlace(where: string): string {
  if (/\b(uk|united kingdom|london|birmingham|manchester|england|scotland|wales)\b/i.test(where)) return 'United Kingdom';
  if (/\b(usa|united states|texas|houston|new york|atlanta|maryland)\b/i.test(where)) return 'United States';
  if (/\b(canada|toronto|ontario|calgary|alberta)\b/i.test(where)) return 'Canada';
  if (/\b(ireland|dublin)\b/i.test(where)) return 'Ireland';
  if (/\b(uae|dubai|abu dhabi)\b/i.test(where)) return 'UAE';
  return 'Nigeria';
}
const domainIn = (...texts: string[]) => {
  for (const t of texts) {
    const m = t.match(/\b((?:[a-z0-9-]+\.)+(?:com|ng|net|org|co\.uk|uk|ca|us|io|biz|info)(?:\.ng)?)\b/i);
    if (m && !DIRECTORY_HOST.test(m[1]) && !/@/.test(t.slice(Math.max(0, (m.index ?? 0) - 1), m.index ?? 0))) return m[1].toLowerCase();
  }
  return '';
};

export type ImportResult = { added: number; updated: number; skipped: { row: number; why: string }[]; to_calls: number; in_email: string[] };
export async function importCompanies(env: Bindings, rows: Record<string, string>[], by: string, toCalls: boolean, sourceName: string, ctx?: { waitUntil(p: Promise<unknown>): void }): Promise<ImportResult> {
  const out: ImportResult = { added: 0, updated: 0, skipped: [], to_calls: 0, in_email: [] };
  const callIds: string[] = [];
  const onCalls = new Set((await loadCalls(env)).map((i) => i.lead_id));
  const day = new Date().toISOString().slice(0, 10);
  // Everything we already have, to match on email, phone, website or name (so nothing is added twice).
  const existing = await all<any>(env.DB, `SELECT id, company, email, phone, website, CASE WHEN ${IN_EMAIL} THEN 1 ELSE 0 END AS in_email FROM leads`);
  const byEmail = new Map<string, any>(), byPhone = new Map<string, any>(), byDomain = new Map<string, any>(), byName = new Map<string, any>();
  const norm = (n: string) => n.toLowerCase().replace(/\b(limited|ltd|plc|llc|inc|company|co|nigeria|nig)\b\.?/g, '').replace(/[^a-z0-9]/g, '');
  const index = (l: any) => {
    if (l.email) byEmail.set(String(l.email).toLowerCase(), l);
    const d = digitsOf(l.phone); if (d.length >= 7) byPhone.set(d, l);
    const w = domainOfUrl(l.website); if (w) byDomain.set(w, l);
    if (l.company) byName.set(norm(l.company), l);
  };
  existing.forEach(index);
  const seenInFile = new Set<string>();
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const company = clamp(pick(r, /^company/i, /^business/i, /^name$/i, /organi[sz]ation/i), 160);
    if (!company) { if (Object.values(r).some((v) => String(v ?? '').trim())) out.skipped.push({ row: i + 2, why: 'no company name' }); continue; }
    const email = clamp(pick(r, /^e-?mail/i), 120).toLowerCase().replace(/^mailto:/, '');
    const phone = clamp(pick(r, /phone|mobile|\btel\b|whatsapp/i), 60);
    const contactRaw = pick(r, /decision/i, /^contact/i, /\b(owner|director|ceo|md|manager|person)\b/i);
    const cm = contactRaw.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
    const contact = clamp(cm ? cm[1] : contactRaw, 120), role = clamp(pick(r, /^role|title|position/i) || (cm ? cm[2] : ''), 80);
    const sector = pick(r, /sector|industry|niche|category/i);
    const where = pick(r, /^where|city|location|address|area/i);
    const tierRaw = pick(r, /^tier/i).toUpperCase();
    const tier = /^[ABC]$/.test(tierRaw) ? tierRaw : null;
    const gaps = clamp(pick(r, /why|need|gap|problem|finding|pitch/i), 1000);
    const size = pick(r, /size/i), siteStatus = pick(r, /website status|site status/i), check = pick(r, /^check|caution|warning/i);
    const listing = pick(r, /listing|source url|^url$|link/i), directory = pick(r, /directory|^source$/i);
    const website = clamp(pick(r, /^website$|^site$|^web$|^domain/i) || domainIn(siteStatus, gaps), 200) || null;
    const extra = clamp(pick(r, /^notes?$|comment/i), 1000);
    const country = countryOfPlace(where);
    if (!phone && !email) { out.skipped.push({ row: i + 2, why: `${company}: no phone or email` }); continue; }
    const fileKey = norm(company);
    if (seenInFile.has(fileKey)) { out.skipped.push({ row: i + 2, why: `${company}: listed twice in the file` }); continue; }
    seenInFile.add(fileKey);
    const d = digitsOf(phone), w = domainOfUrl(website);
    let lead = (email && byEmail.get(email)) || (d.length >= 7 && byPhone.get(d)) || (w && byDomain.get(w)) || byName.get(fileKey) || null;
    // Already in the email section (and not one of ours from Cold calls): leave it there, don't add it twice.
    if (lead && lead.in_email && !onCalls.has(lead.id)) { out.in_email.push(company); continue; }
    const notes = [
      size && `Size: ${size}`, siteStatus && `Website (checked): ${siteStatus}`, sector && `Sector: ${sector}`,
      tierRaw && !tier && `Tier: ${tierRaw.toLowerCase()} (to confirm)`, check && `Check first: ${check}`,
      email && FREE_MAIL.test(email) && 'Email is a free Gmail/Yahoo-type address', extra,
    ].filter(Boolean).join('\n');
    const source = clamp(['Upload', sourceName, directory, listing].filter(Boolean).join(' · '), 300);
    if (lead) {
      // Update the company's details from the sheet; status, call notes, history and next action stay as they are.
      const set: Record<string, unknown> = {};
      if (email) set.email = email; if (phone) set.phone = phone; if (contact) set.contact_name = contact; if (role) set.role = role;
      if (sector) set.niche = nicheOf(sector); if (where) { set.city = clamp(where, 60); set.country = country; }
      if (tier) set.tier = tier; if (gaps) set.gaps = gaps; if (website) set.website = website;
      const keys = Object.keys(set);
      if (keys.length) await run(env.DB, `UPDATE leads SET ${keys.map((k) => `${k} = ?`).join(', ')}, updated_by = ?, updated_at = datetime('now') WHERE id = ?`, ...keys.map((k) => set[k]), by, lead.id);
      out.updated++;
    } else {
      const id = 'L-' + crypto.randomUUID().replace(/-/g, '').slice(0, 12);
      await run(env.DB,
        `INSERT INTO leads (id, created, niche, company, website, email, phone, contact_name, role, city, country, tier, gaps, status, source, origin, notes, next_action, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'New', ?, 'studio', ?, ?, ?)`,
        id, day, nicheOf(sector), company, website, email || null, phone || null, contact || null, role || null, clamp(where, 60) || null, country, tier, gaps || null,
        source, notes || null, phone ? 'Cold call' : 'Email first', by);
      lead = { id, company, email, phone, website, in_email: 0 };
      index(lead);
      out.added++;
    }
    if (toCalls && phone) callIds.push(lead.id);
  }
  if (callIds.length) { const a = await addToCalls(env, callIds, by, ctx); out.to_calls = a.added; }
  return out;
}

callsApi.post('/import', async (c) => {
  const u = c.get('user')!;
  const b = (await c.req.json().catch(() => ({}))) as { rows?: Record<string, string>[]; to_calls?: boolean; file?: string };
  const rows = Array.isArray(b.rows) ? b.rows.slice(0, 2000) : [];
  if (!rows.length) return c.json({ ok: false, error: 'The file has no rows.' }, 422);
  const r = await importCompanies(c.env, rows, u.name, b.to_calls !== false, clamp(b.file ?? '', 120), c.executionCtx);
  await audit(c, 'leads', null, 'import', `${u.name} uploaded ${clamp(b.file ?? 'a sheet', 120)}: ${r.added} new, ${r.updated} updated, ${r.to_calls} added to Cold calls, ${r.in_email.length} already in email outreach`);
  return c.json({ ok: true, ...r });
});
