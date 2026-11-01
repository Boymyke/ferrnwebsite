# WhatsApp bot

The bot runs on the **official WhatsApp Cloud API** (Meta), so the number can't be banned for using it. It lives inside the same Worker as the website.

## What it does on its own

| When | It sends | Type |
|---|---|---|
| Someone messages the Ferrn WhatsApp number | An instant AI reply, using the same knowledge and prices as the website assistant, in the language they wrote in (English, Pidgin, Yorùbá, Igbo, Hausa…) | Free reply |
| They ask for a person ("speak to someone", "agent"…) or send a voice note or image | "A team member will take over". The chat is flagged **Needs you** in Studio and the bot stops replying in it | Free reply |
| Someone ticks "Send me updates on WhatsApp" on a website or marketplace form | Instant "we've got your enquiry", then polite follow-ups on day 2 and day 6. These **stop automatically the moment they reply** | Templates |
| A meeting is booked in Studio for a lead who opted in | Reminders 24 hours and 1 hour before | Template |
| A quote is marked **Sent** in Studio for a lead who opted in | The quote link | Template |
| A marketplace payment succeeds | A thank-you and next steps | Template |
| Someone replies **STOP** | Nothing more is sent automatically. **START** turns messages back on | — |

Cold leads from Google Maps or LeadsHunter are **never** messaged automatically. WhatsApp only allows business-started messages to people who opted in, and breaking that rule gets numbers banned. For cold leads, use LeadsHunter email, or tap "WhatsApp" in a lead's drawer to message them yourself from your phone.

**Studio → WhatsApp** shows every chat:
- "Needs you" chats come first.
- **Take over** pauses the bot in that chat; **Hand back to bot** resumes it.
- You can type a reply while the 24-hour window is open, or send an approved template once it has closed.

## One-time setup (about 30 minutes)

You need: a phone number that is **not** already on WhatsApp (a new SIM is easiest; it only has to receive one SMS or call), a Facebook account, and a card for Meta billing.

1. **Create the app.** Go to <https://developers.facebook.com/apps> → **Create app** → Use case **"Connect with customers through WhatsApp"** → name it `Ferrn WhatsApp` → link or create the **Ferrn Digital Agency** business portfolio.
2. **Add the number.** In the app, open **WhatsApp → API Setup → Add phone number**:
   - Display name: `Ferrn Digital Agency`. Category: Professional services.
   - Verify the SIM by SMS.
   - Copy the **Phone number ID** (a long number, *not* the phone number itself).
3. **Make a permanent token.** Go to **Business settings** (<https://business.facebook.com/settings>) → **Users → System users** → **Add** a user called `ferrn-bot` with the Admin role.
   - **Add assets** → your app → Full control.
   - **Generate token**: pick the app, set expiry to **Never**, and tick the permissions `whatsapp_business_messaging` and `whatsapp_business_management`. Copy the token.
4. **Get the app secret.** In the app, go to **App settings → Basic** → **App secret** → Show → copy it.
5. **Add four secrets in Cloudflare.** Workers & Pages → `ferrn` → Settings → Variables and secrets:
   - `WHATSAPP_TOKEN` = the token from step 3
   - `WHATSAPP_PHONE_NUMBER_ID` = the ID from step 2
   - `WHATSAPP_APP_SECRET` = the secret from step 4
   - `WHATSAPP_VERIFY_TOKEN` = any random phrase you make up (used once in step 6)
6. **Connect the webhook.** In the app, go to **WhatsApp → Configuration → Webhook → Edit**:
   - Callback URL: `https://www.ferrnagency.com/api/whatsapp/webhook`. Until the domain moves, use the workers.dev URL instead.
   - Verify token: the same phrase as `WHATSAPP_VERIFY_TOKEN`.
   - Click **Verify and save**, then under **Webhook fields** subscribe to **messages**.
7. **Add billing.** WhatsApp Manager → **Payment settings** → add a card. In Nigeria, replies inside 24 hours are free (up to 1,000 a month), utility templates cost about $0.007 each, and marketing templates about $0.05.
8. **Create the templates** below in WhatsApp Manager → **Message templates → Create**. Names, categories and wording must match exactly. Language: English. Approval usually takes minutes.

## Templates

### `ferrn_enquiry_received` · UTILITY

```
Hi {{1}}, thanks for contacting Ferrn Digital Agency. We have your enquiry about {{2}} and a team member will reply here within one working day. Reply STOP to stop WhatsApp messages.
```

Sample values: {{1}} = Ada · {{2}} = a clinic website

### `ferrn_follow_up` · MARKETING

```
Hi {{1}}, Michael from Ferrn here. Just checking in on {{2}}. Would a 15-minute call this week help? You can pick a time here: {{3}}. Reply STOP to opt out.
```

Sample values: {{1}} = Ada · {{2}} = your clinic website · {{3}} = https://cal.com/ferrn-agency

### `ferrn_meeting_reminder` · UTILITY

```
Hi {{1}}, a reminder of your call with Ferrn on {{2}}. Join here: {{3}}. Reply to this message if you need to reschedule.
```

Sample values: {{1}} = Ada · {{2}} = Tue 4 Nov, 10:00 (Lagos) · {{3}} = https://meet.google.com/abc-defg-hij

### `ferrn_quote_sent` · UTILITY

```
Hi {{1}}, your Ferrn quote {{2}} is ready. You can view and accept it here: {{3}}. Reply here with any questions.
```

Sample values: {{1}} = Ada · {{2}} = FQ-2026-004 · {{3}} = https://www.ferrnagency.com/q/abc123

### `ferrn_payment_received` · UTILITY

```
Hi {{1}}, we have received your payment for {{2}}. Thank you! Your project lead will message you here within one working day with next steps.
```

Sample values: {{1}} = Ada · {{2}} = Clinic Front Desk (Launch plan)

## Test it

1. From your personal WhatsApp, send "Hi" to the new number. The bot should answer within a few seconds, and the chat appears in Studio → WhatsApp.
2. Send "Can I speak to someone?". The chat shows **Needs you** and the bot stops replying.
3. On the website, submit the contact form with your number and the WhatsApp box ticked. The "enquiry received" template arrives straight away.
