#!/usr/bin/env node
/**
 * End-to-end check of auto-posting + results collection against a LOCAL `wrangler dev` started with
 * SOCIAL_FAKE_API=1 (every X / Meta / TikTok call is answered by stubs) and `--test-scheduled`.
 *
 *   node scripts/social-selftest.mjs http://127.0.0.1:8790 michael@ferrnagency.com 'TestPass12345'
 *
 * It connects TikTok + Instagram through the OAuth callback, uploads media to R2, creates due posts,
 * fires the cron twice and asserts: due posts are published with post_url/external_id, Instagram
 * without media is parked as needs_media, an over-long X thread fails cleanly, nothing is posted
 * twice, and the collector writes post_metrics + social_accounts_daily snapshots.
 */
const [base = 'http://127.0.0.1:8790', email = 'michael@ferrnagency.com', password = 'TestPass12345'] = process.argv.slice(2);
let cookie = '';
const req = async (path, { method = 'GET', body, headers = {}, raw, redirect = 'follow' } = {}) => {
  const res = await fetch(base + path, {
    method, redirect,
    headers: { origin: base, cookie, ...(body && !raw ? { 'content-type': 'application/json' } : {}), ...headers },
    body: raw ?? (body ? JSON.stringify(body) : undefined),
  });
  const sc = res.headers.getSetCookie?.() ?? [];
  if (sc.length) cookie = sc.map((c) => c.split(';')[0]).join('; ');
  return res;
};
const j = async (path, opts) => { const r = await req(path, opts); const d = await r.json().catch(() => ({})); return { status: r.status, ...d }; };
let fails = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const iso = (ms) => new Date(Date.now() + ms).toISOString();

const login = await j('/api/auth/login', { method: 'POST', body: { email, password } });
check(login.ok, 'logged in');

const conns = await j('/api/studio/social/connections');
check(conns.fake === true, 'server runs with SOCIAL_FAKE_API=1 (stubbed platform APIs)');

for (const p of ['tiktok', 'instagram']) {
  let r = await req(`/api/studio/social/connect/${p}`, { redirect: 'manual' });
  const loc = r.headers.get('location') ?? '';
  r = await req(new URL(loc, base).pathname + new URL(loc, base).search, { redirect: 'manual' });
  const back = decodeURIComponent(r.headers.get('location') ?? '');
  check(back.includes('social=connected'), `${p} OAuth callback stores an encrypted token (${back.split('msg=')[1] ?? back})`);
}
const conns2 = await j('/api/studio/social/connections');
check(conns2.rows.every((c) => c.connected), 'X, Instagram and TikTok all report connected');

const jpeg = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==', 'base64');
const img = await j(`/api/studio/social/media?name=test.jpg&type=image/jpeg`, { method: 'PUT', raw: jpeg, headers: { 'content-type': 'image/jpeg' } });
check(img.ok && img.url?.startsWith('/media/social/'), `image streamed to R2 (${img.url})`);
const vid = await j(`/api/studio/social/media?name=clip.mp4&type=video/mp4`, { method: 'PUT', raw: Buffer.alloc(300_000, 1), headers: { 'content-type': 'video/mp4' } });
check(vid.ok && vid.type === 'video', `video streamed to R2 (${vid.url})`);

const mk = async (p) => (await j('/api/studio/r/content', { method: 'POST', body: { status: 'approved', autopost: 1, scheduled_at: iso(-5 * 60_000), ...p } })).row;
const posts = {
  xThread: await mk({ platform: 'x', title: 'Selftest thread', body: '1/ First post of the thread\n2/ Second post\n3/ Third post', hashtags: '#selftest', media_json: JSON.stringify([{ url: img.url, type: 'image' }]) }),
  igImage: await mk({ platform: 'instagram', title: 'Selftest IG', body: 'Slide 1: hello\nCaption: Selftest caption', hashtags: '#ferrn', media_json: JSON.stringify([{ url: img.url, type: 'image' }]) }),
  igCarousel: await mk({ platform: 'instagram', title: 'Selftest carousel', body: 'Caption: three', media_json: JSON.stringify([{ url: img.url, type: 'image' }, { url: img.url, type: 'image' }, { url: vid.url, type: 'video' }]) }),
  igNoMedia: await mk({ platform: 'instagram', title: 'Selftest IG no media', body: 'Caption: nothing attached' }),
  tiktok: await mk({ platform: 'tiktok', title: 'Selftest TikTok', body: 'HOOK: hi\nCaption: TikTok selftest', media_json: JSON.stringify([{ url: vid.url, type: 'video' }]) }),
  xTooLong: await mk({ platform: 'x', title: 'Selftest too long', body: 'x'.repeat(320) }),
  future: await mk({ platform: 'x', title: 'Selftest future', body: 'later', scheduled_at: iso(3 * 3600_000) }),
  draft: await mk({ platform: 'x', title: 'Selftest draft', body: 'draft', status: 'draft' }),
  noAuto: await mk({ platform: 'x', title: 'Selftest autopost off', body: 'off', autopost: 0 }),
};

const fire = async () => { await req('/__scheduled?cron=*%2F10+*+*+*+*'); await sleep(4000); };
await fire();
const get = async (p) => (await j(`/api/studio/r/content/${p.id}`)).row;
const after = Object.fromEntries(await Promise.all(Object.entries(posts).map(async ([k, p]) => [k, await get(p)])));
for (const k of ['xThread', 'igImage', 'igCarousel', 'tiktok']) {
  const r = after[k];
  check(r.status === 'posted' && r.publish_state === 'posted' && r.post_url && r.external_id && r.posted_at, `${k}: posted → ${r.post_url} (state ${r.publish_state}, ${r.last_error ?? 'ok'})`);
}
check(JSON.parse(after.xThread.publish_ref).tweet_ids.length === 3, 'X thread was posted as a 3-post reply chain');
check(after.igNoMedia.publish_state === 'needs_media' && after.igNoMedia.status === 'approved', `Instagram without media parked as needs_media: “${after.igNoMedia.last_error}”`);
check(after.xTooLong.status === 'failed' && /characters/.test(after.xTooLong.last_error ?? ''), `over-long X post failed cleanly: “${after.xTooLong.last_error}”`);
for (const k of ['future', 'draft', 'noAuto']) check(!after[k].external_id && !after[k].publish_state, `${k}: not touched`);

const log1 = (await j('/api/studio/social/dev/fake-log')).calls;
const tweets1 = log1.filter((c) => c.method === 'POST' && c.url === 'api.x.com/2/tweets').length;
const snaps1 = await j('/api/studio/social/posts/' + posts.igImage.id + '/metrics');
check(snaps1.rows.length === 1 && snaps1.rows[0].reach > 0, `collector wrote a post_metrics snapshot (IG reach ${snaps1.rows[0]?.reach}, views ${snaps1.rows[0]?.views})`);
const xs = await j('/api/studio/social/posts/' + posts.xThread.id + '/metrics');
check(xs.rows.length === 1 && xs.rows[0].impressions > 0, `X public_metrics collected (impressions ${xs.rows[0]?.impressions})`);
const igRow = await get(posts.igImage);
check(JSON.parse(igRow.metrics_json).engagement_rate >= 0 && igRow.metrics_at, 'content_posts.metrics_json + metrics_at updated');

await fire(); // second tick: nothing new to post, metrics not due again for 6 h
const log2 = (await j('/api/studio/social/dev/fake-log')).calls;
check(log2.filter((c) => c.method === 'POST' && c.url === 'api.x.com/2/tweets').length === tweets1, 'second cron run posts nothing twice');
check((await j('/api/studio/social/posts/' + posts.igImage.id + '/metrics')).rows.length === 1, 'metrics not re-collected before the 6-hour window');
const again = await j(`/api/studio/social/posts/${posts.xThread.id}/publish`, { method: 'POST', body: {} });
check(again.status === 409, '“Post now” on a live post is refused (409)');

const dash = await j('/api/studio/social/dashboard?days=30');
check(dash.ok && dash.kpis.current.posts >= 4, `dashboard: ${dash.kpis.current.posts} posts, ${dash.kpis.current.impressions} impressions, followers ${dash.kpis.current.followers}`);
check(Object.keys(dash.followers).length === 3, 'social_accounts_daily has a follower snapshot for all 3 platforms');

// clean up the selftest rows
for (const p of Object.values(posts)) await j(`/api/studio/r/content/${p.id}`, { method: 'DELETE' });
console.log(fails ? `\n${fails} check(s) failed` : '\nAll checks passed');
process.exit(fails ? 1 : 0);
