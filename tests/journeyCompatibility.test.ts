import { describe, expect, it } from 'vitest';
import { isMissingJourneyThemePreference } from '../lib/journeyCompatibility';

describe('journey schema compatibility', () => {
  it('recognizes the PostgreSQL missing-column response', () => {
    expect(
      isMissingJourneyThemePreference({
        message: 'column user_journeys.theme_preference does not exist',
      }),
    ).toBe(true);
  });

  it('recognizes the PostgREST schema-cache response used by inserts', () => {
    expect(
      isMissingJourneyThemePreference({
        message: "Could not find the 'theme_preference' column of 'user_journeys' in the schema cache",
      }),
    ).toBe(true);
  });

  it('does not hide unrelated database failures', () => {
    expect(
      isMissingJourneyThemePreference({
        message: 'column user_journeys.template_id does not exist',
      }),
    ).toBe(false);
    expect(
      isMissingJourneyThemePreference({
        message: 'permission denied for table user_journeys',
      }),
    ).toBe(false);
  });
});
