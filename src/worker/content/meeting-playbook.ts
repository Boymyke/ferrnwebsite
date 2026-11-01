/**
 * Discovery-call playbook used by Studio → Meetings → "Meeting brief".
 * Order matters: open → situation → problem → impact → decision → close.
 * Keep calls to 20–30 minutes; the goal of call one is a quote request, not a sale.
 */
export type Stage = { stage: string; goal: string; questions: string[] };

export const CORE_FLOW: Stage[] = [
  { stage: 'Open (2 min)', goal: 'Set the agenda and earn the right to ask questions.', questions: [
    'Thanks for making time. I’d like to understand how enquiries reach you today, show you two or three things we noticed on your site, and agree whether it’s worth a proposal. Does that work?',
    'Before we start — what made you take this call?',
  ] },
  { stage: 'Situation (5 min)', goal: 'Understand how the business runs today.', questions: [
    'Walk me through what happens from the moment a new customer finds you to the moment they pay.',
    'Where do most of your new customers come from right now — referrals, Google, Instagram, WhatsApp, walk-ins?',
    'Who on your team handles enquiries, and how many do they handle in a normal week?',
    'What tools are you using today — spreadsheets, WhatsApp groups, paper forms, any software?',
  ] },
  { stage: 'Problem (5 min)', goal: 'Get them to name the pain in their own words.', questions: [
    'What part of that process frustrates you or your team the most?',
    'When an enquiry comes in after hours or at a weekend, what happens to it?',
    'Have you ever lost a customer because they couldn’t reach you or find what they needed online?',
  ] },
  { stage: 'Impact (5 min)', goal: 'Put a number on the problem.', questions: [
    'Roughly how many enquiries do you think slip through in a month?',
    'What is one new customer worth to you over a year?',
    'If that was fixed in the next 30 days, what would change for the business?',
  ] },
  { stage: 'Decision (3 min)', goal: 'Understand budget, timing and who decides.', questions: [
    'Besides you, who else would be involved in deciding on something like this?',
    'Is there a date this needs to be working by — a new term, a launch, a busy season?',
    'Have you set aside a budget for this, or should I give you options at different levels?',
    'Would you prefer to pay once and own it, or a monthly plan where we host and maintain everything?',
  ] },
  { stage: 'Close (2 min)', goal: 'Agree the next step before hanging up.', questions: [
    'Based on what you’ve told me, I’d suggest [product/plan]. I can send a written quote today — who should it go to?',
    'Can we book 15 minutes on [day] to walk through the quote together?',
  ] },
];

export const NICHE_QUESTIONS: Record<string, string[]> = {
  clinic: [
    'How do patients book today — phone, WhatsApp, walk-in, or a form?',
    'How many appointments a day across all branches? What is your no-show rate roughly?',
    'Which specialties do patients ask about most that aren’t easy to find on your site?',
    'Do you work with HMOs? Would patients need to see which HMOs you accept?',
    'Who confirms appointments now, and how long does that take each morning?',
    'Is there anything about patient data you need us to be careful with (records, results)?',
  ],
  school: [
    'How do parents apply today — paper forms, Google Forms, in person?',
    'How many applications do you get per session, and how many places do you have?',
    'When does admissions open for the next session? What’s the entrance exam process?',
    'How do you collect the form fee now? Would online payment help?',
    'What do parents ask most often before they apply?',
    'Do you already have a results portal or school app we should connect to or replace?',
  ],
  logistics: [
    'How do clients request a quote today, and how quickly can you reply?',
    'What do clients call you about most once a shipment is moving?',
    'Which routes and modes (air, sea, road) make up most of your revenue?',
    'How do you update clients on shipment status — WhatsApp, email, calls?',
    'Do you work with corporate clients who would want a portal with their shipment history?',
    'Is there a system you already use (a TMS, spreadsheets) that tracking would need to read from?',
  ],
  realestate: [
    'How many active listings do you have, and where are they listed today?',
    'How do buyers book inspections now?',
    'Do you sell off-plan projects that need their own pages and payment plans?',
    'What share of enquiries come from diaspora buyers?',
  ],
  default: [
    'What is the one action you most want a visitor to take on your website?',
    'What does your best customer have in common?',
    'Which competitor do customers compare you with, and why do they choose you?',
  ],
};

export const OBJECTIONS: { objection: string; response: string }[] = [
  { objection: 'It’s too expensive.', response: 'Compare it with the value of the customers you said slip through each month. If it pays for itself with two customers, is the question price or timing? We also have a monthly plan with a lower setup fee.' },
  { objection: 'We already have a website.', response: 'Keep it if it works — we can add only the booking/admissions/quote piece. What we found was that [gap], so visitors can’t take the next step.' },
  { objection: 'Let me think about it.', response: 'Of course. What specifically would you want to think through — budget, timing or who else should see it? I can send a short written summary to make that easier.' },
  { objection: 'My nephew/IT guy can do it.', response: 'That can work. The difference is that we host, maintain and support it, with a fixed monthly cost and a written uptime commitment. If it helps, we can hand him the plan.' },
  { objection: 'We tried a website before and it didn’t bring customers.', response: 'Most sites fail because they don’t give visitors a clear next action or anyone to answer them. That is exactly what booking + WhatsApp follow-up fixes — and we report the enquiries it captures every month.' },
];

export function nicheKey(niche?: string | null) {
  const n = (niche ?? '').toLowerCase();
  if (/clinic|hospital|health|medical|diagnos/.test(n)) return 'clinic';
  if (/school|college|academy|education/.test(n)) return 'school';
  if (/logistic|freight|cargo|haulage|courier|shipping/.test(n)) return 'logistics';
  if (/real ?estate|property|homes/.test(n)) return 'realestate';
  return 'default';
}

export const NICHE_PRODUCT: Record<string, string> = {
  clinic: 'clinic-front-desk', school: 'school-admissions-portal', logistics: 'logistics-quote-track',
  realestate: 'real-estate-website', default: 'ai-website-assistant',
};
