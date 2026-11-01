#!/usr/bin/env python3
"""Generates migrations/0002_seed.sql — the starting content for a fresh database.
Run again after editing; it is safe because every insert is INSERT OR IGNORE."""
import json, pathlib, uuid
ROOT = pathlib.Path(__file__).resolve().parent.parent
q = lambda v: 'NULL' if v is None else (str(v) if isinstance(v,(int,float)) else "'" + str(v).replace("'", "''") + "'")
rows = []
def ins(table, d):
    cols = ','.join(d.keys()); vals = ','.join(q(v) for v in d.values())
    rows.append(f"INSERT OR IGNORE INTO {table} ({cols}) VALUES ({vals});")

# Users — no passwords. The owner sets one at /studio/setup with BOOTSTRAP_SECRET,
# then invites everyone else from Studio → Team & access.
ins('users', dict(id='u_michael', email='michael@ferrnagency.com', name='Osondu Michael', role='owner', title='Founder'))
ins('users', dict(id='u_anjola', email='anjolaajayi3@gmail.com', name='Anjolaoluwa Ajayi', role='admin', title='Co-founder'))

team = [
 ('t1','Osondu Michael','Founder & AI Engineer','Leads strategy, sales and AI products at Ferrn.'),
 ('t2','Anjolaoluwa Ajayi','Co-founder & AI Engineer','Data and AI consultant; Microsoft and Google certified; builds Ferrn’s AI agents and analytics.'),
 ('t3','Olusesi Daniel Adedayo','Back-End Engineer','Python, Django and FastAPI engineer focused on APIs, payments and multi-tenant systems.'),
 ('t4','Emelifonwu William','Front-End Engineer','TypeScript, React and Next.js engineer; AWS Certified Cloud Practitioner.'),
 ('t5','Jerome Opara','UI/UX Designer','Designs the product experiences and interfaces Ferrn ships.'),
 ('t6','Bethel Imhandegbelo','Client Success & QA','Keeps projects on track: client communication, QA testing and documentation.'),
]
for i,(id_,n,r,b) in enumerate(team):
    ins('team_members', dict(id=id_, name=n, role=r, bio=b, sort=(i+1)*10))

tst = [
 ('Vanessa','CEO, Bagzilla','https://res.cloudinary.com/dyizdpyem/image/upload/v1774525428/WhatsApp_Image_2026-03-26_at_11.38.36_y99rhu.jpg',"Working with Ferrn completely shifted our trajectory. They didn't just design a website, they built a machine that actually converts our audience."),
 ('Chisom','CEO, Hush D','https://res.cloudinary.com/dyizdpyem/image/upload/v1774525428/Screenshot_2026-03-25_at_10.17.36_PM_u3t6hu.png','The attention to detail is insane. We handed them a broken brand, and they handed us back a masterpiece. I cannot recommend them enough.'),
 ('John Sax','CEO, Jstar Films','https://res.cloudinary.com/dyizdpyem/image/upload/v1774525428/me_gm1itv.jpg','Fast, ruthless, and incredibly talented. They cut out all the agency fluff and just delivered pure, high-end results on time.'),
 ('Ifechukwu','Brand Director, Outbox Experience','https://res.cloudinary.com/dyizdpyem/image/upload/v1774535349/WhatsApp_Image_2025-09-06_at_10.17.44_dzj8xi.jpg','Ferrn moved fast, understood the brief and delivered a polished digital experience without dragging the process out.'),
 ('Nkem','Monitoring & Evaluation Lead, PWAN','https://res.cloudinary.com/dyizdpyem/image/upload/v1774553630/Screenshot_2026-03-26_at_6.23.23_PM_u6e1lv.png','The team was responsive, thoughtful and able to turn a complex idea into a product people could actually use.'),
]
for i,(n,r,a,qt) in enumerate(tst):
    ins('testimonials', dict(id=f'tm{i+1}', name=n, role=r, avatar=a, quote=qt, sort=(i+1)*10))

for p in json.load(open(ROOT/'scripts'/'data'/'legacy-posts.json')):
    ins('posts', dict(id=p['id'], slug=p['slug'], title=p['title'], category=p['category'], excerpt=p['excerpt'],
        content_html=p['content'], status='published', published_at=p['published_at'][:10]))

F = lambda *x: json.dumps(list(x))
products = [
 # slug, name, category, industry, tagline, description, features, includes, demo, accent, ngn_setup, ngn_month, usd_setup, usd_month, buy_ngn, buy_usd, days
 ('clinic-front-desk','Clinic Front Desk','webapp','Healthcare','Online booking, reminders and a WhatsApp front desk for clinics and hospitals.',
  'A patient-facing booking system for clinics: patients pick a service, doctor and time; your front desk confirms from one dashboard; reminders go out by WhatsApp or SMS the day before. Comes with a clinic website and an AI assistant trained on your services and hours.',
  F('Online appointment requests by service, doctor and branch','Front-desk dashboard with today’s queue','WhatsApp/SMS reminders the day before','Multi-branch hours and emergency line','AI assistant for “are you open / do you have a paediatrician” questions','Patient data stays exportable at any time'),
  F('Clinic website (from the Clinic Website template)','Booking dashboard for up to 5 staff','Hosting, SSL, backups and updates','Custom domain setup'),
  '/demos/clinic-desk/','#14a37f',650000,85000,1500,249,4500000,9000,7),
 ('school-admissions-portal','School Admissions Portal','webapp','Education','Online admissions, entrance-exam booking and a parent portal for private schools.',
  'Turn admissions season into a pipeline you can see: parents apply online, upload documents, pay the form fee and book entrance exams; your admin team reviews every application from one dashboard and sends offers. Billed per term to match how schools budget.',
  F('Online application with document upload','Form-fee payment via Paystack','Entrance exam and school-tour booking','Applicant pipeline: applied → tested → offered → enrolled','Parent portal with announcements','WhatsApp updates to parents'),
  F('School website (from the School Website template)','Admissions dashboard for up to 5 staff','Hosting, SSL, backups and updates','Termly billing'),
  '/demos/admissions/','#2563eb',750000,95000,1800,299,5000000,10000,10),
 ('logistics-quote-track','Logistics Quote & Track','webapp','Logistics','Instant quote requests and shipment tracking for freight and haulage companies.',
  'Give shippers what they look for first: a quote form that captures weight, route and mode, and a tracking page clients can check without calling you. Your ops team updates shipment stages from a simple board, and clients get WhatsApp updates automatically.',
  F('Quote form by mode, route, weight and incoterms','Quote inbox with status and follow-ups','Shipment board: booked → in transit → cleared → delivered','Public tracking page per shipment code','WhatsApp/email status updates','Client portal (optional add-on)'),
  F('Logistics website (from the Logistics Website template)','Ops dashboard for up to 5 staff','Hosting, SSL, backups and updates'),
  '/demos/track/','#e8a33d',900000,120000,2500,399,6000000,12000,14),
 ('clinic-website','Clinic Website','website','Healthcare','A calm, trustworthy clinic website with services, doctors, hours and appointment requests.',
  'A complete website for clinics and specialist hospitals: services, doctors, branches, opening hours, an emergency strip and an appointment request form that lands in your inbox and WhatsApp.',
  F('Services and specialties pages','Doctors directory','Appointment request form','Emergency line and opening hours','Google Business Profile setup guide','Mobile-first and fast on 3G'),
  F('Content set-up with your services and photos','Hosting, SSL and monthly care','Domain email setup guidance'),
  '/demos/cedar-clinic/','#14a37f',350000,45000,900,149,1500000,4000,5),
 ('school-website','School Website','website','Education','A modern school website with admissions enquiries, school-day story and contact routing.',
  'A school website parents trust: admissions steps, fees enquiry, school tour booking, “a day at school”, news and contact routing for each section.',
  F('Admissions steps and enquiry form','School tour booking','Day-in-the-life section','News and events','Section-by-section contact routing','Mobile-first'),
  F('Content set-up','Hosting, SSL and monthly care'),
  '/demos/brightpath-academy/','#2563eb',350000,45000,900,149,1500000,4000,5),
 ('real-estate-website','Real Estate Website','website','Real estate','Property listings, search and inspection booking for agents and developers.',
  'Show listings beautifully and capture serious buyers: property search, listing pages, inspection booking and WhatsApp enquiries per property.',
  F('Property search and filters','Listing pages with gallery','Inspection booking','WhatsApp enquiry per property','Developer project pages','Mobile-first'),
  F('Up to 30 listings loaded','Hosting, SSL and monthly care'),
  '/demos/harbourline-homes/','#b4532a',450000,55000,1100,179,1800000,4500,7),
 ('logistics-website','Logistics Website','website','Logistics','A freight website with instant quote form, routes and a shipment-tracking preview.',
  'A logistics website that answers the shipper’s first two questions — how much and where is my cargo — with a quote form, routes and a tracking preview.',
  F('Services by mode (air, sea, road)','Instant quote form','Routes and destinations','Tracking preview','WhatsApp contact','Mobile-first'),
  F('Content set-up','Hosting, SSL and monthly care'),
  '/demos/northbridge-freight/','#e8a33d',400000,50000,1000,159,1600000,4200,5),
 ('ai-website-assistant','AI Website Assistant','chatbot','Any business','A chatbot trained on your services, prices and FAQs — answers 24/7 and books leads.',
  'An assistant trained only on your approved documents. It answers questions in English, Pidgin-friendly plain language and other languages, speaks replies in a natural Nigerian voice, and hands qualified visitors to WhatsApp or a booking link.',
  F('Trained on your documents and FAQs','Speaks replies (Nigerian English voice)','Lead capture to your inbox / CRM','Hands over to WhatsApp or booking link','Multilingual','Conversation log and unanswered-question report'),
  F('Knowledge set-up from up to 30 pages','Embed on any website','Monthly AI usage included up to 2,000 messages'),
  '/demos/assistant/','#ff4100',250000,60000,600,149,None,None,5),
 ('whatsapp-reminders','WhatsApp Appointment Reminders','automation','Healthcare & services','Automatic reminders the day before every booking — fewer no-shows, no reminder calls.',
  'Connect your booking list or Google Sheet and every client gets a reminder the day before, with confirm / reschedule replies logged back for your team.',
  F('Reads bookings from Ferrn apps, Google Sheets or CSV','Day-before reminders on WhatsApp/SMS','Confirm and reschedule replies','No-show report'),
  F('Set-up and message templates','Up to 500 reminders a month'),
  '/demos/automation/?flow=reminders','#25d366',150000,35000,400,79,None,None,5),
 ('lead-follow-up-autopilot','Lead Follow-up Autopilot','automation','Any business','Every enquiry gets an instant reply and polite follow-ups until it books a call.',
  'The same engine Ferrn uses for its own outreach: every website or WhatsApp enquiry gets an instant reply, follow-ups on day 3, 7 and 14, and stops the moment the lead replies.',
  F('Instant reply to every form or chat enquiry','Follow-ups on day 3, 7 and 14','Stops automatically on reply','Daily “needs you” digest'),
  F('Set-up and templates','Dashboard access'),
  '/demos/automation/?flow=followup','#7c3aed',200000,40000,500,99,None,None,7),
]
for i,p in enumerate(products):
    (slug,name,cat,ind,tag,desc,feat,inc,demo,acc,ns,nm,us,um,bn,bu,days) = p
    ins('products', dict(id='p_'+slug.replace('-','_')[:20], slug=slug, name=name, category=cat, industry=ind, tagline=tag,
        description=desc, features_json=feat, includes_json=inc, demo_url=demo, accent=acc,
        price_ngn_setup=ns, price_ngn_monthly=nm, price_usd_setup=us, price_usd_monthly=um,
        buyout_ngn=bn, buyout_usd=bu, delivery_days=days, sort=(i+1)*10))

know = [
 ('k_about','About Ferrn','Ferrn Digital Agency (ferrnagency.com) is a Nigerian digital agency serving clients in Nigeria, the UK, the US, Canada and beyond. It designs and builds conversion-focused websites, custom web applications (portals, dashboards, workflow systems), SaaS and internal business systems, UI/UX design, AI automation and integrations, e-commerce, hosting, maintenance and support. Operating principle: make money, save time, solve something worth solving. Email: info@ferrnagency.com. Booking: https://cal.com/ferrn-agency.'),
 ('k_work','Selected work','Gromzia Ventures (logistics website), Synergix Africa (platform website), M-P Infrastructure (EPC corporate website), Insightblitz (Web3 growth website), Aroda (product ecosystem website), Fashion Fusion Africa (event website), Relay (freight revenue-control web app), PWAN EHA (AI chatbot for civic and legal guidance). Case studies are at /work.'),
 ('k_process','How projects run','Discover → Define → Design → Build → Launch. Websites typically take a few weeks; web applications and AI systems are delivered in milestones. Ferrn provides post-launch support and maintenance plans.'),
 ('k_pricing','Pricing guidance','Marketplace products have published prices at /marketplace (setup fee plus a monthly managed plan, or a code buyout). Custom websites and apps are quoted after a short discovery call. Never quote a custom price in chat; offer a call or the marketplace instead.'),
 ('k_marketplace','Marketplace','Ready-built products with live demos: Clinic Front Desk, School Admissions Portal, Logistics Quote & Track, Clinic/School/Real Estate/Logistics websites, AI Website Assistant, WhatsApp Appointment Reminders, Lead Follow-up Autopilot. Plans: Launch (deployed for you), Managed (hosted and maintained monthly), Own the code (buyout licence).'),
]
for k,t_,c in know: ins('knowledge', dict(id=k, title=t_, content=c))

ins('settings', dict(key='monthly_target_ngn', value='5000000'))
ins('settings', dict(key='chat_enabled', value='1'))

out = ROOT/'migrations'/'0002_seed.sql'
out.write_text('-- Starting content. Generated by scripts/gen-seed.py\n' + '\n'.join(rows) + '\n')
print('wrote', out, len(rows), 'rows')
