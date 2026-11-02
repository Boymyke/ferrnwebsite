import { raw } from 'hono/html';
import { ICONS } from './icon-data';

/** Inline Lucide icon for server-rendered pages. Same stroke, size and spacing everywhere. */
export function icon(name: string, opts: { size?: number; stroke?: number; class?: string; label?: string } = {}) {
  const nodes = ICONS[name];
  if (!nodes) return raw('');
  const size = opts.size ?? 18, stroke = opts.stroke ?? 1.75;
  const inner = nodes.map(([tag, attrs]) => `<${tag}${Object.entries(attrs).map(([k, v]) => ` ${k}="${v}"`).join('')}/>`).join('');
  const a11y = opts.label ? ` role="img" aria-label="${opts.label}"` : ' aria-hidden="true"';
  return raw(`<svg class="i ${opts.class ?? ''}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round"${a11y}>${inner}</svg>`);
}
