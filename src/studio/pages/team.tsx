import React, { useState } from 'react';
import { ago, api, can } from '../api';
import { Badge, Card, copy, Empty, Fields, Loading, Page, Pager, Tabs, useData, usePaged, useToast, useUser } from '../ui';
import { Activity, ArrowRight } from 'lucide-react';

const ROLES: [string, string][] = [['admin', 'Admin — everything except owner settings'], ['editor', 'Editor — website, content, marketplace'], ['sales', 'Sales — leads, outreach, meetings, quotes'], ['viewer', 'Viewer — read only']];

export function TeamAccess() {
  const me = useUser()!;
  const toast = useToast();
  const [tab, setTab] = useState('people');
  const [who, setWho] = useState('');
  const { data: users, reload } = useData(() => api('/users').then((r) => r.rows));
  const { data: activity, loading } = useData(() => api(`/activity${who ? `?user=${who}` : ''}`).then((r) => r.rows), [who]);
  const pgAct = usePaged<any>(activity, 'team-activity', who);
  const [inv, setInv] = useState<Record<string, any>>({ role: 'editor' });
  const [link, setLink] = useState('');
  const invite = async (body: Record<string, any>) => {
    try { const r = await api('/users/invite', { body }); setLink(r.link); copy(r.link, toast, 'Invite link copied — send it on WhatsApp or email'); reload(); }
    catch (x: any) { toast(x.message, 'err'); }
  };
  return (
    <Page title="Team & access" sub="Who can sign in, what they can change, and everything they’ve changed.">
      <Tabs tabs={[['people', 'People'], ['activity', 'Activity log']]} value={tab} onChange={setTab} />
      {tab === 'people' ? (
        <>
          <Card title="Accounts">
            {!users ? <Loading /> : (
              <table className="table">
                <thead><tr><th>Name</th><th>Role</th><th>Status</th><th>Last sign-in</th><th>Edits</th><th></th></tr></thead>
                <tbody>{users.map((u: any) => (
                  <tr key={u.id}>
                    <td><strong>{u.name}</strong>{u.id === me.id ? <Badge>you</Badge> : null}<div className="muted small">{u.email} {u.title ? `· ${u.title}` : ''}</div></td>
                    <td>{u.role === 'owner' || !can(me, 'admin') ? <Badge tone="orange">{u.role}</Badge> : (
                      <select value={u.role} onChange={async (e) => { await api(`/users/${u.id}`, { method: 'PATCH', body: { role: e.target.value } }).catch((x) => toast(x.message, 'err')); reload(); }}>
                        {ROLES.map(([r]) => <option key={r} value={r} disabled={r === 'admin' && me.role !== 'owner'}>{r}</option>)}
                      </select>)}</td>
                    <td>{!u.active ? <Badge tone="red">disabled</Badge> : u.activated ? <Badge tone="green">active</Badge> : <Badge tone="orange">invite pending</Badge>}</td>
                    <td className="muted">{u.last_login_at ? ago(u.last_login_at) : 'never'}</td>
                    <td><button className="link" onClick={() => { setWho(u.id); setTab('activity'); }}>{u.edits} <ArrowRight size={13} strokeWidth={2} /></button></td>
                    <td className="row-actions">
                      {can(me, 'admin') && !u.activated ? <button className="btn sm" onClick={() => invite({ user_id: u.id })}>Get invite link</button> : null}
                      {can(me, 'admin') && u.id !== me.id && u.role !== 'owner' ? <button className="btn sm ghost" onClick={async () => { await api(`/users/${u.id}`, { method: 'PATCH', body: { active: !u.active } }); reload(); }}>{u.active ? 'Disable' : 'Enable'}</button> : null}
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </Card>
          {can(me, 'admin') ? (
            <Card title="Invite someone">
              <Fields value={inv} onChange={setInv} fields={[
                { name: 'name', label: 'Name' }, { name: 'email', label: 'Email', type: 'email' }, { name: 'title', label: 'Title (e.g. Co-founder)' },
                { name: 'role', label: 'Access', type: 'select', options: ROLES },
              ]} />
              <div className="drawer-actions"><button className="btn primary" onClick={() => invite(inv)}>Create invite link</button></div>
              {link ? <p className="small">Invite link (valid 7 days): <code className="wrap">{link}</code></p> : null}
            </Card>
          ) : null}
          <Card title="What each role can do">
            <ul className="small">{ROLES.map(([r, d]) => <li key={r}><strong>{r}</strong> — {d.split('— ')[1]}</li>)}<li><strong>owner</strong> — everything, including creating admins.</li></ul>
          </Card>
        </>
      ) : (
        <Card title="Activity" actions={<select value={who} onChange={(e) => setWho(e.target.value)}><option value="">Everyone</option>{users?.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>}>
          {loading ? <Loading /> : !activity?.length ? <Empty icon={Activity} title="No activity yet">Every create, edit and delete is logged here with who did it.</Empty> : (
            <table className="table"><thead><tr><th>When</th><th>Who</th><th>What</th><th>Area</th></tr></thead>
              <tbody>{pgAct.rows.map((a: any) => <tr key={a.id}><td className="muted nowrap">{ago(a.at)}</td><td><strong>{a.user_name}</strong></td><td>{a.summary}</td><td className="muted small">{a.entity}</td></tr>)}</tbody></table>
          )}
          <Pager pg={pgAct} noun="changes" />
        </Card>
      )}
    </Page>
  );
}

export function Settings() {
  const me = useUser()!;
  const toast = useToast();
  const { data, reload } = useData(() => api('/settings'));
  const [pw, setPw] = useState<Record<string, any>>({});
  const target = data?.rows?.find((r: any) => r.key === 'monthly_target_ngn')?.value ?? '';
  const [t, setT] = useState('');
  return (
    <Page title="Settings" sub="Integrations, targets and your account.">
      <Card title="Integrations">
        {!data ? <Loading /> : <dl className="dl">{Object.entries(data.integrations).map(([k, v]) => <React.Fragment key={k}><dt>{k}</dt><dd>{String(v)}</dd></React.Fragment>)}</dl>}
        <p className="muted small">Keys are Cloudflare secrets (Workers → ferrn → Settings → Variables and Secrets), never stored in the database. See docs/SETUP.md in the repo.</p>
      </Card>
      {can(me, 'admin') ? (
        <Card title="Targets">
          <div className="fields"><label className="field"><span>Monthly revenue target (₦)</span><input type="number" value={t || target} onChange={(e) => setT(e.target.value)} /></label></div>
          <div className="drawer-actions"><button className="btn primary" onClick={async () => { await api('/settings/monthly_target_ngn', { method: 'PUT', body: { value: t || target } }); toast('Saved'); reload(); }}>Save</button></div>
        </Card>
      ) : null}
      <Card title="Change your password">
        <Fields value={pw} onChange={setPw} fields={[{ name: 'current', label: 'Current password', type: 'text' }, { name: 'password', label: 'New password (10+ characters, letters and numbers)', type: 'text' }]} />
        <div className="drawer-actions"><button className="btn primary" onClick={async () => { try { await api('/api/auth/password', { body: pw }); toast('Password changed'); setPw({}); } catch (x: any) { toast(x.message, 'err'); } }}>Update password</button></div>
      </Card>
      <Card title="Install Ferrn Studio as an app">
        <ul className="small">
          <li><strong>Mac / Windows (Chrome or Edge):</strong> click the install icon in the address bar, or ⋮ → “Install Ferrn Studio”. It opens in its own window with the Ferrn icon.</li>
          <li><strong>iPhone (Safari):</strong> Share → “Add to Home Screen”.</li>
          <li><strong>Android (Chrome):</strong> ⋮ → “Install app”.</li>
        </ul>
        <button className="btn ghost" onClick={() => (window as any).ferrnInstall ? (window as any).ferrnInstall() : toast('Use your browser’s install option (see above)')}>Install now</button>
      </Card>
    </Page>
  );
}
