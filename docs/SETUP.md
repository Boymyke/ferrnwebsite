# Setup

Everything below is done once. Cloudflare resources already exist on the Ferrn account:

| Resource | Name | ID |
|---|---|---|
| D1 database | `ferrn-db` | `f83f0e82-ff71-4218-8aec-3f4ffae76474` |
| KV namespace | `ferrn-cache` | `a6cccea666134dc7bb2e86243635e58d` |
| R2 bucket | `ferrn-media` | — |

The database tables and the starting content are already loaded: products, team, testimonials, knowledge, and the two founder accounts (no passwords yet). Leads arrive automatically from LeadsHunter once step 5 is done.

## 1. Connect GitHub so every push deploys

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Import a repository** → pick `Boymyke/ferrnwebsite`.
2. Project name: `ferrn`. Production branch: `platform-v3` for now (switch to `main` after the cut-over in MIGRATION.md).
3. Build command: `npm run build`. Deploy command: `npx wrangler deploy`. Root directory: `/`.
4. Save. The first build takes about a minute. You get a `ferrn.<your-subdomain>.workers.dev` URL to test on before the domain moves.

## 2. Add secrets

Workers & Pages → `ferrn` → **Settings → Variables and Secrets** → add each as type **Secret**. Only the first one is required to start. Each of the others switches on one feature, and the site works without it.

| Secret | Turns on | Where to get it |
|---|---|---|
| `BOOTSTRAP_SECRET` | First owner login | Make up a long random string. Used once at `/studio/setup`. |
| `OPENAI_API_KEY` | Assistant answers and Studio AI drafting (quotes, content, meeting questions) | platform.openai.com → API keys. Without it, Workers AI (Llama 3.3) answers instead. |
| `ENGINE_KEY` | LeadsHunter outreach in Studio | The `API_KEY` value in the LeadsHunter sheet's **Settings** tab. Also set the `ENGINE_URL` variable (step 4). |
| `GOOGLE_MAPS_API_KEY` | **Find leads** (Google Maps prospecting) | Google Cloud console → enable **Places API (New)** → Credentials → API key, restricted to Places API. |
| `PAYSTACK_SECRET_KEY` | Marketplace card payments | Paystack dashboard → Settings → API Keys & Webhooks. Set the webhook URL to `https://www.ferrnagency.com/api/paystack/webhook`. Without it, checkout sends an invoice request instead. |
| `AZURE_SPEECH_KEY` | Nigerian voice for the assistant (Ezinne, en-NG) | Azure portal → Speech service (region `westeurope`, the free tier is enough). |
| `ELEVENLABS_API_KEY` | Optional alternative voice (Lagos accent) | elevenlabs.io → Profile → API key, then set the variable `TTS_PROVIDER` to `elevenlabs`. |

If no voice key is set, the assistant uses the visitor's browser voice (it picks Nigerian English when the device has it).

## 3. Create your owner login

1. Open `https://<your workers.dev URL>/studio/setup`.
2. Enter the `BOOTSTRAP_SECRET`, your email (`michael@ferrnagency.com`) and a password: at least 10 characters, with both letters and numbers.
3. Setup locks itself once the owner has a password. You can delete the `BOOTSTRAP_SECRET` secret afterwards.

## 4. Invite Anjolaoluwa (co-founder)

Studio → **Team & access**. Her account (`anjolaajayi3@gmail.com`, role **Admin**) already exists, so click **Get invite link** on her row. Copy the link and send it on WhatsApp. It works for 7 days and lets her choose her own password.

Every change either of you makes is recorded. You can see it as "Edited by …" on each record, under **History** in each drawer, and in the **Activity** log.

## 5. Connect LeadsHunter (outreach engine)

The Apps Script engine in `engine/apps-script/` still does the sending from Gmail and reads the replies. Studio controls it.

1. Open the Ferrn Command Centre sheet → **Extensions → Apps Script**. Make sure `Code.gs` matches `engine/apps-script/Code.gs`.
2. **Deploy → Manage deployments**. Copy the **Web app URL** (it ends in `/exec`). The settings must be "Execute as: Me" and "Who has access: Anyone".
3. In Cloudflare, set the **variable** `ENGINE_URL` to that URL, and the **secret** `ENGINE_KEY` to the sheet's `API_KEY`.
4. Studio → **Outreach** now shows the live queue. Leads sync into Studio every 10 minutes, and a status change in Studio is sent back to the sheet.

### Sending as michael@ferrnagency.com (Zoho) from Gmail

The engine sends through the Gmail account that owns the sheet, using the `FROM_ALIAS` setting (`michael@ferrnagency.com`). Gmail only allows this once the alias is verified:

1. Zoho Mail → **Settings → Security → App passwords** → generate one called "Gmail".
2. Gmail → **Settings → Accounts and Import → Send mail as → Add another email address**.
   - Name: `Michael | Ferrn Digital Agency`. Email: `michael@ferrnagency.com`. Untick "Treat as an alias".
   - SMTP server: `smtppro.zoho.com` (use `smtp.zoho.com` for a free Zoho plan). Port **465**, SSL.
   - Username: `michael@ferrnagency.com`. Password: the Zoho app password.
3. Gmail emails a confirmation code to the Zoho inbox. Enter it.
4. Optionally make it the default "From" address. The engine then sends as Ferrn, and replies come back to Zoho. If Zoho forwards to Gmail, the engine also sees replies there.

Check it worked: Studio → Outreach → **Run now**. The sent message's header should read `From: Michael | Ferrn Digital Agency <michael@ferrnagency.com>`.

## Local development

```bash
npm install && npm run build
# a local config without the remote-only AI binding:
node -e 'const fs=require("fs");let s=fs.readFileSync("wrangler.jsonc","utf8").replace(/^\s*\/\/.*$/gm,"");const c=eval("("+s+")");delete c.ai;c.main="../src/worker/index.tsx";c.assets.directory="../public";c.d1_databases.forEach(d=>d.migrations_dir="../migrations");fs.mkdirSync(".wrangler",{recursive:true});fs.writeFileSync(".wrangler/local.json",JSON.stringify(c,null,1))'
echo 'BOOTSTRAP_SECRET=local-test' > .wrangler/.dev.vars
npx wrangler d1 migrations apply ferrn-db --local -c .wrangler/local.json
npx wrangler dev -c .wrangler/local.json
```

Changing the schema: add `migrations/000N_name.sql`, then run `npx wrangler d1 migrations apply ferrn-db --remote`.

Releasing front-end changes: bump `ASSET_V` in `src/worker/version.ts` and the version in `public/studio-sw.js`. Browsers then fetch new CSS and JS, and the edge cache serves fresh pages.
