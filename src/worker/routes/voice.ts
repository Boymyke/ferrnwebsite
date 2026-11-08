/**
 * Real client voice notes for testimonials.
 *  - Studio makes a private link per testimonial (POST /api/studio/voice/:id/link → /voice/<token>, valid 30 days).
 *  - The client opens it on their phone, records (or picks a file), and it attaches to their testimonial in R2,
 *    with a transcript from Workers AI Whisper. Nothing is synthetic: only what the client recorded is played.
 *  - Studio can also (re)transcribe an uploaded voice note: POST /api/studio/voice/:id/transcribe.
 * Tokens live in KV (voice:<token> → testimonial id), so no schema change was needed.
 */
import { Hono } from 'hono';
import type { AppEnv, Bindings } from '../lib/env';
import { first, run } from '../lib/db';
import { requireUser } from '../lib/auth';
import { audit } from '../lib/audit';
import { bumpContentVersion } from '../lib/cache';

type T = { id: string; name: string; company: string | null; quote: string; audio: string | null; transcript: string | null };

/** Whisper transcription of an R2 object; returns '' when it can't. */
export async function transcribe(env: Bindings, key: string): Promise<string> {
  if (!env.AI) return '';
  const obj = await env.MEDIA.get(key);
  if (!obj) return '';
  const buf = new Uint8Array(await obj.arrayBuffer());
  try {
    let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    const r: any = await (env.AI as any).run('@cf/openai/whisper-large-v3-turbo', { audio: btoa(bin), language: 'en' });
    if (r?.text) return String(r.text).trim();
  } catch (e) { console.warn('whisper turbo', e); }
  try {
    const r: any = await (env.AI as any).run('@cf/openai/whisper', { audio: [...buf] });
    return String(r?.text || '').trim();
  } catch (e) { console.warn('whisper', e); return ''; }
}

/* ── Studio side ── */
export const voiceApi = new Hono<AppEnv>();
voiceApi.use('*', requireUser('sales'));
voiceApi.post('/:id/link', async (c) => {
  const t = await first<T>(c.env.DB, 'SELECT id, name FROM testimonials WHERE id = ?', c.req.param('id'));
  if (!t) return c.json({ ok: false, error: 'Unknown testimonial' }, 404);
  const token = [...crypto.getRandomValues(new Uint8Array(12))].map((b) => b.toString(36).padStart(2, '0')).join('').slice(0, 20);
  await c.env.CACHE.put(`voice:${token}`, t.id, { expirationTtl: 60 * 60 * 24 * 30 });
  await audit(c, 'testimonials', t.id, 'voice-link', `${c.get('user')!.name} made a voice-note link for ${t.name}`);
  return c.json({ ok: true, url: `${c.env.SITE_URL || 'https://www.ferrnagency.com'}/voice/${token}` });
});
voiceApi.post('/:id/transcribe', async (c) => {
  const t = await first<T>(c.env.DB, 'SELECT id, audio FROM testimonials WHERE id = ?', c.req.param('id'));
  if (!t?.audio) return c.json({ ok: false, error: 'Upload the voice note first' }, 400);
  const key = t.audio.replace(/^\/?media\//, '');
  const text = await transcribe(c.env, key);
  if (!text) return c.json({ ok: false, error: 'Could not transcribe this recording' }, 502);
  await run(c.env.DB, "UPDATE testimonials SET transcript = ?, updated_at = datetime('now') WHERE id = ?", text, t.id);
  await bumpContentVersion(c.env);
  return c.json({ ok: true, transcript: text });
});

/* ── public: the client's recording page ── */
export const voicePage = new Hono<AppEnv>();
const page = (title: string, body: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>${title} · Ferrn</title><link rel="icon" href="/icons/favicon-32.png"><link rel="stylesheet" href="/assets/fonts.css">
<style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b0c10;color:#f4f3f0;font-family:Poppins,system-ui,sans-serif;padding:24px}
.c{width:min(460px,100%);background:#15161a;border:1px solid rgba(255,255,255,.09);border-radius:8px;padding:28px}h1{font-size:26px;line-height:1.15;letter-spacing:-.03em;margin:14px 0 8px;font-weight:600}
p{color:rgba(244,243,240,.7);line-height:1.55;margin:0 0 14px;font-size:15px}.q{border-left:3px solid #F94406;padding:4px 0 4px 12px;color:#f4f3f0;font-size:14px}
.mark{width:34px;height:34px}.rec{width:100%;height:58px;border:0;border-radius:8px;background:#F94406;color:#fff;font:600 16px Poppins,sans-serif;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px}
.rec.on{background:#fff;color:#0b0c10}.dot{width:12px;height:12px;border-radius:50%;background:currentColor}.rec.on .dot{background:#F94406;animation:b 1s infinite}@keyframes b{50%{opacity:.3}}
.ghost{background:transparent;border:1px solid rgba(255,255,255,.18);color:#f4f3f0;height:46px;border-radius:8px;font:500 14px Poppins,sans-serif;cursor:pointer;width:100%;margin-top:10px}
audio{width:100%;margin:14px 0 4px}.t{font-variant-numeric:tabular-nums;color:rgba(244,243,240,.6);font-size:13px;text-align:center;margin-top:10px}.ok{color:#22c55e}.err{color:#ff7a5c}.hide{display:none}
label.f{display:block;text-align:center;margin-top:12px;font-size:13px;color:rgba(244,243,240,.6);text-decoration:underline;cursor:pointer}</style></head><body><main class="c">
<svg class="mark" viewBox="0 0 164 164" aria-label="Ferrn"><path d="M163.419 0V163.419H0V109.064H107.208V52.9022H17.0028V0H163.419Z" fill="#F94406"/></svg>${body}</main></body></html>`;

voicePage.get('/voice/:token', async (c) => {
  const id = await c.env.CACHE.get(`voice:${c.req.param('token')}`);
  const t = id ? await first<T>(c.env.DB, 'SELECT id, name, company, quote FROM testimonials WHERE id = ?', id) : null;
  if (!t) return c.html(page('Link expired', '<h1>This link has expired</h1><p>Ask the Ferrn team for a new one. Thank you!</p>'), 404);
  const first_ = (t.name || '').split(' ')[0];
  const esc = (s: string) => s.replace(/[&<>"]/g, (x) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[x]!));
  return c.html(page('Record your voice note', `
<h1>Hi ${esc(first_)}, could you say it in your own voice?</h1>
<p>Press record and tell people, in about 20 to 40 seconds, what working with Ferrn was like. Your voice note goes on our website next to your name, with a written transcript.</p>
<p class="q">You wrote: “${esc(t.quote.slice(0, 220))}${t.quote.length > 220 ? '…' : ''}”</p>
<button class="rec" id="rec" type="button"><span class="dot"></span><span id="rl">Start recording</span></button>
<div class="t" id="time">Up to 90 seconds</div>
<label class="f">or upload a voice note from your phone<input id="file" type="file" accept="audio/*" hidden></label>
<audio id="play" class="hide" controls></audio>
<button class="rec hide" id="send" type="button">Send my voice note</button>
<button class="ghost hide" id="again" type="button">Record again</button>
<p class="t" id="msg"></p>
<script>
(function(){var rec=document.getElementById('rec'),rl=document.getElementById('rl'),time=document.getElementById('time'),play=document.getElementById('play'),send=document.getElementById('send'),again=document.getElementById('again'),msg=document.getElementById('msg'),file=document.getElementById('file');
var mr=null,chunks=[],blob=null,t0=0,tick=0;
function show(b){blob=b;play.src=URL.createObjectURL(b);play.classList.remove('hide');send.classList.remove('hide');again.classList.remove('hide');rec.classList.add('hide');time.textContent='Listen back, then send it.'}
function stop(){if(mr&&mr.state!=='inactive')mr.stop();clearInterval(tick);rec.classList.remove('on');rl.textContent='Start recording'}
rec.onclick=async function(){if(mr&&mr.state==='recording'){stop();return}
 try{var s=await navigator.mediaDevices.getUserMedia({audio:true})}catch(e){msg.className='t err';msg.textContent='Please allow the microphone, or upload a voice note instead.';return}
 var type=['audio/mp4','audio/webm;codecs=opus','audio/webm'].find(function(x){return window.MediaRecorder&&MediaRecorder.isTypeSupported(x)})||'';
 mr=new MediaRecorder(s,type?{mimeType:type}:undefined);chunks=[];mr.ondataavailable=function(e){if(e.data.size)chunks.push(e.data)};
 mr.onstop=function(){s.getTracks().forEach(function(x){x.stop()});show(new Blob(chunks,{type:mr.mimeType||'audio/webm'}))};
 mr.start();t0=Date.now();rec.classList.add('on');rl.textContent='Stop';msg.textContent='';
 tick=setInterval(function(){var d=Math.floor((Date.now()-t0)/1000);time.textContent='Recording 0:'+String(d).padStart(2,'0');if(d>=90)stop()},250)};
file.onchange=function(){if(file.files[0])show(file.files[0])};
again.onclick=function(){blob=null;play.classList.add('hide');send.classList.add('hide');again.classList.add('hide');rec.classList.remove('hide');time.textContent='Up to 90 seconds';msg.textContent=''};
send.onclick=async function(){if(!blob)return;send.disabled=true;send.textContent='Sending…';
 try{var r=await fetch(location.pathname,{method:'POST',headers:{'content-type':blob.type||'audio/webm'},body:blob});var j=await r.json();if(!j.ok)throw new Error(j.error||'Upload failed');
 document.querySelector('main').innerHTML='<svg class="mark" viewBox="0 0 164 164"><path d="M163.419 0V163.419H0V109.064H107.208V52.9022H17.0028V0H163.419Z" fill="#F94406"/></svg><h1>Thank you, it is saved.</h1><p>The Ferrn team will add it to the website. You can close this page.</p>'}
 catch(e){msg.className='t err';msg.textContent=e.message;send.disabled=false;send.textContent='Send my voice note'}};
})();
</script>`), 200, { 'cache-control': 'private, no-store', 'x-robots-tag': 'noindex' });
});

voicePage.post('/voice/:token', async (c) => {
  const id = await c.env.CACHE.get(`voice:${c.req.param('token')}`);
  const t = id ? await first<T>(c.env.DB, 'SELECT id, name FROM testimonials WHERE id = ?', id) : null;
  if (!t) return c.json({ ok: false, error: 'This link has expired' }, 404);
  const type = (c.req.header('content-type') || 'audio/webm').split(';')[0].trim();
  if (!/^audio\/|^video\/(webm|mp4)$/.test(type)) return c.json({ ok: false, error: 'That is not an audio file' }, 415);
  const buf = await c.req.arrayBuffer();
  if (buf.byteLength < 2000) return c.json({ ok: false, error: 'The recording is empty. Please try again.' }, 400);
  if (buf.byteLength > 20 * 1024 * 1024) return c.json({ ok: false, error: 'Please keep it under 20 MB' }, 413);
  const ext = /mp4|m4a|aac/.test(type) ? 'm4a' : /mpeg|mp3/.test(type) ? 'mp3' : /wav/.test(type) ? 'wav' : /ogg/.test(type) ? 'ogg' : 'webm';
  const key = `voices/${new Date().toISOString().slice(0, 7)}/${t.id}-${Date.now().toString(36)}.${ext}`;
  await c.env.MEDIA.put(key, buf, { httpMetadata: { contentType: type.replace(/^video\//, 'audio/'), cacheControl: 'public, max-age=31536000, immutable' }, customMetadata: { by: 'client', testimonial: t.id } });
  const text = await transcribe(c.env, key);
  await run(c.env.DB, "UPDATE testimonials SET audio = ?, transcript = COALESCE(NULLIF(?, ''), transcript), updated_by = ?, updated_at = datetime('now') WHERE id = ?", key, text, `${t.name} (voice link)`, t.id);
  await bumpContentVersion(c.env);
  return c.json({ ok: true });
});
