import { describe, expect, it } from 'vitest';

type TimeModule = {
  normalizeTimeZone?: (value: unknown) => string;
  localDateKey?: (now: Date, timezone: string) => string;
  localWeekStart?: (now: Date, timezone: string) => string;
};

const timeModulePath = '../lib/rhythms/time';

async function loadTimeModule(): Promise<TimeModule> {
  return import(timeModulePath).catch(() => ({}));
}

function requireFunction<T extends (...args: never[]) => unknown>(value: T | undefined): T {
  expect(typeof value).toBe('function');
  return value as T;
}

describe('Rhythms local time semantics', () => {
  it.each([
    [undefined, 'UTC'],
    [null, 'UTC'],
    ['', 'UTC'],
    ['   ', 'UTC'],
    ['America/Definitely_Not_A_Zone', 'UTC'],
    ['../../private', 'UTC'],
  ])('falls back deterministically to UTC for %j', async (value, expected) => {
    const module = await loadTimeModule();
    const normalizeTimeZone = requireFunction(module.normalizeTimeZone);

    expect(normalizeTimeZone(value)).toBe(expected);
  });

  it('accepts runtime-supported IANA zones and trims input', async () => {
    const module = await loadTimeModule();
    const normalizeTimeZone = requireFunction(module.normalizeTimeZone);

    expect(normalizeTimeZone(' Pacific/Kiritimati ')).toBe('Pacific/Kiritimati');
    expect(normalizeTimeZone('Etc/GMT+12')).toBe('Etc/GMT+12');
  });

  it.each([
    ['+01:00', '2026-01-04T23:30:00.000Z', '2026-01-04', '2025-12-29'],
    ['-12:00', '2026-01-05T00:30:00.000Z', '2026-01-05', '2026-01-05'],
  ])('rejects fixed offset %s and derives its calendar boundary in UTC', async (
    timezone,
    instant,
    expectedDay,
    expectedWeek,
  ) => {
    const module = await loadTimeModule();
    const normalizeTimeZone = requireFunction(module.normalizeTimeZone);
    const localDateKey = requireFunction(module.localDateKey);
    const localWeekStart = requireFunction(module.localWeekStart);
    const now = new Date(instant);

    expect(normalizeTimeZone(timezone)).toBe('UTC');
    expect(localDateKey(now, timezone)).toBe(expectedDay);
    expect(localWeekStart(now, timezone)).toBe(expectedWeek);
  });

  it('distinguishes UTC-12 and UTC+14 across a year boundary', async () => {
    const module = await loadTimeModule();
    const localDateKey = requireFunction(module.localDateKey);
    const instant = new Date('2026-01-01T10:30:00.000Z');

    expect(localDateKey(instant, 'Etc/GMT+12')).toBe('2025-12-31');
    expect(localDateKey(instant, 'Pacific/Kiritimati')).toBe('2026-01-02');
  });

  it('uses calendar parts across the spring DST transition', async () => {
    const module = await loadTimeModule();
    const localDateKey = requireFunction(module.localDateKey);

    expect(localDateKey(new Date('2026-03-08T04:30:00.000Z'), 'America/New_York')).toBe('2026-03-07');
    expect(localDateKey(new Date('2026-03-08T07:30:00.000Z'), 'America/New_York')).toBe('2026-03-08');
  });

  it('uses calendar parts across the repeated fall DST hour', async () => {
    const module = await loadTimeModule();
    const localDateKey = requireFunction(module.localDateKey);

    expect(localDateKey(new Date('2026-11-01T05:30:00.000Z'), 'America/New_York')).toBe('2026-11-01');
    expect(localDateKey(new Date('2026-11-01T06:30:00.000Z'), 'America/New_York')).toBe('2026-11-01');
  });

  it('falls back to UTC when date derivation receives an unsupported zone', async () => {
    const module = await loadTimeModule();
    const localDateKey = requireFunction(module.localDateKey);

    expect(localDateKey(new Date('2026-01-01T23:30:00.000Z'), 'Invalid/Zone')).toBe('2026-01-01');
  });

  it.each([
    ['2026-01-01T10:30:00.000Z', 'Etc/GMT+12', '2025-12-29'],
    ['2026-01-01T10:30:00.000Z', 'Pacific/Kiritimati', '2025-12-29'],
    ['2026-03-08T07:30:00.000Z', 'America/New_York', '2026-03-02'],
    ['2026-11-01T06:30:00.000Z', 'America/New_York', '2026-10-26'],
    ['2026-03-01T00:30:00.000Z', 'UTC', '2026-02-23'],
  ])('derives Monday week start for %s in %s', async (instant, timezone, expected) => {
    const module = await loadTimeModule();
    const localWeekStart = requireFunction(module.localWeekStart);

    expect(localWeekStart(new Date(instant), timezone)).toBe(expected);
  });
});
