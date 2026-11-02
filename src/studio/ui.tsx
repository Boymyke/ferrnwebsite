import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ago, api, type User } from './api';
import { ImagePlus, Inbox, Loader2, RefreshCw, Trash2, X, type LucideIcon } from 'lucide-react';

/* ── routing (history API, /studio/...) ── */
export const RouterCtx = createContext<{ path: string; go: (p: string) => void }>({ path: '/', go: () => {} });
export const useRoute = () => useContext(RouterCtx);
export function Link({ to, children, className }: { to: string; children: React.ReactNode; className?: string }) {
  const { go, path } = useRoute();
  const active = to === '/' ? path === '/' : path.startsWith(to);
  return <a href={'/studio' + to} className={`${className ?? ''} ${active ? 'active' : ''}`} onClick={(e) => { if (e.metaKey || e.ctrlKey) return; e.preventDefault(); go(to); }}>{children}</a>;
}

/* ── session ── */
export const UserCtx = createContext<User | null>(null);
export const useUser = () => useContext(UserCtx);

/* ── toasts ── */
type Toast = { id: number; text: string; kind: 'ok' | 'err' };
const ToastCtx = createContext<(text: string, kind?: Toast['kind']) => void>(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastHost({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((text: string, kind: Toast['kind'] = 'ok') => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { id, text, kind }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 4200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts">{items.map((t) => <div key={t.id} className={`toast ${t.kind}`}>{t.text}</div>)}</div>
    </ToastCtx.Provider>
  );
}

/* ── data hook ── */
export function useData<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    fn().then((d) => { if (alive) { setData(d); setError(null); } }).catch((e) => alive && setError(e.message)).finally(() => alive && setLoading(false));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { data, error, loading, reload: () => setTick((t) => t + 1), setData };
}

/* ── layout bits ── */
export function Page({ title, sub, actions, children }: { title: string; sub?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="page">
      <header className="page-head">
        <div><h1>{title}</h1>{sub ? <p className="sub">{sub}</p> : null}</div>
        <div className="page-actions">{actions}</div>
      </header>
      {children}
    </div>
  );
}

export const Card = ({ title, actions, children, className }: { title?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; className?: string }) => (
  <section className={`card ${className ?? ''}`}>
    {title || actions ? <header className="card-head"><h3>{title}</h3><div>{actions}</div></header> : null}
    {children}
  </section>
);

export const Badge = ({ children, tone = 'default' }: { children: React.ReactNode; tone?: string }) => <span className={`badge ${tone}`}>{children}</span>;

const STATUS_TONE: Record<string, string> = {
  New: 'blue', Queued: 'blue', 'Preview ready': 'blue', 'WhatsApp ready': 'green', Contacted: 'default', 'Following up': 'default',
  Replied: 'orange', Interested: 'orange', 'Call booked': 'purple', 'Proposal sent': 'purple', Won: 'green', Lost: 'red', 'Opted out': 'red', Bounced: 'red',
  draft: 'default', sent: 'blue', accepted: 'green', declined: 'red', expired: 'red', scheduled: 'blue', done: 'green', no_show: 'red', cancelled: 'red',
  idea: 'default', in_review: 'orange', approved: 'purple', posted: 'green', failed: 'red', new: 'orange', in_progress: 'blue', paid: 'green', pending: 'orange',
  planned: 'default', ready: 'blue', live: 'green', paused: 'orange', ended: 'default',
};
export const Status = ({ s }: { s?: string | null }) => (s ? <Badge tone={STATUS_TONE[s] ?? 'default'}>{s.replace(/_/g, ' ')}</Badge> : null);

/** Empty state: a soft icon tile, a title, a one-line hint and an optional action. */
export const Empty = ({ title, children, icon: Icon = Inbox, action, compact }: { title: string; children?: React.ReactNode; icon?: LucideIcon; action?: React.ReactNode; compact?: boolean }) => (
  <div className={`empty ${compact ? 'compact' : ''}`}>
    <div className="empty-ic"><Icon size={compact ? 18 : 22} strokeWidth={1.7} aria-hidden="true" /></div>
    <h4>{title}</h4>
    {children ? <p>{children}</p> : null}
    {action ? <div className="empty-act">{action}</div> : null}
  </div>
);

export const Loading = () => <div className="loading"><span /><span /><span /></div>;
export const ErrorNote = ({ error }: { error: string }) => <div className="error-note">{error}</div>;

export function EditedBy({ row }: { row: any }) {
  if (!row?.updated_by && !row?.created_by) return null;
  return <span className="edited">Edited by <strong>{row.updated_by || row.created_by}</strong>{row.updated_at ? ` · ${ago(row.updated_at)}` : ''}</span>;
}

/* ── drawer ──
   Stays mounted for 180ms after closing so it can slide out; animates only transform/opacity (GPU), no backdrop blur. */
export function Drawer({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: React.ReactNode; children: React.ReactNode; wide?: boolean }) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  const last = React.useRef<React.ReactNode>(children);
  if (open) last.current = children;
  useEffect(() => {
    if (open) {
      setMounted(true);
      const r = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
      return () => cancelAnimationFrame(r);
    }
    setShown(false);
    const t = setTimeout(() => setMounted(false), 180);
    return () => clearTimeout(t);
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', k);
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { removeEventListener('keydown', k); document.body.style.overflow = prev; };
  }, [open, onClose]);
  if (!mounted) return null;
  return (
    <div className={`drawer-wrap ${shown ? 'in' : ''}`} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className={`drawer ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : 'Details'}>
        <header className="drawer-head"><h2>{title}</h2><button className="icon" onClick={onClose} aria-label="Close"><X size={18} strokeWidth={1.9} /></button></header>
        <div className="drawer-body">{open ? children : last.current}</div>
      </aside>
    </div>
  );
}

/* ── forms ── */
export type FieldDef = {
  name: string; label: string; type?: 'text' | 'textarea' | 'number' | 'select' | 'date' | 'datetime' | 'email' | 'url' | 'checkbox' | 'html' | 'tags' | 'image';
  options?: (string | [string, string])[]; wide?: boolean; placeholder?: string; help?: string; rows?: number;
  /** image fields: R2 folder and output size (square crop when `square`) */
  folder?: string; square?: boolean; maxPx?: number;
};

/** Public URL for a stored media value (R2 key or absolute URL). */
export const mediaUrl = (v?: string | null) => (!v ? '' : /^(https?:)?\/\//.test(v) || v.startsWith('/') ? v : `/media/${v}`);

/** Resize (and optionally centre-crop square) in the browser, so uploads are small and consistent. */
async function shrink(file: File, maxPx: number, square: boolean): Promise<Blob> {
  if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) return file;
  const bmp = await createImageBitmap(file);
  let sx = 0, sy = 0, sw = bmp.width, sh = bmp.height;
  if (square) { const m = Math.min(sw, sh); sx = (sw - m) / 2; sy = Math.max(0, (sh - m) * 0.3); sw = sh = m; }
  const k = Math.min(1, maxPx / Math.max(sw, sh));
  const cv = document.createElement('canvas'); cv.width = Math.round(sw * k); cv.height = Math.round(sh * k);
  cv.getContext('2d')!.drawImage(bmp, sx, sy, sw, sh, 0, 0, cv.width, cv.height);
  return await new Promise<Blob>((res) => cv.toBlob((b) => res(b ?? file), 'image/webp', 0.86));
}

export function ImageField({ value, onChange, folder = 'uploads', square, maxPx = 1200, disabled }: { value?: string; onChange: (v: string) => void; folder?: string; square?: boolean; maxPx?: number; disabled?: boolean }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [local, setLocal] = useState<string>('');
  const [over, setOver] = useState(false);
  const input = React.useRef<HTMLInputElement>(null);
  const src = local || mediaUrl(value);
  const take = async (f?: File | null) => {
    if (!f || disabled) return;
    if (!f.type.startsWith('image/')) return toast('Choose an image file', 'err');
    const preview = URL.createObjectURL(f); setLocal(preview); setBusy(true);
    try {
      const blob = await shrink(f, maxPx, !!square);
      const fd = new FormData(); fd.append('file', new File([blob], f.name.replace(/\.[^.]+$/, '') + (blob.type === 'image/webp' ? '.webp' : ''), { type: blob.type || f.type })); fd.append('folder', folder);
      const r = await api<{ key: string }>('/media', { form: fd });
      onChange(r.key); toast('Image uploaded');
    } catch (x: any) { toast(x.message, 'err'); setLocal(''); }
    finally { setBusy(false); }
  };
  return (
    <div className={`imgfield ${square ? 'square' : ''} ${over ? 'over' : ''} ${src ? 'has' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files?.[0]); }}>
      <button type="button" className="imgfield-drop" disabled={disabled} onClick={() => input.current?.click()} aria-label={src ? 'Replace image' : 'Upload image'}>
        {src ? <img src={src} alt="" onError={(e) => ((e.target as HTMLImageElement).style.opacity = '.2')} /> : <span className="imgfield-ph"><ImagePlus size={22} strokeWidth={1.6} /><b>Drop an image or click to upload</b><small>JPG, PNG or WebP · resized automatically{square ? ' · square crop' : ''}</small></span>}
        {busy ? <span className="imgfield-busy"><Loader2 className="spin" size={22} /></span> : null}
      </button>
      {src && !disabled ? (
        <div className="imgfield-bar">
          <button type="button" className="btn sm ghost" onClick={() => input.current?.click()}><RefreshCw size={14} strokeWidth={2} />Replace</button>
          <button type="button" className="btn sm ghost danger" onClick={() => { setLocal(''); onChange(''); }}><Trash2 size={14} strokeWidth={2} />Remove</button>
          {value ? <a className="btn sm ghost" href={mediaUrl(value)} target="_blank" rel="noreferrer">Full size</a> : null}
        </div>
      ) : null}
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => { take(e.target.files?.[0]); e.target.value = ''; }} />
    </div>
  );
}

export function Fields({ fields, value, onChange, disabled }: { fields: FieldDef[]; value: Record<string, any>; onChange: (v: Record<string, any>) => void; disabled?: boolean }) {
  const set = (k: string, v: any) => onChange({ ...value, [k]: v });
  return (
    <div className="fields">
      {fields.map((f) => {
        const v = value[f.name] ?? '';
        const common = { id: `f-${f.name}`, disabled, placeholder: f.placeholder };
        let input: React.ReactNode;
        if (f.type === 'textarea' || f.type === 'html') input = <textarea {...common} rows={f.rows ?? (f.type === 'html' ? 14 : 4)} value={v} onChange={(e) => set(f.name, e.target.value)} />;
        else if (f.type === 'select') input = (
          <select {...common} value={v} onChange={(e) => set(f.name, e.target.value)}>
            <option value="">—</option>
            {f.options!.map((o) => Array.isArray(o) ? <option key={o[0]} value={o[0]}>{o[1]}</option> : <option key={o}>{o}</option>)}
          </select>
        );
        else if (f.type === 'image') input = <ImageField value={v} onChange={(x) => set(f.name, x)} folder={f.folder} square={f.square} maxPx={f.maxPx} disabled={disabled} />;
        else if (f.type === 'checkbox') input = <input {...common} type="checkbox" checked={!!Number(v)} onChange={(e) => set(f.name, e.target.checked ? 1 : 0)} />;
        else if (f.type === 'datetime') input = <input {...common} type="datetime-local" value={v} onChange={(e) => set(f.name, e.target.value)} />;
        else input = <input {...common} type={f.type ?? 'text'} value={v} onChange={(e) => set(f.name, f.type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)} />;
        const Tag: any = f.type === 'image' ? 'div' : 'label';
        return (
          <Tag key={f.name} className={`field ${f.wide || f.type === 'textarea' || f.type === 'html' || f.type === 'image' ? 'wide' : ''} ${f.type === 'checkbox' ? 'check' : ''}`} htmlFor={`f-${f.name}`}>
            <span>{f.label}</span>{input}{f.help ? <small>{f.help}</small> : null}
          </Tag>
        );
      })}
    </div>
  );
}

/* ── history (who edited what) ── */
export function History({ entity, id }: { entity: string; id: string }) {
  const { data } = useData(() => api<{ rows: any[] }>(`/history/${entity}/${id}`).then((r) => r.rows), [entity, id]);
  if (!data?.length) return <p className="muted small">No edits recorded yet.</p>;
  return (
    <ol className="history">
      {data.map((h) => (
        <li key={h.id}>
          <span className="dot" />
          <div><strong>{h.user_name}</strong> <span className="muted">{h.action}</span> · <span className="muted">{ago(h.at)}</span>
            <p>{h.summary}</p>
            {h.after_json && h.action === 'update' ? <Diff before={h.before_json} after={h.after_json} /> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
function Diff({ before, after }: { before: string; after: string }) {
  const b = useMemo(() => { try { return JSON.parse(before || '{}'); } catch { return {}; } }, [before]);
  const a = useMemo(() => { try { return JSON.parse(after || '{}'); } catch { return {}; } }, [after]);
  return (
    <div className="diff">
      {Object.keys(a).slice(0, 6).map((k) => (
        <div key={k}><code>{k}</code> <del>{String(b[k] ?? '∅').slice(0, 80)}</del> → <ins>{String(a[k] ?? '∅').slice(0, 80)}</ins></div>
      ))}
    </div>
  );
}

export function Tabs({ tabs, value, onChange }: { tabs: [string, string][]; value: string; onChange: (v: string) => void }) {
  return <div className="tabs">{tabs.map(([k, l]) => <button key={k} className={value === k ? 'active' : ''} onClick={() => onChange(k)}>{l}</button>)}</div>;
}

export function Confirm({ text, onYes, children, className }: { text: string; onYes: () => void; children: React.ReactNode; className?: string }) {
  return <button className={className ?? 'btn ghost'} onClick={() => { if (confirm(text)) onYes(); }}>{children}</button>;
}

export function copy(text: string, toast: (t: string) => void, label = 'Copied') {
  navigator.clipboard?.writeText(text).then(() => toast(label)).catch(() => prompt('Copy this:', text));
}

export const waLink = (phone?: string | null, text = '') => {
  let d = String(phone ?? '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('0')) d = '234' + d.slice(1);
  else if (d.length === 10) d = '234' + d;
  return `https://wa.me/${d}${text ? '?text=' + encodeURIComponent(text) : ''}`;
};
