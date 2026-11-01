# Social auto-posting and results (X, Instagram, TikTok)

Studio → **Content** posts approved calendar items to X, Instagram and TikTok on time, then reads their results back and shows them under **Content → Performance**. This page lists what the owner has to set up once for each platform. The platform docs were checked on **1 November 2026**. These APIs change often, so check the linked pages again if a step looks different.

## How it works

- **Posting.** The Worker cron runs every 10 minutes. It publishes a post when all of these are true:
  - `autopost = 1` (the **Auto-post** switch in the post editor)
  - the status is `approved` or `scheduled`
  - `scheduled_at` is now or earlier
- **Result of a run.** The post gets `posted` with `post_url`, `external_id` and `posted_at`. If it fails, it is retried up to 3 times, 20 minutes apart, and then marked `failed` with the error shown in the editor.
- **Instagram or TikTok post with no image or video.** It is parked as **Needs media** (red icon on the calendar). It goes out as soon as media is added.
- **Other parked states:**
  - **Missed:** more than 24 hours late. Nothing is ever posted late without a person pressing **Post now**.
  - **Post manually:** the platform is not connected.
  - **Waiting (daily cap):** the platform's daily cap is reached.
- **No double posts.** Each post is claimed with a conditional D1 update and also locked in KV. Thread and carousel progress is saved after every step, so a retry carries on from where it stopped. It never starts again from the first post.
- **Daily caps** (rolling 24 hours): X 12, Instagram 20, TikTok 6. Change them with `PUT /api/studio/social/caps`, for example `{"x":10}`. They are stored in the `social_daily_caps` setting.
- **Results.** Each post's numbers are read every 6 hours while it is under 30 days old, then daily until 90 days. Every reading is added to `post_metrics`, and `content_posts.metrics_json` is updated. Follower counts are read once a day into `social_accounts_daily`.
- **Unconnected platforms.** Type the numbers in the post's **Results** tab and follower counts under **Connections → Log**. They feed the same charts.
- **Token storage.** TikTok and Instagram tokens are stored in `social_tokens`, encrypted with AES-GCM. The key is derived from `SOCIAL_ENC_KEY` with HKDF-SHA-256. Tokens are never logged, and error text is scrubbed of tokens before it is saved.

### Media and Worker size limits

- **Upload size.** Studio's media picker streams files straight to R2, saved as `media_json` items `[{url, type}]` and served publicly at `https://www.ferrnagency.com/media/...`.
  - Cloudflare limits one request body to **100 MB** on the Free and Pro plans, 200 MB on Business and 500 MB on Enterprise ([Workers limits](https://developers.cloudflare.com/workers/platform/limits/)).
  - Files up to 95 MB upload in one request. Larger videos upload automatically in 50 MB parts using R2 multipart upload, so the file size is not limited by the Worker.
- **Instagram:** JPEG images only (a PNG or WebP is flagged as "Needs media"). Up to 10 items post as a carousel. A single video posts as a Reel.
- **TikTok:** MP4, MOV or WebM. 3 seconds to 10 minutes, at most 4 GB, 23–60 fps. Photo posts take up to 35 images.
- **X:** up to 4 images of 5 MB each, or one video. Videos are sent in 4 MB chunks read from R2.
- **CPU time.** Posting a video makes several network calls inside the cron. The Workers Paid plan's CPU limit is enough. The Free plan's 10 ms CPU limit may not be.

---

## 1. X (Twitter)

**Which plan:** pay-per-use is now the only plan open to new developers. It allows both posting and reading.
- The Free tier closed to new developers in February 2026.
- The old Basic ($200/month) and Pro ($5,000/month) plans are closed to new sign-ups. Existing subscribers keep them.
- Official prices ([docs.x.com pricing](https://docs.x.com/x-api/getting-started/pricing)):
  - **$0.015** per post created
  - **$0.20** per post that contains a URL
  - **$0.005** per post read
  - **$0.001** per "owned read" (your own posts and followers)
  - **$0.010** per user read
- Credits are bought in advance. You can set a monthly spending limit.
- **Rough cost for the November calendar** (29 X items, many of them 5-post threads): under $5 to post if most posts have no link, plus a few dollars a month for results reads. Each post is read about 150 times over 90 days. **Links cost more:** "ferrnagency.com/work" in a post probably counts as a URL, at $0.20 per post. Put links only in the last post of a thread.
- Prices change. Check the Developer Console before topping up.

**Steps:**
1. Sign in at **[console.x.com](https://console.x.com)** with the Ferrn X account. Accept the developer terms and buy credits, for example $10. Set a spending limit.
2. **Create App**: name it "Ferrn Studio" and describe the use case as "Publishing our own scheduled posts and reading their metrics."
3. In the app settings, set **App permissions** to **Read and write**. See [Developer apps](https://docs.x.com/fundamentals/developer-apps).
4. Under **Keys and tokens**, copy the **API Key and Secret**, also called the consumer keys.
5. Generate the **Access Token and Secret** for the Ferrn account. Do this *after* setting Read and write. If you change permissions later, regenerate the token, because old tokens keep the old permissions. Keys are shown only once.
6. Add these four Cloudflare secrets: `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_SECRET`.

**What Studio uses:**
- OAuth 1.0a user context with HMAC-SHA1. No callback URL is needed.
- `POST /2/tweets`: threads are split on lines that start `1/`, `2/` and so on, and posted as a reply chain.
- `POST /2/media/upload` for images, and the `initialize`, `append`, `finalize` endpoints for video ([media docs](https://docs.x.com/x-api/media/introduction)).
- `GET /2/tweets?tweet.fields=public_metrics,non_public_metrics` and `GET /2/users/me` for results.
- If reads are refused, posting still works and the Connections card shows the error.
- X Premium accounts can post up to 25,000 characters. If you have it, set the variable `X_MAX_CHARS` (default 280).

---

## 2. Instagram (Meta)

Instagram publishing uses the **Instagram API with Facebook Login** ([overview](https://developers.facebook.com/docs/instagram-platform/overview), [content publishing](https://developers.facebook.com/docs/instagram-platform/content-publishing), [insights](https://developers.facebook.com/docs/instagram-platform/reference/instagram-media/insights/)).

**Before you start:**
1. **Make the Instagram account Professional.** In the Instagram app: Settings → Account type and tools → Switch to professional account (Business).
2. **Link it to the Ferrn Facebook Page.** Go to Meta Business Suite → Settings → Instagram accounts, or the Facebook Page → Settings → Linked accounts → Instagram ([help](https://www.facebook.com/business/help/connect-instagram-to-page)). Your Facebook user must be able to do admin-level tasks on that Page.

**Create the app:**
1. Go to [developers.facebook.com/apps](https://developers.facebook.com/apps) → **Create app**. Choose the business use case, then **Manage messaging & content on Instagram**, or "Other" → **Business**. Link it to Ferrn's business portfolio.
2. Add the products **Facebook Login for Business** and **Instagram → API setup with Facebook login**.
3. Request these permissions:
   - `instagram_basic`
   - `instagram_content_publish`
   - `instagram_manage_insights`
   - `pages_show_list`
   - `pages_read_engagement`
4. **App Review:** not needed for Ferrn's own account.
   - **Standard Access** is enough when everyone who logs in has a role on the app (add Michael and Anjolaoluwa under App roles) and the Instagram account is one you own.
   - **Advanced Access** needs App Review plus [Business Verification](https://developers.facebook.com/docs/development/release/business-verification). It is only needed to manage other people's accounts, for example client accounts later.
   - If you go for review, record a screencast of Studio scheduling and auto-posting a post, and of the Performance page showing insights.

**Then choose one of these:**

- **A. Connect in Studio (recommended).**
  1. In the app's Facebook Login for Business settings, add the valid OAuth redirect URI `https://www.ferrnagency.com/api/social/callback/instagram`. Also add the workers.dev URL if you test there.
  2. Set the variable `META_APP_ID` and the secret `META_APP_SECRET` (App settings → Basic). Also set `SOCIAL_ENC_KEY`.
  3. Studio → Content → Performance → Connections → **Instagram → Connect**.
  4. Studio swaps the login for a [long-lived token](https://developers.facebook.com/docs/facebook-login/guides/access-tokens/get-long-lived), then takes the Page token, which has no expiry date. It finds the linked Instagram account by itself and stores the token encrypted.
- **B. Paste a token.**
  1. In [Graph API Explorer](https://developers.facebook.com/tools/explorer/), choose the app and add the five permissions. Generate a User token.
  2. Exchange it for a long-lived token:
     `GET https://graph.facebook.com/v25.0/oauth/access_token?grant_type=fb_exchange_token&client_id=APP_ID&client_secret=APP_SECRET&fb_exchange_token=SHORT_TOKEN`
  3. Get the Page token and the Instagram ID:
     `GET https://graph.facebook.com/v25.0/me/accounts?fields=name,access_token,instagram_business_account&access_token=LONG_TOKEN`
  4. Set the secrets `META_ACCESS_TOKEN` (the Page `access_token`) and `IG_USER_ID` (`instagram_business_account.id`).
  5. Check the token never expires in the [Access Token Debugger](https://developers.facebook.com/tools/debug/accesstoken/).

**What Studio uses:**
- Media containers via `POST /{ig-user-id}/media`:
  - a single image: `image_url`
  - a carousel: children with `is_carousel_item`, then `media_type=CAROUSEL`
  - a Reel: `media_type=REELS` with `video_url`
- Each container is checked with `GET /{container}?fields=status_code` until it is `FINISHED`. Video can take a few minutes, and the cron picks it up again. Then `POST /{ig-user-id}/media_publish`.
- Instagram allows 100 API posts per 24 hours. Studio's own cap is 20.
- Insights per post: `reach, likes, comments, saved, shares, views, total_interactions`. Instagram no longer reports `impressions` for new media, so `views` is used instead.
- Followers come from `followers_count` on the account.
- The Graph version defaults to `v25.0`. Override it with the variable `META_GRAPH_VERSION`.

---

## 3. TikTok

TikTok posting uses the **Content Posting API (Direct Post)** and **Login Kit**. Results come from the **Display API**. Docs: [get started](https://developers.tiktok.com/doc/content-posting-api-get-started), [direct post](https://developers.tiktok.com/doc/content-posting-api-reference-direct-post), [token management](https://developers.tiktok.com/doc/oauth-user-access-token-management), [video query](https://developers.tiktok.com/doc/tiktok-api-v2-video-query).

**Steps:**
1. Log in at [developers.tiktok.com](https://developers.tiktok.com) with a Ferrn account. Go to **Manage apps → Connect an app**. Fill in the app icon, description, terms URL (`https://www.ferrnagency.com/policies/terms-of-use`), privacy URL (`https://www.ferrnagency.com/policies/privacy-policy`) and platform **Web**.
2. Add the products:
   - **Login Kit.** Redirect URI: `https://www.ferrnagency.com/api/social/callback/tiktok`. It must be HTTPS and match exactly.
   - **Content Posting API.** Turn on **Direct Post**.
3. Add the scopes:
   - `user.info.basic`
   - `video.publish`
   - `video.upload`
   - `video.list` (results)
   - `user.info.stats` (follower count)
4. **Verify the media domain** under **URL properties**, because TikTok pulls videos from our URL (`PULL_FROM_URL`). Verify the domain `www.ferrnagency.com` with a DNS TXT record (recommended), or the URL prefix `https://www.ferrnagency.com/media/`. Media URLs must not redirect ([media transfer guide](https://developers.tiktok.com/doc/content-posting-api-media-transfer-guide)).
5. Submit the app for review so the Login Kit and the scopes work. Then copy the **Client key** and **Client secret** into the secrets `TIKTOK_CLIENT_KEY` and `TIKTOK_CLIENT_SECRET`. Also set `SOCIAL_ENC_KEY`.
6. Studio → Content → Performance → Connections → **TikTok → Connect**. Log in with the Ferrn TikTok account. The access token lasts 24 hours and refreshes automatically. The refresh token lasts 365 days, so reconnect once a year.

**The audit (important):**
- Until TikTok **audits** the app, every API post is **private ("Only me", `SELF_ONLY`)**, and only a few users can post. Studio follows this rule and shows a note in the editor. Each private video then has to be made public by hand in the TikTok app. Private videos also return no public ID, so their results cannot be read until they are public.
- To lift the limit, apply for the audit at [Content Posting API audit](https://developers.tiktok.com/application/content-posting-api). The app's posting screen must follow the [Content Sharing Guidelines](https://developers.tiktok.com/doc/content-sharing-guidelines). Studio's editor already covers the main points:
  - it shows the account the video goes to
  - it lets you choose who can view it, with only the options TikTok returns and no public default
  - it has a comments toggle and a "promotes your brand" disclosure
- Record a screencast of that flow for the audit. Once approved, set the variable `TIKTOK_AUDITED=1` to allow public posting.

**Until it's connected:** TikTok posts show **Post manually**. The editor has **Copy caption** and **Download video**, so posting from a phone takes about a minute.

---

## 4. Cloudflare secrets and variables

Set these under Workers & Pages → `ferrn` → Settings → Variables and Secrets, or with `npx wrangler secret put NAME`.

| Name | Type | Needed for |
|---|---|---|
| `SOCIAL_ENC_KEY` | secret | Encrypting TikTok and Instagram tokens. A random string of 32 or more characters, for example from `openssl rand -base64 48`. Changing it means reconnecting both accounts. |
| `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_SECRET` | secrets | X posting and results |
| `META_APP_ID` | variable | Instagram "Connect" button (option A) |
| `META_APP_SECRET` | secret | Instagram "Connect" button (option A) |
| `IG_USER_ID`, `META_ACCESS_TOKEN` | secrets | Instagram with a pasted token (option B) |
| `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` | secrets | TikTok connect, posting and results |
| `TIKTOK_AUDITED` | variable | Set to `1` after TikTok approves the audit |
| `META_GRAPH_VERSION` | variable (optional) | Default `v25.0` |
| `X_MAX_CHARS` | variable (optional) | Default `280`. Raise it for X Premium. |
| `SOCIAL_MEDIA_BASE` | variable (optional) | Public base URL for media. Defaults to `SITE_URL`. |
| `SOCIAL_FAKE_API` | **local dev only** | `1` answers every platform call with stubs. **Never set it in production.** |

Apply the database change once with `npm run db:migrate`. It runs `migrations/0008_social.sql`.

## 5. Testing locally

```bash
# .wrangler/.dev.vars, in addition to BOOTSTRAP_SECRET=local-test:
SOCIAL_FAKE_API=1
SOCIAL_ENC_KEY=local-dev-only-encryption-key-123456
X_API_KEY=fake
X_API_SECRET=fake
X_ACCESS_TOKEN=fake
X_ACCESS_SECRET=fake
META_APP_ID=fake
META_APP_SECRET=fake
TIKTOK_CLIENT_KEY=fake
TIKTOK_CLIENT_SECRET=fake

npx wrangler d1 migrations apply ferrn-db --local -c .wrangler/local.json
npx wrangler dev -c .wrangler/local.json --port 8790 --ip 127.0.0.1 --test-scheduled
# create the owner login (docs/SETUP.md), then:
node scripts/social-selftest.mjs http://127.0.0.1:8790 michael@ferrnagency.com 'YourPassword'
```

The self-test does the following:
- connects TikTok and Instagram through the real OAuth callback
- uploads media to R2
- creates due posts and fires the cron twice
- checks that posts are published with `post_url`, a thread posts as a reply chain, Instagram without media becomes "Needs media", an over-long X post fails cleanly, nothing is posted twice, and `post_metrics` and `social_accounts_daily` receive snapshots

To run the scheduler on demand, an admin can use **Connections → Run now**, which calls `POST /api/studio/social/run`.
