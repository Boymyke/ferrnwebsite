import base64, re
import os
HERE = os.path.dirname(os.path.abspath(__file__)) + '/'
head = open(HERE + 'ataam_head.html').read()
body_src = open(HERE + 'ataam_body.html').read().split('\n')
tpl = open(HERE + 'body.tpl.html').read()

def uri(p):
    return 'data:image/jpeg;base64,' + base64.b64encode(open(HERE + p, 'rb').read()).decode()

# two data-URI backgrounds: hero then close
parts = head.split('url("DATAURI")')
assert len(parts) == 3, len(parts)
head = parts[0] + 'var(--sf-hero)' + parts[1] + 'var(--sf-close)' + parts[2]
head = head.replace('url("images/hero.webp")', 'var(--sf-hero)').replace('url("images/footer-image.webp")', 'var(--sf-close)')
head = head.replace(':root {', ':root {\n        --sf-hero: url("' + uri('hero.jpg') + '");\n        --sf-close: url("' + uri('close.jpg') + '");', 1)

hexmap = {
    '#0d47c7': '#007a5e', '#168fea': '#00936d', '#087ed8': '#008a66', '#2f8fb3': '#0f8a6a',
    '#123f56': '#0a2a22', '#0b2f3d': '#071f19', '#64c4c1': '#1ef7c4', '#48d4e5': '#1ef7c4',
    '#b9dbff': '#b8f5e3', '#8dc9ff': '#8fe9cf', '#edf5ff': '#e8faf4', '#f8fbff': '#f6fdfa',
    '#082f69': '#06261e', '#082b78': '#0a3a2e', '#0b4db5': '#0b5a45', '#61748e': '#5e6b66',
    '#edf7fb': '#eef8f5', '#eef8ff': '#eefaf5', '#e9fcfc': '#e6fbf3', '#10242e': '#0a0f0d',
    '#60717a': '#5e6b66', '#eaf7f4': '#e8faf4', '#f1f6f6': '#f1f6f4',
}
rgbmap = {
    '13,71,199': '0,122,94', '22,143,234': '0,147,109', '18,63,86': '10,42,34',
    '100,196,193': '30,247,196', '72,212,229': '30,247,196', '4,26,58': '6,38,30',
    '4,24,61': '6,38,30', '5,30,76': '6,38,30', '220,238,255': '210,250,236',
    '47,143,179': '15,138,106', '237,247,251': '238,248,245', '8,126,216': '0,138,102',
}
def rx(s):
    for k, v in hexmap.items():
        s = re.sub(re.escape(k), v, s, flags=re.I)
    def rr(m):
        key = ','.join(x.strip() for x in m.group(1).split(','))
        return 'rgba(' + rgbmap.get(key, m.group(1)) + ','
    s = re.sub(r'rgba\(\s*(\d+\s*,\s*\d+\s*,\s*\d+)\s*,', rr, s)
    return s

import colorsys
def shift_hex(m):
    k=m.group(0); h=k[1:]
    if len(h)==3: h=''.join(x*2 for x in h)
    r,g,b=[int(h[i:i+2],16)/255 for i in (0,2,4)]
    hh,l,ss=colorsys.rgb_to_hls(r,g,b)
    if ss>0.25 and 0.5<hh<0.75:
        r,g,b=colorsys.hls_to_rgb(0.455,l,ss)
        return '#%02x%02x%02x'%(round(r*255),round(g*255),round(b*255))
    return k
def shift_rgb(m):
    r,g,b=[int(x) for x in m.group(1).split(',')]
    hh,l,ss=colorsys.rgb_to_hls(r/255,g/255,b/255)
    if ss>0.25 and 0.5<hh<0.75:
        r,g,b=[round(x*255) for x in colorsys.hls_to_rgb(0.455,l,ss)]
        return 'rgba(%d,%d,%d,'%(r,g,b)
    return m.group(0)
def hue_pass(css):
    css=re.sub(r'#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b(?![0-9a-fA-F])',shift_hex,css)
    return re.sub(r'rgba\(\s*(\d+\s*,\s*\d+\s*,\s*\d+)\s*,',shift_rgb,css)
head = rx(head)
_chunks = re.split(r'(data:image/[^"]+)', head)
head = ''.join(c if c.startswith('data:image') else hue_pass(c) for c in _chunks)
head = head.replace('<meta content="#007a5e" name="theme-color" />', '<meta content="#071f19" name="theme-color" />')
head = head.replace('Ataam digital operations platform proposal.', 'Splendid Freight logistics and ATM support platform proposal, prepared by Ferrn.')
head = head.replace('<title>Ataam — Product Proposal</title>', '<title>Splendid Freight | Platform Proposal by Ferrn</title>\n    <meta name="robots" content="noindex,nofollow" />')
extra_css = '''

      /* Splendid Freight contrast fixes */
      .dark .title span, .close-copy h2 span, .dark .display em { color: #1ef7c4 !important; }
      .launch-chip strong { color: #1ef7c4 !important; }
      .launch-chip span { color: rgba(255,255,255,.72) !important; }
      .budget-hero small, .budget-total-block small { color: rgba(255,255,255,.72) !important; }
      .commercial-table tr.group-row td { text-align: left !important; }
      .cred .project-link-btn { color: #1ef7c4 !important; border-color: rgba(30,247,196,.4) !important; }
      .sf-hero-logo { display:flex; align-items:center; gap:14px; margin-bottom:24px; }
      .sf-hero-logo svg { width:52px; height:52px; flex:none; }
      .sf-hero-logo span { font-size:30px; font-weight:800; letter-spacing:-0.02em; color:#0a0f0d; }
      .chip.dark-chip { background: rgba(255,255,255,.06); border-color: rgba(255,255,255,.16); color:#fff; }
      .prototype-note a { color: inherit; text-decoration: underline; text-underline-offset: 3px; }
      @media (max-width: 640px) { .sf-hero-logo span { font-size:24px; } .sf-hero-logo svg { width:42px; height:42px; } }
    </style>'''
i = head.rfind('</style>')
head = head[:i] + extra_css + head[i + len('</style>'):]

FERRN = '<svg aria-hidden="true" fill="none" viewbox="0 0 478 478" xmlns="http://www.w3.org/2000/svg"><rect fill="black" height="478" width="478"></rect><path d="M320.71 157.291V320.71H157.291V266.355H264.499V210.193H174.294V157.291H320.71Z" fill="#FF4100"></path></svg>'
ARROW = '<svg aria-hidden="true" fill="none" height="24" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewbox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>'
DL = '<svg aria-hidden="true" fill="none" height="24" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewbox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" x2="12" y1="15" y2="3"></line></svg>'
SFMARK = '<svg viewBox="0 0 40 40" aria-label="Splendid Freight" role="img"><defs><mask id="sfm"><rect width="40" height="40" fill="#fff"/><path d="M14 1.5C8 7.5 8.6 14.2 16.4 18.6C24.2 23 28.4 28.6 24.6 38.6" fill="none" stroke="#000" stroke-width="3.6" stroke-linecap="round"/></mask></defs><circle cx="20" cy="20" r="19" fill="#1EF7C4" mask="url(#sfm)"/><circle cx="20" cy="20" r="19" fill="none" stroke="#007a5e" stroke-opacity=".25" stroke-width="1" /></svg>'

included = [
    ('6-month cloud hosting + database baseline', 'Production environment, database, file storage for documents and photo proof, and agreed baseline usage for the first 6 months after launch.'),
    ('QR label templates + printing setup', 'Shipment and ATM QR label designs, print-ready templates and setup on your office label printers.'),
    ('Transactional email baseline', 'Sending quotes, approvals, milestone updates and delay alerts from your own Outlook domain, within agreed baseline volume.'),
    ('Domain, DNS + SSL connection', 'Website and portal domains, DNS configuration, HTTPS and launch routing.'),
    ('Backups, monitoring + error logging', 'Scheduled backups, uptime monitoring and error logging for launch operations.'),
    ('6-month post-launch support + training', 'In-scope bug fixes, operational guidance, minor configuration changes, staff training and customer onboarding help for six months after go-live.'),
]
core = [
    ('Discovery &amp; process mapping', 'Workshops with Lagos and Abuja teams, quote to delivery mapping, customs and inland stages, roles, reporting needs and success measures.', 1200000),
    ('Product specification &amp; acceptance criteria', 'Detailed specification, milestone definitions, delay rules, user stories, screen inventory and acceptance criteria.', 900000),
    ('UX/UI design: portal, dashboard &amp; scanner', 'Customer portal, operations dashboard and mobile QR scanner designs in Splendid Freight\'s brand, with clickable prototypes.', 1800000),
    ('Website rebuild with AI assistant', 'New website with freight, warehousing and ATM logistics pages, SEO, quote requests and an AI assistant that answers questions and captures leads.', 2400000),
    ('Website CMS, blog, leads &amp; visitor analytics', 'Blog publishing, a leads inbox for every website enquiry and visitor analytics inside the platform.', 800000),
    ('Customer accounts &amp; B2B portal', 'Company accounts with multiple users, shipment history, documents, invoices and saved addresses. Structured for B2C later.', 1400000),
    ('Quote to approval to invoice workflow', 'Online quote requests, staff pricing, quote sending, customer approval, number of days and supplier details, and invoice handoff.', 1600000),
    ('Shipment tracking engine &amp; milestones', 'Air, ocean and road shipments with pickup, origin port, departure, arrival, customs, inland trucking and delivery milestones. Port to port supported.', 1700000),
    ('QR labels &amp; staff scanner app', 'Unique QR per shipment, phone-based scanner for staff with time, location and photo proof on each milestone.', 1400000),
    ('Delay rules &amp; customer notifications', 'Expected time per stage, overdue alerts to the team and automatic customer updates by email and WhatsApp.', 900000),
    ('Analytics &amp; customer performance stats', 'Average days per shipment and stage, on-time rate, customs time, lane and customer reports, quote conversion and revenue dashboards.', 1000000),
    ('Zoho Books &amp; Outlook integrations', 'Approved quotes create Zoho Books invoices and payment status syncs back. Platform email sent through your Microsoft 365 domain.', 1100000),
    ('Cargo insurance in quotes &amp; shipments', 'Declared value, insurance cover option and premium on each quote, with policy documents stored on the shipment.', 500000),
    ('Roles, security &amp; audit trail', 'Admin, operations, field staff and customer roles, secure sessions, permissions and a full log of every quote, scan and change.', 600000),
    ('QA, pilot, deployment &amp; handoff', 'Cross-device testing, pilot with live shipments, production release, documentation and team walkthrough.', 700000),
]
atm = [
    ('ATM workflow design &amp; specification', 'Job types for decommissioning, relocation from branch A to branch B, staging, civil works, cannibalisation and refurbishment, with their checklists.', 900000),
    ('ATM asset register &amp; QR tags', 'A record per machine with bank, branch, serial, model, condition and full history, tagged with its own QR code.', 1300000),
    ('Job scheduling, field teams &amp; photo proof', 'Job creation, team assignment, site checklists, before and after photos and milestone scans from the field.', 1500000),
    ('Cannibalisation &amp; refurbishment tracking', 'Parts harvested from machines, parts stock, refurbishment steps, quality checks and machine readiness status.', 1300000),
    ('Bank client view &amp; sign-off', 'Bank customers see job progress, photos and documents in their account and sign off completed jobs online.', 1200000),
    ('ATM analytics &amp; SLA reporting', 'Job turnaround, SLA performance, machines by status and refurbishment output per month.', 800000),
]
assert sum(x[2] for x in core) == 18000000, sum(x[2] for x in core)
assert sum(x[2] for x in atm) == 7000000, sum(x[2] for x in atm)

rows = []
n = 0
for t, d in included:
    n += 1
    cls = 'included-row first-included' if n == 1 else 'included-row'
    rows.append(f'<tr class="{cls}"><td>{n:02d}</td><td><b>{t}</b><span class="scope-tag">Included at no fee</span></td><td>{d}</td><td><strong>Included · ₦0</strong></td></tr>')
for gi, (label, group) in enumerate([('Part A · Logistics platform &amp; website · ₦18,000,000', core), ('Part B · ATM support module · ₦7,000,000', atm)]):
    rows.append(f'<tr class="group-row"><td colspan="4"><b>{label}</b></td></tr>')
    for j, (t, d, a) in enumerate(group):
        n += 1
        cls = ' class="first-priced"' if j == 0 else ''
        rows.append(f'<tr{cls}><td>{n:02d}</td><td><b>{t}</b></td><td>{d}</td><td><strong>₦{a:,}</strong></td></tr>')
ROWS = '\n'.join('                  ' + r for r in rows)
head = head.replace('    </style>', '      .commercial-table .group-row td { background: #0a2a22; color: #fff; padding: 14px 18px; font-size: 14px; letter-spacing: .02em; }\n      .commercial-table .group-row b { color: #1ef7c4; }\n    </style>', 1) if False else head
# group-row css appended
i = head.rfind('</style>')
head = head[:i] + '  .commercial-table tr.group-row td { background: #0a2a22; color: #fff; padding: 14px 18px; font-size: 14px; }\n      .commercial-table tr.group-row td b { color: #1ef7c4; font-weight: 800; }\n    ' + head[i:]

def lines(a, b):
    return '\n'.join(body_src[a - 1:b])
TEAM = lines(830, 896)
CONTACT = lines(960, 1086)
SCRIPT = lines(1094, 1110)

body = tpl
for k, v in {'FERRN': FERRN, 'ARROW': ARROW, 'DL': DL, 'SFMARK': SFMARK, 'ROWS': ROWS, 'TEAM': TEAM, 'CONTACT': CONTACT, 'SCRIPT': SCRIPT}.items():
    body = body.replace('{{' + k + '}}', v)
body = body.replace('?cc=anjola%40ferrnagency.com&amp;subject', '?subject')
assert '{{' not in body
html = head.rstrip() + '\n' + body
# Strip leftover Ataam mentions in CSS comments only; check content
html = html.replace('—', ' · ') if False else html
html = html.replace("ataam-", "sfx-")
open(HERE + "index.html", "w").write(html)
import sys
bad = [m.start() for m in re.finditer('Ataam|ataam', html)]
print('size', len(html), 'ataam refs', len(bad), 'emdash in body', body.count('—'))
