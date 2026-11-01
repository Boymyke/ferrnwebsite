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
  opts: { maxTokens?: number; temperature?: number; json?: boolean } = {},
): Promise<{ text: string; provider: string }> {
  const maxTokens = opts.maxTokens ?? 700;

  if (env.OPENAI_API_KEY) {
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
        if (text.trim()) return { text: text.trim(), provider: 'openai' };
      } else {
        console.warn('OpenAI error', res.status, (await res.text()).slice(0, 300));
      }
    } catch (e) {
      console.warn('OpenAI failed', e);
    }
  }

  if (env.AI) {
    const model = (env.WORKERS_AI_MODEL || '@cf/meta/llama-3.3-70b-instruct-fp8-fast') as any;
    const out = (await env.AI.run(model, {
      messages,
      max_tokens: maxTokens,
      temperature: opts.temperature ?? 0.4,
      ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
    } as any)) as any;
    const text = typeof out?.response === 'string' ? out.response : JSON.stringify(out?.response ?? '');
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
