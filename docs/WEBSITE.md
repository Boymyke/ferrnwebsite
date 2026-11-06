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

## Studio update (6 Nov)
- **No concept sites in outreach.** The morning run and reply check no longer build previews or put preview/concept links in any message; they flag good candidates for Michael ("Good candidate for a concept site", "Wants a concept site — Michael to build it"). 16 queued follow-ups that referred to a concept were put on hold (Outreach › Held) for Michael to approve, edit or cancel.
- **Emails › What was sent.** Site emails keep a copy of their HTML (`private/emails/<id>.html` in R2, shown in a sandboxed frame); outreach emails keep their text (`private/emails/lh-<id>.txt`), and older outreach emails are fetched once from LeadsHunter and saved. `private/` is never served under /media.
- **Delete proposals and quotes** from the lists (bin icon) and from the quote editor. Signed proposals: admins only; their invoices stay.
- **Bob** is one page with tabs: Overview, Knowledge notes (was its own page; old link redirects), What Bob knows, Conversations, Costs, Settings.
- **Demos** cards no longer overflow; previews scale to fill each card and load only when scrolled near.
- **Pagination** on every Studio list (25/50/100 per page, remembered): leads, emails, quotes, proposals, invoices, RFPs, content, WhatsApp chats, outreach lists, Bob conversations, activity log, all resource pages, demos; analytics visits and visitors are paged on the server.
- **Analytics › Visitors**: every visitor (anonymous browser id) with location, device, source, visits, pages and time on site; filters for live / one visit / came back and country; a drawer with each visit's journey. The map (Live and Visitors tabs) shows every place visitors came from in the period, pins pulse where someone is on the site now. New range: 90 days.
- **Social DMs** (`/social`) and **Interactions** (`/interactions`): AI drafts Instagram DMs, LinkedIn connection notes + messages for leads, and comments on other people's posts. Instagram and LinkedIn don't allow apps to cold-DM, like or comment, and bot accounts get restricted, so sending stays one tap: Copy & open, paste, send, mark done. DMs get a follow-up reminder after 4 days. Stored in R2 `private/studio/engage.json`.

## Site v5 — section 3 (4 Nov): Bob, the ghost

**Loading.** Only a tiny launcher is in the main bundle (`client/site/bob-launcher.ts`): an orange ghost bottom-right that floats, blinks and follows the pointer with its eyes. The assistant itself (`client/bob/index.ts` → `/assets/bob.js`, ~29 KB, plus `/assets/bob.css`) loads the first time someone opens Bob, so it costs nothing on page load. `data-bob-prompt="…"` on any button opens chat with that question; `data-bob-prompt="tour"` starts the tour.

**Name.** Bob asks what to call you. First name only (two names → the first), Latin letters, 2–12 characters — numbers or symbols get "that doesn't look like a name", non-Latin scripts get a request for English letters, long names get a request for a shorter name or nickname, so nothing breaks the layout. Stored in `localStorage['ferrn-name']`; headlines then greet the visitor ("that grow your business, Michael." / "Not for show, Michael." / "Let's build what's next, Michael.") on every page. `/api/chat` receives the name (re-validated) and uses it now and then.

**Chat.** Big quote-style messages (Bob's with an orange quote mark), your messages small on the right; each older message fades a little more but stays (hover brings it back). Chips: tour, read this page, suggestions. Mic for dictation. When an answer includes an action Bob acts on it: a white-glove hand flies to the matching link or section, presses it and goes there; the chat reopens on the next page with its history.

**Talk.** Hands-free: tap *Start talking*, speak; Bob says a filler ("Hmm…", "Let me think…") while he fetches the answer (`voice: true` keeps answers to two or three short sentences), speaks it, and listens again. *End conversation* shows the full transcript (copy, or continue in chat). The microphone runs only while the conversation is on. Needs a browser with speech recognition (Chrome, Edge, Safari); otherwise it says so.

**Present.** A guided tour of the home page (13 steps): asks your name → "sit back and relax" → Bob leaves the corner through a portal and appears on the page → highlights the hero (and plucks the first letter of the orange word, carrying it along), the growth levers, the calculator (asks your monthly visitors and sets the calculator), services (asks what you need), marketplace, work, Trusted By → offers to write to the team, asks for an email (optional) → portals to `/contact`, drops the letter into the message and types the form in (name, email, need, a message built from your answers). Nothing is sent for you. Spotlight dims the rest of the page; the caption has Pause / Next / End tour; Escape ends it. After 10 s without an answer: "Still there, Ada?"; 20 s more pauses the tour. The tour survives the page change (`sessionStorage['ferrn-bob-tour']`).

**Voice.** Sound toggle in the panel (remembered). Uses `/api/tts` (Azure, when a key is set) or the device's voice; never speaks or listens until asked.

## Leads: delete and take over (4 Nov)

**Delete** (Studio → Leads → open a lead → *Delete*, editors and admins). For a LeadsHunter lead the engine removes the row from the Leads sheet first, cancels every email still waiting for it and adds the address to Suppression, so the routine can't re-add or email it; then the Studio row goes, and any WhatsApp queue for it is cancelled.

**Take over** (*Take over* / *Hand back to automation*). Marks the lead as handled by you (`leads.handled_by`, engine `Leads.handler`). While taken over: no automated email goes out (anything queued is held; anything the AI routine drafts later arrives held for you to approve in Outreach → Held), replies set *needs you* instead of waiting for the AI, the WhatsApp bot stops answering (`wa_contacts.bot_paused`) and WhatsApp follow-ups are cancelled. Handing back resumes the automation; held messages stay held until you approve them one by one.

Needs: migration `0011_lead_takeover.sql` on the live D1 (two columns) and LeadsHunter Apps Script **version 7** (actions `takeOver`, `release`, `deleteLead`, the `handler` column — added to the sheet automatically the first time). Until the migration is applied the sync carries on without the column and *Take over* explains what's missing.

**Email sender.** Site emails (Resend) always go from `michael@ferrnagency.com` — `EMAIL_FROM` can change the display name only, replies come back to the same address. Outreach goes from Gmail as `michael@ferrnagency.com` (the engine's `FROM_ALIAS`; Studio → Outreach shows the address actually used). Studio → Team → Integrations now shows the email line.

## Site v5 — section 2, simplified (4 Nov evening)

Michael asked to dial it down. Now:

- **Hero** (`.hx`) follows the site theme (light or dark). One word changes in orange (`home.hero.flick`) with a single move — the old word lifts away and blurs out, the next rises into place — over "that grow your business." No showreel. The orange halftone dot texture appears **only where the pointer moves**: a soft, noisy trail that fades out (`hero.ts`, WebGL, set up on the first pointer move and idle when the pointer is still, so it costs nothing on load). Reduced motion / no WebGL → no texture.
- **Trusted By** is its own section, after the work, titled "Trusted By" (`home.trusted.title`). Logos are white silhouettes in dark mode, black in light mode, full colour on hover.
- **Growth** section with the three levers and the calculator stays, right after the hero.
- The showreel code (`REEL`, `reel/<slug>.webp` captures) is kept for later; the Browser Rendering capture endpoint is now also used for **project covers** — `covers/<slug>.webp` (1440×900 first screen, 30–75 KB) replace thum.io's ~1 MB PNGs, and Studio → Projects → Capture uses it first.

**Speed fixes (4 Nov).** A full-screen invisible layer from the control centre was catching every click and pointer move on the page (pointer-events rule) — fixed, and the nav test suite now checks the page stays clickable. Testimonial avatars are resized by Cloudinary (`sized()`; they were 100–870 KB photos shown at 44 px). Fonts trimmed to Poppins 400/500/600 (no 300/700, no Pinyon Script). Home page weight dropped from ~5 MB to well under 1 MB.

**Tests** (in the sandbox, `/home/claude/navtest.js`): 96 checks across desktop/phone/tablet × light/dark — nav visible, menu opens inside the viewport, links/close/Escape/backdrop, languages overlay, theme switch, page clickable with the menu closed, hide-on-scroll, ink over light sections.

## Site v5 — section 1 (4 Nov): foundations, opening sequence, control-centre navigation

Michael is reworking the site in sections. Section 1 is live; sections 2 (hero video + growth story + trusted-by marquee) and 3 (Bob modes) follow.

**Foundations.** Brand orange is now `#F94406` (`--orange`). Buttons and icon buttons use `--r-btn: 8px` (no more pills on the public site). Every outline is a hairline: `--bw: .56px` replaces the old 1px borders. The "Important links" page still exists at `/links` for Bob and Studio, but it is no longer linked from the footer or listed in the sitemap.

**Opening sequence** (`Intro` in `views/layout.tsx`, `runIntro()` in `client/site/main.ts`, `.intro-*` in `site.css`). Plays once per session on the home page, skipped under `prefers-reduced-motion`; Escape ends it (no visible skip button, by request). "Websites?" → "Web apps?" → "AI automations?" typed in and out → "all in" in white and "FERRN" in brand orange → an orange curtain drops, a black one follows 0.3 s later (same smooth ease-in-out, no bounce), then the whole stack keeps falling to uncover the page. About eight seconds. Words live in `data-intro-words` / `data-intro-final`.

**Navigation.** No bar or background behind it — the orange mark, the centre line and the hamburger float over the page; over light sections (`.room-light`) the ink flips dark (`.nav-shell.on-light`). Centre: date and time (time only on phones), then the visitor's country name followed by its emoji flag (`GET /api/geo` → country only). Windows has no flag emoji, so there a bundled 78 KB font (`/fonts/TwemojiCountryFlags.woff2`, from country-flag-emoji-polyfill; Twemoji graphics CC-BY 4.0) draws it. The hamburger opens the **control centre** (`.cc`): the page blurs, the box unrolls top-to-bottom and its panels drop in one after another. Panels: navigation + Say hello + CTA; theme (Dark / Light / Auto); language (opens as an overlay over the other panels, so the box never changes height; picking one switches the site language); accessibility; music; our website links. (The share button was removed.)

**Accessibility panel.** Text size (Default / Large / Larger — applied with CSS `zoom` on `main`, footer and Bob, so every px size scales), plus twelve switches: stop motion, high contrast, highlight links, readable font (Verdana), text spacing (WCAG 1.4.12 values), greyscale, big cursor, reading guide (band that follows the pointer), focus outline, pause video, hide images, align left. All stored in `localStorage['ferrn-a11y']` and re-applied by the head script before paint; *Reset* clears them.

**Music** (`client/site/music.ts`, list in `MUSIC` in `content/site.ts`). Six free tracks from Pixabay (Calm Ambient, Chill Ambient — VelarioMusic; Warm Story — Strawberry_Candy; Chill Downtempo, Beautiful Chill — AtlasAudio; Chill Beats Instrumental — Sub_Clair) under the Pixabay Content License, stored in R2 at `music/2026-11/*.mp3` and streamed from `/media/`. Previous / play / next, seek, volume. The chosen track **loops until the visitor changes it**. **Music keeps playing across pages:** while it plays, internal links swap the page in place (`softNav()` / `softGo()` in `main.ts` — fetch the page, replace `main`, the footer and the path/language-dependent nav pieces, re-run page widgets, record a page view, View Transition where supported; back/forward work). Studio, media, demos, previews and file links always load normally. If a page does fully reload, the player resumes from the saved position; if the browser blocks sound until a tap, a small *Resume music* chip appears. Never autoplays on a first visit; pauses while the tab is hidden. To change tracks, upload in Studio (Media, folder `music`) and edit `MUSIC`.

**Local run.** `wrangler.local.jsonc` (git-ignored) is a copy of `wrangler.jsonc` without the AI binding, so `npx wrangler dev -c wrangler.local.jsonc --port 8787` runs in the sandbox without a Cloudflare token (Bob's answers need the real binding). `/api/geo` returns a placeholder (Austin, US) locally.

## Home page v5 (3 Nov) — Huly structure

Michael asked for huly.io as the reference. The home page now follows that structure with Ferrn's own material: short two-line headline, one pill button, then a large real product screenshot with an orange glow; a capabilities ticker; a **light room** with a bento of silent looping clips of real Ferrn products (Clinic Front Desk booking, Quote & Track, WhatsApp reminders, Studio); a **dark room** marketplace shelf; a **light room** of case-study shots; a **dark room** for Bob with a clip of him answering and reading aloud; testimonials; a glowing closing CTA. Tokens moved to rounded cards (14–18px), pill buttons (ink by default, orange on hover/glow), light/dark sections. Clips live in `public/assets/home/` (recorded with Playwright from the local demos and Studio; 70–170 KB each, lazy-loaded and paused off-screen) and are swappable from Studio → Website copy → Home (the card lines are `title|text|video`). Product images: Studio cover → bundled demo still → live capture.

## Lead previews (concept sites for prospects)

The morning routine no longer needs a git repo. It puts each concept site in the batch file as one self-contained HTML page (`previews: [{slug, company, lead_id|key, html}]`). The LeadsHunter engine keeps the file in Drive › previews and lists it in a `Previews` sheet; the Worker cron (`syncPreviews`, every 10 minutes) copies new ones into R2 as uploaded demos and serves them at **`https://www.ferrnagency.com/preview/<slug>/`** (sandboxed, `noindex`, same store as Studio → Marketplace → Demos). The engine then records the live URL on the lead (`preview_url`, status "Preview ready"). `PREVIEW_BASE_URL` in the engine settings is `https://www.ferrnagency.com/preview`.
