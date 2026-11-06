import React, { useEffect, useMemo, useRef, useState } from 'react';
import { unzip } from 'fflate';
import { api, ago, can, list } from '../api';
import { Badge, Card, Confirm, copy, Drawer, Empty, Loading, Page, Pager, useData, usePaged, useToast, useUser } from '../ui';
import { Copy, ExternalLink, FileArchive, FolderUp, Globe, MonitorPlay, Plus, RefreshCw, Trash2, UploadCloud, CheckCircle2 } from 'lucide-react';

export type DemoRow = { id: string; slug: string; title: string; kind: 'static' | 'upload'; url: string; files: number; bytes: number; product_slug?: string; products: string[]; updated_at: string; updated_by?: string };

const kb = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
const SITE = 'https://www.ferrnagency.com';

/** A full demo link with copy / open buttons. */
export function DemoLink({ url }: { url?: string | null }) {
  const toast = useToast();
  if (!url) return <span className="muted small">No live demo yet</span>;
  const full = url.startsWith('/') ? SITE + url : url;
  return (
    <span className="demo-link" onClick={(e) => e.stopPropagation()}>
      <a href={full} target="_blank" rel="noreferrer" title="Open demo">{full.replace(/^https?:\/\//, '')}</a>
      <button className="icon xs" title="Copy link" onClick={() => copy(full, toast, 'Link copied')}><Copy size={13} strokeWidth={2} /></button>
    </span>
  );
}

/** A live, scaled-down view of the demo that always fills its card (1280px wide page, scaled to fit). */
function DemoThumb({ url }: { url: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.25);
  const [show, setShow] = useState(false);
  useEffect(() => {
    const el = box.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => setScale(e.contentRect.width / 1280));
    ro.observe(el);
    // Only load the page once the card is near the screen: a grid of live sites is heavy.
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setShow(true); io.disconnect(); } }, { rootMargin: '200px' });
    io.observe(el);
    return () => { ro.disconnect(); io.disconnect(); };
  }, []);
  return (
    <div className="demo-thumb" ref={box}>
      {show ? <iframe src={url} title="" loading="lazy" tabIndex={-1} aria-hidden="true" scrolling="no" style={{ transform: `scale(${scale})` }} /> : null}
      <a className="demo-thumb-link" href={url} target="_blank" rel="noreferrer" aria-label="Open demo" />
    </div>
  );
}

export function Demos() {
  const user = useUser();
  const toast = useToast();
  const { data, loading, reload } = useData(() => api<{ rows: DemoRow[] }>('/demos').then((r) => r.rows), []);
  const [upload, setUpload] = useState<null | { slug?: string; title?: string; product_slug?: string }>(null);
  const uploaded = (data ?? []).filter((d) => d.kind === 'upload');
  const builtIn = (data ?? []).filter((d) => d.kind === 'static');
  const pgUp = usePaged(uploaded, 'demos-up', null, 25);
  const pgBuilt = usePaged(builtIn, 'demos-built', null, 25);
  const card = (d: DemoRow) => (
    <article key={d.slug} className="demo-card">
      <DemoThumb url={d.url} />
      <div className="demo-meta">
        <div className="demo-title"><strong title={d.title}>{d.title}</strong>{d.kind === 'static' ? <Badge>built-in</Badge> : <Badge tone="blue">uploaded</Badge>}</div>
        <DemoLink url={d.url} />
        <p className="muted small">
          {d.products.length ? <>Used by {d.products.join(', ')} · </> : null}
          {d.kind === 'upload' ? <>{d.files} files · {kb(d.bytes)} · {d.updated_by} {ago(d.updated_at)}</> : 'Ships with the website'}
        </p>
        <div className="row-actions">
          <a className="btn sm ghost" href={d.url} target="_blank" rel="noreferrer"><ExternalLink size={14} strokeWidth={2} />Open</a>
          <button className="btn sm ghost" onClick={() => copy(d.url, toast, 'Link copied')}><Copy size={14} strokeWidth={2} />Copy link</button>
          {d.kind === 'upload' && can(user, 'sales') ? <button className="btn sm ghost" onClick={() => setUpload({ slug: d.slug, title: d.title, product_slug: d.product_slug })}><RefreshCw size={14} strokeWidth={2} />New version</button> : null}
          {d.kind === 'upload' && can(user, 'admin') ? <Confirm className="btn sm ghost danger" text={`Delete “${d.title}” and its files? Its link will stop working.`} onYes={async () => { await api(`/demos/${d.slug}`, { method: 'DELETE' }); toast('Demo deleted'); reload(); }}><Trash2 size={14} strokeWidth={2} />Delete</Confirm> : null}
        </div>
      </div>
    </article>
  );
  return (
    <Page title="Demos" sub="Live demo sites with full shareable links. Built a demo somewhere else? Upload its HTML, a zip or the build folder and you get a link straight away — always with the Ferrn favicon."
      actions={can(user, 'sales') ? <button className="btn primary" onClick={() => setUpload({})}><UploadCloud size={15} strokeWidth={2} />Upload a demo</button> : null}>
      {loading ? <Loading /> : (
        <>
          <Card title={`Uploaded demos · ${uploaded.length}`}>
            {uploaded.length ? <><div className="demo-grid">{pgUp.rows.map(card)}</div><Pager pg={pgUp} noun="demos" /></> : (
              <Empty icon={MonitorPlay} title="No uploaded demos yet" action={can(user, 'sales') ? <button className="btn sm primary" onClick={() => setUpload({})}><Plus size={14} />Upload a demo</button> : null}>
                Export the demo from wherever you built it (Lovable, Framer, v0, Webflow, a Vite or Next build) as HTML or a zip, then upload it here.
              </Empty>
            )}
          </Card>
          <Card title={`Built-in demos · ${builtIn.length}`}><div className="demo-grid">{pgBuilt.rows.map(card)}</div><Pager pg={pgBuilt} noun="demos" /></Card>
        </>
      )}
      {upload ? <DemoUploader initial={upload} onClose={() => setUpload(null)} onDone={() => reload()} /> : null}
    </Page>
  );
}

type Picked = { path: string; data: Blob }[];

async function fromZip(file: File): Promise<Picked> {
  const buf = new Uint8Array(await file.arrayBuffer());
  const files = await new Promise<Record<string, Uint8Array>>((res, rej) => unzip(buf, (err, out) => (err ? rej(err) : res(out))));
  return Object.entries(files).filter(([p, d]) => !p.endsWith('/') && d.length).map(([path, d]) => ({ path, data: new Blob([d as BlobPart]) }));
}

/** Drop the shared top folder (my-site/index.html → index.html) and junk files. */
function normalise(items: Picked): Picked {
  const keep = items.filter((x) => !/(^|\/)(__MACOSX|\.DS_Store|Thumbs\.db|\.git)(\/|$)/.test(x.path)).map((x) => ({ ...x, path: x.path.replace(/^\/+/, '') }));
  const tops = new Set(keep.map((x) => x.path.split('/')[0]));
  if (tops.size === 1 && keep.every((x) => x.path.includes('/'))) { const t = [...tops][0] + '/'; return keep.map((x) => ({ ...x, path: x.path.slice(t.length) })); }
  return keep;
}
const findEntry = (items: Picked) => {
  const html = items.map((x) => x.path).filter((p) => /\.html?$/i.test(p)).sort((a, b) => a.split('/').length - b.split('/').length);
  return html.find((p) => /^index\.html?$/i.test(p)) ?? html.find((p) => /(^|\/)index\.html?$/i.test(p)) ?? html[0];
};

export function DemoUploader({ initial, onClose, onDone }: { initial: { slug?: string; title?: string; product_slug?: string }; onClose: () => void; onDone: (url: string) => void }) {
  const toast = useToast();
  const products = useData(() => list('products'), []);
  const [title, setTitle] = useState(initial.title ?? '');
  const [slug, setSlug] = useState(initial.slug ?? '');
  const [product, setProduct] = useState(initial.product_slug ?? '');
  const [items, setItems] = useState<Picked>([]);
  const [label, setLabel] = useState('');
  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState<string>('');
  const [over, setOver] = useState(false);
  const fileIn = useRef<HTMLInputElement>(null);
  const dirIn = useRef<HTMLInputElement>(null);
  const finalSlug = slug || slugify(title);
  const entry = useMemo(() => findEntry(items), [items]);
  const total = items.reduce((a, x) => a + x.data.size, 0);
  const editing = !!initial.slug;

  const take = async (files: FileList | File[] | null) => {
    const arr = Array.from(files ?? []); if (!arr.length) return;
    try {
      let picked: Picked;
      if (arr.length === 1 && /\.zip$/i.test(arr[0].name)) { picked = await fromZip(arr[0]); setLabel(arr[0].name); }
      else if (arr.length === 1 && /\.html?$/i.test(arr[0].name)) { picked = [{ path: 'index.html', data: arr[0] }]; setLabel(arr[0].name); }
      else { picked = arr.map((f) => ({ path: (f as any).webkitRelativePath || f.name, data: f })); setLabel(`${arr.length} files`); }
      picked = normalise(picked);
      if (!findEntry(picked)) return toast('No HTML page found — the upload needs an index.html', 'err');
      setItems(picked);
      if (!title) setTitle(((arr[0] as any).webkitRelativePath?.split('/')[0] || arr[0].name).replace(/\.(zip|html?)$/i, '').replace(/[-_]+/g, ' '));
    } catch (e: any) { toast('Could not read that file: ' + e.message, 'err'); }
  };

  const go = async () => {
    if (!title.trim()) return toast('Give the demo a name', 'err');
    if (!items.length) return toast('Add the demo files first', 'err');
    try {
      setProgress(0);
      const r = await api<{ slug: string }>('/demos', { body: { title, slug: editing ? initial.slug : finalSlug, product_slug: product || undefined } });
      await api(`/demos/${r.slug}/clear`, { body: {} });
      let done = 0;
      const queue = [...items];
      const worker = async () => {
        for (let it = queue.shift(); it; it = queue.shift()) {
          const res = await fetch(`/api/studio/demos/${r.slug}/file?path=${encodeURIComponent(it.path)}`, { method: 'PUT', body: it.data, credentials: 'same-origin' });
          if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || `Upload failed for ${it.path}`);
          done++; setProgress(Math.round((done / items.length) * 100));
        }
      };
      await Promise.all(Array.from({ length: Math.min(5, items.length) }, worker));
      const fin = await api<{ url: string }>(`/demos/${r.slug}/done`, { body: { files: items.length, bytes: total, entry } });
      setResult(fin.url); onDone(fin.url); toast('Demo is live');
    } catch (e: any) { toast(e.message, 'err'); setProgress(null); }
  };

  return (
    <Drawer open wide onClose={onClose} title={editing ? `New version · ${initial.title}` : 'Upload a demo'}>
      {result ? (
        <div className="demo-done">
          <div className="empty-ic"><CheckCircle2 size={22} /></div>
          <h3>Your demo is live</h3>
          <div className="demo-url-big"><Globe size={16} /><a href={result} target="_blank" rel="noreferrer">{result}</a></div>
          <div className="row-actions"><button className="btn primary" onClick={() => copy(result, toast, 'Link copied')}><Copy size={15} />Copy link</button><a className="btn ghost" href={result} target="_blank" rel="noreferrer"><ExternalLink size={15} />Open</a><button className="btn ghost" onClick={onClose}>Done</button></div>
          {product ? <p className="muted small">Also set as the live demo for this marketplace product.</p> : null}
          <div className="demo-preview"><iframe src={result} title="Demo preview" /></div>
        </div>
      ) : (
        <>
          <div className={`demo-drop ${over ? 'over' : ''} ${items.length ? 'has' : ''}`} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files); }}>
            {items.length ? (
              <div className="demo-picked">
                <FileArchive size={22} strokeWidth={1.7} />
                <div><strong>{label}</strong><p className="muted small">{items.length} files · {kb(total)} · opens <code>{entry}</code></p></div>
                <button className="btn sm ghost" onClick={() => { setItems([]); setLabel(''); }}>Change</button>
              </div>
            ) : (
              <>
                <UploadCloud size={28} strokeWidth={1.6} />
                <strong>Drop the demo here</strong>
                <p className="muted small">A single <code>.html</code> file, a <code>.zip</code> of the site, or the whole build folder (<code>dist</code>, <code>out</code>, <code>build</code>).</p>
                <div className="row-actions">
                  <button className="btn sm" onClick={() => fileIn.current?.click()}><FileArchive size={14} />Choose HTML or zip</button>
                  <button className="btn sm ghost" onClick={() => dirIn.current?.click()}><FolderUp size={14} />Choose a folder</button>
                </div>
              </>
            )}
            <input ref={fileIn} type="file" hidden accept=".html,.htm,.zip,text/html,application/zip" onChange={(e) => { take(e.target.files); e.target.value = ''; }} />
            <input ref={dirIn} type="file" hidden multiple {...({ webkitdirectory: '', directory: '' } as any)} onChange={(e) => { take(e.target.files); e.target.value = ''; }} />
          </div>
          <div className="fields">
            <label className="field"><span>Demo name</span><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Lekki Dental — booking site" /></label>
            <label className="field"><span>Link address</span><input value={editing ? initial.slug : slug} disabled={editing} onChange={(e) => setSlug(slugify(e.target.value))} placeholder={slugify(title) || 'lekki-dental'} /></label>
            <label className="field wide"><span>Use as the live demo for a marketplace product (optional)</span>
              <select value={product} onChange={(e) => setProduct(e.target.value)}><option value="">— Not linked —</option>{(products.data ?? []).map((p: any) => <option key={p.slug} value={p.slug}>{p.name}</option>)}</select>
            </label>
          </div>
          <div className="demo-url-preview"><span className="muted small">Your link will be</span><code>{SITE}/demos/u/{(editing ? initial.slug : finalSlug) || 'your-demo'}/</code></div>
          {progress != null ? <div className="progress"><span style={{ width: `${progress}%` }} /><em>{progress}%</em></div> : null}
          <div className="drawer-actions sticky">
            <button className="btn ghost" onClick={onClose}>Cancel</button>
            <button className="btn primary" disabled={progress != null || !items.length} onClick={go}><UploadCloud size={15} />{progress != null ? 'Uploading…' : 'Upload and get link'}</button>
          </div>
        </>
      )}
    </Drawer>
  );
}
