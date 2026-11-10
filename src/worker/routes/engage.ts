import { Hono } from 'hono';
import type { AppEnv, Bindings } from '../lib/env';
import { all, clamp, first, getSetting, setSetting } from '../lib/db';
import { requireUser } from '../lib/auth';
import { audit } from '../lib/audit';
import { complete, extractJson } from '../lib/ai';
import { chainReason } from '../lib/maps';

/* Social engagement, assisted.
 *   DMs:          AI drafts an Instagram DM or a LinkedIn connection note + message for a lead.
 *   Interactions: AI drafts comments for someone else's post; you like it and post the comment.
 * Instagram and LinkedIn don't let apps send cold DMs or like/comment on other people's posts, and
 * automating it from a browser breaks their terms and gets accounts restricted. So Studio does the
 * thinking and the writing; "Open & send" copies the message, opens the DM thread itself (ig.me/m/<handle>)
 * and marks it sent, and "Send next" walks the whole queue one click at a time.
 * Everything lives in one private R2 object (strongly consistent, never served under /media). */

type Platform = 'instagram' | 'linkedin';
export type EngageItem = {
  id: string; kind: 'dm' | 'comment'; platform: Platform; status: 'draft' | 'sent' | 'skipped';
  lead_id?: string | null; company?: string | null; person?: string | null;
  url: string;                  // profile (DM) or post (comment)
  context?: string | null;      // what the post says / notes about the person
  drafts: string[]; note?: string | null; // note: LinkedIn connection note (300 chars)
  sent_text?: string | null; liked?: boolean;
  created_at: string; created_by: string; done_at?: string | null; done_by?: string | null; follow_up_at?: string | null;
  auto?: boolean; // drafted by the autopilot
  v?: number;     // 2 = written with the varied-opening writer
};
const KEY = 'private/studio/engage.json';
const MAX = 3000;

async function load(env: Bindings): Promise<EngageItem[]> {
  const o = await env.MEDIA.get(KEY);
  if (!o) return [];
  try { return (await o.json()) as EngageItem[]; } catch { return []; }
}
async function save(env: Bindings, items: EngageItem[]) {
  await env.MEDIA.put(KEY, JSON.stringify(items.slice(0, MAX)), { httpMetadata: { contentType: 'application/json' } });
}
const iso = () => new Date().toISOString();
const newId = () => 'g' + crypto.randomUUID().replace(/-/g, '').slice(0, 14);
const platformOf = (v: unknown): Platform => (v === 'linkedin' ? 'linkedin' : 'instagram');
/** Only real profile/post links on the two platforms (they open in a new tab from Studio). */
function cleanUrl(v: unknown, platform: Platform): string | null {
  const s = String(v ?? '').trim();
  if (!s) return null;
  if (platform === 'instagram' && /^@?[A-Za-z0-9._]{1,30}$/.test(s)) return `https://www.instagram.com/${s.replace(/^@/, '')}/`;
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    const host = u.hostname.replace(/^www\./, '').toLowerCase();
    const ok = platform === 'instagram' ? host === 'instagram.com' : host === 'linkedin.com' || host.endsWith('.linkedin.com');
    return ok && u.protocol === 'https:' ? u.toString().slice(0, 500) : null;
  } catch { return null; }
}

const VOICE = `You write as Michael, founder of Ferrn Digital Agency in Lagos (websites, web apps, AI automation; ferrnagency.com).
Voice: warm, direct, Nigerian-professional English, plain words, no hype, no exclamation marks, no emojis unless the platform context clearly invites one, no hashtags.
Write complete sentences with normal punctuation (full stops, question marks) and line breaks between ideas in longer messages.
Never invent facts about the person or their business. Use only what you are given. Never include links unless asked.`;

/* ── DMs that don't all sound the same ──
 * The first words decide whether a DM gets read. Left alone, the model opens every message with
 * "I noticed your…", so the shape of each draft is chosen here, in code: three different opening moves per
 * lead, picked at random, with the stock openers banned and checked after the model answers. */
const OPENERS: { key: string; how: string; start: string }[] = [
  { key: 'question', how: 'Open with a short, genuine question about how they handle one specific thing in their business (enquiries, bookings, quotes, admissions, tracking). Then say why you ask.', start: 'a question word such as "How", "Do", "What" or "When"' },
  { key: 'detail', how: 'Open with the specific detail itself, quoted or named exactly as it appears on their site (a service, a programme, a number, an area they serve). Then the idea it gave you.', start: 'the detail itself, never with "I" or "Your"' },
  { key: 'customer', how: 'Open from their customer\'s side: describe in one line what someone looking for their service tonight would run into on their site. Then the fix.', start: 'the customer, e.g. "Someone looking for…" or "A parent comparing…"' },
  { key: 'proof', how: 'Open with one short line about a result or build from Ferrn\'s real past work that is close to their business, then connect it to them in the next line.', start: 'the past project or what it did, e.g. "We rebuilt…" or "Last year a freight company…"' },
  { key: 'greeting', how: 'Open with "Hi" and their first name (or the company name plus "team" if no name is given), then go straight to one useful idea for their business in plain words. No small talk.', start: '"Hi " and the name' },
  { key: 'compliment', how: 'Open with one honest, specific thing they do well (from the facts given), in a few words, then the one thing that undersells it online.', start: 'the thing they do well, never with "I love" or "Great"' },
  { key: 'direct', how: 'Open by saying in one plain line who you are and the one thing you would fix first for them. Short sentences.', start: '"Michael here" or "Michael from Ferrn"' },
];
const STOCK = /^\W*(i\s+(noticed|see|saw|came across|was (looking|checking|browsing|going)|just (saw|came|checked)|observed|hope|wanted to reach|stumbled)|your (website|company|business|firm|page|team|site|instagram|school|clinic|practice)\b|hope (you|this)|just (wanted|reaching)|i'?m reaching out|reaching out)/i;
const firstWords = (t: string, n = 2) => t.trim().toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/).slice(0, n).join(' ');
function shuffle<T>(xs: T[]): T[] { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
/** Keeps drafts that don't open with a stock line, don't share an opening with each other or with recent DMs. */
export function cleanDrafts(drafts: string[], recent: string[]): string[] {
  const seen = new Set(recent.map((r) => firstWords(r, 3)));
  const out: string[] = [];
  for (const d of drafts) {
    const t = String(d ?? '').trim().replace(/^["“]|["”]$/g, '');
    if (t.length < 40 || STOCK.test(t)) continue;
    if (/\b(your|on your|at your) (instagram|ig|linkedin)( page| profile| feed| account)?\b/i.test(t)) continue; // we only ever read their website
    const k = firstWords(t, 3);
    if (seen.has(k) || out.some((o) => firstWords(o, 1) === firstWords(t, 1))) continue;
    seen.add(k); out.push(t);
  }
  return out;
}

async function draftDm(env: Bindings, platform: Platform, ctx: Record<string, unknown>, recent: string[] = []) {
  const li = platform === 'linkedin';
  let best: string[] = []; let note: string | null = null;
  for (let attempt = 0; attempt < 3 && best.length < 3; attempt++) {
    const moves = shuffle(OPENERS).filter((o) => o.key !== 'greeting' || ctx.person || ctx.company).slice(0, 3);
    const spec = `${li ? 'Return JSON {"note": string, "drafts": [string, string, string]}.\n"note" is a LinkedIn connection request note, max 280 characters, personal, no pitch, about one specific thing they do.\n"drafts" are 3 first messages to send once they accept, 60-100 words each.'
      : 'Return JSON {"drafts": [string, string, string]}. 3 Instagram DMs, 35-65 words each, the way a person types a DM: short lines, no formal sign-off.'}
Each draft uses a DIFFERENT opening move. Follow these exactly, in this order:
${moves.map((m, i) => `Draft ${i + 1}: ${m.how} It must start with ${m.start}.`).join('\n')}

Rules for every draft:
- Everything you know about them comes from THEIR WEBSITE and the notes given. You have not seen their ${li ? 'LinkedIn' : 'Instagram'} page, so never mention it, their posts, their feed or their followers. Say "your site" when you refer to what you saw.
- Use one concrete detail from the facts given (a named service, place, number, programme, or one of gaps_we_saw). No generic praise such as "strong online presence", "wide range of services" or "great reviews".
- Never start a draft with "I noticed", "I see", "I saw", "I came across", "Your website", "Your company", "I hope" or "Just". No two drafts may start with the same word.
- One idea per message: the single change that would bring them more enquiries, bookings or saved time. Say what it does for them, in plain words.
- Say who you are once, briefly (Michael, Ferrn, we build websites and web apps), anywhere except the first line unless the move says so.
- End with one easy question that takes a yes, a no or a few words to answer. Vary the question between drafts. Never ask for a call in the first message.
- No links, no prices, no "DM me", no hashtags, no emojis.${recent.length ? `\n- These openings were used on other people recently. Do not reuse them or anything close: ${recent.slice(0, 12).map((r) => `"${r.split(/\s+/).slice(0, 6).join(' ')}…"`).join(', ')}` : ''}${attempt ? '\n- Your last attempt broke the opening rules. Check the first three words of every draft before you answer.' : ''}`;
    try {
      const r = await complete(env, [
        { role: 'system', content: `${VOICE}\nReal past work you may cite (never invent others or any numbers): Gromzia Ventures (logistics company website), Synergix Africa (entrepreneurship platform), M-P Infrastructure (engineering and construction site), Relay (freight operations web app), PWAN EHA (AI chatbot for civic and legal guidance).\n${spec}` },
        { role: 'user', content: JSON.stringify(ctx) },
      ], { maxTokens: 1000, json: true, bucket: 'studio', temperature: 0.9 });
      const j = extractJson<{ drafts?: string[]; note?: string }>(r.text, {});
      if (j.note && !note) note = String(j.note).slice(0, 300);
      const ok = cleanDrafts([...best, ...(j.drafts ?? []).map(String)], recent);
      if (ok.length > best.length) best = ok.slice(0, 3);
    } catch (e) { console.warn('draftDm attempt', attempt, e); }
  }
  return { drafts: best, note };
}
/** Openings already used (waiting or sent), so new drafts for other people start differently. */
const recentOpenings = (items: EngageItem[], skipId?: string) =>
  items.filter((i) => i.kind === 'dm' && i.id !== skipId).slice(0, 14).map((i) => i.sent_text || i.drafts[0] || '').filter(Boolean);

async function draftComments(env: Bindings, platform: Platform, ctx: Record<string, unknown>) {
  const r = await complete(env, [
    { role: 'system', content: `${VOICE}
You draft comments on someone else's ${platform === 'linkedin' ? 'LinkedIn' : 'Instagram'} post. The goal is to be genuinely useful and visible, never salesy: no pitching, no "DM me", no mention of Ferrn's services.
Return JSON {"drafts": [string, string, string]}: 3 different comments. One adds a specific insight or experience, one asks a thoughtful question, one is a short warm reaction that still says something real.
${platform === 'linkedin' ? 'LinkedIn: 1-3 sentences, up to 60 words.' : 'Instagram: 1-2 short sentences, up to 30 words; one fitting emoji is fine.'}
If the post text is missing or too thin to comment on, return {"drafts": []}.` },
    { role: 'user', content: JSON.stringify(ctx) },
  ], { maxTokens: 600, json: true, bucket: 'studio', temperature: 0.85 });
  const j = extractJson<{ drafts?: string[] }>(r.text, {});
  return (j.drafts ?? []).map((d) => String(d).trim()).filter(Boolean).slice(0, 3);
}

export const engageApi = new Hono<AppEnv>();
engageApi.use('*', requireUser('sales'));

engageApi.get('/', async (c) => {
  const items = await load(c.env);
  const kind = c.req.query('kind') === 'comment' ? 'comment' : c.req.query('kind') === 'dm' ? 'dm' : null;
  const week = Date.now() - 7 * 86400000;
  const stats = (k: 'dm' | 'comment') => {
    const xs = items.filter((i) => i.kind === k);
    return {
      waiting: xs.filter((i) => i.status === 'draft').length,
      week: xs.filter((i) => i.status === 'sent' && i.done_at && Date.parse(i.done_at) >= week).length,
      instagram: xs.filter((i) => i.status === 'sent' && i.platform === 'instagram').length,
      linkedin: xs.filter((i) => i.status === 'sent' && i.platform === 'linkedin').length,
      followUps: xs.filter((i) => i.status === 'sent' && i.follow_up_at && Date.parse(i.follow_up_at) <= Date.now()).length,
    };
  };
  return c.json({ ok: true, items: kind ? items.filter((i) => i.kind === kind) : items, stats: { dm: stats('dm'), comment: stats('comment') } });
});

/** Create one item and draft its text. */
engageApi.post('/', async (c) => {
  const u = c.get('user')!;
  const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const kind = b.kind === 'comment' ? 'comment' : 'dm';
  const platform = platformOf(b.platform);
  const url = cleanUrl(b.url, platform);
  if (!url) return c.json({ ok: false, error: platform === 'linkedin' ? 'Paste a linkedin.com link to the profile or post.' : 'Paste an instagram.com link, or an @handle.' }, 400);
  const lead = b.lead_id ? await first<Record<string, any>>(c.env.DB,
    'SELECT id, company, niche, city, country, website, contact_name, role, gaps, pitch, notes FROM leads WHERE id = ?', String(b.lead_id)) : null;
  const context = clamp(b.context, 4000) || null;
  const person = clamp(b.person, 120) || lead?.contact_name || null;
  const company = clamp(b.company, 160) || lead?.company || null;
  let drafts: string[] = []; let note: string | null = null;
  try {
    if (kind === 'dm') {
      const r = await draftDm(c.env, platform, { person, role: lead?.role, company, niche: lead?.niche, city: lead?.city,
        website: lead?.website, gaps_we_saw: lead?.gaps, our_angle: lead?.pitch, about_them: context }, recentOpenings(await load(c.env)));
      drafts = r.drafts; note = r.note;
    } else {
      drafts = await draftComments(c.env, platform, { platform, post_url: url, author: person || company, post_text: context });
    }
  } catch (e) { console.warn('engage draft', e); }
  const item: EngageItem = { id: newId(), kind, platform, status: 'draft', lead_id: lead?.id ?? null, company, person, url, context, drafts, note,
    created_at: iso(), created_by: u.name, v: 2 };
  const items = await load(c.env);
  items.unshift(item);
  await save(c.env, items);
  await audit(c, 'engage', item.id, 'create', `${u.name} drafted a ${platform} ${kind === 'dm' ? 'DM' : 'comment'}${company ? ` for ${company}` : ''}`);
  return c.json({ ok: true, item, warning: drafts.length ? null : kind === 'comment' && !context ? 'Paste what the post says so the comments fit it.' : 'The AI did not return drafts. Try again in a moment.' });
});

/** Redraft, edit, mark as sent / skipped, set a follow-up. */
engageApi.patch('/:id', async (c) => {
  const u = c.get('user')!;
  const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const items = await load(c.env);
  const it = items.find((i) => i.id === c.req.param('id'));
  if (!it) return c.json({ ok: false, error: 'Not found' }, 404);
  if (b.redraft) {
    if (typeof b.context === 'string') it.context = clamp(b.context, 4000) || null;
    const lead = it.lead_id ? await first<Record<string, any>>(c.env.DB, 'SELECT company, niche, city, country, website, role, gaps, pitch FROM leads WHERE id = ?', it.lead_id) : null;
    if (it.kind === 'dm') {
      const r = await draftDm(c.env, it.platform, { person: it.person, company: it.company, niche: lead?.niche, city: lead?.city, website: lead?.website, role: lead?.role,
        gaps_we_saw: lead?.gaps, our_angle: lead?.pitch, about_them: it.context }, [...it.drafts, ...recentOpenings(items, it.id)]);
      if (r.drafts.length) { it.drafts = r.drafts; it.note = r.note ?? it.note; it.v = 2; }
    } else {
      const d = await draftComments(c.env, it.platform, { platform: it.platform, post_url: it.url, author: it.person || it.company, post_text: it.context, avoid: it.drafts });
      if (d.length) it.drafts = d;
    }
  }
  if (Array.isArray(b.drafts)) it.drafts = b.drafts.map((d) => clamp(d, 2000)).filter(Boolean).slice(0, 5);
  if (typeof b.note === 'string') it.note = clamp(b.note, 300) || null;
  if (typeof b.liked === 'boolean') it.liked = b.liked;
  if (b.status === 'sent' || b.status === 'skipped' || b.status === 'draft') {
    it.status = b.status;
    it.done_at = b.status === 'draft' ? null : iso();
    it.done_by = b.status === 'draft' ? null : u.name;
    if (b.status === 'sent') {
      it.sent_text = clamp(b.sent_text, 2000) || it.sent_text || null;
      // DMs get a follow-up reminder in 4 days unless one was given.
      if (it.kind === 'dm' && !it.follow_up_at) it.follow_up_at = new Date(Date.now() + 4 * 86400000).toISOString();
    }
  }
  if (b.follow_up_at === null || typeof b.follow_up_at === 'string') it.follow_up_at = b.follow_up_at ? String(b.follow_up_at).slice(0, 30) : null;
  await save(c.env, items);
  if (b.status) await audit(c, 'engage', it.id, String(b.status), `${u.name} marked a ${it.platform} ${it.kind === 'dm' ? 'DM' : 'comment'} as ${b.status}${it.company ? ` (${it.company})` : ''}`);
  return c.json({ ok: true, item: it });
});

/** Rewrites waiting DMs that were written by the old writer (same opening every time), a few per call.
 *  Drafts for branches of chains are skipped instead: they are not Ferrn clients. */
export async function rewriteOldDrafts(env: Bindings, limit: number) {
  const items = await load(env);
  const old = items.filter((i) => i.kind === 'dm' && i.status === 'draft' && i.v !== 2);
  const done: { id: string; company?: string | null; ok: boolean; skipped?: string }[] = [];
  for (const it of old.slice(0, limit)) {
    const lead = it.lead_id ? await first<Record<string, any>>(env.DB, 'SELECT company, niche, city, website, role, gaps, pitch FROM leads WHERE id = ?', it.lead_id) : null;
    const chain = chainReason(it.company ?? lead?.company ?? '', lead?.website);
    if (chain) { it.status = 'skipped'; it.done_at = iso(); it.done_by = 'Studio'; it.v = 2; it.context = `Not a fit: ${chain}. ${it.context ?? ''}`.slice(0, 600); done.push({ id: it.id, company: it.company, ok: true, skipped: chain }); continue; }
    try {
      const r = await draftDm(env, it.platform, { person: it.person, company: it.company, niche: lead?.niche, city: lead?.city, website: lead?.website, role: lead?.role,
        gaps_we_saw: lead?.gaps, our_angle: lead?.pitch, about_them: it.context }, recentOpenings(items.filter((x) => x.v === 2), it.id));
      if (r.drafts.length) { it.drafts = r.drafts; it.note = r.note ?? it.note; it.v = 2; }
      else it.v = (it.v ?? 0) - 1; // count failed tries (negative) so one stubborn draft can't block the rest
      if ((it.v ?? 0) <= -3) it.v = 2;
      done.push({ id: it.id, company: it.company, ok: r.drafts.length > 0 });
    } catch (e) { console.warn('rewriteOldDrafts', it.id, e); done.push({ id: it.id, company: it.company, ok: false }); }
  }
  if (done.length) {
    // Merge onto a fresh copy so edits made meanwhile are kept.
    const now = await load(env);
    const byId = new Map(items.map((i) => [i.id, i]));
    await save(env, now.map((n) => (done.some((d) => d.id === n.id) && n.status === 'draft' ? byId.get(n.id)! : n)));
  }
  return { done, left: Math.max(0, old.length - done.filter((d) => d.ok).length) };
}
engageApi.post('/redraft-waiting', async (c) => {
  const u = c.get('user')!;
  const r = await rewriteOldDrafts(c.env, Math.min(6, Math.max(1, Number(c.req.query('limit')) || 4)));
  if (r.done.length) await audit(c, 'engage', null, 'redraft', `${u.name} rewrote ${r.done.length} waiting DMs`);
  return c.json({ ok: true, ...r });
});

engageApi.delete('/:id', async (c) => {
  const u = c.get('user')!;
  const items = await load(c.env);
  const i = items.findIndex((x) => x.id === c.req.param('id'));
  if (i < 0) return c.json({ ok: false }, 404);
  const [gone] = items.splice(i, 1);
  await save(c.env, items);
  await audit(c, 'engage', gone.id, 'delete', `${u.name} removed a ${gone.platform} ${gone.kind === 'dm' ? 'DM' : 'comment'} draft`);
  return c.json({ ok: true });
});


/* ═══════════════ autopilot ═══════════════
 * DMs: a few leads at a time (every cron tick, up to the daily number), Studio opens the lead's website, finds
 *      the Instagram account or a LinkedIn person profile it links to, reads the page for context and drafts the DM.
 * Comments: the morning run (which can search the web) finds recent public posts from target businesses and
 *      drafts comments; they arrive through LeadsHunter's snapshot (`interactions`) and are filed here.
 * Nothing is ever sent automatically: drafts wait under "Ready to send". */
const SCAN = 'private/studio/engage-scan.json';
type Scan = { day: string; drafted: number; seen: string[] };
const today = () => new Date(Date.now() + 3600e3).toISOString().slice(0, 10); // Lagos day

export async function autopilotSettings(env: Bindings) {
  const [dm, daily, comments] = await Promise.all([
    getSetting(env.DB, 'engage.auto_dm', '1'), getSetting(env.DB, 'engage.auto_dm_daily', '6'), getSetting(env.DB, 'engage.auto_comments', '1'),
  ]).catch(() => ['1', '6', '1']);
  return { dm: dm === '1', daily: Math.min(25, Math.max(1, Number(daily) || 6)), comments: comments === '1' };
}

const IG_SKIP = /^(p|reel|reels|explore|accounts|stories|tv|about|developer|legal|direct|share|sharer)$/i;
function socialLinks(html: string) {
  const ig = new Set<string>(); const li = new Set<string>(); const liCo = new Set<string>();
  for (const m of html.matchAll(/https?:\/\/(?:www\.)?instagram\.com\/([A-Za-z0-9._]{2,30})\/?(?=["'?#\s<])/gi)) if (!IG_SKIP.test(m[1])) ig.add(m[1].toLowerCase());
  for (const m of html.matchAll(/https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/in\/([A-Za-z0-9\-_%]{3,100})\/?/gi)) li.add(m[1]);
  for (const m of html.matchAll(/https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/company\/([A-Za-z0-9\-_%]{2,100})\/?/gi)) liCo.add(m[1]);
  return { ig: [...ig], li: [...li], liCo: [...liCo] };
}
function pageText(html: string) {
  const title = html.match(/<title[^>]*>([^<]{0,200})/i)?.[1]?.trim() ?? '';
  const desc = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']{0,400})/i)?.[1] ?? '';
  const body = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, ' ').replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
  return `${title}. ${desc}. ${body}`.slice(0, 1600);
}

export async function runEngageAutopilot(env: Bindings) {
  if (!env.MEDIA) return;
  // First, rewrite waiting DMs from the old writer (three per tick) so nothing goes out with the stock opening.
  try { const r = await rewriteOldDrafts(env, 3); if (r.done.length) return; } catch (e) { console.warn('rewrite old DMs', e); }
  const cfg = await autopilotSettings(env);
  if (!cfg.dm) return;
  let scan: Scan = { day: today(), drafted: 0, seen: [] };
  try { const o = await env.MEDIA.get(SCAN); if (o) scan = await o.json(); } catch { /* fresh */ }
  if (scan.day !== today()) scan = { day: today(), drafted: 0, seen: scan.seen ?? [] };
  if (scan.drafted >= cfg.daily) return;
  const items = await load(env);
  const have = new Set(items.map((i) => i.lead_id).filter(Boolean) as string[]);
  const seen = new Set(scan.seen);
  // Best-fit leads first: Tier A and B only, never a branch of a chain, highest score first.
  const leads = (await all<Record<string, any>>(env.DB,
    `SELECT id, company, niche, city, country, website, contact_name, role, gaps, pitch, tier, score FROM leads
      WHERE website IS NOT NULL AND website <> '' AND status NOT IN ('Lost', 'Won', 'Opted out', 'Bounced') AND COALESCE(tier, 'B') IN ('A', 'B')
      ORDER BY CASE tier WHEN 'A' THEN 0 ELSE 1 END, COALESCE(score, 0) DESC, COALESCE(updated_at, created) DESC LIMIT 300`))
    .filter((l) => !chainReason(l.company ?? '', l.website));
  const todo = leads.filter((l) => !have.has(l.id) && !seen.has(l.id)).slice(0, 3); // a few per tick keeps each run light
  const fresh: EngageItem[] = [];
  for (const l of todo) {
    seen.add(l.id);
    if (scan.drafted + fresh.length >= cfg.daily) break;
    let html = '';
    try {
      const url = /^https?:\/\//i.test(l.website) ? l.website : `https://${l.website}`;
      const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; FerrnStudio/1.0; +https://www.ferrnagency.com)' }, redirect: 'follow', signal: AbortSignal.timeout(8000) });
      if (r.ok && /html/i.test(r.headers.get('content-type') ?? '')) html = (await r.text()).slice(0, 400_000);
    } catch { continue; }
    if (!html) continue;
    const links = socialLinks(html);
    const platform: Platform | null = links.ig.length ? 'instagram' : links.li.length ? 'linkedin' : null;
    if (!platform) continue;
    const url = platform === 'instagram' ? `https://www.instagram.com/${links.ig[0]}/` : `https://www.linkedin.com/in/${links.li[0]}/`;
    const context = pageText(html);
    try {
      const d = await draftDm(env, platform, { person: l.contact_name, role: l.role, company: l.company, niche: l.niche, city: l.city,
        website: l.website, gaps_we_saw: l.gaps, our_angle: l.pitch, about_them: `From their website: ${context}` }, [...fresh, ...items].filter((i) => i.kind === 'dm').slice(0, 14).map((i) => i.drafts[0] ?? ''));
      if (!d.drafts.length) continue;
      fresh.push({ id: newId(), kind: 'dm', platform, status: 'draft', lead_id: l.id, company: l.company, person: l.contact_name ?? null, url,
        context: `From their website${links.liCo.length ? ` (LinkedIn page: linkedin.com/company/${links.liCo[0]})` : ''}: ${context.slice(0, 500)}`,
        drafts: d.drafts, note: d.note, created_at: iso(), created_by: 'Autopilot', auto: true, v: 2 });
    } catch (e) { console.warn('engage autopilot draft', l.id, e); }
  }
  if (fresh.length) {
    const now = await load(env); // reload: someone may have edited while we were drafting
    await save(env, [...fresh, ...now]);
  }
  scan.drafted += fresh.length;
  scan.seen = [...seen].slice(-3000);
  await env.MEDIA.put(SCAN, JSON.stringify(scan), { httpMetadata: { contentType: 'application/json' } });
}

/** Comment drafts the morning run found (via LeadsHunter's snapshot). Deduped by post URL. */
export async function importInteractions(env: Bindings, list: unknown) {
  if (!Array.isArray(list) || !list.length || !env.MEDIA) return 0;
  const cfg = await autopilotSettings(env);
  if (!cfg.comments) return 0;
  const items = await load(env);
  const known = new Set(items.map((i) => i.url));
  const fresh: EngageItem[] = [];
  for (const raw of list.slice(0, 60) as Record<string, unknown>[]) {
    const platform = platformOf(raw.platform);
    const url = cleanUrl(raw.url, platform);
    if (!url || known.has(url)) continue;
    const drafts = (Array.isArray(raw.comments) ? raw.comments : []).map((d) => clamp(d, 600)).filter(Boolean).slice(0, 3);
    if (!drafts.length) continue;
    known.add(url);
    fresh.push({ id: newId(), kind: 'comment', platform, status: 'draft', lead_id: clamp(raw.lead_id, 40) || null, company: clamp(raw.company, 160) || null,
      person: clamp(raw.author, 120) || null, url, context: clamp(raw.post_text, 2000) || null, drafts, created_at: iso(), created_by: 'Morning run', auto: true });
  }
  if (fresh.length) await save(env, [...fresh, ...items]);
  return fresh.length;
}

engageApi.get('/settings/autopilot', async (c) => {
  const cfg = await autopilotSettings(c.env);
  let scan: Scan | null = null;
  try { const o = await c.env.MEDIA.get(SCAN); if (o) scan = await o.json(); } catch { /* none yet */ }
  return c.json({ ok: true, ...cfg, today: scan?.day === today() ? scan.drafted : 0, scanned: scan?.seen.length ?? 0 });
});
engageApi.put('/settings/autopilot', async (c) => {
  const u = c.get('user')!;
  const b = (await c.req.json().catch(() => ({}))) as { dm?: boolean; daily?: number; comments?: boolean };
  if (typeof b.dm === 'boolean') await setSetting(c.env.DB, 'engage.auto_dm', b.dm ? '1' : '0', u.name);
  if (typeof b.comments === 'boolean') await setSetting(c.env.DB, 'engage.auto_comments', b.comments ? '1' : '0', u.name);
  if (b.daily != null) await setSetting(c.env.DB, 'engage.auto_dm_daily', String(Math.min(25, Math.max(1, Math.round(Number(b.daily) || 6)))), u.name);
  await audit(c, 'engage', null, 'autopilot', `${u.name} changed the social autopilot`);
  return c.json({ ok: true, ...(await autopilotSettings(c.env)) });
});
