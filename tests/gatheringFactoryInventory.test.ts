import { describe, expect, it, vi } from 'vitest';
import {
  chooseTheme,
  planMissingSlots,
  runGatheringFactory,
  type FactoryRepository,
} from '@/lib/gatheringFactory/inventory';
import type { GeneratedGathering } from '@/lib/gatheringFactory/contracts';
import { GATHERING_THEME_KEYS } from '@/lib/gatheringFactory/contracts';

const draft = (themeKey: GeneratedGathering['theme_key'] = 'peace'): GeneratedGathering => ({
  schema_version: 1,
  theme_key: themeKey,
  scripture_reference: 'Matthew 11:28',
  estimated_duration_seconds: 900,
  locales: Object.fromEntries(['en', 'es', 'pt', 'fr', 'de', 'it', 'ru', 'pl'].map((locale) => [locale, {
    title: 'A quiet beginning',
    summary: 'A safe and gentle guided Gathering for the present moment.',
    steps: [
      { section_type: 'arrival', body: 'Arrive gently.' },
      { section_type: 'opening_prayer', body: 'Let us pray.' },
      { section_type: 'scripture' },
      { section_type: 'reflection', body: 'Reflect quietly.' },
      { section_type: 'silence', body: 'Keep a moment of silence.' },
      { section_type: 'private_prayer', body: 'Pray privately.' },
      { section_type: 'action', body: 'Choose one gentle action.' },
      { section_type: 'closing', body: 'Go in peace.' },
    ],
  }])) as GeneratedGathering['locales'],
});

function repository(overrides: Partial<FactoryRepository> = {}): FactoryRepository {
  return {
    tryLock: vi.fn().mockResolvedValue('lease-token'),
    unlock: vi.fn().mockResolvedValue(undefined),
    listFutureSlots: vi.fn().mockResolvedValue([]),
    listRecentReleases: vi.fn().mockResolvedValue([]),
    listThemeMetrics: vi.fn().mockResolvedValue([]),
    hasPublishedEvergreenFallbacks: vi.fn().mockResolvedValue(false),
    createRun: vi.fn().mockResolvedValue({ id: 'run-1' }),
    completeRun: vi.fn().mockResolvedValue(undefined),
    publish: vi.fn().mockResolvedValue({ releaseId: 'release-1', published: true }),
    recordEvent: vi.fn().mockResolvedValue(undefined),
    writeHeartbeat: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('Gathering factory inventory', () => {
  it('plans only the future Monday and Thursday slots needed to restore twelve releases', () => {
    const now = new Date('2026-08-27T12:00:00.000Z');

    expect(planMissingSlots(now, [])).toHaveLength(12);
    const elevenFutureSlots = [
      ['2026-08-31', 'monday'], ['2026-08-31', 'thursday'],
      ['2026-09-07', 'monday'], ['2026-09-07', 'thursday'],
      ['2026-09-14', 'monday'], ['2026-09-14', 'thursday'],
      ['2026-09-21', 'monday'], ['2026-09-21', 'thursday'],
      ['2026-09-28', 'monday'], ['2026-09-28', 'thursday'],
      ['2026-10-05', 'monday'],
    ].map(([weekStart, slotType]) => ({ weekStart, slotType: slotType as 'monday' | 'thursday' }));

    expect(planMissingSlots(now, elevenFutureSlots)).toHaveLength(1);
  });

  it('does not run when another factory owns the advisory lock', async () => {
    const store = repository({ tryLock: vi.fn().mockResolvedValue(null) });

    const result = await runGatheringFactory({ repository: store, now: () => new Date('2026-08-27T12:00:00.000Z') });

    expect(result.status).toBe('locked');
    expect(store.publish).not.toHaveBeenCalled();
  });

  it('releases only the lease token that it successfully claimed', async () => {
    const store = repository();

    await runGatheringFactory({ repository: store, now: () => new Date('2026-08-27T12:00:00.000Z'), maxSlots: 0 });

    expect(store.unlock).toHaveBeenCalledWith('lease-token');
  });

  it('generates a missing slot once, records the safe stage telemetry, and publishes atomically', async () => {
    const store = repository();

    const result = await runGatheringFactory({
      repository: store,
      now: () => new Date('2026-08-27T12:00:00.000Z'),
      maxSlots: 1,
      generate: vi.fn().mockResolvedValue(draft()),
      review: vi.fn().mockResolvedValue(undefined),
      resolveScripture: vi.fn().mockResolvedValue(Object.fromEntries(['en', 'es', 'pt', 'fr', 'de', 'it', 'ru', 'pl'].map((locale) => [locale, { id: `${locale}-verse` }]))),
    });

    expect(result.telemetry.map((event) => event.eventName)).toEqual(expect.arrayContaining([
      'run_started', 'inventory_checked', 'generation_started', 'validation_succeeded',
      'review_succeeded', 'publish_succeeded', 'heartbeat_written', 'run_completed',
    ]));
    expect(store.publish).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ planned: 1, published: 1, rejected: 0, futureInventory: 1, lastReleaseId: 'release-1' });
  });

  it('uses dry run only to calculate planned counts without acquiring a lock or writing anything', async () => {
    const store = repository({ listFutureSlots: vi.fn().mockResolvedValue([
      { weekStart: '2026-08-31', slotType: 'monday' }, { weekStart: '2026-08-31', slotType: 'thursday' },
      { weekStart: '2026-09-07', slotType: 'monday' }, { weekStart: '2026-09-07', slotType: 'thursday' },
      { weekStart: '2026-09-14', slotType: 'monday' }, { weekStart: '2026-09-14', slotType: 'thursday' },
      { weekStart: '2026-09-21', slotType: 'monday' }, { weekStart: '2026-09-21', slotType: 'thursday' },
      { weekStart: '2026-09-28', slotType: 'monday' }, { weekStart: '2026-09-28', slotType: 'thursday' },
      { weekStart: '2026-10-05', slotType: 'monday' },
    ]) });
    const generate = vi.fn();

    const result = await runGatheringFactory({
      repository: store,
      now: () => new Date('2026-08-27T12:00:00.000Z'),
      dryRun: true,
      maxSlots: 1,
      generate,
    });

    expect(result).toMatchObject({ planned: 1, published: 0, rejected: 0, futureInventory: 11 });
    expect(generate).not.toHaveBeenCalled();
    expect(store.tryLock).not.toHaveBeenCalled();
    expect(store.createRun).not.toHaveBeenCalled();
    expect(store.publish).not.toHaveBeenCalled();
    expect(store.recordEvent).not.toHaveBeenCalled();
    expect(store.writeHeartbeat).not.toHaveBeenCalled();
  });

  it('retries a failed slot twice and reports one safe critical incident without publishing', async () => {
    const report = vi.fn().mockResolvedValue(undefined);
    const store = repository({ listFutureSlots: vi.fn().mockResolvedValue([
      { weekStart: '2026-08-31', slotType: 'monday' }, { weekStart: '2026-08-31', slotType: 'thursday' },
      { weekStart: '2026-09-07', slotType: 'monday' }, { weekStart: '2026-09-07', slotType: 'thursday' },
    ]) });

    const result = await runGatheringFactory({
      repository: store,
      now: () => new Date('2026-08-27T12:00:00.000Z'),
      maxSlots: 1,
      generate: vi.fn().mockRejectedValue(new Error('private candidate')),
      incidentSink: { report },
    });

    expect(result).toMatchObject({ planned: 1, published: 0, rejected: 1 });
    expect(store.createRun).toHaveBeenCalledTimes(2);
    expect(store.publish).not.toHaveBeenCalled();
    expect(report).toHaveBeenCalledWith(expect.objectContaining({ severity: 'critical', code: 'generation_failed', inventoryDepth: 4 }));
  });

  it('reports a warning when future inventory is below six even when no generation is requested', async () => {
    const report = vi.fn().mockResolvedValue(undefined);
    const store = repository({ listFutureSlots: vi.fn().mockResolvedValue([
      { weekStart: '2026-08-31', slotType: 'monday' }, { weekStart: '2026-08-31', slotType: 'thursday' },
      { weekStart: '2026-09-07', slotType: 'monday' }, { weekStart: '2026-09-07', slotType: 'thursday' },
    ]) });

    await runGatheringFactory({ repository: store, now: () => new Date('2026-08-27T12:00:00.000Z'), maxSlots: 0, incidentSink: { report } });

    expect(report).toHaveBeenCalledWith(expect.objectContaining({ severity: 'warning', code: 'inventory_low' }));
  });

  it('uses balanced rotation until the candidate and comparison thresholds are met', () => {
    expect(chooseTheme(GATHERING_THEME_KEYS.map((themeKey) => ({
      themeKey,
      starts: themeKey === 'hope' ? 0 : 29,
      completions: themeKey === 'hope' ? 0 : 20,
    })))).toBe('hope');
  });

  it('keeps themes with no historical metrics in the balanced rotation', () => {
    expect(chooseTheme([
      { themeKey: 'peace', starts: 1, completions: 1 },
      { themeKey: 'hope', starts: 1, completions: 1 },
    ])).not.toBe('hope');
  });

  it('uses the smoothed completion score only after 30 candidate starts and 100 comparison starts', () => {
    expect(chooseTheme(GATHERING_THEME_KEYS.map((themeKey) => ({
      themeKey,
      starts: 50,
      completions: themeKey === 'hope' ? 45 : 20,
    })))).toBe('hope');
  });
});
