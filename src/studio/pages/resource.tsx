import React, { useState } from 'react';
import { api, can, create, remove, update, list, type User } from '../api';
import { Card, Confirm, Drawer, EditedBy, Empty, ErrorNote, Fields, History, Loading, Page, Tabs, useData, useToast, useUser, type FieldDef } from '../ui';

export type Column = { key: string; label: string; render?: (row: any) => React.ReactNode };

/** A list + drawer editor for any Studio resource, with edit history on every record. */
export function ResourcePage(p: {
  res: string; entity: string; title: string; sub?: string; columns: Column[]; fields: FieldDef[]; writeRole?: User['role'];
  defaults?: Record<string, any>; filters?: React.ReactNode; params?: Record<string, string>; extraActions?: React.ReactNode;
  toForm?: (row: any) => Record<string, any>; fromForm?: (v: Record<string, any>) => Record<string, any>; canCreate?: boolean;
  drawerExtra?: (row: any, reload: () => void) => React.ReactNode;
}) {
  const user = useUser();
  const toast = useToast();
  const [q, setQ] = useState('');
  const { data, loading, error, reload } = useData(() => list(p.res, { q, ...(p.params ?? {}) }), [q, JSON.stringify(p.params ?? {})]);
  const [open, setOpen] = useState<any | null>(null);
  const writable = can(user, p.writeRole ?? 'editor');
  return (
    <Page title={p.title} sub={p.sub} actions={<>{p.extraActions}{writable && p.canCreate !== false ? <button className="btn primary" onClick={() => setOpen({ ...(p.defaults ?? {}) })}>+ New</button> : null}</>}>
      <div className="toolbar"><input className="search" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />{p.filters}</div>
      {loading ? <Loading /> : error ? <ErrorNote error={error} /> : !data?.length ? <Empty title="Nothing here yet" /> : (
        <div className="table-wrap"><table className="table clickable">
          <thead><tr>{p.columns.map((c) => <th key={c.key}>{c.label}</th>)}<th>Last edit</th></tr></thead>
          <tbody>{data.map((r: any) => (
            <tr key={r.id} onClick={() => setOpen(r)}>
              {p.columns.map((c) => <td key={c.key}>{c.render ? c.render(r) : String(r[c.key] ?? '')}</td>)}
              <td className="muted small">{r.updated_by ?? r.created_by ?? ''}</td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
      {open ? <Editor {...p} row={open} writable={writable} onClose={() => { setOpen(null); reload(); }} toast={toast} reload={reload} /> : null}
    </Page>
  );
}

function Editor(p: any) {
  const isNew = !p.row.id;
  const [v, setV] = useState<Record<string, any>>(p.toForm ? p.toForm(p.row) : p.row);
  const [tab, setTab] = useState('edit');
  const save = async () => {
    const body = p.fromForm ? p.fromForm(v) : v;
    try { isNew ? await create(p.res, body) : await update(p.res, p.row.id, body); p.toast('Saved'); p.onClose(); }
    catch (x: any) { p.toast(x.message, 'err'); }
  };
  return (
    <Drawer open wide onClose={p.onClose} title={isNew ? `New ${p.title.toLowerCase().replace(/s$/, '')}` : (p.row.name || p.row.title || p.row.customer_name || p.row.email || 'Edit')}>
      {!isNew ? <><EditedBy row={p.row} /><Tabs tabs={[['edit', 'Details'], ['history', 'History']]} value={tab} onChange={setTab} /></> : null}
      {tab === 'history' && !isNew ? <History entity={p.entity} id={p.row.id} /> : (
        <>
          {p.drawerExtra && !isNew ? p.drawerExtra(p.row, p.reload) : null}
          <Fields fields={p.fields} value={v} onChange={setV} disabled={!p.writable} />
          {p.writable ? (
            <div className="drawer-actions sticky">
              {!isNew ? <Confirm text="Delete this permanently?" className="btn ghost danger" onYes={async () => { try { await remove(p.res, p.row.id); p.toast('Deleted'); p.onClose(); } catch (x: any) { p.toast(x.message, 'err'); } }}>Delete</Confirm> : null}
              <button className="btn primary" onClick={save}>Save</button>
            </div>
          ) : <p className="muted small">You can view but not edit this.</p>}
        </>
      )}
    </Drawer>
  );
}

/** Upload a file to R2 and return its key. */
export async function upload(file: File, folder: string) {
  const fd = new FormData(); fd.append('file', file); fd.append('folder', folder);
  return api<{ key: string; url: string }>('/media', { form: fd });
}

export function UploadButton({ folder, onUploaded, label = 'Upload' }: { folder: string; onUploaded: (r: { key: string; url: string }) => void; label?: string }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <label className="btn sm ghost upload">
      {busy ? 'Uploading…' : label}
      <input type="file" hidden accept="image/*,video/*,audio/*,application/pdf" onChange={async (e) => {
        const f = e.target.files?.[0]; if (!f) return;
        setBusy(true);
        try { onUploaded(await upload(f, folder)); toast('Uploaded'); } catch (x: any) { toast(x.message, 'err'); } finally { setBusy(false); e.target.value = ''; }
      }} />
    </label>
  );
}

export const jsonList = (s: string) => { try { return (JSON.parse(s || '[]') as string[]).join('\n'); } catch { return ''; } };
export const listJson = (s: string) => JSON.stringify(String(s || '').split('\n').map((x) => x.trim()).filter(Boolean));
export { Card };
