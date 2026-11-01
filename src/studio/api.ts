export type User = { id: string; email: string; name: string; role: 'owner' | 'admin' | 'editor' | 'sales' | 'viewer'; title: string | null };

export class ApiError extends Error { constructor(msg: string, public status: number) { super(msg); } }

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown; form?: FormData } = {}): Promise<T> {
  const res = await fetch(path.startsWith('/api') ? path : `/api/studio${path}`, {
    method: opts.method ?? (opts.body || opts.form ? 'POST' : 'GET'),
    headers: opts.form ? undefined : { 'content-type': 'application/json' },
    body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
    credentials: 'same-origin',
  });
  let data: any = null;
  try { data = await res.json(); } catch { /* empty */ }
  if (!res.ok || data?.ok === false) {
    if (res.status === 401) window.dispatchEvent(new Event('ferrn:signed-out'));
    throw new ApiError(data?.error || `Request failed (${res.status})`, res.status);
  }
  return data as T;
}

export const list = <T = any>(res: string, params: Record<string, string | undefined> = {}) => {
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]).toString();
  return api<{ rows: T[] }>(`/r/${res}${q ? '?' + q : ''}`).then((r) => r.rows);
};
export const getOne = <T = any>(res: string, id: string) => api<{ row: T }>(`/r/${res}/${id}`).then((r) => r.row);
export const create = <T = any>(res: string, body: Record<string, unknown>) => api<{ row: T }>(`/r/${res}`, { body }).then((r) => r.row);
export const update = <T = any>(res: string, id: string, body: Record<string, unknown>) => api<{ row: T }>(`/r/${res}/${id}`, { method: 'PATCH', body }).then((r) => r.row);
export const remove = (res: string, id: string) => api(`/r/${res}/${id}`, { method: 'DELETE' });

export const RANK = { viewer: 0, sales: 1, editor: 2, admin: 3, owner: 4 } as const;
export const can = (u: User | null, role: User['role']) => !!u && RANK[u.role] >= RANK[role];

export const ngn = (n?: number | null) => (n == null ? '—' : '₦' + Number(n).toLocaleString('en-NG'));
export const money = (n: number | null | undefined, cur = 'NGN') =>
  n == null ? '—' : cur === 'USD' ? '$' + Number(n).toLocaleString('en-US') : cur === 'GBP' ? '£' + Number(n).toLocaleString('en-GB') : ngn(n);

export function ago(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso.includes('T') || iso.endsWith('Z') ? iso : iso.replace(' ', 'T') + 'Z');
  const s = (Date.now() - d.getTime()) / 1000;
  if (Number.isNaN(s)) return iso;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export const fmtDate = (iso?: string | null, withTime = false) => {
  if (!iso) return '—';
  const d = new Date(iso.includes('T') ? iso : iso.length <= 10 ? iso + 'T00:00:00' : iso.replace(' ', 'T') + 'Z');
  return d.toLocaleString('en-GB', withTime
    ? { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' }
    : { day: 'numeric', month: 'short', year: 'numeric' });
};

/** datetime-local value in Lagos time ↔ ISO */
export const toLocalInput = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  const lagos = new Date(d.getTime() + 60 * 60 * 1000);
  return lagos.toISOString().slice(0, 16);
};
export const fromLocalInput = (v: string) => (v ? new Date(v + ':00+01:00').toISOString() : null);
