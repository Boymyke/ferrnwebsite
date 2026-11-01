import type { Bindings } from './env';
import type { Lang } from '../content/i18n';

/**
 * Machine translation for long-form text (product descriptions, case studies, posts).
 * Uses Workers AI m2m100 (covers Yoruba, Igbo and Hausa as well as fr/de/es/zh) and caches
 * every result in KV for 30 days. Falls back to the English text on any failure, so a page
 * never breaks because a translation is missing.
 */
const NAMES: Partial<Record<Lang, string>> = {
  yo: 'yoruba', ig: 'igbo', ha: 'hausa', fr: 'french', de: 'german', es: 'spanish', zh: 'chinese',
};

export async function mt(env: Bindings, text: string, lang: Lang): Promise<string> {
  if (lang === 'en' || !text || !env.AI) return text;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(lang + '|' + text));
  const key = 'mt:' + [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 40);
  const hit = await env.CACHE.get(key);
  if (hit) return hit;
  try {
    const out = (await env.AI.run('@cf/meta/m2m100-1.2b' as any, {
      text, source_lang: 'english', target_lang: NAMES[lang] ?? lang,
    } as any)) as { translated_text?: string };
    const t = out?.translated_text?.trim();
    if (t) {
      await env.CACHE.put(key, t, { expirationTtl: 60 * 60 * 24 * 30 });
      return t;
    }
  } catch (e) {
    console.warn('translate failed', lang, e);
  }
  return text;
}

export async function mtMany(env: Bindings, texts: string[], lang: Lang) {
  return Promise.all(texts.map((s) => mt(env, s, lang)));
}
