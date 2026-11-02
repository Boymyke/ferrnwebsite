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
