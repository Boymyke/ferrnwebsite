/** Clients for the "Trusted by" marquee. Transparent WebP files in /assets/clients/ (from the old site's
 *  repo, plus Ataam from its brand assets in Drive). `w` is the drawn width at 40px tall. */
export const CLIENT_LOGOS: { name: string; file: string; w: number }[] = [
  { name: 'Ataam', file: 'ataam', w: 96 }, { name: 'Gromzia', file: 'clientLogo2', w: 40 }, { name: 'Synergix Africa', file: 'clientLogo5', w: 250 },
  { name: 'MPI — M-P Infrastructure', file: 'clientLogo1', w: 44 }, { name: 'Knomi', file: 'clientLogo3', w: 132 }, { name: 'Aroda', file: 'clientLogo4', w: 39 },
  { name: 'Outbox Experience', file: 'clientLogo10', w: 103 }, { name: 'Padher', file: 'clientLogo8', w: 126 }, { name: 'WIB Fair — Women in Business Fair', file: 'clientLogo12', w: 131 },
  { name: 'Client', file: 'clientLogo6', w: 40 }, { name: 'Client', file: 'clientLogo7', w: 45 }, { name: 'Client', file: 'clientLogo9', w: 48 }, { name: 'Client', file: 'clientLogo11', w: 56 },
];

/** Home showreel: live client sites, captured full-page into R2 (Studio → POST /api/studio/capture → reel/<slug>.webp). */
export const REEL: { name: string; slug: string; url: string; work?: string }[] = [
  { name: 'Synergix Africa', slug: 'synergix', url: 'https://www.synergixafrica.com/', work: 'synergix' },
  { name: 'MPI Africa', slug: 'mpi', url: 'https://www.mpiafrica.com/', work: 'mpi' },
  { name: 'Gromzia', slug: 'gromzia', url: 'https://www.gromzialtd.com/', work: 'gromzia' },
  { name: 'Relay — freight app', slug: 'relay', url: 'https://freight-app1.netlify.app/', work: 'relay' },
  { name: 'Insightblitz', slug: 'insightblitz', url: 'https://insightblitz.io/', work: 'insightblitz' },
];
// Not in the reel: arodagroup.com and eha.partnersnigeria.org show a bot check to the capture browser;
// fashionfusionafrica.com refused the connection (4 Nov). Re-try them with POST /api/studio/capture later.

export const STATS = [
  { value: 50, suffix: '+', label: 'projects across websites, web applications and AI systems' },
  { value: 99, suffix: '%', label: 'project completion rate and client satisfaction' },
  { value: 10, suffix: '+', label: 'industries served, from healthcare to energy' },
  { value: 25, suffix: '+', label: 'years of combined team experience' },
];

export const PROCESS = [
  ['01 / Discover', 'Understand', 'We find the commercial problem, users, constraints and what success should mean.'],
  ['02 / Define', 'Scope', 'We turn the problem into a focused website, application or automation roadmap.'],
  ['03 / Design', 'Shape', 'We make the experience visible early so important decisions happen before expensive build work.'],
  ['04 / Build', 'Develop', 'Frontend, backend, integrations and content systems are implemented and tested.'],
  ['05 / Launch', 'Ship', 'We deploy, hand over, support and improve using real business feedback.'],
];

export const FAQS = [
  ['What kinds of projects do you take on?', 'Conversion-focused websites, custom web applications, portals, dashboards and practical AI automation. If a project will not clearly improve trust, revenue, efficiency or visibility, we will say so before we build anything.'],
  ['How much does a project cost?', 'Marketplace products have published prices — a setup fee plus a monthly plan, or a one-off code purchase. Custom websites, applications and AI systems are scoped first, then we recommend the smallest useful solution.'],
  ['How long does a typical project take?', 'Marketplace products go live in 5–14 days. Custom websites take a few weeks; larger applications are delivered in milestones so you can review progress early.'],
  ['Do I own my website?', 'Your content, domain and data are always yours. On managed plans we host and maintain the software; you can buy the code outright at any time, and you can export your data whenever you like.'],
  ['Can you work with our existing team?', 'Yes. We can be the full strategy-design-development team or plug into an existing internal team where design, frontend, backend or AI support is needed.'],
  ['Do you provide support after launch?', 'Yes. Managed plans include hosting, security updates, backups and support. Custom projects can add a maintenance plan.'],
];

export const SERVICES_DETAIL = [
  { key: 's1', icon: 'monitor', items: ['Positioning & copy', 'UI/UX design', 'Fast, SEO-ready build', 'Booking, quote & enquiry flows', 'Analytics & Search Console', 'Hosting & care plans'] },
  { key: 's2', icon: 'layout', items: ['Client & patient portals', 'Admin dashboards', 'Workflow & approvals', 'Payments (Paystack, Stripe)', 'Role-based access & audit logs', 'Integrations & APIs'] },
  { key: 's3', icon: 'sparkles', items: ['Website & WhatsApp assistants', 'Document intelligence', 'Lead follow-up automation', 'Voice assistants (Nigerian voices)', 'Internal AI copilots', 'Reporting automations'] },
];

export const SOCIALS = [
  ['Instagram', 'https://www.instagram.com/ferrn.agency/'],
  ['X', 'https://x.com/ferrn_agency'],
  ['LinkedIn', 'https://www.linkedin.com/company/109135329/'],
  ['TikTok', 'https://www.tiktok.com/@ferrnagency'],
];

/** Control-centre music. Free tracks from Pixabay (Pixabay Content License — free to use on the site, no
 *  attribution required; we credit anyway). Files live in R2 under music/ and stream from /media/. */
export const MUSIC: { title: string; artist: string; src: string; length: string; page: string }[] = [
  { title: 'Calm Ambient', artist: 'VelarioMusic', src: '/media/music/2026-11/3f128b2d8e5a.mp3', length: '3:32', page: 'https://pixabay.com/music/ambient-calm-ambient-613378/' },
  { title: 'Warm Story', artist: 'Strawberry_Candy', src: '/media/music/2026-11/f24ee0306caf.mp3', length: '1:56', page: 'https://pixabay.com/music/corporate-chill-advertising-music-warm-story-627308/' },
  { title: 'Chill Downtempo', artist: 'AtlasAudio', src: '/media/music/2026-11/ec51e39231bf.mp3', length: '2:54', page: 'https://pixabay.com/music/lofi-chill-downtempo-613513/' },
  { title: 'Chill Ambient', artist: 'VelarioMusic', src: '/media/music/2026-11/742c082d4378.mp3', length: '3:44', page: 'https://pixabay.com/music/ambient-chill-ambient-589693/' },
  { title: 'Beautiful Chill', artist: 'AtlasAudio', src: '/media/music/2026-11/e9cd8d124ba9.mp3', length: '1:45', page: 'https://pixabay.com/music/ambient-beautiful-chill-589968/' },
  { title: 'Chill Beats Instrumental', artist: 'Sub_Clair', src: '/media/music/2026-11/0effdcd9a119.mp3', length: '2:39', page: 'https://pixabay.com/music/beats-chill-beats-instrumental-628039/' },
];
