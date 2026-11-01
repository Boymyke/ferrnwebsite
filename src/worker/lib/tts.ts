import type { Bindings } from './env';

/**
 * Nigerian voice for the website assistant.
 *  - azure:      Microsoft neural voices en-NG-EzinneNeural (female) / en-NG-AbeoNeural (male)
 *  - elevenlabs: any ElevenLabs voice id (default: a Lagos-accented community voice)
 *  - browser:    no server audio; the widget uses speechSynthesis with an en-NG voice if present
 * Audio is cached in KV for 30 days keyed by provider + voice + text hash, so repeated
 * answers (greetings, FAQs) cost nothing.
 */
export async function synthesize(env: Bindings, text: string, lang = 'en'): Promise<Response | null> {
  const clean = text.replace(/\s+/g, ' ').trim().slice(0, 1200);
  if (!clean) return null;
  const provider = env.TTS_PROVIDER ?? 'azure';

  const keyBase = `${provider}:${provider === 'azure' ? env.AZURE_VOICE : env.ELEVENLABS_VOICE_ID}:${lang}:${clean}`;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(keyBase));
  const key = 'tts:' + [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 40);
  const cached = await env.CACHE.get(key, 'arrayBuffer');
  if (cached) return audio(cached);

  let buf: ArrayBuffer | null = null;
  if (provider === 'azure' && env.AZURE_SPEECH_KEY) {
    const region = env.AZURE_SPEECH_REGION || 'westeurope';
    const voice = pickAzureVoice(env.AZURE_VOICE || 'en-NG-EzinneNeural', lang);
    const ssml = `<speak version="1.0" xml:lang="${voice.slice(0, 5)}"><voice name="${voice}"><prosody rate="-4%">${escapeXml(clean)}</prosody></voice></speak>`;
    const r = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': env.AZURE_SPEECH_KEY,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
        'User-Agent': 'ferrn-platform',
      },
      body: ssml,
    });
    if (r.ok) buf = await r.arrayBuffer();
    else console.warn('Azure TTS', r.status, await r.text());
  } else if (provider === 'elevenlabs' && env.ELEVENLABS_API_KEY) {
    const voiceId = env.ELEVENLABS_VOICE_ID || 'U7wWSnxIJwCjioxt86mk';
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_64`, {
      method: 'POST',
      headers: { 'xi-api-key': env.ELEVENLABS_API_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ text: clean, model_id: 'eleven_multilingual_v2', voice_settings: { stability: 0.5, similarity_boost: 0.8 } }),
    });
    if (r.ok) buf = await r.arrayBuffer();
    else console.warn('ElevenLabs TTS', r.status, await r.text());
  }
  if (!buf) return null;
  await env.CACHE.put(key, buf, { expirationTtl: 60 * 60 * 24 * 30 });
  return audio(buf);
}

/** Non-English pages keep the Nigerian voice for yo/ig/ha (Azure has no yo/ig/ha voices) and
 *  switch to a native neural voice for fr/de/es/zh. */
function pickAzureVoice(defaultVoice: string, lang: string) {
  const map: Record<string, string> = {
    fr: 'fr-FR-DeniseNeural', de: 'de-DE-KatjaNeural', es: 'es-ES-ElviraNeural', zh: 'zh-CN-XiaoxiaoNeural',
  };
  return map[lang] ?? defaultVoice;
}

const escapeXml = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]!));
const audio = (b: ArrayBuffer) => new Response(b, { headers: { 'content-type': 'audio/mpeg', 'cache-control': 'public, max-age=86400' } });
