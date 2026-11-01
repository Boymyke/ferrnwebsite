import type { Context } from 'hono';
import type { AppEnv } from '../lib/env';

import { ASSET_V as V } from '../version';

/** HTML shell for the Ferrn Studio React app. The app itself handles sign-in,
 *  so this page is the same for everyone and contains no data. */
export function studioShell(c: Context<AppEnv>) {
  c.header('cache-control', 'no-store');
  c.header('x-robots-tag', 'noindex, nofollow');
  return c.html(`<!doctype html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
<title>Ferrn Studio</title>
<meta name="robots" content="noindex,nofollow" />
<meta name="theme-color" content="#0b0b0b" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-title" content="Ferrn Studio" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<link rel="manifest" href="/studio.webmanifest" />
<link rel="icon" href="/icons/appicon.svg" type="image/svg+xml" />
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
<link rel="stylesheet" href="/fonts/fonts.css" />
<link rel="stylesheet" href="/studio/studio.css?v=${V}" />
<script>try{var t=localStorage.getItem('ferrn-studio-theme');if(t)document.documentElement.dataset.theme=t}catch(e){}</script>
</head>
<body>
<div id="root"><div class="boot"><img src="/brand/ferrn-mark.svg" width="56" height="56" alt="" /><p>Loading Ferrn Studio…</p></div></div>
<script src="/studio/app.js?v=${V}" defer></script>
<script>if('serviceWorker' in navigator){addEventListener('load',function(){navigator.serviceWorker.register('/studio-sw.js',{scope:'/studio'}).catch(function(){})})}</script>
</body>
</html>`);
}
