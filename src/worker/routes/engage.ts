import { Hono } from 'hono';
import type { AppEnv, Bindings } from '../lib/env';
import { all, clamp, first, getSetting, setSetting } from '../lib/db';
import { requireUser } from '../lib/auth';
import { audit } from '../lib/audit';
import { complete, extractJson } from '../lib/ai';

/* Social engagement, assisted.
 *   DMs:          AI drafts an Instagram DM or a LinkedIn connection note + message for a lead.
 *   Interactions: AI drafts comments for someone else's post; you like it and post the comment.
 * Instagram and LinkedIn don't let apps send cold DMs or like/comment on other people's posts, and
 * automating it from a browser breaks their terms and gets accounts restricted. So Studio does the
 * thinking and the writing; sending is one tap: copy + open the profile or post, paste, send.
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

async function draftDm(env: Bindings, platform: Platform, ctx: Record<string, unknown>) {
  const spec = platform === 'linkedin'
    ? `Return JSON {"note": string, "drafts": [string, string, string]}.
"note" is a LinkedIn connection request note, max 280 characters, personal, no pitch, mentions one specific thing about them.
"drafts" are 3 different first messages to send after they accept (60-110 words each): open with one specific observation about their business or website, one sentence on what it costs them, one line of real proof, end with one easy question. Different angles, not rewordings.`
    : `Return JSON {"drafts": [string, string, string]}.
3 different Instagram DMs (35-70 words each), casual but professional, that read like a real person not a template: one specific observation about their page or business, one helpful idea, one soft question. Different angles, not rewordings. No "I hope you're well".`;
  const r = await complete(env, [
    { role: 'system', content: `${VOICE}\nReal past work you may cite: Gromzia Ventures (logistics website), Synergix Africa (entrepreneurship platform), M-P Infrastructure (EPC site), Relay (freight operations web app), PWAN EHA (AI chatbot).\n${spec}` },
    { role: 'user', content: JSON.stringify(ctx) },
  ], { maxTokens: 900, json: true, bucket: 'studio', temperature: 0.8 });
  const j = extractJson<{ drafts?: string[]; note?: string }>(r.text, {});
  return { drafts: (j.drafts ?? []).map((d) => String(d).trim()).filter(Boolean).slice(0, 3), note: j.note ? String(j.note).slice(0, 300) : null };
}

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
      const r = await draftDm(c.env, platform, { platform, profile_url: url, person, role: lead?.role, company, niche: lead?.niche, city: lead?.city, country: lead?.country,
        website: lead?.website, gaps_we_saw: lead?.gaps, our_angle: lead?.pitch, about_them: context });
      drafts = r.drafts; note = r.note;
    } else {
      drafts = await draftComments(c.env, platform, { platform, post_url: url, author: person || company, post_text: context });
    }
  } catch (e) { console.warn('engage draft', e); }
  const item: EngageItem = { id: newId(), kind, platform, status: 'draft', lead_id: lead?.id ?? null, company, person, url, context, drafts, note,
    created_at: iso(), created_by: u.name };
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
      const r = await draftDm(c.env, it.platform, { platform: it.platform, profile_url: it.url, person: it.person, company: it.company, ...lead, about_them: it.context, avoid: it.drafts });
      if (r.drafts.length) { it.drafts = r.drafts; it.note = r.note ?? it.note; }
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
  const cfg = await autopilotSettings(env);
  if (!cfg.dm || !env.MEDIA) return;
  let scan: Scan = { day: today(), drafted: 0, seen: [] };
  try { const o = await env.MEDIA.get(SCAN); if (o) scan = await o.json(); } catch { /* fresh */ }
  if (scan.day !== today()) scan = { day: today(), drafted: 0, seen: scan.seen ?? [] };
  if (scan.drafted >= cfg.daily) return;
  const items = await load(env);
  const have = new Set(items.map((i) => i.lead_id).filter(Boolean) as string[]);
  const seen = new Set(scan.seen);
  const leads = await all<Record<string, any>>(env.DB,
    `SELECT id, company, niche, city, country, website, contact_name, role, gaps, pitch FROM leads
      WHERE website IS NOT NULL AND website <> '' AND status NOT IN ('Lost', 'Won', 'Opted out', 'Bounced')
      ORDER BY COALESCE(updated_at, created) DESC LIMIT 200`);
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
      const d = await draftDm(env, platform, { platform, profile_url: url, person: l.contact_name, role: l.role, company: l.company, niche: l.niche, city: l.city,
        country: l.country, website: l.website, gaps_we_saw: l.gaps, our_angle: l.pitch, about_them: `From their website: ${context}` });
      if (!d.drafts.length) continue;
      fresh.push({ id: newId(), kind: 'dm', platform, status: 'draft', lead_id: l.id, company: l.company, person: l.contact_name ?? null, url,
        context: `From their website${links.liCo.length ? ` (LinkedIn page: linkedin.com/company/${links.liCo[0]})` : ''}: ${context.slice(0, 500)}`,
        drafts: d.drafts, note: d.note, created_at: iso(), created_by: 'Autopilot', auto: true });
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
