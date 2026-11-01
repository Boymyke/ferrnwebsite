import type { Bindings } from './env';

/** Transactional email through Resend (https://resend.com). Optional: without RESEND_API_KEY
 *  every caller falls back to showing links in Studio, so nothing breaks. */
export const FROM = 'Ferrn Digital Agency <proposals@ferrnagency.com>';

export const emailConfigured = (env: Bindings) => !!env.RESEND_API_KEY;

export const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);

export async function sendEmail(env: Bindings, m: {
  to: string | string[]; subject: string; html: string; text?: string; replyTo?: string;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (!env.RESEND_API_KEY) return { ok: false, error: 'Email is not configured (RESEND_API_KEY).' };
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to: Array.isArray(m.to) ? m.to : [m.to],
        subject: m.subject,
        html: m.html,
        text: m.text ?? htmlToText(m.html),
        reply_to: m.replyTo ?? env.CONTACT_EMAIL,
      }),
    });
    const data = (await r.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!r.ok) return { ok: false, error: data.message || `Resend error ${r.status}` };
    return { ok: true, id: data.id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
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
<tr><td style="background:#0b0b0b;padding:22px 30px;border-bottom:4px solid #ff4100"><span style="font:700 24px/1 Poppins,'Segoe UI',Arial,sans-serif;color:#ffffff;letter-spacing:-.02em">ferrn<span style="color:#ff4100">.</span></span><span style="font:500 11px/1 Poppins,Arial,sans-serif;color:#9a978f;letter-spacing:.16em;text-transform:uppercase;padding-left:10px">Digital Agency</span></td></tr>
<tr><td style="padding:32px 30px 10px">
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#111;letter-spacing:-.01em">${esc(o.heading)}</h1>
${p}${code}${rows}${btn}
${o.small ? `<p style="margin:0 0 18px;font-size:12.5px;line-height:1.6;color:#888">${esc(o.small)}</p>` : ''}
</td></tr>
<tr><td style="padding:18px 30px 26px;border-top:1px solid #f0eeea;font-size:12px;line-height:1.6;color:#999">Ferrn Digital Agency · Lagos, Nigeria · <a href="${site}" style="color:#ff4100;text-decoration:none">ferrnagency.com</a><br>We build what’s next.</td></tr>
</table></td></tr></table></body></html>`;
}
