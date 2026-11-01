# Moving ferrnagency.com from Namecheap to Cloudflare

The plan: **DNS first, domain transfer later.** The domain stays registered at Namecheap for now and Cloudflare takes over DNS. The old PHP site keeps running on Namecheap cPanel as a fallback at `legacy.ferrnagency.com` until you're happy. Zoho email must not drop at any point. Every step below protects it.

Time needed: about 30 minutes of clicking, then up to 24 hours for nameservers to switch over (usually under an hour).

## Before you start

1. Deploy the new site to its `workers.dev` URL (SETUP.md steps 1–3) and click through it.
2. In **Namecheap → Domain List → ferrnagency.com → Advanced DNS**, screenshot every record. You want these in particular:
   - The `A` record for `@` (and `www`): your cPanel server IP. Note it down.
   - **MX** records for Zoho: usually `mx.zoho.com` (10), `mx2.zoho.com` (20), `mx3.zoho.com` (50). If your Zoho account is in the EU data centre, they'll be `.zoho.eu`.
   - **TXT** records: SPF (`v=spf1 include:zoho.com ~all` or similar), DKIM (host like `zmail._domainkey`), any `zoho-verification=…`, and DMARC (`_dmarc`).
   - Any **CNAME**s, e.g. Zoho's `zb…` verification and anything for Google.
   - If DNS currently points at Namecheap **hosting** nameservers (`dns1.namecheaphosting.com`), the records live in **cPanel → Zone Editor** instead. Screenshot them there.

## Step 1: Add the site to Cloudflare

1. Cloudflare dashboard → **Add a domain** → `ferrnagency.com` → **Free** plan.
2. Cloudflare scans and imports the existing records. **Compare them against your screenshots.** Add anything missing, especially MX, SPF, DKIM and DMARC.
3. Set the proxy status:
   - MX, TXT, and any `mail`, `autodiscover` or Zoho CNAMEs: **DNS only (grey cloud)**. Email must never be proxied.
   - `@` and `www`: leave as they are for now. Step 3 changes them.
4. Add the fallback record: `A` · `legacy` · *your cPanel IP* · **DNS only**.
5. If SSL errors appear on `legacy.ferrnagency.com` later, run cPanel → **SSL/TLS Status → Run AutoSSL**.

## Step 2: Switch nameservers at Namecheap

1. Cloudflare shows you two nameservers (e.g. `xxx.ns.cloudflare.com`).
2. Namecheap → ferrnagency.com → **Domain** tab → **Nameservers** → **Custom DNS** → paste both → ✓.
3. Wait for Cloudflare to email "ferrnagency.com is now active".
4. **Test email straight away.** Send a message to `michael@ferrnagency.com` from a personal account, and reply from Zoho. If either fails, the MX or SPF records are wrong. Fix them in Cloudflare DNS. Nothing else needs undoing.

## Step 3: Point the domain at the new site

1. Workers & Pages → `ferrn` → **Settings → Domains & Routes → Add → Custom domain**:
   - `www.ferrnagency.com`
   - `ferrnagency.com`
   Cloudflare creates the DNS records and certificates by itself. If it says a record already exists, delete the old `A`/`CNAME` for `@`/`www` first. Leave `legacy` alone.
2. Add a redirect so there is one canonical address: **Rules → Redirect Rules → Create**: when hostname equals `ferrnagency.com`, redirect dynamically to `concat("https://www.ferrnagency.com", http.request.uri.path)`, status 301, preserve query string.
3. SSL/TLS → **Full (strict)**. Edge Certificates → **Always Use HTTPS** on.
4. Check:
   - `https://www.ferrnagency.com` shows the new site.
   - `/studio` loads, and you can log in.
   - The old URLs redirect: `/admin`, `/testimonials`, and the old case-study links.
   - `/sitemap.xml` loads.
   - Email still works.
5. In Google Search Console, resubmit `https://www.ferrnagency.com/sitemap.xml`.

**Rollback** (if something is badly wrong): in Workers → Domains, remove the two custom domains, then add back `A @ <cPanel IP>` and `CNAME www ferrnagency.com` (proxied). The PHP site is live again within a minute.

## Step 4: Keep Namecheap in sync during the transition

- The `main` branch still holds the PHP site, and `legacy.ferrnagency.com` serves it from cPanel. If you deploy to cPanel with Git Version Control, it keeps working on `main`.
- New work goes to `platform-v3`. Once you've lived on the new site for 2–4 weeks:
  1. Merge `platform-v3` into `main`.
  2. Switch the Workers Builds production branch to `main`.
  3. Stop deploying `main` to cPanel.
- Content edits made in Studio (posts, products, team, testimonials) only exist on the new site. Don't edit content in the old PHP admin after the cut-over.

## Step 5: Transfer the registration to Cloudflare (later, optional)

Do this any time after step 3. The domain must be more than 60 days past its registration or last transfer. Cloudflare Registrar charges cost price with no markup, and the transfer adds a year.

1. Namecheap: **Domain** tab → turn **Domain Lock** off → **Auth Code** → have the EPP code emailed to you.
2. Cloudflare: **Domain Registration → Transfer Domains** → select ferrnagency.com → paste the code → pay.
3. Approve the confirmation email from Namecheap, or wait 5 days for it to complete by itself.
4. DNS doesn't change during the transfer, so neither the site nor email goes down.

## When you're sure

- Cancel the Namecheap hosting plan only after you've downloaded a full cPanel backup (**cPanel → Backup → Download a Full Account Backup**). Keep it somewhere safe.
- Then remove the `legacy` DNS record.
