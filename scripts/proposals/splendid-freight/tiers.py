# Splendid Freight proposal: three standalone options, side-by-side tick table, per-option breakdown, free website.
# Line: key -> (feature, what you get, how it helps, value in naira). Each option lists every line it contains.
import os
HERE = os.path.dirname(os.path.abspath(__file__)) + '/'

L = {
    'board': ('Shipment control board', 'All air, ocean and road shipments in one list, with stage, ETA and owner.', 'Answer "where is it?" in seconds.', 1500000),
    'customs': ('Nigerian customs steps', 'Form M, PAAR, duty, examination, release, TDO or gate pass, then delivery.', 'See which customs step is holding each shipment.', 1000000),
    'status': ('Status updates by your team', 'Open a shipment, pick the new step, add a note or document, save.', 'One update keeps everyone informed.', 900000),
    'link': ('Customer tracking link', 'A private tracking page per shipment, updated when your team saves.', 'Fewer "any update?" calls.', 800000),
    'teamalert': ('Delay alerts for your team', 'Each step has an expected time. Late steps alert the person in charge.', 'Fix delays before customers notice.', 500000),
    'docs': ('Shipment documents', 'Bill of lading, airway bill, invoice, PAAR and proof of delivery on each shipment.', 'No more searching inboxes.', 500000),
    'atm': ('ATM job tracker', 'Decommissioning, relocation, staging, civil works, cannibalisation and refurbishment, each with a checklist.', 'Every ATM job done the same way.', 1000000),
    'register': ('ATM machine register', 'Each machine with bank, branch, serial, photos, parts and sign-offs.', 'A clear audit trail for banks.', 900000),
    'webedit': ('Website editor', 'Edit pages, services, photos and blog posts. Read every enquiry.', 'Keep the site current without a developer.', 400000),
    'crm': ('Customer CRM', 'Every customer, contact, shipment, quote and follow-up in one place.', 'Anyone can pick up any customer.', 800000),
    'invoices': ('Invoices', 'Invoice from a shipment or ATM job. See paid, part-paid and overdue.', 'Bill faster and see who owes what.', 700000),
    'expenses': ('Expense tracker', 'Log freight, duty, port, trucking and agent costs per job.', 'Know the real profit on every job.', 700000),
    'zoho': ('Zoho Books sync', 'Customers, invoices and payments sync both ways with Zoho Books.', 'No double entry for your accounts team.', 800000),
    'migrate': ('Data migration', 'Your customers, past shipments and invoices moved in from Zoho, Excel and Outlook.', 'Start on day one with your history.', 500000),
    'accounts': ('Customer accounts', 'Each business customer gets a login for several staff.', 'Customers help themselves, any time.', 1000000),
    'request': ('Shipment request form', 'Origin, destination, weight, size, goods and pickup address in one form.', 'Complete requests, faster quotes.', 900000),
    'atmreq': ('ATM support requests', 'Banks request ATM work by branch and machine.', 'ATM jobs arrive ready to schedule.', 800000),
    'services': ('Room for new services', 'Add warehousing, charter or haulage later.', 'The portal grows with you.', 500000),
    'acctrack': ('Tracking in the account', 'Every shipment and ATM job, with timeline and documents.', 'All their work with you in one place.', 900000),
    'quotes': ('Quotes accepted online', 'You send the quote, the customer accepts in their account. Payment stays offline.', 'Approvals in a click, all on record.', 800000),
    'notify': ('Email and WhatsApp updates', 'Each status your team saves messages the customer. Late steps send a delay notice.', 'Customers hear from you first.', 700000),
    'repeat': ('Order history and repeat orders', 'Past shipments, with one-click repeat.', 'Easy for customers to book again.', 400000),
    'b2c': ('Personal customers (B2C)', 'Individuals, like online shoppers and diaspora senders, sign up.', 'A new customer group, no extra staff.', 1000000),
    'app': ('Mobile app', 'Android and iPhone app with push notifications.', "Your brand on the customer's phone.", 1500000),
    'instant': ('Instant quotes', 'Prices by lane, mode and weight, shown on the spot.', 'Win customers before they shop around.', 1100000),
    'pay': ('Online payments', 'Paystack card, transfer and USSD in naira, plus USD and GBP cards.', 'Get paid before cargo moves.', 1000000),
    'paytrack': ('Quote and payment tracking', 'Each quote from sent to accepted to paid, with reminders.', 'Nothing slips between quote and cash.', 900000),
    'insure': ('Cargo insurance', 'Cover option on each booking, policy kept on the shipment.', 'Extra revenue and peace of mind.', 500000),
    'canalytics': ('Customer analytics', 'Each customer sees spend, shipments, days door to door and on-time rate.', 'Shows the value you deliver.', 700000),
    'banalytics': ('Business analytics', 'Revenue and margin by lane, customs time, delays, top customers and ATM turnaround.', 'Decide on facts.', 900000),
    'assistant': ('24/7 tracking assistant', 'AI in the app answers "where is my shipment?" from live data.', 'Answers at night and weekends.', 400000),
}
K1 = ['board', 'customs', 'status', 'link', 'teamalert', 'docs', 'atm', 'register', 'webedit', 'crm', 'invoices', 'expenses', 'zoho', 'migrate']
K2 = ['board', 'customs', 'status', 'accounts', 'b2c', 'acctrack', 'request', 'quotes', 'notify', 'repeat', 'link', 'teamalert', 'docs',
      'atm', 'register', 'atmreq', 'services', 'webedit', 'crm', 'invoices', 'expenses', 'zoho', 'migrate']
K3 = ['board', 'customs', 'status', 'accounts', 'b2c', 'app', 'acctrack', 'request', 'instant', 'quotes', 'pay', 'paytrack', 'insure', 'notify',
      'repeat', 'assistant', 'link', 'teamalert', 'docs', 'atm', 'register', 'atmreq', 'services', 'canalytics', 'banalytics', 'webedit',
      'crm', 'invoices', 'expenses', 'zoho', 'migrate']
for ks in (K1, K2, K3):
    assert len(ks) == len(set(ks))
assert set(K1) <= set(K2) <= set(K3)
PRICES = [sum(L[k][3] for k in ks) for ks in (K1, K2, K3)]
assert PRICES == [11000000, 18000000, 25000000], PRICES

WEBSITE = [
    ('New website design', 'A fresh design in the Splendid Freight brand, built for phones first.', 800000),
    ('Service pages', 'Air, ocean and road freight, customs clearance, warehousing, charter and ATM logistics.', 700000),
    ('Quote request and tracking box', 'Request a quote or track a shipment straight from the homepage.', 400000),
    ('AI website assistant', 'Answers questions and captures leads, day and night.', 600000),
    ('Blog and news', 'Publish updates and guides that bring in search traffic.', 300000),
    ('SEO and Google Business', 'Set up to be found in Lagos, Abuja and Port Harcourt searches.', 400000),
    ('Visitor analytics and leads inbox', 'See who visits, from where, and every enquiry in one inbox.', 300000),
]
WEB_TOTAL = sum(x[2] for x in WEBSITE)
assert WEB_TOTAL == 3500000
FREE = [
    ('6 months hosting', 'Servers, database and storage for documents and photos.'),
    ('6 months support', 'Fixes, small changes and help after launch.'),
    ('Training', 'Hands-on sessions for operations, finance and management.'),
    ('Roles and activity log', 'Control who sees what, and see who changed what.'),
    ('Backups and monitoring', 'Daily backups and alerts if anything goes down.'),
    ('Domain, email and SSL setup', 'Website, portal and messages sent from your own domain.'),
]
MAINT = [350000, 500000, 750000]
HOSTING = [40, 60, 90]
OPTIONS = [
    dict(n='1', name='Operations Portal', keys=K1, who='Run the business', live='29 January 2027',
         blurb='Your team runs freight and ATM jobs in one portal. Customers follow a tracking link.'),
    dict(n='2', name='Customer Portal', keys=K2, who='Business and personal customers', live='26 February 2027',
         blurb='The operations portal, plus accounts where businesses, personal customers and banks request, approve and track.'),
    dict(n='3', name='Full Platform', keys=K3, who='The complete platform', live='26 March 2027',
         blurb='Everything in the customer portal, plus a mobile app, instant quotes, online payments and full analytics.'),
]

N = lambda a: '₦{:,}'.format(a)
CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>'
YES = f'<span class="sf-yes" role="img" aria-label="Included">{CHECK}</span>'
NO = '<span class="sf-no" role="img" aria-label="Not included"><svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 12h12"/></svg></span>'

def compare_html():
    def has(k):
        return ''.join(f'<td class="c{i}">{YES if k in o["keys"] else NO}</td>' for i, o in enumerate(OPTIONS))
    def txt(*v):
        return ''.join((f'<td class="c{i}"><span class="sf-txt">{x}</span></td>' if x else f'<td class="c{i}">{NO}</td>') for i, x in enumerate(v))
    groups = [
        ('Operations', [
            ('Shipment board', 'Air, ocean and road shipments in one list, with stage, ETA and owner.', has('board')),
            ('Nigerian customs steps', 'Form M, PAAR, duty, examination, release and gate pass, step by step.', has('customs')),
            ('Status updates by your team', 'Pick the new step, add a note or document, save. Everyone sees it.', has('status')),
            ('Shipment documents', 'B/L, airway bill, invoice, PAAR and proof of delivery on each shipment.', has('docs')),
            ('Delay alerts', 'Each step has an expected time. Late steps raise an alert.', txt('Your team', 'Team + customers', 'Team + customers')),
        ]),
        ('ATM support', [
            ('ATM job tracker', 'Decommissioning, relocation, staging, civil works, cannibalisation and refurbishment.', has('atm')),
            ('ATM machine register', 'Each machine with bank, branch, serial, photos, parts and sign-offs.', has('register')),
            ('Online ATM requests', 'Banks request ATM work by branch and machine from their account.', has('atmreq')),
        ]),
        ('Your customers', [
            ('How customers track', 'Where customers go to see their shipment.', txt('Tracking link', 'Own account', 'Account + mobile app')),
            ('Business accounts', 'One login per company, with several staff users.', has('accounts')),
            ('Personal customers (B2C)', 'Individuals, like online shoppers and diaspora senders, sign up.', has('b2c')),
            ('Shipment request form', 'Origin, destination, weight, size, goods and pickup address in one form.', has('request')),
            ('Email and WhatsApp updates', 'Each saved status messages the customer automatically.', has('notify')),
            ('Order history and repeat orders', 'Past shipments, with one-click repeat for regular lanes.', has('repeat')),
            ('Mobile app', 'Android and iPhone app with push notifications.', has('app')),
            ('24/7 tracking assistant', 'AI answers "where is my shipment?" from live data, any time.', has('assistant')),
        ]),
        ('Quotes and payments', [
            ('Quotes', 'How a customer gets and approves a price.', txt('Sent by email', 'Accepted online', 'Instant + accepted online')),
            ('Online payments', 'Paystack card, transfer and USSD in naira, plus USD and GBP cards.', has('pay')),
            ('Quote and payment tracking', 'Each quote from sent to accepted to paid, with reminders.', has('paytrack')),
            ('Cargo insurance', 'Cover option on each booking, with the policy kept on file.', has('insure')),
        ]),
        ('Finance and CRM', [
            ('Customer CRM', 'Every customer, contact, quote and follow-up in one place.', has('crm')),
            ('Invoices', 'Invoice from a shipment or ATM job. See paid and overdue.', has('invoices')),
            ('Expense tracker', 'Freight, duty, port, trucking and agent costs per job, so you see profit.', has('expenses')),
            ('Zoho Books sync', 'Customers, invoices and payments sync both ways.', has('zoho')),
            ('Data migration', 'Your customers, shipments and invoices moved in from Zoho, Excel and Outlook.', has('migrate')),
        ]),
        ('Reports', [
            ('Live operations dashboard', 'In transit, at customs, delayed and delivered, at a glance.', has('board')),
            ('Customer analytics', 'Customers see their spend, shipments, days door to door and on-time rate.', has('canalytics')),
            ('Business analytics', 'Margin by lane, customs time, delays by step, top customers and ATM turnaround.', has('banalytics')),
        ]),
        ('Website', [
            ('New website (worth ₦3,500,000)', 'New design, service pages, quote and tracking box, AI assistant and SEO. Live in December.', txt('Free', 'Free', 'Free')),
            ('Website editor, blog and leads inbox', 'Update pages and posts yourself, and see every enquiry.', has('webedit')),
        ]),
        ('Support', [
            ('Hosting, support and training', 'The first 6 months are included.', has('board')),
            ('Maintenance after month 6', 'Optional. Updates, backups, monitoring, fixes and small changes.', txt(*[f'{N(m)}/mo' for m in MAINT])),
            ('Hosting after month 6', 'Estimated running cost.', txt(*[f'${h}/mo' for h in HOSTING])),
        ]),
    ]
    head = ''.join(
        f'<th class="c{i}{" featured" if o.get("badge") else ""}" scope="col">'
        f'{"<em>" + o["badge"] + "</em>" if o.get("badge") else ""}<small>Option {o["n"]}</small><b>{o["name"]}</b><span>{N(p)}</span><i>{o["who"]}</i></th>'
        for i, (o, p) in enumerate(zip(OPTIONS, PRICES)))
    rows = []
    for g, items in groups:
        rows.append(f'<tr class="sf-cmp-group"><th colspan="4" scope="colgroup">{g}</th></tr>')
        for label, desc, cells in items:
            rows.append(f'<tr><th scope="row"><b>{label}</b><span>{desc}</span></th>{cells}</tr>')
    foot = '<tr class="sf-cmp-total"><th scope="row">Total</th>' + ''.join(f'<td class="c{i}"><b>{N(p)}</b></td>' for i, p in enumerate(PRICES)) + '</tr>'
    foot += '<tr><th scope="row">40% to start</th>' + ''.join(f'<td class="c{i}">{N(round(p * .4))}</td>' for i, p in enumerate(PRICES)) + '</tr>'
    foot += '<tr><th scope="row">60% at launch</th>' + ''.join(f'<td class="c{i}">{N(p - round(p * .4))}</td>' for i, p in enumerate(PRICES)) + '</tr>'
    foot += '<tr><th scope="row">Live by</th>' + ''.join(f'<td class="c{i}">{o["live"]}</td>' for i, o in enumerate(OPTIONS)) + '</tr>'
    return f'''<div class="sf-cmp-wrap"><table class="sf-cmp">
          <thead><tr><th class="sf-cmp-corner" scope="col"><small>Compare</small><b>What each option includes</b></th>{head}</tr></thead>
          <tbody>{''.join(rows)}</tbody>
          <tfoot>{foot}</tfoot>
        </table></div>'''

def breakdown_html():
    tabs = ''.join(f'<button type="button" class="sf-opt-tab{" active" if o["n"] == "1" else ""}" data-opt-tab="{o["n"]}" role="tab" aria-selected="{"true" if o["n"] == "1" else "false"}"><small>Option {o["n"]}</small><b>{o["name"]}</b><span>{N(p)}</span></button>' for o, p in zip(OPTIONS, PRICES))
    panels = []
    for o, p, mt in zip(OPTIONS, PRICES, MAINT):
        trs = '\n'.join(f'<tr><td>{i + 1:02d}</td><td><b>{L[k][0]}</b><span>{L[k][1]}</span></td><td>{L[k][2]}</td><td><strong>{N(L[k][3])}</strong></td></tr>' for i, k in enumerate(o['keys']))
        hide = '' if o['n'] == '1' else ' hidden=""'
        panels.append(f'''<div class="sf-block sf-opt-panel" data-opt-panel="{o["n"]}"{hide}>
          <div class="sf-block-head"><div><small>Option {o["n"]} · {o["who"]}</small><h3>{o["name"]}</h3><p>{o["blurb"]}</p><p class="sf-meta">{len(o["keys"])} features · live by {o["live"]} · maintenance after month 6 {N(mt)}/month, optional</p></div>
            <div class="sf-block-total"><span>Total</span><strong>{N(p)}</strong><em>{N(round(p * .4))} to start · {N(p - round(p * .4))} at launch</em></div></div>
          <div class="sf-table-wrap"><table class="sf-table">
            <thead><tr><th>#</th><th>What you get</th><th>How it helps</th><th>Value</th></tr></thead>
            <tbody>
{trs}
            </tbody>
            <tfoot><tr><td colspan="3"><b>Option {o["n"]} total</b></td><td><strong>{N(p)}</strong></td></tr></tfoot>
          </table></div>
        </div>''')
    return f'<div class="sf-opt-tabs" role="tablist" aria-label="Choose an option">{tabs}</div>\n' + '\n'.join(panels)

def website_html():
    trs = '\n'.join(f'<tr><td><b>{f}</b><span>{what}</span></td><td><s>{N(v)}</s></td></tr>' for f, what, v in WEBSITE)
    return f'''<div class="sf-block sf-web">
          <div class="sf-block-head"><div><small>Free</small><h3>Your new website</h3><p>Live by 18 December 2026.</p></div>
            <div class="sf-block-total"><span>Website value</span><strong><s>{N(WEB_TOTAL)}</s> <em class="sf-free-pill">FREE</em></strong></div></div>
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
    return f'<div class="sf-free"><small>ALSO IN EVERY OPTION, AT NO FEE</small><div class="sf-free-grid">{lis}</div></div>'

def maint_html():
    cards = ''.join(f'<div class="{"featured" if o.get("badge") else ""}"><small>Option {o["n"]} · {o["name"]}</small><strong>{N(m)}</strong><span>per month, optional</span><em>Hosting about ${h}/month</em></div>' for o, m, h in zip(OPTIONS, MAINT, HOSTING))
    return f'''<div class="sf-maint">
          <div class="sf-maint-head"><small>AFTER THE FIRST 6 MONTHS</small><h3>Maintenance matches the option you pick</h3>
            <p>Updates, backups, monitoring, fixes and small changes. New features are quoted separately. WhatsApp and payment fees are billed by Meta and Paystack.</p></div>
          <div class="sf-maint-grid">{cards}</div>
        </div>'''

SCRIPT = '''<script>
      function openOpt(n) {
        document.querySelectorAll('[data-opt-tab]').forEach(function (t) { var a = t.dataset.optTab === n; t.classList.toggle('active', a); t.setAttribute('aria-selected', a ? 'true' : 'false'); });
        document.querySelectorAll('[data-opt-panel]').forEach(function (p) { p.hidden = p.dataset.optPanel !== n; });
      }
      document.querySelectorAll('[data-opt-tab]').forEach(function (t) { t.addEventListener('click', function () { openOpt(t.dataset.optTab); }); });
      document.querySelectorAll('[data-open-opt]').forEach(function (a) { a.addEventListener('click', function () { openOpt(a.dataset.openOpt); }); });
      function fitMocks() {
        document.querySelectorAll('.sfui-fit').forEach(function (box) {
          var inner = box.firstElementChild, w = Number(box.dataset.w || 1200);
          if (!box.clientWidth) return;
          if (box.clientWidth >= w) { inner.style.width = box.clientWidth + 'px'; inner.style.transform = 'none'; box.style.height = inner.offsetHeight + 'px'; return; }
          inner.style.width = w + 'px';
          var s = box.clientWidth / w;
          inner.style.transform = 'scale(' + s + ')';
          box.style.height = Math.ceil(inner.offsetHeight * s) + 'px';
        });
      }
      window.addEventListener('resize', fitMocks); window.addEventListener('load', fitMocks); fitMocks();
      document.querySelectorAll('[data-demo-tab]').forEach(function (t) { t.addEventListener('click', function () { setTimeout(fitMocks, 0); }); });
    </script>'''

CSS = open(HERE + 'tiers.css').read()
