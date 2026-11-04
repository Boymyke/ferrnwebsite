import puppeteer from '@cloudflare/puppeteer';
import type { Bindings } from './env';
// Code passed to page.evaluate runs in the browser; these names exist there, not in the Worker.
declare const document: any, window: any;

/** Full-page capture of a live site with Cloudflare Browser Rendering, saved to R2 as WebP.
 *  Used for the home showreel (reel/<slug>.webp) and available for project covers. Viewport stays 1440×900
 *  while capturing beyond it, so "100vh" heroes keep their real size; reveal-on-scroll effects are forced on. */
export async function captureSite(env: Bindings, url: string, key: string, maxHeight = 5200) {
  if (!env.BROWSER) throw new Error('Browser Rendering is not bound (BROWSER).');
  const browser = await puppeteer.launch(env.BROWSER as any);
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 45_000 });
    await page.addStyleTag({ content: `*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition:none!important;scroll-behavior:auto!important}
      [data-aos],[data-aos][data-aos]{opacity:1!important;transform:none!important}.wow,.reveal,.fade-in,.fadeIn,.animate__animated{opacity:1!important;visibility:visible!important;transform:none!important}` });
    // Walk down the page so lazy images and scroll-triggered sections load, then come back to the top.
    await page.evaluate(async () => {
      const h = Math.min(document.documentElement.scrollHeight, 12000);
      for (let y = 0; y < h; y += 700) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 140)); }
      window.scrollTo(0, 0);
    });
    await new Promise((r) => setTimeout(r, 1200));
    const full = await page.evaluate(() => document.documentElement.scrollHeight);
    const height = Math.max(900, Math.min(full, maxHeight));
    const buf = (await page.screenshot({ type: 'webp', quality: 74, clip: { x: 0, y: 0, width: 1440, height }, captureBeyondViewport: true })) as Uint8Array;
    await env.MEDIA.put(key, buf, { httpMetadata: { contentType: 'image/webp', cacheControl: 'public, max-age=86400' }, customMetadata: { source: url } });
    return { key, url: `/media/${key}`, width: 1440, height, bytes: buf.byteLength };
  } finally {
    await browser.close().catch(() => {});
  }
}
