import React, { useMemo, useState } from 'react';
import { api, ago, can } from '../api';
import { Badge, Card, Confirm, copy, Empty, Loading, Page, Pager, useData, usePaged, useToast, useUser } from '../ui';
import { Copy, ExternalLink, Lightbulb, Plus, RefreshCw, Trash2, UploadCloud, Users } from 'lucide-react';
import { DemoLink, DemoThumb, DemoUploader, type DemoRow } from './demos';

const kb = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/**
 * Concept sites: a site built for one particular lead to show what Ferrn would make for them. They are
 * different from marketplace demos (generic products anyone can try): each concept belongs to a lead, lives at
 * ferrnagency.com/concept/<client>/, and its link is saved on the lead (the "Concept preview" button).
 */
export function Concepts() {
  const user = useUser();
  const toast = useToast();
  const { data, loading, reload } = useData(() => api<{ rows: DemoRow[] }>('/demos').then((r) => r.rows.filter((d) => d.concept)), []);
  const [upload, setUpload] = useState<null | { slug?: string; title?: string; lead_id?: string }>(null);
  const [q, setQ] = useState('');
  const rows = useMemo(() => (data ?? []).filter((d) => !q || `${d.title} ${d.lead_company ?? ''} ${d.slug}`.toLowerCase().includes(q.toLowerCase())), [data, q]);
  const pg = usePaged(rows, 'concepts', null, 24);
  const byRoutine = (d: DemoRow) => /morning routine/i.test(`${d.notes ?? ''} ${d.updated_by ?? ''}`);
  return (
    <Page title="Concepts" sub="Concept websites built for a particular lead, to show them what we would make. Each one lives at ferrnagency.com/concept/client-name and opens from the lead’s “Concept preview” button. Marketplace demos are separate."
      actions={can(user, 'sales') ? <button className="btn primary" onClick={() => setUpload({})}><UploadCloud size={15} strokeWidth={2} />Upload a concept</button> : null}>
      {loading ? <Loading /> : (
        <Card title={`Concept sites · ${rows.length}`} actions={<input className="search sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by client" />}>
          {rows.length ? (
            <>
              <div className="demo-grid">
                {pg.rows.map((d) => (
                  <article key={d.slug} className="demo-card">
                    <DemoThumb url={d.url} />
                    <div className="demo-meta">
                      <div className="demo-title"><strong title={d.title}>{(d.lead_company || d.title).replace(/^Preview — /, '')}</strong>{byRoutine(d) ? <Badge>auto</Badge> : <Badge tone="blue">uploaded</Badge>}</div>
                      <DemoLink url={d.url} />
                      <p className="muted small">
                        {d.lead_status ? <>Lead: {d.lead_status} · </> : null}{d.files} file{d.files === 1 ? '' : 's'} · {kb(d.bytes)} · {d.updated_by} {ago(d.updated_at)}
                      </p>
                      <div className="row-actions">
                        <a className="btn sm ghost" href={d.url} target="_blank" rel="noreferrer"><ExternalLink size={14} strokeWidth={2} />Open</a>
                        <button className="btn sm ghost" onClick={() => copy(d.url, toast, 'Link copied')}><Copy size={14} strokeWidth={2} />Copy link</button>
                        {d.lead_id ? <a className="btn sm ghost" href={`/studio/leads/${d.lead_id}`}><Users size={14} strokeWidth={2} />Lead</a> : null}
                        {can(user, 'sales') ? <button className="btn sm ghost" onClick={() => setUpload({ slug: d.slug, title: d.title, lead_id: d.lead_id ?? undefined })}><RefreshCw size={14} strokeWidth={2} />New version</button> : null}
                        {can(user, 'admin') ? <Confirm className="btn sm ghost danger" text={`Delete the concept for “${d.lead_company || d.title}”? Its link will stop working.`} onYes={async () => { await api(`/demos/${d.slug}`, { method: 'DELETE' }); toast('Concept deleted'); reload(); }}><Trash2 size={14} strokeWidth={2} />Delete</Confirm> : null}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
              <Pager pg={pg} noun="concepts" />
            </>
          ) : (
            <Empty icon={Lightbulb} title={q ? 'No concepts match that search' : 'No concept sites yet'} action={can(user, 'sales') && !q ? <button className="btn sm primary" onClick={() => setUpload({})}><Plus size={14} />Upload a concept</button> : null}>
              Build a site for a lead anywhere (Lovable, Framer, v0, a Vite build), export it as HTML or a zip, then upload it here and pick the lead.
            </Empty>
          )}
        </Card>
      )}
      {upload ? <DemoUploader concept initial={upload} onClose={() => setUpload(null)} onDone={() => reload()} /> : null}
    </Page>
  );
}
