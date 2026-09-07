import { describe, expect, it } from 'vitest';

type RecommendationModule = {
  recommendNextJourney?: (input: {
    completed: unknown;
    goals: unknown;
    locale: unknown;
    paused?: unknown;
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

  it('offers a deeper journey after the seven-session path without forcing one ladder', async () => {
    const module = await recommendations();

    expect(typeof module.recommendNextJourney).toBe('function');
    expect(module.recommendNextJourney!({
      completed: ['daily-faith-journey'],
      goals: ['hope'],
      locale: 'en',
    })).toEqual({ template_slug: 'steady_flame_14', reason_code: 'theme_match' });
  });

  it('resumes a paused longer path and lets a different goal skip the 14-session path', async () => {
    const module = await recommendations();
    expect(module.recommendNextJourney!({ completed: ['daily-faith-journey'], goals: ['trust'], locale: 'pt' })).toEqual({
      template_slug: 'rooted_21', reason_code: 'theme_match',
    });
    expect(module.recommendNextJourney!({ completed: ['daily-faith-journey'], goals: [], locale: 'en', paused: 'pilgrim_40' })).toEqual({
      template_slug: 'pilgrim_40', reason_code: 'resume_paused',
    });
  });

  it('returns null after every path and safely falls back to English for an unknown locale', async () => {
    const module = await recommendations();
    expect(module.recommendNextJourney!({
      completed: ['daily-faith-journey', 'steady_flame_14', 'rooted_21', 'pilgrim_40'], goals: [], locale: 'en',
    })).toBeNull();
    expect(module.recommendNextJourney!({ completed: [], goals: [], locale: 'unsupported' })).toEqual({
      template_slug: 'daily-faith-journey', reason_code: 'next_available',
    });
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
    expect(module.recommendNextJourney!({ completed: [], goals: ['hope'], locale: 'unsupported' })).toEqual({
      template_slug: 'daily-faith-journey', reason_code: 'onboarding_goal_match',
    });
  });
});
