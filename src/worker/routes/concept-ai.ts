/**
 * AI assistant for concept sites and concept web apps (POST /api/concept-ai/:slug).
 * Concepts run in a CSP sandbox (opaque origin), so this answers CORS for any origin and takes a
 * text/plain body to avoid a preflight. Its knowledge is the text of the client's concept website
 * (R2 demos/<base>/index.html, where "-app" concepts share the website's base slug), cached in KV.
 * The assistant speaks for the client's business, never for Ferrn, and never invents prices.
 */
import { Hono } from 'hono';
import type { AppEnv } from '../lib/env';
import { complete, type ChatMessage } from '../lib/ai';
import { first } from '../lib/db';
import { cleanSlug } from './demos';

export const conceptAi = new Hono<AppEnv>();
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type', 'cache-control': 'no-store' };

const strip = (html: string) => html
  .replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
  .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, "'").replace(/\s+/g, ' ').trim();

async function knowledge(env: AppEnv['Bindings'], base: string): Promise<{ name: string; text: string } | null> {
  const key = `concept-ai:kb:${base}`;
  const hit = await env.CACHE.get(key);
  if (hit) return JSON.parse(hit);
  const obj = await env.MEDIA.get(`demos/${base}/index.html`);
  if (!obj) return null;
  const html = await obj.text();
  const title = (html.match(/<title>([^<]*)<\/title>/i)?.[1] || base).split('|')[0].trim();
  const kb = { name: title, text: strip(html).slice(0, 9000) };
  await env.CACHE.put(key, JSON.stringify(kb), { expirationTtl: 60 * 60 * 6 });
  return kb;
}

conceptAi.options('/:slug', (c) => new Response(null, { status: 204, headers: cors }));
conceptAi.post('/:slug', async (c) => {
  const slug = cleanSlug(c.req.param('slug'));
  const base = slug.replace(/-(app|portal)$/, '');
  if (!(await first(c.env.DB, "SELECT id FROM demos WHERE slug IN (?, ?) AND kind = 'upload'", slug, base))) return c.json({ ok: false, error: 'Unknown concept' }, 404, cors);
  const ip = c.req.header('cf-connecting-ip') ?? 'anon';
  const rl = `rl:concept-ai:${ip}:${Math.floor(Date.now() / 3600000)}`;
  const n = Number((await c.env.CACHE.get(rl)) ?? 0) + 1;
  await c.env.CACHE.put(rl, String(n), { expirationTtl: 3600 });
  if (n > 40) return c.json({ ok: false, error: 'Too many messages, please try again later.' }, 429, cors);

  let body: { messages?: { role: string; content: string }[]; context?: string } = {};
  try { body = JSON.parse(await c.req.text()); } catch { /* empty */ }
  const account = slug !== base && typeof (body as { account?: unknown }).account === 'string' ? String((body as { account?: string }).account).slice(0, 2000) : '';
  const history = (body.messages ?? []).filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string').slice(-8)
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content.slice(0, 1200) }));
  if (!history.length || history[history.length - 1].role !== 'user') return c.json({ ok: false, error: 'Ask a question' }, 400, cors);

  const kb = await knowledge(c.env, base);
  if (!kb) return c.json({ ok: false, error: 'Unknown concept' }, 404, cors);
  const system: ChatMessage = { role: 'system', content:
`You are the virtual assistant on ${kb.name}'s website${slug !== base ? ' and customer portal' : ''}. Speak for ${kb.name} in a warm, brief, professional tone (2 to 4 short sentences, plain text, no markdown, no emojis).
Use ONLY the facts below about the business. Never invent prices, transit times, tracking results, staff names or policies. For prices, give what affects the price and offer to start a quote. For a shipment status, ${account ? 'use the signed-in customer account data below; if a shipment is not listed there, ask for the tracking number' : 'explain that the live status appears when they enter the tracking number on the Track page, and offer to connect them to the team'}. When you cannot answer, offer the phone number or email from the facts.
If the visitor wants a quote, ask for: origin, destination, cargo type, weight or volume, and preferred mode (air, ocean, rail or road), one or two at a time.
${body.context ? `The visitor is currently on: ${String(body.context).slice(0, 120)}.\n` : ''}${account ? `Signed-in customer account data (sample data for this demo portal, treat as real):\n${account}\n` : ''}Facts about the business (from its website):
${kb.text}` };
  try {
    const r = await complete(c.env, [system, ...history], { maxTokens: 260, temperature: 0.3, bucket: 'concept-ai' });
    return c.json({ ok: true, reply: r.text.replace(/\*\*/g, '').replace(/^#+\s*/gm, '') }, 200, cors);
  } catch (e) {
    console.warn('concept-ai', e);
    return c.json({ ok: false, error: 'The assistant is busy, please try again.' }, 502, cors);
  }
});
