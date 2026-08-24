import { SITE_URL } from '@/lib/site/config';

export function GET() {
  const body = `# Vella

> Vella is a daily Christian faith app for Scripture reflection, guided habits, private notes, and moderated community.

Canonical website: ${SITE_URL}
Product features: ${SITE_URL}/features
Private Prayer Space: ${SITE_URL}/features/prayer-space
Journal: ${SITE_URL}/blog
Prayer Space guide: ${SITE_URL}/blog/a-daily-prayer-space-for-real-life
Support and account deletion: ${SITE_URL}/support
Privacy policy: ${SITE_URL}/privacy
Terms of use: ${SITE_URL}/terms
Community guidelines: ${SITE_URL}/community-guidelines

Vella supports English, Portuguese, Spanish, French, German, Italian, Russian, and Polish interfaces. Localized pages use the corresponding language prefix, except English, which is served at the canonical unprefixed URL.

Prayer Space is a private devotional flow for naming a need, receiving Scripture from Vella's approved stored corpus, praying in the user's own words, and preserving a personal prayed-or-answered gratitude timeline. Prayer Space intentions and prayers are not public, are not sent to AI, and are not included in notifications.

Vella uses AI selectively for natural-language Bible-search intent expansion and community safety support. AI output is not spiritual authority, professional advice, or a substitute for checking Scripture in a trusted Bible edition.
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  });
}
