const DATE_PART_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
};

export function normalizeTimeZone(value: unknown): string {
  if (typeof value !== 'string') return 'UTC';
  const candidate = value.trim();
  if (!candidate) return 'UTC';

  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: candidate }).resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
}

function localDateParts(now: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    ...DATE_PART_FORMAT_OPTIONS,
    timeZone: normalizeTimeZone(timezone),
  });
  const parts = formatter.formatToParts(now);
  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  const day = Number(parts.find((part) => part.type === 'day')?.value);
  return { year, month, day };
}

function dateKey(year: number, month: number, day: number) {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function localDateKey(now: Date, timezone: string): string {
  const { year, month, day } = localDateParts(now, timezone);
  return dateKey(year, month, day);
}

export function localWeekStart(now: Date, timezone: string): string {
  const { year, month, day } = localDateParts(now, timezone);
  const calendarDate = new Date(Date.UTC(year, month - 1, day));
  const daysSinceMonday = (calendarDate.getUTCDay() + 6) % 7;
  calendarDate.setUTCDate(calendarDate.getUTCDate() - daysSinceMonday);
  return dateKey(calendarDate.getUTCFullYear(), calendarDate.getUTCMonth() + 1, calendarDate.getUTCDate());
}
