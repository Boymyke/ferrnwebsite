import type { Bindings } from './env';

/** Transactional email through Resend (https://resend.com). Optional: without RESEND_API_KEY
 *  every caller falls back to showing links in Studio, so nothing breaks. */
export const FROM_ADDR = 'michael@ferrnagency.com';
export const FROM = `Michael | Ferrn Digital Agency <${FROM_ADDR}>`;
/** Every site email goes out from michael@ferrnagency.com. EMAIL_FROM may change the display name only. */
export const fromOf = (env: Bindings) => {
  const name = String(env.EMAIL_FROM || '').replace(/<[^>]*>/, '').replace(/"/g, '').trim() || 'Michael | Ferrn Digital Agency';
  return `${name} <${FROM_ADDR}>`;
};
const replyOf = (_env: Bindings) => FROM_ADDR;

export const emailConfigured = (env: Bindings) => !!env.RESEND_API_KEY;

export const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);

/** What the email is about, so Studio can show it next to the right proposal or invoice. */
export type EmailTrack = { kind: string; proposalId?: string | null; invoiceId?: string | null; company?: string | null } | false;

const trackId = () => 'e' + crypto.randomUUID().replace(/-/g, '').slice(0, 20);
const siteOf = (env: Bindings) => (env.SITE_URL || 'https://www.ferrnagency.com').replace(/\/$/, '');

/** Adds the open pixel and routes every http(s) link through /api/e/c/<id>/<n>. */
export function trackHtml(site: string, id: string, html: string) {
  const links: string[] = [];
  let out = html.replace(/href="(https?:\/\/[^"]+)"/gi, (_m, url: string) => {
    const raw = url.replace(/&amp;/g, '&');
    let n = links.indexOf(raw);
    if (n < 0) { n = links.length; links.push(raw); }
    return `href="${site}/api/e/c/${id}/${n}"`;
  });
  const pixel = `<img src="${site}/api/e/o/${id}.gif" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;outline:none;opacity:0">`;
  out = /<\/body>/i.test(out) ? out.replace(/<\/body>/i, `${pixel}</body>`) : out + pixel;
  return { html: out, links };
}

export async function sendEmail(env: Bindings, m: {
  to: string | string[]; subject: string; html: string; text?: string; replyTo?: string; track?: EmailTrack;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (!env.RESEND_API_KEY) return { ok: false, error: 'Email is not configured (RESEND_API_KEY).' };
  const to = Array.isArray(m.to) ? m.to : [m.to];
  const internal = to.every((a) => a.toLowerCase() === String(env.CONTACT_EMAIL || '').toLowerCase());
  // Internal notifications to Ferrn are not tracked; everything a client gets is.
  const tracked = m.track !== false && !internal && !!env.DB && to.length === 1;
  const tid = tracked ? trackId() : '';
  const t = tracked ? trackHtml(siteOf(env), tid, m.html) : { html: m.html, links: [] as string[] };
  let result: { ok: boolean; id?: string; error?: string };
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: fromOf(env),
        to,
        subject: m.subject,
        html: t.html,
        text: m.text ?? htmlToText(m.html), // plain-text part keeps the original links
        reply_to: m.replyTo ?? replyOf(env),
      }),
    });
    const data = (await r.json().catch(() => ({}))) as { id?: string; message?: string };
    result = r.ok ? { ok: true, id: data.id } : { ok: false, error: data.message || `Resend error ${r.status}` };
  } catch (e) {
    result = { ok: false, error: (e as Error).message };
  }
  if (tracked) {
    const tr = m.track || { kind: 'email' };
    await env.DB.prepare(`INSERT INTO email_log (id, source, kind, from_addr, to_addr, subject, company, proposal_id, invoice_id, provider_id, status, error, links_json)
      VALUES (?, 'site', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(tid, tr.kind.slice(0, 40), fromOf(env).slice(0, 200), to[0].slice(0, 200), m.subject.slice(0, 300), tr.company ?? null, tr.proposalId ?? null, tr.invoiceId ?? null,
        result.id ?? null, result.ok ? 'sent' : 'failed', result.error?.slice(0, 500) ?? null, JSON.stringify(t.links))
      .run().catch((e) => console.warn('email_log insert', e)); // never block sending on the log
  }
  return result;
}

const htmlToText = (html: string) =>
  html.replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|h1|h2|h3|tr|div)>/gi, '\n')
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/gi, '$2 ($1)').replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n').trim();

/** One branded, table-based layout that renders well in Gmail, Outlook and Apple Mail.
 *  All text arguments are plain text and are escaped here. */
export function brandEmail(env: Bindings, o: {
  preheader?: string; heading: string; paragraphs: string[];
  button?: { label: string; url: string }; code?: string; rows?: [string, string][]; small?: string;
}) {
  const site = env.SITE_URL || 'https://www.ferrnagency.com';
  const p = o.paragraphs.map((t) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#2b2b2b">${esc(t)}</p>`).join('');
  const rows = o.rows?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 18px;border-top:1px solid #eee">${o.rows.map(([k, v]) =>
      `<tr><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:13px;color:#777">${esc(k)}</td><td align="right" style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px;color:#111;font-weight:600">${esc(v)}</td></tr>`).join('')}</table>`
    : '';
  const code = o.code
    ? `<div style="margin:6px 0 20px;text-align:center"><div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#888;margin-bottom:6px">Access code</div><div style="display:inline-block;font:600 30px/1 'Courier New',monospace;letter-spacing:.35em;padding:14px 10px 14px 20px;border-radius:12px;background:#fff4ef;border:1px solid #ffd2c0;color:#111">${esc(o.code)}</div></div>`
    : '';
  const btn = o.button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 22px"><tr><td style="border-radius:999px;background:#ff4100"><a href="${esc(o.button.url)}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:999px">${esc(o.button.label)}</a></td></tr></table>`
    : '';
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(o.heading)}</title></head>
<body style="margin:0;padding:0;background:#f1efeb;font-family:Poppins,'Segoe UI',Helvetica,Arial,sans-serif">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(o.preheader ?? '')}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1efeb;padding:28px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,.06)">
<tr><td style="background:#0b0b0b;padding:24px 30px;border-bottom:4px solid #ff4100"><a href="${site}" style="text-decoration:none"><img src="${site}/brand/ferrn-logo-email.png" width="150" height="29" alt="Ferrn Digital Agency" style="display:block;border:0;outline:none;width:150px;height:29px"></a></td></tr>
<tr><td style="padding:32px 30px 10px">
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#111;letter-spacing:-.01em">${esc(o.heading)}</h1>
${p}${code}${rows}${btn}
${o.small ? `<p style="margin:0 0 18px;font-size:12.5px;line-height:1.6;color:#888">${esc(o.small)}</p>` : ''}
</td></tr>
<tr><td style="padding:18px 30px 26px;border-top:1px solid #f0eeea;font-size:12px;line-height:1.6;color:#999">Ferrn Digital Agency · Lagos, Nigeria · <a href="${site}" style="color:#ff4100;text-decoration:none">ferrnagency.com</a><br>We build what’s next.</td></tr>
</table></td></tr></table></body></html>`;
}
