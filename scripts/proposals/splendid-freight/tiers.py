# Splendid Freight proposal: options, line-by-line breakdown, free website.
# Each line: (feature, what you get, how it helps, value in naira)

T1 = [  # Option 1: Operations Portal (includes the CRM pack)
    ('Shipment control board', 'Every air, ocean and road shipment in one list, with status, owner and next step.', 'Answer "where is it?" in seconds, without digging through email.', 1200000),
    ('Nigerian clearance steps', 'Form M, PAAR, duty assessment and payment, examination, release, TDO or NAHCO/SAHCO gate pass, exit and delivery.', 'See exactly which customs step each shipment is waiting on.', 900000),
    ('Customer tracking link', 'A private link and QR code per shipment that shows the customer every update your team posts.', 'Fewer "any update?" calls and emails for your team.', 700000),
    ('QR labels and phone updates', 'Print a label per shipment. Staff scan it at the port, airport or warehouse, pick the step and add a photo.', 'Updates happen on the spot, with photo proof, in under a minute.', 800000),
    ('Shipment documents', 'Bill of lading, airway bill, invoices, packing list, PAAR and proof of delivery stored on each shipment.', 'No more searching inboxes for the right document.', 500000),
    ('ATM job tracker', 'Decommissioning, relocation from branch A to B, staging, civil works, cannibalisation and refurbishment, each with its own checklist.', 'Every ATM job follows the same steps, whoever is on site.', 1000000),
    ('ATM register and chain of custody', 'A QR-tagged record per machine: bank, branch, serial, condition photos, parts harvested and sign-off at each handover.', 'A clean audit trail to show banks, from pickup to installation.', 900000),
    ('Website editor', 'Change services, pages, photos and blog posts, and read every website enquiry, from the portal.', 'Keep the website current without calling a developer.', 400000),
    ('Customer CRM', 'Every customer company, contact, shipment, quote, note and follow-up in one place.', 'Anyone on the team can pick up a customer without a handover.', 700000),
    ('Invoices', 'Create invoices from a shipment and see what is paid, part-paid or overdue.', 'Bill faster and see who owes what at a glance.', 600000),
    ('Expense tracker', 'Log freight, duty, port charges, trucking and agent fees against each shipment or ATM job.', 'Know the real profit on every job, not just the revenue.', 600000),
    ('Zoho Books sync', 'Customers, invoices and payments move both ways between the portal and Zoho Books.', 'No double entry, and your accountant keeps working in Zoho.', 700000),
    ('Bulk data migration', 'Your existing customers, past shipments and invoices imported from Zoho Books, Excel and Outlook contacts.', 'Day one starts with your history, not an empty system.', 500000),
]
T2 = [  # Option 2 adds: B2B customer portal
    ('Customer accounts', 'Each business customer gets its own login, with several staff users per company.', 'Customers serve themselves, at any hour.', 1000000),
    ('Shipment request form', 'Origin, destination, weight, dimensions, commodity, pickup address and documents in one simple form.', 'Requests arrive complete, so quotes go out faster.', 900000),
    ('ATM support requests', 'Banks request decommissioning, relocation, staging or refurbishment by branch and machine.', 'ATM work comes in structured, ready to schedule.', 800000),
    ('Room for new services', 'Add warehousing, charter or haulage requests later without a rebuild.', 'The portal grows with the business.', 500000),
    ('Tracking inside the account', 'All shipments and ATM jobs, their timelines and documents, ready to download.', 'One place for customers to see everything they have with you.', 900000),
    ('Quotes in the account', 'Your team sends the quote to the account and the customer accepts it online. Payment stays offline.', 'Approvals in clicks, not email chains, and every quote on record.', 800000),
    ('Automatic email and WhatsApp updates', 'Each step triggers a message, and late steps alert your team and the customer.', 'Customers hear about delays from you first.', 700000),
    ('Order history and repeat orders', 'Past shipments with one-click repeat for regular lanes.', 'Makes it easy for customers to book with you again.', 400000),
]
T3 = [  # Option 3 adds: B2C app, payments, analytics
    ('B2C sign-up', 'Individuals, such as online shoppers and diaspora senders, create their own accounts.', 'Opens a new customer group without extra staff.', 900000),
    ('Mobile app', 'Installable app on Android and iPhone, with push notifications for every update.', 'Your brand on the customer\'s home screen.', 1800000),
    ('Instant quote calculator', 'Rate tables by lane, mode and weight give standard shipments a price on the spot.', 'Win price shoppers before they ask a competitor.', 1200000),
    ('Online payments', 'Paystack card, bank transfer and USSD in naira, plus card payments in USD and GBP.', 'Get paid before the cargo moves.', 1000000),
    ('Quote and payment tracking', 'Every quote from requested to sent, accepted, invoiced and paid, with reminders for unpaid ones.', 'Nothing slips between the quote and the cash.', 900000),
    ('Cargo insurance at checkout', 'Declared value and cover option on each booking, with the policy stored on the shipment.', 'Extra revenue, and protection customers can see.', 500000),
    ('Customer analytics', 'Each customer sees their spend, shipments, average days door to door and on-time rate.', 'Shows business customers the value you deliver.', 700000),
    ('Business analytics', 'Revenue and margin by lane, customs time, delays by stage, top customers, quote win rate and ATM turnaround.', 'Decide on facts: which lanes, customers and steps to fix or grow.', 1000000),
    ('24/7 tracking assistant', 'An AI assistant in the app that answers "where is my shipment?" from live data.', 'Customers get answers at night and on weekends.', 500000),
]
WEBSITE = [
    ('New website design', 'A fresh design in the Splendid Freight brand, built for phones first.', 800000),
    ('Service pages', 'Air, ocean and road freight, customs clearance, warehousing, charter and ATM logistics.', 700000),
    ('Quote request and tracking box', 'Request a quote or track a shipment straight from the homepage.', 400000),
    ('AI website assistant', 'Answers questions and captures leads, day and night.', 600000),
    ('Blog and news', 'Publish updates and guides that bring in search traffic.', 300000),
    ('SEO and Google Business', 'Set up to be found in Lagos, Abuja and Port Harcourt searches.', 400000),
    ('Visitor analytics and leads inbox', 'See who visits, from where, and every enquiry in one inbox.', 300000),
]
FREE = [
    ('6 months hosting', 'Servers, database and storage for documents and photos.'),
    ('6 months support', 'Fixes, small changes and help after launch.'),
    ('Training', 'Hands-on sessions for operations, finance and management.'),
    ('Roles and audit log', 'Control who sees what, and see who changed what.'),
    ('Backups and monitoring', 'Daily backups and alerts if anything goes down.'),
    ('Domain, email and SSL setup', 'Website, portal and messages sent from your own domain.'),
]
OPTIONS = [
    dict(n='1', name='Operations Portal', items=T1, who='For running the business', blurb='Your team runs shipments and ATM jobs in one place. Customers follow a tracking link your team updates.',
         hl=['Shipments and Nigerian clearance steps', 'QR labels and phone updates', 'Customer tracking link', 'ATM jobs and machine register', 'Website editor'], live='29 January 2027'),
    dict(n='2', name='Customer Portal', items=T2, who='For business customers', blurb='Everything in Option 1, plus accounts where business customers request, approve and track.', badge='Recommended',
         hl=['Everything in Option 1', 'Customer accounts with several users', 'Shipment and ATM requests', 'Quotes accepted online', 'Automatic email and WhatsApp updates'], live='26 February 2027'),
    dict(n='3', name='Full Platform', items=T3, who='For business and personal customers', blurb='Everything in Option 2, plus a B2C app with instant quotes, online payments and analytics.',
         hl=['Everything in Option 2', 'Mobile app and B2C sign-up', 'Instant quotes and online payments', 'Quote and payment tracking', 'Analytics for you and your customers'], live='26 March 2027'),
]
s1 = sum(x[3] for x in T1); s2 = s1 + sum(x[3] for x in T2); s3 = s2 + sum(x[3] for x in T3)
PRICES = [s1, s2, s3]
WEB_TOTAL = sum(x[2] for x in WEBSITE)
assert PRICES == [9500000, 15500000, 24000000], PRICES
assert WEB_TOTAL == 3500000

N = lambda a: '₦{:,}'.format(a)
CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>'

def tiers_html():
    out = ['<div class="sf-tiers">']
    for o, price in zip(OPTIONS, PRICES):
        feat = ' featured' if o.get('badge') else ''
        badge = f'<span class="sf-badge">{o["badge"]}</span>' if o.get('badge') else ''
        lis = ''.join(f'<li>{CHECK}<span>{h}</span></li>' for h in o['hl'])
        up = round(price * .4)
        out.append(f'''<article class="sf-tier{feat}">{badge}
          <small>Option {o["n"]} · {o["who"]}</small>
          <h3>{o["name"]}</h3>
          <div class="sf-price">{N(price)}</div>
          <p class="sf-split">{N(up)} to start · {N(price - up)} at launch</p>
          <p>{o["blurb"]}</p>
          <ul>{lis}</ul>
          <div class="sf-tier-foot"><span>Live by</span><b>{o["live"]}</b></div>
          <a class="sf-tier-link" href="#opt{o["n"]}">See every feature</a>
        </article>''')
    out.append('</div>')
    return '\n'.join(out)

def table(rows, start):
    trs = []
    for i, (f, what, why, val) in enumerate(rows):
        trs.append(f'<tr><td>{start + i:02d}</td><td><b>{f}</b><span>{what}</span></td><td>{why}</td><td><strong>{N(val)}</strong></td></tr>')
    return '\n'.join(trs)

def breakdown_html():
    out = []
    n = 1
    heads = ['Option 1 · Operations Portal', 'Option 2 adds · Customer Portal', 'Option 3 adds · Full Platform']
    notes = ['Includes the CRM, invoices, expenses, Zoho Books sync and data migration that come with every option.',
             f'Option 2 total: {N(PRICES[1])}, which is Option 1 ({N(PRICES[0])}) plus the lines below.',
             f'Option 3 total: {N(PRICES[2])}, which is Option 2 ({N(PRICES[1])}) plus the lines below.']
    for k, (o, head, note) in enumerate(zip(OPTIONS, heads, notes)):
        sub = sum(x[3] for x in o['items'])
        out.append(f'''<div class="sf-block" id="opt{o["n"]}">
          <div class="sf-block-head"><div><small>{head}</small><h3>{o["name"]}</h3><p>{note}</p></div>
            <div class="sf-block-total"><span>{"Option total" if k == 0 else "These lines"}</span><strong>{N(sub)}</strong></div></div>
          <div class="sf-table-wrap"><table class="sf-table">
            <thead><tr><th>#</th><th>What you get</th><th>How it helps</th><th>Value</th></tr></thead>
            <tbody>
{table(o["items"], n)}
            </tbody>
            <tfoot><tr><td colspan="3"><b>{"Option 1 total" if k == 0 else f"Option {o['n']} total"}</b></td><td><strong>{N(PRICES[k])}</strong></td></tr></tfoot>
          </table></div>
        </div>''')
        n += len(o['items'])
    return '\n'.join(out)

def website_html():
    trs = '\n'.join(f'<tr><td><b>{f}</b><span>{what}</span></td><td><s>{N(v)}</s></td></tr>' for f, what, v in WEBSITE)
    return f'''<div class="sf-block sf-web">
          <div class="sf-block-head"><div><small>Included free in every option</small><h3>Your new website</h3><p>Built and launched in January, whichever option you choose.</p></div>
            <div class="sf-block-total"><span>Website value</span><strong><s>{N(WEB_TOTAL)}</s> <em>FREE</em></strong></div></div>
          <div class="sf-table-wrap"><table class="sf-table sf-web-table">
            <thead><tr><th>What you get</th><th>Value</th></tr></thead>
            <tbody>
{trs}
            </tbody>
            <tfoot><tr><td><b>Website total</b></td><td><strong><s>{N(WEB_TOTAL)}</s> <em>₦0</em></strong></td></tr></tfoot>
          </table></div>
        </div>'''

def free_html():
    lis = ''.join(f'<div><b>{t}</b><span>{d}</span></div>' for t, d in FREE)
    return f'''<div class="sf-free"><small>ALSO INCLUDED AT NO FEE</small><div class="sf-free-grid">{lis}</div></div>'''

def pay_html():
    rows = ''.join(f'<tr><td><b>Option {o["n"]} · {o["name"]}</b></td><td>{N(p)}</td><td>{N(round(p*.4))}</td><td>{N(p-round(p*.4))}</td></tr>' for o, p in zip(OPTIONS, PRICES))
    return f'''<div class="sf-block sf-pay">
          <div class="sf-block-head"><div><small>Payment</small><h3>40% to start, 60% at launch</h3><p>Upgrading later? You pay only the difference between options.</p></div></div>
          <div class="sf-table-wrap"><table class="sf-table sf-pay-table">
            <thead><tr><th>Option</th><th>Total</th><th>40% at kickoff</th><th>60% at launch</th></tr></thead>
            <tbody>{rows}</tbody>
          </table></div>
        </div>'''

CSS = '''
      /* ── Splendid Freight options + breakdown ── */
      .sf-tiers { display:grid; grid-template-columns:repeat(3,1fr); gap:18px; margin-top:34px; align-items:stretch; }
      .sf-tier { position:relative; display:flex; flex-direction:column; gap:10px; padding:28px 24px 22px; border:1px solid #dfe9e5; border-radius:24px; background:#fff; box-shadow:0 18px 50px rgba(10,42,34,.07); }
      .sf-tier small { font-size:12px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; color:#0f8a6a; }
      .sf-tier h3 { font-size:28px; letter-spacing:-.02em; color:#0a0f0d; margin:0; }
      .sf-price { font-size:40px; font-weight:800; letter-spacing:-.03em; color:#0a2a22; line-height:1.05; }
      .sf-split { font-size:13px; color:#5e6b66; margin:0; }
      .sf-tier > p { font-size:15px; line-height:1.55; color:#3d4a45; margin:4px 0 0; }
      .sf-tier ul { list-style:none; padding:0; margin:8px 0 0; display:grid; gap:9px; }
      .sf-tier li { display:flex; gap:9px; align-items:flex-start; font-size:14.5px; color:#0a0f0d; line-height:1.4; }
      .sf-tier li svg { flex:none; margin-top:2px; color:#00936d; }
      .sf-tier-foot { margin-top:auto; padding-top:16px; border-top:1px solid #e6ece9; display:flex; justify-content:space-between; font-size:13px; color:#5e6b66; }
      .sf-tier-foot b { color:#0a0f0d; }
      .sf-tier-link { font-size:14px; font-weight:700; color:#007a5e; text-decoration:none; }
      .sf-tier-link:hover { text-decoration:underline; }
      .sf-tier.featured { background:linear-gradient(160deg,#071f19,#0a3a2e); border-color:#0a3a2e; color:#fff; box-shadow:0 26px 60px rgba(10,42,34,.22); }
      .sf-tier.featured small, .sf-tier.featured .sf-tier-link { color:#1ef7c4; }
      .sf-tier.featured h3, .sf-tier.featured .sf-price, .sf-tier.featured li, .sf-tier.featured .sf-tier-foot b { color:#fff; }
      .sf-tier.featured > p, .sf-tier.featured .sf-split, .sf-tier.featured .sf-tier-foot { color:rgba(255,255,255,.72); }
      .sf-tier.featured li svg { color:#1ef7c4; }
      .sf-tier.featured .sf-tier-foot { border-color:rgba(255,255,255,.14); }
      .sf-badge { position:absolute; top:-12px; right:20px; background:#1ef7c4; color:#06261e; font-size:12px; font-weight:800; padding:6px 12px; border-radius:999px; }
      .sf-every { margin-top:22px; display:flex; gap:24px; align-items:center; justify-content:space-between; flex-wrap:wrap; padding:22px 24px; border-radius:20px; background:#e8faf4; border:1px solid #c9efe2; }
      .sf-every small { font-size:12px; font-weight:800; letter-spacing:.08em; color:#0f8a6a; }
      .sf-every h3 { margin:6px 0 0; font-size:20px; color:#0a0f0d; max-width:520px; }
      .sf-every ul { list-style:none; display:flex; flex-wrap:wrap; gap:8px; padding:0; margin:0; }
      .sf-every li { background:#fff; border:1px solid #c9efe2; border-radius:999px; padding:7px 12px; font-size:13px; font-weight:700; color:#0a2a22; }
      .sf-block { margin-top:26px; background:#fff; border:1px solid #dfe9e5; border-radius:24px; overflow:hidden; box-shadow:0 18px 50px rgba(10,42,34,.06); scroll-margin-top:90px; }
      .sf-block-head { display:flex; justify-content:space-between; gap:20px; align-items:flex-end; padding:24px 24px 18px; }
      .sf-block-head small { font-size:12px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; color:#0f8a6a; }
      .sf-block-head h3 { margin:6px 0 4px; font-size:26px; letter-spacing:-.02em; color:#0a0f0d; }
      .sf-block-head p { margin:0; font-size:14px; color:#5e6b66; max-width:640px; }
      .sf-block-total { text-align:right; flex:none; }
      .sf-block-total span { display:block; font-size:12px; color:#5e6b66; text-transform:uppercase; letter-spacing:.06em; font-weight:700; }
      .sf-block-total strong { font-size:26px; color:#0a2a22; letter-spacing:-.02em; }
      .sf-table-wrap { overflow-x:auto; }
      .sf-table { width:100%; border-collapse:collapse; font-size:14px; }
      .sf-table th { text-align:left; font-size:11.5px; letter-spacing:.08em; text-transform:uppercase; color:#5e6b66; padding:12px 16px; background:#f4f7f6; border-top:1px solid #e6ece9; border-bottom:1px solid #e6ece9; }
      .sf-table td { padding:14px 16px; border-bottom:1px solid #eef2f0; vertical-align:top; color:#3d4a45; line-height:1.5; }
      .sf-table td:first-child { color:#0f8a6a; font-weight:800; width:42px; }
      .sf-table td b { display:block; color:#0a0f0d; font-size:14.5px; margin-bottom:3px; }
      .sf-table td span { display:block; color:#5e6b66; font-size:13.5px; }
      .sf-table td:nth-child(3) { color:#0a2a22; }
      .sf-table th:last-child, .sf-table td:last-child { text-align:right; white-space:nowrap; }
      .sf-table td strong { color:#0a2a22; }
      .sf-table tfoot td { background:#0a2a22; color:#fff; border:0; padding:16px; }
      .sf-table tfoot td b { color:#fff; margin:0; }
      .sf-table tfoot td strong { color:#1ef7c4; font-size:18px; }
      .sf-web-table td:first-child { width:auto; color:#3d4a45; font-weight:400; }
      .sf-web s, .sf-web-table s { color:#8a9893; font-weight:600; }
      .sf-web em, .sf-web-table em { font-style:normal; color:#00936d; font-weight:800; margin-left:6px; }
      .sf-web-table tfoot em { color:#1ef7c4; }
      .sf-web-table tfoot s { color:rgba(255,255,255,.55); }
      .sf-web .sf-block-total strong em { background:#1ef7c4; color:#06261e; padding:3px 10px; border-radius:999px; font-size:16px; vertical-align:middle; }
      .sf-pay-table td:first-child { width:auto; color:#0a0f0d; font-weight:400; }
      .sf-pay-table td, .sf-pay-table th { text-align:right; } .sf-pay-table td:first-child, .sf-pay-table th:first-child { text-align:left; }
      .sf-free { margin-top:26px; padding:24px; border-radius:24px; background:#0a2a22; color:#fff; }
      .sf-free > small { font-size:12px; font-weight:800; letter-spacing:.08em; color:#1ef7c4; }
      .sf-free-grid { margin-top:14px; display:grid; grid-template-columns:repeat(3,1fr); gap:12px; }
      .sf-free-grid div { padding:14px 16px; border-radius:16px; background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.1); }
      .sf-free-grid b { display:block; font-size:15px; }
      .sf-free-grid span { display:block; margin-top:4px; font-size:13px; color:rgba(255,255,255,.7); line-height:1.45; }
      #budget .maintenance-card { margin-top:26px; }
      #scope .delivery-timeline { margin-top:30px; }
      @media (max-width: 980px) { .sf-tiers { grid-template-columns:1fr; } .sf-free-grid { grid-template-columns:1fr 1fr; } }
      @media (max-width: 640px) {
        .sf-block-head { flex-direction:column; align-items:flex-start; padding:20px 16px 14px; }
        .sf-block-total { text-align:left; }
        .sf-free-grid { grid-template-columns:1fr; }
        .sf-table thead { display:none; }
        .sf-table:not(.sf-pay-table) tr { display:grid; grid-template-columns:auto 1fr; gap:4px 10px; padding:14px 16px; border-bottom:1px solid #eef2f0; }
        .sf-table:not(.sf-pay-table) td { padding:0; border:0; text-align:left !important; }
        .sf-table:not(.sf-pay-table) tbody td:nth-child(3) { grid-column:2; font-size:13.5px; }
        .sf-table:not(.sf-pay-table) tbody td:nth-child(4) { grid-column:2; }
        .sf-web-table tbody td:nth-child(2) { grid-column:1 / -1; }
        .sf-table:not(.sf-pay-table) tfoot tr { display:flex; justify-content:space-between; align-items:center; gap:12px; background:#0a2a22; }
        .sf-table:not(.sf-pay-table) tfoot td { padding:0; background:transparent; }
        .sf-pay-table { font-size:13px; } .sf-pay-table td, .sf-pay-table th { padding:10px 8px; }
        .sf-price { font-size:34px; }
        .sf-table tfoot td:first-child { width:auto; }
        #scope .delivery-table, #scope .delivery-table tbody { display:block; width:100%; min-width:0 !important; }
        #scope .delivery-table thead { display:none; }
        #scope .delivery-table tr { display:block; padding:14px 4px; border-bottom:1px solid rgba(255,255,255,.1); }
        #scope .delivery-table td { display:block; padding:3px 0 !important; border:0 !important; width:auto !important; }
        #scope .delivery-table td:nth-child(2) { color:#1ef7c4; font-weight:700; font-size:13px; }
      }
'''
