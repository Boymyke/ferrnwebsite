import type { Bindings } from './env';

/** Paystack: NGN (cards, bank transfer, USSD) and international cards. Amounts in minor units. */
export async function initTransaction(env: Bindings, p: {
  email: string; amount: number; currency: 'NGN' | 'USD'; reference: string; callback_url: string; metadata?: unknown;
}) {
  if (!env.PAYSTACK_SECRET_KEY) throw new Error('Payments are not switched on yet.');
  const r = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify(p),
  });
  const data = (await r.json()) as any;
  if (!data.status) throw new Error(data.message || 'Paystack error');
  return data.data as { authorization_url: string; access_code: string; reference: string };
}

export async function verifyTransaction(env: Bindings, reference: string) {
  const r = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}` },
  });
  const data = (await r.json()) as any;
  return data?.data as { status: string; amount: number; currency: string; reference: string } | undefined;
}

/** Webhook signature: HMAC-SHA512 of the raw body with the secret key. */
export async function validSignature(env: Bindings, raw: string, signature: string | undefined) {
  if (!signature || !env.PAYSTACK_SECRET_KEY) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.PAYSTACK_SECRET_KEY), { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw));
  const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return hex === signature;
}
