const SUPPORTED_LOCALES = new Set(['en', 'es', 'pt', 'fr', 'de', 'it', 'ru', 'pl']);
const ONBOARDING_GOALS = new Set(['hope', 'gratitude', 'trust', 'kindness']);

const JOURNEY_CATALOG = [
  { slug: 'daily-faith-journey', duration: 7, locales: SUPPORTED_LOCALES, goals: ONBOARDING_GOALS },
  { slug: 'steady_flame_14', duration: 14, locales: SUPPORTED_LOCALES, goals: new Set(['hope', 'gratitude']) },
  { slug: 'rooted_21', duration: 21, locales: SUPPORTED_LOCALES, goals: new Set(['trust', 'kindness']) },
  { slug: 'pilgrim_40', duration: 40, locales: SUPPORTED_LOCALES, goals: ONBOARDING_GOALS },
] as const;

export type JourneyRecommendation = {
  template_slug: string;
  reason_code: 'onboarding_goal_match' | 'theme_match' | 'resume_paused' | 'next_available';
};

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

export function recommendNextJourney({
  completed,
  goals,
  locale,
  paused,
}: {
  completed: unknown;
  goals: unknown;
  locale: unknown;
  paused?: unknown;
}): JourneyRecommendation | null {
  const resolvedLocale = typeof locale === 'string' && SUPPORTED_LOCALES.has(locale) ? locale : 'en';

  const completedSlugs = new Set(strings(completed).filter((slug) => (
    JOURNEY_CATALOG.some((template) => template.slug === slug)
  )));
  const knownGoals = new Set(strings(goals).filter((goal) => ONBOARDING_GOALS.has(goal)));
  if (
    typeof paused === 'string'
    && JOURNEY_CATALOG.some((template) => template.slug === paused)
    && !completedSlugs.has(paused)
  ) return { template_slug: paused, reason_code: 'resume_paused' };

  const eligible = JOURNEY_CATALOG.filter((template) => (
    template.locales.has(resolvedLocale) && !completedSlugs.has(template.slug)
  ));
  if (completedSlugs.size === 0) {
    const first = eligible.find((template) => template.slug === 'daily-faith-journey');
    if (first) return {
      template_slug: first.slug,
      reason_code: knownGoals.size > 0 ? 'onboarding_goal_match' : 'next_available',
    };
  }

  const matched = eligible.find((template) => (
    template.slug !== 'daily-faith-journey'
    && [...knownGoals].some((goal) => template.goals.has(goal))
  ));
  if (matched) return { template_slug: matched.slug, reason_code: 'theme_match' };

  const next = eligible[0];
  return next ? { template_slug: next.slug, reason_code: 'next_available' } : null;
}
