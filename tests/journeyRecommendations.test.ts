import { describe, expect, it } from 'vitest';

type RecommendationModule = {
  recommendNextJourney?: (input: {
    completed: unknown;
    goals: unknown;
    locale: unknown;
  }) => { template_slug: string; reason_code: string } | null;
};

const modulePath = '../lib/rhythms/journeyRecommendations';

async function recommendations(): Promise<RecommendationModule> {
  return import(modulePath).catch(() => ({}));
}

describe('journey recommendations', () => {
  it('returns the published seven-session journey for a matching onboarding goal', async () => {
    const module = await recommendations();

    expect(typeof module.recommendNextJourney).toBe('function');
    expect(module.recommendNextJourney!({
      completed: [],
      goals: ['gratitude'],
      locale: 'en',
    })).toEqual({
      template_slug: 'daily-faith-journey',
      reason_code: 'onboarding_goal_match',
    });
  });

  it('does not recommend an already-completed catalog journey when no eligible alternative exists', async () => {
    const module = await recommendations();

    expect(typeof module.recommendNextJourney).toBe('function');
    expect(module.recommendNextJourney!({
      completed: ['daily-faith-journey'],
      goals: ['hope'],
      locale: 'en',
    })).toBeNull();
  });

  it('is deterministic and safely ignores malformed inputs without producing free-form output', async () => {
    const module = await recommendations();
    const input = { completed: ['unknown', 3, null], goals: ['trust', 'hope', 'unknown', {}], locale: 'pt' };

    expect(typeof module.recommendNextJourney).toBe('function');
    expect(module.recommendNextJourney!(input)).toEqual({
      template_slug: 'daily-faith-journey',
      reason_code: 'onboarding_goal_match',
    });
    expect(module.recommendNextJourney!(input)).toEqual(module.recommendNextJourney!(input));
    expect(module.recommendNextJourney!({ completed: [], goals: ['hope'], locale: 'unsupported' })).toBeNull();
  });
});
