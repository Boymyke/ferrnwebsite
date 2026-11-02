import React, { useEffect, useMemo, useState } from 'react';
import { Bot, Calculator, Camera, Download, ExternalLink, History as HistoryIcon, RefreshCw, Save, Sparkles, ThumbsDown, ThumbsUp, Upload, Eye, EyeOff } from 'lucide-react';
import { api, can, fmtDate, money } from '../api';
import { Badge, Card, Empty, ErrorNote, Loading, Page, Status, Tabs, mediaUrl, useData, useToast, useUser } from '../ui';
import { ResourcePage } from './resource';

/* ═══════════════════════════ Projects ═══════════════════════════ */
const STATUSES = ['discovery', 'design', 'build', 'review', 'launched', 'support', 'paused', 'cancelled'];
const CATS: [string, string][] = [['website', 'Website'], ['webapp', 'Web application'], ['ai', 'AI / automation'], ['branding', 'Branding'], ['other', 'Other']];

function ProjectCalc({ row, patch }: { row: any; patch: (v: Record<string, any>) => void }) {
  const calc = useMemo(() => { try { return JSON.parse(row.calc_json || '{}'); } catch { return {}; } }, [row.calc_json]);
  const [i, setI] = useState<any>({ pages: 5, screens: 0, integrations: 0, ai: false, cms: false, ecommerce: false, design: 'custom', currency: row.currency || 'NGN', ...calc });
  const [out, setOut] = useState<any>(null);
  useEffect(() => { const t = setTimeout(() => api('/site/projects/calc', { body: i }).then(setOut).catch(() => null), 250); return () => clearTimeout(t); }, [JSON.stringify(i)]);
  const n = (k: string) => <input type="number" min={0} value={i[k] ?? 0} onChange={(e) => setI({ ...i, [k]: Number(e.target.value) })} />;
  const b = (k: string, label: string) => <label className="check"><input type="checkbox" checked={!!i[k]} onChange={(e) => setI({ ...i, [k]: e.target.checked })} /> {label}</label>;
  return (
    <Card title={<><Calculator size={15} /> Project calculator</>} className="calc">
      <div className="fields compact">
        <label className="field"><span>Pages</span>{n('pages')}</label>
        <label className="field"><span>App screens</span>{n('screens')}</label>
        <label className="field"><span>Integrations</span>{n('integrations')}</label>
        <label className="field"><span>Design</span><select value={i.design} onChange={(e) => setI({ ...i, design: e.target.value })}><option value="template">Template</option><option value="custom">Custom</option><option value="premium">Premium</option></select></label>
        <label className="field"><span>Currency</span><select value={i.currency} onChange={(e) => setI({ ...i, currency: e.target.value })}><option>NGN</option><option>USD</option></select></label>
        <label className="field"><span>Hourly rate (optional)</span><input type="number" placeholder={i.currency === 'USD' ? '35' : '25000'} value={i.rate ?? ''} onChange={(e) => setI({ ...i, rate: e.target.value === '' ? undefined : Number(e.target.value) })} /></label>
        <div className="field wide check-row">{b('ai', 'AI assistant')}{b('cms', 'CMS / Studio editing')}{b('ecommerce', 'Payments / e-commerce')}</div>
      </div>
      {out ? (
        <div className="calc-out">
          <div><span>Build</span><strong>{money(out.build, out.currency)}</strong><small>{out.hours} h × {money(out.rate, out.currency)}</small></div>
          <div><span>PM 12% · QA 8% · contingency 10%</span><strong>{money(out.pm + out.qa + out.contingency, out.currency)}</strong></div>
          <div className="total"><span>Suggested price</span><strong>{money(out.total, out.currency)}</strong><small>about {out.weeks} week{out.weeks === 1 ? '' : 's'}</small></div>
          <button type="button" className="btn sm" onClick={() => patch({ calc_json: JSON.stringify(i), budget: Math.round(out.total), currency: out.currency })}>Use as budget</button>
        </div>
      ) : null}
    </Card>
  );
}

function Capture({ row, patch }: { row: any; patch: (v: Record<string, any>) => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const live = (() => { try { return JSON.parse(row.links_json || '{}').live; } catch { return ''; } })();
  const go = async () => {
    setBusy(true);
    try { const r = await api<{ cover: string }>(`/site/projects/${row.id}/capture`, { body: { url: live } }); patch({ cover: r.cover }); toast('Screenshot captured', 'ok', { detail: 'Saved to media and set as the cover.' }); }
    catch (x: any) { toast(x.message, 'err'); } finally { setBusy(false); }
  };
  return (
    <div className="capture-row">
      {row.cover ? <img src={mediaUrl(row.cover)} alt="" /> : <div className="capture-empty">No cover yet</div>}
      <div>
        <p className="small muted">Covers come from a real screenshot of the live site, stored in Ferrn's media — never a stock or AI image.</p>
        <button type="button" className="btn sm" disabled={busy || !live} onClick={go}><Camera size={14} />{busy ? 'Capturing…' : live ? 'Capture live site' : 'Add the live URL first'}</button>
      </div>
    </div>
  );
}

function ImportSheet({ onDone }: { onDone: () => void }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [sheet, setSheet] = useState('https://docs.google.com/spreadsheets/d/1fWIIs5ptTCvlgK_8undRy4RWpxtplcjiij7xT3gBAVc');
  const [csv, setCsv] = useState('');
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      const r = await api<{ added: number; updated: number; skipped: number; columns: string[] }>('/site/projects/import', { body: csv.trim() ? { csv } : { sheet } });
      toast(`${r.added} added, ${r.updated} filled in, ${r.skipped} unchanged`, 'ok', { detail: `Columns read: ${r.columns.join(', ')}` }); setOpen(false); onDone();
    } catch (x: any) { toast(x.message, 'err'); } finally { setBusy(false); }
  };
  return (
    <>
      <button className="btn ghost" onClick={() => setOpen(true)}><Upload size={15} />Import from sheet</button>
      {open ? (
        <div className="modal-scrim" onClick={() => setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Import projects</h3>
            <p className="muted small">Reads the portfolio Google Sheet (share it as “Anyone with the link can view”), or paste CSV. Existing projects are matched by name — nothing is duplicated and nothing you typed here is overwritten; only blanks are filled.</p>
            <label className="field wide"><span>Google Sheet URL</span><input value={sheet} onChange={(e) => setSheet(e.target.value)} /></label>
            <label className="field wide"><span>…or paste CSV</span><textarea rows={6} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder="Project,Client,Type,Industry,Status,Live URL,Year,Budget" /></label>
            <div className="drawer-actions"><button className="btn ghost" onClick={() => setOpen(false)}>Cancel</button><button className="btn primary" disabled={busy} onClick={run}>{busy ? 'Importing…' : 'Import'}</button></div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function Projects() {
  const [tick, setTick] = useState(0);
  const [status, setStatus] = useState('');
  return (
    <ResourcePage key={tick} res="projects" entity="projects" title="Projects" sub="Every engagement in one place. Budgets, team and calculator stay internal; only what you mark Public reaches /work."
      params={status ? { status } : {}}
      filters={<select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>}
      extraActions={<ImportSheet onDone={() => setTick((t) => t + 1)} />}
      columns={[
        { key: 'name', label: 'Project', render: (r) => <><strong>{r.name}</strong><div className="muted small">{[r.client, r.type].filter(Boolean).join(' · ')}</div></> },
        { key: 'status', label: 'Status', render: (r) => <Status s={r.status} /> },
        { key: 'due_date', label: 'Due', render: (r) => fmtDate(r.due_date) },
        { key: 'budget', label: 'Budget', render: (r) => money(r.budget, r.currency) },
        { key: 'public', label: 'Site', render: (r) => (r.public ? <Badge tone="green">{r.featured ? 'featured' : 'public'}</Badge> : <span className="muted small">internal</span>) },
      ]}
      defaults={{ status: 'discovery', priority: 'normal', currency: 'NGN', category: 'website', public: 0, featured: 0, sort: 100, team_json: '[]', links_json: '{}', gallery_json: '[]', services_json: '[]', tech_json: '[]', results_json: '[]', calc_json: '{}' }}
      toForm={(r) => ({ ...r, live: (() => { try { return JSON.parse(r.links_json || '{}').live ?? ''; } catch { return ''; } })(), figma: (() => { try { return JSON.parse(r.links_json || '{}').figma ?? ''; } catch { return ''; } })(), repo: (() => { try { return JSON.parse(r.links_json || '{}').repo ?? ''; } catch { return ''; } })(),
        team: (() => { try { return (JSON.parse(r.team_json || '[]') as string[]).join(', '); } catch { return ''; } })(), services: (() => { try { return (JSON.parse(r.services_json || '[]') as string[]).join(', '); } catch { return ''; } })(), tech: (() => { try { return (JSON.parse(r.tech_json || '[]') as string[]).join(', '); } catch { return ''; } })(),
        results: (() => { try { return (JSON.parse(r.results_json || '[]') as any[]).map((x) => `${x.label}: ${x.value}${x.note ? ` (${x.note})` : ''}`).join('\n'); } catch { return ''; } })(),
        gallery: (() => { try { return (JSON.parse(r.gallery_json || '[]') as any[]).map((x) => `${x.src}${x.caption ? ` | ${x.caption}` : ''}`).join('\n'); } catch { return ''; } })() })}
      fromForm={(v) => {
        const { live, figma, repo, team, services, tech, results, gallery, ...rest } = v;
        const split = (s: string) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean);
        return { ...rest, links_json: JSON.stringify({ ...((() => { try { return JSON.parse(rest.links_json || '{}'); } catch { return {}; } })()), live: live || undefined, figma: figma || undefined, repo: repo || undefined }),
          team_json: JSON.stringify(split(team)), services_json: JSON.stringify(split(services)), tech_json: JSON.stringify(split(tech)),
          results_json: JSON.stringify(String(results || '').split('\n').map((l) => l.trim()).filter(Boolean).map((l) => { const m = l.match(/^(.*?):\s*(.*?)(?:\s*\((.*)\))?$/); return m ? { label: m[1].trim(), value: m[2].trim(), note: m[3]?.trim() } : { label: l, value: '' }; })),
          gallery_json: JSON.stringify(String(gallery || '').split('\n').map((l) => l.trim()).filter(Boolean).map((l) => { const [src, caption] = l.split('|').map((x) => x.trim()); return { src, caption, kind: /\.(mp4|webm|mov)$/i.test(src) ? 'video' : 'image' }; })) };
      }}
      drawerExtra={(row, _reload, patch) => <>{row.id ? <Capture row={row} patch={patch} /> : null}<ProjectCalc row={row} patch={patch} /></>}
      fields={[
        { name: 'name', label: 'Project name' }, { name: 'client', label: 'Client' },
        { name: 'category', label: 'Category', type: 'select', options: CATS }, { name: 'type', label: 'Type (e.g. Corporate website)' },
        { name: 'industry', label: 'Industry' }, { name: 'status', label: 'Status', type: 'select', options: STATUSES },
        { name: 'priority', label: 'Priority', type: 'select', options: ['low', 'normal', 'high'] }, { name: 'lead', label: 'Project lead' },
        { name: 'team', label: 'Team (comma separated)', wide: true },
        { name: 'start_date', label: 'Start', type: 'date' }, { name: 'due_date', label: 'Due', type: 'date' }, { name: 'completed_date', label: 'Completed', type: 'date' },
        { name: 'currency', label: 'Currency', type: 'select', options: ['NGN', 'USD'] }, { name: 'budget', label: 'Agreed price', type: 'number' }, { name: 'expenses', label: 'Costs so far', type: 'number' }, { name: 'revenue', label: 'Received so far', type: 'number' },
        { name: 'live', label: 'Live URL', type: 'url' }, { name: 'figma', label: 'Figma', type: 'url' }, { name: 'repo', label: 'Repository (private)', type: 'url' },
        { name: 'description', label: 'Internal notes', type: 'textarea', rows: 3 },
        { name: 'public', label: 'Show on the website (/work)', type: 'checkbox', help: 'Only the public fields below are ever published.' }, { name: 'featured', label: 'Featured on the home page', type: 'checkbox' },
        { name: 'slug', label: 'URL slug', help: 'ferrnagency.com/work/<slug>' }, { name: 'year', label: 'Year' }, { name: 'sort', label: 'Order', type: 'number' },
        { name: 'cover', label: 'Cover image', type: 'image', folder: 'projects', maxPx: 1600 },
        { name: 'summary', label: 'One-line summary', type: 'textarea', rows: 2 },
        { name: 'context', label: '01 Context', type: 'textarea', rows: 3 }, { name: 'challenge', label: '02 The challenge', type: 'textarea', rows: 3 },
        { name: 'approach', label: '03 Approach', type: 'textarea', rows: 3 }, { name: 'solution', label: '04 What we built', type: 'textarea', rows: 3 },
        { name: 'services', label: 'Services (comma separated)', wide: true }, { name: 'tech', label: 'Technology (comma separated)', wide: true },
        { name: 'results', label: 'Results — one per line as “Label: value (note)”', type: 'textarea', rows: 3, help: 'Only verified numbers. Leave empty rather than estimate.' },
        { name: 'gallery', label: 'Gallery — one per line as “/media/key | caption”', type: 'textarea', rows: 3 },
        { name: 'testimonial_id', label: 'Testimonial ID (optional)' }, { name: 'accent', label: 'Accent colour (optional)' },
        { name: 'meta_title', label: 'SEO title' }, { name: 'meta_description', label: 'SEO description', type: 'textarea', rows: 2 },
      ]} />
  );
}

/* ═══════════════════════════ Website copy ═══════════════════════════ */
type Field = { key: string; label: string; group: string; type?: string; help?: string; default: string; value: string | null; updated_by: string | null; updated_at: string | null };

export function SiteContent() {
  const user = useUser();
  const toast = useToast();
  const { data, loading, error, reload } = useData(() => api<{ fields: Field[] }>('/site/content').then((r) => r.fields), []);
  const [group, setGroup] = useState('Home');
  const [draft, setDraft] = useState<Record<string, string | null>>({});
  const [revFor, setRevFor] = useState<Field | null>(null);
  const groups = useMemo(() => [...new Set((data ?? []).map((f) => f.group))], [data]);
  const dirty = Object.keys(draft).length;
  const save = async () => {
    try { await api('/site/content', { method: 'PUT', body: { changes: draft } }); toast('Website updated', 'ok', { detail: 'Live on the site within a minute; Bob’s knowledge is being refreshed.' }); setDraft({}); reload(); }
    catch (x: any) { toast(x.message, 'err'); }
  };
  if (loading) return <Loading />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  const writable = can(user, 'editor');
  return (
    <Page title="Website copy" sub="Every headline, line and label on the public site. Empty = the built-in default. Changes are versioned."
      actions={<>{dirty ? <span className="muted small">{dirty} unsaved</span> : null}<button className="btn primary" disabled={!dirty || !writable} onClick={save}><Save size={15} />Save</button></>}>
      <Tabs tabs={groups.map((g) => [g, g] as [string, string])} value={group} onChange={setGroup} />
      <div className="fields content-fields">
        {(data ?? []).filter((f) => f.group === group).map((f) => {
          const v = f.key in draft ? draft[f.key] ?? '' : f.value ?? '';
          const admin = f.key === 'bob.persona';
          const dis = !writable || (admin && !can(user, 'admin'));
          const long = f.type === 'textarea' || (f.default?.length ?? 0) > 90;
          return (
            <label key={f.key} className={`field ${long ? 'wide' : ''} ${f.key in draft ? 'dirty' : ''}`}>
              <span>{f.label} {f.value ? <em className="muted">edited</em> : null}</span>
              {f.type === 'toggle' ? <select value={v || f.default} disabled={dis} onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}><option value="1">On</option><option value="0">Off</option></select>
                : long ? <textarea rows={Math.min(8, Math.max(2, Math.ceil((v || f.default).length / 90)))} value={v} placeholder={f.default} disabled={dis} onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })} />
                : <input value={v} placeholder={f.default} disabled={dis} onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })} />}
              <small>{f.help ? f.help + ' · ' : ''}{f.updated_by ? `${f.updated_by}, ${fmtDate(f.updated_at)} · ` : ''}<a href="#" onClick={(e) => { e.preventDefault(); setRevFor(f); }}>history</a>{f.value ? <> · <a href="#" onClick={(e) => { e.preventDefault(); setDraft({ ...draft, [f.key]: null }); }}>reset to default</a></> : null}</small>
            </label>
          );
        })}
      </div>
      {revFor ? <Revisions f={revFor} onClose={() => { setRevFor(null); reload(); }} /> : null}
    </Page>
  );
}

function Revisions({ f, onClose }: { f: Field; onClose: () => void }) {
  const toast = useToast();
  const { data } = useData(() => api<{ rows: any[] }>(`/site/content/revisions?key=${encodeURIComponent(f.key)}`).then((r) => r.rows), [f.key]);
  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3><HistoryIcon size={16} /> {f.label}</h3>
        <p className="small"><strong>Current:</strong> {f.value ?? <em className="muted">default — {f.default}</em>}</p>
        {!data?.length ? <p className="muted small">No earlier versions.</p> : data.map((r) => (
          <div key={r.id} className="rev">
            <div><span className="muted small">{r.by} · {fmtDate(r.at, true)}</span><p>{r.value ?? <em className="muted">default</em>}</p></div>
            <button className="btn sm ghost" onClick={async () => { try { await api('/site/content/revert', { body: { id: r.id } }); toast('Restored'); onClose(); } catch (x: any) { toast(x.message, 'err'); } }}>Restore</button>
          </div>
        ))}
        <div className="drawer-actions"><button className="btn ghost" onClick={onClose}>Close</button></div>
      </div>
    </div>
  );
}

/* ═══════════════════════════ Bob ═══════════════════════════ */
export function BobPage() {
  const user = useUser();
  const toast = useToast();
  const { data, loading, error, reload } = useData(() => api<any>('/site/bob'), []);
  const [tab, setTab] = useState('overview');
  const [q, setQ] = useState('');
  const [preview, setPreview] = useState<any[] | null>(null);
  const set = async (k: string, v: string) => { try { await api('/site/bob', { method: 'PUT', body: { [k]: v } }); toast('Saved'); reload(); } catch (x: any) { toast(x.message, 'err'); } };
  const reindex = async () => { try { const r = await api<{ n: number }>('/site/bob/reindex', { body: {} }); toast(`Knowledge rebuilt — ${r.n} entries`); reload(); } catch (x: any) { toast(x.message, 'err'); } };
  if (loading) return <Loading />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  const s = data.settings, st = data.stats;
  const admin = can(user, 'admin');
  return (
    <Page title="Bob" sub="The website assistant: what it knows, what it's doing, and how it sounds." actions={<button className="btn ghost" onClick={reindex}><RefreshCw size={15} />Rebuild knowledge</button>}>
      <Tabs tabs={[['overview', 'Overview'], ['knowledge', 'Knowledge'], ['logs', 'Conversations'], ['settings', 'Settings']]} value={tab} onChange={setTab} />
      {tab === 'overview' ? (
        <>
          <div className="stats">
            <div className="stat"><span>Conversations · 30 days</span><strong>{st.conversations ?? 0}</strong></div>
            <div className="stat"><span>Messages</span><strong>{st.messages ?? 0}</strong></div>
            <div className="stat"><span>Helpful / not</span><strong><ThumbsUp size={14} /> {st.up ?? 0} · <ThumbsDown size={14} /> {st.down ?? 0}</strong></div>
            <div className="stat"><span>Blocked (injection / internal)</span><strong>{st.blocked ?? 0}</strong></div>
          </div>
          <div className="two">
            <Card title="What Bob did"><ul className="plain">{(data.actions ?? []).map((a: any) => <li key={a.t}><strong>{a.n}</strong> {a.t === 'answer' ? 'answers' : a.t === 'navigate' ? 'took visitors to a page' : a.t === 'read' ? 'read a page aloud' : a.t}</li>)}{!data.actions?.length ? <li className="muted">Nothing yet.</li> : null}</ul></Card>
            <Card title="Most asked"><ol className="plain">{(data.top ?? []).map((t: any) => <li key={t.q}><span className="muted">{t.n}×</span> {t.q}</li>)}</ol></Card>
          </div>
          <Card title="Couldn't answer" actions={<span className="muted small">Add the answer as an FAQ or a knowledge entry, then rebuild.</span>}>
            {!data.unsure?.length ? <p className="muted small">None in the last 30 days.</p> : <table className="table"><tbody>{data.unsure.map((u: any, i: number) => <tr key={i}><td><strong>{u.question}</strong><div className="muted small">{u.path} · {fmtDate(u.created_at, true)}</div></td></tr>)}</tbody></table>}
          </Card>
        </>
      ) : tab === 'knowledge' ? <Knowledge preview={preview} q={q} setQ={setQ} setPreview={setPreview} index={data.index} /> : tab === 'logs' ? <Logs /> : (
        <div className="fields">
          <label className="field"><span>Bob on the website</span><select disabled={!admin} value={s['bob.enabled'] || '1'} onChange={(e) => set('bob.enabled', e.target.value)}><option value="1">On</option><option value="0">Off (hidden, API answers 503)</option></select></label>
          <label className="field"><span>Voice</span><select disabled={!admin} value={s['bob.voice'] || 'auto'} onChange={(e) => set('bob.voice', e.target.value)}><option value="auto">Automatic (server voice when available)</option><option value="server">Ferrn's voice only</option><option value="browser">Visitor's device voice only</option></select><small>{data.voice}</small></label>
          <label className="field"><span>Read-aloud button</span><select disabled={!admin} value={s['bob.read_aloud'] || '1'} onChange={(e) => set('bob.read_aloud', e.target.value)}><option value="1">Shown</option><option value="0">Hidden</option></select></label>
          <p className="muted small wide">Name, welcome message, suggested questions and personality live under <strong>Website copy → Bob</strong>. Rate limits: 40 messages/hour and 150/day per visitor; prompt-injection and internal-data requests are blocked before the model runs.</p>
        </div>
      )}
    </Page>
  );
}

function Knowledge({ index, q, setQ, preview, setPreview }: { index: any; q: string; setQ: (s: string) => void; preview: any[] | null; setPreview: (p: any[] | null) => void }) {
  const toast = useToast();
  const { data, reload } = useData(() => api<{ rows: any[] }>('/site/bob/index').then((r) => r.rows), []);
  const test = async () => { try { const r = await api<{ hits: any[] }>(`/site/bob/preview?q=${encodeURIComponent(q)}`); setPreview(r.hits); } catch (x: any) { toast(x.message, 'err'); } };
  return (
    <>
      <Card title="Test what Bob sees" actions={<span className="muted small">{index?.n ?? 0} entries · {index?.at ? `rebuilt ${fmtDate(index.at, true)}` : 'never rebuilt'}</span>}>
        <div className="toolbar"><input className="search" placeholder="Ask like a visitor would…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && test()} /><button className="btn" onClick={test}><Sparkles size={14} />Preview</button></div>
        {preview ? (!preview.length ? <p className="muted small">Nothing matched — Bob would say it isn't sure and offer the contact options.</p> : <ol className="plain">{preview.map((h) => <li key={h.path}><Badge>{h.kind}</Badge> <strong>{h.title}</strong> <span className="muted small">{h.path} · score {h.score}</span><p className="small muted">{h.snippet}…</p></li>)}</ol>) : null}
      </Card>
      <Card title="Indexed pages" actions={<span className="muted small">Hidden entries are never used or cited.</span>}>
        <div className="table-wrap"><table className="table"><thead><tr><th>Kind</th><th>Title</th><th>Path</th><th>Size</th><th></th></tr></thead><tbody>
          {(data ?? []).map((r) => (
            <tr key={r.path} className={r.excluded ? 'muted' : ''}><td><Badge>{r.kind}</Badge></td><td>{r.title}</td><td className="small">{r.path}</td><td className="small">{Math.round(r.chars / 100) / 10}k</td>
              <td><button className="btn sm ghost" onClick={async () => { await api('/site/bob/index', { method: 'PATCH', body: { path: r.path, excluded: !r.excluded } }); reload(); }}>{r.excluded ? <><Eye size={13} /> Show</> : <><EyeOff size={13} /> Hide</>}</button></td></tr>
          ))}
        </tbody></table></div>
      </Card>
    </>
  );
}

function Logs() {
  const { data, loading } = useData(() => api<{ rows: any[] }>('/site/bob/logs?limit=100').then((r) => r.rows), []);
  if (loading) return <Loading />;
  if (!data?.length) return <Empty icon={Bot} title="No conversations yet" />;
  return (
    <div className="table-wrap"><table className="table"><thead><tr><th>When</th><th>Page</th><th>Question</th><th>Answer</th><th>Did</th></tr></thead><tbody>
      {data.map((r) => <tr key={r.id}><td className="small muted">{fmtDate(r.created_at, true)}</td><td className="small">{r.path}</td><td>{r.question}</td><td className="small">{String(r.answer).slice(0, 160)}</td><td className="small">{r.provider?.startsWith('guard') ? <Badge tone="red">blocked</Badge> : r.action ? <Badge tone="blue">{JSON.parse(r.action).type}</Badge> : ''}{r.rating === 1 ? ' 👍' : r.rating === -1 ? ' 👎' : ''}</td></tr>)}
    </tbody></table></div>
  );
}

/* ═══════════════════════════ Links, FAQs, Seasons, Profile ═══════════════════════════ */
export function Links() {
  return (
    <ResourcePage res="links" entity="links" title="Important links" sub="Shown at ferrnagency.com/links and in the footer. Company profile, brochure, demos, booking — one place to send people."
      columns={[{ key: 'title', label: 'Link', render: (r) => <><strong>{r.title}</strong><div className="muted small">{r.url}</div></> }, { key: 'category', label: 'Group' }, { key: 'visible', label: 'Shown', render: (r) => (r.visible ? 'yes' : 'no') }]}
      defaults={{ visible: 1, sort: 100, icon: 'link' }}
      fields={[{ name: 'title', label: 'Title' }, { name: 'url', label: 'URL', type: 'url' }, { name: 'description', label: 'One line', wide: true }, { name: 'category', label: 'Group (e.g. Company, Products, Social)' }, { name: 'icon', label: 'Lucide icon name', help: 'e.g. file-text, play, calendar, download' }, { name: 'sort', label: 'Order', type: 'number' }, { name: 'visible', label: 'Show', type: 'checkbox' }]} />
  );
}

export function Faqs() {
  return (
    <ResourcePage res="faqs" entity="faqs" title="FAQs" sub="On the home page and in Bob's knowledge. Rebuild Bob's knowledge after editing."
      columns={[{ key: 'question', label: 'Question', render: (r) => <strong>{r.question}</strong> }, { key: 'category', label: 'Category' }, { key: 'on_site', label: 'On site', render: (r) => (r.on_site ? 'yes' : 'Bob only') }]}
      defaults={{ on_site: 1, published: 1, sort: 100 }}
      fields={[{ name: 'question', label: 'Question', wide: true }, { name: 'answer', label: 'Answer', type: 'textarea' }, { name: 'category', label: 'Category' }, { name: 'sort', label: 'Order', type: 'number' }, { name: 'on_site', label: 'Show on the website', type: 'checkbox' }, { name: 'published', label: 'Active', type: 'checkbox' }]} />
  );
}

const PRESETS: [string, string][] = [['christmas', 'Christmas'], ['new-year', 'New Year'], ['valentine', 'Valentine'], ['independence', 'Independence Day (Oct 1)'], ['halloween', 'Halloween'], ['easter', 'Easter'], ['milestone', 'Milestone'], ['campaign', 'Campaign'], ['custom', 'Custom']];
export function Seasons() {
  return (
    <ResourcePage res="seasons" entity="seasons" title="Seasonal themes" sub="A greeting in the hero, an optional banner and a light effect, between two dates. Highest priority wins; the brand stays intact." writeRole="admin"
      columns={[{ key: 'name', label: 'Theme', render: (r) => <><strong>{r.name}</strong><div className="muted small">{r.preset}</div></> }, { key: 'starts_at', label: 'From', render: (r) => fmtDate(r.starts_at) }, { key: 'ends_at', label: 'To', render: (r) => fmtDate(r.ends_at) }, { key: 'enabled', label: 'Active', render: (r) => (r.enabled ? <Badge tone="green">on</Badge> : 'off') }]}
      defaults={{ preset: 'custom', enabled: 0, priority: 10, effect: 'none', settings_json: '{}' }}
      fields={[{ name: 'name', label: 'Name' }, { name: 'preset', label: 'Preset', type: 'select', options: PRESETS }, { name: 'starts_at', label: 'Starts', type: 'datetime' }, { name: 'ends_at', label: 'Ends', type: 'datetime' },
        { name: 'greeting', label: 'Hero greeting (short)', wide: true, placeholder: 'Merry Christmas from Lagos.' }, { name: 'banner_text', label: 'Top banner text (optional)', wide: true }, { name: 'banner_url', label: 'Banner link', type: 'url' },
        { name: 'effect', label: 'Effect', type: 'select', options: ['none', 'snow', 'confetti', 'sparkle', 'hearts', 'glow'] }, { name: 'accent', label: 'Accent colour override (optional)', placeholder: '#ff4100' }, { name: 'priority', label: 'Priority', type: 'number' }, { name: 'enabled', label: 'Enabled', type: 'checkbox' }]} />
  );
}

const PKEYS: [string, string][] = [['who', 'Who we are'], ['what', 'What we do'], ['services', 'Services'], ['industries', 'Industries'], ['team', 'Team (auto from Team page)'], ['tech', 'Technology'], ['projects', 'Selected projects (auto from public projects)'], ['achievements', 'Achievements'], ['contact', 'Contact']];
export function Profile() {
  return (
    <ResourcePage res="profile" entity="profile_sections" title="Company profile" sub="The sections of ferrnagency.com/profile and the downloadable PDF. Team and projects fill themselves in."
      extraActions={<><a className="btn ghost" href="/profile" target="_blank" rel="noreferrer"><ExternalLink size={15} />View page</a><a className="btn ghost" href="/profile.pdf" target="_blank" rel="noreferrer"><Download size={15} />PDF</a></>}
      columns={[{ key: 'title', label: 'Section', render: (r) => <strong>{r.title}</strong> }, { key: 'key', label: 'Type' }, { key: 'published', label: 'Shown', render: (r) => (r.published ? 'yes' : 'no') }]}
      defaults={{ published: 1, sort: 100, items_json: '[]' }}
      toForm={(r) => ({ ...r, items: (() => { try { return (JSON.parse(r.items_json || '[]') as string[]).join('\n'); } catch { return ''; } })() })}
      fromForm={({ items, ...v }) => ({ ...v, items_json: JSON.stringify(String(items || '').split('\n').map((x) => x.trim()).filter(Boolean)) })}
      fields={[{ name: 'title', label: 'Title' }, { name: 'key', label: 'Type', type: 'select', options: PKEYS }, { name: 'body', label: 'Text', type: 'textarea', rows: 4 }, { name: 'items', label: 'Bullet points (one per line)', type: 'textarea', rows: 5 }, { name: 'image', label: 'Image (optional)', type: 'image', folder: 'profile' }, { name: 'sort', label: 'Order', type: 'number' }, { name: 'published', label: 'Show', type: 'checkbox' }]} />
  );
}

/* ═══════════════════════════ Testimonials (voice) ═══════════════════════════ */
export function Testimonials() {
  return (
    <ResourcePage res="testimonials" entity="testimonials" title="Testimonials" sub="Real client quotes only, with permission. Add a voice note to turn one into a voice testimonial — the site shows a player with a transcript."
      columns={[{ key: 'name', label: 'Client', render: (r) => <><strong>{r.name}</strong><div className="muted small">{[r.role, r.company].filter(Boolean).join(', ')}</div></> }, { key: 'quote', label: 'Quote', render: (r) => <span className="small">{String(r.quote).slice(0, 110)}</span> }, { key: 'audio', label: 'Voice', render: (r) => (r.audio ? <Badge tone="green">audio</Badge> : '') }, { key: 'published', label: 'Shown', render: (r) => (r.published ? (r.featured ? 'featured' : 'yes') : 'no') }]}
      defaults={{ published: 1, featured: 0, sort: 100 }}
      fields={[{ name: 'name', label: 'Name' }, { name: 'role', label: 'Role' }, { name: 'company', label: 'Company' }, { name: 'quote', label: 'Quote', type: 'textarea' },
        { name: 'avatar', label: 'Photo', type: 'image', folder: 'testimonials', square: true, maxPx: 400 }, { name: 'logo', label: 'Company logo', type: 'image', folder: 'testimonials', maxPx: 400 },
        { name: 'audio', label: 'Voice note (MP3/M4A/WAV)', type: 'file', accept: 'audio/', folder: 'voices' }, { name: 'transcript', label: 'Transcript (shown under the player, read by screen readers)', type: 'textarea', rows: 3 },
        { name: 'sort', label: 'Order', type: 'number' }, { name: 'featured', label: 'Featured', type: 'checkbox' }, { name: 'published', label: 'Show', type: 'checkbox' }]} />
  );
}
