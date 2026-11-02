# What the platform costs, and the free setup

Everything runs on one Cloudflare account. The only fixed bill is **Workers Paid, $5/month** (the October invoice was exactly $5.00). Everything else has a free allowance that the platform now stays inside by design.

## Line by line

| Item | Used for | Free allowance | Beyond it | How we stay free |
|---|---|---|---|---|
| Cloudflare Workers Paid | Site, Studio, APIs, cron | $5/month flat: 10M requests, D1 25B reads/50M writes a month, KV, R2 10 GB | Pay-as-you-go | Traffic is nowhere near the limits |
| Workers AI (Bob, Studio drafting, WhatsApp bot, translations) | Model answers | **10,000 Neurons/day** on every plan | $0.011 per 1,000 Neurons | Bob defaults to **Llama 3.1 8B fast** (~22 Neurons per answer → ~450 free answers/day) with a **daily answer ceiling (300)**; Studio drafting is a handful of calls a day; translations are cached for 30 days |
| OpenAI | Only if `OPENAI_API_KEY` is set | — | Per token on your OpenAI account | **Not set** — nothing is billed outside Cloudflare |
| Voice (Bob read-aloud, replies) | Nigerian voice | Azure Speech F0: 500,000 characters/month; ElevenLabs free: 10,000 credits/month | Azure $16 per 1M chars | Today: visitor device voices ($0). Add `AZURE_SPEECH_KEY` on the free F0 tier for the genuine Nigerian voice |
| Google Places (lead finding) | Find leads + autopilot | **1,000** Text Search calls/month (our field mask = Enterprise SKU) | $35 per 1,000 | Monthly ceiling `maps.monthly_limit` = 900; autopilot stops at the daily lead cap |
| Resend (proposal/invoice emails) | Transactional email | 3,000 emails/month, 100/day | $20/month | Volume is tiny |
| Gmail / Apps Script (LeadsHunter outreach, RFP scout) | Outreach | Free (Gmail ~100–500 sends/day) | — | — |
| Paystack | Checkout | — | 1.5% + ₦100 per local transaction (capped ₦2,000); 3.9% + ₦100 international | Only when a client pays |
| Claude scheduled tasks (morning run, reply check, RFP scout) | Sales autopilot | Included in the Claude plan | — | — |
| Screenshots (thum.io / mshots) | Project covers | Free | — | Stored once in R2, not fetched per visit |

## Switches (Studio → Bob → Costs)

- **Model**: Fast & free (8B) · Tiny (3B) · Smarter (70B, ~70 free answers/day then ~$0.0015 each) · OpenAI (if a key exists).
- **Daily answer ceiling**: after N model answers in a day Bob points to email/booking. Greetings, "read this page", blocked prompts and the FAQ-style intents never hit the model.
- **Google Maps searches per month**: lead finding stops at this number until the month rolls over.
- The page shows today's Neurons against the 10,000 free, Bob answers today, 30-day calls and estimated dollars by feature, and the Maps counter.

## The "runs on free" configuration (what is live now)

1. Workers Paid ($5) — the one bill. (Workers Free would also run the site, but the cron, D1 limits and the 10 ms CPU cap make it fragile; $5 is the floor.)
2. Bob on Llama 3.1 8B fast, 300 answers/day ceiling → 0 Neurons billed.
3. No OpenAI key.
4. Device voices (free). Optional: Azure F0 for the Nigerian voice, still $0.
5. Maps capped at 900/month → $0.
6. Resend/Gmail inside free tiers.

Expected total: **$5/month** plus Paystack's cut of client payments.

## If you want the smarter brain

Set the model to Llama 3.3 70B. At ~140 Neurons per answer the first ~70 answers a day are free and a busy day of 300 answers costs about $0.35. OpenAI would cost more and bill separately; the only reason to use it is Studio drafting quality (proposals, content), not Bob.
