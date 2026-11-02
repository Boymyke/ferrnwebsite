/**
 * Ready-to-post media for the week of 3–9 Nov 2026 (made by Claude), served from /content/week-2026-11-03/.
 * Keyed by Lagos date + platform; Studio's calendar import attaches these to the matching posts.
 */
const B = '/content/week-2026-11-03/';
const img = (f: string) => ({ type: 'image', url: B + f });
const vid = (f: string) => ({ type: 'video', url: B + f });
const slides = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => img(`${prefix}-${i + 1}.png`));

export const WEEK_MEDIA: Record<string, { type: string; url: string }[]> = {
  '2026-11-03:x': [img('x-2026-11-03-60-second-test.png')],
  '2026-11-03:instagram': slides('ig-2026-11-03-slide', 7),
  '2026-11-04:x': [img('x-2026-11-04-reviews-beat-awards.png')],
  '2026-11-04:instagram': [img('ig-2026-11-04-three-questions.png')],
  '2026-11-05:tiktok': [vid('tiktok-2026-11-05-ai-assistant-demo.mp4')],
  '2026-11-06:instagram': slides('ig-2026-11-06-slide', 7),
  '2026-11-07:instagram': [vid('reel-2026-11-07-every-demo-is-live.mp4')],
  '2026-11-08:instagram': slides('ig-story-2026-11-08', 4),
  '2026-11-09:instagram': slides('ig-2026-11-09-slide', 6),
  '2026-11-09:tiktok': [vid('tiktok-2026-11-09-clinic-booking-demo.mp4')],
};
export const mediaKey = (scheduledAt: string, platform: string) =>
  `${new Date(new Date(scheduledAt).getTime() + 3600_000).toISOString().slice(0, 10)}:${platform}`; // Lagos is UTC+1
