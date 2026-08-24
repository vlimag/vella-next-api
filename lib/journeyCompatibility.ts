type PostgrestErrorLike = {
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

/**
 * Temporary read/write compatibility while migration 0012 rolls out.
 * Keep this intentionally specific so unrelated database errors are never retried.
 */
export function isMissingJourneyThemePreference(error: PostgrestErrorLike | null | undefined) {
  if (!error) return false;

  const description = `${error.message ?? ''} ${error.details ?? ''} ${error.hint ?? ''}`.toLowerCase();
  const identifiesColumn = description.includes('theme_preference');
  const identifiesTable = description.includes('user_journeys');
  const identifiesMissingSchema =
    description.includes('does not exist') ||
    description.includes('schema cache') ||
    description.includes('could not find');

  return identifiesColumn && identifiesTable && identifiesMissingSchema;
}
