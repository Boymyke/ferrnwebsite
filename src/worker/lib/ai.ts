import type { Bindings } from './env';

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

/**
 * One function for every AI text call in the platform.
 * Uses OpenAI when OPENAI_API_KEY is set (model from OPENAI_MODEL), otherwise
 * Cloudflare Workers AI, so the chatbot and content tools work from day one.
 */
export async function complete(
  env: Bindings,
  messages: ChatMessage[],
  opts: { maxTokens?: number; temperature?: number; json?: boolean; model?: string; bucket?: string } = {},
): Promise<{ text: string; provider: string }> {
  const maxTokens = opts.maxTokens ?? 700;
  // Rough token count for the cost meter (4 chars ≈ 1 token).
  const inTokens = Math.ceil(messages.reduce((a, m) => a + m.content.length, 0) / 4);

  if (env.OPENAI_API_KEY && opts.model !== 'workers-ai' && !opts.model?.startsWith('@cf/')) {
    try {
      const res = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: { authorization: `Bearer ${env.OPENAI_API_KEY}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          model: env.OPENAI_MODEL || 'gpt-6-luna',
          input: messages.map((m) => ({ role: m.role, content: m.content })),
          max_output_tokens: maxTokens,
          ...(opts.json ? { text: { format: { type: 'json_object' } } } : {}),
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as any;
        let text: string = typeof data.output_text === 'string' ? data.output_text : '';
        if (!text) {
          for (const o of data.output ?? []) for (const c of o.content ?? []) if (c.type === 'output_text') text += c.text ?? '';
        }
        if (text.trim()) { await meter(env, 'openai', inTokens, Math.ceil(text.length / 4), opts.bucket); return { text: text.trim(), provider: 'openai' }; }
      } else {
        console.warn('OpenAI error', res.status, (await res.text()).slice(0, 300));
      }
    } catch (e) {
      console.warn('OpenAI failed', e);
    }
  }

  if (env.AI) {
    const model = ((opts.model?.startsWith('@cf/') ? opts.model : env.WORKERS_AI_MODEL) || '@cf/meta/llama-3.3-70b-instruct-fp8-fast') as any;
    const out = (await env.AI.run(model, {
      messages,
      max_tokens: maxTokens,
      temperature: opts.temperature ?? 0.4,
      ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
    } as any)) as any;
    const text = typeof out?.response === 'string' ? out.response : JSON.stringify(out?.response ?? '');
    await meter(env, model, inTokens, Math.ceil(text.length / 4), opts.bucket);
    return { text: text.trim(), provider: 'workers-ai' };
  }

  throw new Error('No AI provider configured');
}

/** Pulls the first JSON object/array out of a model reply. */
export function extractJson<T>(text: string, fallback: T): T {
  const m = text.match(/[\[{][\s\S]*[\]}]/);
  if (!m) return fallback;
  try { return JSON.parse(m[0]) as T; } catch { return fallback; }
}

/* ── cost meter ───────────────────────────────────────────────────────────
   Per-day counters in KV so the Studio can show what the AI is costing. Workers AI is billed in
   Neurons (10,000/day free on every plan, then $0.011 per 1,000). Rates below are Cloudflare's
   published per-model prices (Neurons per million tokens); OpenAI is estimated in USD. */
export const AI_MODELS: Record<string, { label: string; inN: number; outN: number; note: string }> = {
  '@cf/meta/llama-3.1-8b-instruct-fp8-fast': { label: 'Fast & free — Llama 3.1 8B', inN: 4119, outN: 34868, note: 'About 450 Bob answers a day inside the free allocation. Good for FAQs, prices and navigation.' },
  '@cf/meta/llama-3.2-3b-instruct': { label: 'Tiny — Llama 3.2 3B', inN: 4625, outN: 30475, note: 'Cheapest; short answers only.' },
  '@cf/meta/llama-3.3-70b-instruct-fp8-fast': { label: 'Smarter — Llama 3.3 70B', inN: 26668, outN: 204805, note: 'About 70 answers a day free, then roughly $0.0015 per answer.' },
};
export function neuronsFor(model: string, inTok: number, outTok: number) {
  const m = AI_MODELS[model]; if (!m) return 0;
  return Math.round((inTok * m.inN + outTok * m.outN) / 1_000_000);
}
export async function meter(env: Bindings, model: string, inTok: number, outTok: number, bucket = 'other') {
  try {
    const day = new Date().toISOString().slice(0, 10);
    const key = `ai:usage:${day}`;
    const cur = JSON.parse((await env.CACHE.get(key)) || '{}') as Record<string, { calls: number; inTok: number; outTok: number; neurons: number; usd: number }>;
    const k = `${bucket}|${model}`;
    const row = cur[k] ?? { calls: 0, inTok: 0, outTok: 0, neurons: 0, usd: 0 };
    row.calls++; row.inTok += inTok; row.outTok += outTok;
    if (model === 'openai') row.usd += (inTok * 0.4 + outTok * 1.6) / 1_000_000; // ~gpt-5-mini class pricing
    else row.neurons += neuronsFor(model, inTok, outTok);
    cur[k] = row;
    await env.CACHE.put(key, JSON.stringify(cur), { expirationTtl: 60 * 60 * 24 * 45 });
  } catch { /* metering must never break a request */ }
}
export async function usageDays(env: Bindings, days = 30) {
  const out: { day: string; rows: Record<string, { calls: number; inTok: number; outTok: number; neurons: number; usd: number }> }[] = [];
  for (let i = 0; i < days; i++) {
    const day = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
    const v = await env.CACHE.get(`ai:usage:${day}`);
    if (v) out.push({ day, rows: JSON.parse(v) });
  }
  return out;
}
