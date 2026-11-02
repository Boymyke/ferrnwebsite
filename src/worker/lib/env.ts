export type Bindings = {
  DB: D1Database;
  CACHE: KVNamespace;
  MEDIA: R2Bucket;
  ASSETS: Fetcher;
  AI?: Ai;

  SITE_URL: string;
  SITE_NAME: string;
  CONTACT_EMAIL: string;
  BOOKING_URL: string;
  WHATSAPP_NUMBER?: string;
  OPENAI_MODEL?: string;
  WORKERS_AI_MODEL?: string;
  TTS_PROVIDER?: 'azure' | 'elevenlabs' | 'browser';
  AZURE_SPEECH_REGION?: string;
  AZURE_VOICE?: string;
  ELEVENLABS_VOICE_ID?: string;
  ENGINE_URL?: string;

  // secrets
  OPENAI_API_KEY?: string;
  AZURE_SPEECH_KEY?: string;
  ELEVENLABS_API_KEY?: string;
  ENGINE_KEY?: string;
  PAYSTACK_SECRET_KEY?: string;
  PAYSTACK_PUBLIC_KEY?: string;
  RESEND_API_KEY?: string;
  GOOGLE_MAPS_API_KEY?: string;
  BOOTSTRAP_SECRET?: string;
  // WhatsApp Cloud API (Meta)
  WHATSAPP_TOKEN?: string;
  WHATSAPP_PHONE_NUMBER_ID?: string;
  WHATSAPP_VERIFY_TOKEN?: string;
  WHATSAPP_APP_SECRET?: string;
  WHATSAPP_TEMPLATE_LANG?: string;
  // Social auto-posting and results (docs/SOCIAL.md)
  SOCIAL_ENC_KEY?: string;          // secret: encrypts OAuth tokens at rest (AES-GCM, HKDF-SHA-256)
  X_API_KEY?: string;               // secret: X app consumer key (OAuth 1.0a)
  X_API_SECRET?: string;            // secret
  X_ACCESS_TOKEN?: string;          // secret: access token for the @ferrn account (Read and write)
  X_ACCESS_SECRET?: string;         // secret
  X_MAX_CHARS?: string;             // var: 280 by default; raise for X Premium long posts
  IG_USER_ID?: string;              // secret/var: Instagram professional account ID
  META_ACCESS_TOKEN?: string;       // secret: long-lived Page/User token (or connect in Studio instead)
  META_APP_ID?: string;             // var: only for the in-Studio "Connect Instagram" flow
  META_APP_SECRET?: string;         // secret: only for the in-Studio "Connect Instagram" flow
  META_GRAPH_VERSION?: string;      // var: default v25.0
  TIKTOK_CLIENT_KEY?: string;       // secret
  TIKTOK_CLIENT_SECRET?: string;    // secret
  TIKTOK_AUDITED?: string;          // var: '1' once TikTok has audited the app (public posts allowed)
  SOCIAL_MEDIA_BASE?: string;       // var: public base URL for /media (defaults to SITE_URL)
  SOCIAL_FAKE_API?: string;         // dev only: '1' answers every platform call with stubs (never set in production)
};

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: 'owner' | 'admin' | 'editor' | 'sales' | 'viewer';
  title: string | null;
};

export type AppEnv = {
  Bindings: Bindings;
  Variables: {
    user: SessionUser | null;
    lang: import('../content/i18n').Lang;
    nonce: string;
  };
};
