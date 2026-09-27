# Ferrn Platform V2

Ferrn V2 is designed as a procurement-ready digital agency platform rather than a brochure website.

## Product areas

1. Public website: positioning, services, work, industries, team, procurement, policies, insights and RFP intake.
2. Modular CMS: editable site settings plus reusable sections/collections for team, certifications, awards, policies, procurement data and knowledge-base content.
3. Contract acquisition: dedicated RFP intake, capability statement/company profile links, proposals and campaign microsites.
4. AI publishing: scheduled trend discovery, SEO topic qualification, article generation, image generation, internal linking and optional editorial approval.
5. Conversational sales: Ferrn-trained chatbot that answers from approved knowledge and can route qualified visitors to a meeting link.
6. First-party analytics: consent-aware page/session/click events, referrers, devices and country when supplied by the edge/proxy.
7. Newsletter: subscriber capture, export and a future authenticated sending queue.

## Current hosting strategy

The existing PHP/cPanel architecture is retained so Ferrn can deploy without moving hosting immediately. Private CMS data remains outside public_html in the existing ferrn_cms directory. The V2 branch should be tested before merging to main.

## Required production secrets

Set outside the repository, never in Git:

- OPENAI_API_KEY
- FERRN_AI_CRON_KEY (only if cron is invoked over HTTP; CLI cron is preferred)
- SMTP host/user/password/from details for production newsletter delivery
- Optional analytics/edge integration values if Cloudflare country headers are not available

## AI publishing guardrails

10 articles/day is supported as a configurable ceiling, not a requirement to publish 10 low-quality pages. The pipeline should reject irrelevant trends, duplicates, thin topics and topics outside Ferrn's commercial expertise. Auto-publish can be disabled so generated articles enter draft review.

Google Trends provides frequently refreshed Trending Now data and export options including RSS. OpenAI text/image models are configured from admin/environment so model upgrades do not require code changes.

## Design direction

Use Ferrn orange (#ff4100) as an accent rather than a full-page fill. Poppins remains the primary typeface with regular/medium weights dominant. Motion should use GSAP for purposeful reveals, pinned storytelling, card stacking, masked typography and transitions while respecting prefers-reduced-motion. Use Lucide icons and animate icon containers on hover instead of excessive decorative graphics.

Awwwards inspiration is being used for patterns (large editorial typography, whitespace, immersive transitions, portfolio storytelling, dynamic menus, page transitions and restrained micro-interactions), not for copying layouts.
