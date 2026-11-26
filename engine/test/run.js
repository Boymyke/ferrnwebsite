const assert = require('assert');
const { makeEnv } = require('./harness');

let passed = 0;
function ok(cond, msg) { assert.ok(cond, msg); passed++; console.log('  ✓ ' + msg); }

console.log('1. setup');
const E = makeEnv({ now: '2026-10-29T08:50:00+01:00' }); // Thursday
const r = E.ctx.setup();
ok(/Setup complete/.test(r), 'setup returns success');
ok(['Leads', 'Messages', 'Inbox', 'Suppression', 'Settings', 'Log'].every(n => E.sheets[n]), 'all tabs created');
ok(!E.sheets['Sheet1'], 'blank Sheet1 removed');
const S = E.ctx.settings_();
ok(S.INBOX_FOLDER_ID && S.BRIEF_DOC_ID, 'folders + brief doc created');
ok(S.FROM_ALIAS === 'michael@ferrnagency.com', 'sends from michael@ferrnagency.com by default');
E.ctx.setup();
ok(E.rows('Settings').length === E.ctx.DEFAULT_SETTINGS.length, 'setup is safe to run twice');

console.log('2. ingest a batch from the AI routine');
E.dropFile('batch-1.json', {
  leads: [
    { key: 'acme', company: 'Acme Freight Ltd', niche: 'logistics', website: 'https://www.acmefreight.ng/about', email: 'Info@AcmeFreight.ng', city: 'Lagos', tier: 'A', est_value: 2500000, gaps: 'no quote form' },
    { key: 'kola', company: 'Kola Haulage', niche: 'logistics', phone: '0803 111 2222', city: 'Lagos', tier: 'C' },
    { key: 'acme2', company: 'ACME FREIGHT', website: 'acmefreight.ng' },
  ],
  messages: [
    { lead_key: 'acme', step: 0, channel: 'email', subject: 'Acme Freight: quick idea', body: 'Hi Tunde,\n\nI noticed your site has no quote form.' },
    { lead_key: 'acme', step: 1, channel: 'email', delay_days: 3, body: 'Just bringing this back up.' },
    { lead_key: 'acme', step: 2, channel: 'email', delay_days: 7, body: '=HYPERLINK("x") one quick thought.' },
    { lead_key: 'acme', step: 3, channel: 'email', delay_days: 14, body: 'Last note from me.' },
    { lead_key: 'kola', step: 0, channel: 'whatsapp', body: 'Hi, I found Kola Haulage but no website.' },
    { lead_key: 'kola', step: 1, channel: 'whatsapp', delay_days: 3, body: 'Following up.' },
    { lead_key: 'acme2', step: 0, channel: 'email', to: 'x@acmefreight.ng', body: 'dup' },
  ],
  log: 'Run 1: 3 leads',
});
E.ctx.tick();
const leads = E.rows('Leads');
ok(leads.length === 2, 'duplicate lead (same domain) skipped');
const acme = leads.find(l => l.company === 'Acme Freight Ltd');
ok(acme.email === 'info@acmefreight.ng', 'email normalised to lowercase');
ok(acme.status === 'Queued', 'acme status Queued');
ok(E.rows('Messages').length === 6, '6 messages queued (dup lead message dropped)');
ok(E.rows('Messages').find(m => String(m.step) === '2').body.startsWith('=HYPERLINK'), 'formula-looking text stored as plain text');
ok(E.sent.length === 0, 'outside window (08:50) nothing sent');

console.log('3. hold window + first send');
E.setNow('2026-10-29T09:05:00+01:00');
E.ctx.tick();
ok(E.sent.length === 0, 'first email held for 30 minutes');
E.setNow('2026-10-29T09:25:00+01:00');
E.ctx.tick();
ok(E.sent.length === 1, 'first email sent after hold');
const raw = E.sent[0].raw;
ok(/From: Michael \| Ferrn Digital Agency <michael@ferrnagency.com>/.test(raw), 'From header uses alias + name');
ok(/To: info@acmefreight.ng/.test(raw), 'sent to the lead');
const body0 = Buffer.from(raw.split('Content-Transfer-Encoding: base64\r\n\r\n')[1].split('\r\n--')[0].replace(/\r\n/g, ''), 'base64').toString();
ok(/no thanks/.test(body0) && /ferrnagency.com/.test(body0), 'signature + opt-out line added');
let acmeL = E.rows('Leads').find(l => l.id === acme.id);
ok(acmeL.status === 'Contacted' && acmeL.thread_id, 'lead Contacted with thread id');
const f1 = E.rows('Messages').find(m => String(m.step) === '1' && m.lead_id === acme.id);
ok(Math.round((new Date(f1.send_after) - new Date('2026-10-29T09:25:00+01:00')) / 86400000) === 3, 'follow-up 1 scheduled +3 days from actual send');

console.log('4. follow-up on the weekend waits for Monday, threads correctly');
E.setNow('2026-11-01T10:00:00+01:00'); // Sunday
E.ctx.tick();
ok(E.sent.length === 1, 'nothing sent on Sunday');
E.setNow('2026-11-02T08:40:00+01:00'); // Monday, inside the morning batch
E.ctx.tick();
ok(E.sent.length === 2, 'follow-up 1 sent Monday morning');
ok(E.sent[1].threadId === E.sent[0].threadId, 'follow-up sent in the same Gmail thread');
ok(/Subject: Re: Acme Freight: quick idea/.test(E.sent[1].raw), 'follow-up subject is Re: original');
ok(/In-Reply-To: <g1@mail.gmail.com>/.test(E.sent[1].raw), 'In-Reply-To header set');
ok(E.rows('Leads').find(l => l.id === acme.id).status === 'Following up', 'lead Following up');

console.log('5. reply detection');
E.inboundThreads.push({ id: E.sent[0].threadId, messages: [
  { id: 'in1', from: 'Tunde <info@acmefreight.ng>', date: new Date('2026-11-02T11:00:00+01:00'), subject: 'Re: Acme Freight: quick idea',
    body: 'Thanks Michael. How much would this cost? Can we do a call Thursday?\n\nOn Mon, Nov 2, 2026 Michael wrote:\n> Just bringing this back up.' },
] });
E.setNow('2026-11-02T11:05:00+01:00');
E.ctx.tick();
const inbox = E.rows('Inbox');
ok(inbox.length === 1 && inbox[0].status === 'new', 'reply captured in Inbox as new');
ok(!/wrote:/.test(inbox[0].body), 'quoted history stripped from reply');
acmeL = E.rows('Leads').find(l => l.id === acme.id);
ok(acmeL.status === 'Replied', 'lead status Replied');
ok(acmeL.needs_you === 'Y', 'call/price mention flagged for you');
ok(E.rows('Messages').filter(m => m.lead_id === acme.id && ['2', '3'].includes(String(m.step))).every(m => m.status === 'cancelled'), 'remaining follow-ups cancelled');
const brief = Object.values(E.docs)[0];
ok(/NEW REPLIES TO HANDLE[\s\S]*How much would this cost/.test(brief), 'brief shows the reply for the AI routine');
ok(/INBOX_FOLDER_ID: F\d/.test(brief), 'brief carries the inbox folder id');
E.ctx.tick();
ok(E.rows('Inbox').length === 1, 'same reply not captured twice');

console.log('6. AI reply goes out in-thread, inbox marked handled');
E.dropFile('batch-2.json', {
  messages: [{ lead_id: acme.id, step: 'R', channel: 'email', to: 'info@acmefreight.ng', body: 'Great question Tunde. Sites like this usually run ₦1.5M–₦3M.' }],
  inbox_updates: [{ id: inbox[0].id, status: 'handled', classification: 'pricing + call request' }],
  lead_updates: [{ id: acme.id, status: 'Interested', append_note: 'Asked for price + call' }],
});
E.setNow('2026-11-02T13:00:00+01:00');
E.ctx.tick();
ok(E.sent.length === 3 && E.sent[2].threadId === E.sent[0].threadId, 'reply sent in same thread');
ok(!/no thanks/.test(Buffer.from(E.sent[2].raw.split('base64\r\n\r\n')[1].split('\r\n--')[0].replace(/\r\n/g, ''), 'base64').toString()), 'no opt-out line on direct replies');
ok(/Subject: =\?UTF-8\?B\?|Subject: Re:/.test(E.sent[2].raw), 'subject encoded/threaded');
ok(E.rows('Inbox')[0].status === 'handled', 'inbox item handled');
ok(E.rows('Leads').find(l => l.id === acme.id).status === 'Interested', 'lead moved to Interested');

console.log('7. opt-out + bounce');
E.dropFile('batch-3.json', {
  leads: [
    { key: 'b', company: 'Beta Clinic', niche: 'clinic', email: 'hello@betaclinic.ng', website: 'betaclinic.ng' },
    { key: 'c', company: 'Gamma Homes', niche: 'realestate', email: 'sales@gammahomes.ng', website: 'gammahomes.ng' },
  ],
  messages: [
    { lead_key: 'b', step: 0, subject: 'Beta Clinic', body: 'Hi' }, { lead_key: 'b', step: 1, delay_days: 3, body: 'fu' },
    { lead_key: 'c', step: 0, subject: 'Gamma Homes', body: 'Hi' }, { lead_key: 'c', step: 1, delay_days: 3, body: 'fu' },
  ],
});
E.setNow('2026-11-03T09:00:00+01:00');
E.ctx.tick();
E.setNow('2026-11-03T09:40:00+01:00');
E.ctx.tick();
E.setNow('2026-11-03T09:55:00+01:00'); // cold emails go one at a time, at least 12 minutes apart
E.ctx.tick();
const beta = E.rows('Leads').find(l => l.company === 'Beta Clinic');
const gamma = E.rows('Leads').find(l => l.company === 'Gamma Homes');
ok(beta.thread_id && gamma.thread_id, 'both first emails sent');
E.inboundThreads.push({ id: beta.thread_id, messages: [{ id: 'in2', from: 'hello@betaclinic.ng', date: new Date('2026-11-03T10:00:00+01:00'), subject: 'Re', body: 'No thanks, please remove me.' }] });
E.inboundThreads.push({ id: gamma.thread_id, messages: [{ id: 'in3', from: 'Mail Delivery Subsystem <mailer-daemon@googlemail.com>', date: new Date('2026-11-03T09:58:00+01:00'), subject: 'Delivery Status Notification', body: 'Address not found sales@gammahomes.ng' }] });
E.setNow('2026-11-03T10:05:00+01:00');
E.ctx.tick();
ok(E.rows('Leads').find(l => l.id === beta.id).status === 'Opted out', 'opt-out detected');
ok(E.rows('Suppression').some(s => s.email === 'hello@betaclinic.ng'), 'opted-out email suppressed');
ok(E.rows('Leads').find(l => l.id === gamma.id).status === 'Bounced', 'bounce detected');
ok(E.rows('Messages').filter(m => [beta.id, gamma.id].includes(m.lead_id) && String(m.step) === '1').every(m => m.status === 'cancelled'), 'their follow-ups cancelled');
E.dropFile('batch-4.json', { leads: [{ key: 'b2', company: 'Beta Clinic Two', email: 'hello@betaclinic.ng' }], messages: [{ lead_key: 'b2', step: 0, body: 'x' }] });
E.ctx.tick();
ok(E.rows('Leads').filter(l => l.email === 'hello@betaclinic.ng').length === 1, 'opted-out address never re-added');

console.log('8. spaced batches + daily caps');
const many = [], mm = [];
for (let i = 0; i < 30; i++) { many.push({ key: 'k' + i, company: 'Co ' + i + 'x', email: `a${i}@co${i}.ng`, website: `co${i}.ng` }); mm.push({ lead_key: 'k' + i, step: 0, subject: 'Hi', body: 'b' }); }
E.dropFile('batch-5.json', { leads: many, messages: mm });
E.set('HOLD_MINUTES', '0');
const day = '2026-11-04';
for (let mins = 7 * 60; mins <= 18 * 60; mins += 5) {   // a whole Wednesday, ticking every 5 minutes
  E.setNow(`${day}T${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}:00+01:00`);
  E.ctx.tick();
}
const todays = E.sent.filter(s => s.at.toISOString().startsWith(day)).map(s => s.at.getTime()).sort((a, b) => a - b);
const lagosHM = (t) => new Date(t + 3600000).toISOString().slice(11, 16);
const morning = todays.filter(t => lagosHM(t) >= '08:30' && lagosHM(t) <= '11:30').length;
const afternoon = todays.filter(t => lagosHM(t) >= '13:30' && lagosHM(t) <= '16:30').length;
ok(todays.length === 20, 'two batches, 20 cold emails in the day (sent ' + todays.length + ')');
ok(morning === 10 && afternoon === 10, 'ten in the morning window, ten in the afternoon (' + morning + ' + ' + afternoon + ')');
ok(todays.every(t => (lagosHM(t) >= '08:30' && lagosHM(t) <= '11:30') || (lagosHM(t) >= '13:30' && lagosHM(t) <= '16:30')), 'nothing cold outside the windows');
const gaps = todays.slice(1).map((t, i) => (t - todays[i]) / 60000);
ok(gaps.every(g => g >= 12), 'at least 12 minutes between cold emails (smallest gap ' + Math.min(...gaps) + ' min)');
ok(new Set(gaps.filter(g => g < 60)).size > 1, 'gaps vary, not clockwork');
// follow-ups and new first emails share the windows
const nl = [], nm = [];
for (let i = 0; i < 4; i++) { nl.push({ key: 'n' + i, company: 'New ' + i + 'q', email: `n${i}@new${i}.ng`, website: `new${i}.ng` }); nm.push({ lead_key: 'n' + i, step: 0, subject: 'Hi', body: 'b' }, { lead_key: 'n' + i, step: 1, delay_days: 1, body: 'fu' }); }
E.dropFile('batch-5b.json', { leads: nl, messages: nm });
const runMorning = (d) => { for (let mins = 8 * 60 + 30; mins <= 11 * 60 + 30; mins += 5) { E.setNow(`${d}T${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}:00+01:00`); E.ctx.tick(); } };
E.set('BATCH_SIZE', '30'); E.set('DAILY_CAP_FIRST', '30'); E.set('GAP_MINUTES', '1');
runMorning('2026-11-09');                 // Monday: clear every waiting first email, so the 4 follow-ups fall due Tuesday
E.set('BATCH_SIZE', '10'); E.set('DAILY_CAP_FIRST', '20'); E.set('GAP_MINUTES', '12');
const more = [], moreM = [];
for (let i = 0; i < 12; i++) { more.push({ key: 'm' + i, company: 'More ' + i + 'z', email: `m${i}@more${i}.ng`, website: `more${i}.ng` }); moreM.push({ lead_key: 'm' + i, step: 0, subject: 'Hi', body: 'b' }); }
E.dropFile('batch-5c.json', { leads: more, messages: moreM });
const sentBefore = E.sent.length;
runMorning('2026-11-10');                 // Tuesday: 4 follow-ups due and 12 new first emails waiting
const tue = E.sent.slice(sentBefore);
ok(tue.some(x => !/In-Reply-To/.test(x.raw)) && tue.some(x => /In-Reply-To/.test(x.raw)), 'new first emails and follow-ups share the window (' + tue.filter(x => /In-Reply-To/.test(x.raw)).length + ' follow-ups, ' + tue.filter(x => !/In-Reply-To/.test(x.raw)).length + ' first)');
ok(tue.length === 10, 'still 10 in the window');
ok(E.triggers.length === 1 && E.props.TICK_EVERY === '5', 'engine switched itself to a 5-minute tick');

console.log('9. dashboard + WhatsApp flow');
const kola = E.rows('Leads').find(l => l.company === 'Kola Haulage');
let d = E.ctx.getDashboardData();
JSON.parse(JSON.stringify(d));
ok(true, 'dashboard data is serialisable');
const wa = d.whatsapp.find(w => w.lead_id === kola.id);
ok(wa && wa.wa_link.startsWith('https://wa.me/2348031112222?text='), 'WhatsApp one-tap link with +234 number');
ok(!d.whatsapp.some(w => w.lead_id === kola.id && w.step === '1'), 'WA follow-up hidden until first is sent');
d = E.ctx.dashAction('waSent', { id: wa.id });
ok(E.rows('Leads').find(l => l.id === kola.id).status === 'Contacted', 'marking WA sent moves lead to Contacted');
const waf = E.rows('Messages').find(m => m.lead_id === kola.id && String(m.step) === '1');
ok(waf.send_after, 'WA follow-up scheduled after you send the first one');
ok(d.needsYou.some(n => n.id === acme.id), 'needs-you list includes the call/price lead');
d = E.ctx.dashAction('resolve', { lead_id: acme.id });
ok(!d.needsYou.some(n => n.id === acme.id), 'resolve clears the flag');
d = E.ctx.dashAction('setStatus', { lead_id: acme.id, status: 'Won', est_value: 3000000 });
ok(d.kpis.wonMonth === 3000000, 'won value counts toward the monthly target');
E.set('AUTO_SEND', 'FALSE');
E.dropFile('batch-6.json', { leads: [{ key: 'z', company: 'Zeta', email: 'z@zeta.ng' }], messages: [{ lead_key: 'z', step: 0, body: 'hi' }] });
const before = E.sent.length;
E.setNow('2026-11-05T09:00:00+01:00');
E.ctx.tick();
ok(E.sent.length === before, 'AUTO_SEND=FALSE: nothing sends on its own');
const zm = E.rows('Messages').find(m => m.to === 'z@zeta.ng');
E.ctx.dashAction('sendNow', { id: zm.id });
ok(E.sent.length === before + 1, 'Send now works from the dashboard');

console.log('10. stale leads');
E.setNow('2026-12-10T09:00:00+01:00');
E.ctx.tick();
ok(E.rows('Leads').some(l => l.status === 'No reply'), 'finished sequences marked No reply');
ok(!E.rows('Log').some(l => l.level === 'error'), 'no errors in the log');

console.log('11. AI batch exactly as the routine writes it');
const E2 = makeEnv({ now: '2026-10-29T10:00:00+01:00' });
E2.ctx.setup();
E2.set('HOLD_MINUTES', '0');
E2.dropFile('batch-2026-10-29-0700.json', {
  leads: [{ key: 'lyon', company: 'Lyon Grand Cargo', niche: 'logistics', website: 'https://lyon-grand-cargo-logistics.onrender.com', email: 'lyongrandcargo24@gmail.com', phone: '+234 707 091 9004', contact_name: 'Edmond Lyon', role: 'CEO', city: 'Lagos', tier: 'A', score: 88, gaps: 'free subdomain; broken link', pitch: 'site + quote form', est_value: 2500000, preview_url: 'https://previews.ferrnagency.com/lyon-grand-cargo/', source: 'https://lyon-grand-cargo-logistics.onrender.com', notes: '' }],
  messages: [
    { lead_key: 'lyon', step: 0, channel: 'email', subject: 'Lyon Grand Cargo: your contact page', body: 'Hi Mr Lyon, ...', delay_days: 0, hold: false },
    { lead_key: 'lyon', step: 1, channel: 'email', body: 'bump', delay_days: 3, hold: false },
  ],
  lead_updates: [], inbox_updates: [], log: 'Morning run: 1 lead',
});
E2.ctx.tick();
ok(E2.sent.length === 1, 'routine batch ingested and first email sent');
ok(E2.rows('Leads')[0].preview_url.endsWith('/lyon-grand-cargo/'), 'preview link stored on the lead');
const lyonId = E2.rows('Leads')[0].id;
E2.inboundThreads.push({ id: E2.sent[0].threadId, messages: [{ id: 'x1', from: 'Edmond <lyongrandcargo24@gmail.com>', date: new Date('2026-10-29T10:30:00+01:00'), subject: 'Re', body: 'Not right now, maybe next year.' }] });
E2.setNow('2026-10-29T10:35:00+01:00');
E2.ctx.tick();
const ib = E2.rows('Inbox')[0];
E2.dropFile('batch-2026-10-29-1142.json', {
  messages: [{ lead_id: lyonId, step: 'R', channel: 'email', to: 'lyongrandcargo24@gmail.com', body: 'Understood, thank you.', hold: false },
             { lead_id: lyonId, step: 'R', channel: 'email', to: 'lyongrandcargo24@gmail.com', body: 'Draft needing OK', hold: true }],
  lead_updates: [{ id: lyonId, status: 'Lost', append_note: 'Revisit in 90 days', needs_you: '' }],
  inbox_updates: [{ id: ib.id, status: 'handled', classification: 'not now' }],
  log: 'Reply check',
});
E2.setNow('2026-10-29T11:50:00+01:00');
E2.ctx.tick();
ok(E2.sent.length === 2, 'reply to a "not now" lead still goes out even though lead is Lost');
ok(E2.rows('Messages').some(m => m.status === 'held'), 'held reply waits for your OK');
ok(/Revisit in 90 days/.test(E2.rows('Leads')[0].notes), 'note appended with timestamp');
ok(E2.ctx.getDashboardData().held.length === 1, 'held reply shows in Needs you');
ok(/leads_by_niche: \{"logistics":1\}/.test(Object.values(E2.docs)[0]), 'brief reports leads by niche for rotation');

console.log('12. hosted dashboard API');
const key = E2.ctx.settings_().API_KEY;
ok(/^fk_[0-9a-f]{48}$/.test(key), 'setup generated a long random access key');
const post = (body) => JSON.parse(E2.ctx.doPost({ postData: { contents: JSON.stringify(body) } }).getContent());
let res = post({ key: 'wrong', fn: 'getDashboardData' });
ok(!res.ok && /Wrong access key/.test(res.error), 'wrong key rejected');
res = post({ fn: 'getDashboardData' });
ok(!res.ok, 'missing key rejected');
res = post({ key, fn: 'setup' });
ok(!res.ok && /Unknown function/.test(res.error), 'only dashboard functions are callable');
res = post({ key, fn: 'getDashboardData' });
ok(res.ok && res.data.kpis.leads === 1, 'right key returns the dashboard data');
res = post({ key, fn: 'dashAction', args: ['setSetting', { key: 'AUTO_SEND', value: 'FALSE' }] });
ok(res.ok && res.data.settings.AUTO_SEND === false, 'dashboard actions work through the API');
ok(/running/.test(E2.ctx.doGet().getContent()), 'GET shows a plain status page (no dashboard served from Google)');
ok(!/API_KEY/.test(Object.values(E2.docs)[0]), 'access key never written into the brief');
module.exports.E2 = E2;

console.log('13. email tracking (opens + clicks, shown in Studio → Emails)');
{
  const crypto = require('crypto');
  const S1 = E.ctx.settings_();
  const parts = E.sent[0].raw.split('Content-Transfer-Encoding: base64\r\n\r\n');
  const text0 = Buffer.from(parts[1].split('\r\n--')[0].replace(/\r\n/g, ''), 'base64').toString();
  const html0 = Buffer.from(parts[2].split('\r\n--')[0].replace(/\r\n/g, ''), 'base64').toString();
  const px = html0.match(/\/api\/e\/o\/(lh-[A-Za-z0-9_-]+)\.gif\?t=(\d+)&amp;s=([a-f0-9]{20})/);
  ok(!!px && html0.startsWith('<div') && /https:\/\/www\.ferrnagency\.com\/api\/e\/o\//.test(html0), 'HTML part carries the open pixel on ferrnagency.com');
  const want = crypto.createHmac('sha256', S1.API_KEY).update(`${px[1]}|${px[2]}`).digest('hex').slice(0, 20);
  ok(px[3] === want, 'pixel signature matches the website (HMAC-SHA256 with the shared key)');
  ok(!/api\/e\//.test(text0), 'plain-text part has no tracking');
  const linked = E.ctx.trackHtml_(E.ctx.toHtml_('See https://www.ferrnagency.com/work?a=1&b=2 for examples.'), { id: 'lh-abc', t: 1761724800000 }, S1);
  const lm = linked.match(/href="https:\/\/www\.ferrnagency\.com\/api\/e\/c\/lh-abc\/0\?t=1761724800000&amp;u=([^&]+)&amp;s=([a-f0-9]{20})"/);
  ok(!!lm && decodeURIComponent(lm[1]) === 'https://www.ferrnagency.com/work?a=1&b=2', 'links go through the website with the real address kept');
  ok(lm[2] === crypto.createHmac('sha256', S1.API_KEY).update('lh-abc|1761724800000|https://www.ferrnagency.com/work?a=1&b=2').digest('hex').slice(0, 20), 'link signature covers the destination');
  const dash = E.ctx.getDashboardData();
  const sentRow = dash.recentSent.find((m) => m.channel === 'email' && m.status === 'sent');
  ok(sentRow && sentRow.tracked === true, 'snapshot marks tracked emails so the website lists them');
  ok(dash.settings.FROM_OK === true && dash.settings.FROM_ACTUAL === 'michael@ferrnagency.com', 'snapshot confirms Gmail can send as michael@ferrnagency.com');
  ok(!E.ctx.trackingOn_({ TRACK_EMAILS: 'FALSE', API_KEY: 'k' }) && E.ctx.trackingOn_({ API_KEY: 'k' }), 'TRACK_EMAILS=FALSE switches tracking off (on by default)');
  const saved = E.ctx.GmailApp.getAliases;
  E.ctx.GmailApp.getAliases = () => [];
  delete E.cache.ALIASES; // aliases are cached for 6 hours
  const fc = E.ctx.fromCheck_(S1);
  ok(fc.ok === false && fc.address === fc.me, 'without a verified "Send mail as" alias it reports the real sending address');
  E.ctx.GmailApp.getAliases = saved;
}

console.log('14. leads from the Studio autopilot');
{
  const before = E.rows('Leads').length;
  const res = E.ctx.dashAction('addLeads', { leads: [
    { id: 'L-a1b2c3d4e5f6', company: 'Thames Dental Studio', website: 'https://thamesdental.co.uk', email: 'Hello@ThamesDental.co.uk', city: 'London', niche: 'dental', tier: 'A', score: 82, gaps: 'Not mobile-friendly; no booking form', source: 'Autopilot · Google Maps · dental clinics in London, UK' },
    { id: 'L-zzzzzzzzzzzz', company: 'ACME FREIGHT', website: 'acmefreight.ng', email: 'x@acmefreight.ng', city: 'Lagos', source: 'Autopilot · Google Maps' },
  ] });
  ok(/leads \+1 \(dups 1\)/.test(res), 'adds new Studio leads and skips ones already in the sheet');
  const L = E.rows('Leads').find((x) => x.id === 'L-a1b2c3d4e5f6');
  ok(L && L.email === 'hello@thamesdental.co.uk' && E.rows('Leads').length === before + 1, 'keeps the Studio id and normalises the email');
  E.ctx.writeBrief_();
  const brief = Object.values(E.docs).pop();
  ok(/== WAITING FOR OUTREACH[\s\S]*L-a1b2c3d4e5f6 \| Thames Dental Studio/.test(brief), 'brief lists autopilot leads waiting for their first email');
  ok(E.ctx.DEFAULT_SETTINGS.find((x) => x[0] === 'CITIES')[1].startsWith('Lagos,London'), 'default cities are Lagos plus abroad');
}

console.log('15. RFPs from the RFP scout');
{
  E.dropFile('rfps-2026-11-03-0917.json', { rfps: [
    { title: 'Website Redevelopment', buyer: 'Firstport Housing Trust', country: 'UK', url: 'https://www.contractsfinder.service.gov.uk/Notice/abc?x=1', source: 'Contracts Finder', deadline: '2026-11-20T12:00:00Z', budget: '£20,000', scope: 'New WordPress site', fit_score: 86, fit_reasons: 'Open to non-UK suppliers; web redesign', requirements: 'Proposal PDF, 3 references', risks: 'Needs £1m PI insurance', next_step: 'Ask about insurance at the clarification stage' },
    { title: 'Website Redevelopment', buyer: 'Firstport Housing Trust', url: 'http://contractsfinder.service.gov.uk/Notice/abc/' },
    { title: 'No URL tender', buyer: 'X' },
  ], log: 'RFP scout: 1 new' });
  E.ctx.tick();
  const R = E.rows('RFPs');
  ok(R.length === 1 && R[0].status === 'new' && Number(R[0].fit_score) === 86, 'RFP batch creates the RFPs tab and adds one new RFP (duplicate and no-URL skipped)');
  E.ctx.dashAction('rfpStatus', { id: R[0].id, status: 'bidding', note: 'Going for it' });
  const R2 = E.rows('RFPs')[0];
  ok(R2.status === 'bidding' && /Going for it/.test(R2.notes), 'status and notes can be changed from Studio');
  const dash = E.ctx.getDashboardData();
  ok(dash.rfps.length === 1 && dash.rfps[0].title === 'Website Redevelopment' && dash.rfps[0].deadline, 'dashboard snapshot carries RFPs');
  E.ctx.writeBrief_();
  ok(/== RFPS ALREADY FOUND[\s\S]*Website Redevelopment \| Firstport Housing Trust/.test(Object.values(E.docs).pop()), 'brief lists found RFPs so the scout skips them');
  E.dropFile('rfps-2026-11-04-0917.json', { rfps: [{ title: 'website redevelopment', buyer: 'FIRSTPORT HOUSING TRUST', url: 'https://other.example/x' }] });
  E.ctx.tick();
  ok(E.rows('RFPs').length === 1, 'same title and buyer from another site is a duplicate');
}

console.log('16. two senders: premium (michael@ferrnagency.com) and volume (the Gmail account)');
{
  const E = makeEnv({ now: '2026-11-16T07:00:00+01:00' }); // Monday
  E.ctx.setup();
  E.set('HOLD_MINUTES', '0');
  E.set('VOLUME_FROM', 'osondumichealcharles@gmail.com');
  const L = [], M = [];
  for (let i = 0; i < 6; i++) { L.push({ key: 'a' + i, company: 'Alpha ' + i + 'p', tier: 'A', city: 'Lagos', email: `a${i}@alpha${i}.ng`, website: `alpha${i}.ng` }); M.push({ lead_key: 'a' + i, step: 0, subject: 'tracking for alpha', body: 'Hi', variant: 'open:question|close:a' }, { lead_key: 'a' + i, step: 1, delay_days: 3, body: 'fu' }); }
  for (let i = 0; i < 40; i++) { L.push({ key: 'b' + i, company: 'Beta ' + i + 'p', tier: 'B', city: 'Lagos', email: `b${i}@beta${i}.ng`, website: `beta${i}.ng` }); M.push({ lead_key: 'b' + i, step: 0, subject: 'quick one', body: 'Hi', variant: 'open:detail|close:b' }); }
  L.push({ key: 'u', company: 'UK Cargo', tier: 'B', city: 'London', email: 'ops@ukcargo.co.uk', website: 'ukcargo.co.uk' }); M.push({ lead_key: 'u', step: 0, subject: 'hi', body: 'Hi' });
  L.push({ key: 'p', company: 'Brand Studio', tier: 'B', niche: 'partner', city: 'Lagos', email: 'hi@brandstudio.ng', website: 'brandstudio.ng' }); M.push({ lead_key: 'p', step: 0, subject: 'hi', body: 'Hi' });
  E.dropFile('batch-s.json', { leads: L, messages: M });
  const day = '2026-11-16';
  for (let mins = 7 * 60; mins <= 18 * 60; mins += 5) { E.setNow(`${day}T${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}:00+01:00`); E.ctx.tick(); }
  const fromOf = (x) => (x.raw.match(/^From: .*<([^>]+)>/m) || [])[1];
  const toOf = (x) => (x.raw.match(/^To: (.*)$/m) || [])[1].trim();
  const prem = E.sent.filter(x => fromOf(x) === 'michael@ferrnagency.com'), vol = E.sent.filter(x => fromOf(x) === 'osondumichealcharles@gmail.com');
  ok(prem.length && prem.every(x => /alpha|ukcargo|brandstudio/.test(toOf(x))), 'Tier A, abroad and partner leads go from michael@ferrnagency.com (' + prem.length + ')');
  ok(vol.length && vol.every(x => /beta/.test(toOf(x))), 'standard Lagos leads go from the Gmail account (' + vol.length + ')');
  ok(vol.length === 10, 'first day of warm-up: 10 from the Gmail account (sent ' + vol.length + ')');
  const vt = vol.map(x => x.at.getTime()).sort((a, b) => a - b);
  ok(vt.slice(1).every((t, i) => t - vt[i] >= 8 * 60000), 'Gmail account sends are spaced at least 8 minutes apart');
  ok(vol.every(x => /\/api\/e\/o\//.test(Buffer.from(x.raw.split('text/html; charset="UTF-8"\r\nContent-Transfer-Encoding: base64\r\n\r\n')[1].split('\r\n--')[0].replace(/\r\n/g, ''), 'base64').toString())), 'emails from the Gmail account are tracked too');
  ok(E.rows('Leads').filter(l => /beta/.test(l.email) && l.thread_id).every(l => l.sender === 'osondumichealcharles@gmail.com'), 'each lead remembers its sender');
  // follow-ups keep the sender of the first email
  for (let d of ['2026-11-19', '2026-11-20']) for (let mins = 8 * 60 + 30; mins <= 11 * 60 + 30; mins += 5) { E.setNow(`${d}T${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}:00+01:00`); E.ctx.tick(); }
  const fus = E.sent.filter(x => /In-Reply-To/.test(x.raw));
  ok(fus.length && fus.every(x => fromOf(x) === 'michael@ferrnagency.com' && /alpha/.test(toOf(x))), 'follow-ups go from the same address as the first email');
  const v2 = E.sent.filter(x => fromOf(x) === 'osondumichealcharles@gmail.com' && x.at.toISOString().startsWith('2026-11-19')).length;
  ok(v2 > 10, 'warm-up raises the Gmail account allowance on later days (' + v2 + ' on day 4)');
  // learning from replies
  const lead = E.rows('Leads').find(l => l.email === 'b0@beta0.ng');
  E.ctx.dashAction('setStatus', { lead_id: lead.id, status: 'Interested' });
  E.ctx.writeBrief_();
  const br = Object.values(E.docs).pop();
  ok(/== WHAT IS WORKING[\s\S]*close:b: sent \d+, replied 1/.test(br) && /GOT A REPLY \| open:detail\|close:b/.test(br), 'brief shows reply rates by variant so the morning run can learn');
  ok(E.rows('Settings').some(r => r.key === 'VOLUME_START' && r.value), 'warm-up start recorded');
}

console.log('16b. Gmail account at 100 a day (Michael, 23 Nov 2026)');
{
  const E = makeEnv({ now: '2026-11-23T07:00:00+01:00' }); // Monday
  E.ctx.setup();
  E.set('HOLD_MINUTES', '0');
  E.set('VOLUME_FROM', 'osondumichealcharles@gmail.com');
  E.set('VOLUME_START', '2026-11-18');
  E.set('PREMIUM_RULE', 'A,partner');
  E.set('VOLUME_CAP_TOTAL', '100'); E.set('VOLUME_CAP_FIRST', '75'); E.set('VOLUME_BATCH_SIZE', '60');
  E.set('VOLUME_GAP_MINUTES', '1'); E.set('VOLUME_RAMP', '20,20');
  E.set('SEND_BATCHES', '08:00-12:30,13:00-17:55');
  const L = [], M = [];
  for (let i = 0; i < 130; i++) { L.push({ key: 'g' + i, company: 'Gamma ' + i + 'q', tier: 'B', city: i % 3 ? 'Lagos' : 'London', email: `g${i}@gamma${i}.ng`, website: `gamma${i}.ng` }); M.push({ lead_key: 'g' + i, step: 0, subject: 'quick one', body: 'Hi' }); }
  E.dropFile('batch-g.json', { leads: L, messages: M });
  const day = '2026-11-24'; // Tuesday
  for (let mins = 7 * 60; mins <= 18 * 60 + 30; mins += 5) { E.setNow(`${day}T${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}:00+01:00`); E.ctx.tick(); }
  const fromOf = (x) => (x.raw.match(/^From: .*<([^>]+)>/m) || [])[1];
  const vol = E.sent.filter(x => fromOf(x) === 'osondumichealcharles@gmail.com');
  ok(vol.length === 75, 'Gmail account sends its 75 first emails in one day (' + vol.length + ')');
  ok(vol.every(x => /gamma/.test(x.raw)), 'Tier B abroad leads go from the Gmail account too');
  const vt = vol.map(x => x.at.getTime()).sort((a, b) => a - b);
  ok(vt.slice(1).every((t, i) => t - vt[i] >= 60000), 'still never two in the same minute');
}

console.log('16c. bid writer marks RFPs submitted through a batch file');
{
  const E = makeEnv({ now: '2026-11-25T11:00:00+01:00' });
  E.ctx.setup();
  E.dropFile('rfps-1.json', { rfps: [{ title: 'Website redesign', buyer: 'Org A', url: 'https://example.org/rfp-a', deadline: '2026-12-10T17:00:00Z', fit_score: 80 }] });
  E.ctx.tick();
  const r = E.rows('RFPs')[0];
  ok(r && r.status === 'new', 'scout RFP added as new');
  E.dropFile('batch-bid.json', { rfp_updates: [{ id: r.id, status: 'submitted', note: 'Bid emailed to bids@example.org' }, { id: 'R-nope', status: 'submitted' }] });
  E.ctx.tick();
  const r2 = E.rows('RFPs').find(x => x.id === r.id);
  ok(r2.status === 'submitted' && /Bid emailed/.test(r2.notes), 'status and note updated by rfp_updates');
  E.ctx.dashAction('rfpStatus', { id: r.id, status: 'won' });
  ok(E.rows('RFPs').find(x => x.id === r.id).status === 'won', 'Studio button still works');
}

console.log('16d. concept-first first emails: wait for the concept, then show its screenshot');
{
  const E = makeEnv({ now: '2026-11-26T09:00:00+01:00' }); // Thursday
  E.ctx.setup();
  E.set('HOLD_MINUTES', '0');
  E.set('PREVIEW_BASE_URL', 'https://www.ferrnagency.com/concept');
  E.dropFile('batch-c.json', {
    leads: [{ key: 'k', company: 'Kargo Lines', niche: 'logistics', email: 'ade@kargolines.co.uk', city: 'London', tier: 'A', website: 'kargolines.co.uk', contact_name: 'Ade' }],
    messages: [{ lead_key: 'k', step: 0, subject: 'your new homepage', body: 'Hi Ade,\n\nI redesigned your homepage:\n\n{{CONCEPT}}\n\nWorth a look?\n\nMichael' }],
    previews: [{ key: 'k', slug: 'kargo-lines', company: 'Kargo Lines', html: '<!doctype html><html><head><title>Kargo Lines</title></head><body>' + 'x'.repeat(300) + '</body></html>' }],
  });
  E.setNow('2026-11-26T09:30:00+01:00'); E.ctx.tick();
  ok(E.sent.length === 0, 'first email waits while the concept is not live yet');
  E.ctx.dashAction('previewSynced', { slug: 'kargo-lines', url: 'https://www.ferrnagency.com/concept/kargo-lines/' });
  E.setNow('2026-11-26T09:45:00+01:00'); E.ctx.tick();
  ok(E.sent.length === 1, 'sent once the concept is live');
  const raw = E.sent[0].raw;
  const part = (type) => Buffer.from(raw.split(`Content-Type: ${type}; charset="UTF-8"\r\nContent-Transfer-Encoding: base64\r\n\r\n`)[1].split('\r\n--')[0].replace(/\r\n/g, ''), 'base64').toString();
  const html = part('text/html'), text = part('text/plain');
  ok(/kargo-lines\/shot\.jpg/.test(html) && /<img /.test(html), 'HTML shows the concept screenshot');
  ok(text.includes('https://www.ferrnagency.com/concept/kargo-lines/') && !text.includes('{{CONCEPT}}'), 'plain text has the concept link, no placeholder');
  // a concept that never goes live: after two days the email goes without it
  const E2 = makeEnv({ now: '2026-11-26T09:00:00+01:00' });
  E2.ctx.setup(); E2.set('HOLD_MINUTES', '0');
  E2.dropFile('b2.json', { leads: [{ key: 'z', company: 'Zed Care', email: 'hi@zedcare.co.uk', city: 'London', tier: 'A', website: 'zedcare.co.uk' }],
    messages: [{ lead_key: 'z', step: 0, subject: 'hello', body: 'Hi,\n\nI redesigned your homepage:\n\n{{CONCEPT}}\n\nMichael' }] });
  E2.setNow('2026-11-26T09:30:00+01:00'); E2.ctx.tick();
  ok(E2.sent.length === 0, 'no concept yet: waits');
  E2.setNow('2026-11-30T09:30:00+01:00'); E2.ctx.tick();
  ok(E2.sent.length === 1 && !/\{\{CONCEPT\}\}/.test(E2.sent[0].raw), 'after two days it goes without the placeholder');
}

console.log('16e. follow-ups: people who opened first, non-openers later');
{
  const E = makeEnv({ now: '2026-11-23T09:00:00+01:00' }); // Monday
  E.ctx.setup(); E.set('HOLD_MINUTES', '0'); E.set('GAP_MINUTES', '1'); E.set('BATCH_SIZE', '50');
  E.dropFile('b.json', {
    leads: [{ key: 'o', company: 'Open Co', email: 'a@openco.co.uk', city: 'London', tier: 'A', website: 'openco.co.uk' },
            { key: 'n', company: 'Nope Co', email: 'b@nopeco.co.uk', city: 'London', tier: 'A', website: 'nopeco.co.uk' }],
    messages: [{ lead_key: 'o', step: 0, subject: 'one', body: 'Hi' }, { lead_key: 'o', step: 1, delay_days: 4, body: 'fu o' },
               { lead_key: 'n', step: 0, subject: 'two', body: 'Hi' }, { lead_key: 'n', step: 1, delay_days: 4, body: 'fu n' }] });
  for (let mins = 9 * 60 + 5; mins <= 11 * 60; mins += 5) { E.setNow(`2026-11-23T${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}:00+01:00`); E.ctx.tick(); }
  ok(E.sent.length === 2, 'both first emails sent');
  const oMsg = E.rows('Messages').find(m => m.step == '0' && /openco/.test(m.to));
  E.setFetchReply((url) => ({ code: /\/api\/e\/opened\?t=\d+&s=[0-9a-f]{20}$/.test(url) ? 200 : 403, body: { ids: ['lh-' + oMsg.id] } }));
  const day = (d) => { for (let mins = 9 * 60; mins <= 11 * 60; mins += 5) { E.setNow(`${d}T${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}:00+01:00`); E.ctx.tick(); } };
  day('2026-11-27');
  const fuO = E.sent.filter(x => /a@openco/.test(x.raw) && /In-Reply-To/.test(x.raw)).length, fuN = E.sent.filter(x => /b@nopeco/.test(x.raw) && /In-Reply-To/.test(x.raw)).length;
  ok(fuO === 1 && fuN === 0, 'on day 4 only the person who opened gets the follow-up (' + fuO + '/' + fuN + ')');
  ok(E.fetches.length >= 1 && E.fetches.every(u => u.startsWith('https://www.ferrnagency.com/api/e/opened?')), 'opens come from the Ferrn site, signed');
  day('2026-11-30'); day('2026-12-01');
  ok(E.sent.filter(x => /b@nopeco/.test(x.raw) && /In-Reply-To/.test(x.raw)).length === 1, 'the non-opener gets it three days later');
  // site unreachable: normal schedule for everyone
  const E2 = makeEnv({ now: '2026-11-23T09:00:00+01:00' });
  E2.ctx.setup(); E2.set('HOLD_MINUTES', '0'); E2.set('GAP_MINUTES', '1');
  E2.dropFile('b.json', { leads: [{ key: 'n', company: 'Nope Co', email: 'b@nopeco.co.uk', city: 'London', tier: 'A', website: 'nopeco.co.uk' }],
    messages: [{ lead_key: 'n', step: 0, subject: 'two', body: 'Hi' }, { lead_key: 'n', step: 1, delay_days: 4, body: 'fu n' }] });
  for (let mins = 9 * 60 + 5; mins <= 10 * 60; mins += 5) { E2.setNow(`2026-11-23T${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}:00+01:00`); E2.ctx.tick(); }
  for (let mins = 9 * 60; mins <= 11 * 60; mins += 5) { E2.setNow(`2026-11-27T${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}:00+01:00`); E2.ctx.tick(); }
  ok(E2.sent.length === 2, 'if opens cannot be read, follow-ups keep their normal schedule');
}

console.log('17. reply checks stay inside the Gmail read quota');
{
  const E = makeEnv({ now: '2026-11-19T09:00:00+01:00' });
  E.ctx.setup();
  delete E.props.REPLY_EVERY_MIN;
  E.dropFile('q.json', { leads: [{ key: 'q', company: 'Quota Co', tier: 'B', city: 'Lagos', email: 'hi@quota.ng', website: 'quota.ng' }], messages: [] });
  for (let mins = 9 * 60; mins < 10 * 60; mins += 5) { E.setNow(`2026-11-19T${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}:00+01:00`); E.ctx.tick(); }
  ok(E.gmailQueries.length === 4, 'one inbox search every 15 minutes, not every tick (' + E.gmailQueries.length + ' in an hour)');
  ok(/^newer_than:2d/.test(E.gmailQueries[0]) && /^after:\d+ /.test(E.gmailQueries[1]), 'later searches only look at mail since the last check');
  ok(E.gmailQueries.every(q => /-category:promotions/.test(q) && /-category:social/.test(q)), 'newsletters and social mail are skipped');
}

console.log('18. Studio cold-call list: never emailed, never re-added');
{
  const E = makeEnv({ now: '2026-11-19T09:00:00+01:00' });
  E.ctx.setup();
  E.ctx.dashAction('doNotEmail', { items: [{ company: 'Spry Nigeria Limited', email: 'wandea@spry.com.ng', phone: '+234 909 936 9377', domain: 'spry.com.ng' }, { company: 'Dayplus Limited', phone: '0802 072 2022' }] });
  E.dropFile('cc.json', { leads: [
    { key: 's', company: 'Spry Nigeria Limited', email: 'info@spry.com.ng', city: 'Lagos', tier: 'B' },
    { key: 'd', company: 'Dayplus Limited', email: 'hello@dayplus.ng', city: 'Lagos', tier: 'B' },
    { key: 'w', company: 'Wandea Freight', email: 'wandea@spry.com.ng', city: 'Lagos', tier: 'B' },
    { key: 'ok', company: 'Fresh Co', email: 'hi@fresh.ng', city: 'Lagos', tier: 'B' }],
    messages: [{ lead_key: 's', step: 0, subject: 'x', body: 'Hi' }, { lead_key: 'ok', step: 0, subject: 'x', body: 'Hi' }] });
  E.ctx.tick();
  const names = E.rows('Leads').map(l => l.company);
  ok(!names.includes('Spry Nigeria Limited') && !names.includes('Dayplus Limited') && !names.includes('Wandea Freight') && names.includes('Fresh Co'), 'cold-call companies (by name or email) are not added by the morning run');
  ok(!E.rows('Messages').some(m => /spry|dayplus/i.test(m.to || '')), 'and no email is queued for them');
  E.ctx.writeBrief_();
  const br = Object.values(E.docs).pop();
  ok(/Spry Nigeria Limited \| spry\.com\.ng \| wandea@spry\.com\.ng \| 2349099369377 \| - \| - \| Cold call \(do not email\)/.test(br) && /Dayplus Limited \|  \|  \| 08020722022/.test(br), 'the brief lists them under ALL LEADS for de-duplication');
}

console.log(`\nALL ${passed} CHECKS PASSED`);
