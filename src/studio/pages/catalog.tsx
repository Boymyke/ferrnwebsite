import React, { useState } from 'react';
import { ago, api, fmtDate, fromLocalInput, money, toLocalInput, update } from '../api';
import { Badge, mediaUrl, Status, useRoute, useToast } from '../ui';
import { CalendarPlus, Code2, ExternalLink, Link2, Mail, Sparkles, UploadCloud } from 'lucide-react';
import { DemoLink, DemoUploader } from './demos';
import { jsonList, listJson, ResourcePage, UploadButton } from './resource';

export function Products() {
  const [up, setUp] = useState<null | { product_slug: string; title: string; done: (url: string) => void }>(null);
  return (<>
    <ResourcePage res="products" entity="products" title="Marketplace products" sub="What appears on /marketplace. Edits go live within seconds."
      columns={[
        { key: 'name', label: 'Product', render: (r) => <><strong>{r.name}</strong><div className="muted small">{r.tagline}</div></> },
        { key: 'category', label: 'Type' }, { key: 'industry', label: 'Industry' },
        { key: 'price', label: 'Price', render: (r) => <>{money(r.price_ngn_setup)} + {money(r.price_ngn_monthly)}/mo<div className="muted small">{money(r.price_usd_setup, 'USD')} + {money(r.price_usd_monthly, 'USD')}/mo</div></> },
        { key: 'demo_url', label: 'Live demo', render: (r) => <DemoLink url={r.demo_url} /> },
        { key: 'published', label: 'Live', render: (r) => (r.published ? <Badge tone="green">live</Badge> : <Badge>hidden</Badge>) },
      ]}
      defaults={{ category: 'website', published: 0, delivery_days: 7, sort: 100 }}
      drawerExtra={(r, _reload, patch) => (
        <div className="card soft demo-box">
          <div><span className="side-label">Live demo</span><DemoLink url={r.demo_url} /></div>
          <div className="row-actions">
            {r.demo_url ? <a className="btn sm ghost" href={r.demo_url} target="_blank" rel="noreferrer"><ExternalLink size={14} />Open</a> : null}
            <button className="btn sm" onClick={() => setUp({ product_slug: r.slug, title: `${r.name} demo`, done: (url) => patch({ demo_url: url }) })}><UploadCloud size={14} />Upload demo</button>
          </div>
        </div>
      )}
      toForm={(r) => ({ ...r, features: jsonList(r.features_json), includes: jsonList(r.includes_json) })}
      fromForm={({ features, includes, ...v }) => ({ ...v, features_json: listJson(features), includes_json: listJson(includes) })}
      fields={[
        { name: 'name', label: 'Name' }, { name: 'slug', label: 'URL slug' },
        { name: 'category', label: 'Type', type: 'select', options: ['website', 'webapp', 'chatbot', 'automation'] }, { name: 'industry', label: 'Industry' },
        { name: 'tagline', label: 'Tagline', wide: true }, { name: 'description', label: 'Description', type: 'textarea', rows: 5 },
        { name: 'features', label: 'Features (one per line)', type: 'textarea', rows: 6 }, { name: 'includes', label: 'Included (one per line)', type: 'textarea', rows: 4 },
        { name: 'demo_url', label: 'Live demo URL (full link)', type: 'url', wide: true, placeholder: 'https://www.ferrnagency.com/demos/u/your-demo/', help: 'Use “Upload demo” above to host a demo built elsewhere — the link fills in by itself.' }, { name: 'accent', label: 'Accent colour', placeholder: '#ff4100' },
        { name: 'delivery_days', label: 'Delivery days', type: 'number' },
        { name: 'price_ngn_setup', label: 'Setup ₦', type: 'number' }, { name: 'price_ngn_monthly', label: 'Monthly ₦', type: 'number' },
        { name: 'price_usd_setup', label: 'Setup $', type: 'number' }, { name: 'price_usd_monthly', label: 'Monthly $', type: 'number' },
        { name: 'buyout_ngn', label: 'Code buyout ₦', type: 'number' }, { name: 'buyout_usd', label: 'Code buyout $', type: 'number' },
        { name: 'sort', label: 'Sort order', type: 'number' }, { name: 'published', label: 'Published', type: 'checkbox' },
      ]} />
      {up ? <DemoUploader initial={up} onClose={() => setUp(null)} onDone={up.done} /> : null}
  </>);
}

export function Orders() {
  return (
    <ResourcePage res="orders" entity="orders" title="Orders" sub="Marketplace checkouts and invoice requests." writeRole="admin" canCreate={false}
      columns={[
        { key: 'customer_name', label: 'Customer', render: (r) => <><strong>{r.customer_name}</strong><div className="muted small">{r.email} · {r.phone}</div></> },
        { key: 'company', label: 'Company' }, { key: 'tier', label: 'Plan', render: (r) => <>{r.product_name ? <strong>{r.product_name}</strong> : null}<div className="muted small">{r.tier}</div></> },
        { key: 'amount', label: 'Amount', render: (r) => money(r.amount / 100, r.currency) },
        { key: 'status', label: 'Status', render: (r) => <Status s={r.status} /> }, { key: 'created_at', label: 'Created', render: (r) => fmtDate(r.created_at) },
      ]}
      drawerExtra={(r, reload) => <OrderActions order={r} onChange={reload} />}
      fields={[{ name: 'status', label: 'Status', type: 'select', options: ['pending', 'paid', 'failed', 'cancelled', 'refunded'] }, { name: 'notes', label: 'Notes', type: 'textarea' }]} />
  );
}

/** Welcome email + kickoff call, right from the order. */
function OrderActions({ order: o, onChange }: { order: any; onChange: () => void }) {
  const toast = useToast();
  const { go } = useRoute();
  const [mode, setMode] = useState<'' | 'email' | 'meet'>('');
  const [busy, setBusy] = useState(false);
  const [mail, setMail] = useState<{ subject: string; body: string } | null>(null);
  const next = new Date(Date.now() + 86400000); next.setHours(10, 0, 0, 0);
  const [m, setM] = useState({ starts_at: toLocalInput(next.toISOString()), duration_min: 30, channel: 'google_meet', location_url: '', agenda: '', invite: true });
  const draft = async () => {
    setMode('email'); setBusy(true);
    try { const r = await api<{ draft: { subject: string; body: string } }>(`/order/${o.id}/welcome-draft`, { body: {} }); setMail(r.draft); }
    catch (x: any) { toast(x.message, 'err'); } finally { setBusy(false); }
  };
  const send = async () => {
    if (!mail || !confirm(`Send “${mail.subject}” to ${o.email}?`)) return;
    setBusy(true);
    try { await api(`/order/${o.id}/email`, { body: mail }); toast(`Email sent to ${o.email}`); setMode(''); setMail(null); onChange(); }
    catch (x: any) { toast(x.message, 'err'); } finally { setBusy(false); }
  };
  const book = async () => {
    setBusy(true);
    try {
      const r = await api<{ meeting_id: string; invited: boolean; inviteError?: string | null }>(`/order/${o.id}/meeting`, { body: { ...m, starts_at: fromLocalInput(m.starts_at) } });
      toast(r.invited ? `Call booked and invite sent to ${o.email}` : r.inviteError ? `Call booked, but the invite didn’t send: ${r.inviteError}` : 'Call booked', r.inviteError ? 'err' : undefined);
      setMode(''); onChange();
      if (confirm('Call booked. Open it in Meetings?')) go(`/meetings/${r.meeting_id}`);
    } catch (x: any) { toast(x.message, 'err'); } finally { setBusy(false); }
  };
  return (
    <div className="card soft order-actions">
      <dl className="dl">
        <dt>Product</dt><dd>{o.product_name || o.product_id} · {o.tier}</dd>
        <dt>Amount</dt><dd>{money(o.amount / 100, o.currency)} · <Status s={o.status} /></dd>
        <dt>Client</dt><dd>{o.customer_name}{o.company ? ` · ${o.company}` : ''}<div className="muted small">{o.email}{o.phone ? ` · ${o.phone}` : ''}</div></dd>
      </dl>
      {o.notes ? <p className="pre small muted">{o.notes}</p> : null}
      <div className="row-actions" style={{ marginTop: 10 }}>
        <button className={`btn sm ${mode === 'email' ? 'primary' : ''}`} disabled={busy} onClick={draft}><Sparkles size={14} />Write welcome email</button>
        <button className={`btn sm ${mode === 'meet' ? 'primary' : ''}`} onClick={() => setMode(mode === 'meet' ? '' : 'meet')}><CalendarPlus size={14} />Schedule kickoff call</button>
      </div>
      {mode === 'email' ? (
        busy && !mail ? <p className="muted small">Writing…</p> : mail ? (
          <div className="fields" style={{ marginTop: 10 }}>
            <label className="field wide"><span>Subject</span><input value={mail.subject} onChange={(e) => setMail({ ...mail, subject: e.target.value })} /></label>
            <label className="field wide"><span>Message (to {o.email})</span><textarea rows={12} value={mail.body} onChange={(e) => setMail({ ...mail, body: e.target.value })} /></label>
            <div className="wide" style={{ display: 'flex', gap: 8 }}>
              <button className="btn primary" disabled={busy} onClick={send}><Mail size={15} />{busy ? 'Sending…' : 'Send from michael@ferrnagency.com'}</button>
              <button className="btn ghost" disabled={busy} onClick={draft}>Rewrite</button>
            </div>
          </div>
        ) : null
      ) : null}
      {mode === 'meet' ? (
        <div className="fields" style={{ marginTop: 10 }}>
          <label className="field"><span>Starts (Lagos time)</span><input type="datetime-local" value={m.starts_at} onChange={(e) => setM({ ...m, starts_at: e.target.value })} /></label>
          <label className="field"><span>Length</span><select value={m.duration_min} onChange={(e) => setM({ ...m, duration_min: Number(e.target.value) })}>{[15, 30, 45, 60, 90].map((n) => <option key={n} value={n}>{n} minutes</option>)}</select></label>
          <label className="field"><span>How</span><select value={m.channel} onChange={(e) => setM({ ...m, channel: e.target.value })}><option value="google_meet">Google Meet</option><option value="zoom">Zoom</option><option value="whatsapp">WhatsApp call</option><option value="phone">Phone call</option><option value="in_person">In person</option></select></label>
          <label className="field"><span>Meeting link (optional)</span><input placeholder="https://meet.google.com/…" value={m.location_url} onChange={(e) => setM({ ...m, location_url: e.target.value })} /></label>
          <label className="field wide"><span>Agenda (optional)</span><textarea rows={3} value={m.agenda} onChange={(e) => setM({ ...m, agenda: e.target.value })} placeholder="Goals, brand, content checklist, timeline" /></label>
          <label className="field wide check"><input type="checkbox" checked={m.invite} onChange={(e) => setM({ ...m, invite: e.target.checked })} /> <span>Email {o.email} the invite with a calendar file</span></label>
          <div className="wide"><button className="btn primary" disabled={busy || !m.starts_at} onClick={book}><CalendarPlus size={15} />{busy ? 'Booking…' : 'Book the call'}</button></div>
        </div>
      ) : null}
    </div>
  );
}

export function Requests() {
  const [type, setType] = useState('');
  return (
    <ResourcePage res="requests" entity="requests" title="Enquiries" sub="Contact forms, RFPs, customisation and invoice requests, chat leads and newsletter sign-ups." writeRole="sales" canCreate={false}
      params={{ type }}
      filters={<select value={type} onChange={(e) => setType(e.target.value)}><option value="">All types</option>{['contact', 'rfp', 'customise', 'demo', 'referral', 'chat_lead', 'newsletter'].map((t) => <option key={t}>{t}</option>)}</select>}
      columns={[
        { key: 'name', label: 'From', render: (r) => <><strong>{r.name || r.email}</strong><div className="muted small">{r.email} {r.phone ? `· ${r.phone}` : ''}</div></> },
        { key: 'type', label: 'Type', render: (r) => <Badge>{r.type}</Badge> }, { key: 'company', label: 'Company' },
        { key: 'message', label: 'Message', render: (r) => <span className="small">{(r.message || '').slice(0, 110)}</span> },
        { key: 'status', label: 'Status', render: (r) => <Status s={r.status} /> }, { key: 'created_at', label: 'When', render: (r) => ago(r.created_at) },
      ]}
      drawerExtra={(r) => <div className="card soft"><p className="pre">{r.message}</p><p className="muted small">Budget: {r.budget || '—'} · Language: {r.lang} · {fmtDate(r.created_at, true)}</p>
        {r.email ? <a className="btn sm ghost" href={`mailto:${r.email}`}>Reply by email</a> : null}</div>}
      fields={[{ name: 'status', label: 'Status', type: 'select', options: ['new', 'in_progress', 'done', 'spam'] }]} />
  );
}

const initials = (n = '') => n.split(' ').filter(Boolean).map((x) => x[0]).slice(0, 2).join('').toUpperCase();
function TeamPreview({ m }: { m: Record<string, any> }) {
  const src = mediaUrl(m.photo);
  return (
    <article className="tm-card">
      <div className="tm-avatar">{src ? <img src={src} alt="" /> : <span>{initials(m.name) || '?'}</span>}</div>
      <h3>{m.name || 'Full name'}</h3>
      <p className="tm-role">{m.role || 'Role on the website'}</p>
      {m.bio ? <p className="tm-bio">{m.bio}</p> : <p className="tm-bio muted">A short bio appears here.</p>}
      <div className="tm-links">{m.linkedin ? <span><Link2 size={14} />LinkedIn</span> : null}{m.github ? <span><Code2 size={14} />GitHub</span> : null}</div>
      {!Number(m.published ?? 1) ? <Badge>hidden from website</Badge> : null}
    </article>
  );
}

export function TeamMembers() {
  return (
    <ResourcePage res="team" entity="team_members" title="Team on the website" sub="Names, roles and photos shown on /team and the homepage. Drop in a headshot; it is cropped square and resized for you."
      columns={[{ key: 'name', label: 'Name' }]}
      card={(r) => <TeamPreview m={r} />}
      preview={(v) => <TeamPreview m={v} />}
      defaults={{ published: 1, sort: 100 }}
      fields={[
        { name: 'photo', label: 'Headshot', type: 'image', folder: 'team', square: true, maxPx: 800 },
        { name: 'name', label: 'Name' }, { name: 'role', label: 'Role on the website' }, { name: 'bio', label: 'Short bio', type: 'textarea', help: 'One or two sentences. Shown under the role.' },
        { name: 'linkedin', label: 'LinkedIn URL', type: 'url' }, { name: 'github', label: 'GitHub URL', type: 'url' },
        { name: 'sort', label: 'Order', type: 'number', help: 'Lower shows first' }, { name: 'published', label: 'Show on website', type: 'checkbox' },
      ]} />
  );
}

export function Posts() {
  return (
    <ResourcePage res="posts" entity="posts" title="Insights (blog)" sub="Articles at /insights. Write in HTML (paragraphs, h2, lists, links)."
      columns={[{ key: 'title', label: 'Title', render: (r) => <strong>{r.title}</strong> }, { key: 'category', label: 'Category' }, { key: 'status', label: 'Status', render: (r) => <Status s={r.status} /> }, { key: 'published_at', label: 'Published', render: (r) => fmtDate(r.published_at) }]}
      defaults={{ status: 'draft' }}
      fields={[{ name: 'title', label: 'Title', wide: true }, { name: 'slug', label: 'URL slug' }, { name: 'category', label: 'Category' }, { name: 'excerpt', label: 'Excerpt (meta description)', type: 'textarea', rows: 2 },
        { name: 'content_html', label: 'Content (HTML)', type: 'html', rows: 18 }, { name: 'status', label: 'Status', type: 'select', options: ['draft', 'published'] }, { name: 'published_at', label: 'Publish date', type: 'date' }]} />
  );
}

export function Knowledge({ embedded }: { embedded?: boolean } = {}) {
  return (
    <ResourcePage embedded={embedded} res="knowledge" entity="knowledge" title="Chatbot knowledge" sub="The website assistant only answers from what is published here (plus the marketplace price list)."
      columns={[{ key: 'title', label: 'Title', render: (r) => <strong>{r.title}</strong> }, { key: 'content', label: 'Content', render: (r) => <span className="small">{r.content.slice(0, 140)}</span> }, { key: 'published', label: 'Used', render: (r) => (r.published ? 'yes' : 'no') }]}
      defaults={{ published: 1 }}
      fields={[{ name: 'title', label: 'Title', wide: true }, { name: 'content', label: 'Content', type: 'textarea', rows: 14 }, { name: 'published', label: 'Use in chatbot', type: 'checkbox' }]} />
  );
}

export function Ads() {
  return (
    <ResourcePage res="ads" entity="ad_campaigns" title="Ads" sub="Plan campaigns now; connect Meta, Google and TikTok ad accounts when you’re ready to spend. Record results to compare cost per lead." writeRole="admin"
      columns={[
        { key: 'name', label: 'Campaign', render: (r) => <><strong>{r.name}</strong><div className="muted small">{r.objective}</div></> },
        { key: 'platform', label: 'Platform', render: (r) => <span className={`plat ${r.platform}`}>{r.platform}</span> },
        { key: 'daily_budget', label: 'Daily budget', render: (r) => money(r.daily_budget, r.currency) },
        { key: 'dates', label: 'Dates', render: (r) => `${fmtDate(r.start_date)} → ${fmtDate(r.end_date)}` },
        { key: 'status', label: 'Status', render: (r) => <Status s={r.status} /> },
        { key: 'cpl', label: 'Cost / lead', render: (r) => { try { const m = JSON.parse(r.metrics_json || '{}'); return m.leads ? money(Math.round(m.spend / m.leads), r.currency) : '—'; } catch { return '—'; } } },
      ]}
      defaults={{ platform: 'meta', currency: 'NGN', status: 'planned' }}
      toForm={(r) => { const m = (() => { try { return JSON.parse(r.metrics_json || '{}'); } catch { return {}; } })(); return { ...r, spend: m.spend ?? '', impressions: m.impressions ?? '', clicks: m.clicks ?? '', leads: m.leads ?? '', creatives: jsonList(r.creatives_json) }; }}
      fromForm={({ spend, impressions, clicks, leads, creatives, ...v }) => ({ ...v, creatives_json: listJson(creatives), metrics_json: JSON.stringify({ spend: Number(spend) || 0, impressions: Number(impressions) || 0, clicks: Number(clicks) || 0, leads: Number(leads) || 0 }) })}
      fields={[
        { name: 'name', label: 'Campaign name', wide: true },
        { name: 'platform', label: 'Platform', type: 'select', options: ['meta', 'google', 'tiktok', 'linkedin', 'x'] },
        { name: 'objective', label: 'Objective', type: 'select', options: ['Leads (WhatsApp)', 'Leads (form)', 'Website traffic', 'Retargeting demo viewers', 'Awareness'] },
        { name: 'audience', label: 'Audience', type: 'textarea', rows: 3, placeholder: 'e.g. Clinic owners & hospital admins, Lagos + Abuja, 28–55, interests: healthcare management' },
        { name: 'daily_budget', label: 'Daily budget', type: 'number' }, { name: 'currency', label: 'Currency', type: 'select', options: ['NGN', 'USD'] },
        { name: 'start_date', label: 'Start', type: 'date' }, { name: 'end_date', label: 'End', type: 'date' },
        { name: 'status', label: 'Status', type: 'select', options: ['planned', 'ready', 'live', 'paused', 'ended'] },
        { name: 'creatives', label: 'Creatives (one per line: content post IDs or asset links)', type: 'textarea', rows: 3 },
        { name: 'spend', label: 'Spend so far', type: 'number' }, { name: 'impressions', label: 'Impressions', type: 'number' }, { name: 'clicks', label: 'Clicks', type: 'number' }, { name: 'leads', label: 'Leads', type: 'number' },
        { name: 'notes', label: 'Notes', type: 'textarea' },
      ]} />
  );
}
