# Ferrn — website, marketplace and Studio

One Cloudflare Worker serves everything Ferrn runs:

| Path | What it is |
|---|---|
| `/` (and `/yo` `/ig` `/ha` `/fr` `/de` `/es` `/zh`) | The public website in 8 languages: work, services, marketplace, team, insights, contact |
| `/marketplace` | Ready-built websites, web apps, AI assistants and automations, each with a live demo and Paystack checkout |
| `/demos/*` | The interactive demos (fictional businesses) |
| `/studio` | **Ferrn Studio**: the installable back office for leads, outreach, meetings, quotes, content, ads, marketplace and team |
| `/q/:key` | Client-facing quote pages with "Accept quote" |
| `/api/*` | Forms, chat assistant, voice, checkout, Studio API |

This replaces the PHP site (which stays on the `main` branch and on Namecheap cPanel until the cut-over is done) and merges the LeadsHunter dashboard into Studio. LeadsHunter's Google Apps Script engine keeps sending email from Gmail; Studio talks to it.

## Stack

- **Cloudflare Workers** + **Hono** (server-rendered JSX) — one deploy, global edge.
- **D1** (SQLite) for data, **KV** for caching/rate limits/translations/voice audio, **R2** for uploads.
- **Workers AI** for translation (m2m100) and a fallback chat model; **OpenAI** for the main assistant and content drafting.
- **Studio** is a React 19 SPA bundled with esbuild, with a service worker so it installs as an app.
- Caching: public pages are edge-cached and purged automatically whenever someone edits content in Studio; static assets are cached by version; fonts are self-hosted and immutable.

## Commands

```bash
npm install
npm run build            # browser bundles (site.js, studio/app.js)
npm run typecheck        # worker + site + studio
npm run dev              # local server on :8787 (see docs/SETUP.md for local D1)
npm run deploy           # build + wrangler deploy (normally done by Workers Builds)
```

## Docs

- [docs/SETUP.md](docs/SETUP.md): first deploy, secrets, creating the owner account, inviting the co-founder, connecting LeadsHunter, Paystack, Google Maps, voices.
- [docs/MIGRATION.md](docs/MIGRATION.md): moving ferrnagency.com from Namecheap to Cloudflare without breaking email.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): how the pieces fit, with a diagram.
- [docs/WEBSITE.md](docs/WEBSITE.md): the v4 site — design system, Bob (grounding, reading aloud, voice), idle and seasonal modes, Studio website modules, deploy and rollback.
- [docs/I18N.md](docs/I18N.md): how the 8 languages work and what still needs a native speaker.
- [docs/CONTENT.md](docs/CONTENT.md): the content workflow for X, Instagram and TikTok.
- [docs/WHATSAPP.md](docs/WHATSAPP.md): the WhatsApp bot and how to connect it.
