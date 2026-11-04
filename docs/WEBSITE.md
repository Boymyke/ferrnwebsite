# Website v4 — experience, Bob and Studio control

The public site was rebuilt on the same Worker, routes and backend (no URLs changed, every
form, checkout, language and policy page still works). This page says what changed, how to
run it, what the Studio can now control, and how to roll back.

## What's new on the site

| Area | What it does | Where it's controlled |
|---|---|---|
| Design system | Poppins only, **0px radius**, hairline rules, numbered section openers, orange (#FF4100) on one action per view, film grain, light/dark | `public/assets/site.css` |
| Motion | Line-by-line hero reveal with a gradient sweep, masked text wipes, pointer-lit hero, parallax covers, sticky stacked service cards, cross-document view transitions, nav hides on scroll down. All honour `prefers-reduced-motion`. | `src/client/site/main.ts` |
| Pages | Home, Work (filters) and case studies (`/work/<slug>`), Services (sticky chapters), Marketplace + product (unchanged checkout), About + Team, **Company profile** (`/profile`, `/profile.pdf`), **Important links** (`/links`), Insights, Contact, Policies | `src/worker/views/*.tsx`, `src/worker/routes/site.tsx` |
| Footer | CTA block, four columns, big wordmark, cookie prefs and a single language link (the EN/YO/IG/HA/… row is gone; the routes are untouched and live in the menu) | `layout.tsx → Footer` |
| Bob | Blob assistant (idle / listening / thinking / speaking), text + voice, **reads the page aloud with synchronised highlighting** (pause, restart, stop, speed), takes visitors to pages, cites the public pages it used | `src/client/site/bob.ts`, `src/worker/lib/bob.ts`, `POST /api/chat` |
| Idle storytelling | After N seconds without input, full-screen story lines; any input dismisses; "Don't show again" remembered | Studio → Website copy → Idle mode |
| Seasonal themes | Greeting in the hero, optional banner, light effect (snow, confetti, hearts, sparkle), between two dates | Studio → Seasonal themes |
| Voice testimonials | Optional audio + transcript on a testimonial → player with bars and transcript | Studio → Testimonials |
| SEO | `/sitemap.xml` includes projects, products, posts, profile and links; JSON-LD unchanged; `noindex` on 404 / order pages | `routes/site.tsx → sitemap()` |

## Studio additions

- **Projects** — every engagement (status, lead, team, dates, budget / costs / received, links). Budgets and team never reach the site. Tick *Show on the website* to publish the case-study fields; *Featured* puts it on the home page. **Import from sheet** reads the portfolio Google Sheet (or pasted CSV), matches by name, never duplicates and only fills blanks. **Capture live site** stores a real screenshot in R2 as the cover. The **calculator** suggests a price from pages / screens / integrations / design level and can set the budget.
- **Website copy** — every headline, line and label, grouped by page, with history and one-click restore. Empty = built-in default, so nothing can be "lost".
- **Bob** — overview (conversations, ratings, what Bob did, most asked, couldn't-answer list), knowledge (test what Bob sees for a question; hide any page from Bob), conversations, settings (on/off, voice policy, read-aloud button).
- **FAQs**, **Important links**, **Company profile** sections, **Seasonal themes** (admins).
- **Testimonials** gained company, logo, audio, transcript and featured.

## Bob, in detail

- Grounding: `page_index` (public pages, projects, products, posts, FAQs, policies, approved knowledge notes) rebuilt from Studio → Bob → *Rebuild knowledge* and automatically after copy edits. Retrieval is a small BM25-style ranker over that index; the prompt only contains the passages and the site map.
- Output contract: `{ message, action?: navigate|read, sources[] }`. A `navigate` href is only honoured if it's a known public path (and known section anchor).
- Safety: prompt-injection patterns and requests for internal data are refused before the model runs (logged as `guard:*`); 40 messages / hour and 150 / day per visitor; history and inputs are clamped; Bob never sees Studio tables.
- Voice: `/api/tts` uses Azure `en-NG-EzinneNeural` / `AbeoNeural` (genuinely Nigerian English) when `AZURE_SPEECH_KEY` is set, ElevenLabs if configured, otherwise the visitor's device voice. The UI only calls a voice Nigerian when it is. Nothing records or speaks until the visitor taps the mic or a Listen / Read button.
- Reading: sentence-level chunks from `<main data-read-root>` (headings, paragraphs, list items, quotes), highlighted and scrolled into view; speed changes apply immediately; devices without any voice get a timed silent read-along.

## Running locally

```
npm run build
npx wrangler d1 migrations apply ferrn-db --local -c .wrangler/local.json --persist-to .wrangler/state
npx wrangler dev -c .wrangler/local.json --persist-to .wrangler/state --port 8787
```

Pages are edge-cached by content version + `ASSET_V`; add `?nocache=1` while iterating on views.

## Deploying v4 (staging first)

1. Merge `v4-experience` into a preview: `npx wrangler versions upload` gives a preview URL without touching production traffic.
2. Apply migration `0010_site_v4.sql` to the live D1 (additive only: new tables + new nullable columns): `npx wrangler d1 migrations apply ferrn-db --remote`.
3. Bump `ASSET_V` (`src/worker/version.ts`) and the Studio service-worker cache name (`public/studio-sw.js`) together — this also invalidates the edge HTML cache.
4. In Studio → Bob, press **Rebuild knowledge**; in Studio → Projects, run **Import from sheet** (share the sheet as *Anyone with the link can view* first) and tick *Show on the website* on the launched ones you want public.
5. Deploy: merge to `platform-v3` (auto-deploys) or `npx wrangler deploy`.

## Rollback

- Code: `git revert` the merge (or redeploy the previous version from Cloudflare → Workers → ferrn → Deployments → *Rollback*). The old views don't read the new tables, so no data step is needed.
- Data: migration 0010 is additive; leaving the tables in place is harmless. The site renders from code defaults whenever `site_content`, `projects (public=1)`, `faqs`, `links`, `profile_sections` or `seasons` are empty.
- Bob: Studio → Bob → Settings → **Off** hides the assistant and makes `/api/chat` answer 503 without a deploy.

## Checks run before merge

- `npm run typecheck` and `npm run build` clean.
- axe-core (WCAG 2.0/2.1/2.2 A+AA) on home, case study, services, product, contact, Yorùbá home: **0 violations**.
- Regression: all 8 languages render; contact form, checkout dialog (pay / invoice), USD/NGN toggle (now also on plan extras), work filters, sitemap, robots, 404, `/profile.pdf`.
- Local lab timings (home, cold): TTFB 34 ms, FCP 0.46 s, LCP 1.9 s (hero reveal), CLS 0; site.js 27 kB (10.5 kB gz), site.css 55 kB (11.4 kB gz).

## Site v5 — section 1 (4 Nov): foundations, opening sequence, control-centre navigation

Michael is reworking the site in sections. Section 1 is live; sections 2 (hero video + growth story + trusted-by marquee) and 3 (Bob modes) follow.

**Foundations.** Brand orange is now `#F94406` (`--orange`). Buttons and icon buttons use `--r-btn: 8px` (no more pills on the public site). Every outline is a hairline: `--bw: .56px` replaces the old 1px borders. The "Important links" page still exists at `/links` for Bob and Studio, but it is no longer linked from the footer or listed in the sitemap.

**Opening sequence** (`Intro` in `views/layout.tsx`, `runIntro()` in `client/site/main.ts`, `.intro-*` in `site.css`). Plays once per session on the home page, skipped under `prefers-reduced-motion`; Escape ends it (no visible skip button, by request). "Websites?" → "Web apps?" → "AI automations?" typed in and out → "all in FERRN" in white → an orange curtain drops, a black one follows 0.3 s later (same smooth ease-in-out, no bounce), then the whole stack keeps falling to uncover the page. About eight seconds. Words live in `data-intro-words` / `data-intro-final`.

**Navigation.** No bar or background behind it — the orange mark, the centre line and the hamburger float over the page; over light sections (`.room-light`) the ink flips dark (`.nav-shell.on-light`). Centre: date and time (time only on phones) and the visitor's country with a round flag (`GET /api/geo` → country only; flags from HatScripts circle-flags on jsDelivr, MIT, with the emoji flag as fallback). The hamburger opens the **control centre** (`.cc`): the page blurs, the box unrolls top-to-bottom and its panels drop in one after another. Panels: navigation + Say hello + CTA; theme (Dark / Light / Auto); language; accessibility; music; share; our website links.

**Accessibility panel.** Text size (Default / Large / Larger — applied with CSS `zoom` on `main`, footer and Bob, so every px size scales), plus twelve switches: stop motion, high contrast, highlight links, readable font (Verdana), text spacing (WCAG 1.4.12 values), greyscale, big cursor, reading guide (band that follows the pointer), focus outline, pause video, hide images, align left. All stored in `localStorage['ferrn-a11y']` and re-applied by the head script before paint; *Reset* clears them.

**Music** (`client/site/music.ts`, list in `MUSIC` in `content/site.ts`). Six free tracks from Pixabay (Calm Ambient, Chill Ambient — VelarioMusic; Warm Story — Strawberry_Candy; Chill Downtempo, Beautiful Chill — AtlasAudio; Chill Beats Instrumental — Sub_Clair) under the Pixabay Content License, stored in R2 at `music/2026-11/*.mp3` and streamed from `/media/`. Previous / play / next, seek, volume; plays through the list; never autoplays; pauses while the tab is hidden. To change tracks, upload in Studio (Media, folder `music`) and edit `MUSIC`.

**Local run.** `wrangler.local.jsonc` (git-ignored) is a copy of `wrangler.jsonc` without the AI binding, so `npx wrangler dev -c wrangler.local.jsonc --port 8787` runs in the sandbox without a Cloudflare token (Bob's answers need the real binding). `/api/geo` returns a placeholder (Austin, US) locally.

## Home page v5 (3 Nov) — Huly structure

Michael asked for huly.io as the reference. The home page now follows that structure with Ferrn's own material: short two-line headline, one pill button, then a large real product screenshot with an orange glow; a capabilities ticker; a **light room** with a bento of silent looping clips of real Ferrn products (Clinic Front Desk booking, Quote & Track, WhatsApp reminders, Studio); a **dark room** marketplace shelf; a **light room** of case-study shots; a **dark room** for Bob with a clip of him answering and reading aloud; testimonials; a glowing closing CTA. Tokens moved to rounded cards (14–18px), pill buttons (ink by default, orange on hover/glow), light/dark sections. Clips live in `public/assets/home/` (recorded with Playwright from the local demos and Studio; 70–170 KB each, lazy-loaded and paused off-screen) and are swappable from Studio → Website copy → Home (the card lines are `title|text|video`). Product images: Studio cover → bundled demo still → live capture.

## Lead previews (concept sites for prospects)

The morning routine no longer needs a git repo. It puts each concept site in the batch file as one self-contained HTML page (`previews: [{slug, company, lead_id|key, html}]`). The LeadsHunter engine keeps the file in Drive › previews and lists it in a `Previews` sheet; the Worker cron (`syncPreviews`, every 10 minutes) copies new ones into R2 as uploaded demos and serves them at **`https://www.ferrnagency.com/preview/<slug>/`** (sandboxed, `noindex`, same store as Studio → Marketplace → Demos). The engine then records the live URL on the lead (`preview_url`, status "Preview ready"). `PREVIEW_BASE_URL` in the engine settings is `https://www.ferrnagency.com/preview`.
