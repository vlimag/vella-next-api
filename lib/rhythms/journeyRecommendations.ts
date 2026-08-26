const SUPPORTED_LOCALES = new Set(['en', 'es', 'pt', 'fr', 'de', 'it', 'ru', 'pl']);
const ONBOARDING_GOALS = new Set(['hope', 'gratitude', 'trust', 'kindness']);

const JOURNEY_CATALOG = [{
  slug: 'daily-faith-journey',
  locales: SUPPORTED_LOCALES,
  goals: ONBOARDING_GOALS,
}] as const;

export type JourneyRecommendation = {
  template_slug: string;
  reason_code: 'onboarding_goal_match' | 'next_available';
};

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

export function recommendNextJourney({
  completed,
  goals,
  locale,
}: {
  completed: unknown;
  goals: unknown;
  locale: unknown;
}): JourneyRecommendation | null {
  if (typeof locale !== 'string' || !SUPPORTED_LOCALES.has(locale)) return null;

  const completedSlugs = new Set(strings(completed));
  const knownGoals = new Set(strings(goals).filter((goal) => ONBOARDING_GOALS.has(goal)));
  const eligible = JOURNEY_CATALOG.filter((template) => (
    template.locales.has(locale) && !completedSlugs.has(template.slug)
  ));
  const matched = eligible.find((template) => [...knownGoals].some((goal) => template.goals.has(goal)));
  if (matched) return { template_slug: matched.slug, reason_code: 'onboarding_goal_match' };

  const next = eligible[0];
  return next ? { template_slug: next.slug, reason_code: 'next_available' } : null;
}
