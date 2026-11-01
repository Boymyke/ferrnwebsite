# Which hosted systems Ferrn should sell first: evidence and recommendation

Prepared for Ferrn Digital Agency (ferrnagency.com), 1 November 2026.

Exchange rate used: about **₦1,333 to $1** (NFEM, mid-October 2026) [S1]. All $ prices are rounded.

How to read this report: every section separates **Facts** (with a source tag such as [S7]; the Sources section at the end has the links) from **Ferrn's read** (my inference, which is not sourced and should be tested). Where a source is a vendor blog or a promotional page, I say so. Treat those as weak evidence.

---

## 1. Bottom line

| Rank | Product | Original plan | Verdict |
|---|---|---|---|
| **1** | **Developer Sales & Subscriber Portal**: WhatsApp lead desk, instalment ledger, buyer portal with progress updates | (new) | **Build first** |
| **2** | **Shortlet Direct-Booking Desk**: booking site, Paystack, caution fee, WhatsApp check-in | (new) | **Build second, fastest to ship** |
| **3** | **Clinic Front Desk**, narrowed to outpatient and specialty clinics and labs | Clinic Front Desk | **Keep, but narrow it** |
| Runner-up A | Salon, spa and aesthetics booking with deposits (same engine as #2 and #3) | — | Add-on skin later |
| Runner-up B | Residential estate levy and visitor-access desk | — | Pilot only if a buyer pulls |
| Runner-up C | Restaurant WhatsApp ordering (commission-free direct channel) | — | Custom jobs only |
| Dropped | School Admissions Portal | School Admissions | **Drop** (crowded, free tiers) |
| Dropped | Logistics Quote & Track | Logistics | **Drop as a product** (weak pull, sector in retreat) |

**Why these three.** Each one meets four tests:
1. The buyer already pays a lot for the problem (Airbnb's 15.5% fee, lost diaspora instalment buyers, missed clinic slots).
2. WhatsApp plus Paystack is the natural workflow.
3. No naira-priced, WhatsApp-native incumbent owns the niche.
4. Ferrn can ship it on Workers + D1 in 3 to 7 weeks.

The three also share about 70% of their code: a calendar or slot engine, a payment-schedule engine, WhatsApp utility templates, and a portal.

---

## 2. The market evidence that shapes every choice

### 2.1 Who actually adopts software in Nigeria

**Facts**
- Nigeria has about **39.65 million MSMEs** (SMEDAN), most of them informal [S2].
- In the Moniepoint 2025 informal-economy report:
  - **44%** of informal businesses earn under ₦20,000 a day.
  - Only **16%** get more than half their revenue digitally.
  - **38%** keep their books in their heads [S3].
- In the PwC 2024 MSME survey (557 firms):
  - **88%** use smartphones, **19%** use cloud services, **14%** use specialised software, and **7%** have an online store.
  - **WhatsApp Business (23%)** is the top marketing channel, ahead of Facebook (19%) and Instagram (15%).
  - **67%** reported lower demand over the past two years [S4].
- In the GIZ/DTC study of 1,811 MSMEs in 10 states, the top pains were rising input, logistics and energy costs (**72%**) and inflation (**59%**). Lack of software was not among them [S5].
- Accion CFI (20,000 MSEs, including Lagos) found that digital-tool users were up to **10% more likely** to report revenue growth, but usage stays low [S6].

**Ferrn's read.** The mass market of micro-traders cannot pay ₦50k a month or more. Bumpa already serves them at ₦5k to ₦25k a month [S7]. Ferrn should sell to **formal, cash-rich, high-ticket businesses**, where one saved transaction pays for a month of software: property developers, shortlet operators, and private clinics. Do not compete with Bumpa or Kippa-style mass tools.

### 2.2 WhatsApp is the operating system, and Meta has just changed the economics

**Facts**
- **Reach.** WhatsApp is installed on **95%** of surveyed Nigerian smartphones (Orange/KPMG Smartphone Study 2025) [S8]. One article cites **52.47 million** WhatsApp Business app downloads in Nigeria, the most in Africa [S9].
- **Meta's footprint.** A Meta-commissioned Public First report says **14 million** Nigerian SMEs used Meta apps in 2025, and **81%** of online businesses say the apps widened their customer base [S10]. Meta funded this report.
- **Per-message pricing.** Meta has charged **per delivered message** since 1 July 2025 [S11].
- **October 2026 changes:**
  - Service replies are free only for the **first 1,000 per number per month**.
  - Utility templates sent inside the 24-hour window are now charged.
  - Unless a payment method is on file, service messages beyond the free 1,000 are not delivered [S11][S12].
- **Nigeria rates (USD)** [S12]:

  | Message type | USD | Approx. NGN |
  |---|---|---|
  | Marketing | **$0.0516** | ~₦69 |
  | Utility | **$0.0067** | ~₦9 |
  | Authentication | **$0.0067** | ~₦9 |
  | Service (after free tier) | **$0.0067** | ~₦9 |

  Meta does not bill in NGN [S11].
- **API onboarding.** It needs CAC registration, Meta business verification (typically **5 to 10 business days**) and a +234 number that is not already on WhatsApp [S13]. Large Nigerian firms such as GIG Logistics, Kwik, Paystack and OPay already use the API [S13].
- **Meta's free AI agent.** In 2026 Meta launched a free **Business AI agent** for WhatsApp Business worldwide. It reportedly lacks local commerce workflows such as payments, and Meta does not allow general-purpose chatbots on the API [S9].

**Ferrn's read**
- **Do not sell "a WhatsApp chatbot".** Meta now gives FAQ bots away free, and Fiverr is full of Nigerian WhatsApp-bot gigs [S14]. Ferrn should sell **the system of record behind WhatsApp**: calendar, ledger, receipts, portal and payment reconciliation, with WhatsApp as the notification and intake layer.
- **Message cost is small** if the design relies on utility templates. Utility at ~₦9 means 2,000 reminders cost about ₦18k a month.
- **Avoid marketing broadcasts** inside the subscription (~₦69 each). Pass them through at cost.
- Ferrn should onboard each client's own WhatsApp Business Account (WABA) through Meta Embedded Signup, with the **client's card in Meta Billing**, so that FX and message costs never sit on Ferrn's books.

### 2.3 Payments: Paystack makes the money maths work

**Facts.** Paystack fees in Nigeria [S15]:

| Channel | Fee |
|---|---|
| Local transactions | **1.5% + ₦100, capped at ₦2,000** (₦100 waived under ₦2,500) |
| International cards | **3.9% + ₦100** |
| Dedicated Virtual Accounts (bank transfers) | **1%, capped at ₦300** |

Settlement is in naira by default, with a USD-settlement pilot [S15].

**Ferrn's read.** The ₦2,000 cap and the ₦300 transfer-account cap are the commercial heart of products #1 and #2:
- A ₦450,000 shortlet stay costs at most ₦2,000 through Paystack, against about ₦69,750 at Airbnb's 15.5%.
- A ₦2m instalment paid by transfer to a subscriber's own dedicated virtual account costs ₦300 and reconciles itself.

### 2.4 Pricing sensitivity and what has failed

**Facts**
- **Zoho** had to re-price for Nigeria after the naira fell from about ₦350 to about ₦1,500 per dollar in under two years. Its Zoho One suite had been about ₦7,500 [S16].
- **Fresha** (salon booking, used in Lagos) dropped its free plan in early 2025. It now charges about **$14.95 per team member per month**, plus a 20% marketplace fee on new clients [S17].
- **Failures and retreats:**
  - **Kobo360** cut at least 30 of 50 Nigeria roles and paused most logistics operations (Nov 2024) [S18].
  - **MVX** (logistics) shut down after naira depreciation and Customs policy swings [S19].
  - **GoLemon** (grocery delivery) shut down in July 2026 after failing to raise [S20].
  - **Kippa**'s agency-banking arm folded in 2023 after devaluation made POS imports unviable [S21].
  - **Edukoya** (edtech) closed in 2025, citing "limited market readiness" [S19].
- **TrackThatRide** (Lagos delivery-tracking SaaS) contacted about 60 logistics operators. About 20 joined the waitlist and only about 5 used the beta meaningfully. The lesson its founder drew was that the product was "nice-to-have, not a must-have" at low volumes [S22].

**Ferrn's read**
- **Price in naira.** Make most of it a **one-off setup fee**, which buyers understand and which de-risks churn. Keep the monthly fee low and explicitly tied to money saved.
- **Avoid hardware and avoid holding customer funds** (the Kippa lesson).
- **Avoid "nice-to-have" dashboards for low-volume operators** (the TrackThatRide lesson).

---

## 3. Primary pick #1: Developer Sales & Subscriber Portal

### Target buyer
Small and mid-size Nigerian property developers and land-banking firms, with 50 to 2,000 "subscribers" paying in instalments. Start in Lagos (Ibeju-Lekki, Lekki, Epe), Abuja and Port Harcourt. Secondary buyers are diaspora-run developers in the UK, US and Canada who sell Nigerian projects.

### The painful job
Two jobs, both currently done badly:
- **Before the sale:** capture and qualify leads that arrive by WhatsApp from ads.
- **After the sale:** track instalments, issue receipts and statements, and keep paying buyers (often abroad) updated without a buyer having to chase.

### Evidence (facts)
- **Diaspora demand.** Developers in Lagos, Abuja and Port Harcourt reportedly attribute **70 to 80%** of sales to diaspora clients. About 30% of remittances (about $6.28bn a year) reportedly go into home purchase or construction [S23].
- **Trust failures:**
  - Diaspora buyers face fake developers and unverifiable approvals.
  - They have relied on photos and videos.
  - Proposed fixes include milestone payments, virtual inspections and real-time project updates [S23].
- **Communication failures:**
  - Nairametrics documents buyers who completed instalments and documentation fees, then heard nothing despite repeated emails [S24].
  - Diaspora investors in a stalled Lekki project say the developer became hostile to enquiries. The matter is now under EFCC investigation [S25].
- **Lead tracking.** Nigerian property deals close mostly over WhatsApp and calls, so developers cannot trace ad spend to sales. Diaspora leads are both high-value and the hardest to trace [S26]. (Source is a vendor blog.)
- **Existing CRMs.** A ThisDay listicle of the "top 5 CRMs for realtors in Nigeria" shows no instalment tracking in any of them. Only one, PropHero, has WhatsApp sharing [S27]. For comparison, European developer CRMs cost about **€500 to €1,500 a month** plus setup [S28] (vendor source).

### Competitors and how Ferrn would differ
- **Generic CRMs** (Zoho, HubSpot, HelloLeads): handle leads, not instalments, receipts or allocation.
- **Portals** (Ownkey, PropHero, B2BBricks): focus on listings and leads.
- **Accounting tools**: no buyer-facing side.
- **Ferrn's difference (inference):** one system covering lead to allocation, which competitors split.
  1. Each subscriber gets a Paystack dedicated virtual account, so transfers auto-match to the right buyer and plot.
  2. Automatic WhatsApp receipts and monthly statements.
  3. A buyer portal (web, no app install) with payment history, documents (contract of sale, allocation letter, survey) and dated site photos and videos.
  4. Diaspora-friendly card payment.
  5. A developer-side "trust page" that the developer can show prospects.

### Realistic price (inference)

| Market | Setup (one-off) | Monthly |
|---|---|---|
| Nigeria | **₦600k to ₦1.2m** (includes data migration from Excel and WhatsApp) | **₦100k** (up to 300 subscribers), **₦200k** (up to 1,000), **₦350k** (up to 3,000) |
| Diaspora developers | **$750** | **$120 to $300** |

- WhatsApp marketing broadcasts are passed through at Meta cost plus 15%.
- Price justification: one recovered diaspora buyer of a ₦15m to ₦40m unit pays for years of the subscription.

### MVP must include
1. Project, plot and unit inventory, with a sold, reserved or available grid to stop double-selling.
2. Subscriber records, KYC uploads (ID, passport photo), and next-of-kin details.
3. Payment plans: deposit, then N instalments with due dates and penalty rules.
4. Paystack dedicated virtual accounts per subscriber, plus a card link. Webhook auto-reconciliation produces a PDF receipt and a WhatsApp utility message.
5. Automated WhatsApp reminders: 3 days before due, on the due day, and when overdue. Plus a monthly statement.
6. Buyer portal (magic-link login) with statement, receipts, documents and progress-photo timeline.
7. Lead desk: a Click-to-WhatsApp ad entry point and a web form, tagged by campaign, with a simple pipeline (new, inspected, reserved, paying).
8. Admin roles (MD, sales, accounts) and an audit log.
9. NDPA-style consent text and data export.

### Ship time (inference)
**5 to 7 weeks** to a pilot with one developer, with a second developer by week 9. The ledger and reconciliation are the hard parts; the portal is simple.

### Risks
- **Reputation.** Ferrn's brand could be tied to a developer who later defaults. Mitigate by vetting clients, keeping the "trust page" factual (payments and photos only, no guarantees), and keeping contract language clear that Ferrn is a software vendor only.
- **Dedicated virtual accounts.** These need Paystack approval for the developer's own account. Ferrn must never hold funds.
- **Sales cycle.** Expect longer cycles and founder-led sales. Sell through realtor networks and Instagram property influencers.
- **Data migration.** Messy legacy Excel files are likely; charge for migration in the setup fee.

---

## 4. Primary pick #2: Shortlet Direct-Booking Desk

### Target buyer
Lagos and Abuja shortlet operators and serviced-apartment managers with 2 to 30 units. Secondary buyers are diaspora owners who run Lagos units remotely through a caretaker.

### The painful job
Take bookings without giving up 15.5% to Airbnb. That means showing live availability, collecting payment and caution fees safely, verifying guests (KYC), and sending check-in instructions. Today this is done through Instagram DMs, WhatsApp haggling and bank-transfer screenshots.

### Evidence (facts)
- **Market size.** Lagos shortlet revenue was an estimated **₦281.03bn in 2025** across **6,398** units analysed, with a projection of about ₦285.5bn for 2026 (Edala report) [S29][S30].
- **Competition.** Supply keeps rising and operators need more aggressive customer acquisition. Some say a unit needs at least 10 booked days a month to stay viable. Banana Island banned shortlets in February 2026 [S31].
- **Diaspora guests.** They were the dominant December 2025 segment, with the longest stays and the highest spend (often ₦3m or more). Typical nightly rates were ₦100k to ₦250k, and refundable caution fees ₦100k to ₦150k [S32].
- **Current operator practice.** Operators list on Airbnb, Booking.com and local portals, and promote on Instagram. They collect ₦100k caution fees and run KYC (ID, purpose of stay) [S33].
- **Fragmentation.** A 2026 Techpoint piece describes bookings scattered across social posts, WhatsApp negotiation and cash, and fake listings [S34].
- **Airbnb fees.** Airbnb moved software-connected hosts to a **15.5% host-only fee** from 27 October 2025. Other hosts followed on 1 December 2025 [S35].

### Competitors and how Ferrn would differ
- **Global PMS and booking engines** (Lodgify, Hostfully, Hospitable): priced in USD, card-centric, and without naira transfer or caution-fee flows.
- **StayAssist**: a marketplace, not a white-label direct channel [S34].
- **Kolonell-type agencies**: custom builds.
- **Ferrn's difference (inference):**
  - The operator's own branded site, with Paystack naira and international cards.
  - Caution fee held as a separate Paystack charge and refunded through Paystack Refunds.
  - Guest ID upload.
  - iCal two-way sync with Airbnb and Booking.com to avoid double-booking.
  - Automated WhatsApp utility messages: confirmation, directions, Wi-Fi and gate codes, checkout reminder, review request.
  - Return-guest discount codes to pull repeat diaspora guests off Airbnb.

### Realistic price (inference)

| Market | Setup (one-off) | Monthly |
|---|---|---|
| Nigeria | **₦150k to ₦300k** (site, photos import, domain, WABA onboarding) | **₦30k** (up to 3 units), **₦60k** (up to 10), **₦100k** (up to 30) |
| Diaspora owners | **$200** | **$29 to $79** |

- Optional success-fee alternative: 3% of direct bookings, which is still 12.5 points cheaper than Airbnb.
- Example maths: three direct bookings a month at ₦300k each save about ₦140k in Airbnb fees, which covers the subscription.

### MVP must include
1. Unit pages, a rate calendar, minimum stay, and seasonal (December) pricing.
2. iCal import and export with Airbnb and Booking.com.
3. Paystack checkout, plus a separate caution-fee charge and a refund flow.
4. Guest KYC upload and ID check by staff.
5. WhatsApp templates: booking confirmed, check-in pack (T-1 day), checkout (T-0), caution-refund notice.
6. Owner dashboard: occupancy, revenue, upcoming arrivals.
7. A caretaker or cleaner view with a turnover checklist.

### Ship time (inference)
**3 to 4 weeks.** This is the simplest of the three. Launching before mid-December 2026 would catch the tail of "Detty December"; otherwise target the Easter and summer diaspora seasons.

### Risks
- **Airbnb dependence.** Operators still need Airbnb for discovery, so position Ferrn as "convert repeat and Instagram guests to direct", not "leave Airbnb".
- **Sync limits.** iCal sync lag can cause double-bookings. Mitigate with a short hold window and manual confirmation.
- **Regulation.** Estate-level bans and possible Lagos registration or tax rules may shrink the market.
- **Small budgets.** Many operators are small, so keep onboarding self-serve.

---

## 5. Primary pick #3: Clinic Front Desk, kept but narrowed

### Target buyer
Private outpatient and specialty practices where appointments drive revenue: dental, eye, fertility and IVF, physiotherapy, dermatology and aesthetics, paediatric clinics, and diagnostic labs and imaging centres. Start in Lagos, Abuja and Port Harcourt. Do **not** target general hospitals that need a full EMR or HMIS.

### The painful job
Answer "can I book?", "how much?" and "is my result ready?" on WhatsApp all day, cut no-shows, and collect deposits. This is not about replacing the clinic's records system.

### Evidence (facts)
- **Helium Health**, the best-known Nigerian incumbent, sells EMR and HMIS. It reports over 1,000 facilities across 7 countries and "over 300" onboarded in Nigeria [S36][S37]. Global vendors such as MocDoc also market full HMS products in Lagos [S38].
- **Manual operations.** Most facilities still rely on manual documentation, and manual billing causes revenue leakage [S37].
- **High-end price anchor.** A Lagos-focused vendor offers an AI front office for clinics (WhatsApp and calls, booking, reminders, results desk, triage routing) at **₦1,200,000 a month** [S39]. This is an advertised offer, not proof of sales.
- **No-show claims.** A vendor blog claims no-shows fell from 28% to 8% after booking and deposits. It cites no source and is West-Africa generic [S40].
- **Regulation.** Under the NDPA, medical records and lab results are **sensitive personal data**. Larger clinics may need NDPC registration and a data protection officer, and vendors such as EMR and cloud providers must comply too [S41]. The NDPC opened a probe into 1,369 organisations in August 2025 [S42].

### Competitors and how Ferrn would differ
- **HMS/EMR vendors** (Helium, MocDoc and others): heavy and record-centric.
- **AI-front-office agencies** (MetaSolves): premium-priced.
- **Generic WhatsApp bot freelancers**: no calendar or ledger behind the bot.
- **Ferrn's difference (inference):**
  - A narrow, cheap **front-desk layer** that sits beside whatever records system the clinic uses, including paper.
  - Doctor and room calendars.
  - WhatsApp booking menu (not free-form AI), deposit via Paystack, utility reminders, a "result ready, collect or download" notice, and HMO/self-pay tagging.
  - Priced at 10 to 15% of the ₦1.2m anchor.

### Realistic price (inference)

| Market | Setup (one-off) | Monthly |
|---|---|---|
| Nigeria | **₦250k to ₦400k** | **₦60k** (1 to 3 practitioners), **₦120k** (4 to 10), **₦200k** (lab or multi-branch) |
| Diaspora-owned clinics | **$300** | **$50 to $150** |

- Include up to about 2,000 utility messages a month (about ₦18k at Meta rates); bill extra above that.

### MVP must include
1. Practitioner and service catalogue with durations and prices.
2. Slot engine with buffer times.
3. WhatsApp flow: book, reschedule or cancel through list and button messages.
4. Paystack deposit or prepayment (optional per service).
5. Reminders at 24 hours and 2 hours.
6. Reception dashboard: today's queue, walk-in add, mark attended or no-show.
7. Results-ready notice that carries **no clinical content** in the WhatsApp message, only a secure link with OTP.
8. Escalation to a human, and a ban on medical advice in the bot.
9. Consent capture, audit log, data export and deletion. Write a data processing agreement template.

### Ship time (inference)
**4 to 5 weeks**, reusing the calendar and WhatsApp modules from #2.

### Risks
- **Health-data compliance.** This is the heaviest compliance load of the three. Get a Nigerian data-protection lawyer to review the data processing agreement and consent text.
- **Data location.** Confirm where D1 data sits (use location hints and jurisdiction settings) and document the cross-border safeguards.
- **Buying behaviour.** Clinics buy on referral and want onsite training, so budget for it.
- **Competitive pull.** EMR vendors may bundle booking. The defence is speed, price and a WhatsApp-native experience.

---

## 6. Runners-up

### A. Salon, spa and aesthetics booking with deposits
- **Evidence:** Fresha is active in Lagos but now costs about $14.95 per member per month (about ₦100k a month for a 5-chair salon), plus 20% on new marketplace clients [S17]. Goldie booking pages are also used by Lagos beauty businesses [S43].
- **Ferrn's read:** This is the clinic engine re-skinned at **₦15k to ₦40k a month** with a ₦50k setup. Do it after #2 and #3, as near-zero marginal work. Budgets are thin and churn will be high, so it is not a lead product.

### B. Residential estate levy and visitor-access desk
- **Evidence:**
  - Estates still run on spreadsheets and ledgers, and billing at scale is hard [S44].
  - Gatepass described slow gate entry, weak paper records and resident distrust of estate management [S45].
- **Ferrn's read:**
  - Real pain, but the market is crowded with apps (Gatepass, Utilit, AccessCode-type apps).
  - Selling to resident associations is political, with committee decisions and treasurer turnover.
  - Pilot only if an estate approaches Ferrn. Pricing would be about ₦500 to ₦1,000 per house per month.

### C. Restaurant WhatsApp ordering
- **Evidence:** Chowdeck charges restaurants **15 to 20%** commission and handled about 2m orders a year by late 2025 [S46].
- **Ferrn's read:**
  - Restaurants want a direct channel, but Chowdeck also brings demand and riders.
  - Many cheap WhatsApp-ordering gigs exist [S14], and Bumpa covers retail storefronts [S7].
  - Sell only as a custom job.

---

## 7. What to do with the original three

| Original product | Decision | Why (facts first, then inference) |
|---|---|---|
| **Clinic Front Desk** | **Keep, change the scope** | **Facts:** EMR and HMIS already has funded incumbents (Helium, with 300+ Nigerian facilities) [S37]. A front-desk offer exists at ₦1.2m a month [S39]. **Inference:** win on a narrow, cheaper front-desk layer for appointment-driven specialty clinics and labs, not on records. |
| **School Admissions Portal** | **Drop** | **Facts:** At least 8 Nigerian school systems were compared in August 2026 [S47]. Nersapp lists admissions in a **free** core platform [S47]. SchoolViewers offers online admission with a free tier for up to 100 students [S48]. Others (SchoolKit, Akada, Edunile, SAFSIMS, Edves) bundle fees, Paystack and WhatsApp reminders [S47]. Edtech has also seen closures such as Edukoya [S19]. **Inference:** a standalone admissions portal is a feature that rivals give away free. Admissions are also seasonal, so revenue would be lumpy. Build one only as a custom website job. |
| **Logistics Quote & Track** | **Drop as a product** | **Facts:** a Lagos tracking SaaS saw about 5 meaningful users out of about 60 operators approached [S22]. Kobo360 retreated [S18] and MVX shut down [S19]. Big players (GIG, Kwik) already run WhatsApp API in-house [S13]. **Inference:** small dispatch firms find manual WhatsApp "good enough" at their volumes. The willing payers are already served or build in-house. Keep it as a custom build for a named client only. |

---

## 8. Shared build plan on Ferrn's stack (inference)

Ferrn's stack is Cloudflare Workers + D1, the WhatsApp Cloud API and Paystack.

**Build these core modules once (about weeks 1 to 3):**
1. **Tenant and roles.** One D1 database per tenant, or a tenant_id column, with audit log.
2. **WhatsApp module:**
   - Embedded Signup onboarding, so the client's WhatsApp account is billed to the client's card.
   - Webhooks into a Worker, a template registry, and a message log.
   - Use **interactive list and button messages** and WhatsApp Flows, not open-ended AI. This stays inside Meta's API chatbot policy and keeps the cost to ~₦9 utility messages.
3. **Paystack module.** Checkout, dedicated virtual accounts, refunds, a webhook verifier, and PDF receipts (generated in a Worker and stored in R2).
4. **Scheduling engine.** Covers both nightly stays (shortlets) and slots (clinics and salons), with iCal import and export.
5. **Payment-schedule engine.** Instalments, due dates, reminders and penalties (for developers).
6. **Portal shell.** Magic-link and OTP login for end customers.

**Sequence:**

| Weeks | Product | Milestone |
|---|---|---|
| 1 to 4 | Shortlet Desk (#2) | First 3 paying operators (quick revenue, demo asset) |
| 4 to 8 | Clinic Front Desk (#3) | Reuses scheduling; 2 pilot clinics |
| 5 to 11 | Developer Portal (#1) | Runs in parallel; longest sales cycle, so start selling it in week 1 using mock-ups |

**Unit economics check.** For a 10-unit shortlet operator, a 6-practitioner clinic or a 500-subscriber developer, Meta, Paystack-side and Cloudflare costs together should stay well under 15% of the monthly fee. That assumes marketing broadcasts are passed through at cost.

---

## 9. Validation steps before writing much code (inference)
1. **Shortlets:** DM 30 Lagos shortlet operators found through Instagram and Airbnb. Offer a ₦150k founding setup in exchange for a case study. Target 3 deposits in 2 weeks.
2. **Developers:** call 15 developers selling Ibeju-Lekki and Epe land on instalments. Ask how many subscribers they have, how they issue receipts today, and how many staff hours that takes. Pre-sell 1 pilot at ₦600k.
3. **Clinics:** visit 10 dental, eye or physio clinics and 5 labs. Count WhatsApp messages a day and no-shows a week.
4. **Kill rule:** if fewer than 2 of 10 prospects pay a deposit, park that vertical. TrackThatRide showed that waitlist sign-ups are not demand [S22].

---

## Sources

- [S1] [Dollar to Naira Today, Oct 14, 2026: ₦1,333 on NFEM (WithinNigeria)](https://www.withinnigeria.com/2026/10/14/dollar-to-naira-today-october-14-2026-naira-steady-at-%E2%82%A61333-on-nfem-as-black-market-trades-near-%E2%82%A61373/?amp=1)
- [S2] [Over 39.65m MSMEs operate in Nigeria, says report (Guardian)](https://guardian.ng/business-services/over-39-65m-msmes-operate-in-nigeria-says-report)
- [S3] [Nigeria's informal businesses: 2025 revenue and profit, Moniepoint report (Techeconomy)](https://techeconomy.ng/nigerias-informal-businesses-2025-revenue-profit-moniepoint-report/)
- [S4] [PwC Nigeria MSME Survey Report 2024 (PDF)](https://pwc.com/ng/en/assets/pdf/pwc-msme-survey-report-2024.pdf)
- [S5] [Characterisation and Digital Maturity Assessment of MSMEs in Nigeria, GIZ/DTC (ThisDay)](https://www.thisdaylive.com/2025/05/26/characterisation-and-digital-maturity-assessment-of-msmes-in-nigeria-by-giz-digital-transformation-center-nigeria/)
- [S6] [Digital adoption still low among 1.7m small businesses, Accion CFI (Techeconomy)](https://techeconomy.ng/digital-adoption-still-low-among-1-7m-small-businesses)
- [S7] [Bumpa pricing](https://getbumpa.com/pricing)
- [S8] [WhatsApp installed on 95% of Nigerian smartphones, Orange/KPMG study (BrandSpur)](https://brandspurng.com/2026/09/26/whatsapp-installed-on-95-of-nigerian-smartphones-study-finds/)
- [S9] [WhatsApp now has an AI Business Agent: what African SMEs need to know (Innovation Village)](https://innovation-village.com/whatsapp-now-has-an-ai-business-agent-here-is-what-african-smes-need-to-know/)
- [S10] [81% of Nigerian businesses say Meta expanded their customer base (BrandSpur)](https://brandspurng.com/2026/05/22/81-of-nigerian-businesses-say-meta-has-expanded-their-customer-base-as-new-research-values-platforms-economic-contribution-at-820-million/)
- [S11] [Pricing on the WhatsApp Business Platform (Meta for Developers)](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing)
- [S12] [WhatsApp API Pricing Nigeria, rates effective October 1, 2026 (ChatMaxima)](https://chatmaxima.com/whatsapp-api-pricing/nigeria/)
- [S13] [WhatsApp Business API Nigeria: Setup Guide 2026 (ChatDaddy)](https://chatdaddy.tech/blog/whatsapp-business-api-nigeria-setup)
- [S14] [Example Fiverr gig: WhatsApp food ordering system for restaurants](https://fiverr.com/tunmise_dev/l-build-a-whatsapp-food-ordering-system-for-your-restaurant)
- [S15] [Paystack pricing](https://paystack.com/pricing)
- [S16] [Zoho price increase for Nigerians (Techpoint Africa)](https://techpoint.africa/2024/07/04/zoho-price-increase-nigerians/)
- [S17] [Fresha pricing (Pabau)](https://pabau.com/blog/fresha-pricing/)
- [S18] [Kobo360 layoff (TechCabal)](https://techcabal.com/2025/01/20/kobo360-layoff/)
- [S19] [The Nigerian startup graveyard (Techeconomy)](https://techeconomy.ng/the-nigerian-startup-graveyard)
- [S20] [Nigerian startup GoLemon shuts down, 33 jobs affected (Nairametrics)](https://nairametrics.com/2026/07/30/nigerian-startup-golemon-shuts-down-33-jobs-affected/)
- [S21] [The unraveling of Target Global-backed Kippa (Launch Base Africa)](https://launchbaseafrica.com/2025/08/18/founders-exit-website-down-the-unraveling-of-target-global-backed-kippa-that-raised-over-14m/?amp=1)
- [S22] [My first 60 potential customers all said yes, TrackThatRide (Peerlist)](https://peerlist.io/iamrazaq/articles/my-first-60-potential-customers-all-said-yes-then-they-all-d)
- [S23] [Diasporan investors drive growth, expose fault lines in real estate sector (Guardian)](https://guardian.ng/property/diasporan-investors-drive-growth-expose-fault-lines-in-real-estate-sector/)
- [S24] [Pay now, wait later: delays and shifting promises in Lagos property schemes (Nairametrics)](https://nairametrics.com/2025/07/29/pay-now-wait-later-inside-the-delays-and-shifting-promises-in-lagos-property-schemes/)
- [S25] [Diaspora investors drag Revolutionplus Property over stalled Lekki project (AllAfrica/ThisDay)](https://allafrica.com/stories/202601290263.html)
- [S26] [Why Nigeria property developers can't trace ad spend to a single sale (Ownkey)](https://ownkey.com/ng/blog/why-nigeria-property-developers-cant-trace-ad-spend-to-sales)
- [S27] [Top 5 best CRM for realtors in Nigeria (ThisDay)](https://www.thisdaylive.com/2026/01/01/top-5-best-crm-for-realtors-in-nigeria/)
- [S28] [Property developer off-plan sales software cost 2026 (Kolonell)](https://kolonell.com/en/blog/property-developer-off-plan-sales-software-cost-2026)
- [S29] [Lagos shortlet market revenue hits ₦281.03 billion in 2025 (Nairametrics)](https://nairametrics.com/2026/03/12/lagos-shortlet-market-revenue-hits-n281-03-billion-in-2025-report/)
- [S30] [Lagos shortlet market growth slows to ₦285.5bn amid ban, tax changes (BusinessDay)](https://businessday.ng/companies/article/lagos-shortlet-market-growth-slows-to-n285-5bn-amid-ban-tax-changes/)
- [S31] [Lagos shortlet boom puts operators under pressure as supply keeps rising (Nairametrics)](https://nairametrics.com/2026/09/01/lagos-shortlet-boom-puts-operators-under-pressure-as-supply-keeps-rising/)
- [S32] [Lagos short-stay apartments record strong diaspora-led demand during 2025 Detty December (Nairametrics)](https://nairametrics.com/2026/01/09/lagos-short-stay-apartments-record-strong-diaspora-led-demand-during-2025-detty-december)
- [S33] [Short-term rentals are booming in Lagos: owners explain how it is done (Nairametrics)](https://nairametrics.com/2024/09/20/short-term-rentals-are-booming-in-lagos-property-market-owners-explain-how-it-is-done)
- [S34] [StayAssist emerges as solution to short-let fraud and fragmentation (Pulse/Techpoint)](https://www.pulse.bot/entrepreneurship/news/stayassist-emerges-as-nigerias-trusted-solution-to-short-let-fraud-and-market-fragmentation-14eca7cd-42f4-4ebe-b61d-97d32406a013)
- [S35] [Airbnb simplified pricing: 15.5% host-only fee (Hostfully)](https://www.hostfully.com/blog/airbnb-simplified-pricing/)
- [S36] [Helium Health vs Reliance HMO (Techeconomy)](https://techeconomy.ng/helium-health-vs-reliance-hmo-nigeria-healthtech)
- [S37] [Ducit Blue on Helium Health](https://ducitblue.com/?p=4697)
- [S38] [Lagos Nigeria hospital management software (MocDoc)](https://mocdoc.com/blog/lagos-nigeria-hospital-management-software)
- [S39] [MetaSolves: AI front office for Nigerian clinics](https://metasolves-offers.pages.dev/ng/clinics/bookings/)
- [S40] [Clinic appointment booking app Lagos 2026 (Kolonell)](https://kolonell.com/en/blog/clinic-appointment-booking-app-lagos-2026)
- [S41] [Patient data, real liability: what the NDPA means for healthcare SMEs (SCP Law)](https://resource.scp-law.com/2026/07/22/patient-data-real-liability-what-the-ndpa-means-for-healthcare-smes/)
- [S42] [NDPC launches probe into 1,369 Nigerian companies over data privacy violations (Nairametrics)](https://nairametrics.com/2025/08/25/ndpc-launches-probe-into-1369-nigerian-companies-over-data-privacy-violations)
- [S43] [Example Goldie booking page, Lagos beauty business](https://book.heygoldie.com/By-reerabeauty)
- [S44] [Utilit targets transformation of Nigeria's estate management system (ThisDay)](https://www.thisdaylive.com/2025/10/20/utilit-targets-transformation-of-nigerias-estate-management-system)
- [S45] [Nigeria's Gatepass is helping residential communities manage themselves better (Disrupt Africa)](https://old.disruptafrica.com/2020/09/23/nigerias-gatepass-is-helping-residential-communities-manage-themselves-better/)
- [S46] [Startup Reality Check #13: Chowdeck (Substack)](https://favourt.substack.com/p/startup-reality-check-13-chowdeck)
- [S47] [Best school management software Nigeria 2026 (HeadTeacher.ng)](https://www.headteacher.ng/best-school-management-software-nigeria-2026/)
- [S48] [Top 5 school management systems in Nigeria (Nairametrics)](https://nairametrics.com/2026/08/19/top-5-school-management-systems-in-nigeria-what-schools-get-for-their-money/)

**Source-quality notes**
- Vendor or promotional sources: S13, S26, S28, S38, S39, S40, S47 (HeadTeacher.ng partners with Nersapp) and S48 (uneven coverage favouring SchoolViewers).
- Meta-commissioned research: S10.
- I excluded a church-management article I found because its statistics were unsourced and sponsor-driven.
- Meta's Nigeria rates come from a BSP mirror of the rate card (S12). Verify them against Meta's own CSV before quoting prices to clients.
